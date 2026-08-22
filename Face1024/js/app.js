import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 1. Config ของโปรเจกต์ใหม่ (by-fscan2)
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

// 2. เปิดใช้งาน Offline Mode สำหรับ Firestore (เก็บบันทึก Log ไว้ตอนเน็ตหลุด)
enableIndexedDbPersistence(db).catch(console.warn);

// ==========================================
// ตัวแปรส่วนกลาง (State)
// ==========================================
let allStudents = [];
let activeStudents = [];
const scannedSet = new Set();
const MATCH_THRESHOLD = 0.75; 
let unrecognizedFrames = 0; // ตัวนับเฟรมสำหรับคนที่สแกนไม่ติด

// ==========================================
// ระบบคณิตศาสตร์เปรียบเทียบใบหน้า
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
// ระบบฐานข้อมูลออฟไลน์ (IndexedDB)
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

// โหลดข้อมูลจาก IndexedDB ก่อน ถ้าไม่มีให้ไปโหลดจาก Google Drive
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
                console.log(`(IndexedDB) โหลดข้อมูลจากเครื่องแล้ว ${allStudents.length} คน (ใช้โควตา Firebase Read = 0)`);
                resolve(true);
            } else {
                resolve(await fetchAndCacheFromStorage());
            }
        };
    });
}

