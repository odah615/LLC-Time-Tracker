import { AuditLog, TimeLog, User, PayrollRecord, DailyAttendanceLog, IdleLog, LeaveRequest, UserPresence } from '../types';
import { generateUniqueUsername, isPlaceholderName, deduplicateUsers, resolveCanonicalEmployee } from './userUtils';
import { getManilaDateString } from './dateUtils';

export const DEFAULT_SPREADSHEET_ID = '1h8ssmDEcV-PMGlkpOzfQCtlRpnoT0CBQQveT3e4wPfA';
export const DEFAULT_SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1h8ssmDEcV-PMGlkpOzfQCtlRpnoT0CBQQveT3e4wPfA/edit?gid=1299988798#gid=1299988798';
export const DEFAULT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbyKGMOWV0u5xcv_lOKBk6LXpbjrlgZiuqtCs3_HbqjekoJZdXpdfA_1kDjP7H0ulLsw3Q/exec';

/**
 * Normalizes work date into stable YYYY-MM-DD format (Asia/Manila).
 * Removes full JavaScript Date strings (e.g., "Thu Oct 08 2026 00:00:00 GMT+0800")
 * and prevents 1899 date artifacts from corrupting work dates.
 */
export const normalizeWorkDate = (rawDate?: any, fallbackDate?: string): string => {
  if (!rawDate && !fallbackDate) {
    return getManilaDateString();
  }
  const str = String(rawDate || '').trim();

  // If it's a 1899 date string, it's a time-only cell artifact, ignore and use fallback
  if (str.includes('1899')) {
    return fallbackDate ? normalizeWorkDate(fallbackDate) : getManilaDateString();
  }

  // Exact YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // ISO timestamp (YYYY-MM-DDTHH:mm:ss...)
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    const isoDate = str.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      return isoDate;
    }
  }

  // Month name map
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
  };

  // Text date format e.g. "Thu Oct 08 2026 00:00:00 GMT+0800" or "Oct 08 2026" or "October 8, 2026"
  const textMonthMatch = str.match(/(?:[A-Za-z]+,?\s+)?([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i);
  if (textMonthMatch) {
    const mStr = textMonthMatch[1].toLowerCase();
    const day = textMonthMatch[2].padStart(2, '0');
    const year = textMonthMatch[3];
    const month = monthMap[mStr] || monthMap[mStr.slice(0, 3)];
    if (month && Number(year) >= 2000) {
      return `${year}-${month}-${day}`;
    }
  }

  // Slash or dash format: MM/DD/YYYY or DD/MM/YYYY or YYYY/MM/DD
  if (str.includes('/') || (str.includes('-') && !str.startsWith('1899'))) {
    const parts = str.split(/[\/\-]/);
    if (parts.length === 3) {
      // YYYY/MM/DD
      if (parts[0].length === 4 && Number(parts[0]) >= 2000) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      // MM/DD/YYYY or DD/MM/YYYY
      if (parts[2].length === 4 && Number(parts[2]) >= 2000) {
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        const y = parts[2];
        if (p0 > 12) {
          // DD/MM/YYYY
          return `${y}-${String(p1).padStart(2, '0')}-${String(p0).padStart(2, '0')}`;
        }
        // MM/DD/YYYY
        return `${y}-${String(p0).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
      }
    }
  }

  // Google Sheets numeric serial date (e.g. 46303 -> 2026-10-08)
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const serial = parseFloat(str);
    if (serial >= 30000 && serial <= 60000) {
      const utcMs = (serial - 25569) * 86400 * 1000;
      const d = new Date(utcMs);
      if (!isNaN(d.getTime())) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    }
  }

  // Fallback to Date object parsing if valid year >= 2000
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (fallbackDate) {
    return normalizeWorkDate(fallbackDate);
  }

  return getManilaDateString();
};

/**
 * Normalizes time-only strings, extracting pure 12h/24h time without 1899 date artifacts.
 * e.g., "Sat Dec 30 1899 23:50:00 GMT+0800" -> "11:50:00 PM"
 *       "1899-12-30 11:50 AM" -> "11:50 AM"
 *       "1899-12-30 12:28 PM" -> "12:28 PM"
 */
export const normalizeTimeValue = (rawTime?: any, fallbackDefault?: string): string => {
  if (rawTime === null || rawTime === undefined) {
    return fallbackDefault || '';
  }
  const str = String(rawTime).trim();
  if (!str) return fallbackDefault || '';

  // Preserve live status keywords
  if (
    str.toLowerCase().includes('running') ||
    str.toLowerCase().includes('in progress') ||
    str.toLowerCase().includes('active live')
  ) {
    return 'Running Live';
  }

  // Check if string contains 12-hour AM/PM time (e.g. "11:50 AM", "12:28:00 PM", "1899-12-30 11:50 AM")
  const ampmMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)/i);
  if (ampmMatch) {
    const hh = parseInt(ampmMatch[1], 10);
    const mm = ampmMatch[2];
    const ss = ampmMatch[3];
    const modifier = ampmMatch[4].toUpperCase().replace(/\./g, '');
    return ss ? `${hh}:${mm}:${ss} ${modifier}` : `${hh}:${mm} ${modifier}`;
  }

  // Check if string is a JavaScript Date string with 24-hour time (e.g., "Sat Dec 30 1899 23:50:00 GMT+0800")
  const gmtTimeMatch = str.match(/(?:1899|\d{4})[^\d]+(\d{1,2}):(\d{2}):(\d{2})/);
  if (gmtTimeMatch) {
    const hours = parseInt(gmtTimeMatch[1], 10);
    const mins = gmtTimeMatch[2];
    const secs = gmtTimeMatch[3];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${mins}:${secs} ${ampm}`;
  }

  // Check if string is simple 24-hour time "23:50:00" or "11:50"
  const time24Match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (time24Match) {
    const hours = parseInt(time24Match[1], 10);
    const mins = time24Match[2];
    const secs = time24Match[3];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return secs ? `${hours12}:${mins}:${secs} ${ampm}` : `${hours12}:${mins} ${ampm}`;
  }

  // If already clean time
  if (/^\d{1,2}:\d{2}(?::\d{2})?\s*(AM|PM)$/i.test(str)) {
    return str;
  }

  // If ISO string with valid time
  if (str.includes('T')) {
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const hours = d.getHours();
        const mins = String(d.getMinutes()).padStart(2, '0');
        const secs = String(d.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        return `${hours12}:${mins}:${secs} ${ampm}`;
      }
    } catch {}
  }

  return str;
};

/**
 * Robust Duration Seconds Parser:
 * Primary: numeric durationSeconds, string digits e.g. "2237", "2,237"
 * Fallback 1: formatted totalTime e.g. "37m 17s", "1h 15m", "00:37:17"
 * Fallback 2: Calculate difference between End Time and Start Time (with overnight support)
 */
export const parseDurationSeconds = (
  rawDuration?: any,
  formattedTotalTime?: any,
  startTime?: any,
  endTime?: any
): number => {
  // 1. Primary: Numeric or string digits in durationSeconds, or recovered from Date object
  // If rawDuration is a Date object (e.g. from previously date-formatted Duration column):
  // - Year 1899: time-of-day fractional duration (diff in ms / 1000 = seconds)
  // - Year 1900..2010: numeric seconds formatted as Date (serial days since 1899-12-30 = original duration seconds)
  // - Year > 2010 (e.g. 2026): modern calendar dates are rejected
  if (rawDuration !== undefined && rawDuration !== null && rawDuration !== '') {
    const isDateObj = rawDuration instanceof Date || Object.prototype.toString.call(rawDuration) === '[object Date]';
    if (isDateObj) {
      try {
        const sheetEpoch = new Date(1899, 11, 30, 0, 0, 0);
        const yr = rawDuration.getFullYear();
        if (yr === 1899) {
          const ms = rawDuration.getTime() - sheetEpoch.getTime();
          const secs = Math.round(ms / 1000);
          if (!isNaN(secs) && secs > 0 && secs < 604800) return secs;
        } else if (yr >= 1900 && yr <= 2010) {
          const days = Math.round((rawDuration.getTime() - sheetEpoch.getTime()) / (86400 * 1000));
          if (!isNaN(days) && days > 0 && days < 604800) return days;
        }
      } catch (e) {}
    } else {
      if (typeof rawDuration === 'number' && !isNaN(rawDuration)) {
        const n = Math.floor(rawDuration);
        if (n > 0 && n < 604800) return n;
      }
      const rawStr = String(rawDuration).trim();
      const cleanDigits = rawStr.replace(/,/g, '');
      if (/^\d+$/.test(cleanDigits)) {
        const parsed = parseInt(cleanDigits, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed < 604800) return parsed;
      } else if (rawStr.includes('/') || rawStr.includes('-') || rawStr.includes('GMT')) {
        try {
          const dParsed = new Date(rawStr);
          if (!isNaN(dParsed.getTime())) {
            const sheetEpoch = new Date(1899, 11, 30, 0, 0, 0);
            const yr = dParsed.getFullYear();
            if (yr === 1899) {
              const ms = dParsed.getTime() - sheetEpoch.getTime();
              const secs = Math.round(ms / 1000);
              if (!isNaN(secs) && secs > 0 && secs < 604800) return secs;
            } else if (yr >= 1900 && yr <= 2010) {
              const days = Math.round((dParsed.getTime() - sheetEpoch.getTime()) / (86400 * 1000));
              if (!isNaN(days) && days > 0 && days < 604800) return days;
            }
          }
        } catch (e) {}
      }
    }
  }

  // 2. Fallback 1: Parse formatted total time (e.g. "37m 17s", "1h 15m", "00:37:17", "37 mins")
  if (formattedTotalTime !== undefined && formattedTotalTime !== null && formattedTotalTime !== '') {
    const text = String(formattedTotalTime).trim().toLowerCase();

    // Pattern: "Xh Ym Zs" or "Xh Ym" or "Ym Zs" or "Ys"
    const hMatch = text.match(/(\d+)\s*h(?:ours?|rs?)?/);
    const mMatch = text.match(/(\d+)\s*m(?:inutes?|ins?)?/);
    const sMatch = text.match(/(\d+)\s*s(?:econds?|ecs?)?/);

    if (hMatch || mMatch || sMatch) {
      const hours = hMatch ? parseInt(hMatch[1], 10) : 0;
      const mins = mMatch ? parseInt(mMatch[1], 10) : 0;
      const secs = sMatch ? parseInt(sMatch[1], 10) : 0;
      const total = hours * 3600 + mins * 60 + secs;
      if (total > 0 && total < 604800) return total;
    }

    // Pattern: "HH:MM:SS" or "MM:SS" (e.g. "00:37:17", "37:17")
    const colonMatch = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (colonMatch) {
      const p1 = parseInt(colonMatch[1], 10);
      const p2 = parseInt(colonMatch[2], 10);
      const p3 = colonMatch[3] !== undefined ? parseInt(colonMatch[3], 10) : undefined;
      if (p3 !== undefined) {
        // HH:MM:SS
        const total = p1 * 3600 + p2 * 60 + p3;
        if (total > 0 && total < 604800) return total;
      } else {
        // MM:SS
        const total = p1 * 60 + p2;
        if (total > 0 && total < 604800) return total;
      }
    }

    // Decimal hours (e.g. "0.62 hrs" or "2.5h")
    const decMatch = text.match(/^(\d+(?:\.\d+)?)\s*(?:h|hrs|hours)$/);
    if (decMatch) {
      const total = Math.round(parseFloat(decMatch[1]) * 3600);
      if (total > 0 && total < 604800) return total;
    }
  }

  // 3. Fallback 2: Calculate difference between End Time and Start Time
  if (startTime && endTime && typeof startTime === 'string' && typeof endTime === 'string') {
    const sNorm = normalizeTimeValue(startTime);
    const eNorm = normalizeTimeValue(endTime);

    if (eNorm && sNorm && eNorm !== 'Running Live' && !eNorm.includes('Running')) {
      const timeToSecs = (tStr: string): number | null => {
        const ampmMatch = tStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)/i);
        if (ampmMatch) {
          let h = parseInt(ampmMatch[1], 10);
          const m = parseInt(ampmMatch[2], 10);
          const s = ampmMatch[3] ? parseInt(ampmMatch[3], 10) : 0;
          const isPM = ampmMatch[4].toUpperCase() === 'PM';
          if (isPM && h < 12) h += 12;
          if (!isPM && h === 12) h = 0;
          return h * 3600 + m * 60 + s;
        }
        const match24 = tStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (match24) {
          const h = parseInt(match24[1], 10);
          const m = parseInt(match24[2], 10);
          const s = match24[3] ? parseInt(match24[3], 10) : 0;
          return h * 3600 + m * 60 + s;
        }
        return null;
      };

      const startSecs = timeToSecs(sNorm);
      const endSecs = timeToSecs(eNorm);
      if (startSecs !== null && endSecs !== null) {
        let diff = endSecs - startSecs;
        if (diff < 0) {
          // Overnight session: spans midnight
          diff += 86400;
        }
        if (diff > 0 && diff < 86400 * 7) return diff;
      }
    }
  }

  return 0;
};

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
/**
 * Safely parse and validate duration seconds in Google Apps Script.
 * - When val is a JavaScript Date object (e.g. from previously date-formatted Duration column),
 *   recovers its underlying Google Sheets serial value and converts serial days to seconds:
 *   Google Sheets serial days * 86400 = duration seconds.
 * - Preserves legitimate values: 0, 407, 1680, 2829, 5460, 8640, 10160, 22032.
 * - Rejects corrupted duration values >= 604,800 seconds (7 days), including ~4,000,584,097s from modern dates.
 * - Returns valid duration integer in [0, 604799].
 */
