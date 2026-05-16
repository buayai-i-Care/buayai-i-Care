import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// 1. อ่านชื่อหน้าเว็บปัจจุบันแบบอัตโนมัติ
let pathName = window.location.pathname;
let pageName = pathName.split('/').pop();
if (!pageName || pageName === "") {
    pageName = "index.html"; // กรณีหน้าแรกสุดที่ไม่มีชื่อไฟล์ต่อท้าย
}
// ทำความสะอาดชื่อไฟล์เพื่อใช้เป็น Document ID ใน Firebase (เปลี่ยนจุดและทับเป็นขีดล่าง)
const pageId = pageName.replace(/\./g, '_').replace(/\//g, '_'); 

// 2. สร้างสไตล์ CSS อัตโนมัติ (จะได้ไม่ต้องก๊อปปี้ CSS ไปวางทั้ง 30 หน้า)
const style = document.createElement('style');
style.innerHTML = `
    .visitor-counter-widget {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        color: #f8fafc;
        padding: 10px 25px;
        border-radius: 50px;
        font-size: 18px;
        font-weight: 700;
        margin-top: 15px;
        border: 2px solid #38bdf8;
        box-shadow: 0 4px 15px rgba(56, 189, 248, 0.4);
        transition: transform 0.3s ease;
        font-family: 'Sarabun', sans-serif;
        text-decoration: none;
    }
    .visitor-counter-widget:hover { transform: scale(1.05); }
    .visitor-counter-widget .count-number {
        color: #fbbf24;
        font-size: 24px;
        margin: 0 8px;
        text-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
    }
`;
document.head.appendChild(style);

// 3. ตั้งค่าการเชื่อมต่อ Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDNWBCSdBEtogAyvIFkjJ7gBNbOOwAv2Bc",
    authDomain: "counter-buayai.firebaseapp.com",
    projectId: "counter-buayai",
    storageBucket: "counter-buayai.firebasestorage.app",
    messagingSenderId: "143729655497",
    appId: "1:143729655497:web:b189121b640aa59fddd718"
};

// 4. เริ่มทำงานเมื่อหน้าเว็บโหลดเสร็จ
document.addEventListener('DOMContentLoaded', () => {
    // หากล่องรอรับข้อความในหน้า HTML
    const counterUI = document.getElementById('global-visitor-counter');
    
    if(counterUI) {
        counterUI.className = 'visitor-counter-widget';
        counterUI.innerHTML = '👥 กำลังโหลด...';

        try {
            const app = initializeApp(firebaseConfig);
            const db = getFirestore(app);
            
            // 🎯 ชี้ไปที่ไฟล์สถิติตามชื่อหน้าเว็บนั้นๆ (เช่น ParentChkm1_html)
            const counterRef = doc(db, "website_stats", pageId); 

            // สร้างหน่วยความจำกันนับซ้ำ แยกตามหน้าเว็บ
            const storageKey = 'visited_' + pageId;
            const hasVisited = localStorage.getItem(storageKey);
            
            if (!hasVisited) {
                // อัปเดตยอดวิวเฉพาะถ้ายังไม่เคยเข้าหน้านี้
                getDoc(counterRef).then((docSnap) => {
                    if (docSnap.exists()) {
                        updateDoc(counterRef, { count: increment(1) });
                    } else {
                        setDoc(counterRef, { count: 1 });
                    }
                    localStorage.setItem(storageKey, 'true');
                });
            }

            // ดึงสถิติสดๆ (Real-time) มาแสดง
            onSnapshot(counterRef, (doc) => {
                if (doc.exists()) {
                    counterUI.innerHTML = `👥 ผู้เข้าชมหน้านี้: <span class="count-number">${doc.data().count}</span> ครั้ง`;
                } else {
                    counterUI.innerHTML = `👥 ผู้เข้าชมหน้านี้: <span class="count-number">1</span> ครั้ง`;
                }
            });

        } catch (error) {
            console.error("Firebase Error: ", error);
            counterUI.innerHTML = "👥 ตัวนับผู้ชมขัดข้อง";
        }
    }
});
