import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. Firebase Configuration
// ==========================================
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

// เปิดโหมด Offline ให้เก็บ Log ไว้แม้เน็ตหลุด
enableIndexedDbPersistence(db).catch(console.warn);

// ==========================================
// 2. Global State & Config
// ==========================================
let allStudents = [];
const scannedSet = new Set();

// ⚠️ ปรับลดเกณฑ์ลงชั่วคราวให้สแกนติดง่ายขึ้น (จาก 0.75 เป็น 0.60)
const MATCH_THRESHOLD = 0.68; 
let unrecognizedFrames = 0; 

// ฟังก์ชันแปลง Vector ให้ความยาวเป็น 1
function normalizeVector(vec) {
    let norm = 0;
    for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (norm === 0) return Array.from(vec);
    let normalized = new Array(vec.length);
    for (let i = 0; i < vec.length; i++) normalized[i] = vec[i] / norm;
    return normalized;
}

// ฟังก์ชันเสียงแจ้งเตือน (Beep)
function playSuccessSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime); 
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); 
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        setTimeout(() => { oscillator.stop(); audioCtx.close(); }, 150); 
    } catch(e) {
        console.error("Audio not supported", e);
    }
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
// 5. Data Fetching 
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
    Swal.fire({ title: 'กำลังดึงฐานข้อมูล...', text: 'กำลังดาวน์โหลดข้อมูลนักเรียน', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    try {
        // ใช้ URL เดิมของคุณ 
        const gasUrl = "https://script.google.com/macros/s/AKfycbynOdvM_Q5mqAGiAhaWhyelAQG4lqZmq6m7S4bkkZQTE7T0jfMtVN0ejkv19cnYC0x8/exec";
        const secretToken = "Buayai_Secure_2026"; 
        
        const response = await fetch(`${gasUrl}?token=${secretToken}`);
        const data = await response.json();

        if (data.error) {
            Swal.fire('ข้อผิดพลาด', 'ไม่มีสิทธิ์เข้าถึง หรือหาไฟล์ไม่พบ', 'error');
            return false;
        }

        const localDB = await openLocalDB();
        const tx = localDB.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        store.clear(); 
        
        const preparedStudents = data.map(student => {
            if(student.faceVector) {
                student.faceVector = normalizeVector(student.faceVector);
            }
            if(student.faceVectorUp) {
                student.faceVectorUp = normalizeVector(student.faceVectorUp);
            }
            return student;
        });

        preparedStudents.forEach(student => store.put(student)); 

        allStudents = preparedStudents;
        scannedSet.clear(); 

        return true;
    } catch (error) {
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อส่วนกลางได้', 'error');
        return false;
    }
}

// บันทึก Log
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
// 6. Authentication
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
    modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models/', // ใช้ CDN แก้ Error 404
    filter: { equalization: true },
    face: { 
        enabled: true, 
        detector: { rotation: true, return: true, minConfidence: 0.65 }, 
        mesh: { enabled: true },  // ⚠️ เปิดให้ตรงกับข้อมูล 300 คน
        iris: { enabled: true },  // ⚠️ เปิดให้ตรงกับข้อมูล 300 คน
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
                html: `ดึงข้อมูลจากในเครื่องแล้ว จำนวน <b>${allStudents.length}</b> คน`, 
                timer: 4500, 
                showConfirmButton: false 
            });
        };
    } catch (err) {
        console.error("Camera Error:", err);
        let errorMsg = 'ไม่สามารถเปิดกล้องได้';
        if (err.name === 'NotAllowedError') errorMsg = 'คุณยังไม่อนุญาตให้เว็บไซต์ใช้งานกล้อง<br>กรุณากดที่รูปแม่กุญแจบนแถบ URL เพื่ออนุญาต';
        else if (err.name === 'NotFoundError') errorMsg = 'ไม่พบกล้องบนอุปกรณ์นี้';
        else if (err.name === 'NotReadableError') errorMsg = 'กล้องถูกโปรแกรมอื่นใช้อยู่';
        
        Swal.fire({ icon: 'error', title: 'ปัญหาการเข้าถึงกล้อง', html: errorMsg, confirmButtonText: 'รับทราบ' });
    }
}