function parseDurationSecondsSafe(val) {
  if (val === undefined || val === null || val === '') return 0;
  var sheetEpoch = new Date(1899, 11, 30, 0, 0, 0);

  // 1. When val is a JavaScript Date object in the Duration (Seconds) column:
  // - Year 1899: time-of-day / fractional duration (ms diff / 1000 = seconds)
  // - Year 1900..2010: numeric seconds formatted as Date (serial days since 1899-12-30 = original duration seconds)
  // - Year > 2010 (e.g. modern dates 2026): rejected as calendar timestamps
  if (val instanceof Date || Object.prototype.toString.call(val) === '[object Date]') {
    try {
      var yr = val.getFullYear();
      if (yr === 1899) {
        var ms = val.getTime() - sheetEpoch.getTime();
        var s = Math.round(ms / 1000);
        if (!isNaN(s) && s > 0 && s < 604800) return s;
      } else if (yr >= 1900 && yr <= 2010) {
        var days = Math.round((val.getTime() - sheetEpoch.getTime()) / (86400 * 1000));
        if (!isNaN(days) && days > 0 && days < 604800) return days;
      }
    } catch (e) {}
    return 0;
  }

  var n = 0;
  if (typeof val === 'number') {
    if (isNaN(val)) return 0;
    n = Math.floor(val);
  } else {
    var str = String(val).trim();
    if (!str) return 0;

    var cleanDigits = str.replace(/,/g, '');
    if (/^\d+$/.test(cleanDigits)) {
      var pNum = parseInt(cleanDigits, 10);
      if (!isNaN(pNum) && pNum > 0 && pNum < 604800) return pNum;
      return 0;
    }

    if (str.indexOf('/') !== -1 || str.indexOf('-') !== -1 || str.indexOf('GMT') !== -1) {
      try {
        var dParsed = new Date(str);
        if (!isNaN(dParsed.getTime())) {
          var yParsed = dParsed.getFullYear();
          if (yParsed === 1899) {
            var msP = dParsed.getTime() - sheetEpoch.getTime();
            var sP = Math.round(msP / 1000);
            if (!isNaN(sP) && sP > 0 && sP < 604800) return sP;
          } else if (yParsed >= 1900 && yParsed <= 2010) {
            var daysP = Math.round((dParsed.getTime() - sheetEpoch.getTime()) / (86400 * 1000));
            if (!isNaN(daysP) && daysP > 0 && daysP < 604800) return daysP;
          }
        }
      } catch (e2) {}
      return 0;
    }

    // Formatted time strings e.g. "2h 24m 0s", "37m 17s", "45s"
    var hMatch = str.match(/^(\d+)\s*h(?:ours?|rs?)?(?:\s*(\d+)\s*m(?:inutes?|ins?)?)?(?:\s*(\d+)\s*s(?:econds?|ecs?)?)?$/i);
    var mMatch = str.match(/^(\d+)\s*m(?:inutes?|ins?)?(?:\s*(\d+)\s*s(?:econds?|ecs?)?)?$/i);
    var sMatch = str.match(/^(\d+)\s*s(?:econds?|ecs?)?$/i);
    if (hMatch) {
      var hours = parseInt(hMatch[1], 10) || 0;
      var mins = parseInt(hMatch[2], 10) || 0;
      var secs = parseInt(hMatch[3], 10) || 0;
      n = hours * 3600 + mins * 60 + secs;
    } else if (mMatch) {
      var mins2 = parseInt(mMatch[1], 10) || 0;
      var secs2 = parseInt(mMatch[2], 10) || 0;
      n = mins2 * 60 + secs2;
    } else if (sMatch) {
      n = parseInt(sMatch[1], 10) || 0;
    } else if (str.indexOf(':') !== -1) {
      var colonMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (colonMatch) {
        var p1 = parseInt(colonMatch[1], 10);
        var p2 = parseInt(colonMatch[2], 10);
        var p3 = colonMatch[3] !== undefined ? parseInt(colonMatch[3], 10) : undefined;
        if (p3 !== undefined) {
          n = p1 * 3600 + p2 * 60 + p3;
        } else {
          n = p1 * 60 + p2;
        }
      } else {
        return 0;
      }
    } else {
      return 0;
    }
  }
  if (isNaN(n) || n <= 0 || n >= 604800) return 0;
  return n;
}

/**
 * Mathematically accurate Total Time conversion:
 * - >= 1 hour: "Xh Ym Zs" (e.g. 27529s -> "7h 38m 49s")
 * - < 1 hour: "Ym Zs" (e.g. 1121s -> "18m 41s", 2147s -> "35m 47s")
 * - < 1 min: "Zs" (e.g. 14s -> "14s")
 */
