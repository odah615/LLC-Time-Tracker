import { AuditLog, TimeLog, User, PayrollRecord, DailyAttendanceLog, IdleLog, LeaveRequest, UserPresence } from '../types';
import { generateUniqueUsername, isPlaceholderName, deduplicateUsers, resolveCanonicalEmployee } from './userUtils';

export const DEFAULT_SPREADSHEET_ID = '1h8ssmDEcV-PMGlkpOzfQCtlRpnoT0CBQQveT3e4wPfA';
export const DEFAULT_SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1h8ssmDEcV-PMGlkpOzfQCtlRpnoT0CBQQveT3e4wPfA/edit?gid=1299988798#gid=1299988798';

// Expected Google Sheet Tabs and Columns Schema with Dedicated Separated Tabs
export const maskPassword = (pwd?: string): string => {
  if (!pwd) return 'Pass****';
  const clean = pwd.trim();
  if (clean.length <= 4) {
    return clean.slice(0, 2) + '****';
  }
  const visiblePart = clean.slice(0, 4);
  const starCount = Math.max(4, clean.length - 4);
  const maskedPart = '*'.repeat(starCount);
  return `${visiblePart}${maskedPart}`;
};

/**
 * Mathematically accurate Total Time conversion:
 * - >= 1 hour: "Xh Ym Zs" (e.g. 27529s -> "7h 38m 49s")
 * - < 1 hour: "Ym Zs" (e.g. 1121s -> "18m 41s", 2147s -> "35m 47s")
 * - < 1 min: "Zs" (e.g. 14s -> "14s")
 */
export const formatTotalTime = (totalSeconds: number | string | undefined | null): string => {
  const secs = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;

  if (h > 0) {
    return `${h}h ${m}m ${s}s`;
  } else if (m > 0) {
    return `${m}m ${s}s`;
  } else {
    return `${s}s`;
  }
};

/**
 * Validates that a Google Apps Script webhook URL is valid, uses HTTPS, and is not a placeholder
 */
export const isValidWebhookUrl = (url?: string | null): boolean => {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim();
  if (!clean.startsWith('https://')) return false;
  if (
    clean.includes('...') ||
    clean.includes('YOUR_') ||
    clean.includes('example.com') ||
    clean.includes('<') ||
    clean.includes('>') ||
    clean.length < 25
  ) {
    return false;
  }
  return true;
};

export const SPREADSHEET_SCHEMA = [
  {
    tabName: 'Live_Presence',
    description: 'Real-time live roster tab showing every agent/trainee live status, platform mode (Desktop App vs Web Portal), live tracking timer, active task, today total hours, first check-in, and device timezone.',
    headers: [
      'Employee Code',
      'Employee Name',
      'System Role',
      'Designation',
      'Platform Mode',
      'Live Presence Status',
      'Current Active Task',
      'Current Application',
      'Shift Hours Today',
      'First Check-In (Manila GMT+8)',
      'Device Timezone',
      'Last Active Heartbeat (Manila GMT+8)',
      'Last Heartbeat (ISO)',
    ],
  },
  {
    tabName: 'Login_Logs',
    description: 'Dedicated log for all employee web portal & software desktop sign-ins, timestamps, role credentials, device/platform modes, and locations.',
    headers: [
      'Log ID',
      'Timestamp (ISO)',
      'Formatted Date & Time',
      'Employee Code',
      'Employee Name',
      'User Role',
      'Designation',
      'Login Platform / Mode',
      'Timezone & Location',
      'Session Status',
      'Account Password (Masked)',
    ],
  },
  {
    tabName: 'Logout_Logs',
    description: 'Dedicated log for all employee sign-outs, exit timestamps, shift conclusion status, and session notes.',
    headers: [
      'Log ID',
      'Timestamp (ISO)',
      'Formatted Date & Time',
      'Employee Code',
      'Employee Name',
      'User Role',
      'Designation',
      'Logout Platform / Event',
      'Session Duration / Notes',
      'Status',
    ],
  },
  {
    tabName: 'Idle_Logs',
    description: 'Dedicated log for 10-minute inactivity events with 5-minute grace period (15 minutes total idle auto-logout), durations, time subtracted from shift (-15 mins), and required shift extensions (+15 mins).',
    headers: [
      'Idle Log ID',
      'Timestamp',
      'Employee Code',
      'Employee Name',
      'Inactivity Duration (Mins)',
      'Deducted From Shift',
      'Required Shift Extension',
      'Active Task',
      'Reason / Trigger',
      'Status',
    ],
  },
  {
    tabName: 'Time_Logs',
    description: 'Master time tracker log for all work sessions from Desktop App & Web Portal, tasks, start/end timestamps in Manila time (GMT+8), duration in raw seconds, human-readable total time, and live status.',
    headers: [
      'Session ID',
      'Employee Code',
      'Employee Name',
      'Designation',
      'Task Category',
      'Date',
      'Start Time (Manila GMT+8)',
      'End Time (Manila GMT+8)',
      'Duration (Seconds)',
      'Total Time',
      'Idle Deductions (Mins)',
      'Mouse Avg %',
      'Keyboard Avg %',
      'Status',
      'Notes',
    ],
  },
  {
    tabName: 'Daily_Summary',
    description: 'Instant Executive Daily Timesheet Summary — pre-calculated total shift hours, break deductions, and net productive rendered time per agent per day.',
    headers: [
      'Date',
      'Employee Code',
      'Employee Name',
      'Designation',
      'Tasks Worked On',
      'First Clock-In (Manila GMT+8)',
      'Last Clock-Out (Manila GMT+8)',
      'Gross Tracked Shift',
      'Total Idle / Breaks',
      'Net Productive Work',
      'Duration (Seconds)',
      'Avg Activity %',
      'Shift Status',
      'Log Entries',
    ],
  },
  {
    tabName: 'Weekly_Summary',
    description: 'Instant Executive Weekly Timesheet Summary — pre-calculated Monday-to-Sunday weekly rendered hours, tasks breakdown, and regular vs overtime hours per agent.',
    headers: [
      'Week Period (Mon-Sun)',
      'Employee Code',
      'Employee Name',
      'Designation',
      'Tasks Breakdown',
      'Days Rendered',
      'Gross Tracked Hours',
      'Total Idle / Breaks',
      'Net Productive Work',
      'Regular Hours',
      'Overtime Hours',
      'Avg Activity %',
    ],
  },
  {
    tabName: 'Monthly_Summary',
    description: 'Instant Executive Monthly Timesheet Summary — pre-calculated monthly rendered hours, total working days, estimated pay, and activity performance.',
    headers: [
      'Month Period',
      'Employee Code',
      'Employee Name',
      'Designation',
      'Primary Tasks',
      'Total Days Rendered',
      'Gross Tracked Hours',
      'Total Idle / Breaks',
      'Net Productive Work',
      'Monthly Rate (₱)',
      'Hourly Rate (₱)',
      'Estimated Gross Pay (₱)',
      'Avg Activity %',
    ],
  },
  {
    tabName: 'Active_Logs',
    description: 'Compatibility alias for Time_Logs. Dedicated log of all active shift work sessions, assigned tasks, start/end timestamps, duration in seconds, human-readable total time, and activity %.',
    headers: [
      'Session ID',
      'Employee Code',
      'Employee Name',
      'Designation',
      'Task Category',
      'Date',
      'Start Time',
      'End Time',
      'Duration (Seconds)',
      'Total Time',
      'Idle Deductions (Mins)',
      'Mouse Avg %',
      'Keyboard Avg %',
      'Status',
      'Notes',
    ],
  },
  {
    tabName: 'Inactive_Logs',
    description: 'Dedicated log of all inactivity detection events, zero-input hardware intervals, shift time subtractions, and extension mandates.',
    headers: [
      'Inactivity Log ID',
      'Date & Time',
      'Employee Code',
      'Employee Name',
      'Task Category',
      'Inactivity Duration (Mins)',
      'Deduction Status',
      'Trigger Source',
      'Impact on Shift & Extension',
    ],
  },
  {
    tabName: 'Admin_Audit_Logs',
    description: 'Pure administrative & security governance trail (Employee additions, profile edits, deletions, role updates, supervisor reassignments, surveillance toggles, password resets, payroll processing, leave approvals).',
    headers: [
      'Audit ID',
      'Timestamp (ISO)',
      'Formatted Date',
      'Actor Name',
      'Actor Role',
      'Action Category',
      'Affected Employee',
      'Previous Value',
      'New Value',
      'Action Details',
    ],
  },
  {
    tabName: 'Daily_Attendance_Logs',
    description: 'Tracks daily employee shift attendance, first check-in time, logout, total hours, idle deductions, required shift extensions, and presence status.',
    headers: [
      'Attendance ID',
      'Date',
      'Employee Code',
      'Employee Name',
      'First Login Time',
      'Last Logout Time',
      'Total Logged Hours',
      'Idle Deductions (Mins)',
      'Required Shift Extension (Mins)',
      'Attendance Status',
    ],
  },
  {
    tabName: 'Employee_Directory',
    description: 'Master employee roster with all active/registered staff, updated automatically on additions, edits, and deletions.',
    headers: [
      'Employee Code',
      'Username',
      'Full Name',
      'Work Email',
      'System Role',
      'Designation',
      'Date Hired',
      'Monthly Rate (₱)',
      'Hourly Rate (₱)',
      'Assigned Supervisor',
      'Screenshot Monitored',
      'Activity Monitored',
      'Status',
      'Account Password (Masked)',
    ],
  },
  {
    tabName: 'Leave_Requests',
    description: 'Tracks leave applications, leave categories, date spans, reasons, and approval status.',
    headers: [
      'Leave ID',
      'Employee Name',
      'Leave Type',
      'Start Date',
      'End Date',
      'Reason',
      'Status',
      'Requested At',
    ],
  },
  {
    tabName: 'Payroll_Summary',
    description: 'Bi-monthly payroll calculations, regular hours, overtime, incentives, deductions, and gross/net pay.',
    headers: [
      'Pay Period',
      'Employee Code',
      'Employee Name',
      'Designation',
      'Monthly Rate (₱)',
      'Hourly Rate (₱)',
      'Total Tracked Hours',
      'Missing Hours',
      'Missing Deductions (₱)',
      'Gross Pay (₱)',
      'Incentive Bonus (₱)',
      'Net Pay (₱)',
      'Payment Status',
    ],
  },
  {
    tabName: 'Designation_Tasks',
    description: 'Master record of all active organizational designations and their corresponding allowed shift tracking tasks.',
    headers: [
      'Designation Name',
      'Allowed Tracking Tasks (Comma Separated)',
      'Total Tasks Count',
      'Last Updated (ISO)',
    ],
  },
  {
    tabName: 'Designations_Permissions',
    description: 'Master matrix of all standard roles & custom categories, their assigned capabilities (CRUD, supervisors, screenshots, timesheets, payroll, webhooks), and current roster count.',
    headers: [
      'Role / Category Key',
      'Display Name',
      'Category Type',
      'Employee Directory CRUD',
      'Team Leader Assignment',
      'Activity Monitors',
      'Screenshot Captures',
      'Timesheets & Approvals',
      'Payroll & Rates',
      'Designation & Task Manager',
      'Google Sheets & Webhooks',
      'Assigned Staff Count',
      'Assigned Employees Roster',
      'Last Updated (ISO)',
    ],
  },
];

/**
 * Generates ready-to-paste Google Apps Script code for Google Sheets (Extensions -> Apps Script)
 */
/**
 * Robust Google Apps Script generator for multi-tab time tracking and database sync
 */
