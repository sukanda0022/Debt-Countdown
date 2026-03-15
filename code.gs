const SHEET_NAME = "สมุดบันทึกการจ่ายหนี้"; 

function doGet(e) {
  const action = e.parameter.action;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  
  // ตรวจสอบว่าชื่อ Sheet ถูกต้องไหม
  if (!sheet) return ContentService.createTextOutput("Error: Sheet not found").setMimeType(ContentService.MimeType.TEXT);
  
  const data = sheet.getDataRange().getValues();
  
  if (action === "getSummary") {
    // 1. ดึงข้อมูลประวัติ และต้องเก็บเลขแถว (Real Row Number) ไว้สำหรับ ลบ/แก้ไข
    const history = data.slice(1)
      .map((row, index) => ({
        row: index + 2, // แถวจริงใน Google Sheets (เริ่มที่ 2)
        date: row[0] ? Utilities.formatDate(new Date(row[0]), "GMT+7", "dd/MM/yy") : "",
        name: row[1],
        initial: row[2] || 0,
        paid: row[3] || 0,
        source: row[5]
      }))
      .filter(item => item.date !== "") // กรองเอาเฉพาะแถวที่มีวันที่
      .reverse(); // เรียงจากใหม่ไปเก่าเพื่อแสดงในแอป

    // 2. คำนวณยอดรวมทั้งหมด (คิดจากทุกแถวในชีท)
    let totalInitial = 0;
    let totalPaid = 0;
    
    // ใช้เทคนิคดึงเฉพาะยอดเริ่มต้นล่าสุดของแต่ละ "ชื่อหนี้" เพื่อไม่ให้ยอดรวมซ้ำซ้อน
    const latestDebtMap = {};
    data.slice(1).forEach(row => {
      if (row[1]) { // ถ้ามีชื่อหนี้
        latestDebtMap[row[1]] = Number(row[2] || 0); // เก็บยอดเริ่มต้นล่าสุดของชื่อนั้นๆ
        totalPaid += Number(row[3] || 0);
      }
    });
    
    for (let key in latestDebtMap) {
      totalInitial += latestDebtMap[key];
    }

    return ContentService.createTextOutput(JSON.stringify({
      history: history,
      totalInitial: totalInitial,
      totalPaid: totalPaid
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const res = JSON.parse(e.postData.contents);
  
  if (res.action === "insert") {
    // เพิ่มข้อมูลเรียงตามคอลัมน์ A-F (วันที่, รายการ, ยอดเต็ม, จ่ายแล้ว, หมวดหมู่(ว่าง), ช่องทาง)
    sheet.appendRow([new Date(res.date), res.name, res.initial, res.paid, "", res.source]);
    return ContentService.createTextOutput("Success");
  }
  
 if (res.action === "update") {
    // อัปเดตคอลัมน์ A (วันที่), B (ชื่อ), C (ยอดเต็ม), D (ยอดจ่าย)
    const range = sheet.getRange(res.row, 1, 1, 4); 
    range.setValues([[new Date(res.date), res.name, res.initial, res.paid]]);
    return ContentService.createTextOutput("Updated");
  }
  
  if (res.action === "delete") {
    // ลบแถวตามเลขแถวที่ถูกต้อง
    sheet.deleteRow(res.row);
    return ContentService.createTextOutput("Deleted");
  }
}