function formatTotalTime(totalSecs) {
  var secs = parseDurationSecondsSafe(totalSecs);
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
 * Safely extracts a clean time-of-day string (e.g. "08:57:00 AM" or "09:02 AM") without 1899 date artifacts.
 * - Converts Date objects to formatted time string (hh:mm:ss a) in Manila time.
 * - Extracts time from long date strings like "Sat Dec 30 1899 08:57:00 GMT+0800".
 * - Preserves 'Running Live'.
 */
function formatTimeOnlyCell(val) {
  if (val === undefined || val === null || val === '') return '';
  if (val === 'Running Live' || String(val).indexOf('Running') !== -1) return 'Running Live';
  if (val instanceof Date || Object.prototype.toString.call(val) === '[object Date]') {
    try {
      return Utilities.formatDate(val, 'Asia/Manila', 'hh:mm:ss a');
    } catch(e) {
      var hrs = val.getHours();
      var mins = val.getMinutes();
      var secs = val.getSeconds();
      var ampm = hrs >= 12 ? 'PM' : 'AM';
      hrs = hrs % 12;
      if (hrs === 0) hrs = 12;
      return (hrs < 10 ? '0' + hrs : hrs) + ':' + (mins < 10 ? '0' + mins : mins) + ':' + (secs < 10 ? '0' + secs : secs) + ' ' + ampm;
    }
  }
  var str = String(val).trim();
  if (str === 'Running Live' || str.indexOf('Running') !== -1) return 'Running Live';
  var ampmMatch = str.match(/(?:^|\s|T)(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)/i);
  if (ampmMatch) {
    var h = parseInt(ampmMatch[1], 10);
    var m = ampmMatch[2];
    var s = ampmMatch[3] || '00';
    var am = ampmMatch[4].toUpperCase();
    return (h < 10 ? '0' + h : '' + h) + ':' + m + ':' + s + ' ' + am;
  }
  var time24Match = str.match(/(?:^|\s|T)(\d{1,2}):(\d{2}):(\d{2})/);
  if (time24Match) {
    var h2 = parseInt(time24Match[1], 10);
    var m2 = time24Match[2];
    var s2 = time24Match[3];
    var am2 = h2 >= 12 ? 'PM' : 'AM';
    h2 = h2 % 12;
    if (h2 === 0) h2 = 12;
    return (h2 < 10 ? '0' + h2 : '' + h2) + ':' + m2 + ':' + s2 + ' ' + am2;
  }
  return str;
}

/**
 * Safely extracts a clean date string (yyyy-MM-dd) without timestamp artifacts.
 */
function formatDateOnlyCell(val, fallback) {
  if (val === undefined || val === null || val === '') return fallback || '';
  if (val instanceof Date || Object.prototype.toString.call(val) === '[object Date]') {
    try {
      var y = val.getFullYear();
      if (y >= 2020) {
        return Utilities.formatDate(val, 'Asia/Manila', 'yyyy-MM-dd');
      }
      return fallback || '';
    } catch(e) {
      return fallback || '';
    }
  }
  var str = String(val).trim();
  var dMatch = str.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (dMatch) {
    var yr = parseInt(dMatch[1], 10);
    if (yr >= 2020) {
      var mo = ('0' + dMatch[2]).slice(-2);
      var da = ('0' + dMatch[3]).slice(-2);
      return yr + '-' + mo + '-' + da;
    }
  }
  return fallback || str;
}

/**
 * Safely calculates duration in seconds between Start Time and End Time without ANY cross-epoch or 1899 date artifacts.
 * Priority:
 * 1. Clean time-of-day strings (e.g. "08:57:00 AM", "11:21:00 AM") normalized to the SAME date context (with overnight support).
 * 2. Only if both are full modern ISO timestamps (years >= 2020), calculates diff.
 * 3. Never subtracts an 1899/1900 date from a 2020+ timestamp.
 * 4. Never returns >= 604800 seconds (7 days) or negative values.
 */
function calculateTimeDifferenceSecsSafe(startTime, endTime, dateStr, idleSecs) {
  if (!startTime || !endTime) return 0;
  var sStr = formatTimeOnlyCell(startTime);
  var eStr = formatTimeOnlyCell(endTime);
  if (!sStr || !eStr || eStr === 'Running Live') return 0;

  var idles = (typeof idleSecs === 'number' && !isNaN(idleSecs)) ? Math.max(0, Math.floor(idleSecs)) : 0;

  function parseSecondsOfDay(tVal) {
    if (!tVal) return null;
    var tText = String(tVal).trim();
    var ampmMatch = tText.match(/(?:^|\s|T)(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)/i);
    if (ampmMatch) {
      var h = parseInt(ampmMatch[1], 10);
      var m = parseInt(ampmMatch[2], 10);
      var s = ampmMatch[3] ? parseInt(ampmMatch[3], 10) : 0;
      var isPm = ampmMatch[4].toUpperCase() === 'PM';
      if (isPm && h < 12) h += 12;
      if (!isPm && h === 12) h = 0;
      return h * 3600 + m * 60 + s;
    }
    var time24Match = tText.match(/(?:^|\s|T)(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (time24Match) {
      var h2 = parseInt(time24Match[1], 10);
      var m2 = parseInt(time24Match[2], 10);
      var s2 = time24Match[3] ? parseInt(time24Match[3], 10) : 0;
      if (h2 >= 0 && h2 < 24 && m2 >= 0 && m2 < 60) {
        return h2 * 3600 + m2 * 60 + s2;
      }
    }
    return null;
  }

  // 1. Primary: pure time-of-day calculation on the same calendar day context
  var sSec = parseSecondsOfDay(sStr);
  var eSec = parseSecondsOfDay(eStr);
  if (sSec !== null && eSec !== null) {
    var diff = eSec - sSec;
    if (diff < 0) {
      // Overnight shift spanning midnight (e.g. 10:00 PM to 06:00 AM)
      diff += 86400;
    }
    var netDiff = diff - idles;
    if (netDiff > 0 && netDiff < 604800) {
      return netDiff;
    }
  }

  // 2. Secondary: full modern ISO strings (years >= 2020 only)
  var dStart = new Date(String(startTime).trim());
  var dEnd = new Date(String(endTime).trim());
  if (!isNaN(dStart.getTime()) && !isNaN(dEnd.getTime())) {
    var yStart = dStart.getFullYear();
    var yEnd = dEnd.getFullYear();
    // NEVER subtract an 1899 or 1970 date from a 2020+ date!
    if (yStart >= 2020 && yEnd >= 2020 && Math.abs(yEnd - yStart) <= 1) {
      var diffMs = dEnd.getTime() - dStart.getTime();
      if (diffMs > 0) {
        var diffSec = Math.floor(diffMs / 1000) - idles;
        if (diffSec > 0 && diffSec < 604800) {
          return diffSec;
        }
      }
    }
  }

  return 0;
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
  var durColIdx = -1;
  for (var hi = 0; hi < headers.length; hi++) {
    if (String(headers[hi]).indexOf('Duration (Seconds)') !== -1) {
      durColIdx = hi;
      break;
    }
  }

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
            var rawVal = exRow[c] !== undefined ? exRow[c] : '';
            if (c === durColIdx) {
              // Sanitize legacy or corrupt duration values: convert Date objects or bad values to clean numeric seconds
              rawVal = parseDurationSecondsSafe(rawVal);
              if (!rawVal && exRow[c + 1]) {
                rawVal = parseDurationSecondsSafe(exRow[c + 1]);
              }
            } else if (c === durColIdx + 1) {
              if (rawVal && String(rawVal).indexOf('1111') !== -1) {
                var sSecs = parseDurationSecondsSafe(exRow[durColIdx]);
                rawVal = sSecs > 0 ? formatTotalTime(sSecs) : '0s';
              }
            } else if (c === 5) {
              rawVal = formatDateOnlyCell(rawVal, '');
            } else if (c === 6 || c === 7) {
              rawVal = formatTimeOnlyCell(rawVal);
            }
            normalized.push(rawVal);
          }
          rowMap[k] = normalized;
        }
      }
    }
  } catch (readErr) {}

  // Merge incoming rows
  if (incomingRows && incomingRows.length > 0) {
    for (var i = 0; i < incomingRows.length; i++) {
      var inRow = incomingRows[i].slice();
      if (durColIdx !== -1 && durColIdx < inRow.length) {
        inRow[durColIdx] = parseDurationSecondsSafe(inRow[durColIdx]);
      }
      if (inRow.length > 5) inRow[5] = formatDateOnlyCell(inRow[5], '');
      if (inRow.length > 6) inRow[6] = formatTimeOnlyCell(inRow[6]);
      if (inRow.length > 7) inRow[7] = formatTimeOnlyCell(inRow[7]);
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

  // Deep sanitize all cells to ensure zero undefined or null values and pure numbers in Duration
  var sanitizedMergedData = [];
  for (var mr = 0; mr < allData.length; mr++) {
    var cleanMergedRow = [];
    for (var mc = 0; mc < numCols; mc++) {
      var cellMVal = allData[mr][mc];
      if (mr > 0) {
        if (mc === durColIdx) {
          cellMVal = parseDurationSecondsSafe(cellMVal);
          if (!cellMVal && allData[mr][mc + 1]) {
            cellMVal = parseDurationSecondsSafe(allData[mr][mc + 1]);
          }
        } else if (mc === durColIdx + 1) {
          if (cellMVal && String(cellMVal).indexOf('1111') !== -1) {
            var cSecs = parseDurationSecondsSafe(allData[mr][durColIdx]);
            cellMVal = cSecs > 0 ? formatTotalTime(cSecs) : '0s';
          }
        } else if (mc === 5) {
          cellMVal = formatDateOnlyCell(cellMVal, '');
        } else if (mc === 6 || mc === 7) {
          cellMVal = formatTimeOnlyCell(cellMVal);
        }
      }
      cleanMergedRow.push(cellMVal === undefined || cellMVal === null ? '' : cellMVal);
    }
    sanitizedMergedData.push(cleanMergedRow);
  }

  // Set values in-place smoothly without clearing formatting
  sheet.getRange(1, 1, numRows, numCols).setValues(sanitizedMergedData);

  // CRITICAL FIX: Ensure Duration (Seconds) column is explicitly formatted as plain number '0'
  // so Google Sheets never formats duration numbers as dates (e.g. 7140 as 7/19/1919)
  if (durColIdx !== -1 && numRows > 1) {
    try {
      sheet.getRange(2, durColIdx + 1, numRows - 1, 1).setNumberFormat('0');
    } catch (fmtErr) {}
  }

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

  // Format Duration (Seconds) column as plain number if present
  var cleanDurIdx = headers.indexOf('Duration (Seconds)');
  if (cleanDurIdx !== -1 && numRows > 1) {
    try {
      sheet.getRange(2, cleanDurIdx + 1, numRows - 1, 1).setNumberFormat('0');
    } catch (fmtErr) {}
  }

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
  var candidateNames = ['Employee_Directory', 'Employee Directory', 'Employee_directory', 'Employees', 'Staff_Directory', 'Staff', 'mployee_Directory'];
  for (var i = 0; i < candidateNames.length; i++) {
    var sh = ss.getSheetByName(candidateNames[i]);
    if (sh) return sh;
  }
  var allSheets = ss.getSheets();
  for (var j = 0; j < allSheets.length; j++) {
    var rawName = allSheets[j].getName().toLowerCase().replace(/[\s_\-]+/g, '');
    if (rawName === 'employeedirectory' || rawName === 'employees' || rawName === 'staffdirectory' || rawName === 'mployeedirectory') {
      return allSheets[j];
    }
  }
  var newSheet = ss.insertSheet('Employee_Directory');
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

  var list = (directoryUsers && directoryUsers.length > 0) ? directoryUsers : [];

  targetSheets.forEach(function(sh) {
    try {
      if (sh.getLastRow() === 0) {
        sh.appendRow(empHeaders);
        sh.getRange(1, 1, 1, empHeaders.length).setFontWeight('bold').setBackground('#0284c7').setFontColor('#ffffff');
        sh.setFrozenRows(1);
      }

      // Read ALL existing rows from this sheet so no employee is ever deleted!
      var existingRows = [];
      var existingMap = {};
      var lastRow = sh.getLastRow();
      if (lastRow > 1) {
        var numCols = Math.max(sh.getLastColumn(), 14);
        var data = sh.getRange(2, 1, lastRow - 1, numCols).getValues();
        for (var r = 0; r < data.length; r++) {
          var row = data[r];
          var eCode = String(row[0] || '').trim().toUpperCase();
          var eUser = String(row[1] || '').trim().toLowerCase();
          var eEmail = String(row[3] || '').trim().toLowerCase();
          var key = (eCode && eCode !== 'N/A') ? eCode : (eUser ? eUser : (eEmail ? eEmail : ('row_' + r)));
          existingMap[key] = { rowIndex: r, row: row };
          if (eCode && eCode !== 'N/A') existingMap[eCode] = { rowIndex: r, row: row };
          if (eUser) existingMap[eUser] = { rowIndex: r, row: row };
          if (eEmail) existingMap[eEmail] = { rowIndex: r, row: row };
          existingRows.push(row);
        }
      }

      // Merge incoming users into existingRows
      var seenKeys = {};
      list.forEach(function(u) {
        if (!u) return;
        var code = String(u.employeeCode || '').trim().toUpperCase();
        var uName = String(u.username || '').trim().toLowerCase();
        var email = String(u.email || '').trim().toLowerCase();
        var dKey = (code && code !== 'N/A') ? code : (uName ? uName : (email ? email : (u.id || Math.random())));
        if (seenKeys[dKey]) return;
        seenKeys[dKey] = true;

        var existingMatch = (code && code !== 'N/A' && existingMap[code]) || (uName && existingMap[uName]) || (email && existingMap[email]);
        var maskedPass = maskPassword(u.password || 'Password123!');
        if (existingMatch && existingMatch.row && existingMatch.row[13]) {
          var exPass = String(existingMatch.row[13]).trim();
          if (exPass && exPass !== 'Password123!' && !exPass.includes('*') && (maskedPass === 'Password123!' || maskedPass.includes('*'))) {
            maskedPass = maskPassword(exPass);
          }
        }

        var hireDate = u.joinDate || (existingMatch ? existingMatch.row[6] : '2020-01-01');
        var supervisorName = 'None / Direct Executive';
        if (u.teamLeaderId && userMap) {
          var sv = userMap[u.teamLeaderId] || userMap[String(u.teamLeaderId).toUpperCase()];
          supervisorName = sv ? sv.name + ' (' + (sv.designation || sv.role) + ')' : u.teamLeaderId;
        } else if (existingMatch && existingMatch.row[9]) {
          supervisorName = existingMatch.row[9];
        }

        var mRate = (u.monthlyRate !== undefined && u.monthlyRate !== null && !isNaN(Number(u.monthlyRate))) ? Number(u.monthlyRate) : (existingMatch ? Number(existingMatch.row[7] || 0) : 0);
        var hRate = (u.hourlyRate !== undefined && u.hourlyRate !== null && !isNaN(Number(u.hourlyRate))) ? Number(u.hourlyRate) : (mRate > 0 ? Number((mRate / 160).toFixed(2)) : (existingMatch ? Number(existingMatch.row[8] || 0) : 0));

        var updatedRow = [
          u.employeeCode || (existingMatch ? existingMatch.row[0] : 'N/A'),
          u.username || (existingMatch ? existingMatch.row[1] : 'agent'),
          u.name || (existingMatch ? existingMatch.row[2] : 'Employee'),
          u.email || (existingMatch ? existingMatch.row[3] : ''),
          u.role || (existingMatch ? existingMatch.row[4] : 'agent'),
          u.designation || (existingMatch ? existingMatch.row[5] : 'Agent'),
          hireDate,
          mRate,
          hRate,
          supervisorName,
          u.screenshotMonitored ? 'YES' : ((existingMatch && existingMatch.row[10] === 'YES') ? 'YES' : 'NO'),
          u.activityMonitored ? 'YES' : ((existingMatch && existingMatch.row[11] === 'YES') ? 'YES' : 'NO'),
          u.status || (existingMatch ? existingMatch.row[12] : 'active'),
          maskedPass
        ];

        if (existingMatch) {
          existingRows[existingMatch.rowIndex] = updatedRow;
        } else {
          existingRows.push(updatedRow);
          existingMap[dKey] = { rowIndex: existingRows.length - 1, row: updatedRow };
        }
      });

      // Write merged rows back to sheet preserving all 117+ employees!
      if (existingRows.length > 0) {
        populateMergedSheet(sh, empHeaders, existingRows, '#0369a1', 0, 1);
      }
    } catch(err) {
      Logger.log('Error populating sheet ' + sh.getName() + ': ' + err.toString());
    }
  });

  return list.length;
}

var authHeaders = [
  'Employee Code',
  'Username',
  'Full Name',
  'Password Hash',
  'Must Change Password',
  'Last Login (ISO)',
  'Account Status',
  'Last Updated (ISO)'
];

function getEmployeeAuthSheet_(ss) {
  var candidateNames = ['Employee_Auth', 'Employee Auth', 'Staff_Auth', 'Auth_Accounts'];
  for (var i = 0; i < candidateNames.length; i++) {
    var sh = ss.getSheetByName(candidateNames[i]);
    if (sh) return sh;
  }
  var newSheet = ss.insertSheet('Employee_Auth');
  try {
    newSheet.setTabColor('#1e293b');
  } catch (e) {}
  return newSheet;
}

function hashEmployeePassword_(password) {
  if (!password) return '';
  var rawBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(password), Utilities.Charset.UTF_8);
  var hash = '';
  for (var i = 0; i < rawBytes.length; i++) {
    var byteVal = rawBytes[i];
    if (byteVal < 0) byteVal += 256;
    var byteHex = byteVal.toString(16);
    if (byteHex.length === 1) byteHex = '0' + byteHex;
    hash += byteHex;
  }
  return hash;
}

