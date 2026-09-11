import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User, IdleLog, LeaveRequest } from '../../types';
import { downloadDesktopSoftwarePackage, DesktopOS } from '../../lib/desktopDownloader';
import { UserAvatar } from '../UserAvatar';
import { LiveAgentTasksBoard } from '../LiveAgentTasksBoard';
import {
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Shield,
  Laptop,
  Monitor,
  Download,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Calendar,
} from 'lucide-react';

export const TeamLeadDashboardView: React.FC = () => {
  const {
    currentUser,
    users,
    userPresenceList,
    timeLogs,
    idleLogs,
    leaveRequests,
    approveLeaveRequest,
    rejectLeaveRequest,
    formatDuration,
  } = useApp();

  // Desktop App OS State
  const [selectedOS, setSelectedOS] = useState<DesktopOS>('windows');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Pagination states (10 items per page)
  const [agentPage, setAgentPage] = useState(1);
  const [idlePage, setIdlePage] = useState(1);
  const [leavePage, setLeavePage] = useState(1);

  const ITEMS_PER_PAGE = 10;

  // Supervised agents
  const teamAgents: User[] = users.filter((u) => u.role === 'agent');

  // Pending Leave Requests
  const pendingLeaves: LeaveRequest[] = leaveRequests.filter((r) => r.status === 'pending');

  // Sorted Idle Logs (recent first)
  const sortedIdleLogs: IdleLog[] = [...idleLogs].sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // Calculate stats
  const totalTeamSec = timeLogs.reduce((acc, l) => acc + l.durationSeconds, 0);
  const totalTeamHours = (totalTeamSec / 3600).toFixed(1);

  // Download Handler for Desktop App
  const handleDownloadApp = (os: DesktopOS = selectedOS) => {
    downloadDesktopSoftwarePackage(os);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 5000);
  };

  // Pagination Helper Slice
  const getPaginatedItems = <T,>(items: T[], page: number, perPage: number = ITEMS_PER_PAGE): T[] => {
    const startIndex = (page - 1) * perPage;
    return items.slice(startIndex, startIndex + perPage);
  };

  const totalAgentPages = Math.ceil(teamAgents.length / ITEMS_PER_PAGE) || 1;
  const totalIdlePages = Math.ceil(sortedIdleLogs.length / ITEMS_PER_PAGE) || 1;
  const totalLeavePages = Math.ceil(pendingLeaves.length / ITEMS_PER_PAGE) || 1;

  const currentAgents: User[] = getPaginatedItems(teamAgents, agentPage);
  const currentIdleLogs: IdleLog[] = getPaginatedItems(sortedIdleLogs, idlePage);
  const currentLeaves: LeaveRequest[] = getPaginatedItems(pendingLeaves, leavePage);

  return (
    <div id="team-lead-dashboard-view" className="space-y-6">
      {/* Desktop Tracker Software Banner for Team Leaders */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 border border-slate-700/80 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-md">
              <Laptop className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg text-white tracking-tight">
                  LLC Time Tracker Desktop Software
                </h2>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-mono font-bold">
                  Team Leader Edition
                </span>
              </div>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Install the native standalone desktop software client on Windows, macOS, or Linux for high-precision time tracking, shift logging, and team supervisor management.
              </p>

              {/* OS Selection Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOS('windows')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    selectedOS === 'windows'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow'
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
                      ? 'bg-amber-500 text-slate-950 font-bold shadow'
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
                      ? 'bg-amber-500 text-slate-950 font-bold shadow'
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
              onClick={() => handleDownloadApp(selectedOS)}
              className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] cursor-pointer"
            >
              {downloadSuccess ? (
                <>
                  <Check className="w-4 h-4 text-slate-950" />
                  <span>Installer Downloaded!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    Download {selectedOS === 'windows' ? 'Windows App Builder (.bat)' : selectedOS === 'mac' ? 'macOS App Builder (.sh)' : 'Linux App Builder (.sh)'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-4 text-[11px] text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Team Leader Management Suite
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <Monitor className="w-3.5 h-3.5 text-blue-400" /> Live Team Monitoring & Audits
            </span>
          </div>
          <span className="text-slate-400">Version 1.0 (Windows / macOS / Linux)</span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Supervised Agents</span>
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{teamAgents.length} Agents</div>
          <p className="text-[11px] text-slate-500 mt-1">Active team roster</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Team Total Hours</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 font-mono">{totalTeamHours} hrs</div>
          <p className="text-[11px] text-slate-500 mt-1">Logged across all tasks</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Pending Leave Requests</span>
            <FileText className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold text-purple-600">
            {pendingLeaves.length} Item(s)
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Awaiting team lead approval</p>
        </div>
      </div>

      {/* Live Agent Sessions, Real-Time Task Tracker & Headcount Graphs */}
      <LiveAgentTasksBoard
        title="Live Supervised Agent Tasks & Real-Time Presence"
        description="Real-time live monitoring of what your supervised agents are doing right now (Data Entry, Email Reachout, Inbound Calls, QA Review), with live agent headcount graphs and task breakdown analytics."
        teamLeaderId={currentUser.id}
        showAnalyticsTabs={true}
      />

      {/* Main Sections Stack: Team Member Details & Team Idle Time Logs */}
      <div className="space-y-6">
        {/* Section 1: Team Member Details */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-600" /> Team Member Details
              </h3>
              <p className="text-xs text-slate-500">
                Showing {currentAgents.length} of {teamAgents.length} team members (Page {agentPage} of {totalAgentPages})
              </p>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                onClick={() => setAgentPage((prev) => Math.max(prev - 1, 1))}
                disabled={agentPage === 1}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition-all flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>

              {Array.from({ length: totalAgentPages }, (_, i) => i + 1).map((pNum) => (
                <button
                  key={pNum}
                  onClick={() => setAgentPage(pNum)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                    agentPage === pNum
                      ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {pNum}
                </button>
              ))}

              <button
                onClick={() => setAgentPage((prev) => Math.min(prev + 1, totalAgentPages))}
                disabled={agentPage === totalAgentPages}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition-all flex items-center gap-1"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentAgents.map((agent) => {
              const agentAllLogs = timeLogs.filter((l) => l.userId === agent.id);
              const lastLog = agentAllLogs[0];
              const todayStr = new Date().toISOString().split('T')[0];
              const agentTodayLogs = agentAllLogs.filter((l) => l.date === todayStr);
              const baseTodaySec = agentTodayLogs.reduce((acc, l) => acc + l.durationSeconds, 0);

              const presence = userPresenceList.find((p) => p.userId === agent.id);
              const now = Date.now();
              const lastHeartbeat = presence ? new Date(presence.lastHeartbeat).getTime() : 0;
              const isRecent = now - lastHeartbeat < 5 * 60 * 1000;
              const isOnline = !!presence && (presence.isOnline || isRecent || !!presence.isTracking);
              const isTracking = !!presence?.isTracking && (isRecent || presence?.isOnline);
              const isIdle = isOnline && !isTracking && (presence?.status === 'idle' || !!presence?.isPaused);
              const liveActiveSec = isTracking ? (presence?.elapsedSeconds || 0) : 0;
              const totalTodayTrackedSec = baseTodaySec + liveActiveSec;

              const currentTask = isTracking
                ? (presence?.currentTask || lastLog?.task || 'Active Task In Progress')
                : (isOnline ? (presence?.currentTask || 'Web Portal Session') : (lastLog?.task || 'Shift Concluded'));

              return (
                <div
                  key={agent.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 hover:border-slate-300 transition-all shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar
                        name={agent.name}
                        role={agent.role}
                        size="lg"
                      />
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{agent.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">#{agent.employeeCode} • {agent.designation}</div>
                      </div>
                    </div>

                    {isTracking && (
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 -ml-3" />
                        Live Tracking
                      </span>
                    )}
                    {isOnline && !isTracking && !isIdle && (
                      <span className="bg-blue-100 text-blue-800 border border-blue-200 text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        Online
                      </span>
                    )}
                    {isIdle && (
                      <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Idle
                      </span>
                    )}
                    {!isOnline && (
                      <span className="bg-slate-100 text-slate-500 border border-slate-200 text-[10px] px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        Offline
                      </span>
                    )}
                  </div>

                  <div className="bg-white p-3 rounded-lg text-xs space-y-2 border border-slate-200">
                    <div className="flex justify-between items-center text-slate-700">
                      <span className="text-slate-500 font-medium">Time Tracked Today:</span>
                      <strong className={`font-mono text-sm ${isTracking ? 'text-emerald-700 font-black' : 'text-slate-900'}`}>
                        {formatDuration(totalTodayTrackedSec)}
                        {isTracking && <span className="text-[10px] text-emerald-600 font-bold ml-1 animate-pulse">(live)</span>}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center text-slate-700">
                      <span className="text-slate-500 font-medium">Current Task:</span>
                      <span className="text-emerald-700 font-bold truncate max-w-[150px] text-right" title={currentTask}>
                        {currentTask}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-700 pt-1 border-t border-slate-100 text-[11px]">
                      <span className="text-slate-400">GEO Timezone:</span>
                      <span className="text-blue-600 font-mono font-medium">{agent.geoCity || 'Manila (GMT+8)'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Team Idle Time Logs */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" /> Team Idle Time Logs
              </h3>
              <p className="text-xs text-slate-500">
                Summary of background inactivity events. Showing {currentIdleLogs.length} of {sortedIdleLogs.length} recent logs (Page {idlePage} of {totalIdlePages})
              </p>
            </div>

            {/* Idle Pagination Controls */}
            {totalIdlePages > 1 && (
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  onClick={() => setIdlePage((prev) => Math.max(prev - 1, 1))}
                  disabled={idlePage === 1}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition-all flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Back
                </button>

                {Array.from({ length: totalIdlePages }, (_, i) => i + 1).map((pNum) => (
                  <button
                    key={pNum}
                    onClick={() => setIdlePage(pNum)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                      idlePage === pNum
                        ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {pNum}
                  </button>
                ))}

                <button
                  onClick={() => setIdlePage((prev) => Math.min(prev + 1, totalIdlePages))}
                  disabled={idlePage === totalIdlePages}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition-all flex items-center gap-1"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {currentIdleLogs.length === 0 ? (
            <p className="text-slate-500 text-xs py-4 text-center">No team idle time recorded.</p>
          ) : (
            <div className="space-y-3">
              {currentIdleLogs.map((idle) => (
                <div
                  key={idle.id}
                  className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-slate-300 transition-all"
                >
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span>{idle.userName}</span>
                      <span className="bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                        {idle.durationMinutes} mins Inactive
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px] mt-1">{idle.reason}</p>
                  </div>

                  <div className="text-slate-500 font-mono text-[10px] shrink-0">
                    {idle.timestamp}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Pending Leave Requests (Clean Table Format) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" /> Pending Leave Requests
              </h3>
              <p className="text-xs text-slate-500">
                Review and process leave applications submitted by supervised agents. Showing {currentLeaves.length} of {pendingLeaves.length} pending items (Page {leavePage} of {totalLeavePages})
              </p>
            </div>

            {/* Leave Pagination Controls */}
            {totalLeavePages > 1 && (
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  onClick={() => setLeavePage((prev) => Math.max(prev - 1, 1))}
                  disabled={leavePage === 1}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition-all flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Back
                </button>

                {Array.from({ length: totalLeavePages }, (_, i) => i + 1).map((pNum) => (
                  <button
                    key={pNum}
                    onClick={() => setLeavePage(pNum)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                      leavePage === pNum
                        ? 'bg-purple-600 text-white font-bold shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {pNum}
                  </button>
                ))}

                <button
                  onClick={() => setLeavePage((prev) => Math.min(prev + 1, totalLeavePages))}
                  disabled={leavePage === totalLeavePages}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition-all flex items-center gap-1"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {pendingLeaves.length === 0 ? (
            <div className="text-slate-500 text-xs py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No pending leave requests at this time.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Agent Name</th>
                    <th className="py-3.5 px-4">Leave Dates</th>
                    <th className="py-3.5 px-4">Reason</th>
                    <th className="py-3.5 px-4">Leave type</th>
                    <th className="py-3.5 px-4 text-center">Available Leave Credits</th>
                    <th className="py-3.5 px-4 text-right">Remarks/Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {currentLeaves.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {l.userName}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-semibold text-blue-600">
                        {l.startDate} to {l.endDate}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={l.reason}>
                        {l.reason}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full text-[10px] font-bold">
                          {l.type.includes('Leave') ? l.type : `${l.type} Leave`}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                        <span className="inline-block bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-lg font-mono text-xs font-bold">
                          {l.availableLeaveCredits ?? 4}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => approveLeaveRequest(l.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm transition-all"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => rejectLeaveRequest(l.id)}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm transition-all"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
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
    </div>
  );
};
