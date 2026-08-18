import React from 'react';
import { useApp } from '../../context/AppContext';
import { AlertTriangle, ArrowRight, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const TaskSwitchModal: React.FC = () => {
  const { taskSwitchPending, currentTask, confirmTaskSwitch, cancelTaskSwitch } = useApp();

  if (!taskSwitchPending) return null;

  return (
    <AnimatePresence>
      <div id="task-switch-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-2xl text-slate-800"
        >
          <div className="flex items-center gap-3 text-amber-600 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-slate-900">Change Active Task?</h3>
              <p className="text-xs text-slate-500">Timer is currently running on another task.</p>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 my-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Current Task:</span>
              <span className="font-medium text-slate-800 bg-white border border-slate-200 px-2.5 py-1 rounded">
                {currentTask}
              </span>
            </div>

            <div className="flex justify-center text-blue-600">
              <ArrowRight className="w-4 h-4 animate-pulse" />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">New Target Task:</span>
              <span className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
                {taskSwitchPending.targetTask}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed mb-6">
            Switching task will save your current elapsed time chunk to your timesheet and seamlessly start tracking under <strong className="text-slate-900">"{taskSwitchPending.targetTask}"</strong>.
          </p>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={cancelTaskSwitch}
              className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center gap-1.5 transition-colors border border-slate-200"
            >
              <X className="w-4 h-4" /> No, Keep Current Task
            </button>
            <button
              onClick={confirmTaskSwitch}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Check className="w-4 h-4" /> Yes, Switch Task
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
