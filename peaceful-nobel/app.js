// -------------------------------------------------------------
// การตั้งค่าทั่วไป (Configuration)
// -------------------------------------------------------------
const ROLES = {
    "1": { name: "คุณครู (ขอดำเนินการ)", isTeacher: true },
    "2": { name: "ตัดงบ", password: "123" },
    "3": { name: "ร่าง 14 แผ่น", password: "123" },
    "4": { name: "จัดซื้อจัดจ้าง", password: "123" },
    "5": { name: "เสนอรองผู้อำนวยการ", password: "123" },
    "6": { name: "ฝ่ายการเงิน", password: "123" },
    "7": { name: "จ่ายเช็ค", password: "123" }
};

const WORKFLOW_STEPS = [
    { id: 1, name: "ขอดำเนินการ (คุณครู)" },
    { id: 2, name: "ตัดงบ" },
    { id: 3, name: "ร่าง 14 แผ่น" },
    { id: 4, name: "จัดซื้อจัดจ้าง" },
    { id: 5, name: "เสนอรองผู้อำนวยการ" },
    { id: 6, name: "ฝ่ายการเงิน" },
    { id: 7, name: "จ่ายเช็ค" }
];

// ตัวแปรเก็บสถานะการเข้าสู่ระบบ
let currentUserRole = null;
let currentTeacherId = null; // เก็บ t1 - t120 ถ้าเป็นครู
let currentTasks = []; 
let activeTaskId = null;

const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxlaVCmbjHhlXfxvboRFhxnqY8f5xCDKGpmpBC_Cvn9TYKKDIqnhLfBMAokbO8unHTR/exec";

// -------------------------------------------------------------
// ฟังก์ชัน Authentication (เข้าสู่ระบบ)
// -------------------------------------------------------------
function login() {
    const roleId = document.getElementById('roleSelect').value;
    const password = document.getElementById('passwordInput').value.trim().toLowerCase();
    const errorMsg = document.getElementById('loginError');

    if (!roleId || !password) {
        errorMsg.textContent = "กรุณาเลือกฝ่ายและกรอกรหัสผ่าน";
        errorMsg.classList.remove('hidden');
        return;
    }

    let isValid = false;
    let displayName = ROLES[roleId].name;

    if (ROLES[roleId].isTeacher) {
        // ลบช่องว่างทั้งหมดออกเผื่อเผลอพิมพ์เว้นวรรค เช่น "t 1" -> "t1"
        const cleanPassword = password.replace(/\s+/g, '');
        
        if (cleanPassword.startsWith('t')) {
            const num = parseInt(cleanPassword.substring(1), 10);
            if (!isNaN(num) && num >= 1 && num <= 120) {
                isValid = true;
                currentTeacherId = 't' + num; // แปลงให้เป็นฟอร์แมตมาตรฐาน t1, t2
                displayName = `คุณครู (${currentTeacherId})`;
            }
        }
        
        if (!isValid) {
            errorMsg.textContent = "รหัสคุณครูไม่ถูกต้อง (ต้องเป็น t1 ถึง t120)";
        }
    } else {
        if (ROLES[roleId].password === password) {
            isValid = true;
            currentTeacherId = null;
        } else {
            errorMsg.textContent = "รหัสผ่านไม่ถูกต้อง";
        }
    }

    if (isValid) {
        currentUserRole = parseInt(roleId);
        errorMsg.classList.add('hidden');
        
        // อัปเดต UI
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('appScreen').classList.remove('hidden');
        document.getElementById('userRoleDisplay').innerHTML = `<i class="fas fa-user-circle mr-1"></i> ${displayName}`;
        
        // ถ้าเป็นแผนก 1 (คุณครู) ให้แสดงปุ่มสร้างงาน
        if (currentUserRole === 1) {
            document.getElementById('btnCreateTask').classList.remove('hidden');
        } else {
            document.getElementById('btnCreateTask').classList.add('hidden');
        }

        loadData();
    } else {
        errorMsg.classList.remove('hidden');
    }
}

function logout() {
    currentUserRole = null;
    currentTeacherId = null;
    document.getElementById('passwordInput').value = '';
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('appScreen').classList.add('hidden');
}