function upsertEmployeeAuthRecords_(ss, usersList) {
  var authSheet = getEmployeeAuthSheet_(ss);
  if (authSheet.getLastRow() === 0) {
    authSheet.appendRow(authHeaders);
    authSheet.getRange(1, 1, 1, authHeaders.length).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
    authSheet.setFrozenRows(1);
  }

  var existingRows = [];
  var existingAuthMap = {};
  var lastRow = authSheet.getLastRow();
  if (lastRow > 1) {
    var numCols = Math.max(authSheet.getLastColumn(), authHeaders.length);
    var data = authSheet.getRange(2, 1, lastRow - 1, numCols).getValues();
    for (var r = 0; r < data.length; r++) {
      var row = data[r];
      var eCode = String(row[0] || '').trim().toUpperCase();
      var eUser = String(row[1] || '').trim().toLowerCase();
      var key = (eCode && eCode !== 'N/A') ? eCode : (eUser ? eUser : ('auth_row_' + r));
      existingAuthMap[key] = { rowIndex: r, row: row };
      if (eCode && eCode !== 'N/A') existingAuthMap[eCode] = { rowIndex: r, row: row };
      if (eUser) existingAuthMap[eUser] = { rowIndex: r, row: row };
      existingRows.push(row);
    }
  }

  var list = (usersList && usersList.length > 0) ? usersList : [];
  var nowIso = new Date().toISOString();

  list.forEach(function(u) {
    if (!u) return;
    var code = String(u.employeeCode || '').trim().toUpperCase();
    var uName = String(u.username || '').trim().toLowerCase();
    var matchKey = (code && code !== 'N/A') ? code : uName;
    if (!matchKey) return;

    var existingMatch = existingAuthMap[matchKey] || (code && existingAuthMap[code]) || (uName && existingAuthMap[uName]);
    var rawPass = u.password ? String(u.password).trim() : '';

    // Determine password hash - PRESERVE existing hash unless a valid new unmasked password is provided
    var passHash = '';
    var isRealNewPass = rawPass && !rawPass.includes('*') && rawPass !== 'Password123!' && rawPass !== 'Pass****' && rawPass.length >= 3;

    if (isRealNewPass) {
      passHash = hashEmployeePassword_(rawPass);
    } else if (existingMatch && existingMatch.row && existingMatch.row[3] && String(existingMatch.row[3]).trim().length > 0) {
      passHash = String(existingMatch.row[3]).trim();
    } else if (rawPass && !rawPass.includes('*') && rawPass !== 'Pass****') {
      passHash = hashEmployeePassword_(rawPass);
    } else {
      passHash = hashEmployeePassword_('Password123!');
    }

    var mustChange = u.mustChangePassword !== undefined ? (u.mustChangePassword ? 'YES' : 'NO') :
                     (existingMatch && existingMatch.row && existingMatch.row[4] ? existingMatch.row[4] : 'NO');
    var lastLogin = (existingMatch && existingMatch.row && existingMatch.row[5]) ? existingMatch.row[5] : '';
    var status = u.status || (existingMatch && existingMatch.row && existingMatch.row[6]) || 'active';
    var fullName = u.name || (existingMatch && existingMatch.row && existingMatch.row[2]) || 'Employee';

    var authRow = [
      code || (existingMatch ? existingMatch.row[0] : 'N/A'),
      u.username || (existingMatch ? existingMatch.row[1] : 'agent'),
      fullName,
      passHash,
      mustChange,
      lastLogin,
      status,
      nowIso
    ];

    if (existingMatch) {
      existingRows[existingMatch.rowIndex] = authRow;
    } else {
      existingRows.push(authRow);
      existingAuthMap[matchKey] = { rowIndex: existingRows.length - 1, row: authRow };
    }
  });

  if (existingRows.length > 0) {
    populateMergedSheet(authSheet, authHeaders, existingRows, '#1e293b', 0, 7);
  }
}

