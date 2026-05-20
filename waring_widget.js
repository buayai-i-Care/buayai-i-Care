// เปลี่ยน URL ตรงนี้เป็นลิงก์หน้าเว็บที่คุณสุวางไว้บน GitHub Pages
const EPOINT_APP_URL = 'https://buayai-i-care.github.io/buayai-i-Care/warning_Epoint.html';
const CSS_URL = 'https://cdn.jsdelivr.net/gh/buayai-i-Care/buayai-i-Care@main/css_Global_waring.css';

const widgetHTML = `
    <link rel="stylesheet" href="${CSS_URL}">
    <button id="epoint-btn" class="epoint-widget-btn">
        <svg viewBox="0 0 256 256"><path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z"></path></svg>
        <span class="epoint-widget-dot"></span>
    </button>
    <div id="epointModalWidget" class="epoint-modal-overlay">
        <div class="epoint-modal-content">
            <div class="epoint-modal-header">
                ระบบ E-Point
                <button onclick="document.getElementById('epointModalWidget').classList.remove('show')" class="epoint-modal-close">X</button>
            </div>
            <iframe id="epointIframe" class="epoint-iframe"></iframe>
        </div>
    </div>
`;

document.body.insertAdjacentHTML('beforeend', widgetHTML);

window.openEpointWidget = (u='', id='', p='') => {
    const iframe = document.getElementById('epointIframe');
    let url = EPOINT_APP_URL;
    if (u) url += `?user=${u}`;
    else if (id && p) url += `?studentid=${id}&stdpass=${p}`;
    iframe.src = url;
    document.getElementById('epointModalWidget').classList.add('show');
};

document.getElementById('epoint-btn').onclick = () => openEpointWidget('t32'); // แก้ไขรหัสเริ่มต้นที่นี่
