const WEB_APP_URL = "https://script.google.com/macros/s/AKfycby7I80DzMqptv3w_x9aG-E9C8qlb0NLHwNZPqNpfOA38VUmsBZYfLOCnlIZkuK5tXRU/exec"; 

// State
let currentUser = null;
let currentReportsData = [];

// DOM Elements
const loadingOverlay = document.getElementById('loading-overlay');
const toast = document.getElementById('toast');

// --- 1. Login System ---
document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const password = document.getElementById('password').value;
    
    if (password === 'kkssbbyy') {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('password').value = '';
    } else {
        showToast('รหัสผ่านไม่ถูกต้อง', 'error');
    }
});

document.getElementById('logout-btn').addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('app-container').classList.add('hidden');
    document.getElementById('login-screen').classList.add('active');
    closeSidebar();
});

// --- 2. Navigation & Sidebar ---
const hamburger = document.getElementById('hamburger');
const sidebar = document.getElementById('sidebar');
const closeBtn = document.getElementById('close-sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const navLinks = document.querySelectorAll('.nav-links a[data-target]');

function openSidebar() {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('show');
}

function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('show');
}

hamburger.addEventListener('click', openSidebar);
closeBtn.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        const targetId = this.getAttribute('data-target');
        
        // Update active class on links
        navLinks.forEach(l => l.classList.remove('active'));
        this.classList.add('active');
        
        // Hide all screens, show target
        document.querySelectorAll('.main-content').forEach(screen => {
            screen.classList.add('hidden');
        });
        document.getElementById(targetId).classList.remove('hidden');
        
        closeSidebar();
        
        // If navigating to reports, fetch data
        if(targetId === 'reports-screen') {
            fetchReportsData();
        }
    });
});