function buildEmployeeProfileByCodeOrUsername_(ss, identifier) {
  if (!identifier) return null;
  var target = String(identifier).trim().toLowerCase();
  var targetUpper = target.toUpperCase();

  var dirSheet = getEmployeeDirectorySheet(ss);
  var dirData = [];
  if (dirSheet && dirSheet.getLastRow() > 1) {
    dirData = dirSheet.getRange(2, 1, dirSheet.getLastRow() - 1, Math.max(dirSheet.getLastColumn(), 14)).getValues();
  }

  var foundRow = null;
  for (var i = 0; i < dirData.length; i++) {
    var r = dirData[i];
    var rCode = String(r[0] || '').trim().toUpperCase();
    var rUser = String(r[1] || '').trim().toLowerCase();
    var rName = String(r[2] || '').trim().toLowerCase();
    var rEmail = String(r[3] || '').trim().toLowerCase();
    if (rCode === targetUpper || rUser === target || rName === target || rEmail === target) {
      foundRow = r;
      break;
    }
  }

  if (!foundRow) {
    return null;
  }

  var empCode = String(foundRow[0] || '').trim();
  var username = String(foundRow[1] || '').trim();
  var fullName = String(foundRow[2] || '').trim();
  var email = String(foundRow[3] || '').trim();
  var role = String(foundRow[4] || 'agent').trim();
  var designation = String(foundRow[5] || 'Agent').trim();
  var hireDate = String(foundRow[6] || '').trim();
  var monthlyRate = Number(foundRow[7] || 0);
  var hourlyRate = Number(foundRow[8] || 0);
  var supervisor = String(foundRow[9] || 'None / Direct Executive').trim();
  var screenshotMon = String(foundRow[10] || '').toUpperCase() === 'YES';
  var activityMon = String(foundRow[11] || '').toUpperCase() === 'YES';
  var status = String(foundRow[12] || 'active').trim();

  return {
    id: empCode || username || 'user_' + new Date().getTime(),
    name: fullName,
    employeeCode: empCode,
    username: username,
    email: email,
    role: role,
    designation: designation,
    joinDate: hireDate,
    monthlyRate: monthlyRate,
    hourlyRate: hourlyRate,
    teamLeaderId: supervisor,
    screenshotMonitored: screenshotMon,
    activityMonitored: activityMon,
    status: status
  };
}

function authenticateEmployee_(ss, usernameOrCode, inputPassword) {
  if (!usernameOrCode || !inputPassword) {
    return {
      status: 'ERROR',
      success: false,
      message: 'Username/employee code and password are required.'
    };
  }

  var target = String(usernameOrCode).trim().toLowerCase();
  var targetUpper = target.toUpperCase();
  var inputHash = hashEmployeePassword_(inputPassword);

  var authSheet = getEmployeeAuthSheet_(ss);
  var authData = [];
  var matchAuthRow = null;

  if (authSheet && authSheet.getLastRow() > 1) {
    authData = authSheet.getRange(2, 1, authSheet.getLastRow() - 1, Math.max(authSheet.getLastColumn(), 8)).getValues();
    for (var a = 0; a < authData.length; a++) {
      var aRow = authData[a];
      var aCode = String(aRow[0] || '').trim().toUpperCase();
      var aUser = String(aRow[1] || '').trim().toLowerCase();
      if (aCode === targetUpper || aUser === target) {
        matchAuthRow = { rowIndex: a + 2, row: aRow };
        break;
      }
    }
  }

  var isAuthenticated = false;
  var mustChange = false;

  if (matchAuthRow) {
    var storedHash = String(matchAuthRow.row[3] || '').trim();
    if (storedHash && (storedHash === inputHash || storedHash === inputPassword)) {
      isAuthenticated = true;
      mustChange = String(matchAuthRow.row[4] || '').toUpperCase() === 'YES';
      // Update Last Login in Employee_Auth
      try {
        authSheet.getRange(matchAuthRow.rowIndex, 6).setValue(new Date().toISOString());
      } catch (e) {}
    }
  } else {
    // Fallback: Check Employee_Directory directly
    var dirSheet = getEmployeeDirectorySheet(ss);
    if (dirSheet && dirSheet.getLastRow() > 1) {
      var dData = dirSheet.getRange(2, 1, dirSheet.getLastRow() - 1, Math.max(dirSheet.getLastColumn(), 14)).getValues();
      for (var d = 0; d < dData.length; d++) {
        var dRow = dData[d];
        var dCode = String(dRow[0] || '').trim().toUpperCase();
        var dUser = String(dRow[1] || '').trim().toLowerCase();
        if (dCode === targetUpper || dUser === target) {
          var dirPass = String(dRow[13] || '').trim();
          if (dirPass && !dirPass.includes('*') && (dirPass === inputPassword || hashEmployeePassword_(dirPass) === inputHash)) {
            isAuthenticated = true;
          }
          break;
        }
      }
    }
  }

  if (!isAuthenticated) {
    return {
      status: 'ERROR',
      success: false,
      message: 'Invalid credentials. Please verify your employee code/username and password.'
    };
  }

  var profile = buildEmployeeProfileByCodeOrUsername_(ss, usernameOrCode);
  if (!profile) {
    profile = {
      id: usernameOrCode,
      name: usernameOrCode,
      employeeCode: usernameOrCode,
      username: usernameOrCode,
      role: 'agent',
      designation: 'Agent',
      status: 'active'
    };
  }
  profile.mustChangePassword = mustChange;

  // Log successful login to Login_Logs
  try {
    var loginSheet = ss.getSheetByName('Login_Logs') || ss.getSheetByName('Login_Session_Logs');
    if (loginSheet) {
      var now = new Date();
      loginSheet.appendRow([
        'log_' + now.getTime(),
        now.toISOString(),
        Utilities.formatDate(now, 'Asia/Manila', 'yyyy-MM-dd hh:mm:ss a'),
        profile.employeeCode || 'N/A',
        profile.name,
        profile.role || 'agent',
        profile.designation || 'Agent',
        'Direct Auth Login',
        'Asia/Manila (GMT+8)',
        'Authenticated (Active)',
        maskPassword(inputPassword)
      ]);
    }
  } catch (logErr) {}

  return {
    status: 'SUCCESS',
    success: true,
    user: profile,
    mustChangePassword: mustChange,
    message: 'Authentication successful for ' + profile.name
  };
}

