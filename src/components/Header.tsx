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
} from 'lucide-react';
import { UserRole } from '../types';
import { getGoogleAppsScriptTemplate, downloadTableCSV, DEFAULT_SPREADSHEET_ID, DEFAULT_SPREADSHEET_URL } from '../lib/googleSheetsSync';
import { downloadDesktopSoftwarePackage, DesktopOS } from '../lib/desktopDownloader';
import { UserAvatar } from './UserAvatar';

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
    logout,
    googleSheetsWebhookUrl,
    setGoogleSheetsWebhookUrl,
    triggerGoogleSheetsSync,
    importEmployeesFromGoogleSheets,
  } = useApp();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [sheetsWebhookInput, setSheetsWebhookInput] = useState(googleSheetsWebhookUrl);
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [importingSheets, setImportingSheets] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showScriptDetails, setShowScriptDetails] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const visibleUsers = users.filter((u) => !u.isSecretBackup);

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

          {/* Team Timesheet (Hidden for Agents) */}
          {currentUser.role !== 'agent' && (
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

          {/* Activity Logs (Hidden for HR) */}
          {currentUser.role !== 'hr' && (
            <button
              onClick={() => setActiveTab('activity')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'activity'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Activity Logs</span>
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

          {/* Employee Directory Tab (For HR, Admin, VA Admin) */}
          {(currentUser.role === 'hr' || currentUser.role === 'admin' || currentUser.role === 'va_admin') && (
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

          {(currentUser.role === 'payroll' || currentUser.role === 'admin' || currentUser.role === 'va_admin') && (
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
          {(currentUser.role === 'admin' || currentUser.role === 'va_admin') && (
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
        <div className="flex items-center gap-3">
          {/* User Profile Badge & Persona Control */}
          <div className="relative group">
            <div className="flex items-center gap-2.5 bg-slate-800/80 border border-slate-700 p-1.5 px-3 rounded-xl transition-all cursor-pointer">
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
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>

            {/* Profile Menu Popup */}
            <div className="absolute right-0 top-full mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 hidden group-hover:block z-50 text-xs space-y-3">
              <div className="flex items-center gap-3 pb-2 border-b border-slate-800">
                <UserAvatar name={currentUser.name} role={currentUser.role} size="lg" />
                <div>
                  <div className="font-bold text-white text-sm">{currentUser.name}</div>
                  <div className="text-slate-400 text-[11px]">{currentUser.email}</div>
                  <div className="text-emerald-400 font-mono font-semibold text-[10px] mt-0.5">
                    ID: {currentUser.employeeCode}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-slate-400 font-semibold flex items-center justify-between px-1 mb-1">
                  <span>Quick Account Persona Switcher:</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {visibleUsers.map((usr) => (
                    <button
                      key={usr.id}
                      onClick={() => handleRoleSelect(usr.id)}
                      className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors ${
                        usr.id === currentUser.id
                          ? 'bg-indigo-950/80 text-white border border-indigo-700/60 font-semibold'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <UserAvatar name={usr.name} role={usr.role} size="xs" />
                      <div className="flex-1 truncate">
                        <div className="font-medium text-slate-200">{usr.name}</div>
                        <div className="text-[10px] text-slate-400">{usr.designation} ({usr.role.toUpperCase()})</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 p-2 rounded-lg bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800/80 font-semibold transition-colors text-xs"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out / Switch Account</span>
                </button>
              </div>
            </div>
          </div>

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

          {/* Switch to Desktop Software App Mode Button */}
          <button
            onClick={() => setIsDesktopDockView(true)}
            className="p-2 px-3 rounded-xl bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/80 text-indigo-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
            title="Switch to Desktop Software App Tracking View"
          >
            <Laptop className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Desktop Tracker App</span>
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
                🖥️ Windows PC
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
              {/* Primary Option: Native Standalone Electron Software Package */}
              <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/70 hover:bg-emerald-50 transition-all space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-emerald-950 flex items-center gap-2">
                    <Download className="w-4 h-4 text-emerald-600" /> Standalone Desktop Executable Package ({headerSelectedOS === 'windows' ? 'Windows .exe' : headerSelectedOS === 'mac' ? 'macOS .app' : 'Linux Binary'})
                  </span>
                  <span className="text-[10px] bg-emerald-600 text-white font-bold px-2.5 py-0.5 rounded-full">
                    RECOMMENDED DESKTOP APP
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
                  className="w-full py-3 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
                >
                  <Download className="w-4 h-4" /> Download {headerSelectedOS === 'windows' ? 'Windows App Builder (.bat)' : headerSelectedOS === 'mac' ? 'macOS App Builder (.sh)' : 'Linux App Builder (.sh)'}
                </button>
              </div>

              {/* Secondary Option: In-App Desktop Software View */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <Laptop className="w-4 h-4 text-indigo-600" /> In-App Desktop Software Window View
                  </span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                    Instant Preview
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Switch the web portal interface directly into the standalone Desktop Time Tracker Software dock view right now inside your browser.
                </p>
                <button
                  onClick={() => {
                    setShowDownloadModal(false);
                    setIsDesktopDockView(true);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                >
                  <Clock className="w-3.5 h-3.5 text-emerald-400" /> Switch to Desktop Software App View
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-end">
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
                      setGoogleSheetsWebhookUrl(sheetsWebhookInput);
                      if (!sheetsWebhookInput.trim()) {
                        setSyncStatusMsg('Please paste a valid Web App URL (ending in /exec)');
                        return;
                      }
                      setSyncingSheets(true);
                      setSyncStatusMsg('Connecting to Google Sheets...');
                      const res = await triggerGoogleSheetsSync(sheetsWebhookInput.trim());
                      setSyncingSheets(false);
                      if (res && res.success) {
                        setSyncStatusMsg('✓ Successfully pushed and synchronized all tables to Google Sheets!');
                      } else {
                        setSyncStatusMsg(`Sync attempted. If data does not appear, ensure "Who has access" is set to "Anyone" in Apps Script deployment.`);
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
                  <img src={usr.avatar} alt={usr.name} className="w-10 h-10 rounded-full object-cover border border-slate-300" />
                  <div className="flex-1 truncate">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{usr.name}</span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {usr.role === 'admin' ? 'Admin' : usr.role === 'va_admin' ? 'VA Admin' : usr.role === 'team_lead' ? 'Team Lead' : usr.role === 'trainer' ? 'Trainer' : 'Agent'}
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
    </header>
  );
};
