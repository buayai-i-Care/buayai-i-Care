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

enableIndexedDbPersistence(db).catch(console.warn);

// ==========================================
// 2. Global State & System Reset Logic
// ==========================================
let allStudents = [];
const scannedSet = new Set();
const MATCH_THRESHOLD = 0.82; 
const REQUIRED_MATCHES = 3;   
const faceMatchCounts = new Map(); 
let unrecognizedFrames = 0; 
let studentNamesMap = new Map(); // เก็บชื่อนักเรียนไว้ในความจำ

// ล้างหน่วยความจำ (Garbage Collection) เมื่อเปลี่ยนวัน
const startupDay = new Date().getDate();
setInterval(() => {
    const currentDay = new Date().getDate();
    if (currentDay !== startupDay) {
        window.location.reload();
    }
}, 60000); 

// ==========================================
// 3. Helper Functions
// ==========================================
function normalizeVectorToFloat32(vec) {
    let norm = 0;
    for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    
    let normalized = new Float32Array(vec.length);
    if (norm === 0) {
        for (let i = 0; i < vec.length; i++) normalized[i] = vec[i];
    } else {
        for (let i = 0; i < vec.length; i++) normalized[i] = vec[i] / norm;
    }
    return normalized;
}

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
        console.error("Audio blocked by browser", e);
    }
}

// ฟังก์ชันแปลงชื่อเพื่อปกปิดข้อมูล (เช่น นางสาวสุภัทรวดี ศรีนามบุรี -> สุภัทร** ศรีนา**)
function maskThaiName(fullName) {
    if (!fullName || fullName === 'ไม่ระบุ') return "";
    
    let cleanName = fullName.replace(/^(เด็กชาย|เด็กหญิง|นาย|นางสาว|ด\.ช\.|ด\.ญ\.)\s*/, '').trim();
    let parts = cleanName.split(/\s+/); 
    
    if (parts.length >= 2) {
        let fname = parts[0];
        let lname = parts[1];
        
        let mFirst = fname.length > 6 ? fname.substring(0, 6) + "**" : fname + "**";
        let mLast = lname.length > 5 ? lname.substring(0, 5) + "**" : lname + "**";
        return `${mFirst} ${mLast}`;
    }
    return cleanName.length > 6 ? cleanName.substring(0, 6) + "**" : cleanName + "**";
}

// โหลดชื่อมาเก็บไว้ในเครื่อง (ออฟไลน์)
function initStudentNamesCache() {
    const cached = localStorage.getItem('localStudentNames');
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            for (let id in parsed) studentNamesMap.set(id, parsed[id]);
        } catch(e) { console.error("Cache parsing error", e); }
    }

    const masterListUrl = "https://script.google.com/macros/s/AKfycbyvdgOnCm26KEHUeuUg7MRyGFZ-t4p6XZVObygxGXlr0uMbHrkxoKRcBKngMmwWTSB2aw/exec";
    fetch(masterListUrl).then(res => res.json()).then(data => {
        const tempObj = {};
        data.forEach(s => {
            const id = String(s['ID']).trim();
            tempObj[id] = s['ชื่อ-สกุล'];
            studentNamesMap.set(id, s['ชื่อ-สกุล']);
        });
        localStorage.setItem('localStudentNames', JSON.stringify(tempObj)); 
    }).catch(() => console.log('สถานะออฟไลน์: ใช้ข้อมูลชื่อจากหน่วยความจำเดิม'));
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
            let localData = request.result;
            if (localData && localData.length > 0) {
                allStudents = localData.map(student => {
                    if(student.faceVector) student.faceVector = new Float32Array(student.faceVector);
                    if(student.faceVectorUp) student.faceVectorUp = new Float32Array(student.faceVectorUp);
                    return student;
                });
                resolve(true);
            } else {
                resolve(await fetchAndCacheFromStorage());
            }
        };
    });
}