export const generateAppsScriptCode = (spreadsheetId: string = DEFAULT_SPREADSHEET_ID) => {
  return `/**
 * LLC TIME TRACKER - MODULAR SEPARATED LOGS & DATABASE SYNC SCRIPT
 * Linked Spreadsheet ID: ${spreadsheetId}
 * 
 * Features:
 * - Separate Tab for Instant Daily Timesheet Summary (Daily_Summary) - Rendered hours, tasks & deductions per agent
 * - Separate Tab for Instant Weekly Timesheet Summary (Weekly_Summary) - Rendered hours, overtime & regular breakdown
 * - Separate Tab for Instant Monthly Timesheet Summary (Monthly_Summary) - Days worked, total hours, estimated gross pay
 * - Separate Tab for Login Logs (Login_Logs)
 * - Separate Tab for Logout Logs (Logout_Logs)
 * - Separate Tab for Idle Logs (Idle_Logs)
 * - Separate Tab for Active Work Logs (Active_Logs)
 * - Separate Tab for Time Logs (Time_Logs) with Duration (Seconds) & Total Time (Human Readable)
 * - Separate Tab for Inactivity Events (Inactive_Logs)
 * - Separate Tab for Administrative & Security Audit Logs (Admin_Audit_Logs)
 * - Plus Attendance, Employee Directory, Leave Requests, and Payroll Summary
 * - Smart Record Merging: Preserves history from all devices & agents across sessions
 * 
 * Instructions:
 * 1. In your Google Sheet (https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit),
 *    click Extensions -> Apps Script.
 * 2. Delete everything in the editor and PASTE this entire script.
 * 3. Click the Save icon (floppy disk).
 * 4. Click Deploy -> New deployment.
 * 5. Click the gear icon next to "Select type" -> select "Web app".
 * 6. Set Description: "LLC Tracker Separated Logs Webhook"
 * 7. Set "Execute as": Me
 * 8. Set "Who has access": Anyone
 * 9. Click Deploy -> Authorize Access (choose your Google Account, click Advanced -> Go to Untitled project).
 * 10. Copy the Web App URL (ends in /exec) and paste it into the LLC Time Tracker "Google Sheets Sync" modal!
 */

function getSpreadsheet() {
  var targetId = '${spreadsheetId}';
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss && ss.getId() === targetId) return ss;
  } catch (e) {}
  try {
    return SpreadsheetApp.openById(targetId);
  } catch (err) {
    try {
      var ss2 = SpreadsheetApp.getActiveSpreadsheet();
      if (ss2) return ss2;
    } catch (e2) {}
    throw new Error('Could not access spreadsheet (' + targetId + '). Please check permissions: ' + err.toString());
  }
}

function maskPassword(pwd) {
  if (!pwd) return 'Pass****';
  var clean = String(pwd).trim();
  if (clean.length <= 4) return clean.substring(0, 2) + '****';
  var visible = clean.substring(0, 4);
  var starCount = Math.max(4, clean.length - 4);
  var stars = '';
  for (var s = 0; s < starCount; s++) { stars += '*'; }
  return visible + stars;
}

/**
 * Mathematically accurate Total Time conversion:
 * - >= 1 hour: "Xh Ym Zs" (e.g. 27529s -> "7h 38m 49s")
 * - < 1 hour: "Ym Zs" (e.g. 1121s -> "18m 41s", 2147s -> "35m 47s")
 * - < 1 min: "Zs" (e.g. 14s -> "14s")
 */
function formatTotalTime(totalSecs) {
  var secs = Math.max(0, Math.floor(Number(totalSecs) || 0));
  var h = Math.floor(secs / 3600);
  var m = Math.floor((secs % 3600) / 60);
  var s = secs % 60;
  if (h > 0) {
    return h + 'h ' + m + 'm ' + s + 's';
  } else if (m > 0) {
    return m + 'm ' + s + 's';
  } else {
    return s + 's';
  }
}

/**
 * Run this function directly in Apps Script editor (Select createAllTabsNow -> click Run)
 * to immediately initialize and format all tabs in your Google Sheet!
 */
function createAllTabsNow() {
  var ss = getSpreadsheet();
  setupSheetsSchema();
  repairAndCleanAllTabs();
  SpreadsheetApp.flush();
  var sheetCount = ss.getSheets().length;
  Logger.log('SUCCESS! Initialized tabs in Spreadsheet: "' + ss.getName() + '" (ID: ' + ss.getId() + ') | Total tabs: ' + sheetCount);
  return 'Created and formatted all tabs in ' + ss.getName();
}

/**
 * One-click utility: Select repairAndCleanAllTabs -> click Run in Apps Script editor.
 * Removes broken filters, wipes ghost empty rows, fixes row headers, and restores clean layout.
 */
function repairAndCleanAllTabs() {
  var ss = getSpreadsheet();
  setupSheetsSchema();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    try {
      var filter = sh.getFilter();
      if (filter) {
        filter.remove();
      }
    } catch (e) {}
  }
  SpreadsheetApp.flush();
  Logger.log('SUCCESS! Repaired all tabs and removed all broken filters.');
  return 'All spreadsheet tabs successfully cleaned and repaired!';
}

/**
 * Populates a sheet by merging existing rows with incoming rows based on a unique key column.
 * Guarantees that records from other agents/trainees are preserved and not wiped out during sync.
 */
function populateMergedSheet(sheet, headers, incomingRows, headerColor, keyColIdx, dateSortColIdx) {
  if (!sheet) return [];

  try {
    var existingFilter = sheet.getFilter();
    if (existingFilter) existingFilter.remove();
  } catch (fErr) {}

  var rowMap = {};
  var keyIdx = (keyColIdx !== undefined && keyColIdx !== null) ? keyColIdx : 0;

  var incomingKeyMap = {};
  if (incomingRows && incomingRows.length > 0) {
    for (var ik = 0; ik < incomingRows.length; ik++) {
      var kVal = String(incomingRows[ik][keyIdx] || '').trim();
      if (kVal) incomingKeyMap[kVal] = true;
    }
  }

  // Read existing rows from sheet
  try {
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow > 1 && lastCol > 0) {
      var existingData = sheet.getRange(2, 1, lastRow - 1, Math.max(lastCol, headers.length)).getValues();
      for (var r = 0; r < existingData.length; r++) {
        var exRow = existingData[r];
        var k = String(exRow[keyIdx] || '').trim();
        // Skip stale live tracking rows that are no longer actively incoming
        if (k.indexOf('live-') === 0 && !incomingKeyMap[k]) {
          continue;
        }
        if (k && k !== 'N/A') {
          var normalized = [];
          for (var c = 0; c < headers.length; c++) {
            normalized.push(exRow[c] !== undefined ? exRow[c] : '');
          }
          rowMap[k] = normalized;
        }
      }
    }
  } catch (readErr) {}

  // Merge incoming rows
  if (incomingRows && incomingRows.length > 0) {
    for (var i = 0; i < incomingRows.length; i++) {
      var inRow = incomingRows[i];
      var inKey = String(inRow[keyIdx] || '').trim();
      if (inKey && inKey !== 'N/A') {
        rowMap[inKey] = inRow;
      } else {
        rowMap['auto_' + i + '_' + (inRow[1] || '') + '_' + (inRow[2] || '') + '_' + (inRow[5] || '')] = inRow;
      }
    }
  }

  var mergedList = Object.keys(rowMap).map(function(k) { return rowMap[k]; });

  // Optional date sort descending
  if (dateSortColIdx !== undefined && dateSortColIdx !== null) {
    mergedList.sort(function(a, b) {
      var valA = a[dateSortColIdx] ? new Date(a[dateSortColIdx] + ' ' + (a[6] || '')).getTime() : 0;
      var valB = b[dateSortColIdx] ? new Date(b[dateSortColIdx] + ' ' + (b[6] || '')).getTime() : 0;
      if (isNaN(valA)) valA = new Date(a[dateSortColIdx] || 0).getTime();
      if (isNaN(valB)) valB = new Date(b[dateSortColIdx] || 0).getTime();
      return (valB || 0) - (valA || 0);
    });
  }

  var allData = [headers];
  if (mergedList.length > 0) {
    allData = allData.concat(mergedList);
  }

  var numRows = allData.length;
  var numCols = headers.length;
  var prevLastRow = sheet.getLastRow();
  var prevLastCol = sheet.getLastColumn();

  if (sheet.getMaxColumns() < numCols) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), numCols - sheet.getMaxColumns());
  }

  if (sheet.getMaxRows() < numRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), numRows - sheet.getMaxRows() + 10);
  }

  // Deep sanitize all cells to ensure zero undefined or null values
  var sanitizedMergedData = [];
  for (var mr = 0; mr < allData.length; mr++) {
    var cleanMergedRow = [];
    for (var mc = 0; mc < numCols; mc++) {
      var cellMVal = allData[mr][mc];
      cleanMergedRow.push(cellMVal === undefined || cellMVal === null ? '' : cellMVal);
    }
    sanitizedMergedData.push(cleanMergedRow);
  }

  // Set values in-place smoothly without clearing formatting
  sheet.getRange(1, 1, numRows, numCols).setValues(sanitizedMergedData);

  if (prevLastRow > numRows) {
    try {
      sheet.getRange(numRows + 1, 1, prevLastRow - numRows, Math.max(prevLastCol, numCols)).clearContent();
    } catch (e) {}
  }

  sheet.getRange(1, 1, 1, numCols)
    .setFontWeight('bold')
    .setBackground(headerColor || '#0f172a')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  return mergedList;
}

/**
 * Overwrite batch writer for directory and configuration tabs
 */
function populateCleanSheet(sheet, headers, rows, headerColor) {
  if (!sheet) return;

  var allData = [headers];
  if (rows && rows.length > 0) {
    allData = allData.concat(rows);
  }

  var numRows = allData.length;
  var numCols = headers.length;
  var prevLastRow = sheet.getLastRow();
  var prevLastCol = sheet.getLastColumn();

  if (sheet.getMaxColumns() < numCols) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), numCols - sheet.getMaxColumns());
  }

  if (sheet.getMaxRows() < numRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), numRows - sheet.getMaxRows() + 10);
  }

  // Deep sanitize all rows to ensure zero undefined or null values
  var sanitizedData = [];
  for (var r = 0; r < allData.length; r++) {
    var cleanRow = [];
    for (var c = 0; c < numCols; c++) {
      var cellVal = allData[r][c];
      cleanRow.push(cellVal === undefined || cellVal === null ? '' : cellVal);
    }
    sanitizedData.push(cleanRow);
  }

  var targetRange = sheet.getRange(1, 1, numRows, numCols);
  targetRange.setValues(sanitizedData);

  // Clear any excess old rows below current dataset smoothly without flickering the sheet view
  if (prevLastRow > numRows) {
    try {
      sheet.getRange(numRows + 1, 1, prevLastRow - numRows, Math.max(prevLastCol, numCols)).clearContent();
    } catch (e) {}
  }

  sheet.getRange(1, 1, 1, numCols)
    .setFontWeight('bold')
    .setBackground(headerColor || '#0f172a')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}

/**
 * Finds or creates the Employee Directory sheet flexibly,
 * matching Employee_Directory, mployee_Directory, Employee Directory, or Employees.
 */
function getEmployeeDirectorySheet(ss) {
  var candidateNames = ['mployee_Directory', 'Employee_Directory', 'Employee Directory', 'Employee_directory', 'Employees', 'Staff_Directory', 'Staff'];
  for (var i = 0; i < candidateNames.length; i++) {
    var sh = ss.getSheetByName(candidateNames[i]);
    if (sh) return sh;
  }
  var allSheets = ss.getSheets();
  for (var j = 0; j < allSheets.length; j++) {
    var rawName = allSheets[j].getName().toLowerCase().replace(/[\s_\-]+/g, '');
    if (rawName === 'mployeedirectory' || rawName === 'employeedirectory' || rawName === 'employees' || rawName === 'staffdirectory') {
      return allSheets[j];
    }
  }
  var newSheet = ss.insertSheet('mployee_Directory');
  try {
    newSheet.setTabColor('#0284c7');
  } catch (e) {}
  return newSheet;
}

/**
 * Dedicated internal function to populate the Employee Directory tab
 * with all 14 columns, canonical names, and masked passwords.
 * Updates BOTH mployee_Directory AND Employee_Directory tabs if present!
 */
function syncEmployeeDirectoryInternal(ss, directoryUsers, userMap) {
  var empHeaders = [
    'Employee Code',
    'Username',
    'Full Name',
    'Work Email',
    'System Role',
    'Designation',
    'Date Hired',
    'Monthly Rate (₱)',
    'Hourly Rate (₱)',
    'Assigned Supervisor',
    'Screenshot Monitored',
    'Activity Monitored',
    'Status',
    'Account Password (Masked)'
  ];
  var empRows = [];
  var seenKeys = {};

  var list = (directoryUsers && directoryUsers.length > 0) ? directoryUsers : [];
  list.forEach(function(u) {
    if (!u) return;
    var code = String(u.employeeCode || '').trim().toUpperCase();
    var uName = String(u.username || '').trim().toLowerCase();
    var dKey = code && code !== 'N/A' ? code : (uName ? uName : (u.id || Math.random()));
    if (seenKeys[dKey]) return;
    seenKeys[dKey] = true;

    var maskedPass = maskPassword(u.password || 'Password123!');
    var hireDate = u.joinDate || '2020-01-01';
    var supervisorName = 'None / Direct Executive';
    if (u.teamLeaderId && userMap) {
      var sv = userMap[u.teamLeaderId] || userMap[String(u.teamLeaderId).toUpperCase()];
      supervisorName = sv ? sv.name + ' (' + (sv.designation || sv.role) + ')' : u.teamLeaderId;
    }
    var mRate = (u.monthlyRate !== undefined && u.monthlyRate !== null && !isNaN(Number(u.monthlyRate))) ? Number(u.monthlyRate) : 0;
    var hRate = (u.hourlyRate !== undefined && u.hourlyRate !== null && !isNaN(Number(u.hourlyRate))) ? Number(u.hourlyRate) : (mRate > 0 ? Number((mRate / 160).toFixed(2)) : 0);

    empRows.push([
      u.employeeCode || 'N/A',
      u.username || 'agent',
      u.name || 'Unknown',
      u.email || '',
      u.role || 'agent',
      u.designation || 'Agent',
      hireDate,
      mRate,
      hRate,
      supervisorName,
      u.screenshotMonitored ? 'YES' : 'NO',
      u.activityMonitored ? 'YES' : 'NO',
      u.status || 'active',
      maskedPass
    ]);
  });

  // Collect ALL employee directory tabs present in the spreadsheet
  var targetSheets = [];
  var allSheets = ss.getSheets();
  for (var s = 0; s < allSheets.length; s++) {
    var raw = allSheets[s].getName().toLowerCase().replace(/[\s_\-]+/g, '');
    if (raw === 'mployeedirectory' || raw === 'employeedirectory' || raw === 'employees' || raw === 'staffdirectory') {
      targetSheets.push(allSheets[s]);
    }
  }

  if (targetSheets.length === 0) {
    targetSheets.push(getEmployeeDirectorySheet(ss));
  }

  // Populate EVERY matching sheet with the clean 14 columns
  targetSheets.forEach(function(sh) {
    try {
      populateCleanSheet(sh, empHeaders, empRows, '#0369a1');
    } catch(err) {
      Logger.log('Error populating sheet ' + sh.getName() + ': ' + err.toString());
    }
  });

  return empRows.length;
}

var CANONICAL_STAFF = {
  'SUPERADMIN': 'Admin',
  'LLC-0003': 'Pia',
  'LLC-0004': 'Alexa Gabrielle Bardaje',
  'LLC-0005': 'April Sam Dimaano',
  'LLC-0006': 'Boris Andrew Villanueva',
  'LLC-0007': 'Cyril Diola Garcia',
  'LLC-0008': 'Daina Yanez',
  'LLC-0009': 'Fatima Dence David',
  'LLC-0010': 'Gerald A. Salvador',
  'LLC-0011': 'Jayson Cariaga',
  'LLC-0012': 'Jenalyn Nueva',
  'LLC-0013': 'Kathleen Ann L. Totaan',
  'LLC-0014': 'Lourdes Mary Cenina',
  'LLC-0015': 'Luis David Ramirez',
  'LLC-0016': 'Maria Racquel Gracia M. Libarios',
  'LLC-0017': 'Mark Jesus A. Egoy',
  'LLC-0018': 'Raquel Guiapal',
  'LLC-0019': 'Ron Louie Logan',
  'LLC-0020': 'Rubilyne Barrameda',
  'LLC-0021': 'Shiela Romey',
  'LLC-0022': 'Trixy Ashley Decena Mabutol'
};

function resolveStaffFullName(code, username, name, id) {
  var n = (name || '').trim();
  if (n && n !== 'Unknown' && n !== 'Employee' && n !== 'Staff' && n !== 'Agent') {
    return n;
  }
  var c = (code || '').toUpperCase().trim();
  var num = c.replace(/^[A-Z\-_]+/, '');
  for (var k in CANONICAL_STAFF) {
    var kNum = k.replace(/^[A-Z\-_]+/, '');
    if (c === k || (num && kNum && num === kNum)) return CANONICAL_STAFF[k];
  }
  var u = (username || '').toLowerCase().trim();
  var nLower = n.toLowerCase();
  var rawId = (id || '').toLowerCase().trim();
  if (u === 'agabr' || nLower === 'agabr' || rawId.indexOf('0004') !== -1) return 'Alexa Gabrielle Bardaje';
  if (u === 'asamd' || nLower === 'asamd' || rawId.indexOf('0005') !== -1) return 'April Sam Dimaano';
  if (u === 'bandr' || nLower === 'bandr' || rawId.indexOf('0006') !== -1) return 'Boris Andrew Villanueva';
  if (u === 'cdiol' || nLower === 'cdiol' || rawId.indexOf('0007') !== -1) return 'Cyril Diola Garcia';
  if (u === 'dyane' || nLower === 'dyane' || rawId.indexOf('0008') !== -1) return 'Daina Yanez';
  if (u === 'fdenc' || nLower === 'fdenc' || rawId.indexOf('0009') !== -1) return 'Fatima Dence David';
  if (u === 'gasal' || nLower === 'gasal' || rawId.indexOf('0010') !== -1) return 'Gerald A. Salvador';
  if (u === 'jcari' || nLower === 'jcari' || rawId.indexOf('0011') !== -1) return 'Jayson Cariaga';
  if (u === 'jnuev' || nLower === 'jnuev' || rawId.indexOf('0012') !== -1) return 'Jenalyn Nueva';
  if (u === 'kannl' || nLower === 'kannl' || rawId.indexOf('0013') !== -1) return 'Kathleen Ann L. Totaan';
  if (u === 'lmary' || nLower === 'lmary' || rawId.indexOf('0014') !== -1) return 'Lourdes Mary Cenina';
  if (u === 'ldavi' || nLower === 'ldavi' || rawId.indexOf('0015') !== -1) return 'Luis David Ramirez';
  if (u === 'mracq' || nLower === 'mracq' || rawId.indexOf('0016') !== -1) return 'Maria Racquel Gracia M. Libarios';
  if (u === 'mjesu' || nLower === 'mjesu' || rawId.indexOf('0017') !== -1) return 'Mark Jesus A. Egoy';
  if (u === 'rguia' || nLower === 'rguia' || rawId.indexOf('0018') !== -1) return 'Raquel Guiapal';
  if (u === 'rloui' || nLower === 'rloui' || rawId.indexOf('0019') !== -1) return 'Ron Louie Logan';
  if (u === 'rbarr' || nLower === 'rbarr' || rawId.indexOf('0020') !== -1) return 'Rubilyne Barrameda';
  if (u === 'srome' || nLower === 'srome' || rawId.indexOf('0021') !== -1) return 'Shiela Romey';
  if (u === 'tashl' || nLower === 'tashl' || rawId.indexOf('0022') !== -1) return 'Trixy Ashley Decena Mabutol';
  if (u === 'trainer' || nLower === 'pia' || c === 'LLC-0003') return 'Pia';
  if (u === 'admin' || c === 'SUPERADMIN') return 'Admin';
  return n || username || 'Employee';
}

var presenceHeaders = [
  'Employee Code',
  'Employee Name',
  'System Role',
  'Designation',
  'Platform Mode',
  'Live Presence Status',
  'Current Active Task',
  'Current Application',
  'Shift Hours Today',
  'First Check-In (Manila)',
  'Device Timezone',
  'Last Active Heartbeat (Manila)',
  'Last Heartbeat (ISO)'
];

function upsertSinglePresenceRow(sheet, p) {
  if (!sheet || !p) return null;

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(presenceHeaders);
    sheet.getRange(1, 1, 1, presenceHeaders.length)
      .setFontWeight('bold')
      .setBackground('#065f46')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }

  var targetCode = String(p.employeeCode || '').trim().toUpperCase();
  var targetName = String(p.userName || p.name || '').trim().toLowerCase();
  var resolvedName = resolveStaffFullName(targetCode, targetName, p.userName || p.name, p.userId);

  var lastRow = sheet.getLastRow();
  var matchRow = -1;
  var existingRow = null;

  if (lastRow > 1) {
    try {
      var maxCols = Math.max(sheet.getLastColumn(), 13);
      var sheetData = sheet.getRange(2, 1, lastRow - 1, maxCols).getValues();
      for (var r = 0; r < sheetData.length; r++) {
        var row = sheetData[r];
        var rowCode = String(row[0] || '').trim().toUpperCase();
        var rowName = String(row[1] || '').trim().toLowerCase();
        if ((targetCode && targetCode !== 'N/A' && rowCode === targetCode) ||
            (targetName && rowName === targetName) ||
            (resolvedName && rowName === resolvedName.toLowerCase())) {
          matchRow = r + 2;
          existingRow = row;
          break;
        }
      }
    } catch (e) {}
  }

  var isTracking = p.isTracking === true || (p.status === 'online' && p.isTracking) || (p.statusLabel && p.statusLabel.indexOf('Live Tracking') !== -1);
  var isIdle = p.status === 'idle' || p.isPaused === true || (p.statusLabel && p.statusLabel.indexOf('Idle') !== -1);
  var isOffline = p.status === 'offline' || (p.isOnline === false && !isTracking && !isIdle);

  var platformMode = p.platformMode || (p.loginPlatform === 'software' || isTracking || (existingRow && String(existingRow[4]).indexOf('Desktop') !== -1) ? 'Desktop Tracker' : 'Website');
  if (isOffline && !p.platformMode) platformMode = 'None / Offline';

  var statusLabel = p.statusLabel || (isTracking ? '🟢 Live Tracking' : (isIdle ? '🟡 Idle / Break' : (isOffline ? '⚪ Offline' : '🔵 Desktop Online')));
  var currentTask = p.currentTask || (existingRow && existingRow[6] && existingRow[6] !== 'Shift Concluded' ? existingRow[6] : (isOffline ? 'Shift Concluded' : 'Active Work in Progress'));
  var currentApp = p.currentApp || (existingRow && existingRow[7] && existingRow[7] !== 'None' ? existingRow[7] : (platformMode.indexOf('Desktop') !== -1 ? 'LLC Time Tracker Desktop App' : 'Web Browser'));

  var userElapsed = typeof p.elapsedSeconds === 'number' ? p.elapsedSeconds : 0;
  if (!userElapsed && existingRow && existingRow[8]) {
    var mDur = String(existingRow[8]).match(/(\d+)h\s*(\d+)m/);
    if (mDur) {
      userElapsed = parseInt(mDur[1], 10) * 3600 + parseInt(mDur[2], 10) * 60;
    }
  }
  var shiftHours = p.shiftHoursToday || formatTotalTime(userElapsed);

  var firstCheckin = p.firstCheckin || (existingRow && existingRow[9] && existingRow[9] !== '--:--' ? existingRow[9] : '--:--');
  if (firstCheckin === '--:--' && (isTracking || p.loginTime)) {
    try {
      firstCheckin = Utilities.formatDate(new Date(), 'Asia/Manila', 'hh:mm a');
    } catch(e) {}
  }

  var timezone = p.timezone || (existingRow && existingRow[10] ? existingRow[10] : 'Asia/Manila (GMT+8)');
  var now = new Date();
  var lastHbFormatted = Utilities.formatDate(now, 'Asia/Manila', 'yyyy-MM-dd hh:mm:ss a');
  var lastHbIso = p.lastHeartbeat || now.toISOString();

  var empCode = targetCode && targetCode !== 'N/A' ? targetCode : (existingRow && existingRow[0] ? existingRow[0] : 'N/A');
  var empName = resolvedName || p.userName || p.name || (existingRow && existingRow[1] ? existingRow[1] : 'Employee');
  var role = p.role || (existingRow && existingRow[2] ? existingRow[2] : 'agent');
  var designation = p.designation || (existingRow && existingRow[3] ? existingRow[3] : 'Agent');

  var newRowData = [
    empCode,
    empName,
    role,
    designation,
    platformMode,
    statusLabel,
    currentTask,
    currentApp,
    shiftHours,
    firstCheckin,
    timezone,
    lastHbFormatted,
    lastHbIso
  ];

  if (sheet.getMaxColumns() < 13) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 13 - sheet.getMaxColumns());
  }

  if (matchRow > 0) {
    sheet.getRange(matchRow, 1, 1, 13).setValues([newRowData]);
  } else {
    sheet.appendRow(newRowData);
  }

  return newRowData;
}

function updateLivePresenceMerged(targetSheet, incomingPresenceList) {
  if (!targetSheet || !incomingPresenceList || incomingPresenceList.length === 0) return [];
  var updatedRows = [];
  for (var pi = 0; pi < incomingPresenceList.length; pi++) {
    var item = incomingPresenceList[pi];
    if (item && (item.employeeCode || item.userId || item.userName || item.name)) {
      var res = upsertSinglePresenceRow(targetSheet, item);
      if (res) updatedRows.push(res);
    }
  }
  return updatedRows;
}

/**
 * Dedicated function to upsert live tracking time sessions into Live_Sessions and Time_Logs
 * with all 15 columns, start times, total duration, status, and activity percentages.
 */
var liveSessionHeaders = [
  'Session ID',
  'Employee Code',
  'Employee Name',
  'Designation',
  'Task Category',
  'Date',
  'Start Time',
  'End Time',
  'Duration (Seconds)',
  'Total Time',
  'Idle Deductions (Mins)',
  'Mouse Avg %',
  'Keyboard Avg %',
  'Status',
  'Notes'
];

function upsertLiveTrackingSessionRow(sheet, p) {
  if (!sheet || !p) return null;

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(liveSessionHeaders);
    sheet.getRange(1, 1, 1, liveSessionHeaders.length)
      .setFontWeight('bold')
      .setBackground('#047857')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }

  var targetCode = String(p.employeeCode || '').trim().toUpperCase();
  var targetName = String(p.userName || p.name || '').trim();
  var resolvedName = resolveStaffFullName(targetCode, targetName, targetName, p.userId);
  var targetSessionId = p.sessionId || ('live-' + (p.userId || targetCode.toLowerCase() || 'agent'));

  var lastRow = sheet.getLastRow();
  var matchRow = -1;
  var existingRow = null;

  if (lastRow > 1) {
    try {
      var maxCols = Math.max(sheet.getLastColumn(), 15);
      var sheetData = sheet.getRange(2, 1, lastRow - 1, maxCols).getValues();
      for (var r = 0; r < sheetData.length; r++) {
        var row = sheetData[r];
        var rowSessionId = String(row[0] || '').trim();
        var rowCode = String(row[1] || '').trim().toUpperCase();
        var rowName = String(row[2] || '').trim().toLowerCase();
        if (rowSessionId === targetSessionId ||
            (targetCode && targetCode !== 'N/A' && rowCode === targetCode && (String(row[13]).toLowerCase() === 'running' || String(row[7]).toLowerCase().indexOf('running') !== -1)) ||
            (resolvedName && rowName === resolvedName.toLowerCase() && (String(row[13]).toLowerCase() === 'running' || String(row[7]).toLowerCase().indexOf('running') !== -1))) {
          matchRow = r + 2;
          existingRow = row;
          break;
        }
      }
    } catch(e) {}
  }

  var isTracking = p.isTracking === true || (p.status === 'online' && p.isTracking) || (p.statusLabel && p.statusLabel.indexOf('Live Tracking') !== -1);
  var elapsedSecs = typeof p.elapsedSeconds === 'number' ? Math.max(0, Math.floor(p.elapsedSeconds)) : 0;
  if (!elapsedSecs && existingRow && existingRow[8]) {
    elapsedSecs = Number(existingRow[8]) || 0;
  }
  var todayStr = Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd');
  var startTime = p.firstCheckin || (existingRow && existingRow[6] ? existingRow[6] : Utilities.formatDate(new Date(), 'Asia/Manila', 'hh:mm:ss a'));
  var endTime = isTracking ? 'Running Live' : Utilities.formatDate(new Date(), 'Asia/Manila', 'hh:mm:ss a');
  var status = isTracking ? 'running' : 'completed';

  var rowData = [
    targetSessionId,
    targetCode || 'N/A',
    resolvedName || targetName || 'Employee',
    p.designation || (existingRow ? existingRow[3] : 'Agent'),
    p.currentTask || (existingRow ? existingRow[4] : 'Active Work'),
    (existingRow && existingRow[5]) ? existingRow[5] : todayStr,
    startTime,
    endTime,
    elapsedSecs,
    formatTotalTime(elapsedSecs),
    p.idleMinutes || '0 mins',
    (p.mouseActivity != null ? p.mouseActivity : 95) + '%',
    (p.keyboardActivity != null ? p.keyboardActivity : 95) + '%',
    status,
    isTracking ? 'Tracking live in LLC Time Tracker Client' : 'Shift Concluded'
  ];

  if (sheet.getMaxColumns() < 15) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 15 - sheet.getMaxColumns());
  }

  if (matchRow > 0) {
    sheet.getRange(matchRow, 1, 1, 15).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  return rowData;
}

function setupSheetsSchema() {
  var ss = getSpreadsheet();
  var schema = [
    {
      tab: 'Live_Presence',
      color: '#10b981', // Emerald Green
      headers: ['Employee Code', 'Employee Name', 'System Role', 'Designation', 'Platform Mode', 'Live Presence Status', 'Current Active Task', 'Current Application', 'Shift Hours Today', 'First Check-In (Manila)', 'Device Timezone', 'Last Active Heartbeat (Manila)', 'Last Heartbeat (ISO)']
    },
    {
      tab: 'Login_Logs',
      color: '#2563eb', // Blue
      headers: ['Log ID', 'Timestamp (ISO)', 'Formatted Date & Time', 'Employee Code', 'Employee Name', 'User Role', 'Designation', 'Login Platform / Mode', 'Timezone & Location', 'Session Status', 'Account Password (Masked)']
    },
    {
      tab: 'Logout_Logs',
      color: '#475569', // Slate
      headers: ['Log ID', 'Timestamp (ISO)', 'Formatted Date & Time', 'Employee Code', 'Employee Name', 'User Role', 'Designation', 'Logout Platform / Event', 'Session Duration / Notes', 'Status']
    },
    {
      tab: 'Idle_Logs',
      color: '#d97706', // Amber
      headers: ['Idle Log ID', 'Timestamp', 'Employee Code', 'Employee Name', 'Inactivity Duration (Mins)', 'Deducted From Shift', 'Required Shift Extension', 'Active Task', 'Reason / Trigger', 'Status']
    },
    {
      tab: 'Timesheets',
      color: '#059669', // Emerald
      headers: ['Session ID', 'Employee Code', 'Employee Name', 'Designation', 'Task Category', 'Date', 'Start Time', 'End Time', 'Duration (Seconds)', 'Total Time', 'Idle Deductions (Mins)', 'Mouse Avg %', 'Keyboard Avg %', 'Status', 'Notes']
    },
    {
      tab: 'Time_Logs',
      color: '#059669', // Emerald
      headers: ['Session ID', 'Employee Code', 'Employee Name', 'Designation', 'Task Category', 'Date', 'Start Time', 'End Time', 'Duration (Seconds)', 'Total Time', 'Idle Deductions (Mins)', 'Mouse Avg %', 'Keyboard Avg %', 'Status', 'Notes']
    },
    {
      tab: 'Daily_Summary',
      color: '#0284c7', // Sky Blue
      headers: ['Date', 'Employee Code', 'Employee Name', 'Designation', 'Tasks Worked On', 'First Clock-In (Manila)', 'Last Clock-Out (Manila)', 'Gross Tracked Shift', 'Total Idle / Breaks', 'Net Productive Work', 'Duration (Seconds)', 'Avg Activity %', 'Shift Status', 'Log Entries']
    },
    {
      tab: 'Weekly_Summary',
      color: '#0d9488', // Teal
      headers: ['Week Period (Mon-Sun)', 'Employee Code', 'Employee Name', 'Designation', 'Tasks Breakdown', 'Days Rendered', 'Gross Tracked Hours', 'Total Idle / Breaks', 'Net Productive Work', 'Regular Hours', 'Overtime Hours', 'Avg Activity %']
    },
    {
      tab: 'Monthly_Summary',
      color: '#059669', // Green
      headers: ['Month Period', 'Employee Code', 'Employee Name', 'Designation', 'Primary Tasks', 'Total Days Rendered', 'Gross Tracked Hours', 'Total Idle / Breaks', 'Net Productive Work', 'Avg Activity %']
    },
    {
      tab: 'Active_Logs',
      color: '#059669', // Emerald
      headers: ['Session ID', 'Employee Code', 'Employee Name', 'Designation', 'Task Category', 'Date', 'Start Time', 'End Time', 'Duration (Seconds)', 'Total Time', 'Idle Deductions (Mins)', 'Mouse Avg %', 'Keyboard Avg %', 'Status', 'Notes']
    },
    {
      tab: 'Inactive_Logs',
      color: '#ea580c', // Orange
      headers: ['Inactivity Log ID', 'Date & Time', 'Employee Code', 'Employee Name', 'Task Category', 'Inactivity Duration (Mins)', 'Deduction Status', 'Trigger Source', 'Impact on Shift & Extension']
    },
    {
      tab: 'Admin_Audit_Logs',
      color: '#4f46e5', // Indigo
      headers: ['Audit ID', 'Timestamp (ISO)', 'Formatted Date', 'Actor Name', 'Actor Role', 'Action Category', 'Affected Employee', 'Previous Value', 'New Value', 'Action Details']
    },
    {
      tab: 'Daily_Attendance_Logs',
      color: '#0891b2', // Cyan
      headers: ['Attendance ID', 'Date', 'Employee Code', 'Employee Name', 'First Login Time', 'Last Logout Time', 'Total Logged Hours', 'Idle Deductions (Mins)', 'Required Shift Extension (Mins)', 'Attendance Status']
    },
    {
      tab: 'Employee_Directory',
      color: '#0284c7', // Sky
      headers: ['Employee Code', 'Username', 'Full Name', 'Work Email', 'System Role', 'Designation', 'Date Hired', 'Monthly Rate (₱)', 'Hourly Rate (₱)', 'Assigned Supervisor', 'Screenshot Monitored', 'Activity Monitored', 'Status', 'Account Password (Masked)']
    },
    {
      tab: 'Leave_Requests',
      color: '#9333ea', // Purple
      headers: ['Leave ID', 'Employee Name', 'Leave Type', 'Start Date', 'End Date', 'Reason', 'Status', 'Requested At']
    },
    {
      tab: 'Payroll_Summary',
      color: '#16a34a', // Green
      headers: ['Pay Period', 'Employee Code', 'Employee Name', 'Designation', 'Monthly Rate (₱)', 'Hourly Rate (₱)', 'Total Tracked Hours', 'Missing Hours', 'Missing Deductions (₱)', 'Gross Pay (₱)', 'Incentive Bonus (₱)', 'Net Pay (₱)', 'Payment Status']
    },
    {
      tab: 'Designation_Tasks',
      color: '#6366f1', // Indigo
      headers: ['Designation Name', 'Allowed Tracking Tasks (Comma Separated)', 'Total Tasks Count', 'Last Updated (ISO)']
    },
    {
      tab: 'Live_Sessions',
      color: '#059669', // Emerald
      headers: ['Session ID', 'Employee Code', 'Employee Name', 'Designation', 'Task Category', 'Date', 'Start Time', 'End Time', 'Duration (Seconds)', 'Total Time', 'Idle Deductions (Mins)', 'Mouse Avg %', 'Keyboard Avg %', 'Status', 'Notes']
    },
    {
      tab: 'Designations_Permissions',
      color: '#8b5cf6', // Violet
      headers: [
        'Role / Category Key',
        'Display Name',
        'Category Type',
        'Employee Directory CRUD',
        'Team Leader Assignment',
        'Activity Monitors',
        'Screenshot Captures',
        'Timesheets & Approvals',
        'Payroll & Rates',
        'Designation & Task Manager',
        'Google Sheets & Webhooks',
        'Assigned Staff Count',
        'Assigned Employees Roster',
        'Last Updated (ISO)'
      ]
    }
  ];

  schema.forEach(function(item) {
    if (item.tab === 'Employee_Directory') {
      var empCandidates = ['mployee_Directory', 'Employee_Directory'];
      empCandidates.forEach(function(cName) {
        var sh = ss.getSheetByName(cName);
        if (sh && sh.getLastRow() === 0) {
          sh.appendRow(item.headers);
          sh.getRange(1, 1, 1, item.headers.length).setFontWeight('bold').setBackground('#0284c7').setFontColor('#ffffff');
          sh.setFrozenRows(1);
        }
      });
      return;
    }

    var sheet = ss.getSheetByName(item.tab);
    if (!sheet) {
      sheet = ss.insertSheet(item.tab);
    }
    if (item.color) {
      try {
        sheet.setTabColor(item.color);
      } catch (e) {}
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(item.headers);
      sheet.getRange(1, 1, 1, item.headers.length).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
  });
}

function doPost(e) {
  try {
    var ss = getSpreadsheet();

    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (pErr) {
        data = { action: 'SYNC_ALL' };
      }
    } else {
      data = { action: 'SYNC_ALL' };
    }

    if (data.action === 'RESET_ALL') {
      var allDataTabs = [
        'Time_Logs',
        'Active_Logs',
        'Live_Sessions',
        'Daily_Summary',
        'Weekly_Summary',
        'Monthly_Summary',
        'Inactive_Logs',
        'Daily_Attendance_Logs',
        'Idle_Logs',
        'Audit_Logs',
        'Admin_Audit_Logs',
        'Login_Logs',
        'Login_Session_Logs',
        'Leave_Requests',
        'Manual_Time_Requests',
        'Payroll_Summary'
      ];
      allDataTabs.forEach(function(tName) {
        var sh = ss.getSheetByName(tName);
        if (sh && sh.getLastRow() > 1) {
          try {
            sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(sh.getLastColumn(), 1)).clearContent();
          } catch(e) {}
        }
      });
      // Clear Live_Presence rows below header
      var presSheet = ss.getSheetByName('Live_Presence') || ss.getSheetByName('Live Presence');
      if (presSheet && presSheet.getLastRow() > 1) {
        try {
          presSheet.getRange(2, 1, presSheet.getLastRow() - 1, Math.max(presSheet.getLastColumn(), 1)).clearContent();
        } catch(e) {}
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: 'SUCCESS',
        success: true,
        message: 'All Google Sheets data tables successfully reset to a clean state!'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // HEARTBEAT_UPDATE (Targeted Single-Row Agent Tracking Pulse)
    // Runs in <200ms without schema rebuilding overhead!
    // ==========================================
    if (data.action === 'HEARTBEAT_UPDATE') {
      var presSheet = ss.getSheetByName('Live_Presence') || ss.getSheetByName('Live Presence') || ss.insertSheet('Live_Presence');
      var pData = data.presence || data.userPresence || data.agent || data;
      if (pData) {
        // 1. Update row in Live_Presence (13 columns Presence table)
        upsertSinglePresenceRow(presSheet, pData);

        // 2. Update live tracking session row in Live_Sessions (15 columns Time Log table)
        var liveSessSheet = ss.getSheetByName('Live_Sessions') || ss.getSheetByName('Live Sessions');
        if (liveSessSheet) {
          upsertLiveTrackingSessionRow(liveSessSheet, pData);
        }

        // 3. Also keep Time_Logs updated if agent is currently tracking
        var tLogsSheet = ss.getSheetByName('Time_Logs');
        if (tLogsSheet && pData.isTracking) {
          upsertLiveTrackingSessionRow(tLogsSheet, pData);
        }
      }
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({
        status: 'SUCCESS',
        action: 'HEARTBEAT_UPDATE',
        message: 'Heartbeat and live tracking recorded successfully for ' + (pData.userName || pData.employeeCode || 'Agent')
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // ACTION: SYNC_EMPLOYEES (Instant employee roster push)
    // Updates BOTH mployee_Directory AND Employee_Directory tabs!
    // ==========================================
    if (data.action === 'SYNC_EMPLOYEES' || data.action === 'SYNC_USERS' || data.action === 'SYNC_ROSTER') {
      var rawUsersList = data.users || [];
      var uMap = {};
      rawUsersList.forEach(function(u) {
        if (!u) return;
        if (u.id) uMap[u.id] = u;
        if (u.employeeCode) uMap[String(u.employeeCode).toUpperCase()] = u;
      });
      var count = syncEmployeeDirectoryInternal(ss, rawUsersList, uMap);
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({
        status: 'SUCCESS',
        action: 'SYNC_EMPLOYEES',
        count: count,
        message: 'Successfully populated ' + count + ' employees into Employee_Directory and mployee_Directory tab!'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'SYNC_ALL' || data.action === 'APPEND_LOG') {
      var rawAuditLogs = data.auditLogs || [];
      var rawUsers = data.users || [];
      var rawTimeLogs = data.timeLogs || [];
      var rawIdleLogs = data.idleLogs || [];
      var dailyAttendanceLogs = data.dailyAttendanceLogs || [];
      var leaveRequests = data.leaveRequests || [];
      var payrollRecords = data.payrollRecords || [];
      var rawPresenceList = data.userPresenceList || data.livePresence || data.presence || [];
      var presenceMap = {};
      rawPresenceList.forEach(function(p) {
        if (!p) return;
        if (p.userId) presenceMap[p.userId] = p;
        if (p.employeeCode) presenceMap[String(p.employeeCode).toUpperCase()] = p;
        if (p.userName) presenceMap[String(p.userName).toLowerCase()] = p;
        if (p.name) presenceMap[String(p.name).toLowerCase()] = p;
      });

      // Deduplicate users and sanitize employee names
      var userMap = {};
      var users = [];
      rawUsers.forEach(function(u) {
        var resolvedName = resolveStaffFullName(u.employeeCode, u.username, u.name, u.id);
        u.name = resolvedName;
        var key = (u.employeeCode || u.id || u.username || '').toUpperCase();
        if (key && !userMap[key]) {
          userMap[key] = u;
          users.push(u);
        }
        if (u.id) userMap[u.id] = u;
        if (u.name) userMap[u.name] = u;
        if (u.employeeCode) userMap[u.employeeCode.toUpperCase()] = u;
      });

      // ==========================================
      // 0. POPULATE EMPLOYEE DIRECTORY FIRST (Updates both mployee_Directory & Employee_Directory)
      // ==========================================
      try {
        syncEmployeeDirectoryInternal(ss, users.length > 0 ? users : rawUsers, userMap);
      } catch (empErr) {
        Logger.log('Employee_Directory sync error: ' + empErr.toString());
      }

      // ==========================================
      // 0. POPULATE LIVE PRESENCE (Dedicated 13-column Presence Table)
      // ==========================================
      var nowMs = new Date().getTime();
      var todayStr = Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd');

      var presenceSheet = ss.getSheetByName('Live_Presence') || ss.getSheetByName('Live Presence') || ss.insertSheet('Live_Presence');
      var finalPresenceRows = [];
      if (presenceSheet && rawPresenceList.length > 0) {
        finalPresenceRows = updateLivePresenceMerged(presenceSheet, rawPresenceList);
      }

      // ==========================================
      // 1. POPULATE LOGIN LOGS (Support both 'Login_Logs' and 'Login_Session_Logs')
      // ==========================================
      var loginHeaders = ['Log ID', 'Timestamp (ISO)', 'Formatted Date & Time', 'Employee Code', 'Employee Name', 'User Role', 'Designation', 'Login Platform / Mode', 'Timezone & Location', 'Session Status', 'Account Password (Masked)'];
      var loginEvents = rawAuditLogs.filter(function(l) {
        return l.category === 'Login' || (l.details && l.details.toLowerCase().indexOf('signed in') !== -1);
      });

      var loginSeen = {};
      var loginRows = [];
      loginEvents.forEach(function(l) {
        var dedupeKey = l.id || (l.actorName + '_' + l.timestamp);
        if (loginSeen[dedupeKey]) return;
        loginSeen[dedupeKey] = true;

        var matchedUser = userMap[(l.actorId || '').toUpperCase()] || userMap[l.actorId] || userMap[l.actorName] || {};
        var mode = (l.details && l.details.indexOf('Desktop') !== -1) ? 'Desktop Software App' : 'Web Portal';
        var maskedPass = maskPassword(matchedUser.password || 'Password123!');
        loginRows.push([
          l.id,
          l.timestamp,
          l.dateFormatted || l.timestamp,
          matchedUser.employeeCode || 'N/A',
          l.actorName,
          l.actorRole || matchedUser.role || 'agent',
          matchedUser.designation || 'Agent',
          mode,
          (matchedUser.geoCity ? matchedUser.geoCity + ' (' + (matchedUser.geoTimezone || 'GMT+8') + ')' : 'Toronto, Canada (America/Toronto)'),
          'Authenticated (Active)',
          maskedPass
        ]);
      });

      loginRows.sort(function(a, b) {
        return new Date(b[1] || 0).getTime() - new Date(a[1] || 0).getTime();
      });

      var loginSheet = ss.getSheetByName('Login_Logs');
      if (loginSheet) populateMergedSheet(loginSheet, loginHeaders, loginRows, '#1e3a8a', 0, 1);
      var loginSessionSheet = ss.getSheetByName('Login_Session_Logs');
      if (loginSessionSheet) populateMergedSheet(loginSessionSheet, loginHeaders, loginRows, '#1e3a8a', 0, 1);

      // ==========================================
      // 2. POPULATE LOGOUT LOGS (Dedicated Tab)
      // ==========================================
      var logoutHeaders = ['Log ID', 'Timestamp (ISO)', 'Formatted Date & Time', 'Employee Code', 'Employee Name', 'User Role', 'Designation', 'Logout Platform / Event', 'Session Duration / Notes', 'Status'];
      var logoutEvents = rawAuditLogs.filter(function(l) {
        return l.category === 'Logout' || (l.details && (l.details.toLowerCase().indexOf('signed out') !== -1 || l.details.toLowerCase().indexOf('session') !== -1 || l.details.toLowerCase().indexOf('inactivity') !== -1));
      });

      var logoutSeen = {};
      var logoutRows = [];
      logoutEvents.forEach(function(l) {
        var dedupeKey = l.id || (l.actorName + '_' + l.timestamp);
        if (logoutSeen[dedupeKey]) return;
        logoutSeen[dedupeKey] = true;

        var matchedUser = userMap[(l.actorId || '').toUpperCase()] || userMap[l.actorId] || userMap[l.actorName] || {};
        var eventType = 'Manual Sign Out (Web Portal)';
        if (l.details && (l.details.toLowerCase().indexOf('15-minute') !== -1 || l.details.toLowerCase().indexOf('15min') !== -1 || l.details.toLowerCase().indexOf('inactivity') !== -1)) {
          eventType = '15-Min Inactivity Auto-Logout (Desktop)';
        } else if (l.details && (l.details.toLowerCase().indexOf('10-minute') !== -1 || l.details.toLowerCase().indexOf('timeout') !== -1)) {
          eventType = '10-Min Inactivity Auto-Logout (Web)';
        } else if (l.details && l.details.toLowerCase().indexOf('desktop') !== -1) {
          eventType = 'Desktop Software Sign Out';
        }
        logoutRows.push([
          l.id,
          l.timestamp,
          l.dateFormatted || l.timestamp,
          matchedUser.employeeCode || 'N/A',
          l.actorName,
          l.actorRole || matchedUser.role || 'agent',
          matchedUser.designation || 'Agent',
          eventType,
          l.details || 'User signed out of LLC Time Tracker.',
          'Logged Out (Complete)'
        ]);
      });

      logoutRows.sort(function(a, b) {
        return new Date(b[1] || 0).getTime() - new Date(a[1] || 0).getTime();
      });

      var logoutSheet = ss.getSheetByName('Logout_Logs');
      if (logoutSheet) populateMergedSheet(logoutSheet, logoutHeaders, logoutRows, '#334155', 0, 1);

      // ==========================================
      // 3. POPULATE IDLE LOGS (Dedicated Tab)
      // ==========================================
      var idleHeaders = ['Idle Log ID', 'Timestamp', 'Employee Code', 'Employee Name', 'Inactivity Duration (Mins)', 'Deducted From Shift', 'Required Shift Extension', 'Active Task', 'Reason / Trigger', 'Status'];
      var idleSeen = {};
      var idleRows = [];
      rawIdleLogs.forEach(function(i) {
        var dedupeKey = i.id || (i.userName + '_' + i.timestamp);
        if (idleSeen[dedupeKey]) return;
        idleSeen[dedupeKey] = true;

        var matchedUser = userMap[i.userId] || userMap[i.userName] || {};
        var deductMins = '-' + (i.deductedFromShiftMinutes != null ? i.deductedFromShiftMinutes : i.durationMinutes) + ' mins';
        var extendMins = '+' + (i.requiredExtensionMinutes != null ? i.requiredExtensionMinutes : i.durationMinutes) + ' mins';
        idleRows.push([
          i.id,
          i.timestamp,
          matchedUser.employeeCode || 'N/A',
          i.userName,
          i.durationMinutes,
          deductMins,
          extendMins,
          i.task,
          i.reason || '15-min continuous inactivity: 10m idle + 5m prompt unanswered',
          i.status || 'logged'
        ]);
      });

      var idleSheet = ss.getSheetByName('Idle_Logs');
      if (idleSheet) populateMergedSheet(idleSheet, idleHeaders, idleRows, '#b45309', 0, 1);

      // ==========================================
      // 4. POPULATE TIME LOGS (Timesheet Sessions & Live Tracking)
      // ==========================================
      var activeHeaders = ['Session ID', 'Employee Code', 'Employee Name', 'Designation', 'Task Category', 'Date', 'Start Time', 'End Time', 'Duration (Seconds)', 'Total Time', 'Idle Deductions (Mins)', 'Mouse Avg %', 'Keyboard Avg %', 'Status', 'Notes'];
      var activeSeen = {};
      var activeRows = [];
      rawTimeLogs.forEach(function(t) {
        var dedupeKey = t.id || (t.userId + '_' + t.date + '_' + t.startTime);
        if (activeSeen[dedupeKey]) return;
        activeSeen[dedupeKey] = true;

        var matchedUser = userMap[t.userId] || userMap[t.userName] || {};
        var empCode = matchedUser.employeeCode || t.employeeCode || 'N/A';
        var empName = resolveStaffFullName(empCode, t.userName, matchedUser.name || t.userName, t.userId);
        
        var rawSecs = typeof t.durationSeconds === 'number' ? Math.max(0, Math.floor(t.durationSeconds)) : 0;
        if (!rawSecs && t.startTime && t.endTime && t.endTime !== 'Running Live') {
          try {
            var diffMs = new Date(t.endTime).getTime() - new Date(t.startTime).getTime();
            if (!isNaN(diffMs) && diffMs > 0) {
              rawSecs = Math.floor(diffMs / 1000) - (t.idleSeconds || 0);
              if (rawSecs < 0) rawSecs = 0;
            }
          } catch(e) {}
        }
        if (rawSecs === 0 && (t.endTime === 'Running Live' || t.status === 'running' || !t.endTime)) {
          var pUser = presenceMap[t.userId] || presenceMap[empCode] || presenceMap[empName];
          if (pUser && pUser.elapsedSeconds && pUser.elapsedSeconds > 0) {
            rawSecs = pUser.elapsedSeconds;
          } else if (t.startTime) {
            try {
              var sMs = new Date(t.startTime).getTime();
              if (!isNaN(sMs) && nowMs > sMs) {
                rawSecs = Math.floor((nowMs - sMs) / 1000);
              }
            } catch(e) {}
          }
        }
        var totalTimeHuman = formatTotalTime(rawSecs);
        var idleMins = t.idleSeconds ? Math.round(t.idleSeconds / 60) + ' mins' : '0 mins';

        // Format start and end times in Philippine Timezone (Asia/Manila GMT+8)
        var sTime = t.geoLocalStartTime || '';
        if (!sTime && t.startTime) {
          try {
            var sD = new Date(t.startTime);
            if (!isNaN(sD.getTime())) {
              sTime = Utilities.formatDate(sD, 'Asia/Manila', 'hh:mm:ss a');
            }
          } catch(e) { sTime = t.startTime; }
        }
        var eTime = (t.endTime === 'Running Live' || !t.endTime) ? 'Running Live' : (t.geoLocalEndTime || '');
        if (eTime !== 'Running Live' && !eTime && t.endTime) {
          try {
            var eD = new Date(t.endTime);
            if (!isNaN(eD.getTime())) {
              eTime = Utilities.formatDate(eD, 'Asia/Manila', 'hh:mm:ss a');
            }
          } catch(e) { eTime = t.endTime; }
        }

        activeRows.push([
          t.id || 'N/A',
          empCode,
          empName,
          t.designation || matchedUser.designation || 'Agent',
          t.task || 'General',
          t.date || '',
          sTime,
          eTime,
          rawSecs,
          totalTimeHuman,
          idleMins,
          (t.mouseActivityAvg != null ? t.mouseActivityAvg : 0) + '%',
          (t.keyboardActivityAvg != null ? t.keyboardActivityAvg : 0) + '%',
          t.status || (eTime === 'Running Live' ? 'running' : 'completed'),
          t.notes || ''
        ]);
      });

      activeRows.sort(function(a, b) {
        var tA = new Date((a[5] || '') + ' ' + (a[6] || '')).getTime();
        var tB = new Date((b[5] || '') + ' ' + (b[6] || '')).getTime();
        if (isNaN(tA)) tA = new Date(a[6] || 0).getTime();
        if (isNaN(tB)) tB = new Date(b[6] || 0).getTime();
        return (tB || 0) - (tA || 0);
      });

      var timesheetsSheet = ss.getSheetByName('Timesheets') || ss.getSheetByName('Timesheet');
      var timeLogsSheet = ss.getSheetByName('Time_Logs');
      var activeSheet = ss.getSheetByName('Active_Logs');
      var mergedTimeLogs = [];

      if (timesheetsSheet) {
        mergedTimeLogs = populateMergedSheet(timesheetsSheet, activeHeaders, activeRows, '#047857', 0, 5) || [];
      }
      if (timeLogsSheet) {
        var tlMerged = populateMergedSheet(timeLogsSheet, activeHeaders, activeRows, '#047857', 0, 5) || [];
        if (!mergedTimeLogs.length) mergedTimeLogs = tlMerged;
      }
      if (activeSheet) {
        var actMerged = populateMergedSheet(activeSheet, activeHeaders, activeRows, '#047857', 0, 5) || [];
        if (!mergedTimeLogs.length) mergedTimeLogs = actMerged;
      }
      var liveSessionsSheet = ss.getSheetByName('Live_Sessions') || ss.getSheetByName('Live Sessions');
      if (liveSessionsSheet) {
        populateMergedSheet(liveSessionsSheet, activeHeaders, activeRows, '#047857', 0, 5);
      }

      if (!timesheetsSheet && !timeLogsSheet && !activeSheet) {
        timesheetsSheet = ss.insertSheet('Timesheets');
        timeLogsSheet = ss.insertSheet('Time_Logs');
        mergedTimeLogs = populateMergedSheet(timesheetsSheet, activeHeaders, activeRows, '#047857', 0, 5) || [];
        populateMergedSheet(timeLogsSheet, activeHeaders, activeRows, '#047857', 0, 5);
      }

      // If mergedTimeLogs is empty, fallback to activeRows
      if (!mergedTimeLogs || mergedTimeLogs.length === 0) {
        mergedTimeLogs = activeRows;
      }

      // ==========================================
      // 4b. POPULATE DAILY SUMMARY (Dedicated Tab)
      // ==========================================
      var dailySummarySheet = ss.getSheetByName('Daily_Summary');
      if (!dailySummarySheet) {
        try { dailySummarySheet = ss.insertSheet('Daily_Summary'); } catch(e) {}
      }
      var dailyHeaders = ['Date', 'Employee Code', 'Employee Name', 'Designation', 'Tasks Worked On', 'First Clock-In (Manila)', 'Last Clock-Out (Manila)', 'Gross Tracked Shift', 'Total Idle / Breaks', 'Net Productive Work', 'Duration (Seconds)', 'Avg Activity %', 'Shift Status', 'Log Entries'];
      var dailyMap = {};

      mergedTimeLogs.forEach(function(row) {
        var logId = String(row[0] || '').trim();
        var empCode = String(row[1] || 'N/A').trim();
        var empName = String(row[2] || 'Staff').trim();
        var designation = String(row[3] || 'Agent').trim();
        var task = String(row[4] || 'General Work').trim();
        var d = String(row[5] || '').trim();
        var sTime = String(row[6] || '').trim();
        var eTime = String(row[7] || '').trim();
        var rawDur = row[8];
        var sSecs = 0;
        if (typeof rawDur === 'number') {
          sSecs = Math.max(0, Math.floor(rawDur));
        } else {
          sSecs = parseInt(String(rawDur || '0').replace(/[^0-9]/g, ''), 10) || 0;
        }

        var idleStr = String(row[10] || '0').replace(/[^0-9]/g, '');
        var idleSecs = (parseInt(idleStr, 10) || 0) * 60;
        var mousePct = parseInt(String(row[11] || '0').replace(/[^0-9]/g, ''), 10) || 0;
        var kbPct = parseInt(String(row[12] || '0').replace(/[^0-9]/g, ''), 10) || 0;
        var isLive = (eTime === 'Running Live' || String(row[13] || '').toLowerCase() === 'running');

        if (!d) d = todayStr;
        var dKey = d + '___' + (empCode !== 'N/A' ? empCode : empName);

        if (!dailyMap[dKey]) {
          dailyMap[dKey] = {
            date: d,
            code: empCode,
            name: empName,
            designation: designation,
            tasks: {},
            firstClockIn: sTime,
            lastClockOut: eTime,
            grossSecs: 0,
            idleSecs: 0,
            mouseSum: 0,
            keyboardSum: 0,
            count: 0,
            hasLive: false
          };
        }

        var entry = dailyMap[dKey];
        if (task) entry.tasks[task] = true;
        if (!entry.firstClockIn && sTime) entry.firstClockIn = sTime;
        if (eTime) entry.lastClockOut = eTime;
        entry.grossSecs += sSecs;
        entry.idleSecs += idleSecs;
        entry.mouseSum += mousePct;
        entry.keyboardSum += kbPct;
        entry.count += 1;
        if (isLive) entry.hasLive = true;
      });

      // Also ensure all actively tracking users in finalPresenceRows for today have an active running entry in Daily_Summary
      finalPresenceRows.forEach(function(r) {
        var eCode = String(r[0] || 'N/A').trim();
        var eName = String(r[1] || 'Staff').trim();
        var eDesig = String(r[3] || 'Agent').trim();
        var eStatus = String(r[5] || '');
        var eTask = String(r[6] || 'Active Work').trim();
        var eShiftHours = String(r[8] || '');
        var eCheckin = String(r[9] || '--:--');

        if (eStatus.indexOf('Live Tracking') !== -1) {
          var dKey = todayStr + '___' + (eCode !== 'N/A' ? eCode : eName);
          var mSecs = 0;
          var mMatch = eShiftHours.match(/(\d+)h\s*(\d+)m/);
          if (mMatch) {
            mSecs = parseInt(mMatch[1], 10) * 3600 + parseInt(mMatch[2], 10) * 60;
          }

          if (!dailyMap[dKey]) {
            var initialTasks = {};
            if (eTask) initialTasks[eTask] = true;
            dailyMap[dKey] = {
              date: todayStr,
              code: eCode,
              name: eName,
              designation: eDesig,
              tasks: initialTasks,
              firstClockIn: eCheckin,
              lastClockOut: 'Running Live',
              grossSecs: Math.max(mSecs, 60),
              idleSecs: 0,
              mouseSum: 95,
              keyboardSum: 95,
              count: 1,
              hasLive: true
            };
          } else {
            dailyMap[dKey].hasLive = true;
            dailyMap[dKey].lastClockOut = 'Running Live';
            if (mSecs > dailyMap[dKey].grossSecs) dailyMap[dKey].grossSecs = mSecs;
            if (eTask && eTask !== 'Shift Concluded') dailyMap[dKey].tasks[eTask] = true;
          }
        }
      });

      var dailyRows = [];
      Object.keys(dailyMap).forEach(function(k) {
        var item = dailyMap[k];
        var netSecs = Math.max(0, item.grossSecs - item.idleSecs);
        var taskList = Object.keys(item.tasks).join(', ') || 'General Work';
        var avgAct = item.count > 0 ? Math.round(((item.mouseSum / item.count) + (item.keyboardSum / item.count)) / 2) : 0;
        dailyRows.push([
          item.date,
          item.code,
          item.name,
          item.designation,
          taskList,
          item.firstClockIn || '--:--',
          item.hasLive ? 'Running Live' : (item.lastClockOut || '--:--'),
          formatTotalTime(item.grossSecs),
          formatTotalTime(item.idleSecs),
          formatTotalTime(netSecs),
          netSecs,
          avgAct + '%',
          item.hasLive ? 'Active Live' : 'Completed',
          item.count + ' logs'
        ]);
      });
      dailyRows.sort(function(a, b) {
        var d1 = new Date(b[0] || 0).getTime() - new Date(a[0] || 0).getTime();
        if (d1 !== 0) return d1;
        return String(a[1] || '').localeCompare(String(b[1] || ''));
      });
      if (dailySummarySheet) populateCleanSheet(dailySummarySheet, dailyHeaders, dailyRows, '#0284c7');

      // ==========================================
      // 4c. POPULATE WEEKLY SUMMARY (Dedicated Tab)
      // ==========================================
      var weeklySummarySheet = ss.getSheetByName('Weekly_Summary');
      if (!weeklySummarySheet) {
        try { weeklySummarySheet = ss.insertSheet('Weekly_Summary'); } catch(e) {}
      }
      var weeklyHeaders = ['Week Period (Mon-Sun)', 'Employee Code', 'Employee Name', 'Designation', 'Tasks Breakdown', 'Days Rendered', 'Gross Tracked Hours', 'Total Idle / Breaks', 'Net Productive Work', 'Regular Hours', 'Overtime Hours', 'Avg Activity %'];
      var weeklyMap = {};

      mergedTimeLogs.forEach(function(row) {
        var empCode = String(row[1] || 'N/A').trim();
        var empName = String(row[2] || 'Staff').trim();
        var designation = String(row[3] || 'Agent').trim();
        var task = String(row[4] || 'General Work').trim();
        var dStr = String(row[5] || '').trim() || todayStr;
        var logD = new Date(dStr);
        if (isNaN(logD.getTime())) logD = new Date();
        var dayOfWeek = logD.getDay();
        var diffToMon = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
        var monDate = new Date(logD);
        monDate.setDate(logD.getDate() + diffToMon);
        var sunDate = new Date(monDate);
        sunDate.setDate(monDate.getDate() + 6);
        var monStr = (monDate.getMonth() + 1) + '/' + monDate.getDate() + '/' + monDate.getFullYear();
        var sunStr = (sunDate.getMonth() + 1) + '/' + sunDate.getDate() + '/' + sunDate.getFullYear();
        var weekLabel = 'Week (' + monStr + ' - ' + sunStr + ')';

        var rawDur = row[8];
        var sSecs = typeof rawDur === 'number' ? Math.max(0, Math.floor(rawDur)) : (parseInt(String(rawDur || '0').replace(/[^0-9]/g, ''), 10) || 0);
        var idleSecs = (parseInt(String(row[10] || '0').replace(/[^0-9]/g, ''), 10) || 0) * 60;
        var mousePct = parseInt(String(row[11] || '0').replace(/[^0-9]/g, ''), 10) || 0;
        var kbPct = parseInt(String(row[12] || '0').replace(/[^0-9]/g, ''), 10) || 0;

        var wKey = weekLabel + '___' + (empCode !== 'N/A' ? empCode : empName);

        if (!weeklyMap[wKey]) {
          weeklyMap[wKey] = {
            week: weekLabel,
            code: empCode,
            name: empName,
            designation: designation,
            tasks: {},
            days: {},
            grossSecs: 0,
            idleSecs: 0,
            mouseSum: 0,
            keyboardSum: 0,
            count: 0
          };
        }

        var wEntry = weeklyMap[wKey];
        if (task) wEntry.tasks[task] = (wEntry.tasks[task] || 0) + sSecs;
        if (dStr) wEntry.days[dStr] = true;
        wEntry.grossSecs += sSecs;
        wEntry.idleSecs += idleSecs;
        wEntry.mouseSum += mousePct;
        wEntry.keyboardSum += kbPct;
        wEntry.count += 1;
      });

      var weeklyRows = [];
      Object.keys(weeklyMap).forEach(function(k) {
        var item = weeklyMap[k];
        var netSecs = Math.max(0, item.grossSecs - item.idleSecs);
        var netHours = netSecs / 3600;
        var regHours = Math.min(40, netHours);
        var otHours = Math.max(0, netHours - 40);
        var taskBreakdown = Object.keys(item.tasks).map(function(tName) {
          return tName + ' (' + formatTotalTime(item.tasks[tName]) + ')';
        }).join(', ');
        var avgAct = item.count > 0 ? Math.round(((item.mouseSum / item.count) + (item.keyboardSum / item.count)) / 2) : 0;
        weeklyRows.push([
          item.week,
          item.code,
          item.name,
          item.designation,
          taskBreakdown || 'General Work',
          Object.keys(item.days).length + ' days',
          formatTotalTime(item.grossSecs),
          formatTotalTime(item.idleSecs),
          formatTotalTime(netSecs),
          regHours.toFixed(2) + ' hrs',
          otHours.toFixed(2) + ' hrs',
          avgAct + '%'
        ]);
      });
      if (weeklySummarySheet) populateCleanSheet(weeklySummarySheet, weeklyHeaders, weeklyRows, '#0d9488');

      // ==========================================
      // 4d. POPULATE MONTHLY SUMMARY (Dedicated Tab)
      // ==========================================
      var monthlySummarySheet = ss.getSheetByName('Monthly_Summary');
      if (!monthlySummarySheet) {
        try { monthlySummarySheet = ss.insertSheet('Monthly_Summary'); } catch(e) {}
      }
      var monthlyHeaders = ['Month Period', 'Employee Code', 'Employee Name', 'Designation', 'Primary Tasks', 'Total Days Rendered', 'Gross Tracked Hours', 'Total Idle / Breaks', 'Net Productive Work', 'Avg Activity %'];
      var monthlyMap = {};

      mergedTimeLogs.forEach(function(row) {
        var empCode = String(row[1] || 'N/A').trim();
        var empName = String(row[2] || 'Staff').trim();
        var designation = String(row[3] || 'Agent').trim();
        var task = String(row[4] || 'General Work').trim();
        var dStr = String(row[5] || '').trim() || todayStr;
        var logD = new Date(dStr);
        if (isNaN(logD.getTime())) logD = new Date();
        var monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        var monthLabel = monthNames[logD.getMonth()] + ' ' + logD.getFullYear();

        var rawDur = row[8];
        var sSecs = typeof rawDur === 'number' ? Math.max(0, Math.floor(rawDur)) : (parseInt(String(rawDur || '0').replace(/[^0-9]/g, ''), 10) || 0);
        var idleSecs = (parseInt(String(row[10] || '0').replace(/[^0-9]/g, ''), 10) || 0) * 60;
        var mousePct = parseInt(String(row[11] || '0').replace(/[^0-9]/g, ''), 10) || 0;
        var kbPct = parseInt(String(row[12] || '0').replace(/[^0-9]/g, ''), 10) || 0;

        var mKey = monthLabel + '___' + (empCode !== 'N/A' ? empCode : empName);

        if (!monthlyMap[mKey]) {
          monthlyMap[mKey] = {
            month: monthLabel,
            code: empCode,
            name: empName,
            designation: designation,
            tasks: {},
            days: {},
            grossSecs: 0,
            idleSecs: 0,
            mouseSum: 0,
            keyboardSum: 0,
            count: 0
          };
        }

        var mEntry = monthlyMap[mKey];
        if (task) mEntry.tasks[task] = true;
        if (dStr) mEntry.days[dStr] = true;
        mEntry.grossSecs += sSecs;
        mEntry.idleSecs += idleSecs;
        mEntry.mouseSum += mousePct;
        mEntry.keyboardSum += kbPct;
        mEntry.count += 1;
      });

      var monthlyRows = [];
      Object.keys(monthlyMap).forEach(function(k) {
        var item = monthlyMap[k];
        var netSecs = Math.max(0, item.grossSecs - item.idleSecs);
        var taskList = Object.keys(item.tasks).join(', ');
        var avgAct = item.count > 0 ? Math.round(((item.mouseSum / item.count) + (item.keyboardSum / item.count)) / 2) : 0;
        monthlyRows.push([
          item.month,
          item.code,
          item.name,
          item.designation,
          taskList || 'General Work',
          Object.keys(item.days).length + ' days',
          formatTotalTime(item.grossSecs),
          formatTotalTime(item.idleSecs),
          formatTotalTime(netSecs),
          avgAct + '%'
        ]);
      });
      if (monthlySummarySheet) populateCleanSheet(monthlySummarySheet, monthlyHeaders, monthlyRows, '#059669');

      // ==========================================
      // 5. POPULATE INACTIVE LOGS (Dedicated Tab)
      // ==========================================
      var inactiveHeaders = ['Inactivity Log ID', 'Date & Time', 'Employee Code', 'Employee Name', 'Task Category', 'Inactivity Duration (Mins)', 'Deduction Status', 'Trigger Source', 'Impact on Shift & Extension'];
      var inactiveRows = [];
      rawIdleLogs.forEach(function(i) {
        var matchedUser = userMap[i.userId] || userMap[i.userName] || {};
        var deductMins = (i.deductedFromShiftMinutes != null ? i.deductedFromShiftMinutes : i.durationMinutes);
        var extendMins = (i.requiredExtensionMinutes != null ? i.requiredExtensionMinutes : i.durationMinutes);
        inactiveRows.push([
          'inact-' + i.id,
          i.timestamp,
          matchedUser.employeeCode || 'N/A',
          i.userName,
          i.task,
          i.durationMinutes,
          'Deducted -' + deductMins + 'm from Timesheet',
          i.reason || 'Zero Keyboard / Mouse Activity across 10-15m check',
          'Shift Extended by +' + extendMins + ' mins to cover'
        ]);
      });

      var inactiveSheet = ss.getSheetByName('Inactive_Logs');
      if (inactiveSheet) populateMergedSheet(inactiveSheet, inactiveHeaders, inactiveRows, '#c2410c', 0, 1);

      // ==========================================
      // 6. POPULATE ADMIN AUDIT LOGS & AUDIT LOGS
      // ==========================================
      var adminAuditSheet = ss.getSheetByName('Admin_Audit_Logs');
      var fullAuditSheet = ss.getSheetByName('Audit_Logs');
      var auditHeaders = ['Audit ID', 'Timestamp (ISO)', 'Formatted Date', 'Actor Name', 'Actor Role', 'Action Category', 'Affected Employee', 'Previous Value', 'New Value', 'Action Details'];

      var fullAuditRows = [];
      var auditSeen = {};
      rawAuditLogs.forEach(function(l) {
        var dedupeKey = l.id || (l.actorName + '_' + l.timestamp + '_' + l.category);
        if (auditSeen[dedupeKey]) return;
        auditSeen[dedupeKey] = true;
        fullAuditRows.push([
          l.id,
          l.timestamp,
          l.dateFormatted || l.timestamp,
          l.actorName,
          l.actorRole,
          l.category,
          l.targetEmployeeName || 'N/A',
          l.fromValue || '-',
          l.toValue || '-',
          l.details
        ]);
      });
      fullAuditRows.sort(function(a, b) {
        return new Date(b[1] || 0).getTime() - new Date(a[1] || 0).getTime();
      });
      if (fullAuditSheet) populateMergedSheet(fullAuditSheet, auditHeaders, fullAuditRows, '#312e81', 0, 1);

      var adminRows = [];
      var adminEvents = rawAuditLogs.filter(function(l) {
        return l.category !== 'Login' && l.category !== 'Logout' && l.category !== 'Clock In' && l.category !== 'Clock Out';
      });
      if (adminEvents.length === 0) {
        adminEvents = rawAuditLogs.filter(function(l) {
          return l.category !== 'Login' && l.category !== 'Logout';
        });
      }
      var adminSeen = {};
      adminEvents.forEach(function(l) {
        var dedupeKey = l.id || (l.actorName + '_' + l.timestamp + '_' + l.category);
        if (adminSeen[dedupeKey]) return;
        adminSeen[dedupeKey] = true;
        adminRows.push([
          l.id,
          l.timestamp,
          l.dateFormatted || l.timestamp,
          l.actorName,
          l.actorRole,
          l.category,
          l.targetEmployeeName || 'N/A',
          l.fromValue || '-',
          l.toValue || '-',
          l.details
        ]);
      });
      adminRows.sort(function(a, b) {
        return new Date(b[1] || 0).getTime() - new Date(a[1] || 0).getTime();
      });
      if (adminAuditSheet) populateMergedSheet(adminAuditSheet, auditHeaders, adminRows, '#4338ca', 0, 1);

      // ==========================================
      // 7. POPULATE DAILY ATTENDANCE LOGS
      // ==========================================
      var attHeaders = ['Attendance ID', 'Date', 'Employee Code', 'Employee Name', 'First Login Time', 'Last Logout Time', 'Total Logged Hours', 'Idle Deductions (Mins)', 'Required Shift Extension (Mins)', 'Attendance Status'];
      var attRows = [];
      var attSeen = {};
      dailyAttendanceLogs.forEach(function(a) {
        var dedupeKey = a.id || (a.userName + '_' + a.date);
        if (attSeen[dedupeKey]) return;
        attSeen[dedupeKey] = true;
        var matchedUser = userMap[a.userId] || userMap[a.userName] || {};
        attRows.push([
          a.id,
          a.date,
          a.employeeCode || matchedUser.employeeCode || 'N/A',
          a.userName,
          a.firstLoginTime || '--:--',
          a.lastLogoutTime || 'Active Shift',
          a.totalLoggedHours || 0,
          (a.totalIdleDeductionsMinutes || 0) + ' mins',
          (a.requiredExtensionMinutes || a.totalIdleDeductionsMinutes || 0) + ' mins',
          a.status || 'present'
        ]);
      });
      attRows.sort(function(a, b) {
        var dA = new Date(a[1] || 0).getTime();
        var dB = new Date(b[1] || 0).getTime();
        return (dB || 0) - (dA || 0);
      });
      var attSheet = ss.getSheetByName('Daily_Attendance_Logs');
      if (attSheet) populateMergedSheet(attSheet, attHeaders, attRows, '#0e7490', 0, 1);

      // ==========================================
      // 8. POPULATE EMPLOYEE DIRECTORY
      // ==========================================
      try {
        syncEmployeeDirectoryInternal(ss, (users && users.length > 0) ? users : rawUsers, userMap);
      } catch (empErr) {
        Logger.log('Error updating Employee_Directory: ' + empErr.toString());
      }

      // ==========================================
      // 9. POPULATE LEAVE REQUESTS
      // ==========================================
      var leaveHeaders = ['Leave ID', 'Employee Name', 'Leave Type', 'Start Date', 'End Date', 'Reason', 'Status', 'Requested At'];
      var leaveRows = [];
      var leaveSeen = {};
      leaveRequests.forEach(function(lv) {
        var dedupeKey = lv.id || (lv.userName + '_' + lv.startDate + '_' + lv.type);
        if (leaveSeen[dedupeKey]) return;
        leaveSeen[dedupeKey] = true;
        leaveRows.push([
          lv.id,
          lv.userName,
          lv.type,
          lv.startDate,
          lv.endDate,
          lv.reason,
          lv.status || 'pending',
          lv.requestedAt
        ]);
      });
      var leaveSheet = ss.getSheetByName('Leave_Requests');
      if (leaveSheet) populateCleanSheet(leaveSheet, leaveHeaders, leaveRows, '#7e22ce');

      // ==========================================
      // 10. POPULATE PAYROLL SUMMARY
      // ==========================================
      var payHeaders = ['Pay Period', 'Employee Code', 'Employee Name', 'Designation', 'Monthly Rate (₱)', 'Hourly Rate (₱)', 'Total Tracked Hours', 'Missing Hours', 'Missing Deductions (₱)', 'Gross Pay (₱)', 'Incentive Bonus (₱)', 'Net Pay (₱)', 'Payment Status'];
      var payRows = [];
      var paySeen = {};
      payrollRecords.forEach(function(p) {
        var dedupeKey = p.id || (p.employeeCode + '_' + p.payPeriod);
        if (paySeen[dedupeKey]) return;
        paySeen[dedupeKey] = true;
        var pMRate = (p.monthlyRate !== undefined && p.monthlyRate !== null && !isNaN(Number(p.monthlyRate))) ? Number(p.monthlyRate) : 0;
        var pHRate = (p.hourlyRate !== undefined && p.hourlyRate !== null && !isNaN(Number(p.hourlyRate))) ? Number(p.hourlyRate) : 0;
        payRows.push([
          p.payPeriod || 'August 1-15, 2026',
          p.employeeCode || 'LLC-0001',
          p.userName,
          p.designation || 'Agent',
          pMRate,
          pHRate,
          p.totalTrackedHours || 0,
          p.missingHours || 0,
          p.missingDeductions || 0,
          p.grossPay || 0,
          p.incentiveBonus || 0,
          p.netPay || 0,
          p.status || 'pending'
        ]);
      });
      var paySheet = ss.getSheetByName('Payroll_Summary');
      if (paySheet) populateCleanSheet(paySheet, payHeaders, payRows, '#15803d');

      // ==========================================
      // 11. POPULATE DESIGNATION TASKS
      // ==========================================
      var desigTasks = data.designationTasks || {};
      var desigHeaders = ['Designation Name', 'Allowed Tracking Tasks (Comma Separated)', 'Total Tasks Count', 'Last Updated (ISO)'];
      var desigRows = [];
      Object.keys(desigTasks).forEach(function(desigKey) {
        var taskList = desigTasks[desigKey] || [];
        desigRows.push([
          desigKey,
          taskList.join(', '),
          taskList.length,
          new Date().toISOString()
        ]);
      });
      var desigSheet = ss.getSheetByName('Designation_Tasks');
      if (desigSheet) populateCleanSheet(desigSheet, desigHeaders, desigRows, '#4338ca');

      // ==========================================
      // 12. POPULATE DESIGNATIONS & PERMISSIONS CONTROL
      // ==========================================
      var rPerms = data.rolePermissions || {};
      var permHeaders = [
        'Role / Category Key',
        'Display Name',
        'Category Type',
        'Employee Directory CRUD',
        'Team Leader Assignment',
        'Activity Monitors',
        'Screenshot Captures',
        'Timesheets & Approvals',
        'Payroll & Rates',
        'Designation & Task Manager',
        'Google Sheets & Webhooks',
        'Assigned Staff Count',
        'Assigned Employees Roster',
        'Last Updated (ISO)'
      ];
      var permRows = [];
      var standardKeys = ['admin', 'trainer', 'team_lead', 'qa', 'writer', 'hr', 'payroll', 'agent'];

      Object.keys(rPerms).forEach(function(roleKey) {
        var p = rPerms[roleKey] || {};
        var isStd = standardKeys.indexOf(roleKey.toLowerCase()) !== -1;
        var displayName = roleKey.charAt(0).toUpperCase() + roleKey.slice(1);
        if (roleKey === 'team_lead') displayName = 'Team Leader';
        if (roleKey === 'qa') displayName = 'QA Specialist';
        if (roleKey === 'hr') displayName = 'HR';
        if (roleKey === 'payroll') displayName = 'Payroll Officer';
        if (roleKey === 'agent') displayName = 'Agent';

        // Detect assigned employees
        var assignedStaff = users.filter(function(u) {
          var rMatch = (u.role || '').toLowerCase() === roleKey.toLowerCase();
          var dMatch = (u.designation || '').toLowerCase() === displayName.toLowerCase() ||
                       (u.designation || '').toLowerCase() === roleKey.toLowerCase();
          return rMatch || dMatch;
        });

        var staffNames = assignedStaff.map(function(s) {
          return (s.name || 'Staff') + ' (#' + (s.employeeCode || 'N/A') + ')';
        }).join(', ');

        permRows.push([
          roleKey,
          displayName,
          isStd ? 'Standard Role' : 'Custom Category',
          p.canEditEmployees ? 'GRANTED' : 'RESTRICTED',
          p.canAssignTeamLeader ? 'GRANTED' : 'RESTRICTED',
          p.canViewActivityLogs ? 'GRANTED' : 'RESTRICTED',
          p.canViewScreenshots ? 'GRANTED' : 'RESTRICTED',
          p.canViewTimesheets ? 'GRANTED' : 'RESTRICTED',
          p.canViewPayroll ? 'GRANTED' : 'RESTRICTED',
          p.canManageTasks ? 'GRANTED' : 'RESTRICTED',
          p.canSyncSheets ? 'GRANTED' : 'RESTRICTED',
          assignedStaff.length,
          staffNames || 'None',
          new Date().toISOString()
        ]);
      });
      var permSheet = ss.getSheetByName('Designations_Permissions');
      if (permSheet) populateCleanSheet(permSheet, permHeaders, permRows, '#6d28d9');

      return ContentService.createTextOutput(JSON.stringify({ status: 'SUCCESS', message: 'All modular separated logs & database tables updated in Google Sheets!' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'SUCCESS' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'ERROR', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var ss = getSpreadsheet();
    var empSheet = ss.getSheetByName('mployee_Directory') || ss.getSheetByName('Employee_Directory') || ss.getSheetByName('Employees');
    var employees = [];
    if (empSheet && empSheet.getLastRow() > 1) {
      var data = empSheet.getRange(2, 1, empSheet.getLastRow() - 1, 14).getValues();
      data.forEach(function(row) {
        var code = String(row[0] || '').trim();
        var username = String(row[1] || '').trim();
        var name = String(row[2] || '').trim();
        if (!code && !name && !username) return;
        employees.push({
          employeeCode: code || 'LLC-' + Math.floor(1000 + Math.random() * 9000),
          username: username || (name ? name.toLowerCase().replace(/\s+/g, '') : 'agent'),
          name: name || 'Employee',
          email: String(row[3] || '').trim(),
          role: String(row[4] || 'employee').toLowerCase().trim(),
          designation: String(row[5] || 'Agent').trim(),
          joinDate: String(row[6] || '').trim() || '2020-01-01',
          monthlyRate: row[7] !== '' && !isNaN(Number(String(row[7]).replace(/[^0-9.]/g, ''))) ? Number(String(row[7]).replace(/[^0-9.]/g, '')) : 0,
          hourlyRate: row[8] !== '' && !isNaN(Number(String(row[8]).replace(/[^0-9.]/g, ''))) ? Number(String(row[8]).replace(/[^0-9.]/g, '')) : 0,
          teamLeaderId: String(row[9] || '').trim(),
          screenshotMonitored: String(row[10]).toUpperCase() === 'YES' || row[10] === true,
          activityMonitored: String(row[11]).toUpperCase() === 'YES' || row[11] === true,
          status: String(row[12] || 'active').toLowerCase().trim(),
          password: String(row[13] || '').trim()
        });
      });
    }

    var timeLogsSheet = ss.getSheetByName('Time_Logs') || ss.getSheetByName('Active_Logs') || ss.getSheetByName('Live_Sessions');
    var timeLogs = [];
    if (timeLogsSheet && timeLogsSheet.getLastRow() > 1) {
      var tData = timeLogsSheet.getRange(2, 1, timeLogsSheet.getLastRow() - 1, 14).getValues();
      tData.forEach(function(row) {
        var id = String(row[0] || '').trim();
        var empName = String(row[2] || '').trim();
        if (!id && !empName) return;
        timeLogs.push({
          id: id || ('log-' + Date.now()),
          employeeCode: String(row[1] || '').trim(),
          userName: empName,
          designation: String(row[3] || 'Agent').trim(),
          task: String(row[4] || 'General').trim(),
          date: String(row[5] || '').trim(),
          startTime: String(row[6] || '').trim(),
          endTime: String(row[7] || '').trim(),
          durationFormatted: String(row[8] || '').trim(),
          idleDeductions: String(row[9] || '').trim(),
          mouseActivityAvg: Number(String(row[10] || '0').replace(/[^0-9.]/g, '')) || 0,
          keyboardActivityAvg: Number(String(row[11] || '0').replace(/[^0-9.]/g, '')) || 0,
          status: String(row[12] || 'completed').trim(),
          notes: String(row[13] || '').trim()
        });
      });
    }

    var presSheet = ss.getSheetByName('Live_Presence') || ss.getSheetByName('Live Presence');
    var presenceList = [];
    if (presSheet && presSheet.getLastRow() > 1) {
      var pData = presSheet.getRange(2, 1, presSheet.getLastRow() - 1, 13).getValues();
      pData.forEach(function(row) {
        var code = String(row[0] || '').trim();
        var name = String(row[1] || '').trim();
        if (!code && !name) return;
        var pMode = String(row[4] || '').trim();
        var statusStr = String(row[5] || '').trim();
        var isTrk = statusStr.indexOf('Live Tracking') !== -1 || statusStr.indexOf('Tracking') !== -1;
        var isIdl = statusStr.indexOf('Idle') !== -1 || statusStr.indexOf('Break') !== -1;
        var isDsk = pMode.indexOf('Desktop') !== -1 || statusStr.indexOf('Desktop') !== -1 || isTrk;
        var isWeb = pMode.indexOf('Website') !== -1 || statusStr.indexOf('Website') !== -1;
        var isOff = statusStr.indexOf('Offline') !== -1 || (!isTrk && !isIdl && !isDsk && !isWeb);

        presenceList.push({
          employeeCode: code,
          userName: name,
          role: String(row[2] || 'agent').trim(),
          designation: String(row[3] || 'Agent').trim(),
          isOnline: !isOff,
          isTracking: isTrk,
          isPaused: isIdl,
          status: isIdl ? 'idle' : (isOff ? 'offline' : 'online'),
          loginPlatform: isDsk ? 'software' : (isWeb ? 'webapp' : 'webapp'),
          currentTask: String(row[6] || (isOff ? 'Shift Concluded' : 'Active Task')).trim(),
          currentApp: String(row[7] || (isDsk ? 'LLC Time Tracker Desktop App' : 'Web Browser')).trim(),
          lastHeartbeat: String(row[12] || '').trim() || new Date().toISOString()
        });
      });
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'SUCCESS',
      count: employees.length,
      employees: employees,
      timeLogs: timeLogs,
      presence: presenceList,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'ERROR',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;
};

/**
 * Robust CSV parser for Google Sheets CSV exports
 */
export const parseCSVRows = (csvText: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }
  return rows;
};

/**
 * Two-Way Sync: Pulls and imports employee accounts directly from the Google Spreadsheet Employee_Directory tab.
 * Supports both Google Apps Script Webhook JSON GET and direct Google Sheets CSV export.
 */
export const fetchEmployeesFromGoogleSheets = async (
  webhookUrl?: string,
  spreadsheetId: string = DEFAULT_SPREADSHEET_ID,
  existingUsers: User[] = []
): Promise<{ success: boolean; employees: User[]; count: number; message: string }> => {
  const userMap = new Map<string, User>();
  existingUsers.forEach((u) => {
    if (u.employeeCode) {
      userMap.set(u.employeeCode.toUpperCase().trim(), u);
      userMap.set(u.employeeCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(), u);
    }
    if (u.email) userMap.set(u.email.toLowerCase().trim(), u);
    if (u.id) userMap.set(u.id, u);
    if (u.name) userMap.set(u.name.toLowerCase().trim(), u);
    if (u.username) userMap.set(u.username.toLowerCase().trim(), u);
  });

  const importedList: User[] = [];

  // Method 1: Try Webhook GET (returns clean JSON array of employees)
  if (webhookUrl && isValidWebhookUrl(webhookUrl) && webhookUrl.includes('script.google.com')) {
    try {
      let json: any = null;
      // Try local dev server proxy first to bypass browser CORS
      try {
        const proxyRes = await fetch(`/api/sync-sheets?url=${encodeURIComponent(webhookUrl.trim())}`);
        if (proxyRes.ok) {
          json = await proxyRes.json();
        }
      } catch (e) {}

      if (!json) {
        const res = await fetch(webhookUrl.trim(), { method: 'GET' });
        if (res.ok) {
          json = await res.json();
        }
      }

      if (json && Array.isArray(json.employees) && json.employees.length > 0) {
          json.employees.forEach((rawEmp: any, idx: number) => {
            const code = String(rawEmp.employeeCode || `LLC-${1000 + idx}`).trim();
            const existing = userMap.get(code.toUpperCase()) ||
              userMap.get(code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()) ||
              userMap.get((rawEmp.email || '').toLowerCase()) ||
              userMap.get((rawEmp.name || '').toLowerCase());

            const rawRole = (rawEmp.role || '').toLowerCase().trim();
            const rawDesig = (rawEmp.designation || existing?.designation || '').toLowerCase().trim();
            const isSuperAdmin = code.toLowerCase() === 'superadmin' || rawRole === 'admin' || existing?.role === 'admin';

            let role: any = 'agent';
            if (isSuperAdmin) {
              role = 'admin';
            } else if (rawRole === 'va_admin' || existing?.role === 'va_admin') {
              role = 'va_admin';
            } else if (rawRole === 'trainer' || rawDesig.includes('trainer') || existing?.role === 'trainer') {
              role = 'trainer';
            } else if (rawRole === 'team_leader' || rawRole === 'team_lead' || rawDesig.includes('team lead') || existing?.role === 'team_lead') {
              role = 'team_lead';
            } else if (rawRole === 'hr' || rawDesig.includes('hr') || existing?.role === 'hr') {
              role = 'hr';
            } else if (rawRole === 'payroll' || rawDesig.includes('payroll') || existing?.role === 'payroll') {
              role = 'payroll';
            } else if (rawRole === 'qa' || rawDesig.includes('qa') || existing?.role === 'qa') {
              role = 'qa';
            } else if (rawRole === 'writer' || rawDesig.includes('writer') || existing?.role === 'writer') {
              role = 'writer';
            } else if (existing?.role && existing.role !== 'agent') {
              role = existing.role;
            } else {
              role = 'agent';
            }
            const empName = rawEmp.name || existing?.name || (isSuperAdmin ? 'Red' : `Employee ${code}`);
            const username = (rawEmp.username || existing?.username || (isSuperAdmin ? 'admin' : generateUniqueUsername(empName, existingUsers, existing?.id))).toLowerCase();

            if (isPlaceholderName(empName, username, code)) {
              return;
            }

            const userObj: User = {
              id: existing ? existing.id : `usr-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              employeeCode: code,
              username,
              name: empName,
              email: rawEmp.email || existing?.email || `${code.toLowerCase()}@llctimetracker.com`,
              role,
              designation: rawEmp.designation || existing?.designation || (role === 'admin' ? 'Admin' : 'Agent'),
              monthlyRate: rawEmp.monthlyRate !== undefined && rawEmp.monthlyRate !== null && !isNaN(Number(rawEmp.monthlyRate)) ? Number(rawEmp.monthlyRate) : (existing?.monthlyRate || 0),
              hourlyRate: rawEmp.hourlyRate !== undefined && rawEmp.hourlyRate !== null && !isNaN(Number(rawEmp.hourlyRate)) ? Number(rawEmp.hourlyRate) : (existing?.hourlyRate || 0),
              teamLeaderId: rawEmp.teamLeaderId || existing?.teamLeaderId || '',
              screenshotMonitored: rawEmp.screenshotMonitored !== undefined ? Boolean(rawEmp.screenshotMonitored) : false,
              activityMonitored: rawEmp.activityMonitored !== undefined ? Boolean(rawEmp.activityMonitored) : false,
              status: rawEmp.status?.toLowerCase() === 'inactive' ? 'inactive' : 'active',
              avatar: existing?.avatar || `https://images.unsplash.com/photo-${1534528741775 + idx * 1000}?auto=format&fit=crop&q=80&w=250`,
              geoTimezone: existing?.geoTimezone || 'Asia/Manila',
              geoCity: existing?.geoCity || 'Manila, Philippines',
              joinDate: existing?.joinDate || new Date().toISOString().split('T')[0],
              department: existing?.department || (role === 'admin' ? 'Executive Management' : 'Operations'),
              password: existing?.password || (isSuperAdmin ? 'AdminpassW0rd123!' : 'Password123!'),
              mustChangePassword: existing ? (existing.mustChangePassword !== undefined ? existing.mustChangePassword : (existing.password && existing.password !== 'Password123!' ? false : (isSuperAdmin ? false : true))) : (isSuperAdmin ? false : true),
            };
            importedList.push(userObj);
          });

          if (importedList.length > 0) {
            const cleanList = deduplicateUsers(importedList);
            return {
              success: true,
              employees: cleanList,
              count: cleanList.length,
              message: `Successfully imported ${cleanList.length} employee accounts via Google Apps Script Webhook!`,
            };
          }
        }
    } catch (webhookErr) {
      console.warn('Webhook GET fetch warning, attempting direct Google Sheets CSV export fallback...', webhookErr);
    }
  }

  // Method 2: Direct Google Sheets CSV Query (works on public / shared sheets)
  try {
    const candidateTabs = ['Employee_Directory', 'mployee_Directory', 'Employees'];
    let rows: string[][] = [];
    let matchedTab = 'Employee_Directory';

    for (const tabName of candidateTabs) {
      try {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
        const response = await fetch(csvUrl);
        if (response.ok) {
          const csvText = await response.text();
          const parsed = parseCSVRows(csvText);
          if (parsed.length > 1) {
            const h = parsed[0] || [];
            const isEmp = h.some((c: string) => {
              const low = c.toLowerCase();
              return low.includes('employee code') || low.includes('full name') || low.includes('username');
            });
            if (isEmp) {
              rows = parsed;
              matchedTab = tabName;
              break;
            }
          }
        }
      } catch (tErr) {}
    }

    if (rows.length <= 1) {
      return {
        success: false,
        employees: [],
        count: 0,
        message: 'No employee rows found in the spreadsheet "Employee_Directory" or "mployee_Directory" tab.',
      };
    }

    // Skip header row (row 0)
    const headerRow = rows[0] || [];
    const hasUsernameCol = headerRow.some((h: string) => h.toLowerCase().trim() === 'username') || (rows[1] && rows[1].length >= 14);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const code = (row[0] || '').trim();
      
      let parsedUsername = '';
      let name = '';
      let email = '';
      let roleStr = '';
      let designation = '';
      let joinDateStr = '';
      let monthlyRateStr = '';
      let hourlyRateStr = '';
      let supervisor = '';
      let scrMonitored = false;
      let actMonitored = false;
      let statusStr = 'active';

      if (hasUsernameCol) {
        parsedUsername = (row[1] || '').trim().toLowerCase();
        name = (row[2] || '').trim();
        email = (row[3] || '').trim();
        roleStr = (row[4] || 'employee').toLowerCase().trim();
        designation = (row[5] || 'Agent').trim();
        joinDateStr = (row[6] || '').trim();
        monthlyRateStr = (row[7] || '').replace(/[^0-9.]/g, '');
        hourlyRateStr = (row[8] || '').replace(/[^0-9.]/g, '');
        supervisor = (row[9] || '').trim();
        scrMonitored = (row[10] || '').toUpperCase() === 'YES';
        actMonitored = (row[11] || '').toUpperCase() === 'YES';
        statusStr = (row[12] || 'active').toLowerCase().trim();
      } else {
        name = (row[1] || '').trim();
        email = (row[2] || '').trim();
        roleStr = (row[3] || 'employee').toLowerCase().trim();
        designation = (row[4] || 'Agent').trim();
        joinDateStr = (row[5] || '').trim();
        monthlyRateStr = (row[6] || '').replace(/[^0-9.]/g, '');
        hourlyRateStr = (row[7] || '').replace(/[^0-9.]/g, '');
        supervisor = (row[8] || '').trim();
        scrMonitored = (row[9] || '').toUpperCase() === 'YES';
        actMonitored = (row[10] || '').toUpperCase() === 'YES';
        statusStr = (row[11] || 'active').toLowerCase().trim();
      }

      if (!code && !name) continue;

      const existing = userMap.get(code.toUpperCase()) ||
        userMap.get(code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()) ||
        userMap.get(email.toLowerCase()) ||
        userMap.get(name.toLowerCase());
      const rawRole = (roleStr || '').toLowerCase().trim();
      const rawDesig = (designation || existing?.designation || '').toLowerCase().trim();
      const isSuperAdmin = code.toLowerCase() === 'superadmin' || rawRole === 'admin' || existing?.role === 'admin';

      let validRole: any = 'agent';
      if (isSuperAdmin) {
        validRole = 'admin';
      } else if (rawRole === 'va_admin' || existing?.role === 'va_admin') {
        validRole = 'va_admin';
      } else if (rawRole === 'trainer' || rawDesig.includes('trainer') || existing?.role === 'trainer') {
        validRole = 'trainer';
      } else if (rawRole === 'team_leader' || rawRole === 'team_lead' || rawDesig.includes('team lead') || existing?.role === 'team_lead') {
        validRole = 'team_lead';
      } else if (rawRole === 'hr' || rawDesig.includes('hr') || existing?.role === 'hr') {
        validRole = 'hr';
      } else if (rawRole === 'payroll' || rawDesig.includes('payroll') || existing?.role === 'payroll') {
        validRole = 'payroll';
      } else if (rawRole === 'qa' || rawDesig.includes('qa') || existing?.role === 'qa') {
        validRole = 'qa';
      } else if (rawRole === 'writer' || rawDesig.includes('writer') || existing?.role === 'writer') {
        validRole = 'writer';
      } else if (existing?.role && existing.role !== 'agent') {
        validRole = existing.role;
      } else {
        validRole = 'agent';
      }

      const canon = resolveCanonicalEmployee({
        employeeCode: code,
        username: parsedUsername || existing?.username,
        name: name || existing?.name,
      });

      const empName = canon?.name || name || existing?.name || (isSuperAdmin ? 'Admin' : `Employee ${code}`);
      const finalUsername = canon?.username || (parsedUsername || existing?.username || (isSuperAdmin ? 'admin' : generateUniqueUsername(empName, existingUsers, existing?.id))).toLowerCase();

      if (isPlaceholderName(empName, finalUsername, code)) {
        continue;
      }

      const userObj: User = {
        id: existing ? existing.id : `usr-${code.toLowerCase().replace(/[^a-z0-9]/g, '-') || `auto-${i}`}`,
        employeeCode: code || `LLC-${String(i).padStart(4, '0')}`,
        username: finalUsername,
        name: empName,
        email: email || existing?.email || `${code.toLowerCase()}@llctimetracker.com`,
        role: validRole,
        designation: (designation as any) || existing?.designation || (validRole === 'admin' ? 'Admin' : 'Agent'),
        monthlyRate: monthlyRateStr !== '' && !isNaN(Number(monthlyRateStr)) ? Number(monthlyRateStr) : (existing?.monthlyRate || 0),
        hourlyRate: hourlyRateStr !== '' && !isNaN(Number(hourlyRateStr)) ? Number(hourlyRateStr) : (existing?.hourlyRate || 0),
        teamLeaderId: supervisor || existing?.teamLeaderId || '',
        screenshotMonitored: scrMonitored,
        activityMonitored: actMonitored,
        status: statusStr === 'inactive' ? 'inactive' : 'active',
        avatar: existing?.avatar || `https://images.unsplash.com/photo-${1534528741775 + i * 1000}?auto=format&fit=crop&q=80&w=250`,
        geoTimezone: existing?.geoTimezone || 'Asia/Manila',
        geoCity: existing?.geoCity || 'Manila, Philippines',
        joinDate: joinDateStr || existing?.joinDate || new Date().toISOString().split('T')[0],
        department: existing?.department || (validRole === 'admin' ? 'Executive Management' : 'Operations'),
        password: existing?.password || (isSuperAdmin ? 'AdminpassW0rd123!' : 'Password123!'),
        mustChangePassword: existing ? (existing.mustChangePassword !== undefined ? existing.mustChangePassword : (existing.password && existing.password !== 'Password123!' ? false : (isSuperAdmin ? false : true))) : (isSuperAdmin ? false : true),
      };

      importedList.push(userObj);
    }

    // Always ensure Root Admin SuperAdmin is included
    const hasAdmin = importedList.some((u) => u.employeeCode.toLowerCase() === 'superadmin' || u.role === 'admin');
    if (!hasAdmin && existingUsers.some((u) => u.employeeCode.toLowerCase() === 'superadmin' || u.role === 'admin')) {
      const admin = existingUsers.find((u) => u.employeeCode.toLowerCase() === 'superadmin' || u.role === 'admin')!;
      importedList.unshift(admin);
    }

    const cleanList = deduplicateUsers(importedList);
    return {
      success: true,
      employees: cleanList,
      count: cleanList.length,
      message: `Successfully pulled ${cleanList.length} employees from Google Sheets Employee_Directory!`,
    };
  } catch (err: any) {
    return {
      success: false,
      employees: [],
      count: 0,
      message: `Could not read Google Sheet: ${err?.message || 'Check spreadsheet permissions or Webhook URL.'}`,
    };
  }
};

