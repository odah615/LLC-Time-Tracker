import { AuditLog, TimeLog, User, PayrollRecord, DailyAttendanceLog, IdleLog, LeaveRequest } from '../types';
import { generateUniqueUsername } from './userUtils';

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
    description: 'Dedicated log for detected hardware inactivity (random 10-15m intervals), durations, time subtracted from shift, and required shift extensions.',
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
    description: 'Master time tracker log for all work sessions from Desktop App & Web Portal, tasks, start/end timestamps in Manila time (GMT+8), net duration, and live status.',
    headers: [
      'Session ID',
      'Employee Code',
      'Employee Name',
      'Designation',
      'Task Category',
      'Date',
      'Start Time (Manila GMT+8)',
      'End Time (Manila GMT+8)',
      'Net Active Duration (HH:MM:SS)',
      'Idle Deductions (Mins)',
      'Mouse Avg %',
      'Keyboard Avg %',
      'Status',
      'Notes',
    ],
  },
  {
    tabName: 'Active_Logs',
    description: 'Compatibility alias for Time_Logs. Dedicated log of all active shift work sessions, assigned tasks, start/end timestamps, net duration, and activity %.',
    headers: [
      'Session ID',
      'Employee Code',
      'Employee Name',
      'Designation',
      'Task Category',
      'Date',
      'Start Time',
      'End Time',
      'Net Active Duration (HH:MM:SS)',
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
export const generateAppsScriptCode = (spreadsheetId: string = DEFAULT_SPREADSHEET_ID) => {
  return `/**
 * LLC TIME TRACKER - MODULAR SEPARATED LOGS & DATABASE SYNC SCRIPT
 * Linked Spreadsheet ID: ${spreadsheetId}
 * 
 * Features:
 * - Separate Tab for Login Logs (Login_Logs)
 * - Separate Tab for Logout Logs (Logout_Logs)
 * - Separate Tab for Idle Logs (Idle_Logs)
 * - Separate Tab for Active Work Logs (Active_Logs)
 * - Separate Tab for Inactivity Events (Inactive_Logs)
 * - Separate Tab for Administrative & Security Audit Logs (Admin_Audit_Logs)
 * - Plus Attendance, Employee Directory, Leave Requests, and Payroll Summary
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
 * Run this function directly in Apps Script editor (Select createAllTabsNow -> click Run)
 * to immediately initialize and format all 10 tabs in your Google Sheet!
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
 * Atomic batch writer:
 * 1. Automatically removes any active filter that was hiding rows.
 * 2. Clears previous contents.
 * 3. Writes Row 1 (Headers) followed directly by data rows in ONE single setValues call (no blank gaps!).
 * 4. Freezes Row 1 and applies header styling.
 * 5. Trims excess empty ghost rows at the bottom.
 */
function populateCleanSheet(sheet, headers, rows, headerColor) {
  if (!sheet) return;

  // 1. Remove active filter so data rows are never hidden or displaced
  try {
    var existingFilter = sheet.getFilter();
    if (existingFilter) {
      existingFilter.remove();
    }
  } catch (fErr) {}

  // 2. Clear entire sheet
  sheet.clear();

  // 3. Assemble complete 2D matrix
  var allData = [headers];
  if (rows && rows.length > 0) {
    allData = allData.concat(rows);
  }

  var numRows = allData.length;
  var numCols = headers.length;

  // 4. Atomic batch write: Starts strictly at Row 1, Col 1 (No gaps between header & row 2!)
  var targetRange = sheet.getRange(1, 1, numRows, numCols);
  targetRange.setValues(allData);

  // 5. Header formatting
  sheet.getRange(1, 1, 1, numCols)
    .setFontWeight('bold')
    .setBackground(headerColor || '#0f172a')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  // 6. Delete ghost blank rows at the bottom (leave clean 5 buffer rows)
  try {
    var maxRows = sheet.getMaxRows();
    if (maxRows > numRows + 5 && maxRows > 25) {
      sheet.deleteRows(numRows + 6, maxRows - (numRows + 5));
    }
  } catch (rErr) {}
}

function setupSheetsSchema() {
  var ss = getSpreadsheet();
  var schema = [
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
      tab: 'Time_Logs',
      color: '#059669', // Emerald
      headers: ['Session ID', 'Employee Code', 'Employee Name', 'Designation', 'Task Category', 'Date', 'Start Time', 'End Time', 'Net Active Duration (HH:MM:SS)', 'Idle Deductions (Mins)', 'Mouse Avg %', 'Keyboard Avg %', 'Status', 'Notes']
    },
    {
      tab: 'Active_Logs',
      color: '#059669', // Emerald
      headers: ['Session ID', 'Employee Code', 'Employee Name', 'Designation', 'Task Category', 'Date', 'Start Time', 'End Time', 'Net Active Duration (HH:MM:SS)', 'Idle Deductions (Mins)', 'Mouse Avg %', 'Keyboard Avg %', 'Status', 'Notes']
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
    setupSheetsSchema();

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

    if (data.action === 'SYNC_ALL' || data.action === 'APPEND_LOG') {
      var rawAuditLogs = data.auditLogs || [];
      var rawUsers = data.users || [];
      var rawTimeLogs = data.timeLogs || [];
      var rawIdleLogs = data.idleLogs || [];
      var dailyAttendanceLogs = data.dailyAttendanceLogs || [];
      var leaveRequests = data.leaveRequests || [];
      var payrollRecords = data.payrollRecords || [];

      // Deduplicate users
      var userMap = {};
      var users = [];
      rawUsers.forEach(function(u) {
        var key = (u.employeeCode || u.id || u.username || '').toUpperCase();
        if (key && !userMap[key]) {
          userMap[key] = u;
          users.push(u);
        }
        if (u.id) userMap[u.id] = u;
        if (u.name) userMap[u.name] = u;
      });

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
      if (loginSheet) populateCleanSheet(loginSheet, loginHeaders, loginRows, '#1e3a8a');
      var loginSessionSheet = ss.getSheetByName('Login_Session_Logs');
      if (loginSessionSheet) populateCleanSheet(loginSessionSheet, loginHeaders, loginRows, '#1e3a8a');

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
        if (l.details && (l.details.toLowerCase().indexOf('10-minute') !== -1 || l.details.toLowerCase().indexOf('timeout') !== -1)) {
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
      if (logoutSheet) populateCleanSheet(logoutSheet, logoutHeaders, logoutRows, '#334155');

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
          i.reason || 'Zero Keyboard / Mouse Activity across 10-15m check',
          i.status || 'logged'
        ]);
      });

      var idleSheet = ss.getSheetByName('Idle_Logs');
      if (idleSheet) populateCleanSheet(idleSheet, idleHeaders, idleRows, '#b45309');

      // ==========================================
      // 4. POPULATE TIME LOGS (Timesheet Sessions & Live Tracking)
      // ==========================================
      var activeHeaders = ['Session ID', 'Employee Code', 'Employee Name', 'Designation', 'Task Category', 'Date', 'Start Time', 'End Time', 'Net Active Duration (HH:MM:SS)', 'Idle Deductions (Mins)', 'Mouse Avg %', 'Keyboard Avg %', 'Status', 'Notes'];
      var activeSeen = {};
      var activeRows = [];
      rawTimeLogs.forEach(function(t) {
        var dedupeKey = t.id || (t.userId + '_' + t.date + '_' + t.startTime);
        if (activeSeen[dedupeKey]) return;
        activeSeen[dedupeKey] = true;

        var matchedUser = userMap[t.userId] || userMap[t.userName] || {};
        var durStr = typeof t.durationSeconds === 'number' 
          ? Math.floor(t.durationSeconds / 3600).toString().padStart(2, '0') + ':' + Math.floor((t.durationSeconds % 3600) / 60).toString().padStart(2, '0') + ':' + (t.durationSeconds % 60).toString().padStart(2, '0')
          : (t.duration || '00:00:00');
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
          matchedUser.employeeCode || 'N/A',
          t.userName || 'Unknown',
          t.designation || 'Agent',
          t.task || 'General',
          t.date || '',
          sTime,
          eTime,
          durStr,
          idleMins,
          (t.mouseActivityAvg != null ? t.mouseActivityAvg : 0) + '%',
          (t.keyboardActivityAvg != null ? t.keyboardActivityAvg : 0) + '%',
          t.status || 'completed',
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

      var timeLogsSheet = ss.getSheetByName('Time_Logs');
      if (timeLogsSheet) populateCleanSheet(timeLogsSheet, activeHeaders, activeRows, '#047857');

      var activeSheet = ss.getSheetByName('Active_Logs');
      if (activeSheet) populateCleanSheet(activeSheet, activeHeaders, activeRows, '#047857');

      if (!timeLogsSheet && !activeSheet) {
        timeLogsSheet = ss.insertSheet('Time_Logs');
        populateCleanSheet(timeLogsSheet, activeHeaders, activeRows, '#047857');
      }

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
      if (inactiveSheet) populateCleanSheet(inactiveSheet, inactiveHeaders, inactiveRows, '#c2410c');

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
      if (fullAuditSheet) populateCleanSheet(fullAuditSheet, auditHeaders, fullAuditRows, '#312e81');

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
      if (adminAuditSheet) populateCleanSheet(adminAuditSheet, auditHeaders, adminRows, '#4338ca');

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
      if (attSheet) populateCleanSheet(attSheet, attHeaders, attRows, '#0e7490');

      // ==========================================
      // 8. POPULATE EMPLOYEE DIRECTORY
      // ==========================================
      var empHeaders = ['Employee Code', 'Username', 'Full Name', 'Work Email', 'System Role', 'Designation', 'Date Hired', 'Monthly Rate (₱)', 'Hourly Rate (₱)', 'Assigned Supervisor', 'Screenshot Monitored', 'Activity Monitored', 'Status', 'Account Password (Masked)'];
      var empRows = [];
      users.forEach(function(u) {
        var maskedPass = maskPassword(u.password || 'Password123!');
        var hireDate = u.joinDate || '2020-01-01';
        var supervisorName = 'None / Direct Executive';
        if (u.teamLeaderId) {
          var sv = userMap[u.teamLeaderId];
          supervisorName = sv ? sv.name + ' (' + (sv.designation || sv.role) + ')' : u.teamLeaderId;
        }
        var mRate = (u.monthlyRate !== undefined && u.monthlyRate !== null) ? Number(u.monthlyRate) : 0;
        var hRate = (u.hourlyRate !== undefined && u.hourlyRate !== null) ? Number(u.hourlyRate) : (mRate > 0 ? Number((mRate / 160).toFixed(2)) : 0);
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
      var empSheet = ss.getSheetByName('Employee_Directory');
      if (empSheet) populateCleanSheet(empSheet, empHeaders, empRows, '#0369a1');

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
        payRows.push([
          p.payPeriod || 'August 1-15, 2026',
          p.employeeCode || 'LLC-0001',
          p.userName,
          p.designation || 'Agent',
          p.monthlyRate || 23000,
          p.hourlyRate || 143.75,
          p.totalTrackedHours || 0,
          p.missingHours || 0,
          p.missingDeductions || 0,
          p.grossPay || 23000,
          p.incentiveBonus || 0,
          p.netPay || 23000,
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
    setupSheetsSchema();
    var empSheet = ss.getSheetByName('Employee_Directory');
    var employees = [];
    if (empSheet && empSheet.getLastRow() > 1) {
      var data = empSheet.getRange(2, 1, empSheet.getLastRow() - 1, 13).getValues();
      data.forEach(function(row) {
        var code = String(row[0] || '').trim();
        var name = String(row[1] || '').trim();
        if (!code && !name) return;
        employees.push({
          employeeCode: code || 'LLC-' + Math.floor(1000 + Math.random() * 9000),
          name: name || 'Employee',
          email: String(row[2] || '').trim(),
          role: String(row[3] || 'employee').toLowerCase().trim(),
          designation: String(row[4] || 'Agent').trim(),
          joinDate: String(row[5] || '').trim() || '2020-01-01',
          monthlyRate: row[6] !== '' && !isNaN(Number(String(row[6]).replace(/[^0-9.]/g, ''))) ? Number(String(row[6]).replace(/[^0-9.]/g, '')) : 0,
          hourlyRate: row[7] !== '' && !isNaN(Number(String(row[7]).replace(/[^0-9.]/g, ''))) ? Number(String(row[7]).replace(/[^0-9.]/g, '')) : 0,
          teamLeaderId: String(row[8] || '').trim(),
          screenshotMonitored: String(row[9]).toUpperCase() === 'YES' || row[9] === true,
          activityMonitored: String(row[10]).toUpperCase() === 'YES' || row[10] === true,
          status: String(row[11] || 'active').toLowerCase().trim()
        });
      });
    }

    var timeLogsSheet = ss.getSheetByName('Time_Logs') || ss.getSheetByName('Active_Logs');
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

    return ContentService.createTextOutput(JSON.stringify({
      status: 'SUCCESS',
      count: employees.length,
      employees: employees,
      timeLogs: timeLogs,
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
    if (u.employeeCode) userMap.set(u.employeeCode.toUpperCase().trim(), u);
    if (u.email) userMap.set(u.email.toLowerCase().trim(), u);
    if (u.id) userMap.set(u.id, u);
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
            const existing = userMap.get(code.toUpperCase()) || userMap.get((rawEmp.email || '').toLowerCase());

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

            const userObj: User = {
              id: existing ? existing.id : `usr-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              employeeCode: code,
              username,
              name: empName,
              email: rawEmp.email || existing?.email || `${code.toLowerCase()}@llctimetracker.com`,
              role,
              designation: rawEmp.designation || existing?.designation || (role === 'admin' ? 'Admin' : 'Agent'),
              monthlyRate: Number(rawEmp.monthlyRate) || existing?.monthlyRate || (isSuperAdmin ? 60000 : 23000),
              hourlyRate: Number(rawEmp.hourlyRate) || existing?.hourlyRate || (isSuperAdmin ? 375 : 143.75),
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
              mustChangePassword: existing?.mustChangePassword !== undefined ? existing.mustChangePassword : (isSuperAdmin ? false : true),
            };
            importedList.push(userObj);
          });

          if (importedList.length > 0) {
            return {
              success: true,
              employees: importedList,
              count: importedList.length,
              message: `Successfully imported ${importedList.length} employee accounts via Google Apps Script Webhook!`,
            };
          }
        }
    } catch (webhookErr) {
      console.warn('Webhook GET fetch warning, attempting direct Google Sheets CSV export fallback...', webhookErr);
    }
  }

  // Method 2: Direct Google Sheets CSV Query (works on public / shared sheets)
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=Employee_Directory`;
    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`Spreadsheet fetch responded with status ${response.status}`);
    }

    const csvText = await response.text();
    const rows = parseCSVRows(csvText);

    if (rows.length <= 1) {
      return {
        success: false,
        employees: [],
        count: 0,
        message: 'No employee rows found in the spreadsheet "Employee_Directory" tab.',
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

      const existing = userMap.get(code.toUpperCase()) || userMap.get(email.toLowerCase());
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

      const empName = name || existing?.name || (isSuperAdmin ? 'Admin' : `Employee ${code}`);
      const finalUsername = (parsedUsername || existing?.username || (isSuperAdmin ? 'admin' : generateUniqueUsername(empName, existingUsers, existing?.id))).toLowerCase();

      const userObj: User = {
        id: existing ? existing.id : `usr-${code.toLowerCase().replace(/[^a-z0-9]/g, '-') || `auto-${i}`}`,
        employeeCode: code || `LLC-${String(i).padStart(4, '0')}`,
        username: finalUsername,
        name: empName,
        email: email || existing?.email || `${code.toLowerCase()}@llctimetracker.com`,
        role: validRole,
        designation: (designation as any) || existing?.designation || (validRole === 'admin' ? 'Admin' : 'Agent'),
        monthlyRate: Number(monthlyRateStr) || existing?.monthlyRate || (isSuperAdmin ? 60000 : 23000),
        hourlyRate: Number(hourlyRateStr) || existing?.hourlyRate || (isSuperAdmin ? 375 : 143.75),
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
        mustChangePassword: existing?.mustChangePassword !== undefined ? existing.mustChangePassword : (isSuperAdmin ? false : true),
      };

      importedList.push(userObj);
    }

    // Always ensure Root Admin SuperAdmin is included
    const hasAdmin = importedList.some((u) => u.employeeCode.toLowerCase() === 'superadmin' || u.role === 'admin');
    if (!hasAdmin && existingUsers.some((u) => u.employeeCode.toLowerCase() === 'superadmin' || u.role === 'admin')) {
      const admin = existingUsers.find((u) => u.employeeCode.toLowerCase() === 'superadmin' || u.role === 'admin')!;
      importedList.unshift(admin);
    }

    return {
      success: true,
      employees: importedList,
      count: importedList.length,
      message: `Successfully pulled ${importedList.length} employees from Google Sheets Employee_Directory!`,
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
  activeSessions?: TimeLog[]
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
        if (pData && pData.success) {
          return {
            success: true,
            message: 'Successfully synchronized all logs and database tables to Google Sheets!',
          };
        }
      }
    } catch (proxyErr) {
      // Dev server proxy unavailable, continue to direct browser fetch
    }

    // Strategy 2: Direct browser fetch with mode 'no-cors'
    await fetch(cleanUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

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
      const tabsToTry = ['Time_Logs', 'Active_Logs'];
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

export const getGoogleAppsScriptTemplate = generateAppsScriptCode;

