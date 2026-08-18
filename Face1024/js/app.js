// นำเข้าโมดูลของ Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 1. ตั้งค่า Firebase (ของโปรเจกต์ by-fscan)
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

// 2. ระบบนาฬิกา
function updateClock() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    const clockElement = document.getElementById('currentDateTime');
    if (clockElement) clockElement.innerText = now.toLocaleDateString('th-TH', options);
}
setInterval(updateClock, 1000);
updateClock();

// 3. ฟังก์ชันตรวจสอบสิทธิ์ (Authentication)
window.checkAuth = function() {
    const email = document.getElementById('adminEmail').value.trim();
    const pass = document.getElementById('adminPassword').value;

    if(email === '' || pass === '') {
        Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบ', text: 'กรุณากรอกอีเมลและรหัสผ่าน' });
        return;
    }

    Swal.fire({
        title: 'กำลังตรวจสอบสิทธิ์...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    signInWithEmailAndPassword(auth, email, pass)
        .then((userCredential) => {
            Swal.close();
            document.getElementById('auth-overlay').style.display = 'none';
            document.getElementById('mainApp').style.display = 'flex';
            startCamera(); 
        })
        .catch((error) => {
            console.error("Auth Error:", error.code, error.message);
            Swal.fire({ icon: 'error', title: 'เข้าสู่ระบบล้มเหลว', text: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        });
};

// 4. ฟังก์ชันเปิดกล้องเว็บแคม
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        document.getElementById('video-feed').srcObject = stream;
        
        // หมายเหตุ: ตรงนี้คือจุดที่เราจะแทรกไลบรารี Human ในอนาคต
        // startHumanFaceDetection(document.getElementById('video-feed'));

    } catch (err) {
        console.error("Error accessing webcam: ", err);
        Swal.fire({ icon: 'error', title: 'ไม่พบกล้อง', text: 'กรุณาตรวจสอบการเชื่อมต่อกล้องเว็บแคม' });
    }
}

// 5. ระบบคิวแสดงผลการสแกน (UI)
let scanQueue = [];
window.simulateScan = function(studentId) {
    const listContainer = document.getElementById('scanList');
    const newItem = document.createElement('div');
    newItem.className = 'scan-item';
    newItem.innerText = studentId;

    listContainer.insertBefore(newItem, listContainer.firstChild);
    scanQueue.unshift(newItem);

    if (scanQueue.length > 5) {
        const oldestItem = scanQueue.pop();
        oldestItem.classList.add('fade-out');
        setTimeout(() => {
            if(oldestItem.parentNode) oldestItem.parentNode.removeChild(oldestItem);
        }, 500);
    }
};

// 6. ปุ่มควบคุม
window.manageLogs = function() {
    Swal.fire({
        title: 'จัดการข้อมูล / Log',
        text: 'คุณต้องการลบข้อมูลการสแกนที่ผิดพลาดล่าสุด (30 รายการ) หรือไม่?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'ใช่, ลบข้อมูล',
        cancelButtonText: 'ยกเลิก'
    });
};

window.openSettings = function() {
    Swal.fire({
        title: 'ตั้งค่าระบบสแกน',
        html: 'หน้าสำหรับปรับแต่งค่า <b>Threshold (FRR/FAR)</b><br>และอัปเดตแม่แบบภาพ',
        icon: 'info'
    });
};