function resolveStaffFullName(code, username, name, id) {
  var n = (name || '').trim();
  if (n && n !== 'Unknown' && n !== 'Employee' && n !== 'Staff' && n !== 'Agent') {
    return n;
  }
  var u = (username || '').trim();
  if (u && u.toLowerCase() !== 'agent' && u.toLowerCase() !== 'employee') {
    return u;
  }
  var c = (code || '').toUpperCase().trim();
  if (c && c !== 'N/A') {
    return c;
  }
  return n || u || c || 'Employee';
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
      var nowMs = new Date().getTime();
      for (var r = 0; r < sheetData.length; r++) {
        var row = sheetData[r];
        var rowCode = String(row[0] || '').trim().toUpperCase();
        var rowName = String(row[1] || '').trim().toLowerCase();
        if ((targetCode && targetCode !== 'N/A' && rowCode === targetCode) ||
            (targetName && rowName === targetName) ||
            (resolvedName && rowName === resolvedName.toLowerCase())) {
          matchRow = r + 2;
          existingRow = row;
        } else {
          // Auto-sweep stale rows older than 5 minutes that are still marked as active
          var rowStatus = String(row[5] || '');
          var rowIso = String(row[12] || '');
          if (rowStatus.indexOf('Live Tracking') !== -1 || rowStatus.indexOf('Online') !== -1) {
            var rowTime = rowIso ? new Date(rowIso).getTime() : 0;
            if (rowTime > 0 && (nowMs - rowTime) > 300000) {
              sheet.getRange(r + 2, 6).setValue('⚪ Offline');
              sheet.getRange(r + 2, 7).setValue('Shift Concluded');
            }
          }
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
  var elapsedSecs = parseDurationSecondsSafe(p.elapsedSeconds);
  if (!elapsedSecs && existingRow && existingRow[8]) {
    var existingSecs = parseDurationSecondsSafe(existingRow[8]);
    if (existingSecs > 0 && existingSecs < 604800) {
      elapsedSecs = existingSecs;
    }
  }
  if (elapsedSecs >= 604800) {
    elapsedSecs = 0;
  }
  var todayStr = Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd');
  var startTime = formatTimeOnlyCell(p.firstCheckin || (existingRow && existingRow[6] ? existingRow[6] : Utilities.formatDate(new Date(), 'Asia/Manila', 'hh:mm:ss a')));
  var endTime = isTracking ? 'Running Live' : formatTimeOnlyCell(Utilities.formatDate(new Date(), 'Asia/Manila', 'hh:mm:ss a'));
  var status = isTracking ? 'running' : 'completed';

  var rowData = [
    targetSessionId,
    targetCode || 'N/A',
    resolvedName || targetName || 'Employee',
    p.designation || (existingRow ? existingRow[3] : 'Agent'),
    p.currentTask || (existingRow ? existingRow[4] : 'Active Work'),
    (existingRow && existingRow[5]) ? formatDateOnlyCell(existingRow[5], todayStr) : todayStr,
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
    try {
      sheet.getRange(matchRow, 9, 1, 1).setNumberFormat('0');
    } catch(fErr) {}
  } else {
    sheet.appendRow(rowData);
    try {
      sheet.getRange(sheet.getLastRow(), 9, 1, 1).setNumberFormat('0');
    } catch(fErr) {}
  }
  return rowData;
}

function upsertDailySummaryRow(sheet, p) {
  if (!sheet || !p) return null;
  var dailyHeaders = ['Date', 'Employee Code', 'Employee Name', 'Designation', 'Tasks Worked On', 'First Clock-In (Manila)', 'Last Clock-Out (Manila)', 'Gross Tracked Shift', 'Total Idle / Breaks', 'Net Productive Work', 'Duration (Seconds)', 'Avg Activity %', 'Shift Status', 'Log Entries'];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(dailyHeaders);
    sheet.getRange(1, 1, 1, dailyHeaders.length).setFontWeight('bold').setBackground('#0284c7').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }

  var targetCode = String(p.employeeCode || '').trim().toUpperCase();
  var targetName = String(p.userName || p.name || '').trim();
  var resolvedName = resolveStaffFullName(targetCode, targetName, targetName, p.userId);
  var todayStr = Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd');

  var lastRow = sheet.getLastRow();
  var matchRow = -1;
  var existingRow = null;

  if (lastRow > 1) {
    try {
      var maxCols = Math.max(sheet.getLastColumn(), 14);
      var sheetData = sheet.getRange(2, 1, lastRow - 1, maxCols).getValues();
      for (var r = 0; r < sheetData.length; r++) {
        var row = sheetData[r];
        var rowDate = String(row[0] || '').trim();
        var rowCode = String(row[1] || '').trim().toUpperCase();
        var rowName = String(row[2] || '').trim().toLowerCase();
        if ((rowDate === todayStr || !rowDate) &&
            ((targetCode && targetCode !== 'N/A' && rowCode === targetCode) ||
             (resolvedName && rowName === resolvedName.toLowerCase()) ||
             (targetName && rowName === targetName.toLowerCase()))) {
          matchRow = r + 2;
          existingRow = row;
          break;
        }
      }
    } catch(e) {}
  }

  var isTracking = p.isTracking === true || (p.status === 'online' && p.isTracking) || (p.statusLabel && p.statusLabel.indexOf('Live Tracking') !== -1);
  var elapsedSecs = parseDurationSecondsSafe(p.elapsedSeconds);
  if (!elapsedSecs && existingRow && existingRow[10]) {
    var existingSecs = parseDurationSecondsSafe(existingRow[10]);
    if (existingSecs > 0 && existingSecs < 604800) {
      elapsedSecs = existingSecs;
    }
  }
  if (elapsedSecs >= 604800) {
    elapsedSecs = 0;
  }
  var sTime = formatTimeOnlyCell(p.firstCheckin || (existingRow && existingRow[5] ? existingRow[5] : Utilities.formatDate(new Date(), 'Asia/Manila', 'hh:mm:ss a')));
  var eTime = isTracking ? 'Running Live' : (existingRow && existingRow[6] ? formatTimeOnlyCell(existingRow[6]) : formatTimeOnlyCell(Utilities.formatDate(new Date(), 'Asia/Manila', 'hh:mm:ss a')));
  var incomingTask = String(p.currentTask || '').trim();
  var taskName = incomingTask || 'General Work';
  if (existingRow && existingRow[4]) {
    var exTasks = String(existingRow[4]).split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    if (incomingTask && incomingTask !== 'Active Work' && incomingTask !== 'Shift Concluded' && incomingTask !== 'General Work') {
      if (exTasks.indexOf(incomingTask) === -1) {
        exTasks.push(incomingTask);
      }
    }
    if (exTasks.length > 0) {
      taskName = exTasks.join(', ');
    }
  }

  var rowData = [
    todayStr,
    targetCode || 'N/A',
    resolvedName || targetName || 'Employee',
    p.designation || (existingRow ? existingRow[3] : 'Agent'),
    taskName,
    sTime,
    eTime,
    formatTotalTime(elapsedSecs),
    '0 mins',
    formatTotalTime(elapsedSecs),
    elapsedSecs,
    (p.mouseActivity != null ? p.mouseActivity : 95) + '%',
    isTracking ? 'Active Live' : 'Completed',
    '1 active shift'
  ];

  if (sheet.getMaxColumns() < 14) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 14 - sheet.getMaxColumns());
  }

  if (matchRow > 0) {
    sheet.getRange(matchRow, 1, 1, 14).setValues([rowData]);
    try {
      sheet.getRange(matchRow, 11, 1, 1).setNumberFormat('0');
    } catch(fErr) {}
  } else {
    sheet.appendRow(rowData);
    try {
      sheet.getRange(sheet.getLastRow(), 11, 1, 1).setNumberFormat('0');
    } catch(fErr) {}
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
      tab: 'Employee_Auth',
      color: '#1e293b', // Slate
      headers: ['Employee Code', 'Username', 'Full Name', 'Password Hash', 'Must Change Password', 'Last Login (ISO)', 'Account Status', 'Last Updated (ISO)']
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

    // ==========================================
    // ACTION: AUTH_LOGIN / AUTHENTICATE
    // ==========================================
    if (data.action === 'AUTH_LOGIN' || data.action === 'AUTHENTICATE') {
      var userIdentifier = data.username || data.employeeCode || data.email || data.user;
      var pass = data.password;
      var authResult = authenticateEmployee_(ss, userIdentifier, pass);
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify(authResult)).setMimeType(ContentService.MimeType.JSON);
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
    if (data.action === 'HEARTBEAT_UPDATE' || data.action === 'HEARTBEAT') {
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

        // 3. Keep Time_Logs and Timesheets updated if agent is currently tracking
        var tLogsSheet = ss.getSheetByName('Time_Logs');
        if (tLogsSheet && pData.isTracking) {
          upsertLiveTrackingSessionRow(tLogsSheet, pData);
        }
        var timesheetsSheet = ss.getSheetByName('Timesheets') || ss.getSheetByName('Timesheet');
        if (timesheetsSheet && pData.isTracking) {
          upsertLiveTrackingSessionRow(timesheetsSheet, pData);
        }

        // 4. Keep Daily_Summary updated if agent is currently tracking
        var dailySummarySheet = ss.getSheetByName('Daily_Summary');
        if (dailySummarySheet && pData.isTracking) {
          upsertDailySummaryRow(dailySummarySheet, pData);
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
      try {
        upsertEmployeeAuthRecords_(ss, rawUsersList);
      } catch (authErr) {
        Logger.log('Auth upsert error: ' + authErr.toString());
      }
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({
        status: 'SUCCESS',
        action: 'SYNC_EMPLOYEES',
        count: count,
        message: 'Successfully populated ' + count + ' employees into Employee_Directory, mployee_Directory, and Employee_Auth!'
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
      // 0. POPULATE EMPLOYEE DIRECTORY (Only when explicitly requested to keep sheet calm)
      // ==========================================
      if (data.syncEmployees === true || data.action === 'SYNC_EMPLOYEES' || data.action === 'SYNC_USERS') {
        try {
          syncEmployeeDirectoryInternal(ss, users.length > 0 ? users : rawUsers, userMap);
        } catch (empErr) {
          Logger.log('Employee_Directory sync error: ' + empErr.toString());
        }
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
        
        // Priority 1: Use valid numeric duration seconds if provided
        var rawSecs = parseDurationSecondsSafe(t.durationSeconds);
        var isLive = (t.endTime === 'Running Live' || t.status === 'running' || !t.endTime);

        // Priority 2: For active running sessions, use authoritative elapsedSeconds from presence
        if (isLive) {
          var pUser = presenceMap[t.userId] || presenceMap[empCode] || presenceMap[empName];
          if (pUser && pUser.elapsedSeconds) {
            var pElapsed = parseDurationSecondsSafe(pUser.elapsedSeconds);
            if (pElapsed > 0) {
              rawSecs = pElapsed;
            }
          }
        }

        // Priority 3: Only calculate duration from start/end when rawSecs is 0 and not running live
        // NEVER subtract an 1899 date from a 2026 timestamp!
        if (!rawSecs && !isLive && t.startTime && t.endTime) {
          rawSecs = calculateTimeDifferenceSecsSafe(t.startTime, t.endTime, t.date || todayStr, t.idleSeconds || 0);
        }

        // Priority 5: Enforce strict bounds - never generate duration >= 604800s (7 days) or negative
        if (rawSecs >= 604800 || rawSecs < 0 || isNaN(rawSecs)) {
          rawSecs = 0;
        }

        var totalTimeHuman = formatTotalTime(rawSecs);
        var idleMins = t.idleSeconds ? Math.round(t.idleSeconds / 60) + ' mins' : '0 mins';

        // Format start and end times in Philippine Timezone (Asia/Manila GMT+8)
        var sTime = formatTimeOnlyCell(t.geoLocalStartTime || t.startTime);
        var eTime = isLive ? 'Running Live' : formatTimeOnlyCell(t.geoLocalEndTime || t.endTime);
        var logDate = formatDateOnlyCell(t.date, todayStr);

        activeRows.push([
          t.id || 'N/A',
          empCode,
          empName,
          t.designation || matchedUser.designation || 'Agent',
          t.task || 'General',
          logDate,
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

      // Also inject all actively tracking sessions from rawPresenceList into activeRows
      rawPresenceList.forEach(function(p) {
        if (!p || (!p.isTracking && String(p.statusLabel || '').indexOf('Live Tracking') === -1)) return;
        var pCode = String(p.employeeCode || '').toUpperCase();
        var pName = resolveStaffFullName(pCode, p.userName || p.name, p.userName || p.name, p.userId);
        var pSessionId = 'live-' + (p.userId || (pCode !== 'N/A' ? pCode.toLowerCase() : 'agent'));
        if (activeSeen[pSessionId]) return;
        activeSeen[pSessionId] = true;

        var elapsed = typeof p.elapsedSeconds === 'number' ? Math.max(0, Math.floor(p.elapsedSeconds)) : 0;
        var sTime = formatTimeOnlyCell(p.firstCheckin || Utilities.formatDate(new Date(), 'Asia/Manila', 'hh:mm:ss a'));
        activeRows.push([
          pSessionId,
          pCode || 'N/A',
          pName,
          p.designation || 'Agent',
          p.currentTask || 'Active Work',
          todayStr,
          sTime,
          'Running Live',
          elapsed,
          formatTotalTime(elapsed),
          '0 mins',
          (p.mouseActivity != null ? p.mouseActivity : 95) + '%',
          (p.keyboardActivity != null ? p.keyboardActivity : 95) + '%',
          'running',
          'Active tracking in progress'
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

      // Primary source: Time_Logs
      if (timeLogsSheet) {
        mergedTimeLogs = populateMergedSheet(timeLogsSheet, activeHeaders, activeRows, '#047857', 0, 5) || [];
      }
      if (timesheetsSheet) {
        var tsMerged = populateMergedSheet(timesheetsSheet, activeHeaders, activeRows, '#047857', 0, 5) || [];
        if (!mergedTimeLogs.length) mergedTimeLogs = tsMerged;
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
        var d = formatDateOnlyCell(row[5], todayStr);
        var sTime = formatTimeOnlyCell(row[6]);
        var eTime = formatTimeOnlyCell(row[7]);
        var rawDur = row[8];
        var sSecs = parseDurationSecondsSafe(rawDur);

        // Ignore invalid legacy duration values (>= 604800 or invalid)
        if (sSecs >= 604800 || sSecs < 0 || isNaN(sSecs)) {
          sSecs = 0;
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
          if (mSecs >= 604800) {
            mSecs = 0;
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
            // Employee already has Daily_Summary accumulated from valid Time_Logs
            // Never overwrite or inflate grossSecs with presence shift hours
            dailyMap[dKey].hasLive = true;
            dailyMap[dKey].lastClockOut = 'Running Live';
            if (eTask && eTask !== 'Shift Concluded') dailyMap[dKey].tasks[eTask] = true;
          }
        }
      });

      var dailyRows = [];
      Object.keys(dailyMap).forEach(function(k) {
        var item = dailyMap[k];
        if (item.grossSecs >= 604800) item.grossSecs = 0;
        if (item.idleSecs >= 604800) item.idleSecs = 0;
        var netSecs = Math.max(0, item.grossSecs - item.idleSecs);
        if (netSecs >= 604800) netSecs = 0;
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
        var sSecs = parseDurationSecondsSafe(rawDur);
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
        var sSecs = parseDurationSecondsSafe(rawDur);
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
      // 8. POPULATE EMPLOYEE DIRECTORY & EMPLOYEE AUTH
      // ==========================================
      if (data.syncEmployees === true || data.action === 'SYNC_EMPLOYEES' || data.action === 'SYNC_USERS') {
        try {
          syncEmployeeDirectoryInternal(ss, (users && users.length > 0) ? users : rawUsers, userMap);
          upsertEmployeeAuthRecords_(ss, (users && users.length > 0) ? users : rawUsers);
        } catch (empErr) {
          Logger.log('Error updating Employee_Directory: ' + empErr.toString());
        }
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
    var empSheet = ss.getSheetByName('Employee_Directory') || ss.getSheetByName('Employee Directory') || ss.getSheetByName('mployee_Directory') || ss.getSheetByName('Employees');
    var authSheet = ss.getSheetByName('Employee_Auth') || ss.getSheetByName('Employee Auth');
    var authMap = {};
    if (authSheet && authSheet.getLastRow() > 1) {
      try {
        var aData = authSheet.getRange(2, 1, authSheet.getLastRow() - 1, Math.max(authSheet.getLastColumn(), 8)).getValues();
        aData.forEach(function(aRow) {
          var aCode = String(aRow[0] || '').trim().toUpperCase();
          var aUser = String(aRow[1] || '').trim().toLowerCase();
          var aObj = {
            passwordHash: String(aRow[3] || '').trim(),
            mustChangePassword: String(aRow[4] || '').toUpperCase() === 'YES',
            lastLogin: String(aRow[5] || '').trim()
          };
          if (aCode && aCode !== 'N/A') authMap[aCode] = aObj;
          if (aUser) authMap[aUser] = aObj;
        });
      } catch (aErr) {}
    }

    var employees = [];
    if (empSheet && empSheet.getLastRow() > 1) {
      var data = empSheet.getRange(2, 1, empSheet.getLastRow() - 1, 14).getValues();
      data.forEach(function(row) {
        var code = String(row[0] || '').trim();
        var username = String(row[1] || '').trim();
        var name = String(row[2] || '').trim();
        if (!code && !name && !username) return;
        var empCodeUpper = (code || '').toUpperCase();
        var empUserLower = (username || '').toLowerCase();
        var aInfo = authMap[empCodeUpper] || authMap[empUserLower] || {};

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
          password: aInfo.passwordHash || String(row[13] || '').trim(),
          mustChangePassword: aInfo.mustChangePassword !== undefined ? aInfo.mustChangePassword : false
        });
      });
    }

    var timeLogsSheet = ss.getSheetByName('Time_Logs') || ss.getSheetByName('Active_Logs') || ss.getSheetByName('Live_Sessions');
    var timeLogs = [];
    if (timeLogsSheet && timeLogsSheet.getLastRow() > 1) {
      var tData = timeLogsSheet.getRange(2, 1, timeLogsSheet.getLastRow() - 1, Math.max(timeLogsSheet.getLastColumn(), 15)).getValues();
      tData.forEach(function(row) {
        var id = String(row[0] || '').trim();
        var empName = String(row[2] || '').trim();
        if (!id && !empName) return;

        var durSec = parseDurationSecondsSafe(row[8]);
        if (!durSec && row[9]) {
          durSec = parseDurationSecondsSafe(row[9]);
        }

        var totalTimeStr = '';
        if (durSec > 0) {
          totalTimeStr = formatTotalTime(durSec);
        } else if (row[9]) {
          var tRaw = String(row[9] || '').trim();
          if (tRaw.indexOf('1111') === -1) totalTimeStr = tRaw;
        }

        var idleSec = 0;
        if (row[10]) {
          var idleMins = parseInt(String(row[10]).replace(/[^\d]/g, ''), 10);
          if (!isNaN(idleMins)) idleSec = idleMins * 60;
        }

        var mouseAvg = 95;
        if (row[11] !== undefined && row[11] !== '') {
          var parsedMouse = parseInt(String(row[11]).replace(/[^\d]/g, ''), 10);
          if (!isNaN(parsedMouse)) mouseAvg = parsedMouse;
        }

        var keyAvg = 95;
        if (row[12] !== undefined && row[12] !== '') {
          var parsedKey = parseInt(String(row[12]).replace(/[^\d]/g, ''), 10);
          if (!isNaN(parsedKey)) keyAvg = parsedKey;
        }

        timeLogs.push({
          id: id || ('log-' + Date.now()),
          employeeCode: String(row[1] || '').trim(),
          userName: empName,
          designation: String(row[3] || 'Agent').trim(),
          task: String(row[4] || 'General').trim(),
          date: formatDateOnlyCell(row[5], ''),
          startTime: formatTimeOnlyCell(row[6]),
          endTime: (String(row[7] || '').toLowerCase().indexOf('running') !== -1) ? 'Running Live' : formatTimeOnlyCell(row[7]),
          durationSeconds: durSec,
          durationFormatted: totalTimeStr || formatTotalTime(durSec),
          totalTime: totalTimeStr || formatTotalTime(durSec),
          idleDeductions: String(row[10] || '').trim(),
          idleSeconds: idleSec,
          mouseActivityAvg: mouseAvg,
          keyboardActivityAvg: keyAvg,
          status: String(row[13] || 'completed').trim(),
          notes: String(row[14] || '').trim()
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
/*export const syncEmployeesToGoogleSheetsWebhook = async (
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

// Strategy 1: Server-side proxy with timeout
try {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  const proxyRes = await fetch('/api/sync-sheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      webhookUrl: cleanUrl,
      payload
    }),
    signal: controller.signal,
  });

  clearTimeout(timeout);

  if (proxyRes.ok) {
    const pData = await proxyRes.json();

    if (pData?.success && pData.result?.status !== 'ERROR') {
      return {
        success: true,
        count: pData.result?.count || safeUsers.length,
        message: `✓ Successfully populated ${pData.result?.count || safeUsers.length} employees into Employee_Directory tab!`,
      };
    }
  }
} catch (proxyErr) {
  console.warn('Employee sync proxy unavailable/timed out. Trying direct webhook...', proxyErr);
}

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
}; */

export const syncEmployeesToGoogleSheetsWebhook = async (
  webhookUrl: string,
  users: User[]
): Promise<{ success: boolean; message: string; count?: number }> => {
  if (!webhookUrl || !webhookUrl.trim()) {
    return {
      success: false,
      message:
        'No Google Sheets Webhook URL configured. Please paste your Google Apps Script Web App URL in Settings.',
    };
  }

  const cleanUrl = webhookUrl.trim();

  if (!isValidWebhookUrl(cleanUrl)) {
    return {
      success: false,
      message:
        'Webhook URL appears incomplete or is a placeholder. Please paste your deployed Web App URL ending in /exec.',
    };
  }

  try {
    const safeUsers = users.filter((u) => !u.isSecretBackup);

    const payload = {
      action: 'SYNC_EMPLOYEES',
      users: safeUsers,
      syncedAt: new Date().toISOString(),
    };

    const proxyRes = await fetch('/api/sync-sheets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhookUrl: cleanUrl,
        payload,
      }),
    });

    if (!proxyRes.ok) {
      throw new Error(
        `Sync proxy returned HTTP ${proxyRes.status}`
      );
    }

    const result = await proxyRes.json();

    if (!result?.success) {
      throw new Error(
        result?.error ||
        result?.message ||
        result?.result?.message ||
        'Google Sheets synchronization failed'
      );
    }

    if (
      result?.result &&
      result.result.status &&
      result.result.status !== 'SUCCESS'
    ) {
      throw new Error(
        result.result.message ||
        'Google Apps Script rejected the employee synchronization'
      );
    }

    return {
      success: true,
      count: result?.result?.count || safeUsers.length,
      message: `Successfully synchronized ${result?.result?.count || safeUsers.length} employees to Employee_Directory.`,
    };
  } catch (err: any) {
    console.error('Employee Directory sync failed:', err);

    return {
      success: false,
      message:
        err?.message ||
        'Failed to synchronize Employee_Directory.',
    };
  }
};

export interface AgentHeartbeatPayload {
  userId: string;
  employeeCode?: string;
  userName: string;
  sessionId?: string; // Current Active Tracking Session ID
  loginSessionId?: string; // Associated Login Session ID
  role?: string;
  designation?: string;
  department?: string;
  teamLeaderId?: string;
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
 * Runs periodically (every 20s while tracking) from active agent machines to update only their own row in Live_Presence.
 */
export const syncAgentHeartbeatToSheets = async (
  webhookUrl: string,
  heartbeat: AgentHeartbeatPayload
): Promise<{ success: boolean; message: string; result?: any }> => {
  const targetUrl = webhookUrl?.trim() || DEFAULT_WEBHOOK_URL;
  if (!targetUrl || !isValidWebhookUrl(targetUrl)) {
    return { success: false, message: 'Invalid or missing Google Sheets Webhook URL.' };
  }

  const cleanUrl = targetUrl.trim();
  const payload = {
    action: 'HEARTBEAT_UPDATE',
    presence: {
      ...heartbeat,
      lastHeartbeat: heartbeat.lastHeartbeat || new Date().toISOString(),
    },
    syncedAt: new Date().toISOString(),
  };

  const transport = '/api/sync-sheets';

  try {
    const res = await fetch('/api/sync-sheets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhookUrl: cleanUrl,
        payload,
      }),
    });

    const serverStatus = res.status;
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    const appsScriptResult = data?.result || data;
    const appsScriptStatus =
      data?.appsScriptStatus ||
      appsScriptResult?.status ||
      (appsScriptResult?.success ? 'SUCCESS' : (data?.success ? 'SUCCESS' : 'UNKNOWN'));

    console.log('[SHEETS HEARTBEAT]', {
      employeeCode: heartbeat.employeeCode,
      userId: heartbeat.userId,
      isTracking: heartbeat.isTracking,
      elapsedSeconds: heartbeat.elapsedSeconds,
      transport,
      serverStatus,
      appsScriptStatus,
      result: appsScriptResult,
    });

    const isConfirmedSuccess =
      res.ok &&
      data?.success === true &&
      (appsScriptStatus === 'SUCCESS' ||
        appsScriptResult?.status === 'SUCCESS' ||
        appsScriptResult?.action === 'HEARTBEAT_UPDATE');

    if (isConfirmedSuccess) {
      return {
        success: true,
        message: 'Heartbeat pulse transmitted and acknowledged by Google Sheets!',
        result: appsScriptResult,
      };
    } else {
      const errorMsg =
        data?.error ||
        appsScriptResult?.message ||
        appsScriptResult?.error ||
        `Heartbeat failed with HTTP ${serverStatus} (Apps Script status: ${appsScriptStatus})`;
      return {
        success: false,
        message: errorMsg,
        result: appsScriptResult,
      };
    }
  } catch (err: any) {
    console.error('[SHEETS HEARTBEAT] Transport failed:', {
      employeeCode: heartbeat.employeeCode,
      userId: heartbeat.userId,
      isTracking: heartbeat.isTracking,
      elapsedSeconds: heartbeat.elapsedSeconds,
      transport,
      error: err?.message || err,
    });
    return {
      success: false,
      message: `Heartbeat transport failed: ${err?.message || 'Network error'}`,
    };
  }
};

/**
 * Extracts and imports Time Logs from the Google Sheets database (Time_Logs or Active_Logs tab)
 */
export const fetchTimeLogsFromGoogleSheets = async (
  webhookUrl?: string,
  spreadsheetId: string = DEFAULT_SPREADSHEET_ID
): Promise<{ success: boolean; timeLogs: Partial<TimeLog>[]; message: string }> => {
  const targetUrl = (webhookUrl && isValidWebhookUrl(webhookUrl)) ? webhookUrl.trim() : DEFAULT_WEBHOOK_URL;

  // Method 1: Webhook GET via Cloudflare proxy (/api/sync-sheets)
  if (targetUrl && isValidWebhookUrl(targetUrl)) {
    try {
      const proxyRes = await fetch(`/api/sync-sheets?url=${encodeURIComponent(targetUrl)}`);
      if (proxyRes.ok) {
        const data = await proxyRes.json();
        if (data && Array.isArray(data.timeLogs) && data.timeLogs.length > 0) {
          const normalizedLogs: Partial<TimeLog>[] = data.timeLogs.map((log: any) => {
            const normDate = normalizeWorkDate(log.date, log.startTime);
            const normStart = normalizeTimeValue(log.startTime);
            const normEnd = normalizeTimeValue(log.endTime);
            const durSec = parseDurationSeconds(
              log.durationSeconds,
              log.totalTime || log.durationFormatted,
              normStart,
              normEnd
            );
            return {
              ...log,
              date: normDate,
              startTime: normStart,
              endTime: normEnd,
              geoLocalStartTime: normStart,
              geoLocalEndTime: normEnd,
              durationSeconds: durSec,
            };
          });
          return {
            success: true,
            timeLogs: normalizedLogs,
            message: `Successfully extracted ${normalizedLogs.length} time logs from Google Sheets!`,
          };
        }
      }
    } catch (err) {
      console.warn('Webhook GET for timeLogs via /api/sync-sheets failed, trying direct fetch fallback...', err);
    }

    // Direct Webhook GET fetch fallback
    try {
      const directRes = await fetch(targetUrl, { method: 'GET' });
      if (directRes.ok) {
        const data = await directRes.json();
        if (data && Array.isArray(data.timeLogs) && data.timeLogs.length > 0) {
          const normalizedLogs: Partial<TimeLog>[] = data.timeLogs.map((log: any) => {
            const normDate = normalizeWorkDate(log.date, log.startTime);
            const normStart = normalizeTimeValue(log.startTime);
            const normEnd = normalizeTimeValue(log.endTime);
            const durSec = parseDurationSeconds(
              log.durationSeconds,
              log.totalTime || log.durationFormatted,
              normStart,
              normEnd
            );
            return {
              ...log,
              date: normDate,
              startTime: normStart,
              endTime: normEnd,
              geoLocalStartTime: normStart,
              geoLocalEndTime: normEnd,
              durationSeconds: durSec,
            };
          });
          return {
            success: true,
            timeLogs: normalizedLogs,
            message: `Successfully extracted ${normalizedLogs.length} time logs directly from Google Sheets Webhook!`,
          };
        }
      }
    } catch (directErr) {
      console.warn('Direct Webhook GET fetch failed, trying CSV export fallback...', directErr);
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
              const empCode = (r[1] || '').trim();
              const empName = (r[2] || '').trim();
              if (!id && !empName && !empCode) continue;

              const normDate = normalizeWorkDate(r[5], r[6]);
              const normStart = normalizeTimeValue(r[6]);
              const normEnd = normalizeTimeValue(r[7]);
              const durSec = parseDurationSeconds(r[8], r[9], normStart, normEnd);

              // Parse mouse and keyboard activity percentages
              let mouseAvg = 95;
              let keyAvg = 95;
              if (r[11]) {
                const parsedMouse = parseInt(String(r[11]).replace(/[^\d]/g, ''), 10);
                if (!isNaN(parsedMouse)) mouseAvg = parsedMouse;
              }
              if (r[12]) {
                const parsedKey = parseInt(String(r[12]).replace(/[^\d]/g, ''), 10);
                if (!isNaN(parsedKey)) keyAvg = parsedKey;
              }

              // Parse idle seconds
              let idleSec = 0;
              if (r[10]) {
                const idleMins = parseInt(String(r[10]).replace(/[^\d]/g, ''), 10);
                if (!isNaN(idleMins)) idleSec = idleMins * 60;
              }

              const statusVal = (r[13] || 'completed').toLowerCase().includes('run') ? 'running' : 'completed';

              parsedLogs.push({
                id: id || `log-sheet-${Date.now()}-${i}`,
                employeeCode: empCode,
                userName: empName,
                designation: (r[3] || 'Agent').trim(),
                task: (r[4] || 'General').trim(),
                date: normDate,
                startTime: normStart,
                endTime: normEnd,
                geoLocalStartTime: normStart,
                geoLocalEndTime: normEnd,
                durationSeconds: durSec,
                mouseActivityAvg: mouseAvg,
                keyboardActivityAvg: keyAvg,
                idleSeconds: idleSec,
                geoTimezone: 'Asia/Manila',
                status: statusVal,
                notes: (r[14] || r[13] || 'Imported from Google Sheets Database').trim(),
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

              const presenceStatus = String(
                p.statusLabel || p.status || p.livePresenceStatus || ''
              ).toLowerCase();

              const isOnline =
                p.isOnline !== undefined && p.isOnline !== null
                  ? Boolean(p.isOnline)
                  : !presenceStatus.includes('offline') &&
                    (
                      presenceStatus.includes('online') ||
                      presenceStatus.includes('live tracking') ||
                      String(p.platformMode || '').toLowerCase().includes('desktop') ||
                      String(p.platformMode || '').toLowerCase().includes('website')
                    );

              const isTracking =
                p.isTracking !== undefined && p.isTracking !== null
                  ? Boolean(p.isTracking)
                  : presenceStatus.includes('live tracking') ||
                    presenceStatus.includes('tracking');

              const isPaused =
                p.isPaused !== undefined && p.isPaused !== null
                  ? Boolean(p.isPaused)
                  : presenceStatus.includes('idle') ||
                    presenceStatus.includes('break');

            return {
              userId: matchedUser?.id || p.userId || `usr-${p.employeeCode || Date.now()}`,
              userName: p.userName || matchedUser?.name || 'Employee',
              employeeCode: p.employeeCode || matchedUser?.employeeCode || '',
              role: p.role || matchedUser?.role || 'agent',
              designation: p.designation || matchedUser?.designation || 'Agent',
              department: matchedUser?.department || 'Operations',
              teamLeaderId: matchedUser?.teamLeaderId || '',
              isOnline,
              status: isOnline ? 'online' : 'offline',
              isTracking,
              isPaused,
              elapsedSeconds: Number(p.elapsedSeconds) || 0,
              mouseActivity: isTracking ? (Number(p.mouseActivity) || 85) : 0,
              keyboardActivity: isTracking ? (Number(p.keyboardActivity) || 90) : 0,
              currentTask: p.currentTask || (isOnline ? 'Active Work' : 'Shift Concluded'),
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

              const isWeb = platformMode.includes('Website') || statusStr.includes('Website');

              // If last heartbeat was more than 5 minutes ago, mark agent as offline
              let isHeartbeatStale = false;
              if (isoHb) {
                const hbTime = new Date(isoHb).getTime();
                if (!isNaN(hbTime) && (Date.now() - hbTime) > 5 * 60 * 1000) {
                  isHeartbeatStale = true;
                }
              }

              const rawIsTracking = statusStr.includes('Live Tracking') || statusStr.includes('Tracking');
              const rawIsIdle = statusStr.includes('Idle') || statusStr.includes('Break');
              const isTracking = !isHeartbeatStale && rawIsTracking;
              const isIdle = !isHeartbeatStale && rawIsIdle;
              const isDesktop = !isHeartbeatStale && (platformMode.includes('Desktop') || statusStr.includes('Desktop') || isTracking);
              const isOffline = isHeartbeatStale || statusStr.includes('Offline') || (!isTracking && !isIdle && !isDesktop && !isWeb);

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

