import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { downloadDesktopSoftwarePackage, DesktopOS } from '../../lib/desktopDownloader';
import {
  GraduationCap,
  Users,
  Clock,
  Plus,
  Edit,
  CheckCircle2,
  XCircle,
  FileText,
  UserCheck,
  ArrowRight,
  Save,
  Trash2,
  Laptop,
  Monitor,
  Download,
  Check,
  ShieldCheck,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  UserPlus,
  Search,
  Filter,
  Building2,
  MapPin,
  Camera,
  Layers,
  UserCheck2,
  Activity,
} from 'lucide-react';
import { TimeLog, User, IdleLog, LeaveRequest } from '../../types';
import { UserAvatar } from '../UserAvatar';
import { LiveTrackingTable } from '../LiveTrackingTable';

interface TrainerDashboardViewProps {
  onOpenAddUserModal: () => void;
  onEditUser: (user: User) => void;
}

export const TrainerDashboardView: React.FC<TrainerDashboardViewProps> = ({
  onOpenAddUserModal,
  onEditUser,
}) => {
  const {
    currentUser,
    users,
    userPresenceList,
    timeLogs,
    idleLogs,
    leaveRequests,
    updateTimeLog,
    deleteTimeLog,
    updateUser,
    approveLeaveRequest,
    rejectLeaveRequest,
    formatDuration,
  } = useApp();

  // Desktop App OS Selection State
  const [selectedOS, setSelectedOS] = useState<DesktopOS>('windows');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Employee Management Search & Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Timesheet Override Edit State
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editTask, setEditTask] = useState('');
  const [editDurationHours, setEditDurationHours] = useState(1);

  // Pagination states (5 per page)
  const [agentPage, setAgentPage] = useState(1);
  const [idlePage, setIdlePage] = useState(1);
  const [leavePage, setLeavePage] = useState(1);

  const ITEMS_PER_PAGE = 5;

  // Filter out Admin accounts from general employee management (Trainers don't manage admin accounts)
  const manageableUsers = users.filter((u) => u.role !== 'admin');

  // Filtered employees list for employee management
  const filteredUsers = manageableUsers.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.designation.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  // List of team leaders & trainers available for agent reassignment
  const teamLeadsAndTrainers = users.filter(
    (u) => u.role === 'team_lead' || u.role === 'trainer' || u.role === 'admin'
  );

  // Supervised / Trainee Agents (agents and employees, excluding oneself and admins)
  const traineeAgents = users.filter(
    (u) => (u.role === 'agent' || u.role === 'employee') && u.id !== currentUser?.id
  );

  // Pending Leave Requests
  const pendingLeaves: LeaveRequest[] = leaveRequests.filter((r) => r.status === 'pending');

  // Sorted Idle Logs
  const sortedIdleLogs: IdleLog[] = [...idleLogs].sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // Total Hours Tracked
  const totalTrackedSec = timeLogs.reduce((acc, l) => acc + l.durationSeconds, 0);
  const totalTrackedHours = (totalTrackedSec / 3600).toFixed(1);

  // Download Handler for Trainer Desktop Software
  const handleDownloadApp = (os: DesktopOS = selectedOS) => {
    downloadDesktopSoftwarePackage(os);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 5000);
  };

  // Reassign supervisor / team lead
  const handleReassignSupervisor = (agentId: string, newLeaderId: string) => {
    updateUser(agentId, { teamLeaderId: newLeaderId });
  };

  // Edit time log handlers
  const handleStartEditLog = (log: TimeLog) => {
    setEditingLogId(log.id);
    setEditTask(log.task);
    setEditDurationHours(Number((log.durationSeconds / 3600).toFixed(2)));
  };

  const handleSaveEditedLog = (logId: string) => {
    updateTimeLog(logId, {
      task: editTask as any,
      durationSeconds: Math.round(editDurationHours * 3600),
    });
    setEditingLogId(null);
  };

  // Pagination Slice Helper
  const getPaginatedItems = <T,>(items: T[], page: number, perPage: number = ITEMS_PER_PAGE): T[] => {
    const startIndex = (page - 1) * perPage;
    return items.slice(startIndex, startIndex + perPage);
  };

  const totalAgentPages = Math.ceil(traineeAgents.length / ITEMS_PER_PAGE) || 1;
  const totalIdlePages = Math.ceil(sortedIdleLogs.length / ITEMS_PER_PAGE) || 1;
  const totalLeavePages = Math.ceil(pendingLeaves.length / ITEMS_PER_PAGE) || 1;

  const currentAgents: User[] = getPaginatedItems<User>(traineeAgents, agentPage);
  const currentIdleLogs: IdleLog[] = getPaginatedItems<IdleLog>(sortedIdleLogs, idlePage);
  const currentLeaves: LeaveRequest[] = getPaginatedItems<LeaveRequest>(pendingLeaves, leavePage);

  return (
    <div id="trainer-dashboard-view" className="space-y-6">
      {/* 1. Trainer Desktop Software Download Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 border border-slate-700/80 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <Laptop className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg text-white tracking-tight">
                  LLC Time Tracker Desktop Software
                </h2>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-mono font-bold">
                  Trainer & Onboarding Edition
                </span>
              </div>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Task and coaching time tracking is handled via the official <strong>LLC Desktop Tracker Software</strong>. Download and install the native software on Windows, macOS, or Linux to manage trainees, log coaching shifts, and track onboarding activity.
              </p>

              {/* OS Selection Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOS('windows')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    selectedOS === 'windows'
                      ? 'bg-indigo-500 text-white font-bold shadow'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  🖥️ Windows OS (.exe / .bat)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOS('mac')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    selectedOS === 'mac'
                      ? 'bg-indigo-500 text-white font-bold shadow'
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
                      ? 'bg-indigo-500 text-white font-bold shadow'
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
              className="px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] cursor-pointer"
            >
              {downloadSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white" />
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
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> Trainer & Onboarding Portal
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <Camera className="w-3.5 h-3.5 text-purple-400" /> Screenshot & Activity Surveillance Controls
            </span>
          </div>
          <span className="text-slate-400">Version 1.0 (Windows / macOS / Linux)</span>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Active Trainees / Staff</span>
            <GraduationCap className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{manageableUsers.length} Employees</div>
          <p className="text-[11px] text-slate-500 mt-1">Agents, Leads, Trainers, HR & Payroll</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Total Tracked Time</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 font-mono">{totalTrackedHours} hrs</div>
          <p className="text-[11px] text-slate-500 mt-1">Logged across all task entries</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Supervised Staff</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold text-purple-700">
            {manageableUsers.length} Members
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Assigned trainees & team members</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Pending Leave Requests</span>
            <FileText className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-700">{pendingLeaves.length} Applications</div>
          <p className="text-[11px] text-slate-500 mt-1">Awaiting approval review</p>
        </div>
      </div>

      {/* Real-time Live Tracking Table Component */}
      <LiveTrackingTable
        title="Live Trainee & Staff Tracking Feed"
        description="Real-time database-driven presence tracking, active coaching tasks, and team members under training."
      />

      {/* 3. Employee Management Section (Admin-like View, excluding Main Admin Accounts) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" /> Employee & Trainee Management Console
            </h3>
            <p className="text-xs text-slate-500">
              Add new trainees, edit staff details, transfer agents to team leaders, and manage team member onboarding.
            </p>
          </div>

          <button
            onClick={onOpenAddUserModal}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all shrink-0"
          >
            <UserPlus className="w-4 h-4" /> Add Employee / Trainee
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name, email, or employee code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl pl-9 pr-3 py-2 font-medium focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-semibold text-slate-600">Filter Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-white border border-slate-200 text-slate-800 rounded-xl px-3 py-1.5 font-semibold focus:outline-none"
            >
              <option value="all">All Roles (Non-Admin)</option>
              <option value="agent">Agent</option>
              <option value="team_lead">Team Lead</option>
              <option value="trainer">Trainer</option>
              <option value="hr">HR Specialist</option>
              <option value="payroll">Payroll Officer</option>
            </select>
          </div>
        </div>

        {/* Employee Roster Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">ID No.</th>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Role & Designation</th>
                <th className="py-3.5 px-4">Assigned Team Lead</th>
                <th className="py-3.5 px-4">Date Hired</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No employees match your search filter criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((usr) => {
                  return (
                    <tr key={usr.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* ID No. */}
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 whitespace-nowrap">
                        #{usr.employeeCode}
                      </td>

                      {/* Employee */}
                      <td className="py-3.5 px-4">
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{usr.name}</div>
                          <div className="text-[11px] text-slate-500">{usr.email}</div>
                        </div>
                      </td>

                      {/* Role & Designation */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{usr.designation}</div>
                        <span className="bg-indigo-50 border border-indigo-200 text-indigo-800 px-2 py-0.5 rounded font-bold uppercase text-[10px] inline-block mt-0.5">
                          {usr.role}
                        </span>
                      </td>

                      {/* Assigned Team Lead */}
                      <td className="py-3.5 px-4">
                        <select
                          value={usr.teamLeaderId || ''}
                          onChange={(e) => handleReassignSupervisor(usr.id, e.target.value)}
                          className="bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 font-semibold text-xs focus:ring-2 focus:ring-indigo-500 w-full max-w-[180px]"
                        >
                          <option value="">None / Training Pool</option>
                          {teamLeadsAndTrainers.map((tl) => (
                            <option key={tl.id} value={tl.id}>
                              {tl.name} ({tl.designation})
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Date Hired */}
                      <td className="py-3.5 px-4 font-mono text-slate-700 font-semibold whitespace-nowrap">
                        {usr.joinDate || '2024-01-15'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onEditUser(usr)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold text-[11px] flex items-center gap-1 transition-all"
                            title="Edit Employee Details"
                          >
                            <Edit className="w-3.5 h-3.5" /> Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Team Member Details & Monitoring */}
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" /> Trainee & Supervised Roster
              </h3>
              <p className="text-xs text-slate-500">
                Showing {currentAgents.length} of {traineeAgents.length} active agents/trainees (Page {agentPage} of {totalAgentPages})
              </p>
            </div>

            {/* Pagination Controls */}
            {totalAgentPages > 1 && (
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
                        ? 'bg-indigo-600 text-white font-bold shadow-sm'
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
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentAgents.map((agent) => {
              const agentLogs = timeLogs.filter((l) => l.userId === agent.id);
              const lastLog = agentLogs[0];
              const totalSec = agentLogs.reduce((acc, l) => acc + l.durationSeconds, 0);

              const presence = userPresenceList.find((p) => p.userId === agent.id);
              const now = Date.now();
              const lastHeartbeat = presence ? new Date(presence.lastHeartbeat).getTime() : 0;
              const isRecent = now - lastHeartbeat < 5 * 60 * 1000;
              const isOnline = !!presence && (presence.isOnline || isRecent || !!presence.isTracking);
              const isTracking = !!presence?.isTracking && (isRecent || presence?.isOnline);
              const isIdle = isOnline && !isTracking && (presence?.status === 'idle' || !!presence?.isPaused);
              const currentTask = isTracking
                ? (presence?.currentTask || lastLog?.task || 'Training')
                : (isOnline ? (presence?.currentTask || 'Available / Standby') : (lastLog?.task || 'Shift Concluded'));

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
                        <div className="text-[11px] text-slate-500">{agent.designation}</div>
                      </div>
                    </div>

                    {isTracking && (
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Tracking
                      </span>
                    )}
                    {isOnline && !isTracking && !isIdle && (
                      <span className="bg-blue-100 text-blue-800 border border-blue-200 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        Online
                      </span>
                    )}
                    {isIdle && (
                      <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Idle
                      </span>
                    )}
                    {!isOnline && (
                      <span className="bg-slate-100 text-slate-500 border border-slate-200 text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        Offline
                      </span>
                    )}
                  </div>

                  <div className="bg-white p-2.5 rounded-lg text-xs space-y-1.5 border border-slate-200">
                    <div className="flex justify-between text-slate-700">
                      <span className="text-slate-500">Current / Last Task:</span>
                      <strong className="text-indigo-700 truncate max-w-[140px]" title={currentTask}>{currentTask}</strong>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span className="text-slate-500">GEO Timezone:</span>
                      <span className="text-blue-600 font-mono text-[10px]">{agent.geoCity}</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span className="text-slate-500">Tracked Today:</span>
                      <strong className="text-slate-900 font-mono">{formatDuration(totalSec)}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Team Idle Time Logs */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" /> Trainee Idle Time Logs
              </h3>
              <p className="text-xs text-slate-500">
                Summary of background inactivity events. Showing {currentIdleLogs.length} of {sortedIdleLogs.length} recent logs (Page {idlePage} of {totalIdlePages})
              </p>
            </div>

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
                        ? 'bg-indigo-600 text-white font-bold shadow-sm'
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
            <p className="text-slate-500 text-xs py-4 text-center">No trainee idle time recorded.</p>
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

        {/* Pending Leave Requests */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" /> Pending Trainee Leave Requests
              </h3>
              <p className="text-xs text-slate-500">
                Review and process leave applications submitted by trainees and agents. Showing {currentLeaves.length} of {pendingLeaves.length} pending items
              </p>
            </div>

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
                    <th className="py-3.5 px-4">Leave Type</th>
                    <th className="py-3.5 px-4 text-center">Available Credits</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
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

      {/* 5. Direct Trainer Timesheet Override Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" /> Trainer Direct Timesheet Override Controls
          </h3>
          <p className="text-xs text-slate-500">
            Trainers can update or correct agent time entries directly without waiting for manual request submissions.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Agent Name</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Task Category</th>
                <th className="py-3 px-4">Logged Duration</th>
                <th className="py-3 px-4 text-right">Trainer Direct Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {timeLogs.map((log) => {
                const isEditing = editingLogId === log.id;

                return (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {log.userName}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {log.date} ({log.startTime} - {log.endTime})
                    </td>

                    <td className="py-3.5 px-4">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editTask}
                          onChange={(e) => setEditTask(e.target.value)}
                          className="bg-white border border-slate-300 rounded p-1 text-xs font-semibold"
                        />
                      ) : (
                        <span className="font-semibold text-indigo-700">{log.task}</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.1"
                            value={editDurationHours}
                            onChange={(e) => setEditDurationHours(Number(e.target.value))}
                            className="w-16 bg-white border border-slate-300 rounded p-1 text-xs font-mono font-bold"
                          />
                          <span>hrs</span>
                        </div>
                      ) : (
                        formatDuration(log.durationSeconds)
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-2">
                      {isEditing ? (
                        <button
                          onClick={() => handleSaveEditedLog(log.id)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs inline-flex items-center gap-1 shadow-sm"
                        >
                          <Save className="w-3.5 h-3.5" /> Save
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleStartEditLog(log)}
                            className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                            title="Directly edit agent timesheet entry"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteTimeLog(log.id)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200"
                            title="Delete log"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
