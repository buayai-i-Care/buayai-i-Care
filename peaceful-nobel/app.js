// -------------------------------------------------------------
// การตั้งค่าทั่วไป (Configuration)
// -------------------------------------------------------------
// รหัสผ่านกลางสำหรับแต่ละแผนก (เพื่อความเรียบง่าย ใช้รหัสเดียวกันหมดตามที่ระบุ)
const ROLES = {
    "1": { name: "ตัดงบ", password: "123" },
    "2": { name: "ร่าง 14 แผ่น", password: "123" },
    "3": { name: "จัดซื้อจัดจ้าง", password: "123" },
    "4": { name: "เสนอรองผู้อำนวยการ", password: "123" },
    "5": { name: "ฝ่ายการเงิน", password: "123" },
    "6": { name: "จ่ายเช็ค", password: "123" }
};

const WORKFLOW_STEPS = [
    { id: 1, name: "ตัดงบ" },
    { id: 2, name: "ร่าง 14 แผ่น" },
    { id: 3, name: "จัดซื้อจัดจ้าง" },
    { id: 4, name: "เสนอรองผู้อำนวยการ" },
    { id: 5, name: "ฝ่ายการเงิน" },
    { id: 6, name: "จ่ายเช็ค" }
];

// ตัวแปรเก็บสถานะการเข้าสู่ระบบ
let currentUserRole = null;
let currentTasks = []; 
let activeTaskId = null;

// ข้อมูลจำลอง (Mock Data) สำหรับทดสอบ UI ก่อนเชื่อมต่อ GAS
const MOCK_TASKS = [
    {
        id: "T-001",
        subject: "โครงการจัดซื้อคอมพิวเตอร์สำนักงาน",
        createdAt: "2026-09-15T09:00:00",
        currentStep: 3, 
        status: "pending", // pending, returned, finished
        history: [
            { step: 1, status: "completed", note: "ตรวจสอบงบประมาณเรียบร้อย", date: "2026-09-15T09:15:00" },
            { step: 2, status: "completed", note: "ร่างเอกสารผ่าน", date: "2026-09-15T10:30:00" },
            { step: 3, status: "pending", note: "", date: "" }
        ]
    },
    {
        id: "T-002",
        subject: "โครงการปรับปรุงภูมิทัศน์",
        createdAt: "2026-09-14T14:00:00",
        currentStep: 2,
        status: "returned",
        history: [
            { step: 1, status: "completed", note: "ตัดงบเรียบร้อย", date: "2026-09-14T14:30:00" },
            { step: 2, status: "completed", note: "ส่งร่าง", date: "2026-09-14T15:00:00" },
            { step: 3, status: "returned", note: "เอกสารไม่ครบ ขาดใบเสนอราคา", date: "2026-09-15T08:30:00" },
            { step: 2, status: "returned", note: "", date: "" } // กลับมาที่สเตป 2
        ]
    },
    {
        id: "T-003",
        subject: "เบิกจ่ายค่าเดินทาง",
        createdAt: "2026-09-13T10:00:00",
        currentStep: 6,
        status: "pending",
        history: [
            { step: 1, status: "completed", note: "", date: "2026-09-13T10:30:00" },
            { step: 2, status: "completed", note: "", date: "2026-09-13T11:00:00" },
            { step: 3, status: "completed", note: "", date: "2026-09-13T13:00:00" },
            { step: 4, status: "completed", note: "อนุมัติ", date: "2026-09-14T09:00:00" },
            { step: 5, status: "completed", note: "ตรวจสอบเอกสารการเงินผ่าน", date: "2026-09-14T14:00:00" },
            { step: 6, status: "pending", note: "", date: "" }
        ]
    }
];

// -------------------------------------------------------------
// ฟังก์ชัน Authentication (เข้าสู่ระบบ)
// -------------------------------------------------------------
function login() {
    const roleId = document.getElementById('roleSelect').value;
    const password = document.getElementById('passwordInput').value;
    const errorMsg = document.getElementById('loginError');

    if (!roleId || !password) {
        errorMsg.textContent = "กรุณาเลือกแผนกและกรอกรหัสผ่าน";
        errorMsg.classList.remove('hidden');
        return;
    }

    if (ROLES[roleId].password === password) {
        // เข้าสู่ระบบสำเร็จ
        currentUserRole = parseInt(roleId);
        errorMsg.classList.add('hidden');
        
        // อัปเดต UI
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('appScreen').classList.remove('hidden');
        document.getElementById('userRoleDisplay').innerHTML = `<i class="fas fa-user-circle mr-1"></i> แผนก: ${ROLES[roleId].name}`;
        
        // ถ้าเป็นแผนก 1 (ตัดงบ) ให้แสดงปุ่มสร้างงาน
        if (currentUserRole === 1) {
            document.getElementById('btnCreateTask').classList.remove('hidden');
        } else {
            document.getElementById('btnCreateTask').classList.add('hidden');
        }

        // โหลดข้อมูล Dashboard และรายการงาน
        loadData();
    } else {
        errorMsg.textContent = "รหัสผ่านไม่ถูกต้อง";
        errorMsg.classList.remove('hidden');
    }
}

