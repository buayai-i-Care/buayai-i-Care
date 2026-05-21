// 1. กำหนด URL (ตรวจสอบลิงก์ให้ตรงกับที่ฝากไฟล์ไว้)
const EPOINT_APP_URL = 'https://buayai-i-care.github.io/buayai-i-Care/warning_Epoint.html';
const CSS_URL = 'https://cdn.jsdelivr.net/gh/buayai-i-Care/buayai-i-Care@main/css_Global_waring.css';

// 2. ฟังก์ชันตรวจสอบรหัสห้องอัตโนมัติ (ฉบับแก้บั๊กขั้นสุด)
function getTeacherCode() {
    try {
        let roomStr = "";

        // ขั้นที่ 1: พยายามอ่านจากตัวแปรบนหน้าเว็บโดยตรง
        try {
            if (typeof currentUser !== 'undefined' && currentUser != null) {
                roomStr = currentUser.assignedClass || currentUser.className || currentUser.room || "";
            }
        } catch(e) {}

        // ขั้นที่ 2: ถ้าไม่ได้ ลองหาใน LocalStorage แบบหว่านแห (ครอบคลุมหลายชื่อ)
        if (!roomStr) {
            const keysToCheck = ['currentUser', 'user', 'userData', 'teacher_info', 'login_data'];
            for (let k of keysToCheck) {
                let data = localStorage.getItem(k) || sessionStorage.getItem(k);
                if (data) {
                    try {
                        let parsed = JSON.parse(data);
                        roomStr = parsed.assignedClass || parsed.className || parsed.room || "";
                        if (roomStr) break;
                    } catch(e) {}
                }
            }
        }

        // ขั้นที่ 3: นำคำที่ได้ (เช่น "ม.2/1" หรือ "2/1") มาแกะเป็นรหัส (เช่น "t21")
        if (roomStr) {
            // หาตัวเลขระดับชั้น 1-6 และห้อง 1-20
            let match = roomStr.match(/([1-6])\s*\/\s*([1-9][0-9]?)/);
            if (match) return 't' + match[1] + match[2];
        }

        // ขั้นที่ 4: (ไม้ตาย) กวาดสายตาจากข้อความทั้งหมดบนจอ และชื่อหัวเว็บ
        // จะมองหาคำว่า "ม.2/1", "ม. 2/1", "ชั้น 2/1", "ม2/1" อย่างเจาะจง (ป้องกันการสับสนกับวันที่)
        const pageText = document.title + " " + (document.body ? document.body.innerText : "");
        const screenMatch = pageText.match(/(?:ม\.|ม|ชั้น)\s*([1-6])\s*\/\s*([1-9][0-9]?)/);
        
        if (screenMatch) {
            return 't' + screenMatch[1] + screenMatch[2];
        }

    } catch (e) {
        console.error("E-Point Widget Error:", e);
    }
    
    // ถ้าไม่เจอจากทุกทางจริงๆ จะแจ้งเตือนใน Console (ให้กด F12 ดู)
    console.warn("E-Point Widget: ไม่พบรหัสห้องเรียนบนหน้าเว็บนี้ ระบบจะดึงข้อมูล ม.3/2 มาให้แทน");
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
