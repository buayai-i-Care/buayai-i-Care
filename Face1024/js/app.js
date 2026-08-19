// นำเข้าโมดูลของ Firebase อย่างครบถ้วน
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 1. ตั้งค่า Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDKUdsm370QMPICz-ap4RLip3eqM5rkFY8",
    authDomain: "by-fscan.firebaseapp.com",
    projectId: "by-fscan",
    storageBucket: "by-fscan.firebasestorage.app",
    messagingSenderId: "557564109653",
    appId: "1:557564109653:web:3459229f1b539cf25285dc"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ตัวแปรเก็บฐานข้อมูลเวกเตอร์ใน RAM และระบบ Cooldown
let studentDatabase = [];
const scanCooldowns = {}; 
const COOLDOWN_TIME = 5000; // หน่วงเวลา 5 วินาทีต่อคน เพื่อไม่ให้แสกนซ้ำรัวๆ
const MATCH_THRESHOLD = 0.65; // เกณฑ์การยอมรับ (Threshold) ปรับจูนได้

// ==========================================
// ระบบคณิตศาสตร์เปรียบเทียบอัตลักษณ์ (Cosine Similarity)
// ==========================================
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

// ==========================================
// ระบบ IndexedDB (Offline Database)
// ==========================================
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

async function syncDatabase() {
    Swal.fire({
        title: 'กำลังซิงค์ฐานข้อมูล...',
        text: 'กำลังดาวน์โหลดข้อมูลอัตลักษณ์นักเรียน กรุณารอสักครู่',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const querySnapshot = await getDocs(collection(db, "students"));
        const students = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.faceVector && data.studentId) {
                students.push(data);
            }
        });

        const localDB = await openLocalDB();
        const tx = localDB.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        
        store.clear(); 
        students.forEach(student => store.put(student)); 

        return new Promise((resolve) => {
            tx.oncomplete = () => {
                studentDatabase = students;
                console.log(`โหลดข้อมูลสำเร็จจำนวน ${studentDatabase.length} คน`);
                resolve(true);
            };
        });
    } catch (error) {
        console.error("Error syncing data: ", error);
        Swal.fire({ icon: 'error', title: 'ซิงค์ข้อมูลล้มเหลว', text: 'ไม่สามารถดึงข้อมูลจากเซิร์ฟเวอร์ได้' });
        return false;
    }
}

// ==========================================
// การบันทึกประวัติ (Log) ลง Firebase
// ==========================================
async function logScanRecord(studentId, similarityScore) {
    try {
        await addDoc(collection(db, "scan_logs"), {
            studentId: studentId,
            similarity: similarityScore,
            timestamp: serverTimestamp(),
            status: "success"
        });
        console.log(`บันทึก Log ของ ${studentId} เรียบร้อยแล้ว`);
    } catch (error) {
        console.error("Error saving log: ", error);
    }
}

// ==========================================
// ระบบแสดงผล (UI) และการทำงานหลัก
// ==========================================
function updateClock() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    const clockElement = document.getElementById('currentDateTime');
    if (clockElement) clockElement.innerText = now.toLocaleDateString('th-TH', options);
}
setInterval(updateClock, 1000);
updateClock();