// ==========================================
// ดึงข้อมูลผ่าน GAS (Google Drive) แบบประหยัดโควตา 100%
// ==========================================
async function fetchAndCacheFromStorage() {
    Swal.fire({ title: 'กำลังดึงฐานข้อมูลส่วนกลาง...', text: 'ดาวน์โหลดจากเซิร์ฟเวอร์โรงเรียน', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    try {
        // นำ URL ของ Web App และ Token มาใส่ตรงนี้
        const gasUrl = "https://script.google.com/macros/s/AKfycbynOdvM_Q5mqAGiAhaWhyelAQG4lqZmq6m7S4bkkZQTE7T0jfMtVN0ejkv19cnYC0x8/exec";
        const secretToken = "Buayai_Secure_2026"; 
        
        const response = await fetch(`${gasUrl}?token=${secretToken}`);
        const data = await response.json();

        // ตรวจสอบ Error จากฝั่ง GAS
        if (data.error) {
            console.error("API Error: ", data.error);
            Swal.fire('ข้อผิดพลาด', 'ไม่มีสิทธิ์เข้าถึง หรือหาไฟล์ไม่พบ', 'error');
            return false;
        }

        const students = data;

        // บันทึกลง IndexedDB
        const localDB = await openLocalDB();
        const tx = localDB.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        store.clear(); 
        students.forEach(student => store.put(student)); 

        allStudents = students;
        activeStudents = [...allStudents];
        scannedSet.clear(); // ล้างประวัติคนสแกนเพื่อเริ่มรอบใหม่

        console.log(`(Google Drive) ดึงข้อมูลอัปเดตสำเร็จ ${students.length} คน`);
        return true;
    } catch (error) {
        console.error("Fetch Error: ", error);
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
        return false;
    }
}

// ==========================================
// บันทึก Log การสแกนเข้า Firebase
// ==========================================
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
// ระบบ Authentication (เข้าสู่ระบบของ Admin)
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
// AI Configuration (ใช้งาน Vladmandic Human)
// ==========================================
let human;
const videoElement = document.getElementById('video-feed');
const humanConfig = {
    backend: 'wasm', 
    modelBasePath: 'https://vladmandic.github.io/human/models/',
    filter: { equalization: true },
    face: { 
        enabled: true, 
        detector: { rotation: false, return: true }, 
        mesh: { enabled: true }, 
        iris: { enabled: true }, 
        description: { enabled: true } 
    },
    body: { enabled: false }, hand: { enabled: false }, object: { enabled: false }
};

// ==========================================
// เปิดกล้อง และเริ่มกระบวนการสแกนใบหน้า
// ==========================================
async function initAI() {
    try {
        human = new Human.Human(humanConfig);
        await human.load(); 
        
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        videoElement.srcObject = stream;
        videoElement.onloadeddata = () => { 
            videoElement.play(); 
            detectionLoop(); 
            Swal.fire({ icon: 'success', title: 'ระบบพร้อมใช้งาน', text: `รอสแกน ${activeStudents.length} คน`, timer: 2000, showConfirmButton: false });
        };
    } catch (err) {
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเปิดกล้องได้ กรุณาตรวจสอบสิทธิ์ของเบราว์เซอร์', 'error');
    }
}

// ลูปตรวจจับใบหน้า
let lastDetectTime = 0;
async function detectionLoop() {
    if (!videoElement.paused && !videoElement.ended) {
        const now = Date.now();
        // หน่วงเวลาประมวลผล (ลดความร้อนของอุปกรณ์)
        if (now - lastDetectTime >= 300) { 
            lastDetectTime = now;
            const result = await human.detect(videoElement);

            if (result.face && result.face.length > 0 && activeStudents.length > 0) {
                const face = result.face[0]; 
                
                if (face.score > 0.60 && face.embedding) {
                    let bestMatch = null;
                    let highestSimilarity = -1;

                    // วนลูปเทียบเวกเตอร์เฉพาะนักเรียนที่ยังไม่ได้สแกน
                    for (const student of activeStudents) {
                        const similarity = cosineSimilarity(face.embedding, student.faceVector);
                        if (similarity > highestSimilarity) {
                            highestSimilarity = similarity;
                            bestMatch = student;
                        }
                    }

                    if (highestSimilarity >= MATCH_THRESHOLD) {
                        unrecognizedFrames = 0; // สแกนผ่านแล้ว รีเซ็ตตัวนับการไม่รู้จัก
                        const sid = bestMatch.studentId;
                        
                        // กรองซ้ำด้วย Set
                        if (!scannedSet.has(sid)) {
                            scannedSet.add(sid); 
                            activeStudents = allStudents.filter(s => !scannedSet.has(s.studentId));
                            updateScanUI(sid);
                            logScanRecord(sid, highestSimilarity);
                        }
                    } else {
                        // แจ้งเตือนเมื่อยืนหน้ากล้องนาน แต่สแกนไม่ติด
                        unrecognizedFrames++;
                        if (unrecognizedFrames >= 10) { 
                            Swal.fire({
                                toast: true, position: 'top-end', icon: 'warning',
                                title: 'ไม่พบข้อมูล / สแกนไม่ผ่าน',
                                text: 'กรุณาแจ้ง Admin ให้อัปเดตข้อมูลนักเรียนใหม่',
                                showConfirmButton: false, timer: 4000,
                                background: '#fff3cd', color: '#856404'
                            });
                            unrecognizedFrames = 0; 
                        }
                    }
                }
            } else {
                unrecognizedFrames = 0; // หากไม่มีคนหน้ากล้อง รีเซ็ตตัวนับ
            }
        }
    }
    requestAnimationFrame(detectionLoop);
}

// ==========================================
// UI & Button Actions
// ==========================================
let scanQueue = [];
function updateScanUI(studentId) {
    const listContainer = document.getElementById('scanList');
    const newItem = document.createElement('div');
    newItem.className = 'scan-item';
    newItem.innerText = studentId;
    listContainer.insertBefore(newItem, listContainer.firstChild);
    scanQueue.unshift(newItem);
    
    // แสดงเฉพาะ 5 รายการล่าสุด
    if (scanQueue.length > 5) {
        const oldestItem = scanQueue.pop();
        oldestItem.classList.add('fade-out');
        setTimeout(() => { if(oldestItem.parentNode) oldestItem.parentNode.removeChild(oldestItem); }, 500);
    }
}

// ปุ่ม อัปเดตข้อมูลใหม่ สำหรับแอดมิน (เรียกใช้ fetchAndCacheFromStorage)
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

// ปุ่ม ตรวจสอบสถานะการสแกนปัจจุบัน
window.openSettings = function() {
    Swal.fire({ 
        title: 'สถานะระบบสแกน', 
        html: `ระบบกำลังวนลูปหา: <b>${activeStudents.length}</b> คน<br>นักเรียนสแกนผ่านแล้ว: <b style="color:green;">${scannedSet.size}</b> คน`, 
        icon: 'info' 
    });
};
