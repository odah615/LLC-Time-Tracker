import React from 'react';
import { useApp } from '../context/AppContext';
import { DESIGNATION_LIST, TASK_LIST } from '../data/initialData';
import {
  Play,
  Pause,
  Square,
  Monitor,
  MousePointer,
  Keyboard,
  Layers,
  Sparkles,
  Minimize2,
  Maximize2,
  Clock,
  Briefcase,
  Activity,
  Check,
  AlertTriangle,
  RotateCcw,
  X,
  WifiOff,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { motion } from 'motion/react';

interface DesktopTrackerWidgetProps {
  isFullPage?: boolean;
}

export const DesktopTrackerWidget: React.FC<DesktopTrackerWidgetProps> = ({ isFullPage = false }) => {
  const {
    currentUser,
    isTracking,
    isPaused,
    currentDesignation,
    currentTask,
    elapsedSeconds,
    currentMouseActivity,
    currentKeyboardActivity,
    currentActiveApp,
    currentIdleThresholdMinutes,
    currentInactivitySeconds,
    sessionIdleDeductionSeconds,
    isIdleAlertActive,
    dismissIdleAlert,
    simulateIdleEvent,
    dailyAttendanceLogs,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    selectDesignation,
    selectTaskWithPrompt,
    formatDuration,
    isDesktopDockView,
    setIsDesktopDockView,
    isOffline,
    offlineSecondsRemaining,
    offlineStatusStage,
    retryConnection,
    designationList,
    getTasksForDesignation,
  } = useApp();

  const isFloatingDock = isDesktopDockView && !isFullPage;
  const isCriticalOffline = offlineStatusStage === 'critical_countdown';
  const offlineMins = Math.floor(offlineSecondsRemaining / 60);
  const offlineSecs = offlineSecondsRemaining % 60;
  const offlineFormatted = `${offlineMins}m ${offlineSecs.toString().padStart(2, '0')}s`;

  const availableTasks = getTasksForDesignation(currentDesignation);

  // Compute today's total extension / deductions for current user
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAttendance = dailyAttendanceLogs.find(
    (a) => a.userId === currentUser.id && a.date === todayStr
  );
  const todayExtensionMins = todayAttendance?.requiredExtensionMinutes || Math.round(sessionIdleDeductionSeconds / 60);

  return (
    <div
      id="desktop-tracker-widget"
      className={`transition-all duration-300 ${
        isFloatingDock
          ? 'fixed bottom-4 right-4 z-40 w-96 shadow-2xl rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 p-0 overflow-hidden ring-4 ring-blue-500/20'
          : 'bg-white border border-slate-200 rounded-2xl p-6 text-slate-800 shadow-sm w-full'
      }`}
    >
      {/* Top Header Bar (App Title & Version) */}
      <div className={`flex items-center justify-between ${isFloatingDock ? 'bg-[#0F172A] p-4 text-white' : 'pb-4 mb-4 border-b border-slate-200'}`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`font-bold text-sm tracking-tight ${isFloatingDock ? 'text-white' : 'text-slate-800'}`}>
                LLC Time Tracker
              </h2>
              <span className="text-[10px] bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded-full font-mono font-bold">
                v1
              </span>
            </div>
            <p className={`text-[11px] ${isFloatingDock ? 'text-slate-300' : 'text-slate-500'}`}>
              Agent Productivity & Time Tracker
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Dock / Undock view toggle */}
          <button
            onClick={() => setIsDesktopDockView(!isDesktopDockView)}
            className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-all ${
              isFloatingDock
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
            }`}
            title={isDesktopDockView ? 'Expand to Dashboard View' : 'Dock as Floating Desktop Widget'}
          >
            {isDesktopDockView ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Offline Internet Grace Period Alert Banner */}
      {isOffline && (
        <div
          className={`mb-4 rounded-xl p-3.5 flex items-start gap-3 border shadow-sm ${
            isCriticalOffline
              ? 'bg-rose-950/90 border-rose-600/90 text-rose-100'
              : 'bg-amber-950/90 border-amber-600/90 text-amber-100'
          }`}
        >
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
              isCriticalOffline ? 'bg-rose-600 text-white animate-pulse' : 'bg-amber-600 text-white'
            }`}
          >
            {isCriticalOffline ? <ShieldAlert className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </div>
          <div className="flex-1 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white">
                {isCriticalOffline ? '🚨 Critical Offline Limit Active' : '⚠️ Internet Disconnected'}
              </span>
              <span
                className={`px-2 py-0.2 rounded-full font-mono font-bold text-[10px] border ${
                  isCriticalOffline
                    ? 'bg-rose-500/30 text-rose-200 border-rose-400/40 animate-pulse'
                    : 'bg-amber-500/30 text-amber-200 border-amber-400/40'
                }`}
              >
                {offlineFormatted} Remaining
              </span>
              {isTracking && (
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded text-[10px] font-bold">
                  Tracking locally
                </span>
              )}
            </div>
            <p className={`mt-1 leading-relaxed ${isCriticalOffline ? 'text-rose-200' : 'text-amber-200/90'}`}>
              {isCriticalOffline
                ? `You have ${offlineFormatted} remaining before your shift is automatically stopped and logged out to prevent unverified hours. Please restore WiFi or connect to mobile hotspot now.`
                : `Internet connection dropped. You have a 30-minute grace window (${offlineFormatted} remaining) to connect to backup WiFi or mobile hotspot. Your hours are safely tracking locally.`}
            </p>
          </div>
          <button
            onClick={() => retryConnection()}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 shrink-0 shadow-sm transition-all ${
              isCriticalOffline
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-amber-600 hover:bg-amber-500 text-white'
            }`}
            title="Check connection status"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Check</span>
          </button>
        </div>
      )}

      {/* Idle Inactivity Alert Banner */}
      {isIdleAlertActive && (
        <div className="mb-4 bg-amber-500/15 border border-amber-500/40 rounded-xl p-3.5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-amber-900">
            <p className="font-bold flex items-center gap-1.5">
              <span>Hardware Inactivity Deducted</span>
              <span className="bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded text-[10px] border border-amber-300">
                Shift Extended
              </span>
            </p>
            <p className="mt-0.5 text-slate-700 leading-relaxed">
              Inactivity detected without keyboard/mouse input. Time was subtracted from your daily productive log and saved to Google Sheets. You must extend your shift by the equivalent minutes to cover up.
            </p>
          </div>
          <button
            onClick={dismissIdleAlert}
            className="text-amber-700 hover:text-amber-900 p-1 rounded-lg hover:bg-amber-200/50 transition-colors"
            title="Dismiss Alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className={isFloatingDock ? 'p-4 space-y-4' : 'space-y-5'}>
        {/* Step Setup: Designation & Task Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Step 1: Designation */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                <span>Select Designation</span>
              </label>
              {currentUser.role === 'agent' ? (
                <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  Locked to Profile
                </span>
              ) : (
                <span className="text-[10px] text-blue-700 font-medium bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                  Admin/Lead Override
                </span>
              )}
            </div>
            <select
              value={currentDesignation}
              onChange={(e) => selectDesignation(e.target.value as any)}
              disabled={currentUser.role === 'agent'}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed disabled:border-slate-200"
            >
              {designationList.map((desig) => (
                <option key={desig} value={desig}>
                  {desig}
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Task */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Select Current Task ({availableTasks.length})</span>
            </label>
            <select
              value={currentTask}
              onChange={(e) => selectTaskWithPrompt(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-semibold"
            >
              {availableTasks.map((task) => (
                <option key={task} value={task}>
                  {task}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Task Switcher Chips */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-semibold text-slate-700">Quick Task Switcher ({currentDesignation}):</span>
            {isTracking && (
              <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1 animate-pulse">
                <Sparkles className="w-3 h-3" /> Click any task to switch
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
            {availableTasks.map((task) => {
              const isSelected = task === currentTask;
              return (
                <button
                  key={task}
                  onClick={() => selectTaskWithPrompt(task)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                  <span>{task}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Timer Clock & Big Controls */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 relative overflow-hidden shadow-inner">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1 flex items-center gap-1.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isTracking && !isPaused
                      ? 'bg-emerald-500 animate-ping'
                      : isPaused
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                  }`}
                />
                {isTracking && !isPaused
                  ? 'Time Tracker Active'
                  : isPaused
                  ? 'Tracker Paused'
                  : 'Ready to Track'}
              </div>
              <div className="font-mono text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
                {formatDuration(elapsedSeconds)}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                <span>Task: <strong className="text-blue-600 font-semibold">{currentTask}</strong></span>
                <span>•</span>
                <span>Role: <strong className="text-slate-700 font-semibold">{currentDesignation}</strong></span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {!isTracking ? (
                <button
                  onClick={startTracking}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-[0.98]"
                >
                  <Play className="w-5 h-5 fill-white" /> Start Timer
                </button>
              ) : (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {isPaused ? (
                    <button
                      onClick={resumeTracking}
                      className="flex-1 sm:flex-none px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                    >
                      <Play className="w-4 h-4 fill-white" /> Resume
                    </button>
                  ) : (
                    <button
                      onClick={pauseTracking}
                      className="flex-1 sm:flex-none px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                    >
                      <Pause className="w-4 h-4 fill-white" /> Pause
                    </button>
                  )}
                  <button
                    onClick={stopTracking}
                    className="flex-1 sm:flex-none px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-red-100"
                  >
                    <Square className="w-4 h-4 fill-white" /> Stop & Save
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Input & Activity Monitoring */}
        <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-3">
            <span className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-blue-600" /> Input Activity Meter
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Realtime Background</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Keyboard Meter */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="flex items-center gap-1">
                  <Keyboard className="w-3.5 h-3.5 text-blue-600" /> Keyboard
                </span>
                <span className="font-mono font-bold text-blue-600">{isTracking ? currentKeyboardActivity : 0}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-blue-600"
                  animate={{ width: `${isTracking ? currentKeyboardActivity : 0}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

            {/* Mouse Meter */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="flex items-center gap-1">
                  <MousePointer className="w-3.5 h-3.5 text-emerald-600" /> Mouse
                </span>
                <span className="font-mono font-bold text-emerald-600">{isTracking ? currentMouseActivity : 0}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-emerald-500"
                  animate={{ width: `${isTracking ? currentMouseActivity : 0}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

            {/* Active Application */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="flex items-center gap-1">
                  <Monitor className="w-3.5 h-3.5 text-amber-600" /> Active Window
                </span>
                <span className="text-[10px] text-amber-600 font-mono">App Focus</span>
              </div>
              <div className="text-xs font-bold text-slate-800 truncate" title={currentActiveApp}>
                {isTracking ? currentActiveApp : 'No Active App'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
