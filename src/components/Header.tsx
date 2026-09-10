import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { WorldClockWidget } from './WorldClockWidget';
import {
  Clock,
  LayoutDashboard,
  Calendar,
  Camera,
  FileText,
  Coins,
  UserCheck,
  Users,
  ChevronDown,
  LogOut,
  LogIn,
  User as UserIcon,
  Sparkles,
  Download,
  Laptop,
  CheckCircle2,
  FileSpreadsheet,
  KeyRound,
  Lock,
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Code,
  Layers,
  Shield,
  Database,
} from 'lucide-react';
import { UserRole } from '../types';
import { getGoogleAppsScriptTemplate, downloadTableCSV, DEFAULT_SPREADSHEET_ID, DEFAULT_SPREADSHEET_URL } from '../lib/googleSheetsSync';
import { downloadDesktopSoftwarePackage, DesktopOS } from '../lib/desktopDownloader';
import { downloadWordDocInstructions } from '../lib/docGenerator';
import { UserAvatar } from './UserAvatar';
import { TaskDesignationManagerModal } from './modals/TaskDesignationManagerModal';
import { RolePermissionsModal } from './modals/RolePermissionsModal';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const {
    currentUser,
    users,
    timeLogs,
    auditLogs,
    payrollRecords,
    setCurrentUser,
    isDesktopDockView,
    setIsDesktopDockView,
    loginMode,
    webSessionRemainingSeconds,
    isSessionWarningActive,
    webSessionWarningCountdown,
    refreshWebSession,
    logout,
    googleSheetsWebhookUrl,
    setGoogleSheetsWebhookUrl,
    triggerGoogleSheetsSync,
    importEmployeesFromGoogleSheets,
    hasPermission,
    isCloudQuotaExhausted,
    storageEngineMode,
    setStorageEngineMode,
  } = useApp();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [showTaskManagerModal, setShowTaskManagerModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [sheetsWebhookInput, setSheetsWebhookInput] = useState(googleSheetsWebhookUrl);
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [importingSheets, setImportingSheets] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showScriptDetails, setShowScriptDetails] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const visibleUsers = users.filter((u) => !u.isSecretBackup);

  const isSuperAdmin =
    currentUser.employeeCode?.toLowerCase() === 'superadmin' ||
    currentUser.id === 'usr-superadmin-red' ||
    currentUser.id === 'usr-superadmin-root' ||
    currentUser.email === 'admin@llc.com';

  const handleRoleSelect = (userId: string) => {
    const selected = users.find((u) => u.id === userId);
    if (selected) {
      setCurrentUser(selected);
      setShowLoginModal(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const [headerSelectedOS, setHeaderSelectedOS] = useState<DesktopOS>('windows');

  const handleSimulateDownload = () => {
    downloadDesktopSoftwarePackage(headerSelectedOS);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Admin</span>;
      case 'va_admin':
        return <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">VA Admin</span>;
      case 'team_lead':
        return <span className="bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Team Lead</span>;
      case 'trainer':
        return <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Trainer</span>;
      case 'hr':
        return <span className="bg-purple-500/20 text-purple-300 border border-purple-400/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">HR</span>;
      case 'payroll':
        return <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Payroll</span>;
      default:
        return <span className="bg-slate-500/20 text-slate-300 border border-slate-400/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Agent</span>;
    }
  };

  return (
    <header className="bg-[#0F172A] border-b border-slate-800 text-slate-100 sticky top-0 z-30 shadow-md">
      {/* Top World Clock Bar */}
      <WorldClockWidget />

      {/* Main Nav Header */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-white shadow-sm">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">LLC Time Tracker</span>
              <span className="bg-blue-600/20 border border-blue-500/40 text-blue-400 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                v1
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Agent Time & Activity Tracking</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto py-1 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          {/* Team Timesheet (Hidden for standard Agents without timesheet permission) */}
          {(currentUser.role !== 'agent' || hasPermission('canViewTimesheets')) && (
            <button
              onClick={() => setActiveTab('timesheet')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'timesheet'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Timesheet</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('my_timesheet')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'my_timesheet'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <UserIcon className="w-4 h-4 text-emerald-400" />
            <span>My Timesheet</span>
          </button>

          {/* Activity Logs / Screenshot Monitor (SuperAdmin or users with permission e.g. Trainers / Supervisors) */}
          {(currentUser.role === 'admin' || hasPermission('canViewActivityLogs') || hasPermission('canViewScreenshots')) && (
            <button
              onClick={() => setActiveTab('activity')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'activity'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Activity Logs & Screenshots</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('requests')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'requests'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Leave Requests</span>
          </button>

          {/* Employee Directory Tab (For HR, Admin, VA Admin, Trainer, or users with CRUD/Assign rights) */}
          {(currentUser.role === 'hr' || currentUser.role === 'admin' || currentUser.role === 'va_admin' || currentUser.role === 'trainer' || hasPermission('canEditEmployees') || hasPermission('canAssignTeamLeader')) && (
            <button
              onClick={() => setActiveTab('employees')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'employees'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Employee Directory</span>
            </button>
          )}

          {(currentUser.role === 'payroll' || currentUser.role === 'admin' || currentUser.role === 'va_admin' || hasPermission('canViewPayroll')) && (
            <button
              onClick={() => setActiveTab('payroll')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'payroll'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Coins className="w-4 h-4" />
              <span>Payroll</span>
            </button>
          )}

          {/* System Audit Logs & Google Sheets Integration (Admin / VA Admin) */}
          {(currentUser.role === 'admin' || currentUser.role === 'va_admin' || hasPermission('canSyncSheets')) && (
            <button
              onClick={() => setActiveTab('audit_sheets')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'audit_sheets'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Audit Logs & Sheets</span>
            </button>
          )}
        </nav>

        {/* User Account & Software Controls */}
        <div className="flex items-center gap-2.5">
          {/* Quick Manager Control: Task & Designation Manager (Admin & Super Admin) */}
          {(currentUser.role === 'admin' || isSuperAdmin || hasPermission('canManageTasks')) && (
            <button
              onClick={() => setShowTaskManagerModal(true)}
              className="p-2 px-2.5 rounded-xl bg-blue-950 hover:bg-blue-900 border border-blue-700/70 text-blue-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Configure Role Designations & Task Dropdown Options (Admin & Super Admin)"
            >
              <Layers className="w-4 h-4 text-blue-400" />
              <span className="hidden xl:inline">Task Options Manager</span>
            </button>
          )}

          {/* Quick Manager Control: Designation and Permissions Control (Super Admin Only) */}
          {isSuperAdmin && (
            <button
              onClick={() => setShowPermissionsModal(true)}
              className="p-2 px-2.5 rounded-xl bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/70 text-indigo-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Open Designation and Permissions Control (Super Admin Only)"
            >
              <Shield className="w-4 h-4 text-indigo-400" />
              <span className="hidden xl:inline">Designation & Permissions</span>
            </button>
          )}
          {/* Web Session Inactivity Auto-Logout Indicator (Web Portal only) */}
          {loginMode === 'webapp' && (
            <button
              onClick={refreshWebSession}
              title={
                isSessionWarningActive
                  ? `Inactivity Warning: No activity detected for 5 minutes. Web session will auto-logout in ${Math.floor(webSessionWarningCountdown / 60)}:${String(webSessionWarningCountdown % 60).padStart(2, '0')}. Click to refresh session now.`
                  : 'Web Portal Session: Active. Auto-logout occurs after 10 minutes of complete inactivity. Click to refresh session.'
              }
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all ${
                isSessionWarningActive
                  ? 'bg-amber-950/90 border-amber-500 text-amber-300 animate-pulse shadow-lg shadow-amber-500/20'
                  : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
            >
              <Clock
                className={`w-3.5 h-3.5 ${
                  isSessionWarningActive ? 'text-amber-400 animate-bounce' : 'text-emerald-400'
                }`}
              />
              <span className="text-[11px] font-semibold">
                {isSessionWarningActive ? (
                  <span>
                    Expiring:{' '}
                    <span className="font-bold text-amber-300">
                      {Math.floor(webSessionWarningCountdown / 60)}:
                      {String(webSessionWarningCountdown % 60).padStart(2, '0')}
                    </span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Session: Active</span>
                  </span>
                )}
              </span>
            </button>
          )}

          {/* User Profile Badge (Static Display - No Hover Dropdown) */}
          <div className="flex items-center gap-2.5 bg-slate-800/80 border border-slate-700 p-1.5 px-3 rounded-xl select-none">
            <UserAvatar name={currentUser.name} role={currentUser.role} size="md" />
            <div className="text-left hidden md:block">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-xs text-white">{currentUser.name}</span>
                {getRoleBadge(currentUser.role)}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <span>{currentUser.employeeCode}</span>
                <span>•</span>
                <span>{currentUser.designation}</span>
              </div>
            </div>
          </div>

          {/* Storage Architecture Engine Status Badge */}
          <button 
            onClick={() => currentUser.role === 'admin' ? setShowSheetsModal(true) : null}
            className="p-1.5 px-3 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/40 text-blue-300 flex items-center gap-1.5 text-xs font-semibold transition-colors shadow-sm cursor-pointer"
            title={storageEngineMode === 'unlimited_bridge' 
              ? "High-Capacity Server Bridge Active: Zero Firestore quota limits. Unlimited throughput for 100+ agents with real-time Google Sheets sync."
              : "Firestore Direct Mode: Subject to standard daily Spark read/write quotas."
            }
          >
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">
              {storageEngineMode === 'unlimited_bridge' ? '⚡ 100+ Agent Unlimited Bridge' : 'Cloud Firestore'}
            </span>
          </button>

          {/* Google Sheets Integration Sync Button - Restricted to Super Admin (admin role) only */}
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setShowSheetsModal(true)}
              className="p-2 px-3 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Open Google Sheets Database & Auto-Sync Settings (Super Admin Only)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Google Sheets Sync</span>
            </button>
          )}

          {/* Download Standalone App Client */}
          <button
            onClick={() => setShowDownloadModal(true)}
            className="p-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
            title="Download Standalone Software Package (.hta / .exe source)"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span className="hidden md:inline">Download Software</span>
          </button>

          {/* Top Level Direct Logout Button */}
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-slate-800 hover:bg-red-950/80 hover:text-red-300 border border-slate-700 text-slate-400 transition-colors flex items-center gap-1.5 text-xs font-semibold"
            title="Log Out of System"
          >
            <LogOut className="w-4 h-4 text-red-400" />
            <span className="hidden lg:inline">Log Out</span>
          </button>
        </div>
      </div>

      {/* Download Desktop Application Modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 text-slate-800">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">LLC Time Tracker Desktop Software</h3>
                  <p className="text-xs text-slate-500">Cross-Platform Standalone App for Windows, macOS & Linux</p>
                </div>
              </div>
              <button
                onClick={() => setShowDownloadModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Operating System Selector Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                onClick={() => setHeaderSelectedOS('windows')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  headerSelectedOS === 'windows'
                    ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🖥️ Windows OS
              </button>
              <button
                onClick={() => setHeaderSelectedOS('mac')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  headerSelectedOS === 'mac'
                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🍎 macOS (Apple)
              </button>
              <button
                onClick={() => setHeaderSelectedOS('linux')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  headerSelectedOS === 'linux'
                    ? 'bg-white text-amber-600 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🐧 Linux OS
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              {/* Native Standalone Electron Software Package */}
              <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/70 hover:bg-emerald-50 transition-all space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-emerald-950 flex items-center gap-2">
                    <Download className="w-4 h-4 text-emerald-600" /> Standalone Desktop Executable Package ({headerSelectedOS === 'windows' ? 'Windows .exe' : headerSelectedOS === 'mac' ? 'macOS .app' : 'Linux Binary'})
                  </span>
                  <span className="text-[10px] bg-emerald-600 text-white font-bold px-2.5 py-0.5 rounded-full">
                    STANDALONE APP
                  </span>
                </div>
                <p className="text-[11px] text-emerald-900 leading-relaxed">
                  Downloads the automated desktop builder (<code>{headerSelectedOS === 'windows' ? 'Build_LLC_Time_Tracker_Windows.bat' : headerSelectedOS === 'mac' ? 'Build_LLC_Time_Tracker_Mac.sh' : 'Build_LLC_Time_Tracker_Linux.sh'}</code>). Run this script in your desktop folder to produce your native <strong>{headerSelectedOS === 'windows' ? 'LLC Time Tracker.exe' : headerSelectedOS === 'mac' ? 'LLC Time Tracker.app' : 'LLC Time Tracker'}</strong> application directly!
                </p>
                <button
                  onClick={() => {
                    handleSimulateDownload();
                    setShowDownloadModal(false);
                  }}
                  className="w-full py-3 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99]"
                >
                  <Download className="w-4 h-4" /> Download {headerSelectedOS === 'windows' ? 'Windows App Builder (.bat)' : headerSelectedOS === 'mac' ? 'macOS App Builder (.sh)' : 'Linux App Builder (.sh)'}
                </button>
              </div>

              {/* Step-by-step instructions */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-[11px]">
                <span className="font-bold text-slate-800">Quick Installation Steps:</span>
                <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                  <li>Download the builder script above to your desktop folder.</li>
                  <li>Run the script ({headerSelectedOS === 'windows' ? 'double-click the .bat file' : 'run bash Build_LLC_Time_Tracker_*.sh in terminal'}).</li>
                  <li>Launch your native desktop application and log in to track your shift.</li>
                </ol>
              </div>

              {/* Word Document User & Login Guide Download */}
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-800 text-[11px]">User Guide & Login Demo Document</div>
                    <div className="text-[10px] text-slate-500">Microsoft Word (.doc) with all demo credentials & setup steps</div>
                  </div>
                </div>
                <button
                  onClick={() => downloadWordDocInstructions()}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 shadow-sm transition-all"
                  title="Download complete documentation as Microsoft Word Document (.doc)"
                >
                  <Download className="w-3 h-3" />
                  <span>Download .DOC</span>
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => downloadWordDocInstructions()}
                className="px-3 py-1.5 rounded-xl text-blue-600 hover:bg-blue-50 text-xs font-semibold flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Export Word Guide</span>
              </button>
              <button
                onClick={() => setShowDownloadModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Sheets Integration Live Sync Modal */}
      {showSheetsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 text-slate-800">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Google Sheets Database Live Sync</h3>
                  <p className="text-xs text-slate-500">Connected Spreadsheet ID: {DEFAULT_SPREADSHEET_ID}</p>
                </div>
              </div>
              <button
                onClick={() => setShowSheetsModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              {/* Storage Engine Architecture Selector for 100+ Agents */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-blue-900 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-blue-600" /> Database & Storage Architecture
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                    High Capacity
                  </span>
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Select your storage engine. For teams with 20 to 100+ agents, the <b>Unlimited Server & Google Sheets Bridge</b> provides zero quota limits, instant sub-millisecond writes, and seamless Google Sheets auto-sync.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setStorageEngineMode('unlimited_bridge')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      storageEngineMode === 'unlimited_bridge'
                        ? 'bg-blue-600 text-white border-blue-700 shadow-sm ring-2 ring-blue-400/40'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>⚡ Unlimited Bridge</span>
                      {storageEngineMode === 'unlimited_bridge' && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <p className={`text-[10px] mt-0.5 ${storageEngineMode === 'unlimited_bridge' ? 'text-blue-100' : 'text-slate-500'}`}>
                      Zero quota limits • 100+ agents • Google Sheets Sync
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStorageEngineMode('firestore')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      storageEngineMode === 'firestore'
                        ? 'bg-blue-600 text-white border-blue-700 shadow-sm ring-2 ring-blue-400/40'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>Direct Firestore Cloud</span>
                      {storageEngineMode === 'firestore' && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <p className={`text-[10px] mt-0.5 ${storageEngineMode === 'firestore' ? 'text-blue-100' : 'text-slate-500'}`}>
                      Spark Free Tier (50k daily reads limit)
                    </p>
                  </button>
                </div>
              </div>

              {/* Linked Google Spreadsheet Quick Access */}
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Master Google Spreadsheet
                  </span>
                  <a
                    href={DEFAULT_SPREADSHEET_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline flex items-center gap-1"
                  >
                    Open Google Sheet <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Connects to tabs: <b>Time_Logs</b>, <b>Login_Session_Logs</b>, <b>Employee_Directory</b>, <b>Payroll_Summary</b>, and <b>Audit_Logs</b>.
                </p>
              </div>

              {/* Webhook URL Config */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-blue-600" /> Google Apps Script Webhook URL
                  </label>
                  <button
                    onClick={() => setShowScriptDetails(!showScriptDetails)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                  >
                    {showScriptDetails ? 'Hide Setup Code ▲' : '📋 How to get Webhook URL ▼'}
                  </button>
                </div>

                {showScriptDetails && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-slate-700 space-y-2 text-[11px] leading-relaxed">
                    <p className="font-bold text-blue-900">How to activate automatic Google Sheets sync:</p>
                    <ol className="list-decimal pl-4 space-y-1 text-slate-700">
                      <li>Open your Google Sheet, click <b>Extensions</b> → <b>Apps Script</b>.</li>
                      <li>Delete all existing text in the editor and click the button below to copy the webhook script.</li>
                      <li>Paste the script and click <b>Save</b> (💾).</li>
                      <li>Click <b>Deploy</b> → <b>New deployment</b> → Select <b>Web app</b>.</li>
                      <li>Set <i>Execute as:</i> <b>Me</b>, and <i>Who has access:</i> <b>Anyone</b> → Click <b>Deploy</b>.</li>
                      <li>Copy the resulting Web App URL (ends with <code>/exec</code>) and paste it below!</li>
                    </ol>
                    <button
                      onClick={() => {
                        const scriptCode = getGoogleAppsScriptTemplate(DEFAULT_SPREADSHEET_ID);
                        navigator.clipboard.writeText(scriptCode);
                        setCopiedScript(true);
                        setTimeout(() => setCopiedScript(false), 4000);
                      }}
                      className="mt-2 w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      {copiedScript ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedScript ? '✓ Copied Apps Script Code to Clipboard!' : 'Copy Apps Script Webhook Code'}</span>
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={sheetsWebhookInput}
                    onChange={(e) => setSheetsWebhookInput(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 bg-white border border-slate-300 rounded-xl p-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <button
                    disabled={syncingSheets || importingSheets}
                    onClick={async () => {
                      if (!sheetsWebhookInput.trim() || sheetsWebhookInput.includes('...') || !sheetsWebhookInput.trim().startsWith('https://')) {
                        setSyncStatusMsg('Please paste your actual deployed Web App URL (replace the "..." placeholder with your script ID ending in /exec)');
                        return;
                      }
                      setGoogleSheetsWebhookUrl(sheetsWebhookInput.trim());
                      setSyncingSheets(true);
                      setSyncStatusMsg('Connecting to Google Sheets...');
                      const res = await triggerGoogleSheetsSync(sheetsWebhookInput.trim());
                      setSyncingSheets(false);
                      if (res && res.success) {
                        setSyncStatusMsg('✓ Successfully pushed and synchronized all tables to Google Sheets!');
                      } else {
                        setSyncStatusMsg(`Sync attempted: ${res?.message || 'Check Apps Script permissions'}. Ensure "Who has access" is set to "Anyone" in Apps Script deployment.`);
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0 shadow-sm flex items-center gap-1 disabled:opacity-50"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>{syncingSheets ? 'Pushing...' : 'Push to Sheets'}</span>
                  </button>
                  <button
                    disabled={syncingSheets || importingSheets}
                    onClick={async () => {
                      setGoogleSheetsWebhookUrl(sheetsWebhookInput);
                      setImportingSheets(true);
                      setSyncStatusMsg('Importing employee roster from Google Sheets...');
                      const res = await importEmployeesFromGoogleSheets(sheetsWebhookInput.trim());
                      setImportingSheets(false);
                      if (res && res.success) {
                        setSyncStatusMsg(`✓ ${res.message}`);
                      } else {
                        setSyncStatusMsg(`⚠️ ${res.message}`);
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shrink-0 shadow-sm flex items-center gap-1 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{importingSheets ? 'Pulling...' : 'Pull Employees'}</span>
                  </button>
                </div>

                {syncStatusMsg && (
                  <p className="text-[11px] font-medium text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                    {syncStatusMsg}
                  </p>
                )}
              </div>

              {/* Direct CSV Export Option */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs">Direct Spreadsheet CSV Export</span>
                  <span className="text-[10px] text-slate-500">{timeLogs.length} Time Logs Recorded</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Export your data tables directly to CSV files ready to open in Excel or import into Google Sheets:
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => {
                      downloadTableCSV(
                        'Time_Logs.csv',
                        ['Log ID', 'Employee Name', 'Designation', 'Task', 'Date', 'Start Time', 'End Time', 'Duration (s)', 'Mouse %', 'Keyboard %', 'Status', 'Notes'],
                        timeLogs.map((l) => [l.id, l.userName, l.designation, l.task, l.date, l.startTime, l.endTime || 'Running', l.durationSeconds, l.mouseActivityAvg, l.keyboardActivityAvg, l.status, l.notes || ''])
                      );
                    }}
                    className="py-1.5 px-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-medium text-xs flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600" /> Export Time_Logs.csv
                  </button>
                  <button
                    onClick={() => {
                      downloadTableCSV(
                        'Payroll_Summary.csv',
                        ['Pay Period', 'Employee Code', 'Employee Name', 'Designation', 'Total Hours', 'Regular Hours', 'Overtime Hours', 'Gross Pay', 'Net Pay', 'Status'],
                        payrollRecords.map((p) => [p.payPeriod, p.employeeCode, p.userName, p.designation, p.totalTrackedHours, p.regularHours, p.overtimeHours, p.grossPay, p.netPay, p.status])
                      );
                    }}
                    className="py-1.5 px-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-medium text-xs flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" /> Export Payroll.csv
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-end">
              <button
                onClick={() => setShowSheetsModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Logout / Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 text-slate-800">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">LLC Time Tracker Sign In</h3>
                  <p className="text-xs text-slate-500">Select user profile to log into system</p>
                </div>
              </div>
              <button
                onClick={() => setShowLoginModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {visibleUsers.map((usr) => (
                <button
                  key={usr.id}
                  onClick={() => handleRoleSelect(usr.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    usr.id === currentUser.id
                      ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/20'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <UserAvatar name={usr.name} role={usr.role} size="md" />
                  <div className="flex-1 truncate">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{usr.name}</span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {usr.role === 'admin' ? 'Admin' : usr.role === 'va_admin' ? 'VA Admin' : usr.role === 'team_lead' || usr.role === 'team_leader' ? 'Team Leader' : usr.role === 'trainer' ? 'Trainer' : usr.role === 'qa' ? 'QA Specialist' : usr.role === 'writer' ? 'Writer' : usr.role === 'hr' ? 'HR' : usr.role === 'payroll' ? 'Payroll Officer' : 'Agent'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{usr.email}</p>
                    <p className="text-[11px] font-medium text-blue-600 mt-0.5">{usr.designation} • {usr.geoCity}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-end">
              <button
                onClick={() => setShowLoginModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task & Designation Options Manager Modal */}
      <TaskDesignationManagerModal
        isOpen={showTaskManagerModal}
        onClose={() => setShowTaskManagerModal(false)}
      />

      {/* Role-Based Permissions & Access Matrix Modal */}
      <RolePermissionsModal
        isOpen={showPermissionsModal}
        onClose={() => setShowPermissionsModal(false)}
      />
    </header>
  );
};
