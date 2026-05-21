// =======================================================
// ไฟล์ waring_widget.js (Premium UI & Loading Screen)
// =======================================================

console.log("🟢 โหลด E-Point Widget (Premium UI) สำเร็จแล้ว!");

const EPOINT_APP_URL = 'https://buayai-i-care.github.io/buayai-i-Care/warning_Epoint.html';
const CSS_URL = 'https://cdn.jsdelivr.net/gh/buayai-i-Care/buayai-i-Care@main/css_Global_waring.css';

function getTeacherCodeLive() {
    try {
        let savedUser = sessionStorage.getItem('teacher_pw_auto');
        if (savedUser) return savedUser.trim().toLowerCase(); 

        if (typeof currentUser !== 'undefined' && currentUser && currentUser.assignedClass) {
            let match = currentUser.assignedClass.match(/([1-6])\s*[\/\-]\s*([1-9][0-9]?)/);
            if (match) return 't' + match[1] + match[2];
        }
    } catch (err) { console.error("E-Point Widget Error:", err); }
    return ''; 
}

// 🌟 ปรับปรุง HTML เพิ่ม Loading Screen และเปลี่ยนไอคอน
const widgetHTML = `
    <link rel="stylesheet" href="${CSS_URL}">
    <button id="epoint-btn" class="epoint-widget-btn" title="ระบบตักเตือน E-Point">
        <!-- ไอคอนกระดิ่งสไตล์ Modern -->
        <svg viewBox="0 0 256 256"><path d="M224,128v56a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V128a80,80,0,0,1,160,0Zm-96,96a24,24,0,0,0,24-24H104A24,24,0,0,0,128,224Z" opacity="0.2"></path><path d="M224,128v56a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V128a80,80,0,0,1,160,0Zm-16,0a64,64,0,0,0-128,0v56H208Zm-80,96a24,24,0,0,0,24-24H104A24,24,0,0,0,128,224Z"></path></svg>
        <span class="epoint-widget-dot"></span>
    </button>
    
    <div id="epointModalWidget" class="epoint-modal-overlay">
        <div class="epoint-modal-content">
            <div class="epoint-modal-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="color:#ef4444;">🛡️</span> ระบบ E-Point
                </div>
                <button onclick="closeEpointWidget()" class="epoint-modal-close">✕</button>
            </div>
            
            <!-- 🌟 หน้าจอ Loading (จะหายไปเมื่อ Iframe โหลดเสร็จ) -->
            <div id="epointLoader" class="epoint-loader-container">
                <div class="epoint-spinner"></div>
                <div class="epoint-loader-text">กำลังจัดเตรียมข้อมูล...</div>
            </div>

            <!-- Iframe แสดงข้อมูล -->
            <iframe id="epointIframe" class="epoint-iframe" src="about:blank"></iframe>
        </div>
    </div>
`;

if (!document.getElementById('epoint-btn')) {
    document.body.insertAdjacentHTML('beforeend', widgetHTML);
}

// 🌟 ฟังก์ชันเปิดหน้าต่าง
window.openEpointWidget = () => {
    const userCode = getTeacherCodeLive(); 
    const iframe = document.getElementById('epointIframe');
    const loader = document.getElementById('epointLoader');
    const timeStamp = new Date().getTime(); 
    
    // 1. แสดง Loader และซ่อน Iframe ตอนเริ่มโหลด
    loader.style.display = 'flex';
    iframe.classList.remove('loaded');
    
    // 2. ดักจับ event เมื่อ Iframe โหลดข้อมูลหน้าเว็บเสร็จ
    iframe.onload = () => {
        loader.style.display = 'none'; // ซ่อน Loader
        iframe.classList.add('loaded'); // โชว์ Iframe แบบ Fade-in
    };

    // 3. เซ็ต URL
    if (userCode) {
        iframe.src = `${EPOINT_APP_URL}?user=${userCode}&view=compact&_t=${timeStamp}`;
    } else {
        iframe.src = `${EPOINT_APP_URL}?view=compact&_t=${timeStamp}`;
    }
    
    document.getElementById('epointModalWidget').classList.add('show');
    document.body.style.overflow = 'hidden'; // ล็อกพื้นหลังไม่ให้เลื่อน
};

// ฟังก์ชันปิดหน้าต่าง
window.closeEpointWidget = () => {
    document.getElementById('epointModalWidget').classList.remove('show');
    document.body.style.overflow = ''; 
    
    setTimeout(() => { 
        document.getElementById('epointIframe').src = 'about:blank'; 
    }, 400); // รอให้แอนิเมชันปิดเสร็จก่อนค่อยล้างค่า
};

document.getElementById('epoint-btn').onclick = () => openEpointWidget();