// -------------------------------------------------------------
// ฟังก์ชัน Data & UI Rendering (โหลดข้อมูลและแสดงผล)
// -------------------------------------------------------------
async function loadData() {
    // 1. ดึงข้อมูลเก่าที่เคยโหลดไว้ (Cache) มาแสดงผลให้ผู้ใช้ดูก่อนทันที (ความเร็ว 0 วินาที)
    const cachedData = localStorage.getItem('tasksCache');
    if (cachedData) {
        try {
            currentTasks = JSON.parse(cachedData);
            renderDashboard();
            renderTaskList();
        } catch(e) {
            console.error("Cache error", e);
        }
    } else {
        // ถ้าไม่มี Cache ค่อยขึ้นหน้าโหลดหมุนๆ
        document.getElementById('taskList').innerHTML = '<div class="text-center p-10 text-gray-500"><i class="fas fa-spinner fa-spin text-2xl mb-2"></i><br>กำลังดึงข้อมูลล่าสุด...</div>';
    }
    
    // 2. ไปดึงข้อมูลล่าสุดจาก Google Sheets เบื้องหลัง
    try {
        const response = await fetch(GAS_API_URL + "?action=getTasks");
        const result = await response.json();
        
        if (result.status === "success") {
            const newTasks = result.data || [];
            
            // อัปเดต Cache
            localStorage.setItem('tasksCache', JSON.stringify(newTasks));
            
            // ถ้าข้อมูลใหม่หน้าตาไม่เหมือนของเก่า ให้โหลดทับแล้วอัปเดตจอ
            if (JSON.stringify(newTasks) !== JSON.stringify(currentTasks)) {
                currentTasks = newTasks;
                renderDashboard();
                renderTaskList();
            }
        } else {
            if (!cachedData) document.getElementById('taskList').innerHTML = '<div class="text-center p-10 text-red-500">เกิดข้อผิดพลาดในการดึงข้อมูล</div>';
        }
    } catch (error) {
        if (!cachedData) document.getElementById('taskList').innerHTML = '<div class="text-center p-10 text-red-500">ไม่สามารถเชื่อมต่อฐานข้อมูลได้</div>';
    }
}

// ดึงรายการงานที่ผู้ใช้ควรเห็น
function getVisibleTasks() {
    if (currentUserRole === 1) {
        // ถ้าเป็นครู ให้เห็นเฉพาะงานที่ตัวเองสร้าง
        return currentTasks.filter(t => t.history && t.history[0] && t.history[0].owner === currentTeacherId);
    }
    // ฝ่ายอื่นๆ เห็นทั้งหมด
    return currentTasks;
}

function renderDashboard() {
    const visibleTasks = getVisibleTasks();
    let myCount = 0;
    
    visibleTasks.forEach(task => {
        if (task.currentStep === currentUserRole && task.status !== 'finished') {
            myCount++;
        }
    });

    document.getElementById('myTaskCount').textContent = myCount;
    document.getElementById('totalTaskCount').textContent = visibleTasks.length;
}

