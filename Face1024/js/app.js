import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// *** เปลี่ยนตรงนี้เป็น Config ของโปรเจกต์ใหม่ ***
const firebaseConfig = {
    apiKey: "YOUR_NEW_API_KEY",
    authDomain: "YOUR_NEW_DOMAIN",
    projectId: "YOUR_NEW_PROJECT_ID",
    storageBucket: "YOUR_NEW_BUCKET",
    messagingSenderId: "...",
    appId: "..."
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// เปิดใช้งานโหมด Offline (ซิงค์ Log อัตโนมัติเมื่อเน็ตมา)
enableIndexedDbPersistence(db).catch(console.warn);

let allStudents = [];
let activeStudents = [];
const scannedSet = new Set();
const MATCH_THRESHOLD = 0.75; 
let unrecognizedFrames = 0; // ตัวนับเฟรมสำหรับคนที่สแกนไม่ติด

function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] ** 2;
        normB += vecB[i] ** 2;
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

const dbName = "FaceScanDB";
const storeName = "students";

function openLocalDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (event) => {
            const localDB = event.target.result;
            if (!localDB.objectStoreNames.contains(storeName)) {
                localDB.createObjectStore(storeName, { keyPath: "studentId" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ----------------------------------------------------
// ระบบโหลดข้อมูล: อ่านจาก IndexedDB ก่อน ถ้าไม่มีค่อยโหลดจาก Storage
// ----------------------------------------------------
async function loadStudentData() {
    const localDB = await openLocalDB();
    const tx = localDB.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.getAll();

    return new Promise((resolve) => {
        request.onsuccess = async () => {
            const localData = request.result;
            if (localData && localData.length > 0) {
                allStudents = localData;
                activeStudents = [...allStudents];
                console.log(`(Offline Cache) โหลดข้อมูลสำเร็จ ${allStudents.length} คน | ใช้โควตา Read = 0`);
                resolve(true);
            } else {
                resolve(await fetchAndCacheFromStorage());
            }
        };
    });
}

// ----------------------------------------------------
// ดาวน์โหลด JSON ก้อนใหญ่จาก Storage (ใช้โควตา Read = 0 ของ Firestore)
// ----------------------------------------------------
async function fetchAndCacheFromStorage() {
    Swal.fire({ title: 'กำลังดึงฐานข้อมูลส่วนกลาง...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    try {
        const jsonRef = ref(storage, 'students.json');
        const url = await getDownloadURL(jsonRef);
        
        const response = await fetch(url);
        const students = await response.json();

        const localDB = await openLocalDB();
        const tx = localDB.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        store.clear(); 
        students.forEach(student => store.put(student)); 

        allStudents = students;
        activeStudents = [...allStudents];
        scannedSet.clear();

        console.log(`(Storage) ดึงข้อมูลอัปเดตล่าสุดสำเร็จ ${students.length} คน`);
        return true;
    } catch (error) {
        console.error("Error fetching Storage JSON: ", error);
        Swal.fire('ข้อผิดพลาด', 'ไม่พบไฟล์ฐานข้อมูล หรือไม่ได้เชื่อมต่ออินเทอร์เน็ต', 'error');
        return false;
    }
}

async function logScanRecord(studentId, similarityScore) {
    try {
        await addDoc(collection(db, "scan_logs"), {
            studentId: studentId,
            similarity: similarityScore,
            timestamp: serverTimestamp(),
            status: "success"
        });
    } catch (error) {
        console.error("Error saving log: ", error);
    }
}

window.checkAuth = function() {
    const email = document.getElementById('adminEmail').value.trim();
    const pass = document.getElementById('adminPassword').value;

    if(email === '' || pass === '') return Swal.fire('แจ้งเตือน', 'กรุณากรอกข้อมูล', 'warning');

    Swal.fire({ title: 'ตรวจสอบสิทธิ์...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    signInWithEmailAndPassword(auth, email, pass)
        .then(async () => {
            const isLoaded = await loadStudentData();
            if (isLoaded) {
                document.getElementById('auth-overlay').style.display = 'none';
                document.getElementById('mainApp').style.display = 'flex';
                initAI(); 
            }
        })
        .catch(() => Swal.fire('ล้มเหลว', 'ข้อมูลเข้าระบบไม่ถูกต้อง', 'error'));
};

let human;
const videoElement = document.getElementById('video-feed');
const humanConfig = {
    backend: 'wasm', modelBasePath: 'https://vladmandic.github.io/human/models/',
    filter: { equalization: true },
    face: { enabled: true, detector: { rotation: false, return: true }, mesh: { enabled: true }, iris: { enabled: true }, description: { enabled: true } },
    body: { enabled: false }, hand: { enabled: false }, object: { enabled: false }
};

async function initAI() {
    try {
        human = new Human.Human(humanConfig);
        await human.load(); 
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        videoElement.srcObject = stream;
        videoElement.onloadeddata = () => { videoElement.play(); detectionLoop(); };
    } catch (err) {
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเปิดกล้องได้', 'error');
    }
}

let lastDetectTime = 0;
async function detectionLoop() {
    if (!videoElement.paused && !videoElement.ended) {
        const now = Date.now();
        if (now - lastDetectTime >= 300) {
            lastDetectTime = now;
            const result = await human.detect(videoElement);

            if (result.face && result.face.length > 0 && activeStudents.length > 0) {
                const face = result.face[0]; 
                
                if (face.score > 0.60 && face.embedding) {
                    let bestMatch = null;
                    let highestSimilarity = -1;

                    for (const student of activeStudents) {
                        const similarity = cosineSimilarity(face.embedding, student.faceVector);
                        if (similarity > highestSimilarity) {
                            highestSimilarity = similarity;
                            bestMatch = student;
                        }
                    }

                    if (highestSimilarity >= MATCH_THRESHOLD) {
                        unrecognizedFrames = 0; // รีเซ็ตตัวนับหากสแกนผ่าน
                        const sid = bestMatch.studentId;
                        
                        if (!scannedSet.has(sid)) {
                            scannedSet.add(sid); 
                            activeStudents = allStudents.filter(s => !scannedSet.has(s.studentId));
                            updateScanUI(sid);
                            logScanRecord(sid, highestSimilarity);
                        }
                    } else {
                        // ------------------------------------------------
                        // ระบบนับเฟรม: พบใบหน้าแต่คะแนนไม่ถึงเกณฑ์
                        // ------------------------------------------------
                        unrecognizedFrames++;
                        if (unrecognizedFrames >= 10) { // ประมาณ 3 วินาที (300ms * 10)
                            Swal.fire({
                                toast: true,
                                position: 'top-end',
                                icon: 'warning',
                                title: 'ไม่พบข้อมูล หรือ สแกนไม่ผ่าน',
                                text: 'กรุณาติดต่อ Admin เพื่ออัปเดตฐานข้อมูลส่วนกลาง',
                                showConfirmButton: false,
                                timer: 4000,
                                background: '#fff3cd',
                                color: '#856404'
                            });
                            unrecognizedFrames = 0; // รีเซ็ตเพื่อไม่ให้แจ้งเตือนรัวเกินไป
                        }
                    }
                }
            } else {
                unrecognizedFrames = 0; // ไม่มีคนยืนอยู่หน้ากล้อง ให้รีเซ็ตตัวนับ
            }
        }
    }
    requestAnimationFrame(detectionLoop);
}

let scanQueue = [];
function updateScanUI(studentId) {
    const listContainer = document.getElementById('scanList');
    const newItem = document.createElement('div');
    newItem.className = 'scan-item';
    newItem.innerText = studentId;
    listContainer.insertBefore(newItem, listContainer.firstChild);
    scanQueue.unshift(newItem);
    if (scanQueue.length > 5) {
        const oldestItem = scanQueue.pop();
        oldestItem.classList.add('fade-out');
        setTimeout(() => { if(oldestItem.parentNode) oldestItem.parentNode.removeChild(oldestItem); }, 500);
    }
}

// แอดมินกดปุ่มนี้เพื่อดึง JSON ตัวใหม่มาลงเครื่อง
window.manageLogs = function() {
    Swal.fire({ 
        title: 'อัปเดตข้อมูล', 
        text: 'ต้องการดึงข้อมูลล่าสุดจากส่วนกลางมาไว้ในเครื่องนี้หรือไม่?',
        icon: 'question', 
        showCancelButton: true,
        confirmButtonText: 'อัปเดตข้อมูล'
    }).then(async (result) => {
        if(result.isConfirmed) {
            const success = await fetchAndCacheFromStorage();
            if(success) Swal.fire('สำเร็จ', 'อัปเดตข้อมูลในเครื่องสแกนเรียบร้อย', 'success');
        }
    });
};

window.openSettings = function() {
    Swal.fire({ title: 'สถานะปัจจุบัน', html: `นักเรียนรอสแกน: ${activeStudents.length}<br>สแกนแล้ว: ${scannedSet.size}`, icon: 'info' });
};