window.checkAuth = function() {
    const email = document.getElementById('adminEmail').value.trim();
    const pass = document.getElementById('adminPassword').value;

    if(email === '' || pass === '') {
        Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบ', text: 'กรุณากรอกอีเมลและรหัสผ่าน' });
        return;
    }

    Swal.fire({ title: 'กำลังตรวจสอบสิทธิ์...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    signInWithEmailAndPassword(auth, email, pass)
        .then(async (userCredential) => {
            const isSynced = await syncDatabase();
            if (isSynced) {
                document.getElementById('auth-overlay').style.display = 'none';
                document.getElementById('mainApp').style.display = 'flex';
                initAI(); 
            }
        })
        .catch((error) => {
            console.error("Auth Error:", error.code, error.message);
            Swal.fire({ icon: 'error', title: 'เข้าสู่ระบบล้มเหลว', text: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        });
};

// ==========================================
// ระบบ Computer Vision & AI 
// ==========================================
let human;
const videoElement = document.getElementById('video-feed');
const humanConfig = {
    backend: 'wasm', 
    modelBasePath: 'https://vladmandic.github.io/human/models/', // ดึงผ่าน CDN
    filter: { equalization: true },
    face: {
        enabled: true,
        detector: { rotation: false, return: true },
        mesh: { enabled: true },
        iris: { enabled: true },
        description: { enabled: true }, 
        emotion: { enabled: false }
    },
    body: { enabled: false }, hand: { enabled: false }, object: { enabled: false }
};

async function initAI() {
    Swal.fire({
        title: 'กำลังโหลดโมเดล AI...',
        text: 'อาจใช้เวลาสักครู่ในครั้งแรก',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        human = new Human.Human(humanConfig);
        await human.load(); 

        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        videoElement.srcObject = stream;
        
        videoElement.onloadeddata = () => {
            videoElement.play();
            detectionLoop(); 
            
            // แจ้งเตือนเมื่อระบบพร้อมสมบูรณ์และแสดงจำนวนคนที่โหลดได้
            Swal.fire({
                icon: 'success',
                title: 'ระบบพร้อมใช้งาน',
                text: `โหลดข้อมูลอัตลักษณ์นักเรียนสำเร็จ จำนวน ${studentDatabase.length} คน`,
                timer: 3000, // แสดง 3 วินาทีแล้วปิดเอง
                showConfirmButton: false
            });
        };
    } catch (err) {
        console.error("AI Init Error: ", err);
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถโหลด AI หรือเปิดกล้องได้' });
    }
}

// ลูปประมวลผลเฟรมต่อเฟรม
async function detectionLoop() {
    if (!videoElement.paused && !videoElement.ended) {
        const result = await human.detect(videoElement);

        if (result.face && result.face.length > 0 && studentDatabase.length > 0) {
            const face = result.face[0]; 
            
            if (face.embedding) {
                let bestMatch = null;
                let highestSimilarity = -1;

                // วนลูปเทียบเวกเตอร์กับฐานข้อมูลทั้งหมด (O(N) Complexity)
                for (const student of studentDatabase) {
                    const similarity = cosineSimilarity(face.embedding, student.faceVector);
                    if (similarity > highestSimilarity) {
                        highestSimilarity = similarity;
                        bestMatch = student;
                    }
                }

                // หากค่าความเหมือนผ่านเกณฑ์ที่ตั้งไว้
                if (highestSimilarity >= MATCH_THRESHOLD) {
                    const now = Date.now();
                    const sid = bestMatch.studentId;
                    
                    // ตรวจสอบ Cooldown ป้องกันการแสกนซ้ำรัวๆ
                    if (!scanCooldowns[sid] || now - scanCooldowns[sid] > COOLDOWN_TIME) {
                        scanCooldowns[sid] = now;
                        
                        // 1. นำรายชื่อขึ้น UI ทางขวา
                        updateScanUI(sid);
                        
                        // 2. บันทึก Log ลง Firebase
                        logScanRecord(sid, highestSimilarity);
                    }
                }
            }
        }
    }
    requestAnimationFrame(detectionLoop); // เรียกใช้ซ้ำอย่างต่อเนื่อง
}

// ==========================================
// ระบบ UI Interaction 
// ==========================================
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

// ปุ่มควบคุม
window.manageLogs = function() {
    Swal.fire({ 
        title: 'จัดการข้อมูล / Log', 
        text: 'คุณต้องการยกเลิกการสแกนล่าสุดที่ผิดพลาดหรือไม่?', 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#d33',
        confirmButtonText: 'ลบข้อมูลสแกนล่าสุด' 
    }).then((result) => {
        if(result.isConfirmed) {
            Swal.fire('ลบสำเร็จ', 'ข้อมูลถูกจัดการแล้ว', 'success');
        }
    });
};

window.openSettings = function() {
    Swal.fire({ 
        title: 'ตั้งค่าระบบ', 
        html: `ปรับจูนค่า <b>MATCH_THRESHOLD</b><br>ค่าปัจจุบัน: ${MATCH_THRESHOLD}`, 
        icon: 'info' 
    });
};
