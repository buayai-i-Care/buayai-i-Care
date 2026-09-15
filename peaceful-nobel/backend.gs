/**
 * ระบบติดตามงานองค์กร (Backend)
 * นำโค้ดนี้ไปวางใน Google Apps Script (extensions > Apps Script ใน Google Sheets)
 * 
 * ชีตที่ต้องมีใน Google Sheets:
 * 1. "Tasks" (คอลัมน์: TaskID, Subject, CurrentStep, Status, CreatedAt, HistoryJSON)
 * 2. "Config" (คอลัมน์: RoleID, Password) สำหรับจัดการรหัสผ่านในอนาคตถ้าต้องการ
 */

const SHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const TASKS_SHEET_NAME = "Tasks";

// ฟังก์ชันหลักรับ HTTP GET (สำหรับการดึงข้อมูล)
function doGet(e) {
  const action = e.parameter.action;
  
  if (action === "getTasks") {
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      data: getTasksFromSheet()
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Action not found" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ฟังก์ชันหลักรับ HTTP POST (สำหรับการเพิ่ม/อัปเดตข้อมูล)
// เพื่อไม่ให้ติดข้อจำกัด 6 นาที เราจะทำทีละ Transaction
function doPost(e) {
  const postData = JSON.parse(e.postData.contents);
  const action = postData.action;
  
  try {
    if (action === "updateTask") {
      const result = updateTaskInSheet(postData.task);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", result: result }))
        .setMimeType(ContentService.MimeType.JSON);
        
    } else if (action === "createTask") {
      const result = createTaskInSheet(postData.task);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", result: result }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ---------------------------------------------------------
// Helper Functions: จัดการข้อมูลใน Google Sheets
// ---------------------------------------------------------

function getTasksFromSheet() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TASKS_SHEET_NAME);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // ไม่มีข้อมูล (มีแต่ Header)
  
  const tasks = [];
  // สมมติ Header: [TaskID, Subject, CurrentStep, Status, CreatedAt, HistoryJSON]
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    tasks.push({
      id: row[0],
      subject: row[1],
      currentStep: parseInt(row[2]),
      status: row[3],
      createdAt: row[4],
      history: row[5] ? JSON.parse(row[5]) : [] // เก็บ history เป็น JSON string เพื่อประหยัดพื้นที่
    });
  }
  
  return tasks;
}

function updateTaskInSheet(taskData) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TASKS_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === taskData.id) {
      // อัปเดตข้อมูลในแถวที่พบ
      const rowIndex = i + 1;
      sheet.getRange(rowIndex, 3).setValue(taskData.currentStep);
      sheet.getRange(rowIndex, 4).setValue(taskData.status);
      sheet.getRange(rowIndex, 6).setValue(JSON.stringify(taskData.history));
      return "Updated row " + rowIndex;
    }
  }
  throw new Error("Task ID not found");
}

function createTaskInSheet(taskData) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TASKS_SHEET_NAME);
  
  // สร้าง ID อัตโนมัติ (T-001)
  const lastRow = sheet.getLastRow();
  const nextIdNum = lastRow > 1 ? parseInt(sheet.getRange(lastRow, 1).getValue().replace('T-', '')) + 1 : 1;
  const newId = "T-" + ("000" + nextIdNum).slice(-3);
  
  sheet.appendRow([
    newId,
    taskData.subject,
    taskData.currentStep,
    taskData.status,
    taskData.createdAt,
    JSON.stringify(taskData.history)
  ]);
  
  return "Created " + newId;
}

// ---------------------------------------------------------
// ฟังก์ชันนี้จะถูกตั้งเวลา (Trigger) ให้รันทุกสิ้นเดือน/สิ้นปี 
// เพื่อย้ายข้อมูลที่ปิดงานแล้วเกินกำหนดไปชีต Archive (ป้องกันชีตบวม)
// ---------------------------------------------------------
function archiveOldTasks() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const mainSheet = ss.getSheetByName(TASKS_SHEET_NAME);
  let archiveSheet = ss.getSheetByName("Archive");
  
  if (!archiveSheet) {
    archiveSheet = ss.insertSheet("Archive");
    // ก๊อปปี้ Header
    const headers = mainSheet.getRange(1, 1, 1, mainSheet.getLastColumn()).getValues();
    archiveSheet.appendRow(headers[0]);
  }
  
  const data = mainSheet.getDataRange().getValues();
  const rowsToDelete = [];
  
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    const status = row[3];
    
    // ถ้าปิดงานแล้ว (finished) ให้ย้ายไป Archive
    if (status === "finished") {
      archiveSheet.appendRow(row);
      rowsToDelete.push(i + 1); // เก็บเลขแถวไว้ลบ (1-indexed)
    }
  }
  
  // ลบแถวในหน้าหลัก (ลบจากล่างขึ้นบน เพื่อไม่ให้ index เลื่อน)
  rowsToDelete.forEach(rowIndex => {
    mainSheet.deleteRow(rowIndex);
  });
}