// ==========================================
// 8. Core Detection Loop
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
            
            for (let f = 0; f < result.face.length; f++) {
                const face = result.face[f]; 
                
                if (face.score > 0.65 && face.embedding) {
                    const normCameraEmbedding = normalizeVector(face.embedding);
                    let bestMatch = null;
                    let highestSimilarity = -1;

                    for (const student of allStudents) {
                        if (student.faceVector) {
                            let dotProduct = 0;
                            for (let i = 0; i < normCameraEmbedding.length; i++) {
                                dotProduct += normCameraEmbedding[i] * student.faceVector[i];
                            }
                            if (dotProduct > highestSimilarity) {
                                highestSimilarity = dotProduct;
                                bestMatch = student;
                            }
                        }
                        if (student.faceVectorUp) {
                            let dotProductUp = 0;
                            for (let i = 0; i < normCameraEmbedding.length; i++) {
                                dotProductUp += normCameraEmbedding[i] * student.faceVectorUp[i];
                            }
                            if (dotProductUp > highestSimilarity) {
                                highestSimilarity = dotProductUp;
                                bestMatch = student;
                            }
                        }
                    }

                    // ⭐ พิมพ์คะแนนความเหมือนออกทาง Console
                    console.log(`[ตรวจสอบ] ความเหมือนสูงสุด: ${highestSimilarity.toFixed(4)} (เกณฑ์ผ่าน: ${MATCH_THRESHOLD})`);

                    let boxColor = '#f39c12'; 
                    let statusText = `กำลังวิเคราะห์`;

                    if (highestSimilarity >= MATCH_THRESHOLD) {
                        const sid = bestMatch.studentId;
                        
                        if (!scannedSet.has(sid)) {
                            scannedSet.add(sid); 
                            updateScanUI(sid);
                            logScanRecord(sid, highestSimilarity);
                            playSuccessSound(); 
                            
                            boxColor = '#27ae60'; 
                            statusText = `✔️ ${sid}`;
                            unrecognizedFrames = 0;
                        } else {
                            boxColor = '#2980b9'; 
                            statusText = `✅ ${sid}`;
                            unrecognizedFrames = 0;
                        }
                    } else {
                        unrecognizedFrames++;
                        if (unrecognizedFrames >= 15) {
                            boxColor = '#c0392b'; 
                            statusText = '❌ ไม่พบข้อมูล';
                            unrecognizedFrames = 0; 
                        }
                    }

                    if (ctx && face.box) {
                        const [x, y, width, height] = face.box;
                        const mirroredX = canvasOverlay.width - x - width;

                        ctx.lineWidth = 4;
                        ctx.strokeStyle = boxColor;
                        ctx.strokeRect(mirroredX, y, width, height);

                        ctx.fillStyle = boxColor;
                        ctx.fillRect(mirroredX, y - 30, width, 30);

                        ctx.fillStyle = '#ffffff';
                        ctx.font = 'bold 20px "Sarabun", sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(statusText, mirroredX + (width / 2), y - 15);
                    }
                }
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
// 9. UI Controls
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
        text: 'ต้องการอัปเดตข้อมูลนักเรียนชุดใหม่หรือไม่?',
        icon: 'question', 
        showCancelButton: true,
        confirmButtonText: 'อัปเดตเดี๋ยวนี้',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if(result.isConfirmed) {
            const success = await fetchAndCacheFromStorage();
            if(success) Swal.fire('สำเร็จ', 'อัปเดตฐานข้อมูลในเครื่องเรียบร้อยแล้ว', 'success');
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
// 10. Real-time Clock
// ==========================================
function updateDateTime() {
    const timeElement = document.getElementById('currentDateTime');
    if (timeElement) {
        const now = new Date();
        const options = { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        };
        timeElement.innerText = now.toLocaleDateString('th-TH', options);
    }
}
updateDateTime();
setInterval(updateDateTime, 1000);
