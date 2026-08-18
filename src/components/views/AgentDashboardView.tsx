import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { downloadDesktopSoftwarePackage, DesktopOS } from '../../lib/desktopDownloader';
import { UserAvatar } from '../UserAvatar';
import {
  Clock,
  Calendar,
  AlertCircle,
  User as UserIcon,
  CheckCircle2,
  TrendingUp,
  Activity,
  PlusCircle,
  MapPin,
  Briefcase,
  FileText,
  Download,
  Laptop,
  Monitor,
  ShieldCheck,
  Check,
  ArrowRight,
} from 'lucide-react';

interface AgentDashboardViewProps {
  onOpenManualModal: () => void;
  onOpenLeaveModal: () => void;
  onOpenDownloadModal?: () => void;
}

export const AgentDashboardView: React.FC<AgentDashboardViewProps> = ({
  onOpenManualModal,
  onOpenLeaveModal,
}) => {
  const { currentUser, timeLogs, formatDuration, setIsDesktopDockView } = useApp();

  // Filter logs for current agent
  const agentLogs = timeLogs.filter((l) => l.userId === currentUser.id);

  // Calculate stats
  const totalTrackedSec = agentLogs.reduce((acc, l) => acc + l.durationSeconds, 0);
  const totalHoursFormatted = (totalTrackedSec / 3600).toFixed(1);
  const avgMouse = Math.round(
    agentLogs.reduce((acc, l) => acc + l.mouseActivityAvg, 0) / (agentLogs.length || 1)
  );
  const avgKeyboard = Math.round(
    agentLogs.reduce((acc, l) => acc + l.keyboardActivityAvg, 0) / (agentLogs.length || 1)
  );

  const [selectedOS, setSelectedOS] = useState<DesktopOS>('windows');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleDownloadAppPackage = (os: DesktopOS = selectedOS) => {
    downloadDesktopSoftwarePackage(os);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 5000);
  };

  return (
    <div id="agent-dashboard-view" className="space-y-6">
      {/* Desktop App Instant Launcher Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
              <Laptop className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg text-white tracking-tight">
                  LLC Time Tracker Desktop Software Client
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full">
                  READY TO TRACK
                </span>
              </div>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Clock in for your shift, monitor live mouse/keyboard activity, switch task categories, and capture screenshots instantly. All logs sync directly to your central database and timesheets.
              </p>

              {/* OS Selection Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOS('windows')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    selectedOS === 'windows'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  🖥️ Windows PC (.exe / .bat)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOS('mac')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    selectedOS === 'mac'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  🍎 macOS (Apple .app)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOS('linux')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    selectedOS === 'linux'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  🐧 Linux OS (Binary)
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0">
            <button
              onClick={() => setIsDesktopDockView(true)}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-600/30 transition-all active:scale-[0.98] ring-2 ring-emerald-400/50 cursor-pointer"
            >
              <Clock className="w-5 h-5 text-emerald-100" />
              <span>Launch Desktop Tracker Now</span>
              <ArrowRight className="w-4 h-4 text-emerald-200" />
            </button>
            <button
              onClick={() => handleDownloadAppPackage(selectedOS)}
              className="px-4 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 shadow-md transition-all cursor-pointer"
            >
              {downloadSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Installer Downloaded!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>
                    Download {selectedOS === 'windows' ? 'Windows App (.bat)' : selectedOS === 'mac' ? 'macOS App (.sh)' : 'Linux App (.sh)'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-[11px] text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Auto-Save to Database & Timesheets
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <Monitor className="w-3.5 h-3.5 text-blue-400" /> Real-Time Activity & Screenshot Monitor
            </span>
          </div>
          <span className="text-slate-400 font-mono">v1.0 Standalone Mode</span>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Hours Tracked */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Total Hours Tracked</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">{totalHoursFormatted} hrs</div>
          <p className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-600" /> Active period hours log
          </p>
        </div>

        {/* Avg Activity Score */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Activity Score</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 font-mono">
            {Math.round((avgMouse + avgKeyboard) / 2)}%
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Keyboard: {avgKeyboard}% • Mouse: {avgMouse}%
          </p>
        </div>

        {/* Total Sessions Logged */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Shift Sessions</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">{agentLogs.length} Logged</div>
          <p className="text-[11px] text-slate-500 mt-1">
            Open-time flexible shifts
          </p>
        </div>

        {/* Personal Geo Info */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">GEO Timezone</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base font-bold text-slate-900 truncate">{currentUser.geoCity}</div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">{currentUser.geoTimezone}</p>
        </div>
      </div>

      {/* Main Grid: Timesheet Details + Personal Profile & Late Records */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Time Details & Logged Sessions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" /> Recent Timesheet Logs
                </h3>
                <p className="text-xs text-slate-500">Detailed logs recorded by the time tracking software</p>
              </div>
            </div>

            {agentLogs.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">
                No timesheet records found yet. Launch your Desktop Tracker software to start logging hours!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-3 rounded-l-lg">Date/Time</th>
                      <th className="py-3 px-3">Task & Designation</th>
                      <th className="py-3 px-3">Duration</th>
                      <th className="py-3 px-3 rounded-r-lg">Activity %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {agentLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{log.date}</div>
                          <div className="text-[11px] text-blue-600 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" /> {log.geoLocalStartTime}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-emerald-700">{log.task}</div>
                          <div className="text-[10px] text-slate-500">{log.designation}</div>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {formatDuration(log.durationSeconds)}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full"
                                style={{
                                  width: `${Math.round(
                                    (log.mouseActivityAvg + log.keyboardActivityAvg) / 2
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className="font-mono text-[11px] font-semibold text-slate-700">
                              {Math.round((log.mouseActivityAvg + log.keyboardActivityAvg) / 2)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Column: Agent Personal Profile & Late Records */}
        <div className="space-y-6">
          {/* Agent Profile Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-base text-slate-900 mb-4 pb-2 border-b border-slate-200 flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-blue-600" /> Agent Profile & Info
            </h3>

            <div className="flex items-center gap-3.5 mb-4">
              <UserAvatar
                name={currentUser.name}
                role={currentUser.role}
                size="xl"
                className="shadow-sm"
              />
              <div>
                <h4 className="font-bold text-slate-900 text-base">{currentUser.name}</h4>
                <div className="text-xs text-slate-500">{currentUser.email}</div>
                <span className="inline-block mt-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold">
                  {currentUser.employeeCode}
                </span>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Designation:</span>
                <strong className="text-slate-900">{currentUser.designation}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Department:</span>
                <strong className="text-slate-900">{currentUser.department}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">GEO City:</span>
                <strong className="text-slate-900">{currentUser.geoCity}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Timezone:</span>
                <strong className="text-blue-600 font-mono text-[11px]">{currentUser.geoTimezone}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Joined Date:</span>
                <strong className="text-slate-700">{currentUser.joinDate}</strong>
              </div>
            </div>

            <button
              onClick={onOpenLeaveModal}
              className="mt-4 w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all border border-slate-200"
            >
              <FileText className="w-4 h-4 text-slate-600" /> Request Leave
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