// --- 3. Home Screen (Search & Treatment) ---
// แปลง Google Drive URL เป็น Direct Image URL
function getDirectImageUrl(url) {
    if (!url) return '';
    const match = url.match(/\/d\/(.+?)\//);
    if (match && match[1]) {
        return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
    return url;
}

document.getElementById('search-student-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = document.getElementById('search-student-id').value.trim();
    if (!id) return;
    
    if(WEB_APP_URL === "YOUR_WEB_APP_URL_HERE") {
        showToast('กรุณาตั้งค่า WEB_APP_URL ในไฟล์ app.js ก่อน', 'error');
        // Mock data for testing if no API
        showStudentProfile({ id: id, name: "นายทดสอบ ระบบดี", room: "M.5/1", imageUrl: "" });
        return;
    }

    showLoading(true);
    try {
        const response = await fetch(`${WEB_APP_URL}?action=search_student&id=${id}`);
        const result = await response.json();
        
        if (result.status === 'success') {
            showStudentProfile(result.data);
        } else {
            showToast(result.message, 'error');
            hideStudentProfile();
        }
    } catch (error) {
        showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
    }
    showLoading(false);
});

function showStudentProfile(data) {
    currentUser = data;
    document.getElementById('student-name').textContent = data.name;
    document.getElementById('student-id-display').textContent = data.id;
    document.getElementById('student-room').textContent = data.room;
    
    const imgElement = document.getElementById('student-image');
    if (data.imageUrl) {
        imgElement.src = getDirectImageUrl(data.imageUrl);
    } else {
        imgElement.src = 'https://via.placeholder.com/150?text=No+Photo';
    }
    
    document.getElementById('student-profile-card').classList.remove('hidden');
    document.getElementById('treatment-form-card').classList.add('hidden');
}

function hideStudentProfile() {
    currentUser = null;
    document.getElementById('student-profile-card').classList.add('hidden');
    document.getElementById('treatment-form-card').classList.add('hidden');
}

document.getElementById('btn-confirm-student').addEventListener('click', function() {
    document.getElementById('student-profile-card').classList.add('hidden');
    document.getElementById('treatment-form-card').classList.remove('hidden');
    document.getElementById('treatment-form').reset();
    resetFormDynamicFields();
});

document.getElementById('btn-cancel-treatment').addEventListener('click', function() {
    hideStudentProfile();
    document.getElementById('search-student-id').value = '';
});

// Dynamic Form Fields
const symptomRadios = document.querySelectorAll('input[name="symptom"]');
const symptomOther = document.getElementById('symptom-other');
symptomRadios.forEach(radio => {
    radio.addEventListener('change', function() {
        if (this.value === 'อื่นๆ') {
            symptomOther.classList.remove('hidden');
            symptomOther.required = true;
        } else {
            symptomOther.classList.add('hidden');
            symptomOther.required = false;
        }
    });
});

const actionRadios = document.querySelectorAll('input[name="action"]');
const medicationSection = document.getElementById('medication-section');
const medicationSelect = document.getElementById('medication-select');
actionRadios.forEach(radio => {
    radio.addEventListener('change', function() {
        if (this.value === 'ให้ยา') {
            medicationSection.classList.remove('hidden');
            medicationSelect.required = true;
        } else {
            medicationSection.classList.add('hidden');
            medicationSelect.required = false;
        }
    });
});

const medicationOther = document.getElementById('medication-other');
medicationSelect.addEventListener('change', function() {
    if (this.value === 'อื่นๆ') {
        medicationOther.classList.remove('hidden');
        medicationOther.required = true;
    } else {
        medicationOther.classList.add('hidden');
        medicationOther.required = false;
    }
});

const followupRadios = document.querySelectorAll('input[name="followup"]');
const followupOther = document.getElementById('followup-other');
followupRadios.forEach(radio => {
    radio.addEventListener('change', function() {
        if (this.value === 'อื่นๆ') {
            followupOther.classList.remove('hidden');
            followupOther.required = true;
        } else {
            followupOther.classList.add('hidden');
            followupOther.required = false;
        }
    });
});

function resetFormDynamicFields() {
    symptomOther.classList.add('hidden');
    medicationSection.classList.add('hidden');
    medicationOther.classList.add('hidden');
    followupOther.classList.add('hidden');
}

// Preview and Save
document.getElementById('btn-preview-save').addEventListener('click', function() {
    const form = document.getElementById('treatment-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const symptomVal = document.querySelector('input[name="symptom"]:checked').value;
    const symptomFinal = symptomVal === 'อื่นๆ' ? document.getElementById('symptom-other').value : symptomVal;

    const actionVal = document.querySelector('input[name="action"]:checked').value;
    let medFinal = '-';
    if (actionVal === 'ให้ยา') {
        const medVal = document.getElementById('medication-select').value;
        medFinal = medVal === 'อื่นๆ' ? document.getElementById('medication-other').value : medVal;
    }

    const followupVal = document.querySelector('input[name="followup"]:checked').value;
    const followupFinal = followupVal === 'อื่นๆ' ? document.getElementById('followup-other').value : followupVal;

    const detailsHTML = `
        <div class="detail-row"><div class="detail-label">รหัสนักเรียน</div><div class="detail-value">${currentUser.id}</div></div>
        <div class="detail-row"><div class="detail-label">ชื่อ-สกุล</div><div class="detail-value">${currentUser.name}</div></div>
        <div class="detail-row"><div class="detail-label">ห้อง</div><div class="detail-value">${currentUser.room}</div></div>
        <hr style="margin: 10px 0; border: 0; border-top: 1px solid #e2e8f0;">
        <div class="detail-row"><div class="detail-label">อาการ</div><div class="detail-value">${symptomFinal}</div></div>
        <div class="detail-row"><div class="detail-label">การดำเนินการ</div><div class="detail-value">${actionVal}</div></div>
        <div class="detail-row"><div class="detail-label">ยาที่ให้</div><div class="detail-value">${medFinal}</div></div>
        <div class="detail-row"><div class="detail-label">การติดตาม</div><div class="detail-value">${followupFinal}</div></div>
    `;

    document.getElementById('confirm-details').innerHTML = detailsHTML;
    
    // Store payload for saving
    window.currentPayload = {
        studentId: currentUser.id,
        name: currentUser.name,
        room: currentUser.room,
        symptoms: symptomFinal,
        action: actionVal,
        medication: medFinal,
        followUp: followupFinal
    };

    document.getElementById('confirm-modal').classList.remove('hidden');
});

document.querySelector('.close-modal').addEventListener('click', function() {
    document.getElementById('confirm-modal').classList.add('hidden');
});
document.querySelector('.btn-cancel-modal').addEventListener('click', function() {
    document.getElementById('confirm-modal').classList.add('hidden');
});

document.getElementById('btn-final-save').addEventListener('click', async function() {
    if(WEB_APP_URL === "YOUR_WEB_APP_URL_HERE") {
        showToast('บันทึกจำลองสำเร็จ (ยังไม่ได้เชื่อมต่อ Google Sheets)', 'success');
        document.getElementById('confirm-modal').classList.add('hidden');
        document.getElementById('treatment-form-card').classList.add('hidden');
        document.getElementById('search-student-id').value = '';
        return;
    }

    const btn = this;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';
    
    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'save_record',
                payload: window.currentPayload
            })
        });
        
        const result = await response.json();
        if (result.status === 'success') {
            showToast('บันทึกข้อมูลเรียบร้อยแล้ว', 'success');
            document.getElementById('confirm-modal').classList.add('hidden');
            document.getElementById('treatment-form-card').classList.add('hidden');
            document.getElementById('search-student-id').value = '';
        } else {
            showToast('เกิดข้อผิดพลาด: ' + result.message, 'error');
        }
    } catch (error) {
        showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
    }
    
    btn.disabled = false;
    btn.innerHTML = 'บันทึกข้อมูล';
});