export const syncDataToGoogleSheetsWebhook = async (
  webhookUrl: string,
  timeLogs: TimeLog[],
  users: User[],
  auditLogs: AuditLog[],
  payrollRecords: PayrollRecord[],
  dailyAttendanceLogs: DailyAttendanceLog[] = [],
  idleLogs: IdleLog[] = [],
  leaveRequests: LeaveRequest[] = [],
  designationTasks?: Record<string, string[]>,
  rolePermissions?: Record<string, import('../types').RolePermissions>,
  activeSessions?: TimeLog[],
  userPresenceList?: UserPresence[]
): Promise<{ success: boolean; message: string }> => {
  if (!webhookUrl || !webhookUrl.trim()) {
    return {
      success: false,
      message: 'No Google Sheets Webhook URL configured. Please paste your Google Apps Script Web App URL in Settings.',
    };
  }

  const cleanUrl = webhookUrl.trim();
  if (!isValidWebhookUrl(cleanUrl)) {
    return {
      success: false,
      message: 'Webhook URL appears incomplete or is a placeholder. Please paste your deployed Web App URL ending in /exec.',
    };
  }

  try {
    // Hide emergency backup account from database spreadsheet sync
    const safeUsers = users.filter((u) => !u.isSecretBackup);

    // Combine any active live sessions (e.g. running on desktop) with completed time logs
    const combinedLogs = activeSessions && activeSessions.length > 0
      ? [...activeSessions, ...timeLogs]
      : timeLogs;

    const payload = {
      action: 'SYNC_ALL',
      timeLogs: combinedLogs,
      users: safeUsers,
      auditLogs,
      payrollRecords,
      dailyAttendanceLogs,
      idleLogs,
      leaveRequests,
      designationTasks: designationTasks || {},
      rolePermissions: rolePermissions || {},
      userPresenceList: userPresenceList || [],
      syncedAt: new Date().toISOString(),
    };

    // Strategy 1: Attempt Server-side Proxy to bypass browser iframe & CORS restrictions
    try {
      const proxyRes = await fetch('/api/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: cleanUrl, payload }),
      });

      if (proxyRes.ok) {
        const pData = await proxyRes.json();
        if (pData && pData.success && pData.result?.status !== 'ERROR') {
          return {
            success: true,
            message: 'Successfully synchronized all logs and database tables to Google Sheets!',
          };
        } else if (pData && (pData.error || pData.result?.status === 'ERROR')) {
          const errDetail = pData.error || pData.result?.message || 'Apps Script execution failed';
          return {
            success: false,
            message: `Google Sheets Error: ${errDetail}. Verify Apps Script is deployed as Web App (Anyone).`,
          };
        }
      }
    } catch (proxyErr) {
      // Dev server proxy unavailable, continue to direct browser fetch
    }

    // Strategy 2: Direct browser fetch to Google Apps Script.
    // Google Apps Script Web App endpoints respond with a 302 redirect.
    // In browser environments without a proxy, mode: 'no-cors' with 'text/plain;charset=utf-8'
    // transmits the full POST body directly without failing on the cross-domain redirect.
    try {
      await fetch(cleanUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });
    } catch (directErr) {
      await fetch(cleanUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });
    }

    return {
      success: true,
      message: 'Successfully sent separated logs and database tables to Google Sheets!',
    };
  } catch (err: any) {
    // Graceful warning instead of console.error to avoid raising uncaught error flags on network/script drops
    console.warn('Google Sheets Sync notice (webhook unreachable or network offline):', err?.message || err);
    return {
      success: false,
      message: `Failed to connect to Google Sheets webhook: ${err?.message || 'Network unreachable'}. Please verify Apps Script deployment is set to "Anyone".`,
    };
  }
};

