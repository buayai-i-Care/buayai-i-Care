// =======================================================
// ไฟล์ waring_widget.js (แก้ไขบน GitHub ที่เดียวจบ)
// =======================================================

const EPOINT_APP_URL = 'https://buayai-i-care.github.io/buayai-i-Care/warning_Epoint.html';
const CSS_URL = 'https://cdn.jsdelivr.net/gh/buayai-i-Care/buayai-i-Care@main/css_Global_waring.css';

// 1. ฟังก์ชันดึงรหัสที่แม่นยำที่สุด (ดึงจากระบบของคุณสุโดยตรง)
function getTeacherCodeLive() {
    try {
        // 🌟 วิธีที่ 1 (กุญแจทองคำ): ดึงจากหน่วยความจำที่ระบบ chkFlagm2.html บันทึกไว้ตอน Login
        let savedUser = sessionStorage.getItem('teacher_pw_auto');
        if (savedUser) {
            return savedUser; // คืนค่า t21, t32 ฯลฯ ได้ตรงเป๊ะแน่นอน 100%
        }

        // วิธีที่ 2 (สำรอง): ดึงจากตัวแปร currentUser ตรงๆ
        if (typeof currentUser !== 'undefined' && currentUser.assignedClass) {
            let match = currentUser.assignedClass.match(/([1-6])\s*[\/\-]\s*([1-9][0-9]?)/);
            if (match) return 't' + match[1] + match[2];
        }

        // วิธีที่ 3 (สำรองขั้นสุด): กวาดสายตาจากบนหน้าจอ
        let screenText = document.title + " " + document.body.innerText;
        let visualMatch = screenText.match(/(?:ม\.|ม|ชั้น|ห้อง)\s*([1-6])\s*[\/\-]\s*([1-9][0-9]?)/);
        if (visualMatch) return 't' + visualMatch[1] + visualMatch[2];

    } catch (err) {
        console.error("E-Point Widget Error:", err);
    }
    
    // ถ้าไม่เจอจริงๆ (เช่น ครูยังไม่ได้ล็อกอิน) ให้คืนค่าว่างไปเพื่อความปลอดภัย
    return ''; 
}

// 2. สร้างโครงสร้าง Widget (ปุ่มและ Modal)
const widgetHTML = `
    <link rel="stylesheet" href="${CSS_URL}">
    <button id="epoint-btn" class="epoint-widget-btn" title="ระบบตักเตือน E-Point">
        <svg viewBox="0 0 256 256"><path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z"></path></svg>
        <span class="epoint-widget-dot"></span>
    </button>
    <div id="epointModalWidget" class="epoint-modal-overlay">
        <div class="epoint-modal-content">
            <div class="epoint-modal-header">
                <span>ระบบตักเตือน E-Point</span>
                <button onclick="document.getElementById('epointModalWidget').classList.remove('show')" class="epoint-modal-close">✕</button>
            </div>
            <iframe id="epointIframe" class="epoint-iframe" src="about:blank"></iframe>
        </div>
    </div>
`;

// แทรก Widget เข้าไปในหน้าเว็บ (ป้องกันการแทรกซ้ำ)
if (!document.getElementById('epoint-btn')) {
    document.body.insertAdjacentHTML('beforeend', widgetHTML);
}

// 3. ฟังก์ชันเปิดหน้าต่าง
window.openEpointWidget = () => {
    // 🌟 ดึงข้อมูลจาก Session ทันทีที่ครูคลิก
    const userCode = getTeacherCodeLive(); 
    const iframe = document.getElementById('epointIframe');
    
    // ถ้ารู้รหัส จะส่งรหัส (เช่น user=t21) ไปให้ Auto-login
    if (userCode) {
        iframe.src = `${EPOINT_APP_URL}?user=${userCode}&view=compact`;
    } else {
        iframe.src = `${EPOINT_APP_URL}?view=compact`;
    }
    
    document.getElementById('epointModalWidget').classList.add('show');
};

// 4. ผูกปุ่มคลิกให้ทำงาน
document.getElementById('epoint-btn').onclick = () => openEpointWidget();
