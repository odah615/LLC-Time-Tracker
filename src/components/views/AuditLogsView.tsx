import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { AuditLog, AuditActionCategory, User, TimeLog, IdleLog } from '../../types';
import {
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_SPREADSHEET_URL,
  SPREADSHEET_SCHEMA,
  generateAppsScriptCode,
  downloadTableCSV,
} from '../../lib/googleSheetsSync';
import {
  ShieldAlert,
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  Search,
  Filter,
  ExternalLink,
  Code2,
  RefreshCw,
  Clock,
  UserCheck,
  Lock,
  Eye,
  Trash2,
  Edit,
  UserPlus,
  ArrowRight,
  Sparkles,
  Layers,
  LogIn,
  LogOut,
  Timer,
  Activity,
  PauseCircle,
  ShieldCheck,
  Laptop,
  Globe,
  Calendar,
  Zap,
  TrendingDown,
  UserX,
  Sliders,
} from 'lucide-react';

type LogTabType = 'login' | 'logout' | 'idle' | 'active' | 'inactive' | 'admin' | 'all';

export const AuditLogsView: React.FC = () => {
  const {
    auditLogs,
    timeLogs,
    users,
    payrollRecords,
    idleLogs,
    dailyAttendanceLogs,
    currentUser,
    googleSheetsWebhookUrl,
    setGoogleSheetsWebhookUrl,
    triggerGoogleSheetsSync,
    importEmployeesFromGoogleSheets,
  } = useApp();

  const [activeTab, setActiveTab] = useState<LogTabType>('login');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAppsScriptModal, setShowAppsScriptModal] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [webhookInput, setWebhookInput] = useState(googleSheetsWebhookUrl || '');
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  // Helper map for fast user lookup
  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach((u) => {
      map.set(u.id, u);
      map.set(u.name.toLowerCase(), u);
    });
    return map;
  }, [users]);

  // Separate log records
  const loginLogs = useMemo(() => {
    return auditLogs.filter(
      (l) => l.category === 'Login' || l.details.toLowerCase().includes('signed in')
    );
  }, [auditLogs]);

  const logoutLogs = useMemo(() => {
    return auditLogs.filter(
      (l) =>
        l.category === 'Logout' ||
        l.details.toLowerCase().includes('signed out') ||
        l.details.toLowerCase().includes('session expired') ||
        l.details.toLowerCase().includes('inactivity')
    );
  }, [auditLogs]);

  const adminAuditLogs = useMemo(() => {
    return auditLogs.filter(
      (l) =>
        l.category !== 'Login' &&
        l.category !== 'Logout' &&
        l.category !== 'Clock In' &&
        l.category !== 'Clock Out'
    );
  }, [auditLogs]);

  // Filtered dataset according to active tab and search query
  const filteredLoginLogs = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return loginLogs.filter(
      (l) =>
        l.actorName.toLowerCase().includes(term) ||
        l.details.toLowerCase().includes(term) ||
        l.dateFormatted.toLowerCase().includes(term)
    );
  }, [loginLogs, searchTerm]);

  const filteredLogoutLogs = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return logoutLogs.filter(
      (l) =>
        l.actorName.toLowerCase().includes(term) ||
        l.details.toLowerCase().includes(term) ||
        l.dateFormatted.toLowerCase().includes(term)
    );
  }, [logoutLogs, searchTerm]);

  const filteredIdleLogs = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return idleLogs.filter(
      (i) =>
        i.userName.toLowerCase().includes(term) ||
        i.task.toLowerCase().includes(term) ||
        i.reason.toLowerCase().includes(term) ||
        i.timestamp.toLowerCase().includes(term)
    );
  }, [idleLogs, searchTerm]);

  const filteredActiveLogs = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return timeLogs.filter(
      (t) =>
        t.userName.toLowerCase().includes(term) ||
        t.task.toLowerCase().includes(term) ||
        t.designation.toLowerCase().includes(term) ||
        t.date.toLowerCase().includes(term)
    );
  }, [timeLogs, searchTerm]);

  const filteredAdminAuditLogs = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return adminAuditLogs.filter((l) => {
      const matchesSearch =
        l.actorName.toLowerCase().includes(term) ||
        (l.targetEmployeeName && l.targetEmployeeName.toLowerCase().includes(term)) ||
        l.details.toLowerCase().includes(term) ||
        l.category.toLowerCase().includes(term);

      const matchesCategory = selectedCategory === 'all' || l.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [adminAuditLogs, searchTerm, selectedCategory]);

  const filteredAllLogs = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return auditLogs.filter((l) => {
      const matchesSearch =
        l.actorName.toLowerCase().includes(term) ||
        (l.targetEmployeeName && l.targetEmployeeName.toLowerCase().includes(term)) ||
        l.details.toLowerCase().includes(term) ||
        l.category.toLowerCase().includes(term);

      const matchesCategory = selectedCategory === 'all' || l.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [auditLogs, searchTerm, selectedCategory]);

  const categoriesList: AuditActionCategory[] = [
    'Role Change',
    'Supervisor Reassign',
    'Screenshot Monitor Toggle',
    'Activity Monitor Toggle',
    'Password Reset',
    'Employee Added',
    'Employee Updated',
    'Employee Deleted',
    'Manual Time Approved',
    'Manual Time Rejected',
    'Leave Request Approved',
    'Leave Request Rejected',
    'Payroll Processed',
  ];

  const handleCopyAppsScript = () => {
    const code = generateAppsScriptCode(DEFAULT_SPREADSHEET_ID);
    navigator.clipboard.writeText(code);
    setScriptCopied(true);
    setTimeout(() => setScriptCopied(false), 3000);
  };

  const handleExportCurrentTabCSV = () => {
    switch (activeTab) {
      case 'login': {
        const rows = loginLogs.map((l) => {
          const usr = userMap.get(l.actorId) || userMap.get(l.actorName.toLowerCase());
          const mode = l.details.includes('Desktop') ? 'Desktop Software App' : 'Web Portal';
          return [
            l.id,
            l.timestamp,
            l.dateFormatted,
            usr?.employeeCode || 'N/A',
            l.actorName,
            l.actorRole,
            usr?.designation || 'Agent',
            mode,
            usr?.geoCity ? `${usr.geoCity} (${usr.geoTimezone})` : 'Toronto, Canada (America/Toronto)',
            'Authenticated (Active)',
          ];
        });
        downloadTableCSV('Login_Logs', SPREADSHEET_SCHEMA[0].headers, rows);
        break;
      }
      case 'logout': {
        const rows = logoutLogs.map((l) => {
          const usr = userMap.get(l.actorId) || userMap.get(l.actorName.toLowerCase());
          return [
            l.id,
            l.timestamp,
            l.dateFormatted,
            usr?.employeeCode || 'N/A',
            l.actorName,
            l.actorRole,
            usr?.designation || 'Agent',
            'Manual Sign Out / Shift End',
            l.details,
            'Logged Out (Complete)',
          ];
        });
        downloadTableCSV('Logout_Logs', SPREADSHEET_SCHEMA[1].headers, rows);
        break;
      }
      case 'idle': {
        const rows = idleLogs.map((i) => {
          const usr = userMap.get(i.userId) || userMap.get(i.userName.toLowerCase());
          return [
            i.id,
            i.timestamp,
            usr?.employeeCode || 'N/A',
            i.userName,
            i.durationMinutes,
            `-${i.deductedFromShiftMinutes || i.durationMinutes} mins`,
            `+${i.requiredExtensionMinutes || i.durationMinutes} mins`,
            i.task,
            i.reason,
            i.status,
          ];
        });
        downloadTableCSV('Idle_Logs', SPREADSHEET_SCHEMA[2].headers, rows);
        break;
      }
      case 'active': {
        const rows = timeLogs.map((t) => {
          const usr = userMap.get(t.userId) || userMap.get(t.userName.toLowerCase());
          const durStr = `${Math.floor(t.durationSeconds / 3600)}h ${Math.floor((t.durationSeconds % 3600) / 60)}m ${t.durationSeconds % 60}s`;
          return [
            t.id,
            usr?.employeeCode || 'N/A',
            t.userName,
            t.designation,
            t.task,
            t.date,
            t.startTime,
            t.endTime || 'Running Live',
            durStr,
            t.idleSeconds ? `${Math.round(t.idleSeconds / 60)} mins` : '0 mins',
            `${t.mouseActivityAvg}%`,
            `${t.keyboardActivityAvg}%`,
            t.status,
            t.notes || '',
          ];
        });
        downloadTableCSV('Active_Logs', SPREADSHEET_SCHEMA[3].headers, rows);
        break;
      }
      case 'inactive': {
        const rows = idleLogs.map((i) => {
          const usr = userMap.get(i.userId) || userMap.get(i.userName.toLowerCase());
          return [
            `inact-${i.id}`,
            i.timestamp,
            usr?.employeeCode || 'N/A',
            i.userName,
            i.task,
            i.durationMinutes,
            `Deducted -${i.deductedFromShiftMinutes || i.durationMinutes}m from Timesheet`,
            i.reason,
            `Shift Extended by +${i.requiredExtensionMinutes || i.durationMinutes} mins`,
          ];
        });
        downloadTableCSV('Inactive_Logs', SPREADSHEET_SCHEMA[4].headers, rows);
        break;
      }
      case 'admin':
      case 'all': {
        const targetList = activeTab === 'admin' ? adminAuditLogs : auditLogs;
        const rows = targetList.map((l) => [
          l.id,
          l.timestamp,
          l.dateFormatted,
          l.actorName,
          l.actorRole,
          l.category,
          l.targetEmployeeName || 'N/A',
          l.fromValue || '-',
          l.toValue || '-',
          l.details,
        ]);
        downloadTableCSV(activeTab === 'admin' ? 'Admin_Audit_Logs' : 'System_Audit_Logs', SPREADSHEET_SCHEMA[5].headers, rows);
        break;
      }
    }
    setSyncSuccessMsg(`Exported ${activeTab.toUpperCase()} logs to CSV successfully!`);
    setTimeout(() => setSyncSuccessMsg(''), 4000);
  };

  const handleExportAllCSV = () => {
    // 1. Export Login Logs
    const loginRows = loginLogs.map((l) => {
      const usr = userMap.get(l.actorId) || userMap.get(l.actorName.toLowerCase());
      const mode = l.details.includes('Desktop') ? 'Desktop Software App' : 'Web Portal';
      return [
        l.id,
        l.timestamp,
        l.dateFormatted,
        usr?.employeeCode || 'N/A',
        l.actorName,
        l.actorRole,
        usr?.designation || 'Agent',
        mode,
        usr?.geoCity ? `${usr.geoCity} (${usr.geoTimezone})` : 'Toronto, Canada (America/Toronto)',
        'Authenticated (Active)',
      ];
    });
    downloadTableCSV('Login_Logs', SPREADSHEET_SCHEMA[0].headers, loginRows);

    // 2. Export Logout Logs
    const logoutRows = logoutLogs.map((l) => {
      const usr = userMap.get(l.actorId) || userMap.get(l.actorName.toLowerCase());
      return [
        l.id,
        l.timestamp,
        l.dateFormatted,
        usr?.employeeCode || 'N/A',
        l.actorName,
        l.actorRole,
        usr?.designation || 'Agent',
        'Manual Sign Out / Shift End',
        l.details,
        'Logged Out (Complete)',
      ];
    });
    downloadTableCSV('Logout_Logs', SPREADSHEET_SCHEMA[1].headers, logoutRows);

    // 3. Export Idle Logs
    const idleRows = idleLogs.map((i) => {
      const usr = userMap.get(i.userId) || userMap.get(i.userName.toLowerCase());
      return [
        i.id,
        i.timestamp,
        usr?.employeeCode || 'N/A',
        i.userName,
        i.durationMinutes,
        `-${i.deductedFromShiftMinutes || i.durationMinutes} mins`,
        `+${i.requiredExtensionMinutes || i.durationMinutes} mins`,
        i.task,
        i.reason,
        i.status,
      ];
    });
    downloadTableCSV('Idle_Logs', SPREADSHEET_SCHEMA[2].headers, idleRows);

    // 4. Export Active Logs
    const activeRows = timeLogs.map((t) => {
      const usr = userMap.get(t.userId) || userMap.get(t.userName.toLowerCase());
      const durStr = `${Math.floor(t.durationSeconds / 3600)}h ${Math.floor((t.durationSeconds % 3600) / 60)}m ${t.durationSeconds % 60}s`;
      return [
        t.id,
        usr?.employeeCode || 'N/A',
        t.userName,
        t.designation,
        t.task,
        t.date,
        t.startTime,
        t.endTime || 'Running Live',
        durStr,
        t.idleSeconds ? `${Math.round(t.idleSeconds / 60)} mins` : '0 mins',
        `${t.mouseActivityAvg}%`,
        `${t.keyboardActivityAvg}%`,
        t.status,
        t.notes || '',
      ];
    });
    downloadTableCSV('Active_Logs', SPREADSHEET_SCHEMA[3].headers, activeRows);

    // 5. Export Inactive Logs
    const inactRows = idleLogs.map((i) => {
      const usr = userMap.get(i.userId) || userMap.get(i.userName.toLowerCase());
      return [
        `inact-${i.id}`,
        i.timestamp,
        usr?.employeeCode || 'N/A',
        i.userName,
        i.task,
        i.durationMinutes,
        `Deducted -${i.deductedFromShiftMinutes || i.durationMinutes}m from Timesheet`,
        i.reason,
        `Shift Extended by +${i.requiredExtensionMinutes || i.durationMinutes} mins`,
      ];
    });
    downloadTableCSV('Inactive_Logs', SPREADSHEET_SCHEMA[4].headers, inactRows);

    // 6. Export Admin Audit Logs
    const adminRows = adminAuditLogs.map((l) => [
      l.id,
      l.timestamp,
      l.dateFormatted,
      l.actorName,
      l.actorRole,
      l.category,
      l.targetEmployeeName || 'N/A',
      l.fromValue || '-',
      l.toValue || '-',
      l.details,
    ]);
    downloadTableCSV('Admin_Audit_Logs', SPREADSHEET_SCHEMA[5].headers, adminRows);

    setSyncSuccessMsg('Exported all modular separated tables to CSV files successfully!');
    setTimeout(() => setSyncSuccessMsg(''), 4000);
  };

  const handleTriggerSpreadsheetSync = async () => {
    setIsSyncing(true);
    const res = await triggerGoogleSheetsSync();
    setIsSyncing(false);
    if (res.success) {
      setSyncSuccessMsg(`Data successfully synced to all separated Google Sheets tabs (${DEFAULT_SPREADSHEET_ID})!`);
    } else {
      setSyncSuccessMsg(`Saved to local database. (Configure Apps Script Webhook URL to sync live to Google Sheets)`);
    }
    setTimeout(() => setSyncSuccessMsg(''), 5000);
  };

  const getCategoryBadgeColor = (cat: AuditActionCategory) => {
    switch (cat) {
      case 'Role Change':
      case 'Supervisor Reassign':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Screenshot Monitor Toggle':
      case 'Activity Monitor Toggle':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Password Reset':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Employee Added':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Employee Deleted':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'Clock In':
      case 'Clock Out':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold mb-3">
              <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
              Separated Modular Logs & Google Sheets Architecture
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              System Logs & Audit Trail
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Cleanly separated into dedicated tabs for Login Logs, Logout Logs, Idle Logs, Active Work Sessions, Inactivity Events, and Admin Governance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportAllCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-white font-medium text-xs sm:text-sm transition-all shadow-md"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              Export All Separate Tables (CSV)
            </button>

            <button
              onClick={() => setShowAppsScriptModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 transition-all"
            >
              <Code2 className="w-4 h-4" />
              Google Apps Script Code
            </button>
          </div>
        </div>
      </div>

      {/* Linked Google Spreadsheet Connection Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Linked Company Google Spreadsheet</h3>
                <span className={`px-2.5 py-0.5 rounded-full font-semibold text-xs border ${
                  googleSheetsWebhookUrl ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-200'
                }`}>
                  {googleSheetsWebhookUrl ? '✓ WEBHOOK CONNECTED' : '⚠️ WEBHOOK URL NEEDED FOR AUTO-SYNC'}
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">
                Spreadsheet ID: <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono">{DEFAULT_SPREADSHEET_ID}</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSetupGuide(!showSetupGuide)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-all"
            >
              <Code2 className="w-3.5 h-3.5 text-indigo-600" />
              {showSetupGuide ? 'Hide Setup Steps ▲' : '📋 How to Setup Tabs in 1 Min ▼'}
            </button>

            <a
              href={DEFAULT_SPREADSHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-xs transition-all"
            >
              Open Google Sheet
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>
        </div>

        {/* Webhook URL Input Bar */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Google Apps Script Webhook URL (ends in <code className="font-mono text-emerald-700">/exec</code>)
            </label>
            <span className="text-[11px] text-slate-500">
              Sends live updates directly to all separated tabs
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="url"
              value={webhookInput}
              onChange={(e) => setWebhookInput(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <div className="flex items-center gap-2">
              <button
                disabled={isSyncing || isPulling}
                onClick={async () => {
                  if (!webhookInput.trim() || webhookInput.includes('...') || !webhookInput.trim().startsWith('https://')) {
                    setSyncSuccessMsg('⚠️ Please paste your actual deployed Apps Script Web App URL (replace "..." placeholder with your script ID ending in /exec)');
                    setTimeout(() => setSyncSuccessMsg(''), 5000);
                    return;
                  }
                  setGoogleSheetsWebhookUrl(webhookInput.trim());
                  setIsSyncing(true);
                  setSyncSuccessMsg('Connecting and pushing all tables to Google Sheets...');
                  const res = await triggerGoogleSheetsSync(webhookInput.trim());
                  setIsSyncing(false);
                  if (res.success) {
                    setSyncSuccessMsg('✓ Successfully pushed all separated logs and database tables to Google Sheets!');
                  } else {
                    setSyncSuccessMsg(`Sync attempted: ${res?.message || 'Check deployment'}. If tabs are still empty, verify in Apps Script that "Who has access" is set to "Anyone".`);
                  }
                  setTimeout(() => setSyncSuccessMsg(''), 6000);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Pushing...' : 'Push All to Sheets'}
              </button>

              <button
                disabled={isSyncing || isPulling}
                onClick={async () => {
                  if (!webhookInput.trim()) {
                    setSyncSuccessMsg('⚠️ Please paste your Apps Script Web App URL (ends with /exec)');
                    setTimeout(() => setSyncSuccessMsg(''), 5000);
                    return;
                  }
                  setGoogleSheetsWebhookUrl(webhookInput.trim());
                  setIsPulling(true);
                  setSyncSuccessMsg('Importing employee roster from Google Sheets...');
                  const res = await importEmployeesFromGoogleSheets(webhookInput.trim());
                  setIsPulling(false);
                  if (res.success) {
                    setSyncSuccessMsg(`✓ ${res.message}`);
                  } else {
                    setSyncSuccessMsg(`⚠️ ${res.message}`);
                  }
                  setTimeout(() => setSyncSuccessMsg(''), 6000);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
              >
                <Download className={`w-3.5 h-3.5 ${isPulling ? 'animate-bounce' : ''}`} />
                {isPulling ? 'Pulling...' : 'Pull Employees'}
              </button>
            </div>
          </div>
        </div>

        {/* Expandable 3-Step Setup Guide & Troubleshooting */}
        {showSetupGuide && (
          <div className="p-5 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-4 text-slate-800">
            <div className="flex items-center justify-between border-b border-indigo-200/60 pb-3">
              <h4 className="font-extrabold text-xs text-indigo-950 uppercase tracking-wider flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-600" />
                Easy Setup: How to get all 10 tabs created & working in your Google Sheet
              </h4>
              <button
                onClick={handleCopyAppsScript}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
              >
                {scriptCopied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                {scriptCopied ? 'Copied Code!' : 'Copy Script Code'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
              <div className="p-3.5 bg-white rounded-xl border border-indigo-100 shadow-sm space-y-1.5">
                <div className="font-bold text-indigo-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                  Paste Script in Google Sheet
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Open your sheet, click <strong>Extensions ➔ Apps Script</strong>, delete everything in the code editor, and paste the copied script. Click <strong>Save (💾)</strong>.
                </p>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-sm space-y-1.5">
                <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                  Instant Tab Creation (Run Function)
                </div>
                <p className="text-emerald-900 text-[11px] leading-relaxed">
                  In the top toolbar next to &quot;Debug&quot;, select function <code className="bg-emerald-100 text-emerald-950 px-1 rounded font-bold font-mono">createAllTabsNow</code> and click <strong>▶ Run</strong>. Grant permissions when prompted. All 10 tabs will appear instantly in your sheet!
                </p>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-indigo-100 shadow-sm space-y-1.5">
                <div className="font-bold text-indigo-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                  Deploy as Web App
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Click <strong>Deploy ➔ New deployment</strong> (or Manage deployments ➔ Edit ➔ New version). Select <strong>Web app</strong>. Set <i>Who has access</i> to <strong>Anyone</strong>. Copy the URL ending in <code className="font-mono text-indigo-700">/exec</code> and paste it above!
                </p>
              </div>
            </div>

            {/* Troubleshooting Common Pitfalls */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] space-y-1">
              <span className="font-bold flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                Troubleshooting Checklist if sync is not responding:
              </span>
              <ul className="list-disc pl-5 space-y-0.5 text-amber-950">
                <li><strong>&quot;Who has access&quot; MUST be &quot;Anyone&quot;</strong>: If set to &quot;Only myself&quot;, Google blocks requests sent from the web tracker.</li>
                <li><strong>URL must end in &quot;/exec&quot;</strong>: Do not paste the spreadsheet link or library link here.</li>
                <li><strong>After modifying code in Apps Script</strong>: Always click <i>Deploy ➔ Manage Deployments ➔ Edit ➔ New version ➔ Deploy</i> so Google loads the latest code.</li>
              </ul>
            </div>
          </div>
        )}

        {syncSuccessMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            {syncSuccessMsg}
          </div>
        )}

        {/* Separate Schema Tabs Overview */}
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Active Modular Database Tabs (Separated Google Sheet Tabs)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
            {SPREADSHEET_SCHEMA.slice(0, 6).map((tab, idx) => (
              <div
                key={idx}
                onClick={() => {
                  if (tab.tabName === 'Login_Logs') setActiveTab('login');
                  if (tab.tabName === 'Logout_Logs') setActiveTab('logout');
                  if (tab.tabName === 'Idle_Logs') setActiveTab('idle');
                  if (tab.tabName === 'Active_Logs') setActiveTab('active');
                  if (tab.tabName === 'Inactive_Logs') setActiveTab('inactive');
                  if (tab.tabName === 'Admin_Audit_Logs') setActiveTab('admin');
                }}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  (activeTab === 'login' && tab.tabName === 'Login_Logs') ||
                  (activeTab === 'logout' && tab.tabName === 'Logout_Logs') ||
                  (activeTab === 'idle' && tab.tabName === 'Idle_Logs') ||
                  (activeTab === 'active' && tab.tabName === 'Active_Logs') ||
                  (activeTab === 'inactive' && tab.tabName === 'Inactive_Logs') ||
                  (activeTab === 'admin' && tab.tabName === 'Admin_Audit_Logs')
                    ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20'
                    : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100/80'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-950 truncate">
                  <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  {tab.tabName}
                </div>
                <div className="mt-1 text-[10px] text-slate-400 font-mono">
                  {tab.headers.length} Columns
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Primary Log Tabs Navigation */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {/* Tab 1: Login Logs */}
          <button
            onClick={() => setActiveTab('login')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
              activeTab === 'login'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Login Logs</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'login' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
              }`}
            >
              {loginLogs.length}
            </span>
          </button>

          {/* Tab 2: Logout Logs */}
          <button
            onClick={() => setActiveTab('logout')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
              activeTab === 'logout'
                ? 'bg-slate-800 text-white shadow-md shadow-slate-800/20'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <LogOut className="w-4 h-4" />
            <span>Logout Logs</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'logout' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {logoutLogs.length}
            </span>
          </button>

          {/* Tab 3: Idle Logs */}
          <button
            onClick={() => setActiveTab('idle')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
              activeTab === 'idle'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Timer className="w-4 h-4" />
            <span>Idle Logs</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'idle' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {idleLogs.length}
            </span>
          </button>

          {/* Tab 4: Active Work Logs */}
          <button
            onClick={() => setActiveTab('active')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
              activeTab === 'active'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Active Logs</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'active' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {timeLogs.length}
            </span>
          </button>

          {/* Tab 5: Inactive Logs */}
          <button
            onClick={() => setActiveTab('inactive')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
              activeTab === 'inactive'
                ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <PauseCircle className="w-4 h-4" />
            <span>Inactive Logs</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'inactive' ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-700'
              }`}
            >
              {idleLogs.length}
            </span>
          </button>

          {/* Tab 6: Admin & Security Audit */}
          <button
            onClick={() => setActiveTab('admin')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
              activeTab === 'admin'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Admin Audit Logs</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'admin' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'
              }`}
            >
              {adminAuditLogs.length}
            </span>
          </button>

          {/* Tab 7: All Raw Logs */}
          <button
            onClick={() => setActiveTab('all')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-slate-700 text-white shadow-md'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>All Combined ({auditLogs.length})</span>
          </button>
        </div>
      </div>

      {/* Toolbar: Search, Filters & Export for Active Tab */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Search ${activeTab.toUpperCase()} logs by name or details...`}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        {/* Action Category Filter (Admin / All only) */}
        {(activeTab === 'admin' || activeTab === 'all') && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Action Categories</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Export Current Tab CSV Button */}
        <button
          onClick={handleExportCurrentTabCSV}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all shrink-0 ml-auto"
        >
          <Download className="w-3.5 h-3.5 text-indigo-600" />
          Export {activeTab.toUpperCase()} CSV
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB CONTENT: LOGIN LOGS */}
      {/* ========================================================================= */}
      {activeTab === 'login' && (
        <div className="space-y-4">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100">
              <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Total User Sign-ins</div>
              <div className="text-2xl font-extrabold text-blue-950 mt-1">{loginLogs.length}</div>
              <p className="text-[11px] text-blue-700 mt-0.5">Recorded authentication events</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Desktop Software Mode</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                {loginLogs.filter((l) => l.details.includes('Desktop')).length}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Desktop software client logins</p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
              <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Web Portal Mode</div>
              <div className="text-2xl font-extrabold text-emerald-950 mt-1">
                {loginLogs.filter((l) => !l.details.includes('Desktop')).length}
              </div>
              <p className="text-[11px] text-emerald-700 mt-0.5">Web browser browser logins</p>
            </div>
          </div>

          {/* Login Logs Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-blue-900 text-blue-100 font-bold border-b border-blue-800">
                    <th className="py-3.5 px-4">Log ID</th>
                    <th className="py-3.5 px-4">Date & Timestamp</th>
                    <th className="py-3.5 px-4">Employee Name & Role</th>
                    <th className="py-3.5 px-4">Platform Mode</th>
                    <th className="py-3.5 px-4">Timezone & Location</th>
                    <th className="py-3.5 px-4">Session Details</th>
                    <th className="py-3.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredLoginLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <LogIn className="w-8 h-8 text-blue-300 mx-auto mb-2" />
                        No login log records found matching search.
                      </td>
                    </tr>
                  ) : (
                    filteredLoginLogs.map((log) => {
                      const usr = userMap.get(log.actorId) || userMap.get(log.actorName.toLowerCase());
                      const isDesktop = log.details.includes('Desktop');
                      return (
                        <tr key={log.id} className="hover:bg-blue-50/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {log.id}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap font-medium">
                            {log.dateFormatted || log.timestamp}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{log.actorName}</div>
                            <div className="text-[10px] text-slate-500">
                              {usr?.employeeCode ? `#${usr.employeeCode} • ` : ''}
                              <span className="capitalize font-semibold text-blue-700">{log.actorRole}</span> ({usr?.designation || 'Agent'})
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[11px] border ${
                                isDesktop
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {isDesktop ? <Laptop className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                              {isDesktop ? 'Desktop App' : 'Web Portal'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                            {usr?.geoCity ? `${usr.geoCity} (${usr.geoTimezone || 'GMT+8'})` : 'Toronto, Canada (America/Toronto)'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 max-w-xs">{log.details}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                              AUTHENTICATED
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB CONTENT: LOGOUT LOGS */}
      {/* ========================================================================= */}
      {activeTab === 'logout' && (
        <div className="space-y-4">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-100/70 border border-slate-200">
              <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Total Sign-outs</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">{logoutLogs.length}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Recorded user logout sessions</p>
            </div>
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100">
              <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Shift Endings</div>
              <div className="text-2xl font-extrabold text-indigo-950 mt-1">{logoutLogs.length}</div>
              <p className="text-[11px] text-indigo-700 mt-0.5">Completed shifts & logged out</p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
              <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Data Synced</div>
              <div className="text-2xl font-extrabold text-emerald-950 mt-1">100%</div>
              <p className="text-[11px] text-emerald-700 mt-0.5">Stored to database & Google Sheets</p>
            </div>
          </div>

          {/* Logout Logs Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-200 font-bold border-b border-slate-800">
                    <th className="py-3.5 px-4">Log ID</th>
                    <th className="py-3.5 px-4">Date & Timestamp</th>
                    <th className="py-3.5 px-4">Employee Name & Role</th>
                    <th className="py-3.5 px-4">Designation</th>
                    <th className="py-3.5 px-4">Logout Reason / Action</th>
                    <th className="py-3.5 px-4">Audit Details</th>
                    <th className="py-3.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredLogoutLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <LogOut className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        No logout records found matching search.
                      </td>
                    </tr>
                  ) : (
                    filteredLogoutLogs.map((log) => {
                      const usr = userMap.get(log.actorId) || userMap.get(log.actorName.toLowerCase());
                      return (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {log.id}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap font-medium">
                            {log.dateFormatted || log.timestamp}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{log.actorName}</div>
                            <div className="text-[10px] text-slate-500">
                              {usr?.employeeCode ? `#${usr.employeeCode} • ` : ''}
                              <span className="capitalize font-semibold text-slate-700">{log.actorRole}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-700">
                            {usr?.designation || 'Agent'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                              Manual Sign Out / Shift End
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 max-w-xs">{log.details}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                              LOGGED OUT
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB CONTENT: IDLE LOGS */}
      {/* ========================================================================= */}
      {activeTab === 'idle' && (
        <div className="space-y-4">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
              <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Total Idle Inactivity Events</div>
              <div className="text-2xl font-extrabold text-amber-950 mt-1">{idleLogs.length}</div>
              <p className="text-[11px] text-amber-700 mt-0.5">Detected random 10-15m inactive periods</p>
            </div>
            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-100">
              <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Total Minutes Subtracted</div>
              <div className="text-2xl font-extrabold text-rose-950 mt-1">
                {idleLogs.reduce((acc, i) => acc + (i.deductedFromShiftMinutes || i.durationMinutes), 0)} mins
              </div>
              <p className="text-[11px] text-rose-700 mt-0.5">Deducted from shift timesheets</p>
            </div>
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100">
              <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Shift Extensions Mandated</div>
              <div className="text-2xl font-extrabold text-indigo-950 mt-1">
                +{idleLogs.reduce((acc, i) => acc + (i.requiredExtensionMinutes || i.durationMinutes), 0)} mins
              </div>
              <p className="text-[11px] text-indigo-700 mt-0.5">Required end-of-shift extensions</p>
            </div>
          </div>

          {/* Idle Logs Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-amber-900 text-amber-100 font-bold border-b border-amber-800">
                    <th className="py-3.5 px-4">Idle Log ID</th>
                    <th className="py-3.5 px-4">Timestamp Detected</th>
                    <th className="py-3.5 px-4">Employee Name</th>
                    <th className="py-3.5 px-4">Inactivity Duration</th>
                    <th className="py-3.5 px-4">Deducted From Shift</th>
                    <th className="py-3.5 px-4">Required Extension</th>
                    <th className="py-3.5 px-4">Active Task</th>
                    <th className="py-3.5 px-4">Inactivity Reason / Trigger</th>
                    <th className="py-3.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredIdleLogs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <Timer className="w-8 h-8 text-amber-300 mx-auto mb-2" />
                        No idle inactivity log records found matching search.
                      </td>
                    </tr>
                  ) : (
                    filteredIdleLogs.map((i) => {
                      const usr = userMap.get(i.userId) || userMap.get(i.userName.toLowerCase());
                      const deductMins = i.deductedFromShiftMinutes || i.durationMinutes;
                      const extendMins = i.requiredExtensionMinutes || i.durationMinutes;
                      return (
                        <tr key={i.id} className="hover:bg-amber-50/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {i.id}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap font-medium">
                            {i.timestamp}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            <div>{i.userName}</div>
                            <div className="text-[10px] text-slate-500 font-normal">
                              {usr?.employeeCode ? `#${usr.employeeCode}` : ''}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-amber-800">
                            {i.durationMinutes} minutes
                          </td>
                          <td className="py-3.5 px-4 font-bold text-rose-600 font-mono">
                            -{deductMins} mins
                          </td>
                          <td className="py-3.5 px-4 font-bold text-indigo-700 font-mono">
                            +{extendMins} mins
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-800">
                            {i.task}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                            {i.reason}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200 uppercase">
                              {i.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB CONTENT: ACTIVE WORK LOGS */}
      {/* ========================================================================= */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
              <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Total Active Sessions</div>
              <div className="text-2xl font-extrabold text-emerald-950 mt-1">{timeLogs.length}</div>
              <p className="text-[11px] text-emerald-700 mt-0.5">Recorded productive time sessions</p>
            </div>
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100">
              <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Total Net Active Hours</div>
              <div className="text-2xl font-extrabold text-blue-950 mt-1">
                {(timeLogs.reduce((acc, t) => acc + (t.durationSeconds || 0), 0) / 3600).toFixed(1)} hrs
              </div>
              <p className="text-[11px] text-blue-700 mt-0.5">Net productive time tracked</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Avg Input Activity</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                {timeLogs.length > 0
                  ? Math.round(
                      timeLogs.reduce((acc, t) => acc + (t.mouseActivityAvg + t.keyboardActivityAvg) / 2, 0) /
                        timeLogs.length
                    )
                  : 0}
                %
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Overall mouse & keyboard metric</p>
            </div>
          </div>

          {/* Active Work Logs Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-emerald-950 text-emerald-100 font-bold border-b border-emerald-900">
                    <th className="py-3.5 px-4">Session ID</th>
                    <th className="py-3.5 px-4">Employee Name</th>
                    <th className="py-3.5 px-4">Task Category</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Start - End Time</th>
                    <th className="py-3.5 px-4">Net Duration</th>
                    <th className="py-3.5 px-4">Idle Deducted</th>
                    <th className="py-3.5 px-4">Activity %</th>
                    <th className="py-3.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredActiveLogs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <Activity className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
                        No active work session logs found matching search.
                      </td>
                    </tr>
                  ) : (
                    filteredActiveLogs.map((t) => {
                      const durStr = `${Math.floor(t.durationSeconds / 3600)}h ${Math.floor(
                        (t.durationSeconds % 3600) / 60
                      )}m ${t.durationSeconds % 60}s`;
                      const avgAct = Math.round((t.mouseActivityAvg + t.keyboardActivityAvg) / 2);
                      return (
                        <tr key={t.id} className="hover:bg-emerald-50/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {t.id}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{t.userName}</div>
                            <div className="text-[10px] text-slate-500">{t.designation}</div>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-emerald-950">
                            {t.task}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                            {t.date}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                            {t.startTime} - {t.endTime || 'Running'}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-800 whitespace-nowrap">
                            {durStr}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-amber-700">
                            {t.idleSeconds ? `-${Math.round(t.idleSeconds / 60)} mins` : '0 mins'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                avgAct >= 70
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : avgAct >= 40
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {avgAct}% (M:{t.mouseActivityAvg}% K:{t.keyboardActivityAvg}%)
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200 uppercase">
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB CONTENT: INACTIVE LOGS */}
      {/* ========================================================================= */}
      {activeTab === 'inactive' && (
        <div className="space-y-4">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-100">
              <div className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">Inactivity Windows Detected</div>
              <div className="text-2xl font-extrabold text-orange-950 mt-1">{idleLogs.length}</div>
              <p className="text-[11px] text-orange-700 mt-0.5">Zero mouse/keyboard activity flags</p>
            </div>
            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-100">
              <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Payroll Deductions</div>
              <div className="text-2xl font-extrabold text-rose-950 mt-1">
                {idleLogs.reduce((acc, i) => acc + (i.deductedFromShiftMinutes || i.durationMinutes), 0)}m Total
              </div>
              <p className="text-[11px] text-rose-700 mt-0.5">Subtracted from billable shift hours</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Shift Recovery Extension</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                +{idleLogs.reduce((acc, i) => acc + (i.requiredExtensionMinutes || i.durationMinutes), 0)}m
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Added to required work schedule</p>
            </div>
          </div>

          {/* Inactive Logs Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-orange-950 text-orange-100 font-bold border-b border-orange-900">
                    <th className="py-3.5 px-4">Inactivity Log ID</th>
                    <th className="py-3.5 px-4">Date & Time</th>
                    <th className="py-3.5 px-4">Employee Name</th>
                    <th className="py-3.5 px-4">Task Category</th>
                    <th className="py-3.5 px-4">Inactivity Duration</th>
                    <th className="py-3.5 px-4">Deduction Status</th>
                    <th className="py-3.5 px-4">Trigger Source</th>
                    <th className="py-3.5 px-4">Impact on Shift</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredIdleLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <PauseCircle className="w-8 h-8 text-orange-300 mx-auto mb-2" />
                        No inactivity event records found.
                      </td>
                    </tr>
                  ) : (
                    filteredIdleLogs.map((i) => {
                      const usr = userMap.get(i.userId) || userMap.get(i.userName.toLowerCase());
                      const deductMins = i.deductedFromShiftMinutes || i.durationMinutes;
                      const extendMins = i.requiredExtensionMinutes || i.durationMinutes;
                      return (
                        <tr key={i.id} className="hover:bg-orange-50/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            inact-{i.id}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap font-medium">
                            {i.timestamp}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            <div>{i.userName}</div>
                            <div className="text-[10px] text-slate-500 font-normal">
                              {usr?.employeeCode ? `#${usr.employeeCode}` : ''}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            {i.task}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-orange-800">
                            {i.durationMinutes} mins
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold border border-rose-200">
                              Deducted -{deductMins}m
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                            {i.reason || 'Hardware Sensor: Inactivity threshold exceeded'}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-indigo-700">
                            Shift Extended by +{extendMins}m
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB CONTENT: ADMIN & SECURITY AUDIT LOGS */}
      {/* ========================================================================= */}
      {activeTab === 'admin' && (
        <div className="space-y-4">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100">
              <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Administrative Actions</div>
              <div className="text-2xl font-extrabold text-indigo-950 mt-1">{adminAuditLogs.length}</div>
              <p className="text-[11px] text-indigo-700 mt-0.5">Clean governance audit trail</p>
            </div>
            <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-100">
              <div className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Role & Supervisor Changes</div>
              <div className="text-2xl font-extrabold text-purple-950 mt-1">
                {adminAuditLogs.filter((l) => l.category.includes('Role') || l.category.includes('Supervisor')).length}
              </div>
              <p className="text-[11px] text-purple-700 mt-0.5">Staff permission assignments</p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
              <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Surveillance & Security Toggles</div>
              <div className="text-2xl font-extrabold text-amber-950 mt-1">
                {adminAuditLogs.filter((l) => l.category.includes('Monitor') || l.category.includes('Password')).length}
              </div>
              <p className="text-[11px] text-amber-700 mt-0.5">Screenshot & activity controls</p>
            </div>
          </div>

          {/* Admin Audit Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-indigo-950 text-indigo-100 font-bold border-b border-indigo-900">
                    <th className="py-3.5 px-4">Date & Timestamp</th>
                    <th className="py-3.5 px-4">Actor (Who Changed)</th>
                    <th className="py-3.5 px-4">Action Category</th>
                    <th className="py-3.5 px-4">Affected Employee</th>
                    <th className="py-3.5 px-4">Previous Value ➔ New Value</th>
                    <th className="py-3.5 px-4">Audit Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredAdminAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <ShieldAlert className="w-8 h-8 text-indigo-300 mx-auto mb-2" />
                        No administrative audit records found matching search filter.
                      </td>
                    </tr>
                  ) : (
                    filteredAdminAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                          {log.dateFormatted}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div>{log.actorName}</div>
                          <div className="text-[10px] text-slate-400 font-normal uppercase">
                            {log.actorRole}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full font-bold text-[11px] border ${getCategoryBadgeColor(
                              log.category
                            )}`}
                          >
                            {log.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-800">
                          {log.targetEmployeeName || <span className="text-slate-400 italic">System / N/A</span>}
                        </td>
                        <td className="py-3.5 px-4">
                          {log.fromValue || log.toValue ? (
                            <div className="inline-flex items-center gap-1.5 font-mono text-[11px]">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 max-w-[120px] truncate">
                                {log.fromValue || 'None'}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold max-w-[120px] truncate">
                                {log.toValue || 'Updated'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-xs">{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB CONTENT: ALL COMBINED LOGS */}
      {/* ========================================================================= */}
      {activeTab === 'all' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-slate-200 font-bold border-b border-slate-800">
                  <th className="py-3.5 px-4">Date & Timestamp</th>
                  <th className="py-3.5 px-4">Actor</th>
                  <th className="py-3.5 px-4">Action Category</th>
                  <th className="py-3.5 px-4">Affected Employee</th>
                  <th className="py-3.5 px-4">Values</th>
                  <th className="py-3.5 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredAllLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No logs found.
                    </td>
                  </tr>
                ) : (
                  filteredAllLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {log.dateFormatted}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {log.actorName} <span className="text-[10px] text-slate-400">({log.actorRole})</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full font-bold text-[11px] border ${getCategoryBadgeColor(
                            log.category
                          )}`}
                        >
                          {log.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {log.targetEmployeeName || '-'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        {log.fromValue && log.toValue ? `${log.fromValue} ➔ ${log.toValue}` : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs">{log.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Google Apps Script Setup Code Modal */}
      {showAppsScriptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-950 font-extrabold text-lg">
                <Code2 className="w-5 h-5 text-indigo-600" />
                Google Apps Script Setup Code (Separated Modular Tabs)
              </div>
              <button
                onClick={() => setShowAppsScriptModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Copy this script and paste it into your Google Sheet (<strong>Extensions ➔ Apps Script</strong>). It will automatically create and format separate tabs for <strong>Login_Logs</strong>, <strong>Logout_Logs</strong>, <strong>Idle_Logs</strong>, <strong>Active_Logs</strong>, <strong>Inactive_Logs</strong>, and <strong>Admin_Audit_Logs</strong> with color-coded headers and frozen rows!
            </p>

            <div className="relative bg-slate-950 rounded-xl p-4 overflow-x-auto text-emerald-400 font-mono text-xs max-h-60 border border-slate-800">
              <pre>{generateAppsScriptCode(DEFAULT_SPREADSHEET_ID)}</pre>
            </div>

            <div className="flex items-center justify-between pt-2">
              <a
                href={DEFAULT_SPREADSHEET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline text-xs font-semibold inline-flex items-center gap-1"
              >
                Open Google Sheet <ExternalLink className="w-3 h-3" />
              </a>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAppsScriptModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Close
                </button>
                <button
                  onClick={handleCopyAppsScript}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all"
                >
                  {scriptCopied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  {scriptCopied ? 'Code Copied!' : 'Copy Script Code'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
