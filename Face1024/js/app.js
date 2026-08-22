import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. Firebase Configuration (by-fscan2)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBFITWlnJnXLPNIgJiSa_bMy4H-k-vck_U",
    authDomain: "by-fscan2.firebaseapp.com",
    projectId: "by-fscan2",
    storageBucket: "by-fscan2.firebasestorage.app",
    messagingSenderId: "882321659182",
    appId: "1:882321659182:web:e07eafc8301b28a9a696bf"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// เปิดโหมด Offline ให้เก็บ Log ไว้แม้เน็ตหลุด
enableIndexedDbPersistence(db).catch(console.warn);

// ==========================================
// 2. Global State (ตัวแปรสถานะระบบ)
// ==========================================
let allStudents = [];
// activeStudents ถูกตัดออกไปตามตรรกะใหม่ เพื่อให้ค้นหาจากฐานข้อมูลหลักเสมอ
const scannedSet = new Set();
const MATCH_THRESHOLD = 0.75; 
let unrecognizedFrames = 0; 

// ==========================================
// 3. Mathematical Operations (เปรียบเทียบใบหน้า)
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
// 4. Local Database (IndexedDB)
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

// ==========================================
// 5. Data Fetching (Google Drive via GAS)
// ==========================================
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
                resolve(true);
            } else {
                resolve(await fetchAndCacheFromStorage());
            }
        };
    });
}

