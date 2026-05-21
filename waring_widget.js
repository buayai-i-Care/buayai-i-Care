// 1. กำหนดค่า URL ของหน้าเว็บ E-Point (อัปเดตให้เป็น URL จริงของคุณสุ)
const EPOINT_APP_URL = 'https://buayai-i-care.github.io/buayai-i-Care/warning_Epoint.html';
const CSS_URL = 'https://cdn.jsdelivr.net/gh/buayai-i-Care/buayai-i-Care@main/css_Global_waring.css';

// 2. ฟังก์ชันอัจฉริยะสำหรับตรวจจับรหัสห้องอัตโนมัติ
function detectUserCode() {
    // กฎลำดับการเช็ค:
    // 1. เช็คจาก URL (เช่น หน้าเว็บมี ?code=t16)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('code')) return urlParams.get('code');

    // 2. เช็คจากค่าที่ประกาศไว้ในหน้าเว็บ (เช่น <script>window.teacherCode = 't16';</script>)
    if (window.teacherCode) return window.teacherCode;

    // 3. กวาดสายตาหาชื่อห้องจากข้อความในหน้าเว็บ (ถ้าเจอคำว่า ม.1/6 ให้ส่ง t16)
    const pageText = document.body.innerText;
    if (pageText.includes('ม.1/6')) return 't16';
    if (pageText.includes('ม.3/2')) return 't32';
    // สามารถเพิ่มห้องอื่นๆ ได้ที่นี่...

    // 4. ค่าเริ่มต้นถ้าไม่พบข้อมูล
    return 't32';
}

// 3. สร้างโครงสร้าง Widget
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

// แทรก Widget เข้าไปในหน้าเว็บหลัก
document.body.insertAdjacentHTML('beforeend', widgetHTML);

// 4. ฟังก์ชันเปิดหน้าต่าง
window.openEpointWidget = (u = '') => {
    const user = u || detectUserCode(); // ใช้รหัสที่ส่งมา หรือให้ระบบหาอัตโนมัติ
    const iframe = document.getElementById('epointIframe');
    const modal = document.getElementById('epointModalWidget');
    
    // โหลดหน้า E-Point พร้อมโหมด Compact
    iframe.src = `${EPOINT_APP_URL}?user=${user}&view=compact`;
    modal.classList.add('show');
};

// 5. ผูกปุ่มคลิกให้ทำงาน
document.getElementById('epoint-btn').onclick = () => openEpointWidget();
