
/*
 * PANDUAN UPDATE BACKEND (GOOGLE SHEETS):
 * 
 * 1. Buka project Apps Script Anda.
 * 2. Ganti SEMUA kode dengan kode di bawah ini.
 * 3. Klik Save.
 * 4. PENTING: Klik RUN pada fungsi 'setup' sekali lagi untuk update struktur sheet (Menambah kolom Juz).
 * 5. Klik Deploy > Manage Deployments > Edit (Pensil) > Version: New Version > Deploy.
 */

// --- KODE UTAMA ---

function setup() {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Sheet Users
  var userHeaders = ['id', 'name', 'role', 'username', 'password', 'phoneNumber', 'childId', 'email', 'avatar'];
  createSheetIfNeeded(doc, 'Users', userHeaders);
  
  // 2. Sheet Students
  var studentHeaders = ['id', 'name', 'nis', 'class', 'halaqah', 'teacherId', 'totalJuz', 'username', 'password'];
  createSheetIfNeeded(doc, 'Students', studentHeaders);
  
  // 3. Lainnya
  createSheetIfNeeded(doc, 'Records', ['id', 'studentId', 'date', 'type', 'surah', 'ayahStart', 'ayahEnd', 'grade', 'notes']);
  createSheetIfNeeded(doc, 'Attendance', ['id', 'userId', 'date', 'session', 'status', 'approvalStatus', 'type']);
  
  // 4. Exams (UPDATE: Added 'juz' at the end to avoid breaking existing column order)
  createSheetIfNeeded(doc, 'Exams', ['id', 'studentId', 'date', 'category', 'score', 'examiner', 'status', 'notes', 'juz']);
  
  // Tambah Dummy Data jika kosong
  var userSheet = doc.getSheetByName('Users');
  if (userSheet.getLastRow() === 1) {
     userSheet.appendRow(['u1', 'Super Admin', 'admin', "'admin", "'123", "'6281234567890", "", "", ""]);
  }
}

function createSheetIfNeeded(doc, sheetName, headers) {
  var sheet = doc.getSheetByName(sheetName);
  if (!sheet) {
    sheet = doc.insertSheet(sheetName);
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#dcfce7");
    sheet.setFrozenRows(1);
  } else {
    // Cek jika header kurang (misal nambah kolom baru)
    var currentCols = sheet.getLastColumn();
    if (currentCols < headers.length) {
       // Loop untuk menambahkan header yang belum ada
       for (var i = currentCols; i < headers.length; i++) {
          sheet.getRange(1, i + 1).setValue(headers[i]);
          sheet.getRange(1, i + 1).setFontWeight("bold");
          sheet.getRange(1, i + 1).setBackground("#dcfce7");
       }
    }
  }
  return sheet;
}

// --- FUNGSI BACA DATA (GET) ---
function doGet(e) {
  var lock = LockService.getScriptLock();
  try {
      lock.waitLock(10000); 
  } catch(e) {
      console.log("Read lock timeout, proceeding anyway");
  }

  var doc = SpreadsheetApp.getActiveSpreadsheet();
  
  var data = {
    users: getSheetData(doc, 'Users'),
    students: getSheetData(doc, 'Students'),
    records: getSheetData(doc, 'Records'),
    attendance: getSheetData(doc, 'Attendance'),
    exams: getSheetData(doc, 'Exams')
  };
  
  lock.releaseLock();
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function getSheetData(doc, sheetName) {
  var sheet = doc.getSheetByName(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var result = [];
  
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var key = headers[j];
      var value = row[j];
      
      if (value instanceof Date) {
         value = Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
      }
      if (key === 'ayahStart' || key === 'ayahEnd' || key === 'totalJuz' || key === 'score') {
          value = Number(value) || 0;
      }
      if (typeof value === 'string' && value.startsWith("'")) {
          value = value.substring(1);
      }
      
      obj[key] = value;
    }
    result.push(obj);
  }
  return result;
}

