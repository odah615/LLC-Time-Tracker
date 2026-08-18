import { AuditLog, TimeLog, User, PayrollRecord, DailyAttendanceLog, IdleLog, LeaveRequest } from '../types';

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
    tabName: 'Active_Logs',
    description: 'Dedicated log of all active shift work sessions, assigned tasks, start/end timestamps, net duration, mouse/keyboard activity %, and apps used.',
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
  SpreadsheetApp.flush();
  var sheetCount = ss.getSheets().length;
  Logger.log('SUCCESS! Initialized tabs in Spreadsheet: "' + ss.getName() + '" (ID: ' + ss.getId() + ') | Total tabs: ' + sheetCount);
  return 'Created all tabs in ' + ss.getName();
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
      headers: ['Employee Code', 'Full Name', 'Work Email', 'System Role', 'Designation', 'Monthly Rate (₱)', 'Hourly Rate (₱)', 'Assigned Supervisor', 'Screenshot Monitored', 'Activity Monitored', 'Status', 'Account Password (Masked)']
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
      var auditLogs = data.auditLogs || [];
      var users = data.users || [];
      var timeLogs = data.timeLogs || [];
      var idleLogs = data.idleLogs || [];
      var dailyAttendanceLogs = data.dailyAttendanceLogs || [];
      var leaveRequests = data.leaveRequests || [];
      var payrollRecords = data.payrollRecords || [];

      // Helper to lookup user details by id or name
      var userMap = {};
      users.forEach(function(u) {
        if (u.id) userMap[u.id] = u;
        if (u.name) userMap[u.name] = u;
      });

      // ==========================================
      // 1. POPULATE LOGIN LOGS (Dedicated Tab)
      // ==========================================
      var loginSheet = ss.getSheetByName('Login_Logs');
      if (loginSheet) {
        loginSheet.clear();
        loginSheet.appendRow(['Log ID', 'Timestamp (ISO)', 'Formatted Date & Time', 'Employee Code', 'Employee Name', 'User Role', 'Designation', 'Login Platform / Mode', 'Timezone & Location', 'Session Status', 'Account Password (Masked)']);
        loginSheet.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
        loginSheet.setFrozenRows(1);
        
        var loginEvents = auditLogs.filter(function(l) {
          return l.category === 'Login' || (l.details && l.details.toLowerCase().indexOf('signed in') !== -1);
        });

        loginEvents.forEach(function(l) {
          var matchedUser = userMap[l.actorId] || userMap[l.actorName] || {};
          var mode = (l.details && l.details.indexOf('Desktop') !== -1) ? 'Desktop Software App' : 'Web Portal';
          var maskedPass = maskPassword(matchedUser.password || 'Password123!');
          loginSheet.appendRow([
            l.id,
            l.timestamp,
            l.dateFormatted || l.timestamp,
            matchedUser.employeeCode || 'N/A',
            l.actorName,
            l.actorRole || matchedUser.role || 'agent',
            matchedUser.designation || 'Sales Agent',
            mode,
            (matchedUser.geoCity ? matchedUser.geoCity + ' (' + (matchedUser.geoTimezone || 'GMT+8') + ')' : 'Toronto, Canada (America/Toronto)'),
            'Authenticated (Active)',
            maskedPass
          ]);
        });
      }

      // ==========================================
      // 2. POPULATE LOGOUT LOGS (Dedicated Tab)
      // ==========================================
      var logoutSheet = ss.getSheetByName('Logout_Logs');
      if (logoutSheet) {
        logoutSheet.clear();
        logoutSheet.appendRow(['Log ID', 'Timestamp (ISO)', 'Formatted Date & Time', 'Employee Code', 'Employee Name', 'User Role', 'Designation', 'Logout Platform / Event', 'Session Duration / Notes', 'Status']);
        logoutSheet.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#334155').setFontColor('#ffffff');
        logoutSheet.setFrozenRows(1);

        var logoutEvents = auditLogs.filter(function(l) {
          return l.category === 'Logout' || (l.details && l.details.toLowerCase().indexOf('signed out') !== -1);
        });

        logoutEvents.forEach(function(l) {
          var matchedUser = userMap[l.actorId] || userMap[l.actorName] || {};
          logoutSheet.appendRow([
            l.id,
            l.timestamp,
            l.dateFormatted || l.timestamp,
            matchedUser.employeeCode || 'N/A',
            l.actorName,
            l.actorRole || matchedUser.role || 'agent',
            matchedUser.designation || 'Sales Agent',
            'Manual Sign Out / Shift End',
            l.details || 'User signed out of LLC Time Tracker.',
            'Logged Out (Complete)'
          ]);
        });
      }

      // ==========================================
      // 3. POPULATE IDLE LOGS (Dedicated Tab)
      // ==========================================
      var idleSheet = ss.getSheetByName('Idle_Logs');
      if (idleSheet) {
        idleSheet.clear();
        idleSheet.appendRow(['Idle Log ID', 'Timestamp', 'Employee Code', 'Employee Name', 'Inactivity Duration (Mins)', 'Deducted From Shift', 'Required Shift Extension', 'Active Task', 'Reason / Trigger', 'Status']);
        idleSheet.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#b45309').setFontColor('#ffffff');
        idleSheet.setFrozenRows(1);

        idleLogs.forEach(function(i) {
          var matchedUser = userMap[i.userId] || userMap[i.userName] || {};
          var deductMins = '-' + (i.deductedFromShiftMinutes != null ? i.deductedFromShiftMinutes : i.durationMinutes) + ' mins';
          var extendMins = '+' + (i.requiredExtensionMinutes != null ? i.requiredExtensionMinutes : i.durationMinutes) + ' mins';
          idleSheet.appendRow([
            i.id,
            i.timestamp,
            matchedUser.employeeCode || 'N/A',
            i.userName,
            i.durationMinutes,
            deductMins,
            extendMins,
            i.task,
            i.reason,
            i.status || 'logged'
          ]);
        });
      }

      // ==========================================
      // 4. POPULATE ACTIVE LOGS (Dedicated Tab)
      // ==========================================
      var activeSheet = ss.getSheetByName('Active_Logs');
      if (activeSheet) {
        activeSheet.clear();
        activeSheet.appendRow(['Session ID', 'Employee Code', 'Employee Name', 'Designation', 'Task Category', 'Date', 'Start Time', 'End Time', 'Net Active Duration (HH:MM:SS)', 'Idle Deductions (Mins)', 'Mouse Avg %', 'Keyboard Avg %', 'Status', 'Notes']);
        activeSheet.getRange(1, 1, 1, 14).setFontWeight('bold').setBackground('#047857').setFontColor('#ffffff');
        activeSheet.setFrozenRows(1);

        timeLogs.forEach(function(t) {
          var matchedUser = userMap[t.userId] || userMap[t.userName] || {};
          var durStr = typeof t.durationSeconds === 'number' 
            ? Math.floor(t.durationSeconds / 3600).toString().padStart(2, '0') + ':' + Math.floor((t.durationSeconds % 3600) / 60).toString().padStart(2, '0') + ':' + (t.durationSeconds % 60).toString().padStart(2, '0')
            : (t.duration || '00:00:00');
          var idleMins = t.idleSeconds ? Math.round(t.idleSeconds / 60) + ' mins' : '0 mins';

          activeSheet.appendRow([
            t.id || 'N/A',
            matchedUser.employeeCode || 'N/A',
            t.userName || 'Unknown',
            t.designation || 'Sales Agent',
            t.task || 'General',
            t.date || '',
            t.startTime || '',
            t.endTime || 'Running Live',
            durStr,
            idleMins,
            (t.mouseActivityAvg != null ? t.mouseActivityAvg : 0) + '%',
            (t.keyboardActivityAvg != null ? t.keyboardActivityAvg : 0) + '%',
            t.status || 'completed',
            t.notes || ''
          ]);
        });
      }

      // ==========================================
      // 5. POPULATE INACTIVE LOGS (Dedicated Tab)
      // ==========================================
      var inactiveSheet = ss.getSheetByName('Inactive_Logs');
      if (inactiveSheet) {
        inactiveSheet.clear();
        inactiveSheet.appendRow(['Inactivity Log ID', 'Date & Time', 'Employee Code', 'Employee Name', 'Task Category', 'Inactivity Duration (Mins)', 'Deduction Status', 'Trigger Source', 'Impact on Shift & Extension']);
        inactiveSheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#c2410c').setFontColor('#ffffff');
        inactiveSheet.setFrozenRows(1);

        // Populate from idleLogs + any explicit inactivity events
        idleLogs.forEach(function(i) {
          var matchedUser = userMap[i.userId] || userMap[i.userName] || {};
          var deductMins = (i.deductedFromShiftMinutes != null ? i.deductedFromShiftMinutes : i.durationMinutes);
          var extendMins = (i.requiredExtensionMinutes != null ? i.requiredExtensionMinutes : i.durationMinutes);
          inactiveSheet.appendRow([
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
      }

      // ==========================================
      // 6. POPULATE ADMIN AUDIT LOGS (Dedicated Clean Tab - No Login/Logout Clutter!)
      // ==========================================
      var adminAuditSheet = ss.getSheetByName('Admin_Audit_Logs');
      if (adminAuditSheet) {
        adminAuditSheet.clear();
        adminAuditSheet.appendRow(['Audit ID', 'Timestamp (ISO)', 'Formatted Date', 'Actor Name', 'Actor Role', 'Action Category', 'Affected Employee', 'Previous Value', 'New Value', 'Action Details']);
        adminAuditSheet.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#4338ca').setFontColor('#ffffff');
        adminAuditSheet.setFrozenRows(1);

        // Filter out simple login/logout and clock in/out to keep Admin Audit strictly for governance/system changes!
        var adminEvents = auditLogs.filter(function(l) {
          return l.category !== 'Login' && l.category !== 'Logout' && l.category !== 'Clock In' && l.category !== 'Clock Out';
        });

        // If no admin-only events exist, fallback to non-login/logout
        if (adminEvents.length === 0) {
          adminEvents = auditLogs.filter(function(l) {
            return l.category !== 'Login' && l.category !== 'Logout';
          });
        }

        adminEvents.forEach(function(l) {
          adminAuditSheet.appendRow([
            l.id,
            l.timestamp,
            l.dateFormatted,
            l.actorName,
            l.actorRole,
            l.category,
            l.targetEmployeeName || 'N/A',
            l.fromValue || '-',
            l.toValue || '-',
            l.details
          ]);
        });
      }

      // ==========================================
      // 7. POPULATE DAILY ATTENDANCE LOGS
      // ==========================================
      var attSheet = ss.getSheetByName('Daily_Attendance_Logs');
      if (attSheet && dailyAttendanceLogs.length > 0) {
        attSheet.clear();
        attSheet.appendRow(['Attendance ID', 'Date', 'Employee Code', 'Employee Name', 'First Login Time', 'Last Logout Time', 'Total Logged Hours', 'Idle Deductions (Mins)', 'Required Shift Extension (Mins)', 'Attendance Status']);
        attSheet.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#0e7490').setFontColor('#ffffff');
        attSheet.setFrozenRows(1);
        dailyAttendanceLogs.forEach(function(a) {
          attSheet.appendRow([
            a.id,
            a.date,
            a.employeeCode || 'N/A',
            a.userName,
            a.firstLoginTime,
            a.lastLogoutTime || 'Active Shift',
            a.totalLoggedHours || 0,
            (a.totalIdleDeductionsMinutes || 0) + ' mins',
            '+' + (a.requiredExtensionMinutes || a.totalIdleDeductionsMinutes || 0) + ' mins',
            a.status || 'present'
          ]);
        });
      }

      // ==========================================
      // 8. POPULATE EMPLOYEE DIRECTORY
      // ==========================================
      var empSheet = ss.getSheetByName('Employee_Directory');
      if (empSheet && users.length > 0) {
        empSheet.clear();
        empSheet.appendRow(['Employee Code', 'Full Name', 'Work Email', 'System Role', 'Designation', 'Date Hired', 'Monthly Rate (₱)', 'Hourly Rate (₱)', 'Assigned Supervisor', 'Screenshot Monitored', 'Activity Monitored', 'Status', 'Account Password (Masked)']);
        empSheet.getRange(1, 1, 1, 13).setFontWeight('bold').setBackground('#0369a1').setFontColor('#ffffff');
        empSheet.setFrozenRows(1);
        users.forEach(function(u) {
          var maskedPass = maskPassword(u.password || 'Password123!');
          var hireDate = u.joinDate || Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd');
          empSheet.appendRow([
            u.employeeCode || 'N/A',
            u.name,
            u.email,
            u.role,
            u.designation || 'Sales Agent',
            hireDate,
            u.monthlyRate || (u.hourlyRate ? u.hourlyRate * 160 : 23000),
            u.hourlyRate || (u.monthlyRate ? u.monthlyRate / 160 : 143.75),
            u.teamLeaderId || 'Direct Supervisor',
            u.screenshotMonitored ? 'YES' : 'NO',
            u.activityMonitored ? 'YES' : 'NO',
            u.status || 'active',
            maskedPass
          ]);
        });
      }

      // ==========================================
      // 9. POPULATE LEAVE REQUESTS
      // ==========================================
      var leaveSheet = ss.getSheetByName('Leave_Requests');
      if (leaveSheet && leaveRequests.length > 0) {
        leaveSheet.clear();
        leaveSheet.appendRow(['Leave ID', 'Employee Name', 'Leave Type', 'Start Date', 'End Date', 'Reason', 'Status', 'Requested At']);
        leaveSheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#7e22ce').setFontColor('#ffffff');
        leaveSheet.setFrozenRows(1);
        leaveRequests.forEach(function(lv) {
          leaveSheet.appendRow([
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
      }

      // ==========================================
      // 10. POPULATE PAYROLL SUMMARY
      // ==========================================
      var paySheet = ss.getSheetByName('Payroll_Summary');
      if (paySheet && payrollRecords.length > 0) {
        paySheet.clear();
        paySheet.appendRow(['Pay Period', 'Employee Code', 'Employee Name', 'Designation', 'Monthly Rate (₱)', 'Hourly Rate (₱)', 'Total Tracked Hours', 'Missing Hours', 'Missing Deductions (₱)', 'Gross Pay (₱)', 'Incentive Bonus (₱)', 'Net Pay (₱)', 'Payment Status']);
        paySheet.getRange(1, 1, 1, 13).setFontWeight('bold').setBackground('#15803d').setFontColor('#ffffff');
        paySheet.setFrozenRows(1);
        payrollRecords.forEach(function(p) {
          paySheet.appendRow([
            p.payPeriod || 'August 1-15, 2026',
            p.employeeCode || 'LLC-0001',
            p.userName,
            p.designation || 'Sales Agent',
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
      }

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
          designation: String(row[4] || 'Sales Agent').trim(),
          joinDate: String(row[5] || '').trim() || Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd'),
          monthlyRate: Number(String(row[6]).replace(/[^0-9.]/g, '')) || 23000,
          hourlyRate: Number(String(row[7]).replace(/[^0-9.]/g, '')) || 143.75,
          teamLeaderId: String(row[8] || '').trim(),
          screenshotMonitored: String(row[9]).toUpperCase() === 'YES' || row[9] === true,
          activityMonitored: String(row[10]).toUpperCase() === 'YES' || row[10] === true,
          status: String(row[11] || 'active').toLowerCase().trim()
        });
      });
    }
    return ContentService.createTextOutput(JSON.stringify({
      status: 'SUCCESS',
      count: employees.length,
      employees: employees,
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
  if (webhookUrl && webhookUrl.trim() && webhookUrl.includes('script.google.com')) {
    try {
      const res = await fetch(webhookUrl.trim(), { method: 'GET' });
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.employees) && json.employees.length > 0) {
          json.employees.forEach((rawEmp: any, idx: number) => {
            const code = String(rawEmp.employeeCode || `LLC-${1000 + idx}`).trim();
            const existing = userMap.get(code.toUpperCase()) || userMap.get((rawEmp.email || '').toLowerCase());

            const role = (['admin', 'va_admin', 'team_leader', 'hr', 'payroll', 'employee'].includes(rawEmp.role?.toLowerCase())
              ? rawEmp.role.toLowerCase()
              : code.toLowerCase() === 'superadmin' ? 'admin' : 'employee') as any;

            const isSuperAdmin = code.toLowerCase() === 'superadmin' || role === 'admin';

            const userObj: User = {
              id: existing ? existing.id : `usr-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              employeeCode: code,
              name: rawEmp.name || existing?.name || (isSuperAdmin ? 'Red' : `Employee ${code}`),
              email: rawEmp.email || existing?.email || `${code.toLowerCase()}@llctimetracker.com`,
              role,
              designation: rawEmp.designation || existing?.designation || (role === 'admin' ? 'Admin' : 'Sales Agent'),
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
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const code = (row[0] || '').trim();
      const name = (row[1] || '').trim();
      const email = (row[2] || '').trim();
      const roleStr = (row[3] || 'employee').toLowerCase().trim();
      const designation = (row[4] || 'Sales Agent').trim();
      const joinDateStr = (row[5] || '').trim();
      const monthlyRateStr = (row[6] || '').replace(/[^0-9.]/g, '');
      const hourlyRateStr = (row[7] || '').replace(/[^0-9.]/g, '');
      const supervisor = (row[8] || '').trim();
      const scrMonitored = (row[9] || '').toUpperCase() === 'YES';
      const actMonitored = (row[10] || '').toUpperCase() === 'YES';
      const statusStr = (row[11] || 'active').toLowerCase().trim();

      if (!code && !name) continue;

      const validRole = (['admin', 'va_admin', 'team_leader', 'hr', 'payroll', 'employee'].includes(roleStr)
        ? roleStr
        : code.toLowerCase() === 'superadmin' ? 'admin' : 'employee') as any;

      const isSuperAdmin = code.toLowerCase() === 'superadmin' || validRole === 'admin';

      const existing = userMap.get(code.toUpperCase()) || userMap.get(email.toLowerCase());

      const userObj: User = {
        id: existing ? existing.id : `usr-${code.toLowerCase().replace(/[^a-z0-9]/g, '-') || `auto-${i}`}`,
        employeeCode: code || `LLC-${String(i).padStart(4, '0')}`,
        name: name || existing?.name || (isSuperAdmin ? 'Admin' : `Employee ${code}`),
        email: email || existing?.email || `${code.toLowerCase()}@llctimetracker.com`,
        role: validRole,
        designation: (designation as any) || existing?.designation || (validRole === 'admin' ? 'Admin' : 'Sales Agent'),
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
  leaveRequests: LeaveRequest[] = []
): Promise<{ success: boolean; message: string }> => {
  if (!webhookUrl || !webhookUrl.trim()) {
    return {
      success: false,
      message: 'No Google Sheets Webhook URL configured. Please paste your Google Apps Script Web App URL in Settings.',
    };
  }

  try {
    // Hide emergency backup account from database spreadsheet sync
    const safeUsers = users.filter((u) => !u.isSecretBackup);

    const payload = {
      action: 'SYNC_ALL',
      timeLogs,
      users: safeUsers,
      auditLogs,
      payrollRecords,
      dailyAttendanceLogs,
      idleLogs,
      leaveRequests,
      syncedAt: new Date().toISOString(),
    };

    // Google Apps Script redirect follows automatically; send as text/plain to avoid CORS preflight blocking
    await fetch(webhookUrl.trim(), {
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
    console.error('Google Sheets Sync error:', err);
    return {
      success: false,
      message: `Failed to connect to Google Sheets webhook: ${err?.message || 'Network error'}`,
    };
  }
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

