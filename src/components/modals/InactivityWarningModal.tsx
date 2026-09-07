import React from 'react';
import { useApp } from '../../context/AppContext';
import { Clock, AlertTriangle, CheckCircle2, LogOut, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const InactivityWarningModal: React.FC = () => {
  const {
    isAuthenticated,
    loginMode,
    currentTask,
    isSessionWarningActive,
    webSessionWarningCountdown,
    refreshWebSession,
    logout,
  } = useApp();

  if (!isAuthenticated || !isSessionWarningActive) {
    return null;
  }

  const isSoftware = loginMode === 'software';
  const minutes = Math.floor(webSessionWarningCountdown / 60);
  const seconds = webSessionWarningCountdown % 60;
  const formattedCountdown = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  // Progress percentage (from 300 down to 0)
  const percentRemaining = Math.max(0, Math.min(100, (webSessionWarningCountdown / 300) * 100));

  return (
    <AnimatePresence>
      <div
        id="inactivity-warning-modal"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-fade-in"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          className="bg-slate-900 border-2 border-amber-500/80 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl text-white relative overflow-hidden"
        >
          {/* Top subtle glow banner */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 animate-pulse" />

          {/* Header Icon & Title */}
          <div className="flex items-start gap-4 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400 shadow-inner">
              <AlertTriangle className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg text-white">
                  {isSoftware ? 'Are you still there?' : 'Inactivity Alert'}
                </h3>
                <span className="bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {isSoftware ? '30 Min Inactivity Check' : '5 Min Idle'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {isSoftware
                  ? `No mouse or keyboard activity detected for 30 minutes. Are you still working on ${currentTask || 'your shift'}?`
                  : 'No activity detected on this web portal session for 5 minutes.'}
              </p>
            </div>
          </div>

          {/* Big Visual Countdown Card */}
          <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-5 my-4 text-center space-y-2.5 relative">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{isSoftware ? 'Auto-Logout & Timesheet Save In' : 'Web Session Auto-Logout In'}</span>
            </p>

            <div className="text-4xl sm:text-5xl font-extrabold font-mono text-amber-400 tracking-tight">
              {formattedCountdown}
            </div>

            {/* Countdown Progress Bar */}
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700/60 mt-3">
              <div
                className={`h-full transition-all duration-1000 ${
                  webSessionWarningCountdown <= 60
                    ? 'bg-red-500'
                    : webSessionWarningCountdown <= 150
                    ? 'bg-orange-500'
                    : 'bg-amber-400'
                }`}
                style={{ width: `${percentRemaining}%` }}
              />
            </div>

            <p className="text-[11px] text-slate-400 pt-1">
              {isSoftware
                ? 'Click "Yes, I\'m Here" to continue tracking, or session will automatically conclude.'
                : 'Move your mouse, type any key, or click below to keep your session active.'}
            </p>
          </div>

          {/* Explanation info */}
          <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 mb-6">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {isSoftware
                ? 'To protect payroll and accurate hours, shifts automatically close if this prompt is not answered within 5 minutes.'
                : 'Web sessions auto-expire after 10 total minutes of inactivity to safeguard company data and timesheet accuracy.'}
            </span>
          </div>

          {/* Actions: Yes or No */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              id="stay-logged-in-btn"
              type="button"
              onClick={refreshWebSession}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-slate-950" />
              <span>{isSoftware ? "Yes, I'm Here (Continue Shift)" : "I'm Still Working (Stay Signed In)"}</span>
            </button>

            <button
              id="logout-now-btn"
              type="button"
              onClick={() => logout(isSoftware ? 'inactivity_30min_prompt' : 'manual_inactivity_prompt')}
              className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-800 hover:bg-red-950/80 hover:border-red-600/80 border border-slate-700 text-slate-300 hover:text-red-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-4 h-4 text-red-400" />
              <span>{isSoftware ? 'No, Sign Out' : 'Sign Out'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