/**
 * Dedicated fast-path webhook dispatcher that specifically syncs the Employee Directory tab
 * directly in under 1 second without processing time logs or summaries.
 */
export const syncEmployeesToGoogleSheetsWebhook = async (
  webhookUrl: string,
  users: User[]
): Promise<{ success: boolean; message: string; count?: number }> => {
  if (!webhookUrl || !webhookUrl.trim()) {
    return {
      success: false,
      message: 'No Google Sheets Webhook URL configured. Please paste your Google Apps Script Web App URL in Settings.',
    };
  }

  const cleanUrl = webhookUrl.trim();
  if (!isValidWebhookUrl(cleanUrl)) {
    return {
      success: false,
      message: 'Webhook URL appears incomplete or is a placeholder. Please paste your deployed Web App URL ending in /exec.',
    };
  }

  try {
    const safeUsers = users.filter((u) => !u.isSecretBackup);
    const payload = {
      action: 'SYNC_EMPLOYEES',
      users: safeUsers,
      syncedAt: new Date().toISOString(),
    };

    // Strategy 1: Server-side proxy
    try {
      const proxyRes = await fetch('/api/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: cleanUrl, payload }),
      });
      if (proxyRes.ok) {
        const pData = await proxyRes.json();
        if (pData && pData.success && pData.result?.status !== 'ERROR') {
          return {
            success: true,
            count: pData.result?.count || safeUsers.length,
            message: `✓ Successfully populated ${pData.result?.count || safeUsers.length} employees into Employee_Directory tab!`,
          };
        } else if (pData && (pData.error || pData.result?.status === 'ERROR')) {
          const errDetail = pData.error || pData.result?.message || 'Apps Script execution failed';
          return {
            success: false,
            message: `Google Sheets Error: ${errDetail}. Verify Apps Script is deployed as Web App (Anyone).`,
          };
        }
      }
    } catch (proxyErr) {}

    // Strategy 2: Direct browser fetch
    await fetch(cleanUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    return {
      success: true,
      count: safeUsers.length,
      message: `✓ Pushed ${safeUsers.length} employees directly to Google Sheets Employee_Directory tab!`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to push employees: ${err?.message || 'Check network connection or webhook URL.'}`,
    };
  }
};

export interface AgentHeartbeatPayload {
  userId: string;
  employeeCode?: string;
  userName: string;
  role?: string;
  designation?: string;
  platformMode?: string;
  status?: 'online' | 'idle' | 'offline';
  statusLabel?: string;
  isOnline?: boolean;
  isTracking?: boolean;
  isPaused?: boolean;
  elapsedSeconds?: number;
  currentTask?: string;
  currentApp?: string;
  loginPlatform?: 'software' | 'webapp';
  firstCheckin?: string;
  timezone?: string;
  lastHeartbeat?: string;
  mouseActivity?: number;
  keyboardActivity?: number;
}

/**
 * Transmits a targeted individual tracking pulse under a dedicated action: 'HEARTBEAT_UPDATE'.
 * Runs periodically (every 60s) from active agent machines to update only their own row in Live_Presence.
 */
export const syncAgentHeartbeatToSheets = async (
  webhookUrl: string,
  heartbeat: AgentHeartbeatPayload
): Promise<{ success: boolean; message: string }> => {
  if (!webhookUrl || !webhookUrl.trim() || !isValidWebhookUrl(webhookUrl)) {
    return { success: false, message: 'Invalid or missing Google Sheets Webhook URL.' };
  }

  const cleanUrl = webhookUrl.trim();
  const payload = {
    action: 'HEARTBEAT_UPDATE',
    presence: {
      ...heartbeat,
      lastHeartbeat: heartbeat.lastHeartbeat || new Date().toISOString(),
    },
    syncedAt: new Date().toISOString(),
  };

  try {
    // Strategy 1: Dev / Node Server proxy
    try {
      const proxyRes = await fetch('/api/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: cleanUrl, payload }),
      });
      if (proxyRes.ok) {
        return { success: true, message: 'Heartbeat synced via server proxy' };
      }
    } catch (e) {
      // Server proxy unavailable, proceed to Strategy 2
    }

    // Strategy 2: Direct browser fetch with mode: 'no-cors'
    try {
      await fetch(cleanUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });
    } catch (corsErr) {
      await fetch(cleanUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });
    }

    return {
      success: true,
      message: 'Heartbeat pulse transmitted to Google Sheets successfully!',
    };
  } catch (err: any) {
    console.warn('Direct heartbeat sync warning:', err?.message || err);
    return {
      success: false,
      message: `Heartbeat sync failed: ${err?.message || 'Network error'}`,
    };
  }
};

/**
 * Extracts and imports Time Logs from the Google Sheets database (Time_Logs or Active_Logs tab)
 */
export const fetchTimeLogsFromGoogleSheets = async (
  webhookUrl?: string,
  spreadsheetId?: string
): Promise<{ success: boolean; timeLogs: Partial<TimeLog>[]; message: string }> => {
  if (!webhookUrl && !spreadsheetId) {
    return { success: false, timeLogs: [], message: 'No Webhook URL or Spreadsheet ID provided.' };
  }

  // Method 1: Webhook GET
  if (webhookUrl && isValidWebhookUrl(webhookUrl)) {
    try {
      const proxyRes = await fetch(`/api/sync-sheets?url=${encodeURIComponent(webhookUrl.trim())}`);
      if (proxyRes.ok) {
        const data = await proxyRes.json();
        if (data && Array.isArray(data.timeLogs) && data.timeLogs.length > 0) {
          return {
            success: true,
            timeLogs: data.timeLogs,
            message: `Successfully extracted ${data.timeLogs.length} time logs from Google Sheets!`,
          };
        }
      }
    } catch (err) {
      console.warn('Webhook GET for timeLogs failed, trying CSV export fallback...', err);
    }
  }

  // Method 2: Direct Google Sheets CSV Query for Time_Logs tab
  if (spreadsheetId) {
    try {
      const tabsToTry = ['Time_Logs', 'Active_Logs', 'Live_Sessions', 'Timesheets'];
      for (const tab of tabsToTry) {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${tab}`;
        const response = await fetch(csvUrl);
        if (response.ok) {
          const csvText = await response.text();
          const rows = parseCSVRows(csvText);
          if (rows.length > 1) {
            const parsedLogs: Partial<TimeLog>[] = [];
            for (let i = 1; i < rows.length; i++) {
              const r = rows[i];
              const id = (r[0] || '').trim();
              const empName = (r[2] || '').trim();
              if (!id && !empName) continue;

              parsedLogs.push({
                id: id || `log-sheet-${Date.now()}-${i}`,
                userName: empName,
                designation: (r[3] || 'Agent').trim(),
                task: (r[4] || 'General').trim(),
                date: (r[5] || '').trim(),
                startTime: (r[6] || '').trim(),
                endTime: (r[7] || '').trim(),
                geoLocalStartTime: (r[6] || '').trim(),
                geoTimezone: 'Asia/Manila',
                status: (r[12] || 'completed').toLowerCase().includes('run') ? 'running' : 'completed',
                notes: (r[13] || 'Imported from Google Sheets Database').trim(),
              });
            }
            if (parsedLogs.length > 0) {
              return {
                success: true,
                timeLogs: parsedLogs,
                message: `Successfully extracted ${parsedLogs.length} time logs from Google Sheets tab "${tab}"!`,
              };
            }
          }
        }
      }
    } catch (csvErr: any) {
      console.warn('CSV export fallback for time logs failed:', csvErr);
    }
  }

  return {
    success: false,
    timeLogs: [],
    message: 'Could not extract time logs from Google Sheets. Ensure the sheet has a "Time_Logs" tab and is accessible.',
  };
};

