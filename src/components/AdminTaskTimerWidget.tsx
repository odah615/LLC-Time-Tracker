import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Play, Pause, Square, Clock, Laptop, CheckCircle2, Download } from 'lucide-react';
import { TASK_LIST } from '../data/initialData';
import { TaskCategory } from '../types';

export const AdminTaskTimerWidget: React.FC = () => {
  const { currentUser, addTimeLog, formatDuration } = useApp();

  const [selectedTask, setSelectedTask] = useState<TaskCategory>(
    currentUser.role === 'hr'
      ? 'HR & Recruitment'
      : currentUser.role === 'payroll'
      ? 'Payroll Audit & Processing'
      : currentUser.role === 'trainer'
      ? 'Training'
      : 'Team Supervision'
  );

  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showSavedToast, setShowSavedToast] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  const handleStartPause = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const handleStopAndSave = () => {
    if (elapsedSeconds < 10) {
      // Just reset if < 10s
      setIsTimerRunning(false);
      setElapsedSeconds(0);
      return;
    }

    // Save entry to central database
    const now = new Date();
    const startTimeStr = new Date(now.getTime() - elapsedSeconds * 1000)
      .toTimeString()
      .split(' ')[0]
      .substring(0, 5);
    const endTimeStr = now.toTimeString().split(' ')[0].substring(0, 5);

    addTimeLog({
      userId: currentUser.id,
      date: now.toISOString().split('T')[0],
      startTime: startTimeStr,
      endTime: endTimeStr,
      durationSeconds: elapsedSeconds,
      task: selectedTask,
      designation: currentUser.designation,
      isBillable: true,
      activityScore: 92,
      keyboardPercent: 65,
      mousePercent: 72,
    });

    setIsTimerRunning(false);
    setElapsedSeconds(0);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3500);
  };

  const handleDownloadApp = () => {
    const element = document.createElement('a');
    const file = new Blob(
      [
        `LLC Time Tracker Admin Desktop App (v1.0)\n` +
          `==================================================\n` +
          `User: ${currentUser.name} (${currentUser.employeeCode})\n` +
          `Role: ${currentUser.role.toUpperCase()}\n` +
          `Task Tracking Mode: Simplified Management Timer\n\n` +
          `Thank you for using LLC Time Tracker.`,
      ],
      { type: 'text/plain' }
    );
    element.href = URL.createObjectURL(file);
    element.download = `LLC_Time_Tracker_Admin_${currentUser.role}.exe`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900">
              Admin & Manager Task Time Tracker
            </h4>
            <p className="text-xs text-slate-500">
              Select task to log billable hours to central database
            </p>
          </div>
        </div>

        <button
          onClick={handleDownloadApp}
          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 transition-colors"
          title="Download standalone desktop app installer"
        >
          <Laptop className="w-3.5 h-3.5 text-slate-600" />
          <span>Download Desktop App (.exe)</span>
        </button>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        {/* Task Selection */}
        <div className="w-full md:w-1/2 space-y-1">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
            Current Management Task
          </label>
          <select
            value={selectedTask}
            onChange={(e) => setSelectedTask(e.target.value as TaskCategory)}
            disabled={isTimerRunning}
            className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 font-semibold focus:ring-2 focus:ring-blue-500"
          >
            {TASK_LIST.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Stopwatch & Controls */}
        <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-4">
          <div className="text-right">
            <div className="text-2xl font-mono font-extrabold text-slate-900 tracking-tight">
              {formatDuration(elapsedSeconds)}
            </div>
            <div className="text-[10px] font-bold uppercase text-slate-400">
              {isTimerRunning ? 'Timer Active' : 'Ready'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isTimerRunning ? (
              <button
                onClick={handleStartPause}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
              >
                <Play className="w-4 h-4 fill-white" /> Start Time
              </button>
            ) : (
              <button
                onClick={handleStartPause}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
              >
                <Pause className="w-4 h-4 fill-white" /> Pause
              </button>
            )}

            {elapsedSeconds > 0 && (
              <button
                onClick={handleStopAndSave}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
                title="Stop timer - Automatically saves shift to Database & Google Sheets"
              >
                <Square className="w-4 h-4 fill-white" /> Stop
              </button>
            )}
          </div>
        </div>
      </div>

      {showSavedToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Task entry successfully saved to central database timesheet!</span>
        </div>
      )}
    </div>
  );
};