function logout() {
    currentUserRole = null;
    document.getElementById('passwordInput').value = '';
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('appScreen').classList.add('hidden');
}

const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxlaVCmbjHhlXfxvboRFhxnqY8f5xCDKGpmpBC_Cvn9TYKKDIqnhLfBMAokbO8unHTR/exec";

// -------------------------------------------------------------
// ฟังก์ชัน Data & UI Rendering (โหลดข้อมูลและแสดงผล)
// -------------------------------------------------------------
async function loadData() {
    // แสดงสถานะกำลังโหลด
    document.getElementById('taskList').innerHTML = '<div class="text-center p-10 text-gray-500"><i class="fas fa-spinner fa-spin text-2xl mb-2"></i><br>กำลังโหลดข้อมูล...</div>';
    
    try {
        const response = await fetch(GAS_API_URL + "?action=getTasks");
        const result = await response.json();
        
        if (result.status === "success") {
            currentTasks = result.data || [];
            renderDashboard();
            renderTaskList();
        } else {
            console.error("Error fetching tasks:", result.message);
            document.getElementById('taskList').innerHTML = '<div class="text-center p-10 text-red-500">เกิดข้อผิดพลาดในการดึงข้อมูล</div>';
        }
    } catch (error) {
        console.error("Fetch error:", error);
        document.getElementById('taskList').innerHTML = '<div class="text-center p-10 text-red-500">ไม่สามารถเชื่อมต่อฐานข้อมูลได้</div>';
    }
}

function renderDashboard() {
    let myCount = 0;
    
    currentTasks.forEach(task => {
        if (task.currentStep === currentUserRole && task.status !== 'finished') {
            myCount++;
        }
    });

    document.getElementById('myTaskCount').textContent = myCount;
    document.getElementById('totalTaskCount').textContent = currentTasks.length;
}