async function fetchAndCacheFromStorage() {
    Swal.fire({ title: 'กำลังดึงฐานข้อมูลส่วนกลาง...', text: 'ดาวน์โหลดจากเซิร์ฟเวอร์โรงเรียน', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    try {
        const gasUrl = "https://script.google.com/macros/s/AKfycbynOdvM_Q5mqAGiAhaWhyelAQG4lqZmq6m7S4bkkZQTE7T0jfMtVN0ejkv19cnYC0x8/exec";
        const secretToken = "Buayai_Secure_2026"; 
        
        const response = await fetch(`${gasUrl}?token=${secretToken}`);
        const data = await response.json();

        if (data.error) {
            Swal.fire('ข้อผิดพลาด', 'ไม่มีสิทธิ์เข้าถึง หรือหาไฟล์ไม่พบ', 'error');
            return false;
        }

        const students = data;
        const localDB = await openLocalDB();
        const tx = localDB.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        store.clear(); 
        students.forEach(student => store.put(student)); 

        allStudents = students;
        scannedSet.clear(); 

        return true;
    } catch (error) {
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
        return false;
    }
}

// บันทึก Log การสแกนเข้า Firebase
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

// ==========================================
// 6. Authentication (เข้าสู่ระบบ)
// ==========================================
window.checkAuth = function() {
    const email = document.getElementById('adminEmail').value.trim();
    const pass = document.getElementById('adminPassword').value;

    if(email === '' || pass === '') return Swal.fire('แจ้งเตือน', 'กรุณากรอกข้อมูลให้ครบถ้วน', 'warning');

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
        .catch(() => Swal.fire('ล้มเหลว', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'error'));
};

// ==========================================
// 7. AI Module (Vladmandic Human)
// ==========================================
let human;
const videoElement = document.getElementById('video-feed');
const canvasOverlay = document.getElementById('canvas-overlay'); 
let ctx; 

const humanConfig = {
    backend: 'wasm', 
    modelBasePath: 'https://vladmandic.github.io/human/models/',
    filter: { equalization: true },
    face: { 
        enabled: true, 
        detector: { rotation: false, return: true, minConfidence: 0.70 }, 
        mesh: { enabled: false }, 
        iris: { enabled: false }, 
        description: { enabled: true } 
    },
    body: { enabled: false }, hand: { enabled: false }, object: { enabled: false }
};

async function initAI() {
    try {
        human = new Human.Human(humanConfig);
        await human.load(); 
        
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        videoElement.srcObject = stream;
        videoElement.onloadeddata = () => { 
            videoElement.play(); 
            
            if (canvasOverlay) {
                canvasOverlay.width = videoElement.videoWidth;
                canvasOverlay.height = videoElement.videoHeight;
                ctx = canvasOverlay.getContext('2d');
            }
            
            detectionLoop(); 
            
            Swal.fire({ 
                icon: 'success', 
                title: 'ระบบพร้อมใช้งาน', 
                html: `ดึงข้อมูลจากในเครื่องแล้ว จำนวน <b>${allStudents.length}</b> คน<br><br><span style="color: #27ae60; font-weight: bold; font-size: 0.9em;">✔️ ท่านสามารถใช้งานได้แม้ไม่มีอินเทอร์เน็ต</span>`, 
                timer: 4500, 
                showConfirmButton: false 
            });
        };
    } catch (err) {
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเปิดกล้องได้ กรุณาตรวจสอบสิทธิ์', 'error');
    }
}

// ==========================================
// 8. Core Detection Loop (ลูปประมวลผลกล้องแบบกันค้าง 100%)
// ==========================================
let isDetecting = false;
let lastDetectTime = 0;

async function detectionLoop() {
    requestAnimationFrame(detectionLoop);

    if (videoElement.paused || videoElement.ended || isDetecting) return;

    const now = Date.now();
    if (now - lastDetectTime < 300) return; 

    isDetecting = true;
    lastDetectTime = now;

    try {
        // อัปเดตขนาด Canvas เพื่อแก้บั๊ก iPad
        if (canvasOverlay && videoElement.videoWidth > 0) {
            if (canvasOverlay.width !== videoElement.videoWidth) {
                canvasOverlay.width = videoElement.videoWidth;
                canvasOverlay.height = videoElement.videoHeight;
            }
        }

        const result = await human.detect(videoElement);

        if (ctx && canvasOverlay.width > 0) {
            ctx.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);
        }

        if (result.face && result.face.length > 0 && allStudents.length > 0) {
            const face = result.face[0]; 
            
            if (face.score > 0.70 && face.embedding) {
                let bestMatch = null;
                let highestSimilarity = -1;

                // ค้นหาจากนักเรียนทั้งหมดเสมอ
                for (const student of allStudents) {
                    const similarity = cosineSimilarity(face.embedding, student.faceVector);
                    if (similarity > highestSimilarity) {
                        highestSimilarity = similarity;
                        bestMatch = student;
                    }
                }

                let boxColor = '#f39c12'; 
                let statusText = `กำลังวิเคราะห์ (${Math.round(face.score * 100)}%)`;

                if (highestSimilarity >= MATCH_THRESHOLD) {
                    const sid = bestMatch.studentId;
                    
                    if (!scannedSet.has(sid)) {
                        // สแกนครั้งแรก
                        scannedSet.add(sid); 
                        updateScanUI(sid);
                        logScanRecord(sid, highestSimilarity);
                        
                        boxColor = '#27ae60'; 
                        statusText = `✔️ บันทึกสำเร็จ: ${sid}`;
                        unrecognizedFrames = 0;
                    } else {
                        // สแกนซ้ำ
                        boxColor = '#2980b9'; 
                        statusText = `✅ เช็คชื่อไปแล้ว: ${sid}`;
                        unrecognizedFrames = 0;
                    }
                } else {
                    // ไม่พบใบหน้านี้ในฐานข้อมูล
                    unrecognizedFrames++;
                    if (unrecognizedFrames >= 15) {
                        boxColor = '#c0392b'; 
                        statusText = '❌ ไม่พบข้อมูลนักเรียน';
                        
                        Swal.fire({
                            toast: true, position: 'top-end', icon: 'warning',
                            title: 'ไม่พบข้อมูล / สแกนไม่ผ่าน',
                            text: 'กรุณาแจ้ง Admin ให้อัปเดตข้อมูลนักเรียนใหม่',
                            showConfirmButton: false, timer: 3000,
                            background: '#fff3cd', color: '#856404'
                        });
                        unrecognizedFrames = 0; 
                    }
                }

                // วาดกรอบสี่เหลี่ยมพร้อมตัวอักษร 
                if (ctx && face.box) {
                    const [x, y, width, height] = face.box;
                    const mirroredX = canvasOverlay.width - x - width;

                    ctx.lineWidth = 4;
                    ctx.strokeStyle = boxColor;
                    ctx.strokeRect(mirroredX, y, width, height);

                    ctx.fillStyle = boxColor;
                    ctx.fillRect(mirroredX, y - 40, width, 40);

                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 24px "Sarabun", sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(statusText, mirroredX + (width / 2), y - 20);
                }
                
            } else {
                unrecognizedFrames = 0; 
            }
        } else {
            unrecognizedFrames = 0; 
        }
    } catch (err) {
        console.error("AI Detection Error:", err);
    } finally {
        isDetecting = false; 
    }
}

// ==========================================
// 9. UI Controls (จัดการหน้าจอ)
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

window.manageLogs = function() {
    Swal.fire({ 
        title: 'อัปเดตข้อมูลนักเรียน', 
        text: 'ต้องการดึงข้อมูลนักเรียนชุดใหม่จากส่วนกลาง (Google Drive) หรือไม่?',
        icon: 'question', 
        showCancelButton: true,
        confirmButtonText: 'อัปเดตเดี๋ยวนี้',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if(result.isConfirmed) {
            const success = await fetchAndCacheFromStorage();
            if(success) Swal.fire('สำเร็จ', 'อัปเดตฐานข้อมูลในเครื่องสแกนเรียบร้อยแล้ว', 'success');
        }
    });
};

window.openSettings = function() {
    Swal.fire({ 
        title: 'สถานะระบบสแกน', 
        html: `จำนวนนักเรียนในระบบ: <b>${allStudents.length}</b> คน<br>นักเรียนสแกนผ่านแล้ว: <b style="color:green;">${scannedSet.size}</b> คน`, 
        icon: 'info' 
    });
};

// ==========================================
// 10. Real-time Clock (นาฬิกา)
// ==========================================
function updateDateTime() {
    const timeElement = document.getElementById('currentDateTime');
    if (timeElement) {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: false
        };
        timeElement.innerText = now.toLocaleDateString('th-TH', options);
    }
}

updateDateTime();
setInterval(updateDateTime, 1000);