async function fetchAndCacheFromStorage() {
    Swal.fire({ title: 'กำลังดึงฐานข้อมูลส่วนกลาง...', text: 'ประมวลผลข้อมูล 2,300 รายการ', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    try {
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
                const f32 = normalizeVectorToFloat32(student.faceVector);
                student.faceVector = Array.from(f32); 
            }
            if(student.faceVectorUp) {
                const f32up = normalizeVectorToFloat32(student.faceVectorUp);
                student.faceVectorUp = Array.from(f32up);
            }
            return student;
        });

        preparedStudents.forEach(student => store.put(student)); 

        allStudents = preparedStudents.map(student => {
            if(student.faceVector) student.faceVector = new Float32Array(student.faceVector);
            if(student.faceVectorUp) student.faceVectorUp = new Float32Array(student.faceVectorUp);
            return student;
        });
        
        scannedSet.clear(); 
        faceMatchCounts.clear(); 

        return true;
    } catch (error) {
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
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

// ==========================================
// 6. Authentication
// ==========================================
window.checkAuth = async function() {
    const email = document.getElementById('adminEmail').value.trim();
    const pass = document.getElementById('adminPassword').value;

    if(email === '' || pass === '') return Swal.fire('แจ้งเตือน', 'กรุณากรอกข้อมูลให้ครบถ้วน', 'warning');

    Swal.fire({ title: 'กำลังเตรียมกล้องและตรวจสอบสิทธิ์...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    let preLoadedStream;
    try {
        preLoadedStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'user', 
                width: { ideal: 1280 }, 
                height: { ideal: 720 } 
            },
            audio: false 
        });
    } catch (err) {
        console.error("Camera Error:", err);
        return Swal.fire('ไม่สามารถเปิดกล้องได้', 'กรุณากด "อนุญาต" (Allow) กล้อง', 'error');
    }

    signInWithEmailAndPassword(auth, email, pass)
        .then(async () => {
            const isLoaded = await loadStudentData();
            if (isLoaded) {
                document.getElementById('auth-overlay').style.display = 'none';
                document.getElementById('mainApp').style.display = 'flex';
                initAI(preLoadedStream); 
                initStudentNamesCache(); // แอบดึงชื่อเก็บไว้เพื่อโชว์ตอนสแกนผ่าน
            }
        })
        .catch(() => {
            preLoadedStream.getTracks().forEach(track => track.stop());
            Swal.fire('ล้มเหลว', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'error');
        });
};

// ==========================================
// 7. AI Module Configuration
// ==========================================
let human;
const videoElement = document.getElementById('video-feed');
const canvasOverlay = document.getElementById('canvas-overlay'); 
let ctx; 

const humanConfig = {
    backend: 'wasm', 
    modelBasePath: './models/', 
    filter: { equalization: true },
    face: { 
        enabled: true, 
        detector: { rotation: true, return: true, minConfidence: 0.65 }, 
        mesh: { enabled: false }, 
        iris: { enabled: false }, 
        description: { enabled: true } 
    },
    body: { enabled: false }, hand: { enabled: false }, object: { enabled: false }
};

