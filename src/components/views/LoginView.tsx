import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User } from '../../types';
import { maskPassword, updatePasswordInGoogleSheets, authenticateEmployeeWithGoogleSheets } from '../../lib/googleSheetsSync';
import { downloadWordDocInstructions } from '../../lib/docGenerator';
import { downloadDesktopSoftwarePackage } from '../../lib/desktopDownloader';
import { resolveCanonicalEmployee } from '../../lib/userUtils';
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
  AlertTriangle,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const {
  users,
  setUsers,
  login,
  updateUser,
  addAuditLog,
  sessionExpiredReason,
  clearSessionExpiredReason,
  isFirestoreLoaded,
} = useApp();

  // Detect if running inside the Standalone Software App (.exe / Electron / .bat) vs Web Browser
  const isSoftwareEnv = typeof window !== 'undefined' && (
    window.location.search.includes('mode=desktop') ||
    window.location.search.includes('appMode=desktop') ||
    window.location.search.includes('source=software') ||
    window.location.search.includes('mode=software') ||
    navigator.userAgent.includes('Electron') ||
    (window as any).isElectronApp === true ||
    Boolean((window as any).electronAPI)
  );

  const currentWebUrl = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : '';

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
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [retryNotice, setRetryNotice] = useState<string>('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanCode = employeeCodeInput.trim();
    if (!cleanCode) {
      setErrorMsg('Please enter your Username or Employee Code.');
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
    const inputPass = password.trim();

    // 1. Gather all available user records from memory & localStorage
    const authUsers = (() => {
      try {
        const cached = localStorage.getItem('trackpulse_users');
        const parsed = cached ? JSON.parse(cached) : null;
        // Place parsed (local updates with customized passwords) after users so custom passwords take precedence
        const combined = [...users, ...(Array.isArray(parsed) ? parsed : [])];
        const map = new Map<string, User>();
        for (const u of combined) {
          if (u && u.id) {
            const existing = map.get(u.id);
            // If existing has a customized password (not Password123!), keep it
            if (existing && existing.password && existing.password !== 'Password123!' && u.password === 'Password123!') {
              map.set(u.id, { ...u, password: existing.password, mustChangePassword: existing.mustChangePassword });
            } else {
              map.set(u.id, u);
            }
          }
        }
        return Array.from(map.values());
      } catch {
        return users;
      }
    })();

    // 2. Search for matching user in existing state
    let foundUser: User | undefined = authUsers.find((u) => {
      if (u.username && u.username.toLowerCase() === cleanUsernameQuery) return true;
      if (cleanUsernameQuery === 'trainer' && (u.role === 'trainer' || u.username === 'trainer1' || u.employeeCode === 'LLC-0003')) return true;
      if (cleanUsernameQuery === 'trainer1' && (u.role === 'trainer' || u.employeeCode === 'LLC-0003')) return true;
      if (u.role && u.role.toLowerCase() === cleanUsernameQuery) return true;

      const uCode = (u.employeeCode || '').toLowerCase();
      const uAlphaNumeric = uCode.replace(/[^a-z0-9]/g, '');
      const uDigits = uCode.replace(/\D/g, '');

      if (uCode === query) return true;
      if (alphaNumericQuery && uAlphaNumeric === alphaNumericQuery) return true;
      if (
        digitsOnlyQuery &&
        uDigits &&
        (uDigits === digitsOnlyQuery || parseInt(uDigits, 10) === parseInt(digitsOnlyQuery, 10))
      ) {
        return true;
      }

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

    // 3. If not found in memory, look up canonical directory
    if (!foundUser) {
      const canonical = resolveCanonicalEmployee({
        employeeCode: cleanCode,
        username: cleanCode,
        name: cleanCode,
        email: cleanCode,
        id: cleanCode,
      });

      if (canonical) {
        const existingAuth = authUsers.find(
          (u) =>
            (u.employeeCode && u.employeeCode.toUpperCase() === canonical.code.toUpperCase()) ||
            (u.username && u.username.toLowerCase() === canonical.username.toLowerCase()) ||
            u.id === `usr-${canonical.code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
        );
        foundUser = {
          id: existingAuth?.id || `usr-${canonical.code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          name: canonical.name,
          email: canonical.email,
          role: canonical.role,
          designation: canonical.designation,
          username: canonical.username,
          employeeCode: canonical.code,
          department: existingAuth?.department || 'Operations',
          password: existingAuth?.password || 'Password123!',
          mustChangePassword: existingAuth ? existingAuth.mustChangePassword : (canonical.role !== 'admin'),
          monthlyRate: existingAuth?.monthlyRate || 0,
          hourlyRate: existingAuth?.hourlyRate || 0,
          geoTimezone: 'Asia/Manila',
          geoCity: 'Manila, Philippines',
          teamId: existingAuth?.teamId || 'management',
          status: 'active',
          joinDate: existingAuth?.joinDate || new Date().toISOString().slice(0, 10),
          avatar: existingAuth?.avatar || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250`,
        };
        setUsers((prev) => [...prev.filter((u) => u.id !== foundUser!.id), foundUser!]);
      }
    }

    // 4. SuperAdmin fallback
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

    const isRootAdmin =
      foundUser &&
      (foundUser.employeeCode?.toLowerCase() === 'superadmin' ||
        foundUser.id === 'usr-superadmin-red' ||
        foundUser.id === 'usr-superadmin-root' ||
        foundUser.email?.toLowerCase() === 'admin@llc.com' ||
        foundUser.role === 'admin');

    const resolvedMode: 'webapp' | 'software' = isSoftwareEnv ? 'software' : 'webapp';

    // Check emergency root admin override password
    if (isRootAdmin && (inputPass === 'AdminpassW0rd123!' || inputPass === 'AdminpassWord123!' || inputPass === 'SUPERADMIN2026')) {
      login(foundUser!, resolvedMode);
      return;
    }

    setIsAuthenticating(true);

    try {
      // 5. Authoritatively authenticate against the Live Google Apps Script (Employee_Directory / Employee_Auth)
      const liveAuth = await authenticateEmployeeWithGoogleSheets(cleanCode, inputPass);

      if (liveAuth.success && liveAuth.valid) {
        // Authenticated successfully against Live Google Apps Script!
        const serverUser = liveAuth.user || {};
        const effectiveUser: User = {
          ...(foundUser || {
            id: serverUser.id || `usr-${cleanCode}`,
            name: serverUser.name || cleanCode,
            email: serverUser.email || '',
            role: serverUser.role || 'agent',
            designation: serverUser.designation || 'Agent',
            username: serverUser.username || cleanCode,
            employeeCode: serverUser.employeeCode || cleanCode,
            department: serverUser.department || 'Operations',
            monthlyRate: serverUser.monthlyRate || 0,
            hourlyRate: serverUser.hourlyRate || 0,
            geoTimezone: 'Asia/Manila',
            geoCity: 'Manila, Philippines',
            teamId: 'management',
            status: 'active',
            joinDate: serverUser.joinDate || new Date().toISOString().slice(0, 10),
            avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250`,
          }),
          ...serverUser,
          password: inputPass,
          mustChangePassword: liveAuth.mustChangePassword === true,
        };

        // Cache updated user with verified personal password locally so future sessions remember it
        try {
          const cached = localStorage.getItem('trackpulse_users');
          const list = cached ? JSON.parse(cached) : [];
          const updated = Array.isArray(list) ? list.filter((u: any) => u.id !== effectiveUser.id) : [];
          updated.push(effectiveUser);
          localStorage.setItem('trackpulse_users', JSON.stringify(updated));
        } catch {}

        setUsers((prev) => [...prev.filter((u) => u.id !== effectiveUser.id), effectiveUser]);

        // Check if user must change password (e.g. first login with Password123!)
        if (liveAuth.mustChangePassword === true) {
          setPendingPasswordChangeUser(effectiveUser);
          setNewUniquePassword('');
          setConfirmUniquePassword('');
          setFirstTimeError('');
          setIsAuthenticating(false);
          return;
        }

        // Successfully authenticated with personal password! Log in!
        setIsAuthenticating(false);
        login(effectiveUser, resolvedMode);
        return;
      }

      // If live auth returned invalid credentials, user not found, or inactive account
      if (liveAuth.code === 'INVALID_CREDENTIALS') {
        setIsAuthenticating(false);
        setErrorMsg('Incorrect password. Default password for new accounts is "Password123!". If you previously changed your password, please use your personal password. If you forgot your password, contact your Team Lead.');
        return;
      }

      if (liveAuth.code === 'USER_NOT_FOUND') {
        setIsAuthenticating(false);
        setErrorMsg(`No employee account found matching "${cleanCode}". Please verify your username or employee code.`);
        return;
      }

      if (liveAuth.code === 'ACCOUNT_INACTIVE') {
        setIsAuthenticating(false);
        setErrorMsg(liveAuth.message || 'Account is inactive. Please contact your Team Lead or HR.');
        return;
      }

      // If live auth returned an error message, display it
      setIsAuthenticating(false);
      setErrorMsg(liveAuth.message || liveAuth.error || 'Authentication failed. Please verify your credentials.');
    } catch (err: any) {
      setIsAuthenticating(false);
      setErrorMsg(err?.message || 'Authentication service unavailable. Please check your connection and retry.');
    }
  };

  const handleSaveUniquePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFirstTimeError('');
    setRetryNotice('');

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

    try {
      // 1. Dispatch UPDATE_PASSWORD to Live Google Apps Script endpoint with automatic retry if server is busy
      const updateResult = await updatePasswordInGoogleSheets(
        pendingPasswordChangeUser,
        trimmed,
        undefined,
        'UPDATE_PASSWORD',
        (attempt, max) => {
          setRetryNotice(`Server is busy processing requests, retrying securely... (attempt ${attempt}/${max})`);
        }
      );

      if (!updateResult.success || !updateResult.verified) {
        setFirstTimeError(
          updateResult.message || updateResult.error || 'Password update could not be verified by server. Please try again.'
        );
        return; // DO NOT proceed or clear state unless backend confirms status === "SUCCESS" and verified === true
      }

      // 2. Server confirmed update & verification in Employee_Directory!
      updateUser(pendingPasswordChangeUser.id, {
        password: trimmed,
        mustChangePassword: false,
      });

      // Update persistent user cache
      try {
        const cached = localStorage.getItem('trackpulse_users');
        const list = cached ? JSON.parse(cached) : [];
        const updated = Array.isArray(list) ? list.filter((u: any) => u.id !== pendingPasswordChangeUser.id) : [];
        updated.push({
          ...pendingPasswordChangeUser,
          password: trimmed,
          mustChangePassword: false,
        });
        localStorage.setItem('trackpulse_users', JSON.stringify(updated));
      } catch {}

      addAuditLog({
        actorId: pendingPasswordChangeUser.id,
        actorName: pendingPasswordChangeUser.name,
        actorRole: pendingPasswordChangeUser.role,
        category: 'Security',
        targetEmployeeId: pendingPasswordChangeUser.id,
        targetEmployeeName: pendingPasswordChangeUser.name,
        details: `Employee ${pendingPasswordChangeUser.name} (#${pendingPasswordChangeUser.employeeCode}) successfully set and verified their initial unique password upon first login in Employee_Directory.`,
      });

      const updatedUserObj: User = {
        ...pendingPasswordChangeUser,
        password: trimmed,
        mustChangePassword: false,
      };

      setPendingPasswordChangeUser(null);

      // 3. Complete login smoothly
      const resolvedMode: 'webapp' | 'software' = isSoftwareEnv ? 'software' : 'webapp';
      login(updatedUserObj, resolvedMode);
    } catch (err: any) {
      setFirstTimeError(err?.message || 'An unexpected error occurred while updating your password.');
    } finally {
      setIsSavingPassword(false);
      setRetryNotice('');
    }
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
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-xl relative">
          <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {isSoftwareEnv ? (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Laptop className="w-3 h-3 text-emerald-400" />
                    DESKTOP TRACKER SOFTWARE
                  </span>
                ) : (
                  <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Globe className="w-3 h-3 text-blue-400" />
                    WEBSITE DASHBOARD PORTAL
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                {isSoftwareEnv ? 'Sign In to LLC Desktop Tracker' : 'Sign In to LLC Website Dashboard'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isSoftwareEnv
                  ? 'Desktop Client: Sign in to clock in, pick your task, and track live activity.'
                  : 'Website Portal: Sign in to view live dashboards, team logs, and timesheets.'}
              </p>
            </div>
          </div>

          {sessionExpiredReason === 'inactivity_10min' && (
            <div className="mb-4 p-3 rounded-xl bg-amber-950/80 border border-amber-600/80 text-amber-200 text-xs font-medium flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Session expired after <strong>10m of inactivity</strong>. Please sign in again.</span>
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
            <div className="mb-4 p-3 rounded-xl bg-amber-950/80 border border-amber-600/80 text-amber-200 text-xs font-medium flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Desktop stopped after <strong>30m inactivity</strong>. Log in to resume.</span>
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
            <div className="mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-600/80 text-rose-200 text-xs font-medium flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Tracking stopped after <strong>30m offline</strong>. Log back in to resume shift.</span>
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
            <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-700/80 text-red-200 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {/* Username or Employee Code Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Username or Employee Code
                </label>
                <span className="text-[10px] text-slate-400 font-mono">e.g. jdavid or LLC-0004</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={employeeCodeInput}
                  onChange={(e) => {
                    setEmployeeCodeInput(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="Enter Username or Employee Code..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-3.5 pr-9 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all font-mono"
                  required
                />
                <IdCard className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
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
                  placeholder="Enter your password..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-3.5 pr-9 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 font-mono transition-all"
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
              disabled={isAuthenticating}
              className={`w-full py-3 px-5 rounded-xl font-extrabold text-xs sm:text-sm text-white shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 ${
                isSoftwareEnv
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-700/30'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
              }`}
            >
              <span>
                {isAuthenticating
                  ? 'Authenticating with Live Database...'
                  : isSoftwareEnv
                  ? 'Sign In to Time Tracker'
                  : 'Sign In to LLC Web Portal'}
              </span>
              {isAuthenticating ? (
                <Clock className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
            </button>
          </form>

          {/* Contextual Link at the Bottom */}
          <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
            {isSoftwareEnv ? (
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
                âœ•
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
                ðŸ–¥ï¸ Windows OS (.exe / .bat)
              </button>
              <button
                onClick={() => setDownloadOS('mac')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  downloadOS === 'mac'
                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ðŸŽ macOS (Apple)
              </button>
              <button
                onClick={() => setDownloadOS('linux')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  downloadOS === 'linux'
                    ? 'bg-white text-amber-600 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ðŸ§ Linux OS
              </button>
            </div>

            {/* Step-by-Step Installation Instructions */}
            <div className="space-y-3 text-xs">
              {/* Option 1: Instant Native Desktop Launcher (Recommended & Policy-Safe) */}
              <div className="p-4 rounded-xl border border-emerald-400 bg-emerald-50/80 hover:bg-emerald-50 transition-all space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-emerald-950 flex items-center gap-2">
                    <Download className="w-4 h-4 text-emerald-700" /> Option 1: Instant Native Desktop Launcher (100% Safe)
                  </span>
                  <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">
                    RECOMMENDED â€¢ 0-INSTALL
                  </span>
                </div>
                <p className="text-[11px] text-emerald-900 leading-relaxed">
                  {downloadOS === 'windows'
                    ? 'Launches in dedicated borderless desktop app window via Microsoft-signed Edge/Chrome runtime. 100% immune to Windows 11 Smart App Control & Application Control Policy blocks. Zero installation needed!'
                    : 'Launches standalone native desktop application window instantly with 0 setup.'}
                </p>
                <button
                  onClick={() => {
                    downloadDesktopSoftwarePackage(downloadOS, 'instant_launcher');
                    setShowDownloadModal(false);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99]"
                >
                  <Download className="w-4 h-4" /> Download Instant {downloadOS === 'windows' ? 'Windows Launcher (.bat)' : downloadOS === 'mac' ? 'Mac Launcher (.command)' : 'Linux Launcher (.sh)'}
                </button>
              </div>

              {/* Option 2: Electron Standalone Builder Package */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 transition-all space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-indigo-600" /> Option 2: Electron Standalone Builder Package
                  </span>
                  <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded">
                    .EXE BUILDER
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Packages the full standalone Node/Electron executable (<code>{downloadOS === 'windows' ? 'Build_LLC_Time_Tracker_Windows.bat' : downloadOS === 'mac' ? 'Build_LLC_Time_Tracker_Mac.command' : 'Build_LLC_Time_Tracker_Linux.sh'}</code>).
                </p>
                <button
                  onClick={() => {
                    downloadDesktopSoftwarePackage(downloadOS, 'electron_builder');
                    setShowDownloadModal(false);
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <Download className="w-3.5 h-3.5" /> Download Full Builder Package (.bat)
                </button>
              </div>

              {/* Windows Application Control / Smart App Control Troubleshooting */}
              {downloadOS === 'windows' && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-1 text-amber-950 text-[11px]">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" /> Getting "Application Control policy has blocked this file"?
                  </div>
                  <p className="leading-relaxed text-amber-900">
                    Windows 11 Smart App Control blocks unsigned shortcuts. <strong>Solution:</strong> Use <strong>Option 1 (Instant Launcher)</strong> above, or right-click the blocked file â†’ click <strong>Properties</strong> â†’ check the <strong>"Unblock"</strong> checkbox at the bottom â†’ click <strong>Apply</strong>.
                  </p>
                </div>
              )}

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
                  downloadDesktopSoftwarePackage(downloadOS, 'instant_launcher');
                  setShowDownloadModal(false);
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all"
              >
                <Download className="w-4 h-4" /> Download Instant Launcher
              </button>
            </div>
          </div>
        </div>
      )}
      {/* First-Time Login / Password Reset Force Change Modal */}
      {pendingPasswordChangeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-4 text-slate-800 overflow-y-auto">
          <div className="bg-white border border-slate-200/90 rounded-2xl max-w-[390px] w-full p-3.5 sm:p-4 shadow-2xl space-y-2.5 my-auto max-h-[90vh] overflow-y-auto animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-500/20 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight">
                    Set Your Unique Password
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Replace default password to secure account
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingPasswordChangeUser(null);
                  setRetryNotice('');
                  setFirstTimeError('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* User Profile Overview */}
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center justify-between text-xs">
              <div className="min-w-0 pr-2">
                <div className="font-bold text-slate-900 text-xs truncate">
                  {pendingPasswordChangeUser.name}{' '}
                  <span className="font-normal text-slate-500">
                    (@{pendingPasswordChangeUser.username || pendingPasswordChangeUser.employeeCode})
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  {pendingPasswordChangeUser.designation} • {pendingPasswordChangeUser.email || 'LLC Operations'}
                </div>
              </div>
              <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md shrink-0">
                #{pendingPasswordChangeUser.employeeCode}
              </span>
            </div>

            {/* Compact Policy Notice */}
            <div className="p-2.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-[11px] text-indigo-950 flex items-start gap-2">
              <KeyRound className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
              <p className="leading-snug text-indigo-900/90 text-[11px]">
                To protect timesheets and payroll, replace default <strong>"Password123!"</strong> with your personal unique password.
              </p>
            </div>

            {/* Retry Notice / Error Message */}
            {retryNotice && !firstTimeError && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0 animate-spin" />
                <span>{retryNotice}</span>
              </div>
            )}
            {firstTimeError && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span>{firstTimeError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveUniquePassword} className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  New Unique Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newUniquePassword}
                    onChange={(e) => {
                      setNewUniquePassword(e.target.value);
                      setFirstTimeError('');
                    }}
                    placeholder="Min 6 characters..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 pr-9 text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={confirmUniquePassword}
                    onChange={(e) => {
                      setConfirmUniquePassword(e.target.value);
                      setFirstTimeError('');
                    }}
                    placeholder="Re-type password..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 pr-9 text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Forgot Password Recovery Hint */}
              <div className="p-2 bg-amber-50/70 border border-amber-200/70 rounded-lg text-[10px] text-amber-900 flex items-start gap-1.5">
                <HelpCircle className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Tip:</strong> If forgotten later, Team Leads can request an Admin reset back to <em>"Password123!"</em>.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setPendingPasswordChangeUser(null);
                    setRetryNotice('');
                    setFirstTimeError('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPassword || !newUniquePassword.trim()}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm shadow-indigo-500/25 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSavingPassword ? (retryNotice ? 'Retrying...' : 'Saving...') : 'Save & Sign In'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