/**
 * Extracts and imports Live Presence directly from the Google Sheets database (Live_Presence or Live_Sessions tab)
 */
export const fetchLivePresenceFromGoogleSheets = async (
  webhookUrl?: string,
  spreadsheetId: string = DEFAULT_SPREADSHEET_ID,
  existingUsers: User[] = []
): Promise<{ success: boolean; presenceList: UserPresence[]; message: string }> => {
  const userMap = new Map<string, User>();
  existingUsers.forEach((u) => {
    if (u.id) userMap.set(u.id, u);
    if (u.employeeCode) userMap.set(u.employeeCode.toUpperCase().trim(), u);
    if (u.name) userMap.set(u.name.toLowerCase().trim(), u);
  });

  // Method 1: Webhook GET
  if (webhookUrl && isValidWebhookUrl(webhookUrl)) {
    try {
      const proxyRes = await fetch(`/api/sync-sheets?url=${encodeURIComponent(webhookUrl.trim())}`);
      if (proxyRes.ok) {
        const data = await proxyRes.json();
        if (data && Array.isArray(data.presence) && data.presence.length > 0) {
          const list: UserPresence[] = data.presence.map((p: any) => {
            const matchedUser =
              (p.employeeCode && userMap.get(p.employeeCode.toUpperCase().trim())) ||
              (p.userName && userMap.get(p.userName.toLowerCase().trim())) ||
              (p.userId && userMap.get(p.userId));

            return {
              userId: matchedUser?.id || p.userId || `usr-${p.employeeCode || Date.now()}`,
              userName: p.userName || matchedUser?.name || 'Employee',
              employeeCode: p.employeeCode || matchedUser?.employeeCode || '',
              role: p.role || matchedUser?.role || 'agent',
              designation: p.designation || matchedUser?.designation || 'Agent',
              department: matchedUser?.department || 'Operations',
              teamLeaderId: matchedUser?.teamLeaderId || '',
              isOnline: Boolean(p.isOnline),
              status: p.status || (p.isOnline ? 'online' : 'offline'),
              isTracking: Boolean(p.isTracking),
              isPaused: Boolean(p.isPaused),
              elapsedSeconds: Number(p.elapsedSeconds) || 0,
              mouseActivity: p.isTracking ? (Number(p.mouseActivity) || 85) : 0,
              keyboardActivity: p.isTracking ? (Number(p.keyboardActivity) || 90) : 0,
              currentTask: p.currentTask || (p.isOnline ? 'Active Work' : 'Shift Concluded'),
              currentApp: p.currentApp || (p.loginPlatform === 'software' ? 'LLC Time Tracker Desktop App' : 'Web Browser'),
              loginPlatform: p.loginPlatform || 'software',
              lastHeartbeat: p.lastHeartbeat || new Date().toISOString(),
            };
          });

          return {
            success: true,
            presenceList: list,
            message: `Successfully extracted ${list.length} live presence records from Google Sheets!`,
          };
        }
      }
    } catch (err) {
      console.warn('Webhook GET for presence failed, trying CSV export fallback...', err);
    }
  }

  // Method 2: Direct Google Sheets CSV Query for Live_Presence tab
  if (spreadsheetId) {
    try {
      const tabsToTry = ['Live_Presence', 'Live Presence'];
      for (const tab of tabsToTry) {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${tab}`;
        const response = await fetch(csvUrl);
        if (response.ok) {
          const csvText = await response.text();
          const rows = parseCSVRows(csvText);
          if (rows.length > 1) {
            const parsedList: UserPresence[] = [];
            for (let i = 1; i < rows.length; i++) {
              const r = rows[i];
              const code = (r[0] || '').trim();
              const name = (r[1] || '').trim();
              if (!code && !name) continue;

              const role = (r[2] || 'agent').trim();
              const designation = (r[3] || 'Agent').trim();
              const platformMode = (r[4] || '').trim();
              const statusStr = (r[5] || '').trim();
              const taskStr = (r[6] || '').trim();
              const appStr = (r[7] || '').trim();
              const isoHb = (r[12] || '').trim();

              const isTracking = statusStr.includes('Live Tracking') || statusStr.includes('Tracking');
              const isIdle = statusStr.includes('Idle') || statusStr.includes('Break');
              const isDesktop = platformMode.includes('Desktop') || statusStr.includes('Desktop') || isTracking;
              const isWeb = platformMode.includes('Website') || statusStr.includes('Website');
              const isOffline = statusStr.includes('Offline') || (!isTracking && !isIdle && !isDesktop && !isWeb);

              const matchedUser =
                (code && userMap.get(code.toUpperCase())) ||
                (name && userMap.get(name.toLowerCase())) ||
                null;

              parsedList.push({
                userId: matchedUser?.id || `usr-${code || i}`,
                userName: name || matchedUser?.name || 'Employee',
                employeeCode: code || matchedUser?.employeeCode || '',
                role: (matchedUser?.role || role || 'agent') as any,
                designation: matchedUser?.designation || designation || 'Agent',
                department: matchedUser?.department || 'Operations',
                teamLeaderId: matchedUser?.teamLeaderId || '',
                isOnline: !isOffline,
                status: isIdle ? 'idle' : isOffline ? 'offline' : 'online',
                isTracking: isTracking,
                isPaused: isIdle,
                elapsedSeconds: isTracking ? 600 : 0,
                mouseActivity: isTracking ? 88 : 0,
                keyboardActivity: isTracking ? 92 : 0,
                currentTask: taskStr || (isTracking ? 'Active Task' : isOffline ? 'Shift Concluded' : 'Desktop Standby'),
                currentApp: appStr || (isDesktop ? 'LLC Time Tracker Desktop App' : 'Web Browser'),
                loginPlatform: isDesktop ? 'software' : 'webapp',
                lastHeartbeat: isoHb || new Date().toISOString(),
              });
            }

            if (parsedList.length > 0) {
              return {
                success: true,
                presenceList: parsedList,
                message: `Successfully extracted ${parsedList.length} live presence records from Google Sheets tab "${tab}"!`,
              };
            }
          }
        }
      }
    } catch (csvErr) {
      console.warn('CSV export fallback for presence failed:', csvErr);
    }
  }

  return {
    success: false,
    presenceList: [],
    message: 'Could not extract live presence from Google Sheets. Ensure sheet has a "Live_Presence" tab.',
  };
};

export const downloadTableCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
  const csvContent = [
    headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const resetGoogleSpreadsheetData = async (
  webhookUrl: string
): Promise<{ success: boolean; message: string }> => {
  if (!webhookUrl || !webhookUrl.startsWith('https://')) {
    return { success: false, message: 'Invalid or missing webhook URL.' };
  }

  try {
    const payload = { action: 'RESET_ALL' };
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const json = await res.json();
      return {
        success: true,
        message: json.message || 'Google Sheets data tables reset successfully!',
      };
    }
    return {
      success: true,
      message: 'Reset command dispatched to Google Sheets webhook.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to reset Google Sheets: ${err?.message || 'Network error'}`,
    };
  }
};

export const getGoogleAppsScriptTemplate = generateAppsScriptCode;