function renderTaskList() {
    const listContainer = document.getElementById('taskList');
    listContainer.innerHTML = '';

    if (currentTasks.length === 0) {
        listContainer.innerHTML = '<div class="text-center p-10 text-gray-400">ไม่มีงานในระบบ</div>';
        return;
    }

    // เรียงงาน: งานที่อยู่แผนกตัวเองขึ้นก่อน แล้วตามด้วยงานอื่นๆ
    const sortedTasks = [...currentTasks].sort((a, b) => {
        if (a.currentStep === currentUserRole && b.currentStep !== currentUserRole) return -1;
        if (a.currentStep !== currentUserRole && b.currentStep === currentUserRole) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt); // ใหม่สุดขึ้นก่อน
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
            statusBadge = `<span class="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-bold">ถูกส่งคืนจากขั้น ${task.currentStep + 1}</span>`;
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

        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div class="text-sm text-gray-500 font-medium">${task.id} • ${dateStr}</div>
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

    // Show/Hide Action Buttons
    const actionArea = document.getElementById('actionArea');
    const finalActionArea = document.getElementById('finalActionArea');
    
    actionArea.classList.add('hidden');
    finalActionArea.classList.add('hidden');
    document.getElementById('actionNote').value = '';

    if (task.currentStep === currentUserRole && task.status !== 'finished') {
        if (currentUserRole === 6) {
            // ขั้นตอนที่ 6: จ่ายเช็ค (ขั้นตอนสุดท้าย)
            finalActionArea.classList.remove('hidden');
        } else {
            // ขั้นตอนที่ 1-5
            actionArea.classList.remove('hidden');
        }
    }

    document.getElementById('taskModal').classList.remove('hidden');
}

function renderTimeline(task) {
    const container = document.getElementById('timelineContainer');
    container.innerHTML = '';

    WORKFLOW_STEPS.forEach((step, index) => {
        // หาข้อมูลประวัติของขั้นตอนนี้
        const historyEntries = task.history.filter(h => h.step === step.id);
        const lastEntry = historyEntries.length > 0 ? historyEntries[historyEntries.length - 1] : null;
        
        let statusClass = 'status-pending';
        let titleClass = 'text-gray-400';
        let detailHtml = '<p class="text-sm text-gray-400 mt-1">ยังไม่ถึงขั้นตอน</p>';

        if (step.id < task.currentStep) {
            // ผ่านมาแล้ว
            statusClass = 'status-completed';
            titleClass = 'text-gray-800';
            const note = lastEntry?.note ? `<div class="bg-gray-50 p-2 rounded-lg mt-2 text-sm text-gray-600 border border-gray-100"><i class="fas fa-comment-alt text-gray-400 mr-1"></i> ${lastEntry.note}</div>` : '';
            detailHtml = `<p class="text-sm text-green-600 mt-1"><i class="fas fa-check-circle"></i> เสร็จสิ้นแล้ว</p>${note}`;
        
        } else if (step.id === task.currentStep) {
            // อยู่ที่ขั้นตอนนี้
            if (task.status === 'returned') {
                statusClass = 'status-returned';
                titleClass = 'text-red-600 font-bold';
                const note = lastEntry?.note ? `<div class="bg-red-50 p-3 rounded-xl mt-2 text-sm text-red-700 border border-red-100 font-medium"><i class="fas fa-exclamation-triangle mr-1"></i> เหตุผลที่ส่งคืน: ${lastEntry.note}</div>` : '';
                detailHtml = `<p class="text-sm text-red-500 mt-1"><i class="fas fa-times-circle"></i> ถูกส่งคืนแก้ไข</p>${note}`;
            } else if (task.status === 'finished') {
                statusClass = 'status-completed';
                titleClass = 'text-gray-800';
                detailHtml = `<p class="text-sm text-green-600 mt-1"><i class="fas fa-check-circle"></i> ปิดงานเรียบร้อย</p>`;
            } else {
                statusClass = 'status-current';
                titleClass = 'text-blue-600 font-bold';
                detailHtml = `<p class="text-sm text-blue-500 mt-1"><i class="fas fa-spinner fa-spin"></i> กำลังดำเนินการ</p>`;
            }
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
        container.appendChild(item);
    });
}

// -------------------------------------------------------------
// ฟังก์ชัน Action (อัปเดตสถานะ, สร้างงาน)
// -------------------------------------------------------------
async function updateTaskStatus(action) {
    const taskIndex = currentTasks.findIndex(t => t.id === activeTaskId);
    if (taskIndex === -1) return;
    
    // โคลนออบเจ็กต์เพื่อไม่ให้กระทบ state ก่อนอัปเดตสำเร็จ
    const task = JSON.parse(JSON.stringify(currentTasks[taskIndex])); 
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
        const previousStep = task.currentStep - 1;
        task.history.push({ step: task.currentStep, status: 'returned', note: note, date: now });
        task.currentStep = previousStep;
        task.status = 'returned';
        task.history.push({ step: task.currentStep, status: 'returned', note: '', date: '' });
    }
    else if (action === 'finished') {
        task.history.push({ step: 6, status: 'completed', note: note, date: now });
        task.status = 'finished';
    }

    // เรียก GAS API อัปเดตข้อมูล
    try {
        // ปิด modal ชั่วคราว และขึ้นโหลด
        closeModal('taskModal');
        document.getElementById('taskList').innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-2xl"></i> กำลังบันทึกข้อมูล...</div>';
        
        await fetch(GAS_API_URL, { 
            method: 'POST', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'updateTask', task: task }) 
        });
        
        // รีเฟรชข้อมูลจากเซิร์ฟเวอร์
        await loadData();
    } catch (error) {
        console.error(error);
        alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
        await loadData(); // โหลดใหม่ถ้าพัง
    }
}

async function createTask() {
    const subject = document.getElementById('newTaskSubject').value;
    if (!subject) {
        alert('กรุณาระบุชื่องาน');
        return;
    }

    const newTask = {
        // id จะถูกสร้างฝั่งเซิร์ฟเวอร์ (GAS) 
        subject: subject,
        createdAt: new Date().toISOString(),
        currentStep: 1, 
        status: "pending",
        history: [
            { step: 1, status: "pending", note: "", date: "" }
        ]
    };

    closeModal('newTaskModal');
    document.getElementById('taskList').innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-2xl"></i> กำลังสร้างงานใหม่...</div>';

    try {
        await fetch(GAS_API_URL, { 
            method: 'POST', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'createTask', task: newTask }) 
        });
        await loadData();
    } catch (error) {
        console.error(error);
        alert("เกิดข้อผิดพลาดในการสร้างงาน");
        await loadData();
    }
}

function showNewTaskModal() {
    document.getElementById('newTaskSubject').value = '';
    document.getElementById('newTaskModal').classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}