function renderTaskList() {
    const listContainer = document.getElementById('taskList');
    listContainer.innerHTML = '';
    
    const visibleTasks = getVisibleTasks();

    if (visibleTasks.length === 0) {
        listContainer.innerHTML = '<div class="text-center p-10 text-gray-400">ไม่มีงานในระบบ</div>';
        return;
    }

    const sortedTasks = [...visibleTasks].sort((a, b) => {
        if (a.currentStep === currentUserRole && b.currentStep !== currentUserRole) return -1;
        if (a.currentStep !== currentUserRole && b.currentStep === currentUserRole) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    sortedTasks.forEach(task => {
        const isMyTask = (task.currentStep === currentUserRole && task.status !== 'finished');
        const stepName = WORKFLOW_STEPS.find(s => s.id === task.currentStep).name;
        
        let statusBadge = '';
        let borderClass = 'border-gray-100';
        
        if (task.status === 'finished') {
            statusBadge = '<span class="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold">ปิดงานแล้ว</span>';
            borderClass = 'border-green-200';
        } else if (task.status === 'returned') {
            const returnHistory = [...task.history].reverse().find(h => h.status === 'returned' && h.note);
            const returnedFrom = returnHistory ? returnHistory.step : task.currentStep + 1;
            statusBadge = `<span class="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-bold">ถูกส่งคืนจากขั้น ${returnedFrom}</span>`;
            if (isMyTask) borderClass = 'border-red-300 shadow-md shadow-red-100';
        } else {
            if (isMyTask) {
                statusBadge = '<span class="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-bold animate-pulse">รอคุณดำเนินการ</span>';
                borderClass = 'border-blue-400 shadow-md shadow-blue-100';
            } else {
                statusBadge = '<span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full font-bold">รอตรวจสอบ</span>';
            }
        }

        const card = document.createElement('div');
        card.className = `bg-white p-5 rounded-2xl shadow-sm border-2 ${borderClass} cursor-pointer hover:shadow-md transition`;
        card.onclick = () => openTaskDetail(task.id);
        
        const dateStr = new Date(task.createdAt).toLocaleDateString('th-TH');
        
        // แสดงชื่อครูเจ้าของเรื่อง
        const ownerStr = task.history[0]?.owner ? ` • ของ: ${task.history[0].owner}` : '';

        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div class="text-sm text-gray-500 font-medium">${task.id} • ${dateStr}${ownerStr}</div>
                ${statusBadge}
            </div>
            <h3 class="text-xl font-bold text-gray-800 mb-3">${task.subject}</h3>
            <div class="flex items-center text-sm text-gray-600">
                <i class="fas fa-map-marker-alt text-blue-500 mr-2"></i> 
                อยู่ขั้นตอนที่ ${task.currentStep}: <span class="font-bold ml-1">${stepName}</span>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

// -------------------------------------------------------------
// ฟังก์ชัน Task Details & Timeline (ดูรายละเอียดและไทม์ไลน์)
// -------------------------------------------------------------
function openTaskDetail(taskId) {
    activeTaskId = taskId;
    const task = currentTasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('modalTaskId').textContent = task.id;
    document.getElementById('modalTaskSubject').textContent = task.subject;
    
    const dateStr = new Date(task.createdAt).toLocaleString('th-TH');
    document.getElementById('modalTaskDate').textContent = dateStr;

    renderTimeline(task);

    const actionArea = document.getElementById('actionArea');
    const finalActionArea = document.getElementById('finalActionArea');
    
    actionArea.classList.add('hidden');
    finalActionArea.classList.add('hidden');
    if(document.getElementById('actionNote')) document.getElementById('actionNote').value = '';

    const returnSelect = document.getElementById('returnStepSelect');
    const returnContainer = document.getElementById('returnStepContainer');
    if (returnSelect && returnContainer) {
        returnSelect.innerHTML = '';
        if (task.currentStep > 1) {
            for (let i = task.currentStep - 1; i >= 1; i--) {
                const stepInfo = WORKFLOW_STEPS.find(s => s.id === i);
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = `ส่งกลับไปขั้นที่ ${i}: ${stepInfo.name}`;
                returnSelect.appendChild(opt);
            }
            returnContainer.classList.remove('hidden');
        } else {
            returnContainer.classList.add('hidden');
        }
    }

    if (task.currentStep === currentUserRole && task.status !== 'finished') {
        if (currentUserRole === 7) {
            // ขั้นตอนที่ 7: จ่ายเช็ค (ขั้นตอนสุดท้าย)
            finalActionArea.classList.remove('hidden');
        } else {
            // ขั้นตอนที่ 1-6
            actionArea.classList.remove('hidden');
        }
    }

    document.getElementById('taskModal').classList.remove('hidden');
}

function renderTimeline(task) {
    const container = document.getElementById('timelineContainer');
    container.innerHTML = '';

    const currentStepContainer = document.createElement('div');
    currentStepContainer.className = 'mb-6';
    
    const fullTimelineContainer = document.createElement('div');
    fullTimelineContainer.className = 'hidden mt-6 pt-6 border-t border-gray-100';
    
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'w-full text-center text-blue-600 font-medium text-sm py-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition mt-2 flex items-center justify-center gap-2';
    toggleBtn.innerHTML = '<i class="fas fa-list-ul"></i> แสดงประวัติและขั้นตอนทั้งหมด';
    toggleBtn.onclick = () => {
        if (fullTimelineContainer.classList.contains('hidden')) {
            fullTimelineContainer.classList.remove('hidden');
            toggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i> ซ่อนประวัติและขั้นตอนทั้งหมด';
        } else {
            fullTimelineContainer.classList.add('hidden');
            toggleBtn.innerHTML = '<i class="fas fa-list-ul"></i> แสดงประวัติและขั้นตอนทั้งหมด';
        }
    };

    const timelineWrapper = document.createElement('div');
    timelineWrapper.className = 'timeline-container px-2'; 
    fullTimelineContainer.appendChild(timelineWrapper);

    WORKFLOW_STEPS.forEach((step) => {
        const historyEntries = task.history.filter(h => h.step === step.id);
        const lastEntry = historyEntries.length > 0 ? historyEntries[historyEntries.length - 1] : null;
        
        let statusClass = 'status-pending';
        let titleClass = 'text-gray-400';
        let detailHtml = '<p class="text-sm text-gray-400 mt-1">ยังไม่ถึงขั้นตอน</p>';

        if (step.id < task.currentStep) {
            statusClass = 'status-completed';
            titleClass = 'text-gray-800';
            const note = lastEntry?.note ? `<div class="bg-gray-50 p-2 rounded-lg mt-2 text-sm text-gray-600 border border-gray-100"><i class="fas fa-comment-alt text-gray-400 mr-1"></i> ${lastEntry.note}</div>` : '';
            detailHtml = `<p class="text-sm text-green-600 mt-1"><i class="fas fa-check-circle"></i> เสร็จสิ้นแล้ว</p>${note}`;
        
        } else if (step.id === task.currentStep) {
            if (task.status === 'returned') {
                statusClass = 'status-returned';
                titleClass = 'text-red-600 font-bold';
                // หาประวัติการส่งคืนล่าสุดที่มีการระบุเหตุผล
                const returnHistory = [...task.history].reverse().find(h => h.status === 'returned' && h.note);
                let noteHtml = '';
                if (returnHistory) {
                    const fromStepInfo = WORKFLOW_STEPS.find(s => s.id === returnHistory.step);
                    noteHtml = `<div class="bg-red-50 p-3 rounded-xl mt-2 text-sm text-red-700 border border-red-100 font-medium"><i class="fas fa-exclamation-triangle mr-1"></i> ถูกส่งคืนจากขั้นที่ ${returnHistory.step} (${fromStepInfo?.name})<br>เหตุผล: ${returnHistory.note}</div>`;
                }
                detailHtml = `<p class="text-sm text-red-500 mt-1"><i class="fas fa-times-circle"></i> ต้องแก้ไขงานใหม่</p>${noteHtml}`;
            } else if (task.status === 'finished') {
                statusClass = 'status-completed';
                titleClass = 'text-gray-800';
                detailHtml = `<p class="text-sm text-green-600 mt-1"><i class="fas fa-check-circle"></i> ปิดงานเรียบร้อย</p>`;
            } else {
                statusClass = 'status-current';
                titleClass = 'text-blue-600 font-bold';
                detailHtml = `<p class="text-sm text-blue-500 mt-1"><i class="fas fa-spinner fa-spin"></i> กำลังดำเนินการ</p>`;
            }
            
            let cardBg = 'bg-blue-50 border-blue-200';
            let iconClass = 'text-blue-500 fas fa-arrow-right';
            if (task.status === 'returned') {
                cardBg = 'bg-red-50 border-red-200';
                iconClass = 'text-red-500 fas fa-undo';
            } else if (task.status === 'finished') {
                cardBg = 'bg-green-50 border-green-200';
                iconClass = 'text-green-500 fas fa-check-circle';
            }
            
            const prominentCard = document.createElement('div');
            prominentCard.className = `p-5 rounded-2xl border-2 ${cardBg} shadow-sm`;
            prominentCard.innerHTML = `
                <div class="flex items-start gap-4">
                    <div class="w-12 h-12 shrink-0 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-100">
                        <i class="${iconClass} text-xl"></i>
                    </div>
                    <div class="flex-1">
                        <div class="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">ขั้นตอนปัจจุบัน</div>
                        <h4 class="text-xl ${titleClass} mb-1">${step.name}</h4>
                        ${detailHtml}
                    </div>
                </div>
            `;
            currentStepContainer.appendChild(prominentCard);
        }

        const item = document.createElement('div');
        item.className = `timeline-item ${statusClass}`;
        item.innerHTML = `
            <div class="timeline-dot"></div>
            <div class="ml-4">
                <h4 class="text-lg ${titleClass}">ขั้นตอนที่ ${step.id}: ${step.name}</h4>
                ${detailHtml}
            </div>
        `;
        timelineWrapper.appendChild(item);
    });

    container.appendChild(currentStepContainer);
    container.appendChild(toggleBtn);
    container.appendChild(fullTimelineContainer);
}

// -------------------------------------------------------------
// ฟังก์ชัน Action (อัปเดตสถานะ, สร้างงาน) - Optimistic UI
// -------------------------------------------------------------
async function updateTaskStatus(action) {
    const taskIndex = currentTasks.findIndex(t => t.id === activeTaskId);
    if (taskIndex === -1) return;
    
    const task = currentTasks[taskIndex]; 
    const note = document.getElementById('actionNote') ? document.getElementById('actionNote').value : '';
    const now = new Date().toISOString();

    if (action === 'completed') {
        task.history.push({ step: task.currentStep, status: 'completed', note: note, date: now });
        task.currentStep += 1;
        task.status = 'pending';
        task.history.push({ step: task.currentStep, status: 'pending', note: '', date: '' });
    } 
    else if (action === 'returned') {
        if (!note) {
            alert("กรุณาระบุเหตุผลในการส่งคืนงาน");
            return;
        }
        let previousStep = task.currentStep - 1;
        const returnSelect = document.getElementById('returnStepSelect');
        if (returnSelect && returnSelect.value) {
            previousStep = parseInt(returnSelect.value);
        }
        
        task.history.push({ step: task.currentStep, status: 'returned', note: note, date: now, returnedTo: previousStep });
        task.currentStep = previousStep;
        task.status = 'returned';
        task.history.push({ step: task.currentStep, status: 'returned', note: '', date: '' });
    }
    else if (action === 'finished') {
        task.history.push({ step: 7, status: 'completed', note: note, date: now });
        task.status = 'finished';
    }

    closeModal('taskModal');
    renderDashboard();
    renderTaskList();
    
    // บันทึกลงเครื่องทันที
    localStorage.setItem('tasksCache', JSON.stringify(currentTasks));
    
    showToast("กำลังบันทึกข้อมูล...");

    try {
        await fetch(GAS_API_URL, { 
            method: 'POST', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'updateTask', task: task }) 
        });
        showToast("บันทึกข้อมูลเรียบร้อย ✅", true);
    } catch (error) {
        alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณารีเฟรชหน้าเว็บ");
    }
}

async function createTask() {
    const subject = document.getElementById('newTaskSubject').value;
    if (!subject) {
        alert('กรุณาระบุชื่องาน');
        return;
    }

    const tempId = `T-00${currentTasks.length + 1}`;
    
    const newTask = {
        id: tempId,
        subject: subject,
        createdAt: new Date().toISOString(),
        currentStep: 2, 
        status: "pending",
        history: [
            { step: 1, status: "completed", note: "ขอดำเนินการ", date: new Date().toISOString(), owner: currentTeacherId },
            { step: 2, status: "pending", note: "", date: "" }
        ]
    };

    currentTasks.unshift(newTask);
    closeModal('newTaskModal');
    renderDashboard();
    renderTaskList();
    
    // บันทึกลงเครื่องทันที
    localStorage.setItem('tasksCache', JSON.stringify(currentTasks));
    
    showToast("กำลังสร้างงานใหม่...");

    try {
        const response = await fetch(GAS_API_URL, { 
            method: 'POST', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'createTask', task: newTask }) 
        });
        showToast("สร้างงานเรียบร้อย ✅", true);
    } catch (error) {
        alert("เกิดข้อผิดพลาดในการสร้างงาน กรุณารีเฟรชหน้าเว็บ");
    }
}

function showNewTaskModal() {
    document.getElementById('newTaskSubject').value = '';
    document.getElementById('newTaskModal').classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

let isMobileView = false;
function toggleDeviceView() {
    isMobileView = !isMobileView;
    const wrapper = document.getElementById('deviceWrapper');
    const btnIcon = document.querySelector('#btnDeviceToggle i');
    
    if (isMobileView) {
        wrapper.classList.add('max-w-md', 'border-x', 'border-gray-300');
        btnIcon.className = 'fas fa-desktop text-xl'; // เปลี่ยนไอคอนเป็นคอมพิวเตอร์
    } else {
        wrapper.classList.remove('max-w-md', 'border-x', 'border-gray-300');
        btnIcon.className = 'fas fa-mobile-alt text-xl'; // เปลี่ยนไอคอนเป็นมือถือ
    }
}

function showStatsModal() {
    const statsContent = document.getElementById('statsContent');
    document.getElementById('statsModal').classList.remove('hidden');
    
    const tasks = currentTasks;
    if (!tasks || tasks.length === 0) {
        statsContent.innerHTML = '<div class="text-center text-gray-500 py-10">ยังไม่มีข้อมูลในระบบ</div>';
        return;
    }
    
    const total = tasks.length;
    const finished = tasks.filter(t => t.status === 'finished').length;
    const pending = total - finished;
    
    // งานแต่ละขั้นตอน
    const stepsCount = {};
    WORKFLOW_STEPS.forEach(s => stepsCount[s.id] = 0);
    tasks.forEach(t => {
        if(t.status !== 'finished' && stepsCount[t.currentStep] !== undefined) {
            stepsCount[t.currentStep]++;
        }
    });
    
    // เวลาเฉลี่ย
    let totalDays = 0;
    let finishedTasksWithTime = 0;
    tasks.forEach(t => {
        if (t.status === 'finished' && t.history && t.history.length > 0) {
            const start = new Date(t.createdAt);
            // หาประวัติอันสุดท้ายที่มี date
            let endEntry = null;
            for (let i = t.history.length - 1; i >= 0; i--) {
                if (t.history[i].date) {
                    endEntry = t.history[i];
                    break;
                }
            }
            if (endEntry && endEntry.date) {
                const end = new Date(endEntry.date);
                const diffTime = Math.abs(end - start);
                let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                if (diffDays === 0) diffDays = 1; // นับขั้นต่ำ 1 วันถ้าเสร็จวันเดียวกัน
                totalDays += diffDays;
                finishedTasksWithTime++;
            }
        }
    });
    const avgDays = finishedTasksWithTime > 0 ? (totalDays / finishedTasksWithTime).toFixed(1) : 0;
    
    // คุณครู
    const teacherMap = {};
    tasks.forEach(t => {
        if (t.history && t.history[0] && t.history[0].owner) {
            const owner = t.history[0].owner;
            teacherMap[owner] = (teacherMap[owner] || 0) + 1;
        }
    });
    const teacherCount = Object.keys(teacherMap).length;
    
    // สร้าง HTML
    let stepHtml = '';
    WORKFLOW_STEPS.forEach(s => {
        stepHtml += `<div class="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
            <span class="text-gray-600">ขั้นที่ ${s.id} ${s.name}</span>
            <span class="font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">${stepsCount[s.id]} งาน</span>
        </div>`;
    });
    
    statsContent.innerHTML = `
        <div class="grid grid-cols-2 gap-4 mb-6">
            <div class="bg-blue-50 p-4 rounded-2xl text-center border border-blue-100">
                <div class="text-sm text-gray-500 mb-1">งานทั้งหมด</div>
                <div class="text-3xl font-bold text-blue-700">${total}</div>
            </div>
            <div class="bg-green-50 p-4 rounded-2xl text-center border border-green-100">
                <div class="text-sm text-gray-500 mb-1">สำเร็จแล้ว</div>
                <div class="text-3xl font-bold text-green-700">${finished}</div>
            </div>
            <div class="bg-yellow-50 p-4 rounded-2xl text-center border border-yellow-100">
                <div class="text-sm text-gray-500 mb-1">กำลังดำเนินการ</div>
                <div class="text-3xl font-bold text-yellow-700">${pending}</div>
            </div>
            <div class="bg-purple-50 p-4 rounded-2xl text-center border border-purple-100">
                <div class="text-sm text-gray-500 mb-1">เวลาเฉลี่ยจนสำเร็จ</div>
                <div class="text-3xl font-bold text-purple-700">${avgDays} <span class="text-base font-normal text-purple-500">วัน</span></div>
            </div>
        </div>
        
        <div class="mb-6 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <h3 class="text-lg font-bold text-gray-800 mb-3 border-b pb-2"><i class="fas fa-users text-gray-400 mr-2"></i>ข้อมูลผู้เสนองาน</h3>
            <div class="flex justify-between items-center py-2">
                <span class="text-gray-600">จำนวนคุณครูที่เสนองาน</span>
                <span class="font-bold text-gray-800">${teacherCount} ท่าน</span>
            </div>
        </div>
        
        <div class="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <h3 class="text-lg font-bold text-gray-800 mb-3 border-b pb-2"><i class="fas fa-tasks text-gray-400 mr-2"></i>งานที่ค้างในแต่ละขั้นตอน</h3>
            ${stepHtml}
        </div>
    `;
}

function showToast(message, autoHide = false) {
    let toast = document.getElementById('appToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'appToast';
        toast.className = 'fixed bottom-5 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-xl shadow-lg z-50 transition-opacity duration-300';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    
    if (autoHide) {
        setTimeout(() => { toast.style.opacity = '0'; }, 3000);
    }
}
