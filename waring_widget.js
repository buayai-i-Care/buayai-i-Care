// 1. กำหนด URL (ตรวจสอบลิงก์ให้ตรงกับที่ฝากไฟล์ไว้)
const EPOINT_APP_URL = 'https://buayai-i-care.github.io/buayai-i-Care/warning_Epoint.html';
const CSS_URL = 'https://cdn.jsdelivr.net/gh/buayai-i-Care/buayai-i-Care@main/css_Global_waring.css';

// 2. ฟังก์ชันค้นหารหัสห้องแบบ "สแกนลึก" (Deep Scanner) - วิธีใหม่ล่าสุด
function getTeacherCode() {
    // ฟังก์ชันย่อยสกัดรหัสห้องจากข้อความ
    const extractRoomCode = (text) => {
        if (!text || typeof text !== 'string') return null;
        // รองรับทั้ง "ม.2/1", "2/1", "ม. 2/1", "ชั้น 2/1"
        const match = text.match(/(?:ม\.|ม|ชั้น)?\s*([1-6])\s*\/\s*([1-9][0-9]?)/);
        if (match) return 't' + match[1] + match[2];
        return null;
    };

    try {
        // วิธีใหม่ที่ 1: กวาดหาข้อมูลจาก "ทุก Key" ใน Storage ของ Browser
        // โดยไม่สนชื่อตัวแปรว่าจะเป็นอะไร ระบบจะควานหาข้อความที่ตรงกับรูปแบบห้องเอง
        const storages = [localStorage, sessionStorage];
        for (let storage of storages) {
            for (let i = 0; i < storage.length; i++) {
                let key = storage.key(i);
                let value = storage.getItem(key);
                let code = extractRoomCode(value);
                if (code) return code; // ถ้าเจอ คืนค่าทันที
            }
        }

        // วิธีใหม่ที่ 2: กวาดหาข้อความบนหน้าเว็บ (กรณีมีป้ายบอกชื่อห้องบนเว็บ)
        let bodyCode = extractRoomCode(document.body.innerText);
        if (bodyCode) return bodyCode;

        // วิธีใหม่ที่ 3: วิเคราะห์จาก URL (เช่น ระบบ chkFlagm2.html -> เดาว่าเป็น ม.2)
        let urlMatch = window.location.href.match(/m([1-6])/i);
        if (urlMatch) return 'm' + urlMatch[1]; // ส่งเป็นหัวหน้าระดับ ม.X

    } catch (e) {
        console.error("Widget Scanner Error:", e);
    }
    
    // 🌟 สำคัญ: ยกเลิกการบังคับใช้ t32 (ม.3/2) หากหาไม่เจอ 
    // คืนค่าว่างไป เพื่อป้องกันการดึงข้อมูลผิดห้อง
    return ''; 
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
    const user = getTeacherCode(); 
    const iframe = document.getElementById('epointIframe');
    
    // หากสแกนเจอผู้ใช้ จะส่ง user ไปล็อกอินอัตโนมัติ
    // แต่ถ้าหาไม่เจอจริงๆ จะเปิดหน้าจอปกติให้แทน เพื่อความปลอดภัยของข้อมูล
    if (user) {
        iframe.src = `${EPOINT_APP_URL}?user=${user}&view=compact`;
    } else {
        iframe.src = `${EPOINT_APP_URL}?view=compact`;
    }
    
    document.getElementById('epointModalWidget').classList.add('show');
};

// 5. ผูกปุ่มคลิก
document.getElementById('epoint-btn').onclick = () => openEpointWidget();