async function initAI(stream) {
    try {
        videoElement.srcObject = stream;
        
        videoElement.onloadeddata = async () => { 
            videoElement.play(); 
            
            if (canvasOverlay) {
                canvasOverlay.width = videoElement.videoWidth;
                canvasOverlay.height = videoElement.videoHeight;
                ctx = canvasOverlay.getContext('2d');
            }
            
            Swal.fire({ 
                title: 'กำลังเริ่มต้นระบบ AI...', 
                allowOutsideClick: false, 
                didOpen: () => Swal.showLoading() 
            });

            human = new Human.Human(humanConfig);
            await human.load(); 
            
            detectionLoop(); 
            
            Swal.fire({ 
                icon: 'success', 
                title: 'ระบบพร้อมใช้งาน', 
                html: `ข้อมูลนักเรียนพร้อมทำงาน: <b>${allStudents.length}</b> คน`, 
                timer: 3000, 
                showConfirmButton: false 
            });
        };
    } catch (err) {
        console.error("AI Init Error:", err);
        Swal.fire('ข้อผิดพลาด', 'ปัญหาการตั้งค่า AI: ' + err.message, 'error');
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
    if (now - lastDetectTime < 250) return; 

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
            let matchedInThisFrame = false;

            for (let f = 0; f < result.face.length; f++) {
                const face = result.face[f]; 
                
                if (face.score > 0.65 && face.embedding) {
                    const normCameraEmbedding = normalizeVectorToFloat32(face.embedding);
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

                    let boxColor = '#f39c12'; 
                    let statusText = `กำลังวิเคราะห์`;

                    if (highestSimilarity >= MATCH_THRESHOLD) {
                        matchedInThisFrame = true;
                        const sid = bestMatch.studentId;
                        
                        if (!scannedSet.has(sid)) {
                            let currentCount = (faceMatchCounts.get(sid) || 0) + 1;
                            faceMatchCounts.set(sid, currentCount);

                            if (currentCount >= REQUIRED_MATCHES) {
                                scannedSet.add(sid); 
                                updateScanUI(sid);
                                logScanRecord(sid, highestSimilarity);
                                playSuccessSound(); 
                                
                                boxColor = '#27ae60'; 
                                statusText = `✔️ ${sid}`;
                                unrecognizedFrames = 0;
                                faceMatchCounts.delete(sid); 
                            } else {
                                boxColor = '#f39c12';
                                statusText = `ยืนยันตัวตน... (${currentCount}/${REQUIRED_MATCHES})`;
                            }
                        } else {
                            boxColor = '#2980b9'; 
                            statusText = `✅ ${sid}`;
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

            if (!matchedInThisFrame) {
                unrecognizedFrames++;
                if (unrecognizedFrames >= 15) {
                    faceMatchCounts.clear(); 
                    unrecognizedFrames = 0; 
                }
            }

        } else {
            unrecognizedFrames++;
            if (unrecognizedFrames >= 15) {
                faceMatchCounts.clear(); 
                unrecognizedFrames = 0; 
            }
        }
    } catch (err) {
        console.error("AI Detection Error:", err);
    } finally {
        isDetecting = false; 
    }
}

// ==========================================
// 9. UI Controls & Reports
// ==========================================
let scanQueue = [];
function updateScanUI(studentId) {
    const listContainer = document.getElementById('scanList');
    const newItem = document.createElement('div');
    newItem.className = 'scan-item';
    
    // แสดงผล UI 2 บรรทัด (รหัส และ ชื่อที่ถูกเซ็นเซอร์)
    const fullName = studentNamesMap.get(studentId) || "";
    const maskedName = maskThaiName(fullName);
    
    newItem.innerHTML = `
        <div style="font-size: 42px; font-weight: bold; line-height: 1;">${studentId}</div>
        <div style="font-size: 24px; font-weight: 500; margin-top: 8px; color: #e8f8f5;">
            ${maskedName}
        </div>
    `;
    
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
        text: 'ต้องการดึงข้อมูลชุดใหม่จาก Google Drive หรือไม่?',
        icon: 'question', 
        showCancelButton: true,
        confirmButtonText: 'อัปเดต',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if(result.isConfirmed) {
            const success = await fetchAndCacheFromStorage();
            if(success) {
                initStudentNamesCache(); // อัปเดตรายชื่อใหม่ด้วย
                Swal.fire('สำเร็จ', 'อัปเดตฐานข้อมูลสำเร็จ', 'success');
            }
        }
    });
};

window.openSettings = function() {
    Swal.fire({ 
        title: 'สถานะระบบ', 
        html: `นักเรียนในระบบ: <b>${allStudents.length}</b> คน<br>สแกนผ่านแล้ว: <b style="color:green;">${scannedSet.size}</b> คน`, 
        icon: 'info' 
    });
};

// ==========================================
// รายงานเปรียบเทียบนักเรียนที่ยังไม่ลงทะเบียน (ดึงจาก API เดิม)
// ==========================================
// ==========================================
// รายงานเปรียบเทียบนักเรียน (แสดงทั้งคนที่มีข้อมูลแล้ว และยังไม่มีข้อมูล)
// ==========================================
window.showRegistrationReport = async function() {
    Swal.fire({
        title: 'กำลังตรวจสอบข้อมูล...',
        text: 'ดึงข้อมูลสดจากระบบ กรุณารอสักครู่',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const masterListUrl = "https://script.google.com/macros/s/AKfycbyvdgOnCm26KEHUeuUg7MRyGFZ-t4p6XZVObygxGXlr0uMbHrkxoKRcBKngMmwWTSB2aw/exec"; 
        
        const response = await fetch(masterListUrl);
        const masterStudents = await response.json();

        const registeredIds = new Set(allStudents.map(s => String(s.studentId).trim()));

        const reportData = {};
        masterStudents.forEach(s => {
            const room = s['ชั้น'] || 'ไม่ระบุ';
            const id = String(s['ID']).trim();
            const studentInfo = {
                id: id,
                name: s['ชื่อ-สกุล'] || 'ไม่ระบุชื่อ',
                no: s['เลขที่'] || '-'
            };
            
            // เตรียม Array เก็บรายชื่อทั้ง 2 กลุ่ม
            if(!reportData[room]) reportData[room] = { total: 0, registeredList: [], missingList: [] };
            
            reportData[room].total++;
            if(registeredIds.has(id)) {
                reportData[room].registeredList.push(studentInfo);
            } else {
                reportData[room].missingList.push(studentInfo);
            }
        });

        const sortedRooms = Object.keys(reportData).sort();
        let htmlContent = `<div style="text-align: left; max-height: 65vh; overflow-y: auto; font-family: 'Sarabun', sans-serif;">`;

        sortedRooms.forEach(room => {
            const data = reportData[room];
            // จัดเรียงตามเลขที่ทั้ง 2 กลุ่ม
            data.registeredList.sort((a, b) => parseInt(a.no) - parseInt(b.no));
            data.missingList.sort((a, b) => parseInt(a.no) - parseInt(b.no));

            htmlContent += `<div style="margin-bottom: 20px; padding: 15px; background: #ffffff; border-radius: 8px; border: 1px solid #ddd; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">`;
            htmlContent += `<strong style="font-size: 26px; color: #2c3e50;">ชั้น ${room} (รวม ${data.total} คน)</strong><hr style="margin: 10px 0; border: 0; border-top: 1px solid #eee;">`;

            // 1. ส่วนรายชื่อคนที่มีข้อมูลแล้ว (สีเขียว)
            htmlContent += `<div style="margin-bottom: 15px;">`;
            htmlContent += `<strong style="font-size: 22px; color: #27ae60;">✅ มีข้อมูลแล้ว (${data.registeredList.length} คน)</strong>`;
            if (data.registeredList.length > 0) {
                htmlContent += `<div style="max-height: 150px; overflow-y: auto; background: #e8f8f5; padding: 10px; border-radius: 6px; margin-top: 5px; border: 1px solid #d1f2eb;">`;
                htmlContent += `<ul style="margin: 0; padding-left: 20px; color: #1e8449; font-size: 20px;">`;
                data.registeredList.forEach(m => {
                    htmlContent += `<li>เลขที่ ${m.no} ${m.name} (รหัส: ${m.id})</li>`;
                });
                htmlContent += `</ul></div>`;
            } else {
                htmlContent += `<div style="color: #7f8c8d; font-size: 20px; margin-top: 5px;">ยังไม่มีผู้ลงทะเบียนในห้องนี้</div>`;
            }
            htmlContent += `</div>`;

            // 2. ส่วนรายชื่อคนที่ยังไม่มีข้อมูล (สีแดง)
            htmlContent += `<div>`;
            htmlContent += `<strong style="font-size: 22px; color: #e74c3c;">❌ ยังไม่มีข้อมูล (${data.missingList.length} คน)</strong>`;
            if (data.missingList.length > 0) {
                htmlContent += `<div style="max-height: 150px; overflow-y: auto; background: #fadbd8; padding: 10px; border-radius: 6px; margin-top: 5px; border: 1px solid #f5b7b1;">`;
                htmlContent += `<ul style="margin: 0; padding-left: 20px; color: #c0392b; font-size: 20px;">`;
                data.missingList.forEach(m => {
                    htmlContent += `<li>เลขที่ ${m.no} ${m.name} (รหัส: ${m.id})</li>`;
                });
                htmlContent += `</ul></div>`;
            } else {
                htmlContent += `<div style="color: #27ae60; font-size: 20px; margin-top: 5px;">ลงทะเบียนครบทุกคนแล้ว! 🎉</div>`;
            }
            htmlContent += `</div>`;

            htmlContent += `</div>`; // ปิดกรอบของแต่ละห้อง
        });
        htmlContent += `</div>`;

        Swal.fire({
            title: '📊 รายงานสถานะการลงทะเบียน',
            html: htmlContent,
            width: '850px',
            confirmButtonText: 'ปิดหน้าต่าง',
            confirmButtonColor: '#2980b9'
        });

    } catch (err) {
        console.error(err);
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อฐานข้อมูลรายชื่อได้', 'error');
    }
};



// ==========================================
// 10. Real-time Clock
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
