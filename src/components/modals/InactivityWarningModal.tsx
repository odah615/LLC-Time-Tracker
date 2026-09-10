import React from 'react';
import { useApp } from '../../context/AppContext';
import { Clock, AlertTriangle, CheckCircle2, PauseCircle, LogOut, ShieldAlert, Volume2 } from 'lucide-react';
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
    inactivityAlertState,
    respondToInactivityAlert,
    isDualMonitorMode,
  } = useApp();

  const isTrackerInactivity = Boolean(inactivityAlertState?.isOpen);
  const isSessionWarning = Boolean(isSessionWarningActive);

  if (!isAuthenticated || (!isTrackerInactivity && !isSessionWarning)) {
    return null;
  }

  // --- Render Case 1: Desktop Tracker Hardware Inactivity Alert (Sound alert + 60s/180s countdown) ---
  if (isTrackerInactivity) {
    const totalMax = isDualMonitorMode ? 180 : 60;
    const remainingSeconds = inactivityAlertState.remainingSeconds;
    const percentRemaining = Math.max(0, Math.min(100, (remainingSeconds / totalMax) * 100));

    return (
      <AnimatePresence>
        <div
          id="inactivity-warning-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 15 }}
            className="bg-slate-900 border-2 border-amber-500 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl text-white relative overflow-hidden"
          >
            {/* Top amber/orange pulsed bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 animate-pulse" />

            {/* Header */}
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400 shadow-inner">
                <AlertTriangle className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-lg text-white">Inactivity Detected</h3>
                  <span className="bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                    <Volume2 className="w-3 h-3 animate-pulse text-amber-400" />
                    Sound Chime
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  No keyboard or mouse activity detected for <span className="font-bold text-amber-300">{inactivityAlertState.idleMinutes} minutes</span> while tracking <span className="font-bold text-white">"{currentTask || 'Task'}"</span>.
                </p>
              </div>
            </div>

            {/* Big Countdown Card */}
            <div className="bg-slate-950/85 border border-amber-500/30 rounded-2xl p-5 my-4 text-center space-y-2.5 relative">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Confirmation Window</span>
              </p>

              <div className="text-5xl font-black font-mono text-amber-400 tracking-tight">
                {remainingSeconds}s
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700/60 mt-3">
                <div
                  className={`h-full transition-all duration-1000 ${
                    remainingSeconds <= 15 ? 'bg-red-500' : remainingSeconds <= 30 ? 'bg-orange-500' : 'bg-amber-400'
                  }`}
                  style={{ width: `${percentRemaining}%` }}
                />
              </div>

              <p className="text-[11px] text-slate-400 pt-1">
                Click below to confirm you are working. If unanswered, {inactivityAlertState.idleMinutes}m idle will be deducted.
              </p>
            </div>

            {/* Shield note */}
            <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 mb-5">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Accurate timesheets protect your payroll. Confirming now prevents any idle time deduction.
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                id="inactivity-working-btn"
                type="button"
                onClick={() => respondToInactivityAlert('stay_active')}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-slate-950" />
                <span>Yes, I'm Working! (Keep Tracking)</span>
              </button>

              <button
                id="inactivity-pause-btn"
                type="button"
                onClick={() => respondToInactivityAlert('pause_tracker')}
                className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
              >
                <PauseCircle className="w-4 h-4 text-amber-400" />
                <span>Pause Tracker</span>
              </button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }

  // --- Render Case 2: Session Inactivity Warning Modal (Web portal session & 30m desktop software prompt) ---
  const isSoftware = loginMode === 'software';
  const minutes = Math.floor(webSessionWarningCountdown / 60);
  const seconds = webSessionWarningCountdown % 60;
  const formattedCountdown = `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
