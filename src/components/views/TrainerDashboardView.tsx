import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { downloadDesktopSoftwarePackage, DesktopOS } from '../../lib/desktopDownloader';
import { getManilaDateString } from '../../lib/dateUtils';
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
  Radio,
  Play,
  Pause,
  X,
  RefreshCw,
  Sparkles,
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
    addTimeLog,
    updateTimeLog,
    deleteTimeLog,
    updateUser,
    approveLeaveRequest,
    rejectLeaveRequest,
    formatDuration,
    startAgentLiveShift,
    stopAgentLiveShift,
    simulateActiveTraineesShift,
    syncAllFromGoogleSheets,
    triggerGoogleSheetsSync,
    googleSheetsWebhookUrl,
  } = useApp();

  const [isPullingSheets, setIsPullingSheets] = useState(false);
  const [isPushingSheets, setIsPushingSheets] = useState(false);
  const [trainerSyncMsg, setTrainerSyncMsg] = useState<string | null>(null);

  const handlePushToSheets = async () => {
    setIsPushingSheets(true);
    setTrainerSyncMsg('Syncing all agent shifts and timesheets to Google Sheets...');
    const res = await triggerGoogleSheetsSync();
    setIsPushingSheets(false);
    if (res && res.success) {
      setTrainerSyncMsg(`✓ ${res.message || 'Successfully updated Google Spreadsheet!'}`);
      setTimeout(() => setTrainerSyncMsg(null), 7000);
    } else {
      setTrainerSyncMsg(`Notice: ${res?.message || 'Check Webhook configuration'}`);
    }
  };

  // Desktop App OS Selection State
  const [selectedOS, setSelectedOS] = useState<DesktopOS>('windows');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Employee Management Search & Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Timesheet Override Search & Filter states
  const [timesheetSearch, setTimesheetSearch] = useState('');
  const [timesheetFilter, setTimesheetFilter] = useState<'all' | 'today' | 'recent'>('all');

  // Timesheet Override Edit & Add Modal State
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editTask, setEditTask] = useState('');
  const [editDurationHours, setEditDurationHours] = useState<number>(0);

  // Manual Add Timesheet Modal State
  const [showAddLogModal, setShowAddLogModal] = useState(false);
  const [newLogUserId, setNewLogUserId] = useState('');
  const [newLogDate, setNewLogDate] = useState(getManilaDateString());
  const [newLogTask, setNewLogTask] = useState('Email Reachout');
  const [newLogHours, setNewLogHours] = useState(8);
  const [newLogNotes, setNewLogNotes] = useState('Trainer direct manual entry');

  // Pagination states (10 per page as required)
  const ITEMS_PER_PAGE = 10;
  const [empPage, setEmpPage] = useState(1);
  const [agentPage, setAgentPage] = useState(1);
  const [timesheetPage, setTimesheetPage] = useState(1);
  const [idlePage, setIdlePage] = useState(1);
  const [leavePage, setLeavePage] = useState(1);

  // Reset timesheet page on search or filter change
  useEffect(() => {
    setTimesheetPage(1);
  }, [timesheetSearch, timesheetFilter]);

  // Reset employee page on search or filter change
  useEffect(() => {
    setEmpPage(1);
  }, [searchTerm, roleFilter]);

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

  // Direct manual time log creation by trainer
  const handleCreateDirectTimeLog = (e: React.FormEvent) => {
    e.preventDefault();
    const targetUser = users.find((u) => u.id === (newLogUserId || traineeAgents[0]?.id)) || currentUser;
    if (!targetUser) return;

    const todayDate = newLogDate || getManilaDateString();
    const startIso = `${todayDate}T09:00:00.000Z`;
    const endIso = `${todayDate}T17:00:00.000Z`;

    addTimeLog({
      userId: targetUser.id,
      userName: targetUser.name,
      userAvatar: '',
      designation: targetUser.designation || 'Agent',
      task: newLogTask as any,
      startTime: startIso,
      endTime: endIso,
      durationSeconds: Math.round(Number(newLogHours) * 3600),
      status: 'completed',
      geoTimezone: 'Asia/Manila',
      geoLocalStartTime: '09:00 AM',
      geoLocalEndTime: '05:00 PM',
      mouseActivityAvg: 95,
      keyboardActivityAvg: 92,
      idleSeconds: 0,
      date: todayDate,
      notes: newLogNotes || 'Trainer direct timesheet manual override',
      appsUsed: [{ appName: 'LLC Time Tracker Desktop App', icon: 'laptop', durationSeconds: Math.round(Number(newLogHours) * 3600), category: 'productive' }],
    });

    setShowAddLogModal(false);
  };

  // Quick populate today's timesheet logs for all active trainees
  const handleQuickPopulateTodayLogs = () => {
    const today = getManilaDateString();
    const targetAgents = traineeAgents.length > 0 ? traineeAgents.slice(0, 5) : users.filter(u => u.role === 'agent').slice(0, 5);

    targetAgents.forEach((agent) => {
      // Check if already logged today
      const alreadyLogged = timeLogs.some(l => l.userId === agent.id && l.date === today);
      if (!alreadyLogged) {
        addTimeLog({
          userId: agent.id,
          userName: agent.name,
          userAvatar: '',
          designation: agent.designation || 'Agent',
          task: 'Email Reachout',
          startTime: `${today}T09:00:00.000Z`,
          endTime: `${today}T17:00:00.000Z`,
          durationSeconds: 8 * 3600,
          status: 'completed',
          geoTimezone: 'Asia/Manila',
          geoLocalStartTime: '09:00 AM',
          geoLocalEndTime: '05:00 PM',
          mouseActivityAvg: 94,
          keyboardActivityAvg: 90,
          idleSeconds: 0,
          date: today,
          notes: 'Trainer auto-populated shift record for today',
          appsUsed: [{ appName: 'LLC Time Tracker Desktop App', icon: 'laptop', durationSeconds: 8 * 3600, category: 'productive' }],
        });
      }
    });
  };

  // Normalized and chronologically sorted time logs (Strictly Newest / Latest on top)
  const sortedFilteredTimeLogs: TimeLog[] = useMemo(() => {
    const query = timesheetSearch.trim().toLowerCase();
    const today = getManilaDateString();

    return [...timeLogs]
      .filter((log) => {
        const matchesSearch =
          !query ||
          log.userName.toLowerCase().includes(query) ||
          log.task.toLowerCase().includes(query) ||
          (log.userId && log.userId.toLowerCase().includes(query)) ||
          ((log as any).employeeCode && String((log as any).employeeCode).toLowerCase().includes(query));

        if (!matchesSearch) return false;

        if (timesheetFilter === 'today') {
          const normDate = log.date || (log.startTime ? log.startTime.split('T')[0] : '');
          return normDate === today;
        }
        return true;
      })
      .sort((a, b) => {
        const getTimestamp = (l: TimeLog) => {
          if (l.startTime && !isNaN(Date.parse(l.startTime))) {
            return new Date(l.startTime).getTime();
          }
          if (l.date) {
            // Treat YYYY-MM-DD as 23:59:59 to compare properly with earlier timestamps on same day if needed
            const parsed = new Date(`${l.date}T12:00:00Z`).getTime();
            if (!isNaN(parsed)) return parsed;
          }
          if ((l as any).timestamp) {
            const parsed = new Date((l as any).timestamp).getTime();
            if (!isNaN(parsed)) return parsed;
          }
          return 0;
        };
        const diff = getTimestamp(b) - getTimestamp(a);
        if (diff !== 0) return diff;
        // Secondary stable sort by date string descending
        return (b.date || '').localeCompare(a.date || '');
      });
  }, [timeLogs, timesheetSearch, timesheetFilter]);

  // Pagination Slice Helper
  const getPaginatedItems = <T,>(items: T[], page: number, perPage: number = ITEMS_PER_PAGE): T[] => {
    const startIndex = (page - 1) * perPage;
    return items.slice(startIndex, startIndex + perPage);
  };

  const totalEmpPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE) || 1;
  const totalAgentPages = Math.ceil(traineeAgents.length / ITEMS_PER_PAGE) || 1;
  const totalTimesheetPages = Math.ceil(sortedFilteredTimeLogs.length / ITEMS_PER_PAGE) || 1;
  const totalIdlePages = Math.ceil(sortedIdleLogs.length / ITEMS_PER_PAGE) || 1;
  const totalLeavePages = Math.ceil(pendingLeaves.length / ITEMS_PER_PAGE) || 1;

  const currentFilteredUsers: User[] = getPaginatedItems<User>(filteredUsers, empPage);
  const currentAgents: User[] = getPaginatedItems<User>(traineeAgents, agentPage);
  const currentTimeLogs: TimeLog[] = getPaginatedItems<TimeLog>(sortedFilteredTimeLogs, timesheetPage);
  const currentIdleLogs: IdleLog[] = getPaginatedItems<IdleLog>(sortedIdleLogs, idlePage);
  const currentLeaves: LeaveRequest[] = getPaginatedItems<LeaveRequest>(pendingLeaves, leavePage);

  const todayStr = getManilaDateString();

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
              {currentFilteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No employees match your search filter criteria.
                  </td>
                </tr>
              ) : (
                currentFilteredUsers.map((usr) => {
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

        {/* Employee Management Pagination Footer (10 per page) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 text-xs text-slate-600">
          <div>
            Showing {filteredUsers.length === 0 ? 0 : (empPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
            {Math.min(empPage * ITEMS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} employees (Page {empPage} of {totalEmpPages})
          </div>

          {totalEmpPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setEmpPage((p) => Math.max(1, p - 1))}
                disabled={empPage === 1}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition-all flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>

              {Array.from({ length: totalEmpPages }, (_, i) => i + 1).map((pNum) => (
                <button
                  key={pNum}
                  onClick={() => setEmpPage(pNum)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                    empPage === pNum
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {pNum}
                </button>
              ))}

              <button
                onClick={() => setEmpPage((p) => Math.min(totalEmpPages, p + 1))}
                disabled={empPage === totalEmpPages}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition-all flex items-center gap-1"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
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
                Showing {currentAgents.length} of {traineeAgents.length} active agents/trainees (Page {agentPage} of {totalAgentPages} • 10 per page)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
              <button
                onClick={async () => {
                  setIsPullingSheets(true);
                  await syncAllFromGoogleSheets();
                  setIsPullingSheets(false);
                }}
                disabled={isPullingSheets}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                title="Pull real-time presence & trainee data directly from Google Sheets"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPullingSheets ? 'animate-spin' : ''}`} />
                <span>{isPullingSheets ? 'Pulling Sheets...' : 'Pull Google Sheets'}</span>
              </button>

              {/* Pagination Controls */}
              {totalAgentPages > 1 && (
                <div className="flex items-center gap-1.5">
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentAgents.map((agent) => {
              const agentAllLogs = timeLogs.filter((l) => l.userId === agent.id);
              const lastLog = agentAllLogs[0];
              const agentTodayLogs = agentAllLogs.filter((l) => l.date === todayStr);
              const baseTodaySec = agentTodayLogs.reduce((acc, l) => acc + l.durationSeconds, 0);

              const presence = userPresenceList.find(
                (p) =>
                  p.userId === agent.id ||
                  (p.employeeCode && agent.employeeCode && p.employeeCode.toUpperCase() === agent.employeeCode.toUpperCase()) ||
                  (p.userName && agent.name && p.userName.toLowerCase().trim() === agent.name.toLowerCase().trim())
              );
              const now = Date.now();
              const lastHeartbeat = presence ? new Date(presence.lastHeartbeat).getTime() : 0;
              const isRecent = now - lastHeartbeat < 5 * 60 * 1000;
              const isDesktopPlatform =
                presence?.loginPlatform === 'software' ||
                presence?.currentApp?.toLowerCase().includes('desktop') ||
                !!presence?.isTracking;
              const isWebPlatform =
                presence?.loginPlatform === 'webapp' ||
                (!isDesktopPlatform && (presence?.isOnline || isRecent));

              const isTracking = !!presence?.isTracking && (isRecent || !!presence?.isOnline);
              const isIdle = (isDesktopPlatform || isTracking) && (presence?.status === 'idle' || !!presence?.isPaused);
              const isDesktopOnline = isDesktopPlatform && (presence?.isOnline || isRecent) && !isTracking && !isIdle;
              const isWebOnline = isWebPlatform && (presence?.isOnline || isRecent) && !isTracking && !isDesktopOnline && !isIdle;
              const isOffline = !isTracking && !isDesktopOnline && !isWebOnline && !isIdle;

              const liveActiveSec = isTracking ? (presence?.elapsedSeconds || 0) : 0;
              const totalTodayTrackedSec = baseTodaySec + liveActiveSec;

              let currentTask = 'Shift Concluded';
              if (isTracking) {
                currentTask = presence?.currentTask || lastLog?.task || 'Active Task In Progress';
              } else if (isDesktopOnline) {
                currentTask = 'Desktop App Standby (Timer Not Started)';
              } else if (isWebOnline) {
                currentTask = presence?.currentTask || 'Web Portal Active';
              } else if (isIdle) {
                currentTask = `Paused (${presence?.currentTask || lastLog?.task || 'Break'})`;
              } else {
                currentTask = 'Shift Concluded';
              }

              // Device timezone (simple, non-complicated device timezone)
              const deviceTimezoneDisplay = agent.geoTimezone
                ? `${agent.geoTimezone} (GMT+8)`
                : 'Asia/Manila (GMT+8)';

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
                    {isDesktopOnline && (
                      <span className="bg-blue-100 text-blue-800 border border-blue-200 text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        Desktop Online
                      </span>
                    )}
                    {isWebOnline && (
                      <span className="bg-teal-100 text-teal-800 border border-teal-200 text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                        Web Online
                      </span>
                    )}
                    {isIdle && (
                      <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Idle / Break
                      </span>
                    )}
                    {isOffline && (
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
                      <span className="text-indigo-700 font-bold truncate max-w-[150px] text-right" title={currentTask}>
                        {currentTask}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-700 pt-1 border-t border-slate-100 text-[11px]">
                      <span className="text-slate-400">Device Timezone:</span>
                      <span className="text-blue-600 font-mono font-medium">{deviceTimezoneDisplay}</span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      {isTracking ? (
                        <div className="w-full flex items-center justify-between bg-emerald-50/80 border border-emerald-200/80 rounded-lg px-2.5 py-1.5 text-[11px]">
                          <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            Auto-Tracking Active
                          </span>
                          <button
                            onClick={() => stopAgentLiveShift(agent.id)}
                            className="text-[10px] text-red-600 hover:text-red-800 font-bold underline cursor-pointer"
                            title="Force conclude active shift"
                          >
                            Conclude
                          </button>
                        </div>
                      ) : isDesktopOnline ? (
                        <div className="w-full bg-blue-50/80 border border-blue-200/80 rounded-lg px-2.5 py-1.5 text-[11px] text-blue-700 font-semibold flex items-center justify-center gap-1.5">
                          <Laptop className="w-3.5 h-3.5 text-blue-600" />
                          <span>Desktop App Connected (Auto-Standby)</span>
                        </div>
                      ) : isWebOnline ? (
                        <div className="w-full bg-teal-50/80 border border-teal-200/80 rounded-lg px-2.5 py-1.5 text-[11px] text-teal-700 font-semibold flex items-center justify-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-teal-600" />
                          <span>Web Portal Connected (Auto-Standby)</span>
                        </div>
                      ) : (
                        <div className="w-full flex items-center justify-between bg-slate-100/80 border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-[11px]">
                          <span className="text-slate-500 font-medium flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Offline
                          </span>
                          <button
                            onClick={() => startAgentLiveShift(agent.id)}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
                            title="Start live shift for this trainee"
                          >
                            <Play className="w-3 h-3" />
                            Start Shift
                          </button>
                        </div>
                      )}
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" /> Trainer Direct Timesheet Override Controls
            </h3>
            <p className="text-xs text-slate-500">
              Sorted from <strong>latest to oldest</strong>. Trainers can update or correct agent time entries directly without waiting for manual request submissions.
            </p>
          </div>

          {/* Search & Period Filter & Add Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
            <button
              onClick={() => {
                setNewLogUserId(traineeAgents[0]?.id || users.find(u => u.role === 'agent')?.id || currentUser?.id || '');
                setNewLogDate(getManilaDateString());
                setNewLogTask('Email Reachout');
                setNewLogHours(8);
                setShowAddLogModal(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Add a manual timesheet entry for any trainee or agent directly"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Timesheet Entry</span>
            </button>

            <button
              onClick={handlePushToSheets}
              disabled={isPushingSheets}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              title="Force push timesheets and shift logs to Google Sheets"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPushingSheets ? 'animate-spin' : ''}`} />
              <span>{isPushingSheets ? 'Syncing...' : '⚡ Push to Google Sheets'}</span>
            </button>

            <button
              onClick={handleQuickPopulateTodayLogs}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Quickly populate standard shift records for today for active trainees"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>⚡ Populate Today's Shifts</span>
            </button>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all shadow-sm flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={timesheetSearch}
                onChange={(e) => {
                  setTimesheetSearch(e.target.value);
                  setTimesheetPage(1);
                }}
                placeholder="Search agent or task..."
                className="bg-transparent text-slate-800 text-xs font-medium focus:outline-none w-full"
              />
              {timesheetSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setTimesheetSearch('');
                    setTimesheetPage(1);
                  }}
                  className="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => {
                  setTimesheetFilter('all');
                  setTimesheetPage(1);
                }}
                className={`px-3 py-1 rounded-lg transition-all ${
                  timesheetFilter === 'all'
                    ? 'bg-white text-indigo-700 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Logs
              </button>
              <button
                onClick={() => {
                  setTimesheetFilter('today');
                  setTimesheetPage(1);
                }}
                className={`px-3 py-1 rounded-lg transition-all ${
                  timesheetFilter === 'today'
                    ? 'bg-white text-indigo-700 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Today ({getManilaDateString()})
              </button>
            </div>
          </div>
        </div>

        {trainerSyncMsg && (
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 text-xs flex items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{trainerSyncMsg}</span>
            </div>
            <button
              onClick={() => setTrainerSyncMsg(null)}
              className="text-indigo-500 hover:text-indigo-700 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Agent Name</th>
                <th className="py-3 px-4">Date & Session Time (Latest First)</th>
                <th className="py-3 px-4">Task Category</th>
                <th className="py-3 px-4">Logged Duration</th>
                <th className="py-3 px-4 text-right">Trainer Direct Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {currentTimeLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    <div className="max-w-md mx-auto space-y-3">
                      <Clock className="w-8 h-8 text-indigo-400 mx-auto" />
                      <div className="font-bold text-slate-800 text-sm">
                        {timesheetFilter === 'today'
                          ? `No timesheet records recorded for today (${getManilaDateString()}) yet.`
                          : 'No timesheet logs matching your filters.'}
                      </div>
                      <p className="text-xs text-slate-500">
                        {timesheetFilter === 'today'
                          ? 'Timesheet records automatically generate when agents start tracking on the desktop software, or you can record entries directly now.'
                          : 'Try resetting your search query or switching filters.'}
                      </p>
                      {timesheetFilter === 'today' && (
                        <div className="flex items-center justify-center gap-2 pt-2">
                          <button
                            onClick={handleQuickPopulateTodayLogs}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                          >
                            ⚡ Auto-Populate Today's Shifts for Trainees
                          </button>
                          <button
                            onClick={() => {
                              setNewLogUserId(traineeAgents[0]?.id || '');
                              setNewLogDate(getManilaDateString());
                              setShowAddLogModal(true);
                            }}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                          >
                            + Add Single Time Log
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                currentTimeLogs.map((log) => {
                  const isEditing = editingLogId === log.id;

                  // Clean date and time range formatting
                  const formatCleanTime = (timeStr?: string) => {
                    if (!timeStr) return '';
                    if (timeStr.includes('T') || timeStr.endsWith('Z')) {
                      const d = new Date(timeStr);
                      if (!isNaN(d.getTime())) {
                        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                      }
                    }
                    return timeStr;
                  };

                  const cleanStartTime = formatCleanTime(log.startTime);
                  const cleanEndTime = formatCleanTime(log.endTime);
                  const timeRangeStr = cleanStartTime && cleanEndTime
                    ? `${cleanStartTime} - ${cleanEndTime}`
                    : cleanStartTime
                    ? `Started ${cleanStartTime}`
                    : 'Full Shift';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                            {log.userName.charAt(0)}
                          </div>
                          <span>{log.userName}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        <div className="font-semibold text-slate-900">{log.date}</div>
                        <div className="text-[11px] text-slate-500">{timeRangeStr}</div>
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
                          <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100/80">
                            {log.task}
                          </span>
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
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Timesheet Override Pagination Controls (10 per page) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 text-xs text-slate-600">
          <div>
            Showing {sortedFilteredTimeLogs.length === 0 ? 0 : (timesheetPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
            {Math.min(timesheetPage * ITEMS_PER_PAGE, sortedFilteredTimeLogs.length)} of {sortedFilteredTimeLogs.length} timesheet logs (Page {timesheetPage} of {totalTimesheetPages})
          </div>

          {totalTimesheetPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setTimesheetPage((p) => Math.max(1, p - 1))}
                disabled={timesheetPage === 1}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition-all flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>

              {Array.from({ length: totalTimesheetPages }, (_, i) => i + 1).map((pNum) => (
                <button
                  key={pNum}
                  onClick={() => setTimesheetPage(pNum)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                    timesheetPage === pNum
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {pNum}
                </button>
              ))}

              <button
                onClick={() => setTimesheetPage((p) => Math.min(totalTimesheetPages, p + 1))}
                disabled={timesheetPage === totalTimesheetPages}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition-all flex items-center gap-1"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Direct Add Timesheet Entry Modal */}
      {showAddLogModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Direct Timesheet Entry</h3>
              </div>
              <button
                onClick={() => setShowAddLogModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDirectTimeLog} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Target Employee / Trainee</label>
                <select
                  value={newLogUserId}
                  onChange={(e) => setNewLogUserId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                >
                  <option value="" disabled>Select Employee</option>
                  {users
                    .filter(u => u.role !== 'admin' && !u.isSecretBackup)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role.toUpperCase()} • {u.employeeCode || u.designation || 'Staff'})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Date</label>
                  <input
                    type="date"
                    value={newLogDate}
                    onChange={(e) => setNewLogDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Hours Logged</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="24"
                    value={newLogHours}
                    onChange={(e) => setNewLogHours(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Task Category / Activity</label>
                <input
                  type="text"
                  value={newLogTask}
                  onChange={(e) => setNewLogTask(e.target.value)}
                  placeholder="e.g. Email Reachout, Training, Customer Support"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Trainer Notes / Justification</label>
                <textarea
                  value={newLogNotes}
                  onChange={(e) => setNewLogNotes(e.target.value)}
                  placeholder="Reason for direct entry or shift details..."
                  rows={2}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddLogModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-xs"
                >
                  Save Timesheet Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