// --- 4. Search History Screen ---
document.getElementById('search-history-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = document.getElementById('search-history-id').value.trim();
    if (!id) return;
    
    if(WEB_APP_URL === "YOUR_WEB_APP_URL_HERE") {
        showToast('ระบบจำลอง: ไม่มีประวัติ', 'error');
        return;
    }

    showLoading(true);
    try {
        const response = await fetch(`${WEB_APP_URL}?action=get_history&id=${id}`);
        const result = await response.json();
        
        if (result.status === 'success') {
            renderHistory(result.data, id);
        } else {
            showToast('ไม่พบประวัติ', 'error');
            document.getElementById('history-results').classList.add('hidden');
        }
    } catch (error) {
        showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
    }
    showLoading(false);
});

function renderHistory(data, queryId) {
    const resultsContainer = document.getElementById('history-results');
    const listContainer = document.getElementById('history-list');
    
    if (data.length === 0) {
        listContainer.innerHTML = '<p class="text-center text-gray my-4">ไม่พบประวัติการรักษา</p>';
        document.getElementById('history-student-name').textContent = "-";
        document.getElementById('history-student-id').textContent = queryId;
        document.getElementById('history-student-room').textContent = "-";
        document.getElementById('history-count').textContent = "0";
    } else {
        document.getElementById('history-student-name').textContent = data[0].name;
        document.getElementById('history-student-id').textContent = queryId;
        document.getElementById('history-student-room').textContent = data[0].room;
        document.getElementById('history-count').textContent = data.length;
        
        let html = '';
        data.forEach(item => {
            const dateStr = new Date(item.date).toLocaleString('th-TH');
            html += `
                <div class="history-item">
                    <div class="history-item-header">
                        <span><i class="fa-regular fa-clock"></i> ${dateStr}</span>
                    </div>
                    <div class="detail-row"><div class="detail-label">อาการ</div><div class="detail-value text-danger">${item.symptoms}</div></div>
                    <div class="detail-row"><div class="detail-label">การดำเนินการ</div><div class="detail-value">${item.action}</div></div>
                    ${item.medication && item.medication !== '-' ? `<div class="detail-row"><div class="detail-label">ยาที่ให้</div><div class="detail-value text-success">${item.medication}</div></div>` : ''}
                    <div class="detail-row"><div class="detail-label">การติดตาม</div><div class="detail-value text-primary">${item.followUp}</div></div>
                </div>
            `;
        });
        listContainer.innerHTML = html;
    }
    resultsContainer.classList.remove('hidden');
}


// --- 5. Reports Screen ---
async function fetchReportsData() {
    if(WEB_APP_URL === "YOUR_WEB_APP_URL_HERE") return;
    
    try {
        const response = await fetch(`${WEB_APP_URL}?action=get_reports`);
        const result = await response.json();
        if (result.status === 'success') {
            currentReportsData = result.data;
        }
    } catch (error) {
        console.error("Error fetching reports", error);
    }
}