// --- FUNGSI TULIS DATA (POST) ---
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
      lock.tryLock(50000); 
  } catch (e) {
      return ContentService.createTextOutput(JSON.stringify({result: 'error', error: 'Server Busy (Lock Timeout)'})).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var jsonData = JSON.parse(e.postData.contents);
    var action = jsonData.action;
    var data = jsonData.data;
    var result = "success";

    if (action == 'addUser') {
      doc.getSheetByName('Users').appendRow([
        data.id, data.name, data.role, "'" + data.username, "'" + data.password, "'" + data.phoneNumber, data.childId || '', data.email || '', ''
      ]);
    } 
    else if (action == 'addStudent') {
      doc.getSheetByName('Students').appendRow([
        data.id, data.name, "'" + data.nis, data.class, data.halaqah, data.teacherId, 0, "'" + (data.username || data.nis), "'" + data.password
      ]);
    } 
    else if (action == 'addRecord') {
      doc.getSheetByName('Records').appendRow([data.id, data.studentId, data.date, data.type, data.surah, data.ayahStart, data.ayahEnd, data.grade, data.notes || '']);
    }
    else if (action == 'markAttendance') {
      doc.getSheetByName('Attendance').appendRow([data.id, data.userId, data.date, data.session, data.status, data.approvalStatus || '', data.type]);
    }
    else if (action == 'addExam') {
      // Extract JUZ info. It might come from details.juz or directly juz
      var juzInfo = (data.details && data.details.juz) ? data.details.juz : (data.juz || '-');
      
      doc.getSheetByName('Exams').appendRow([
        data.id, 
        data.studentId, 
        data.date, 
        data.category, 
        data.score, 
        data.examiner, 
        data.status, 
        data.notes,
        juzInfo // Save Juz in the new column
      ]);
    }

    else if (action == 'updateUser') {
      var sheetName = (data.role === 'student' || data.role === 'parent' && data.childId === data.id) ? 'Students' : 'Users';
      var sheet = doc.getSheetByName(sheetName);
      var values = sheet.getDataRange().getValues();
      
      var newAvatarUrl = data.avatar;
      if (data.avatar && data.avatar.toString().indexOf('data:image') === 0) {
          newAvatarUrl = uploadToDrive(data.avatar, "avatar_" + data.id + "_" + new Date().getTime());
      }
      
      for (var i = 1; i < values.length; i++) {
        if (values[i][0] == data.id) {
           var rowIdx = i + 1;
           if (sheetName === 'Users') {
              sheet.getRange(rowIdx, 2).setValue(data.name);
              sheet.getRange(rowIdx, 4).setValue("'" + data.username);
              sheet.getRange(rowIdx, 5).setValue("'" + data.password);
              sheet.getRange(rowIdx, 6).setValue("'" + data.phoneNumber);
              if (sheet.getLastColumn() >= 8) sheet.getRange(rowIdx, 8).setValue(data.email || '');
              if (sheet.getLastColumn() >= 9) sheet.getRange(rowIdx, 9).setValue(newAvatarUrl || '');
           } else {
              sheet.getRange(rowIdx, 2).setValue(data.name);
              sheet.getRange(rowIdx, 8).setValue("'" + data.username);
              sheet.getRange(rowIdx, 9).setValue("'" + data.password);
           }
           break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({result: result, avatarUrl: newAvatarUrl})).setMimeType(ContentService.MimeType.JSON);
    }
    
    else if (action == 'deleteData') {
       var sheet = doc.getSheetByName(data.sheetName);
       var values = sheet.getDataRange().getValues();
       for (var i = 1; i < values.length; i++) {
         if (values[i][0] == data.id) {
           sheet.deleteRow(i + 1);
           break;
         }
       }
    }

    return ContentService.createTextOutput(JSON.stringify({result: result})).setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({result: 'error', error: e.toString()})).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function uploadToDrive(base64Data, fileName) {
  try {
    var folderName = "SITA_PHOTOS";
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    
    var splitBase = base64Data.split(',');
    var type = splitBase[0].split(';')[0].replace('data:', '');
    var byteCharacters = Utilities.base64Decode(splitBase[1]);
    var blob = Utilities.newBlob(byteCharacters, type, fileName);
    
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
    return "https://drive.google.com/uc?export=view&id=" + file.getId();
  } catch (e) {
    return "";
  }
}
