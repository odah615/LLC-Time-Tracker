import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { PasswordResetModal } from '../modals/PasswordResetModal';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { downloadDesktopSoftwarePackage, DesktopOS } from '../../lib/desktopDownloader';
import {
  Users,
  Shield,
  Plus,
  Trash2,
  Edit,
  DollarSign,
  Clock,
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  Activity,
  Settings,
  AlertCircle,
  FileText,
  Camera,
  CheckCircle2,
  Sliders,
  Check,
  Laptop,
  MousePointer,
  Keyboard,
  Monitor,
  Download,
  ChevronLeft,
  ChevronRight,
  Circle,
  UserCheck,
  Building2,
  Database,
  Radio,
  ExternalLink,
  Calendar,
  ShieldCheck,
  KeyRound,
  Lock,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import { User, Designation, UserRole } from '../../types';
import { UserAvatar } from '../UserAvatar';

interface AdminDashboardViewProps {
  onOpenAddUserModal: () => void;
  onEditUser: (user: User) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  onOpenAddUserModal,
  onEditUser,
}) => {
  const {
    users,
    timeLogs,
    screenshots,
    idleLogs,
    updateUser,
    deleteUser,
    resetUserPassword,
    formatDuration,
    currentUser,
    addAuditLog,
    setIsDesktopDockView,
  } = useApp();

  // Password Reset Modal State
  const [resetModalUser, setResetModalUser] = useState<User | null>(null);

  // Generic Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title?: string;
    description?: string;
    employeeName?: string;
    employeeCode?: string;
    fromValue?: string;
    toValue?: string;
    confirmText?: string;
    variant?: 'warning' | 'danger' | 'info';
    action?: () => void;
  }>({ isOpen: false });

  // Desktop App OS Selection State
  const [selectedOS, setSelectedOS] = useState<DesktopOS>('windows');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Timeframe state & Date pickers for charts
  const [chartTimeframe, setChartTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [anchorDate, setAnchorDate] = useState<string>('2026-08-10');
  const [weekStartDate, setWeekStartDate] = useState<string>('2026-08-10');
  const [weekEndDate, setWeekEndDate] = useState<string>('2026-08-16');
  const [selectedMonth, setSelectedMonth] = useState<number>(7); // 7 = August
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  // Pagination states for Live Tracking Table sub-lists
  const [teamLeadersPage, setTeamLeadersPage] = useState(1);
  const teamLeadersPageSize = 5;

  const [agentsStaffPage, setAgentsStaffPage] = useState(1);
  const agentsStaffPageSize = 5;

  // Pagination state for Employee Directory
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Helper date formatter DD/MM/YYYY
  const formatDateDDMMYYYY = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    return `${day}/${month}/${year}`;
  };

  // Confirmation Prompts for Actions
  const handleRoleChangePrompt = (usr: User, newRole: string) => {
    if (usr.role === newRole) return;
    const roleMap: Record<string, string> = {
      agent: 'Agent',
      team_lead: 'Team Leader',
      trainer: 'Trainer',
      va_admin: 'VA Admin',
      admin: 'Main Admin',
    };

    const fromRole = roleMap[usr.role] || usr.role;
    const toRole = roleMap[newRole] || newRole;

    setConfirmModal({
      isOpen: true,
      title: 'Confirm System Role Change',
      description: `Are you sure you want to change the system role for ${usr.name}? This will immediately update their application permissions and dashboard access.`,
      employeeName: usr.name,
      employeeCode: usr.employeeCode,
      fromValue: fromRole,
      toValue: toRole,
      confirmText: 'Yes, Change Role',
      variant: 'warning',
      action: () => {
        let newDesig = usr.designation;
        if (newRole === 'agent') newDesig = 'Sales Agent' as any;
        else if (newRole === 'team_lead') newDesig = 'Team Lead' as any;
        else if (newRole === 'trainer') newDesig = 'Trainer' as any;
        else if (newRole === 'va_admin') newDesig = 'VA Operations Admin' as any;
        else if (newRole === 'admin') newDesig = 'Admin' as any;

        updateUser(usr.id, { role: newRole as any, designation: newDesig });
        addAuditLog({
          actorId: currentUser.id,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          category: 'Role Change',
          targetEmployeeId: usr.id,
          targetEmployeeName: usr.name,
          fromValue: fromRole,
          toValue: toRole,
          details: `Changed system role for ${usr.name} from ${fromRole} to ${toRole}.`,
        });
      },
    });
  };

  const handleReassignSupervisorPrompt = (usr: User, newLeaderId: string) => {
    if ((usr.teamLeaderId || '') === newLeaderId) return;

    const oldLeader = users.find((u) => u.id === usr.teamLeaderId);
    const newLeader = users.find((u) => u.id === newLeaderId);

    const fromVal = oldLeader ? `${oldLeader.name} (${oldLeader.designation})` : 'None / Direct';
    const toVal = newLeader ? `${newLeader.name} (${newLeader.designation})` : 'None / Direct';

    setConfirmModal({
      isOpen: true,
      title: 'Confirm Supervisor Reassignment',
      description: `Are you sure you want to reassign the reporting team leader for ${usr.name}?`,
      employeeName: usr.name,
      employeeCode: usr.employeeCode,
      fromValue: fromVal,
      toValue: toVal,
      confirmText: 'Yes, Reassign Supervisor',
      variant: 'info',
      action: () => {
        updateUser(usr.id, { teamLeaderId: newLeaderId || undefined });
        addAuditLog({
          actorId: currentUser.id,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          category: 'Supervisor Reassign',
          targetEmployeeId: usr.id,
          targetEmployeeName: usr.name,
          fromValue: fromVal,
          toValue: toVal,
          details: `Reassigned team leader supervisor for ${usr.name} to ${toVal}.`,
        });
      },
    });
  };

  const handleToggleScreenshotPrompt = (usr: User, currentVal?: boolean) => {
    const isCurrentlyOn = currentVal ?? true;
    const fromVal = isCurrentlyOn ? 'Screenshot Monitoring ON' : 'Screenshot Monitoring OFF';
    const toVal = !isCurrentlyOn ? 'Screenshot Monitoring ON' : 'Screenshot Monitoring OFF';

    setConfirmModal({
      isOpen: true,
      title: 'Confirm Screenshot Surveillance Change',
      description: `Are you sure you want to turn ${isCurrentlyOn ? 'OFF' : 'ON'} desktop screenshot capture monitoring for ${usr.name}?`,
      employeeName: usr.name,
      employeeCode: usr.employeeCode,
      fromValue: fromVal,
      toValue: toVal,
      confirmText: `Yes, Turn ${!isCurrentlyOn ? 'ON' : 'OFF'}`,
      variant: 'warning',
      action: () => {
        updateUser(usr.id, { screenshotMonitored: !isCurrentlyOn });
        addAuditLog({
          actorId: currentUser.id,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          category: 'Screenshot Monitor Toggle',
          targetEmployeeId: usr.id,
          targetEmployeeName: usr.name,
          fromValue: fromVal,
          toValue: toVal,
          details: `Toggled screenshot surveillance for ${usr.name} to ${toVal}.`,
        });
      },
    });
  };

  const handleToggleActivityPrompt = (usr: User, currentVal?: boolean) => {
    const isCurrentlyOn = currentVal ?? true;
    const fromVal = isCurrentlyOn ? 'Activity Monitoring ON' : 'Activity Monitoring OFF';
    const toVal = !isCurrentlyOn ? 'Activity Monitoring ON' : 'Activity Monitoring OFF';

    setConfirmModal({
      isOpen: true,
      title: 'Confirm Activity Monitoring Change',
      description: `Are you sure you want to turn ${isCurrentlyOn ? 'OFF' : 'ON'} mouse and keyboard activity tracking for ${usr.name}?`,
      employeeName: usr.name,
      employeeCode: usr.employeeCode,
      fromValue: fromVal,
      toValue: toVal,
      confirmText: `Yes, Turn ${!isCurrentlyOn ? 'ON' : 'OFF'}`,
      variant: 'warning',
      action: () => {
        updateUser(usr.id, { activityMonitored: !isCurrentlyOn });
        addAuditLog({
          actorId: currentUser.id,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          category: 'Activity Monitor Toggle',
          targetEmployeeId: usr.id,
          targetEmployeeName: usr.name,
          fromValue: fromVal,
          toValue: toVal,
          details: `Toggled activity monitoring for ${usr.name} to ${toVal}.`,
        });
      },
    });
  };

  const handleDeleteUserPrompt = (usr: User) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirm Employee Removal',
      description: `Are you sure you want to permanently remove ${usr.name} (#${usr.employeeCode}) from the organization? This action will archive their record.`,
      employeeName: usr.name,
      employeeCode: usr.employeeCode,
      fromValue: 'Active Employee',
      toValue: 'Removed / Terminated',
      confirmText: 'Yes, Remove Employee',
      variant: 'danger',
      action: () => {
        deleteUser(usr.id);
        addAuditLog({
          actorId: currentUser.id,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          category: 'Employee Deleted',
          targetEmployeeId: usr.id,
          targetEmployeeName: usr.name,
          fromValue: 'Active Employee',
          toValue: 'Removed',
          details: `Permanently deleted employee record for ${usr.name} (${usr.employeeCode}).`,
        });
      },
    });
  };

  // Download Desktop Time Tracker trigger
  const handleDownloadApp = (os: DesktopOS = selectedOS) => {
    downloadDesktopSoftwarePackage(os);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 5000);
  };

  // Aggregate stats
  const totalUsers = users.length;
  const totalLoggedSec = timeLogs.reduce((acc, l) => acc + l.durationSeconds, 0);
  const totalLoggedHours = (totalLoggedSec / 3600).toFixed(1);

  // Group Users into Team Leaders vs Agents/Staff
  const teamLeaders = useMemo(() => {
    return users.filter((u) => u.role === 'team_lead');
  }, [users]);

  const agentsAndStaff = useMemo(() => {
    return users.filter((u) => u.role === 'agent' || u.role === 'trainer');
  }, [users]);

  // Paginated Team Leaders list
  const totalTeamLeadPages = Math.ceil(teamLeaders.length / teamLeadersPageSize) || 1;
  const safeTLPage = Math.min(teamLeadersPage, totalTeamLeadPages);
  const paginatedTeamLeaders = useMemo(() => {
    const start = (safeTLPage - 1) * teamLeadersPageSize;
    return teamLeaders.slice(start, start + teamLeadersPageSize);
  }, [teamLeaders, safeTLPage, teamLeadersPageSize]);

  // Paginated Agents & Staff list
  const totalAgentsPages = Math.ceil(agentsAndStaff.length / agentsStaffPageSize) || 1;
  const safeAgentsPage = Math.min(agentsStaffPage, totalAgentsPages);
  const paginatedAgentsStaff = useMemo(() => {
    const start = (safeAgentsPage - 1) * agentsStaffPageSize;
    return agentsAndStaff.slice(start, start + agentsStaffPageSize);
  }, [agentsAndStaff, safeAgentsPage, agentsStaffPageSize]);

  // Filter time logs based on chartTimeframe and selected date pickers
  const filteredLogsForCharts = useMemo(() => {
    if (chartTimeframe === 'daily') {
      return timeLogs.filter((l) => l.date === anchorDate);
    } else if (chartTimeframe === 'weekly') {
      return timeLogs.filter((l) => l.date >= weekStartDate && l.date <= weekEndDate);
    } else {
      // Monthly filter
      return timeLogs.filter((l) => {
        const d = new Date(l.date);
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      });
    }
  }, [timeLogs, chartTimeframe, anchorDate, weekStartDate, weekEndDate, selectedMonth, selectedYear]);

  // Bar Chart Data: Hours tracked by Task Category according to timeframe and date pickers
  const taskChartData = useMemo(() => {
    const taskHoursMap: Record<string, number> = {};

    if (filteredLogsForCharts.length > 0) {
      filteredLogsForCharts.forEach((log) => {
        const hours = log.durationSeconds / 3600;
        taskHoursMap[log.task] = (taskHoursMap[log.task] || 0) + hours;
      });
    }

    return Object.keys(taskHoursMap).map((task) => ({
      name: task.length > 15 ? task.substring(0, 15) + '...' : task,
      fullTask: task,
      hours: Number(taskHoursMap[task].toFixed(1)),
    }));
  }, [filteredLogsForCharts]);

  // App Usage Breakdown according to timeframe
  const appPieData = useMemo(() => {
    const appMap: Record<string, number> = {};
    let totalAppCount = 0;

    filteredLogsForCharts.forEach((log) => {
      if (log.appsUsed && log.appsUsed.length > 0) {
        log.appsUsed.forEach((app) => {
          const name = app.appName || 'Other Apps';
          appMap[name] = (appMap[name] || 0) + (app.activeTimeSeconds || 60);
          totalAppCount += (app.activeTimeSeconds || 60);
        });
      }
    });

    if (totalAppCount === 0) {
      return [];
    }

    const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];
    return Object.keys(appMap).map((appName, index) => {
      const pct = Math.round((appMap[appName] / totalAppCount) * 100);
      return {
        name: appName,
        value: pct,
        color: colors[index % colors.length],
      };
    });
  }, [filteredLogsForCharts]);

  // Filter out secret emergency backup account from employee directory
  const visibleUsers = useMemo(() => users.filter((u) => !u.isSecretBackup), [users]);

  // Distinct departments count
  const activeDepartments = useMemo(() => {
    const depts = new Set(users.map((u) => u.department || 'Operations'));
    return Array.from(depts);
  }, [users]);

  // Pagination calculations for Employee Directory
  const totalPages = Math.ceil(visibleUsers.length / pageSize) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const paginatedUsers = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return visibleUsers.slice(start, start + pageSize);
  }, [visibleUsers, safePage, pageSize]);

  return (
    <div id="admin-dashboard-view" className="space-y-6">
      {/* 1. Download LLC Time Tracker Desktop Software Section (First Section) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 border border-slate-700/80 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <Laptop className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-base text-white">LLC Time Tracker Desktop Software</h3>
                <span className="text-[10px] bg-emerald-900/80 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded-full font-mono font-bold">
                  v1.0 Native Desktop Client
                </span>
              </div>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Download the standalone cross-platform software for Windows, macOS, or Linux. Quietly monitors shifts, records active work, captures periodic screen snapshots, and auto-syncs to the central database.
              </p>

              {/* OS Choice Selector Tabs */}
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOS('windows')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    selectedOS === 'windows'
                      ? 'bg-blue-600 text-white shadow-md border border-blue-400'
                      : 'bg-slate-900/90 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  🖥️ Windows PC (.exe / .bat)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOS('mac')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    selectedOS === 'mac'
                      ? 'bg-indigo-600 text-white shadow-md border border-indigo-400'
                      : 'bg-slate-900/90 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  🍎 macOS (Apple .app)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOS('linux')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    selectedOS === 'linux'
                      ? 'bg-amber-600 text-white shadow-md border border-amber-400'
                      : 'bg-slate-900/90 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  🐧 Linux OS (Binary)
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full lg:w-auto">
            <button
              onClick={() => handleDownloadApp(selectedOS)}
              className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              {downloadSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-200" />
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

            <button
              onClick={() => setIsDesktopDockView(true)}
              className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-600 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              title="Launch In-Browser Desktop Tracker Dock Preview"
            >
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Launch Desktop View</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Admin Operations & Control Center Section (Second Section) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 border border-slate-700/80 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-rose-900/60 text-rose-200 border border-rose-700/60 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Shield className="w-3 h-3 text-rose-400" /> Administrator Access
              </span>
              <span className="bg-emerald-900/50 text-emerald-300 border border-emerald-700/60 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Cloud Database Connected
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-white">Admin Operations & Control Center</h2>
            <p className="text-xs text-slate-300 mt-1">
              Full system authority over employee records, role assignments, live operations, activity monitoring, and payroll.
            </p>
          </div>

          <button
            onClick={onOpenAddUserModal}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all hover:scale-[1.02] shrink-0"
          >
            <Plus className="w-4 h-4" /> Add New Employee
          </button>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Registered Employees</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{totalUsers} Staff Members</div>
          <p className="text-[11px] text-slate-500 mt-1">Agents, Team Leads, Trainers & Admin</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Total System Time</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 font-mono">{totalLoggedHours} hrs</div>
          <p className="text-[11px] text-slate-500 mt-1">Across all task logs and sessions</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Active Operational Units</span>
            <Building2 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold text-purple-700">
            {activeDepartments.length} {activeDepartments.length === 1 ? 'Unit' : 'Units'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            {activeDepartments.length > 0 ? activeDepartments.join(', ') : 'No departments assigned'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">System & Database Status</span>
            <Database className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-extrabold text-indigo-700 flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Healthy
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Cloud SQL & Live Sync Active</p>
        </div>
      </div>

      {/* Live Tracking Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <Radio className="w-5 h-5 text-emerald-600 animate-pulse" /> Live Tracking Table
            </h3>
            <p className="text-xs text-slate-500">
              Real-time overview of logged-in Team Leaders, Trainers, and Agents along with their active tasks.
            </p>
          </div>
          <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Live Tracking Feed
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sub-section 1: Team Leaders Status (Paginated 5 per page) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-amber-600" /> Team Leaders ({teamLeaders.length})
                </h4>
                <span className="text-[10px] font-bold text-slate-500">Supervisory Status</span>
              </div>

              <div className="space-y-2.5 min-h-[200px]">
                {teamLeaders.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-10 text-center text-slate-400">
                    <Shield className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-xs font-semibold text-slate-600">No Team Leaders Added Yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Use "Add New Employee" to register a Team Leader.</p>
                  </div>
                ) : (
                  paginatedTeamLeaders.map((tl) => {
                    const userTodayLogs = timeLogs.filter((l) => l.userId === tl.id && l.date === anchorDate);
                    const userTotalSec = userTodayLogs.reduce((acc, l) => acc + l.durationSeconds, 0);
                    const latestLog = userTodayLogs[0] || timeLogs.find((l) => l.userId === tl.id);
                    const avgAct = userTodayLogs.length > 0
                      ? Math.round(userTodayLogs.reduce((acc, l) => acc + (l.mouseActivityAvg + l.keyboardActivityAvg) / 2, 0) / userTodayLogs.length)
                      : 0;

                    return (
                      <div
                        key={tl.id}
                        className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <UserAvatar
                              name={tl.name}
                              role={tl.role}
                              size="lg"
                            />
                            <span
                              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white ${userTodayLogs.length > 0 ? 'bg-emerald-500' : 'bg-slate-400'}`}
                              title={userTodayLogs.length > 0 ? 'Active Today' : 'Offline'}
                            />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                              <span>{tl.name}</span>
                              <span className="bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                Team Lead
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-medium">
                              Active Task: <strong className="text-slate-800">{latestLog?.task || 'No Active Task / Offline'}</strong>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              App Window: <span className="font-mono">{latestLog?.appsUsed?.[0]?.appName || 'None'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-left sm:text-right text-xs shrink-0 bg-slate-50 sm:bg-transparent p-2 sm:p-0 rounded-lg w-full sm:w-auto">
                          <div className="text-emerald-700 font-extrabold flex items-center sm:justify-end gap-1">
                            <Clock className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{(userTotalSec / 3600).toFixed(1)}h Today</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Keyboard & Mouse: <strong className="text-slate-800">{avgAct}% Avg Activity</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Team Leaders Pagination Controls */}
            {teamLeaders.length > 0 && (
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 font-medium">
                <span>
                  Page {safeTLPage} of {totalTeamLeadPages} ({teamLeaders.length} Team Leaders)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={safeTLPage <= 1}
                    onClick={() => setTeamLeadersPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={safeTLPage >= totalTeamLeadPages}
                    onClick={() => setTeamLeadersPage((p) => Math.min(totalTeamLeadPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    title="Next Page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sub-section 2: Agents & Staff Status (Paginated 5 per page) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-600" /> Agents & Staff ({agentsAndStaff.length})
                </h4>
                <span className="text-[10px] font-bold text-slate-500">Operational Activity</span>
              </div>

              <div className="space-y-2.5 min-h-[200px]">
                {agentsAndStaff.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-10 text-center text-slate-400">
                    <Users className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-xs font-semibold text-slate-600">No Agents or Trainers Added Yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Click "Add New Employee" to start onboarding team members.</p>
                  </div>
                ) : (
                  paginatedAgentsStaff.map((st) => {
                    const userTodayLogs = timeLogs.filter((l) => l.userId === st.id && l.date === anchorDate);
                    const userTotalSec = userTodayLogs.reduce((acc, l) => acc + l.durationSeconds, 0);
                    const latestLog = userTodayLogs[0] || timeLogs.find((l) => l.userId === st.id);
                    const avgAct = userTodayLogs.length > 0
                      ? Math.round(userTodayLogs.reduce((acc, l) => acc + (l.mouseActivityAvg + l.keyboardActivityAvg) / 2, 0) / userTodayLogs.length)
                      : 0;

                    return (
                      <div
                        key={st.id}
                        className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <UserAvatar
                              name={st.name}
                              role={st.role}
                              size="lg"
                            />
                            <span
                              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white ${userTodayLogs.length > 0 ? 'bg-emerald-500' : 'bg-slate-400'}`}
                              title={userTodayLogs.length > 0 ? 'Active Today' : 'Offline'}
                            />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                              <span>{st.name}</span>
                              <span className="bg-blue-50 border border-blue-200 text-blue-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                {st.role === 'trainer' ? 'Trainer' : 'Agent'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-medium">
                              Active Task: <strong className="text-slate-800">{latestLog?.task || 'No Active Task / Offline'}</strong>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              App Window: <span className="font-mono">{latestLog?.appsUsed?.[0]?.appName || 'None'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-left sm:text-right text-xs shrink-0 bg-slate-50 sm:bg-transparent p-2 sm:p-0 rounded-lg w-full sm:w-auto">
                          <div className="text-emerald-700 font-extrabold flex items-center sm:justify-end gap-1">
                            <Clock className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{(userTotalSec / 3600).toFixed(1)}h Today</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Keyboard & Mouse: <strong className="text-slate-800">{avgAct}% Avg Activity</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Agents & Staff Pagination Controls */}
            {agentsAndStaff.length > 0 && (
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 font-medium">
                <span>
                  Page {safeAgentsPage} of {totalAgentsPages} ({agentsAndStaff.length} Agents)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={safeAgentsPage <= 1}
                    onClick={() => setAgentsStaffPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={safeAgentsPage >= totalAgentsPages}
                    onClick={() => setAgentsStaffPage((p) => Math.min(totalAgentsPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    title="Next Page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analytics Charts with Date Range & Timeframe Pickers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Hours Tracked by Task Category */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" /> Hours Tracked by Task Category
              </h3>
              <p className="text-xs text-slate-500">Total work volume logged per operational task</p>
            </div>

            {/* Timeframe & Date Picker Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  onClick={() => setChartTimeframe('daily')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    chartTimeframe === 'daily'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setChartTimeframe('weekly')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    chartTimeframe === 'weekly'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setChartTimeframe('monthly')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    chartTimeframe === 'monthly'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Monthly
                </button>
              </div>

              {/* Dynamic Date Range Pickers according to active tab */}
              {chartTimeframe === 'daily' && (
                <div className="relative flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm hover:bg-slate-100/80 transition-all cursor-pointer">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0 pointer-events-none" />
                  <span className="text-xs font-semibold text-slate-500 select-none pointer-events-none">Date:</span>
                  <span className="text-xs font-bold text-slate-800 pointer-events-none font-mono">
                    {formatDateDDMMYYYY(anchorDate)}
                  </span>
                  <input
                    type="date"
                    value={anchorDate}
                    onChange={(e) => setAnchorDate(e.target.value)}
                    onClick={(e) => {
                      try {
                        (e.currentTarget as HTMLInputElement).showPicker?.();
                      } catch {}
                    }}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                </div>
              )}

              {chartTimeframe === 'weekly' && (
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm hover:bg-slate-100/80 transition-all">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0 pointer-events-none" />
                  <div className="relative flex items-center gap-1 cursor-pointer">
                    <span className="text-[11px] font-semibold text-slate-500 select-none pointer-events-none">From:</span>
                    <span className="text-xs font-bold text-slate-800 pointer-events-none font-mono">
                      {formatDateDDMMYYYY(weekStartDate)}
                    </span>
                    <input
                      type="date"
                      value={weekStartDate}
                      onChange={(e) => setWeekStartDate(e.target.value)}
                      onClick={(e) => {
                        try {
                          (e.currentTarget as HTMLInputElement).showPicker?.();
                        } catch {}
                      }}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>

                  <span className="text-xs font-bold text-slate-400 select-none px-0.5">to</span>

                  <div className="relative flex items-center gap-1 cursor-pointer">
                    <span className="text-[11px] font-semibold text-slate-500 select-none pointer-events-none">To:</span>
                    <span className="text-xs font-bold text-slate-800 pointer-events-none font-mono">
                      {formatDateDDMMYYYY(weekEndDate)}
                    </span>
                    <input
                      type="date"
                      value={weekEndDate}
                      onChange={(e) => setWeekEndDate(e.target.value)}
                      onClick={(e) => {
                        try {
                          (e.currentTarget as HTMLInputElement).showPicker?.();
                        } catch {}
                      }}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {chartTimeframe === 'monthly' && (
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                    className="bg-transparent text-slate-800 text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    {[
                      'January',
                      'February',
                      'March',
                      'April',
                      'May',
                      'June',
                      'July',
                      'August',
                      'September',
                      'October',
                      'November',
                      'December',
                    ].map((monthName, idx) => (
                      <option key={monthName} value={idx}>
                        {monthName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                    className="bg-transparent text-slate-800 text-xs font-bold focus:outline-none cursor-pointer border-l border-slate-200 pl-1.5"
                  >
                    <option value={2024}>2024</option>
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="h-64 w-full pt-2 flex items-center justify-center">
            {taskChartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center text-slate-400 py-8">
                <BarChart3 className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">No Task Logs Recorded</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Logs will automatically populate this chart once active shifts start.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taskChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a' }}
                  />
                  <Bar dataKey="hours" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Software App Usage % */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <PieIcon className="w-5 h-5 text-emerald-600" /> Software App Usage %
              </h3>
              <p className="text-xs text-slate-500">Distribution across active app windows</p>
            </div>
            <span className="text-[10px] font-bold uppercase text-slate-400 font-mono">
              {chartTimeframe}
            </span>
          </div>

          <div className="h-48 w-full flex items-center justify-center">
            {appPieData.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center text-slate-400 py-6">
                <PieIcon className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">No App Activity Recorded</p>
                <p className="text-[11px] text-slate-400 mt-0.5">App window tracking data will appear here during work sessions.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={appPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {appPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {appPieData.length > 0 && (
            <div className="space-y-1.5 text-xs">
              {appPieData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.name}</span>
                  </div>
                  <strong className="text-slate-900 font-mono">{item.value}%</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Employee Directory Table with Pagination */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" /> Employee Directory
            </h3>
            <p className="text-xs text-slate-500">Manage designations, roles, team leads, and assigned supervisors</p>
          </div>

          <button
            onClick={onOpenAddUserModal}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Employee
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">ID No.</th>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Role & Designation</th>
                <th className="py-3 px-4">Assigned Team Lead</th>
                <th className="py-3 px-4">Date Hired</th>
                {currentUser.role !== 'va_admin' && (
                  <>
                    <th className="py-3 px-4 text-center">Screenshot Monitor</th>
                    <th className="py-3 px-4 text-center">Activity Monitor</th>
                  </>
                )}
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {paginatedUsers.map((usr) => {
                const teamLeadsAndTrainers = users.filter(
                  (u) => u.role === 'team_lead' || u.role === 'trainer' || u.role === 'admin'
                );
                const isScreenshotOn = usr.screenshotMonitored ?? usr.stealthMonitored ?? true;
                const isActivityOn = usr.activityMonitored ?? usr.stealthMonitored ?? true;

                return (
                  <tr key={usr.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* ID No. */}
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                      #{usr.employeeCode}
                    </td>

                    {/* Employee */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar
                          name={usr.name}
                          role={usr.role}
                          size="md"
                        />
                        <div>
                          <div className="font-bold text-slate-900">{usr.name}</div>
                          <div className="text-[10px] text-slate-500">{usr.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role & Designation */}
                    <td className="py-3.5 px-4">
                      {currentUser.role === 'admin' ? (
                        <select
                          value={usr.role}
                          onChange={(e) => handleRoleChangePrompt(usr, e.target.value)}
                          className="bg-slate-50 border border-slate-200 text-slate-900 font-bold rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 w-full max-w-[155px]"
                        >
                          <option value="agent">Agent</option>
                          <option value="team_lead">Team Leader</option>
                          <option value="trainer">Trainer</option>
                          <option value="va_admin">VA Admin</option>
                          <option value="admin">Main Admin</option>
                        </select>
                      ) : (
                        <div>
                          <div className="font-semibold text-slate-900">{usr.designation}</div>
                          <span className="bg-blue-50 border border-blue-200 text-blue-800 px-2 py-0.5 rounded font-bold uppercase text-[10px] inline-block mt-0.5">
                            {usr.role === 'admin'
                              ? 'Admin'
                              : usr.role === 'va_admin'
                              ? 'VA Admin'
                              : usr.role === 'team_lead'
                              ? 'Team Lead'
                              : usr.role === 'trainer'
                              ? 'Trainer'
                              : 'Agent'}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Assigned Team Lead */}
                    <td className="py-3.5 px-4">
                      <select
                        value={usr.teamLeaderId || ''}
                        onChange={(e) => handleReassignSupervisorPrompt(usr, e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2 py-1 font-semibold text-xs focus:ring-2 focus:ring-blue-500 w-full max-w-[170px]"
                      >
                        <option value="">None / Direct</option>
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

                    {currentUser.role !== 'va_admin' && (
                      <>
                        {/* Screenshot Monitor */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleToggleScreenshotPrompt(usr, isScreenshotOn)}
                            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all inline-flex items-center gap-1 shadow-sm ${
                              isScreenshotOn
                                ? 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                            }`}
                            title="Toggle Screenshot Capture Monitor"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>{isScreenshotOn ? 'ON' : 'OFF'}</span>
                          </button>
                        </td>

                        {/* Activity Monitor */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleToggleActivityPrompt(usr, isActivityOn)}
                            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all inline-flex items-center gap-1 shadow-sm ${
                              isActivityOn
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                            }`}
                            title="Toggle Mouse & Keyboard Activity Monitor"
                          >
                            <Activity className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{isActivityOn ? 'ON' : 'OFF'}</span>
                          </button>
                        </td>
                      </>
                    )}

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {currentUser.role === 'admin' && (
                        <button
                          onClick={() => setResetModalUser(usr)}
                          className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors"
                          title="Reset Employee Password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onEditUser(usr)}
                        className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"
                        title="Edit employee details"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteUserPrompt(usr)}
                        className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
                        title="Delete employee"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 rounded-b-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 text-slate-800 rounded-lg px-2 py-1 font-semibold focus:outline-none"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
            <span className="ml-2 text-slate-500">
              Showing {Math.min((safePage - 1) * pageSize + 1, visibleUsers.length)} to{' '}
              {Math.min(safePage * pageSize, visibleUsers.length)} of {visibleUsers.length} employees
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-semibold mr-1">
              Page {safePage} of {totalPages}
            </span>
            <button
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Password Reset Modal */}
      <PasswordResetModal
        isOpen={!!resetModalUser}
        onClose={() => setResetModalUser(null)}
        targetUser={resetModalUser}
        onResetPassword={resetUserPassword}
      />

      {/* Confirmation Prompt Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false })}
        onConfirm={() => {
          if (confirmModal.action) confirmModal.action();
        }}
        title={confirmModal.title}
        description={confirmModal.description}
        employeeName={confirmModal.employeeName}
        employeeCode={confirmModal.employeeCode}
        fromValue={confirmModal.fromValue}
        toValue={confirmModal.toValue}
        confirmText={confirmModal.confirmText}
        variant={confirmModal.variant}
      />
    </div>
  );
};
