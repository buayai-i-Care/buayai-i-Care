// 1. กำหนด URL (ตรวจสอบลิงก์ให้ตรงกับที่ฝากไฟล์ไว้)
const EPOINT_APP_URL = 'https://buayai-i-care.github.io/buayai-i-Care/warning_Epoint.html';
const CSS_URL = 'https://cdn.jsdelivr.net/gh/buayai-i-Care/buayai-i-Care@main/css_Global_waring.css';

// 2. ฟังก์ชันตรวจสอบรหัสห้องอัตโนมัติ (ขั้นสูง: รองรับระบบ Login ของ chkFlagm2.html)
function getTeacherCode() {
    try {
        // เช็คชั้นที่ 1: ดึงจาก LocalStorage (ระบบ Login มักจะเก็บข้อมูลไว้ที่นี่)
        let storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            let parsed = JSON.parse(storedUser);
            if (parsed && parsed.assignedClass) {
                let match = parsed.assignedClass.match(/(\d+)\/(\d+)/);
                if (match) return 't' + match[1] + match[2];
            }
        }

        // เช็คชั้นที่ 2: ดึงจากตัวแปร Global บนหน้าเว็บ (ดึงจาก currentUser)
        if (typeof currentUser !== 'undefined' && currentUser.assignedClass) {
            let match = currentUser.assignedClass.match(/(\d+)\/(\d+)/); 
            if (match) return 't' + match[1] + match[2]; 
        }
        
        // เช็คชั้นที่ 3: กวาดสายตาจากข้อความที่แสดงอยู่บนหน้าเว็บ (กรณีหาตัวแปรไม่เจอ)
        const pageText = document.body.innerText;
        const screenMatch = pageText.match(/ม\.(\d+)\/(\d+)/); // หาคำว่า ม.X/Y
        if (screenMatch) {
            return 't' + screenMatch[1] + screenMatch[2];
        }

    } catch (e) {
        console.error("Widget: ไม่สามารถอ่านรหัสห้องได้", e);
    }
    
    // ถ้าหาจากทั้ง 3 วิธีไม่เจอเลย ให้ใช้ค่า Default เพื่อไม่ให้ระบบพัง
    return 't32';
}

// 3. แทรกโครงสร้าง Widget 
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

// แปะ Widget เข้าไปในหน้าเว็บ
document.body.insertAdjacentHTML('beforeend', widgetHTML);

// 4. ฟังก์ชันเปิด Widget (ทำงานเมื่อถูกคลิก)
window.openEpointWidget = () => {
    // 🌟 แกะรหัสอัตโนมัติ ณ วินาทีที่ครูกดปุ่ม
    const user = getTeacherCode(); 
    
    const iframe = document.getElementById('epointIframe');
    iframe.src = `${EPOINT_APP_URL}?user=${user}&view=compact`;
    document.getElementById('epointModalWidget').classList.add('show');
};

// 5. ผูกปุ่มคลิก
document.getElementById('epoint-btn').onclick = () => openEpointWidget();
