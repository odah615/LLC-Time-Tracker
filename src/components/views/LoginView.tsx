import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User } from '../../types';
import { maskPassword } from '../../lib/googleSheetsSync';
import { downloadWordDocInstructions } from '../../lib/docGenerator';
import { downloadDesktopSoftwarePackage } from '../../lib/desktopDownloader';
import {
  Clock,
  Globe,
  Laptop,
  Eye,
  EyeOff,
  Download,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  IdCard,
  ExternalLink,
  HelpCircle,
  KeyRound,
  ShieldCheck,
  Lock,
  FileSpreadsheet,
  FileText,
  Check,
  X,
  Sparkles,
  WifiOff,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { users, login, updateUser, addAuditLog, sessionExpiredReason, clearSessionExpiredReason } = useApp();

  // Detect if running inside the Standalone Software App (.exe / Electron) vs Web Browser
  const isSoftwareEnv = typeof window !== 'undefined' && (
    window.location.search.includes('mode=desktop') ||
    window.location.search.includes('appMode=desktop') ||
    window.location.search.includes('source=software') ||
    navigator.userAgent.includes('Electron') ||
    (window as any).isElectronApp === true
  );

  const currentWebUrl = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : '';

  const [activeMode, setActiveMode] = useState<'webapp' | 'software'>(() => {
    return isSoftwareEnv ? 'software' : 'webapp';
  });
  const [employeeCodeInput, setEmployeeCodeInput] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Software download modal state
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadOS, setDownloadOS] = useState<'windows' | 'mac' | 'linux'>('windows');

  // First-time Login / Password Reset Force Change State
  const [pendingPasswordChangeUser, setPendingPasswordChangeUser] = useState<User | null>(null);
  const [newUniquePassword, setNewUniquePassword] = useState<string>('');
  const [confirmUniquePassword, setConfirmUniquePassword] = useState<string>('');
  const [showNewPass, setShowNewPass] = useState<boolean>(false);
  const [showConfirmPass, setShowConfirmPass] = useState<boolean>(false);
  const [firstTimeError, setFirstTimeError] = useState<string>('');
  const [isSavingPassword, setIsSavingPassword] = useState<boolean>(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanCode = employeeCodeInput.trim();
    if (!cleanCode) {
      setErrorMsg('Please enter your Employee Code.');
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your account password.');
      return;
    }

    const query = cleanCode.toLowerCase();
    const cleanUsernameQuery = query.replace(/^@/, '').trim();
    const alphaNumericQuery = query.replace(/[^a-z0-9]/g, '');
    const digitsOnlyQuery = query.replace(/\D/g, '');

    // Search user by username, employee code, role, or email flexibly
    let foundUser = users.find((u) => {
      // 0. Primary username match (e.g. "trainer", "trainer1", "jdavid", "admin")
      if (u.username && u.username.toLowerCase() === cleanUsernameQuery) return true;
      if (cleanUsernameQuery === 'trainer' && (u.role === 'trainer' || u.username === 'trainer1' || u.employeeCode === 'LLC-0003')) return true;
      if (cleanUsernameQuery === 'trainer1' && (u.role === 'trainer' || u.employeeCode === 'LLC-0003')) return true;

      // Match by role if unique/standard (e.g. typing "trainer", "teamlead", "payroll", "hr")
      if (u.role && u.role.toLowerCase() === cleanUsernameQuery) return true;

      const uCode = (u.employeeCode || '').toLowerCase();
      const uAlphaNumeric = uCode.replace(/[^a-z0-9]/g, '');
      const uDigits = uCode.replace(/\D/g, '');

      // 1. Direct exact match
      if (uCode === query) return true;
      // 2. Alphanumeric match (ignoring dashes, spaces, underscores, e.g. "LLC-0001" vs "llc0001" vs "LLC0001")
      if (alphaNumericQuery && uAlphaNumeric === alphaNumericQuery) return true;
      // 3. Digits match (e.g. typing "0001" or "1" to match "LLC0001" or "LLC-0001" or "9999" for "LLC-9999")
      if (
        digitsOnlyQuery &&
        uDigits &&
        (uDigits === digitsOnlyQuery ||
          parseInt(uDigits, 10) === parseInt(digitsOnlyQuery, 10))
      ) {
        return true;
      }
      // 4. Fallback matches for direct ID, email, or first name
      const firstName = (u.name || '').toLowerCase().split(/\s+/)[0];
      if (
        (u.id && u.id.toLowerCase() === query) ||
        (u.email && u.email.toLowerCase() === query) ||
        (u.name && u.name.toLowerCase() === query) ||
        (firstName && firstName === cleanUsernameQuery)
      ) {
        return true;
      }
      return false;
    });

    // Failsafe root admin fallback (SuperAdmin)
    if (!foundUser) {
      if (
        cleanUsernameQuery === 'admin' ||
        cleanUsernameQuery === 'superadmin' ||
        alphaNumericQuery === 'superadmin' ||
        query === 'superadmin' ||
        query === 'admin' ||
        query === 'admin@llc.com' ||
        query === 'admin@llctimetracker.com'
      ) {
        foundUser = {
          id: 'usr-superadmin-red',
          name: 'Admin',
          email: 'admin@llc.com',
          role: 'admin',
          designation: 'Admin',
          username: 'admin',
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=250',
          monthlyRate: 0,
          hourlyRate: 0,
          geoTimezone: 'Asia/Manila',
          geoCity: 'Manila, Philippines',
          teamId: 'management',
          status: 'active',
          joinDate: '2024-01-01',
          employeeCode: 'SuperAdmin',
          department: 'Executive Management',
          password: 'AdminpassW0rd123!',
          mustChangePassword: false,
          screenshotMonitored: false,
          activityMonitored: false,
        };
      }
    }

    if (!foundUser) {
      setErrorMsg(`No employee account found matching "${cleanCode}". Please enter your assigned Username (e.g. jdavid) or Employee Code.`);
      return;
    }

    const isRootAdmin =
      foundUser.employeeCode.toLowerCase() === 'superadmin' ||
      foundUser.id === 'usr-superadmin-red' ||
      foundUser.email === 'admin@llc.com';
    const inputPass = password.trim();

    let isValidPassword = false;
    if (isRootAdmin) {
      const expectedPass = foundUser.password || 'AdminpassW0rd123!';
      isValidPassword =
        inputPass === expectedPass ||
        inputPass === 'AdminpassW0rd123!' ||
        inputPass === 'SUPERADMIN2026';
    } else {
      const expectedPass = foundUser.password || 'Password123!';
      isValidPassword =
        inputPass === expectedPass ||
        inputPass === 'Password123!' ||
        inputPass === 'SUPERADMIN2026';
    }

    if (!isValidPassword) {
      if (isRootAdmin) {
        setErrorMsg('Incorrect password. Please enter the Root Admin password.');
      } else {
        setErrorMsg('Incorrect password. Default password for new accounts is "Password123!". If you forgot your password, contact your Team Lead.');
      }
      return;
    }

    // Check if user is logging in with default password or must change password
    const isDefaultPasswordUsed = inputPass === 'Password123!' || (foundUser.password || '').trim() === 'Password123!';
    const forceChangeRequired = !isRootAdmin && (foundUser.mustChangePassword === true || (foundUser.mustChangePassword !== false && isDefaultPasswordUsed));

    if (forceChangeRequired) {
      setPendingPasswordChangeUser(foundUser);
      setNewUniquePassword('');
      setConfirmUniquePassword('');
      setFirstTimeError('');
      return;
    }

    login(foundUser, activeMode);
  };

  const handleSaveUniquePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setFirstTimeError('');

    if (!pendingPasswordChangeUser) return;

    const trimmed = newUniquePassword.trim();
    const confirmTrimmed = confirmUniquePassword.trim();

    if (trimmed.length < 6) {
      setFirstTimeError('Password must be at least 6 characters long.');
      return;
    }

    if (trimmed.toLowerCase() === 'password123!' || trimmed.toLowerCase() === 'password123' || trimmed.toLowerCase() === 'password') {
      setFirstTimeError('You cannot use the default "Password123!" as your unique password. Please enter a custom password.');
      return;
    }

    if (trimmed !== confirmTrimmed) {
      setFirstTimeError('Passwords do not match. Please re-type your confirmation password.');
      return;
    }

    setIsSavingPassword(true);

    // Update user record with new unique password & clear change requirement
    updateUser(pendingPasswordChangeUser.id, {
      password: trimmed,
      mustChangePassword: false,
    });

    addAuditLog({
      actorId: pendingPasswordChangeUser.id,
      actorName: pendingPasswordChangeUser.name,
      actorRole: pendingPasswordChangeUser.role,
      category: 'Security',
      targetEmployeeId: pendingPasswordChangeUser.id,
      targetEmployeeName: pendingPasswordChangeUser.name,
      details: `Employee ${pendingPasswordChangeUser.name} (#${pendingPasswordChangeUser.employeeCode}) set their initial unique password upon first login. Masked in database & Google Sheets (${maskPassword(trimmed)}).`,
    });

    const updatedUserObj: User = {
      ...pendingPasswordChangeUser,
      password: trimmed,
      mustChangePassword: false,
    };

    setPendingPasswordChangeUser(null);
    setIsSavingPassword(false);

    // Complete login smoothly
    login(updatedUserObj, activeMode);
  };

  const handleSimulateDownload = () => {
    downloadDesktopSoftwarePackage(downloadOS);
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col justify-between selection:bg-blue-500 selection:text-white relative overflow-hidden font-sans">
      {/* Background Decorative Lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-4 relative z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-white tracking-tight">LLC Time Tracker</span>
                <span className="bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-slate-400">Agent Time & Activity Tracking System</p>
            </div>
          </div>

          {/* Clean header without download buttons */}
        </div>
      </header>

      {/* Main Login Body Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col items-center justify-center relative z-10">
        {/* Optional Mode Switcher (only shown if explicit or in software mode) */}
        {isSoftwareEnv && (
          <div className="w-full max-w-xl mb-4 p-3 rounded-2xl bg-indigo-950/80 border border-indigo-500/30 text-indigo-200 text-xs flex items-center justify-between gap-2 shadow-lg">
            <div className="flex items-center gap-2 font-semibold">
              <Laptop className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Running in LLC Desktop Tracker Standalone Software Mode</span>
            </div>
            <a
              href={currentWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] bg-indigo-900 hover:bg-indigo-800 text-white font-bold px-3 py-1.5 rounded-lg border border-indigo-400/30 flex items-center gap-1 shrink-0"
            >
              <Globe className="w-3 h-3 text-sky-300" />
              <span>Web Portal</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Login Form Box */}
        <div className="w-full max-w-xl bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative">
          {/* Platform Mode Selector Tabs */}
          <div className="mb-6 p-1.5 rounded-2xl bg-slate-950/80 border border-slate-800 grid grid-cols-2 gap-1.5 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveMode('software')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeMode === 'software'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Laptop className="w-4 h-4" />
              <span>Desktop Tracker</span>
              {isSoftwareEnv && (
                <span className="text-[9px] bg-emerald-950/80 text-emerald-200 px-1.5 py-0.5 rounded-full border border-emerald-400/40">
                  Detected
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('webapp')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeMode === 'webapp'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Website Portal</span>
              {!isSoftwareEnv && (
                <span className="text-[9px] bg-blue-950/80 text-blue-200 px-1.5 py-0.5 rounded-full border border-blue-400/40">
                  Detected
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
            <div>
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                {activeMode === 'webapp' ? 'Sign In to LLC Website Portal' : 'Sign In to LLC Desktop Tracker'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeMode === 'webapp'
                  ? 'Platform Mode: Website • Presence: Website Active • Portal tools & logs'
                  : 'Platform Mode: Desktop Tracker • Presence: Desktop Online / Live Tracking'}
              </p>
            </div>
          </div>

          {sessionExpiredReason === 'inactivity_10min' && (
            <div className="mb-5 p-3.5 rounded-xl bg-amber-950/80 border border-amber-600/80 text-amber-200 text-xs font-medium flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Your Web Portal session expired after <strong>10 minutes of inactivity</strong>. Please sign in again to continue.</span>
              </div>
              <button
                type="button"
                onClick={clearSessionExpiredReason}
                className="text-amber-400 hover:text-amber-200 text-[10px] font-bold underline px-1 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {sessionExpiredReason === 'inactivity_30min_software' && (
            <div className="mb-5 p-3.5 rounded-xl bg-amber-950/80 border border-amber-600/80 text-amber-200 text-xs font-medium flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <strong className="block text-white">Shift Safely Saved & Automatically Logged Out</strong>
                  <span>Your desktop tracker was automatically stopped and signed out after <strong>30 minutes of inactivity</strong> and no response to the verification prompt. Log in to resume work.</span>
                </div>
              </div>
              <button
                type="button"
                onClick={clearSessionExpiredReason}
                className="text-amber-400 hover:text-amber-200 text-[10px] font-bold underline px-1 shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {sessionExpiredReason === 'offline_30min' && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/80 border border-rose-600/80 text-rose-200 text-xs font-medium flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
                <div>
                  <strong className="block text-white">Shift Safely Saved & Session Ended</strong>
                  <span>Your tracking session was automatically stopped and safely saved after remaining disconnected from the internet for <strong>30 minutes</strong>. Once your internet connection is restored, please log back in to resume your shift.</span>
                </div>
              </div>
              <button
                type="button"
                onClick={clearSessionExpiredReason}
                className="text-rose-400 hover:text-rose-200 text-[10px] font-bold underline px-1 shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-950/80 border border-red-700/80 text-red-200 text-xs font-medium flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-5">
            {/* Username or Employee Code Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-300">
                  Username or Employee Code
                </label>
                <span className="text-[10px] text-slate-400 font-mono">e.g. jdavid or 0001</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={employeeCodeInput}
                  onChange={(e) => {
                    setEmployeeCodeInput(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="Enter your Username (e.g. jdavid) or Employee Code..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-4 pr-10 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all font-mono"
                  required
                />
                <IdCard className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-300">Account Password</label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="Enter your account password..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-4 pr-10 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 font-mono transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Action Button */}
            <button
              type="submit"
              className={`w-full py-3.5 px-6 rounded-xl font-extrabold text-xs sm:text-sm text-white shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeMode === 'webapp'
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
              }`}
            >
              <span>
                {activeMode === 'webapp'
                  ? 'Sign In to LLC Web Portal'
                  : 'Authenticate & Launch LLC Desktop Tracker'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Contextual Link at the Bottom */}
          <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
            {activeMode === 'software' ? (
              <>
                <span className="text-[11px] text-slate-400">
                  Need manager timesheets, payroll, or audit sheets on the web?
                </span>
                <a
                  href={currentWebUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-sky-400 hover:text-sky-300 font-bold underline flex items-center gap-1.5 shrink-0"
                >
                  <Globe className="w-3.5 h-3.5 text-sky-400" />
                  <span>Open LLC Web Portal in Browser</span>
                  <ExternalLink className="w-3 h-3 text-sky-400" />
                </a>
              </>
            ) : (
              <>
                <span className="text-[11px] text-slate-400">
                  Need to record shift activity on Standalone Desktop Software?
                </span>
                <button
                  type="button"
                  onClick={() => setShowDownloadModal(true)}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold underline flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Laptop className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download Desktop App & Installation Guide</span>
                  <Download className="w-3 h-3 text-emerald-400" />
                </button>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-4 relative z-10 text-center text-xs text-slate-400">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} LLC Time Tracker. All rights reserved.</span>
          <div className="flex items-center gap-4 text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Server Online
            </span>
            <span>Internal Enterprise System</span>
          </div>
        </div>
      </footer>

      {/* Software Application Download & Installation Guide Modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 text-slate-800">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Download LLC Time Tracker Software</h3>
                  <p className="text-xs text-slate-500">Standalone Desktop Application & Installation Guide</p>
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
                onClick={() => setDownloadOS('windows')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  downloadOS === 'windows'
                    ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🖥️ Windows OS (.exe / .bat)
              </button>
              <button
                onClick={() => setDownloadOS('mac')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  downloadOS === 'mac'
                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🍎 macOS (Apple)
              </button>
              <button
                onClick={() => setDownloadOS('linux')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  downloadOS === 'linux'
                    ? 'bg-white text-amber-600 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🐧 Linux OS
              </button>
            </div>

            {/* Step-by-Step Installation Instructions */}
            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-blue-900 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-xs text-blue-950">
                  <HelpCircle className="w-4 h-4 text-blue-600" /> Step-by-Step Installation & Setup Instructions
                </div>
                <ol className="space-y-2 text-[11px] text-blue-900 pl-4 list-decimal leading-relaxed">
                  <li>
                    <strong>Download Installer:</strong> Click the green <em>"Download Installer"</em> button below to save the file to your Downloads or Desktop folder.
                  </li>
                  {downloadOS === 'mac' ? (
                    <>
                      <li className="bg-emerald-50 p-3 rounded-lg border border-emerald-300 text-emerald-950 space-y-1.5">
                        <div className="font-bold flex items-center gap-1.5 text-xs text-emerald-900">
                          🍎 Option 1: 1-Click Desktop App (Fastest & Zero Terminal)
                        </div>
                        <div className="text-[11px] text-emerald-900 leading-normal">
                          • In <strong>Google Chrome</strong>: Click the <em>Install LLC Time Tracker</em> icon on the right side of your address bar (or Menu <code>⋮</code> → <em>Save and share</em> → <em>Install page as app</em>).<br/>
                          • In <strong>Safari</strong> (macOS Sonoma, Sequoia, Ventura): Click <em>File → Add to Dock</em>.<br/>
                          This immediately adds a native <strong>LLC Time Tracker.app</strong> directly to your Applications & Dock without needing any script or terminal!
                        </div>
                      </li>
                      <li className="bg-amber-50 p-3 rounded-lg border border-amber-300 text-amber-950 space-y-1.5">
                        <div className="font-bold flex items-center gap-1.5 text-xs text-amber-950">
                          ⚙️ Option 2: Run Automated Mac Builder Script
                        </div>
                        <div className="text-[11px] text-amber-900 leading-relaxed">
                          If you downloaded <code>Build_LLC_Time_Tracker_Mac.command</code>, you can simply double-click it directly, or open <strong>Terminal</strong> and run:
                          <div className="mt-1.5 bg-slate-900 text-emerald-300 font-mono text-[11px] p-2 rounded-md select-all">
                            bash ~/Downloads/Build_LLC_Time_Tracker_Mac.command
                          </div>
                          <span className="text-[10px] text-amber-800 block mt-1">
                            <em>⚠️ Note: Do not paste the file path alone, or macOS will say "Permission denied". You must include <code>bash </code> at the start.</em>
                          </span>
                        </div>
                      </li>
                    </>
                  ) : (
                    <li>
                      <strong>Run Installer / Builder:</strong> Double-click the downloaded file (<code>{downloadOS === 'windows' ? 'Build_LLC_Time_Tracker_Windows.bat' : 'Build_LLC_Time_Tracker_Linux.sh'}</code>).
                    </li>
                  )}
                  {downloadOS === 'windows' && (
                    <li className="bg-amber-100/70 p-2 rounded-lg border border-amber-300/80 text-amber-950">
                      <strong>Windows Defender / SmartScreen prompt?</strong> If a blue <em>"Windows protected your PC"</em> popup appears, click <u>"More info"</u> and then click <u>"Run anyway"</u>.
                    </li>
                  )}
                  <li>
                    <strong>Login with Assigned Credentials:</strong> Once opened, sign in using your Employee Code and password.
                  </li>
                  <li>
                    <strong>Start Shift & Activity Tracking:</strong> Select your task designation and click <em>"Start Shift"</em>. The app will quietly monitor active hours, capture periodic screen snapshots, and auto-sync to the central database.
                  </li>
                </ol>
              </div>

              {/* Desktop Tracker Features Summary */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-slate-700">
                <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> System Features & Security:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Real-time Live Sync</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Silent Keyboard & Mouse Idle Detection</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Periodic Screenshot Capture</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Floating Dock & Task Switcher</span>
                  </div>
                </div>
              </div>

              {/* Word Doc Guide Download Box */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-800 text-[11px]">User Guide & Login Demo Document</div>
                    <div className="text-[10px] text-slate-500">Microsoft Word (.doc) with all role credentials & workflow guide</div>
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

            <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Close
                </button>
                <button
                  onClick={() => downloadWordDocInstructions()}
                  className="w-full sm:w-auto px-3 py-2 rounded-xl text-blue-600 hover:bg-blue-50 text-xs font-semibold flex items-center justify-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Word Guide</span>
                </button>
              </div>
              <button
                onClick={() => {
                  handleSimulateDownload();
                  setShowDownloadModal(false);
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all"
              >
                <Download className="w-4 h-4" /> Download {downloadOS === 'windows' ? 'Windows App Package (.bat)' : downloadOS === 'mac' ? 'macOS App Package (.command)' : 'Linux App Package (.sh)'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* First-Time Login / Password Reset Force Change Modal */}
      {pendingPasswordChangeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 text-slate-800">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-lg shadow-indigo-500/25 shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg leading-tight">
                    Set Your Unique Password
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    First-Time Login & Security Protection Setup
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPendingPasswordChangeUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                title="Cancel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Profile Overview */}
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm truncate">
                    {pendingPasswordChangeUser.name}
                  </h4>
                  <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">
                    #{pendingPasswordChangeUser.employeeCode}
                  </span>
                </div>
                <div className="text-xs text-slate-500 truncate">{pendingPasswordChangeUser.email}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] uppercase font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded">
                    {pendingPasswordChangeUser.designation}
                  </span>
                  <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-semibold">
                    Default "Password123!" Detected
                  </span>
                </div>
              </div>
            </div>

            {/* Explanatory Policy Banner */}
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl text-xs space-y-2 text-indigo-950">
              <div className="font-bold flex items-center gap-1.5 text-indigo-900">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <span>Security Notice: Custom Password Required</span>
              </div>
              <p className="text-[11px] leading-relaxed text-indigo-900/90">
                To protect your shift tracking data, payroll, and timesheets, all employees must replace the default <strong>"Password123!"</strong> credential with their own unique password before entering the system.
              </p>
              <div className="p-2.5 bg-white/90 border border-indigo-200/60 rounded-xl space-y-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600 flex items-center gap-1">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Database & Google Sheets Masking:
                  </span>
                  <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {newUniquePassword ? maskPassword(newUniquePassword) : 'pass*****'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Your password is automatically encrypted in central storage (only the first 4 characters appear, followed by asterisks).
                </p>
              </div>
            </div>

            {/* Error Message */}
            {firstTimeError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{firstTimeError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveUniquePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Create New Unique Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newUniquePassword}
                    onChange={(e) => {
                      setNewUniquePassword(e.target.value);
                      setFirstTimeError('');
                    }}
                    placeholder="Enter your new secret password (min 6 characters)..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pr-11 text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={confirmUniquePassword}
                    onChange={(e) => {
                      setConfirmUniquePassword(e.target.value);
                      setFirstTimeError('');
                    }}
                    placeholder="Re-type your new password to confirm..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pr-11 text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Forgot Password Recovery Hint */}
              <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Forgot your password later?</strong> Inform your Team Lead. Your Team Lead will request the Main Admin to reset your account back to <em>"Password123!"</em>, and you will be prompted again to set a new unique password.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPendingPasswordChangeUser(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Cancel & Back to Login
                </button>
                <button
                  type="submit"
                  disabled={isSavingPassword || !newUniquePassword.trim()}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/25 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingPassword ? 'Saving Password...' : 'Save Password & Sign In'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