function generateReport(type) {
    const viewer = document.getElementById('report-viewer');
    const content = document.getElementById('report-content');
    const title = document.getElementById('report-title');
    
    viewer.classList.remove('hidden');
    let html = '';
    
    if (type === 'monthly') {
        title.textContent = 'สถิติการใช้บริการ (รายเดือน)';
        // จัดกลุ่มตามเดือน
        const monthly = {};
        currentReportsData.forEach(item => {
            const d = new Date(item.date);
            const key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2, '0')}`;
            monthly[key] = (monthly[key] || 0) + 1;
        });
        
        html = `
            <h2>สรุปการใช้บริการห้องพยาบาลรายเดือน</h2>
            <table class="report-table">
                <thead><tr><th>เดือน (ปี-เดือน)</th><th>จำนวนครั้งที่ใช้บริการ</th></tr></thead>
                <tbody>
                    ${Object.keys(monthly).sort().reverse().map(k => `<tr><td>${k}</td><td>${monthly[k]}</td></tr>`).join('')}
                </tbody>
            </table>
        `;
    } 
    else if (type === 'disease') {
        title.textContent = 'สถิติอาการป่วย';
        const symptoms = {};
        currentReportsData.forEach(item => {
            if(item.symptoms) {
                symptoms[item.symptoms] = (symptoms[item.symptoms] || 0) + 1;
            }
        });
        
        html = `
            <h2>สรุปสถิติอาการป่วย/สาเหตุที่มาห้องพยาบาล</h2>
            <table class="report-table">
                <thead><tr><th>อาการ</th><th>จำนวน (ครั้ง)</th></tr></thead>
                <tbody>
                    ${Object.keys(symptoms).sort((a,b)=>symptoms[b]-symptoms[a]).map(k => `<tr><td>${k}</td><td>${symptoms[k]}</td></tr>`).join('')}
                </tbody>
            </table>
        `;
    }
    else if (type === 'medication') {
        title.textContent = 'การใช้ยาและเวชภัณฑ์';
        const meds = {};
        currentReportsData.forEach(item => {
            if(item.medication && item.medication !== '-') {
                meds[item.medication] = (meds[item.medication] || 0) + 1;
            }
        });
        
        html = `
            <h2>รายงานการจ่ายยา (Medication Usage)</h2>
            <p>เพื่อใช้ประกอบการวางแผนจัดซื้อและบริหารสต็อกยา</p>
            <table class="report-table">
                <thead><tr><th>ชื่อยา / เวชภัณฑ์</th><th>จำนวนครั้งที่จ่าย</th></tr></thead>
                <tbody>
                    ${Object.keys(meds).sort((a,b)=>meds[b]-meds[a]).map(k => `<tr><td>${k}</td><td>${meds[k]}</td></tr>`).join('')}
                </tbody>
            </table>
        `;
    }
    else if (type === 'referral') {
        title.textContent = 'รายงานสรุปการส่งต่อ (Referral)';
        const referrals = currentReportsData.filter(item => item.action === 'ส่งต่อ' || item.followUp === 'ส่งต่อโรงพยาบาล');
        
        html = `
            <h2>สรุปประวัติการส่งต่อหน่วยงานภายนอก / โรงพยาบาล</h2>
            <p>จำนวนการส่งต่อทั้งหมด: ${referrals.length} ครั้ง</p>
            <table class="report-table">
                <thead><tr><th>วันที่</th><th>รหัสนักเรียน</th><th>ชื่อ-สกุล</th><th>อาการ</th></tr></thead>
                <tbody>
                    ${referrals.map(item => `
                        <tr>
                            <td>${new Date(item.date).toLocaleDateString('th-TH')}</td>
                            <td>${item.studentId}</td>
                            <td>${item.name}</td>
                            <td>${item.symptoms}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    
    content.innerHTML = html;
}

document.getElementById('btn-close-report').addEventListener('click', function() {
    document.getElementById('report-viewer').classList.add('hidden');
});

document.getElementById('btn-print-report').addEventListener('click', function() {
    const element = document.getElementById('report-content');
    const opt = {
      margin:       1,
      filename:     'Healthcare_Report.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
});

// --- Utilities ---
function showLoading(show) {
    if(show) loadingOverlay.classList.remove('hidden');
    else loadingOverlay.classList.add('hidden');
}

function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.style.backgroundColor = type === 'error' ? 'var(--danger-color)' : 
                                  type === 'success' ? 'var(--success-color)' : '#333';
    toast.classList.remove('hidden');
    toast.style.opacity = 1;
    
    setTimeout(() => {
        toast.style.opacity = 0;
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
}
