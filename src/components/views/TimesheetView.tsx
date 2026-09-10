import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { getManilaDateString } from '../../lib/dateUtils';
import {
  Calendar,
  Trash2,
  Clock,
  Plus,
  FileSpreadsheet,
  Lock,
  Layers,
  BarChart3,
  CheckCircle2,
  Coffee,
  ListFilter,
  PieChart as PieIcon,
  Search,
  User,
  ShieldCheck,
  X,
  Users,
  Play,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { TASK_LIST } from '../../data/initialData';
import { UserAvatar } from '../UserAvatar';

interface TimesheetViewProps {
  onOpenManualModal: () => void;
  isPersonalOnly?: boolean;
}

type ViewTabMode = 'daily' | 'weekly' | 'monthly';

export const TimesheetView: React.FC<TimesheetViewProps> = ({
  onOpenManualModal,
  isPersonalOnly = false,
}) => {
  const {
    timeLogs,
    currentUser,
    deleteTimeLog,
    formatDuration,
    isTracking,
    isPaused,
    currentTask,
    elapsedSeconds,
  } = useApp();

  // Tab View Mode: 'daily' | 'weekly' | 'monthly'
  const [viewTab, setViewTab] = useState<ViewTabMode>('daily');

  // Filters: Task and Agent Search
  const [selectedTaskFilter, setSelectedTaskFilter] = useState<string>('ALL');
  const [agentSearch, setAgentSearch] = useState<string>('');

  // Daily View Filter: Single Anchor Date
  const todayStr = getManilaDateString();
  const [anchorDate, setAnchorDate] = useState<string>(todayStr);

  // Helper: Calculate Monday and Friday of current week for a reference date
  const getMondayFriday = (refDateStr: string) => {
    const refDate = new Date(refDateStr || todayStr);
    const dayOfWeek = refDate.getDay(); // 0 is Sunday
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(refDate);
    monday.setDate(refDate.getDate() + distanceToMonday);

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4); // Mon + 4 = Friday

    return {
      start: getManilaDateString(monday),
      end: getManilaDateString(friday),
    };
  };

  // Weekly View Filter: Start Date (Monday) and End Date (Friday)
  const initialWeek = getMondayFriday(todayStr);
  const [weekStartDate, setWeekStartDate] = useState<string>(initialWeek.start);
  const [weekEndDate, setWeekEndDate] = useState<string>(initialWeek.end);

  // Monthly View Filter: Selected Month and Year
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);

  // Helper: Format YYYY-MM-DD to DD/MM/YYYY
  const formatDateDDMMYYYY = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Helper: Format seconds into readable "Xh Ym" or "0h 0m"
  const formatHoursMins = (totalSeconds: number): string => {
    if (!totalSeconds || totalSeconds <= 0) return '0h 0m';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  // Helper: Normalize date strings across YYYY-MM-DD, MM/DD/YYYY, and ISO formats
  const normalizeDate = (rawDate?: string, startTimeIso?: string): string => {
    const candidate = rawDate || (startTimeIso ? startTimeIso.split('T')[0] : '');
    if (!candidate) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return candidate;
    if (candidate.includes('/')) {
      const parts = candidate.split('/');
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          // MM/DD/YYYY
          return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        } else if (parts[0].length === 4) {
          // YYYY/MM/DD
          return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
      }
    }
    if (candidate.includes('T')) return candidate.split('T')[0];
    return candidate;
  };

  // Helper: Determine date matching based on view tab
  const isLogInPeriod = (logDateStr: string, mode: ViewTabMode, startTimeIso?: string) => {
    const normalized = normalizeDate(logDateStr, startTimeIso);
    if (!normalized) return true;

    if (mode === 'daily') {
      return normalized === anchorDate;
    }

    if (mode === 'weekly') {
      if (!weekStartDate || !weekEndDate) return true;
      return normalized >= weekStartDate && normalized <= weekEndDate;
    }

    if (mode === 'monthly') {
      const monthPadded = String(selectedMonth + 1).padStart(2, '0');
      const targetPrefix = `${selectedYear}-${monthPadded}`;
      return normalized.startsWith(targetPrefix);
    }

    return true;
  };

  // Label for active period summary
  const getPeriodLabel = () => {
    if (viewTab === 'daily') {
      return formatDateDDMMYYYY(anchorDate);
    }
    if (viewTab === 'weekly') {
      return `${formatDateDDMMYYYY(weekStartDate)} - ${formatDateDDMMYYYY(weekEndDate)}`;
    }
    if (viewTab === 'monthly') {
      return `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;
    }
    return '';
  };

  // Handle Tab Switch
  const handleTabSwitch = (newMode: ViewTabMode) => {
    setViewTab(newMode);
    if (newMode === 'weekly' && (!weekStartDate || !weekEndDate)) {
      const w = getMondayFriday(anchorDate || todayStr);
      setWeekStartDate(w.start);
      setWeekEndDate(w.end);
    }
  };

  // General Filtered logs based on mode (isPersonalOnly or team view), period, task filter, and agent search query
  const filteredLogs = useMemo(() => {
    return timeLogs.filter((log) => {
      // If personal view mode OR agent role, match flexibly across userId, employeeCode, and userName
      if (isPersonalOnly || currentUser.role === 'agent') {
        const uId = (currentUser.id || '').trim().toLowerCase();
        const uCode = (currentUser.employeeCode || '').trim().toLowerCase();
        const uName = (currentUser.name || '').trim().toLowerCase();
        const uUsername = ((currentUser as any).username || '').trim().toLowerCase();

        const logUId = (log.userId || '').trim().toLowerCase();
        const logEmpCode = ((log as any).employeeCode || '').trim().toLowerCase();
        const logUName = (log.userName || '').trim().toLowerCase();

        const matchesUser =
          (logUId && (logUId === uId || (uCode && logUId === uCode) || (uUsername && logUId === uUsername))) ||
          (logEmpCode && (logEmpCode === uCode || logEmpCode === uId)) ||
          (logUName && uName && (logUName === uName || logUName.includes(uName) || uName.includes(logUName)));

        if (!matchesUser) return false;
      }

      // Period filter (Daily / Weekly / Monthly) with date normalization
      const matchesPeriod = isLogInPeriod(log.date, viewTab, log.startTime);

      // Task category filter
      const matchesTask = selectedTaskFilter === 'ALL' || log.task === selectedTaskFilter;

      // Search query filter (Agent Name / Designation / Employee Code)
      const query = agentSearch.trim().toLowerCase();
      const matchesSearch =
        isPersonalOnly ||
        !query ||
        log.userName.toLowerCase().includes(query) ||
        log.designation.toLowerCase().includes(query) ||
        log.userId.toLowerCase().includes(query);

      return matchesPeriod && matchesTask && matchesSearch;
    });
  }, [
    timeLogs,
    currentUser,
    isPersonalOnly,
    viewTab,
    anchorDate,
    weekStartDate,
    weekEndDate,
    selectedMonth,
    selectedYear,
    selectedTaskFilter,
    agentSearch,
  ]);

  // Overall Period Calculations (Whole Shift Summary across filtered logs)
  const totalGrossSeconds = filteredLogs.reduce((acc, l) => acc + l.durationSeconds, 0);
  const totalIdleSeconds = filteredLogs.reduce((acc, l) => acc + (l.idleSeconds || 0), 0);
  const totalNetSeconds = Math.max(0, totalGrossSeconds - totalIdleSeconds);

  const avgActivityScore = useMemo(() => {
    if (filteredLogs.length === 0) return 0;
    const totalScore = filteredLogs.reduce(
      (acc, l) => acc + (l.mouseActivityAvg + l.keyboardActivityAvg) / 2,
      0
    );
    return Math.round(totalScore / filteredLogs.length);
  }, [filteredLogs]);

  // Grouping by User for Table 1 (Whole Period Summary)
  const userSummaryList = useMemo(() => {
    const map = new Map<
      string,
      {
        userId: string;
        userName: string;
        userAvatar: string;
        designation: string;
        grossSeconds: number;
        idleSeconds: number;
        netSeconds: number;
        avgActivity: number;
        logCount: number;
      }
    >();

    filteredLogs.forEach((log) => {
      const existing = map.get(log.userId) || {
        userId: log.userId,
        userName: log.userName,
        userAvatar: log.userAvatar,
        designation: log.designation,
        grossSeconds: 0,
        idleSeconds: 0,
        netSeconds: 0,
        avgActivity: 0,
        logCount: 0,
      };

      const logAvgAct = Math.round((log.mouseActivityAvg + log.keyboardActivityAvg) / 2);
      existing.grossSeconds += log.durationSeconds;
      existing.idleSeconds += log.idleSeconds || 0;
      existing.netSeconds = Math.max(0, existing.grossSeconds - existing.idleSeconds);
      existing.avgActivity = Math.round(
        (existing.avgActivity * existing.logCount + logAvgAct) / (existing.logCount + 1)
      );
      existing.logCount += 1;

      map.set(log.userId, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.netSeconds - a.netSeconds);
  }, [filteredLogs]);

  // Pagination for Whole Shift Record: Daily, Weekly, and Monthly views (10 per page)
  const [summaryPage, setSummaryPage] = useState(1);
  const summaryPageSize = 10;

  useEffect(() => {
    setSummaryPage(1);
  }, [viewTab, selectedTaskFilter, agentSearch, anchorDate, weekStartDate, weekEndDate, selectedMonth, selectedYear]);

  const totalSummaryPages = Math.ceil(userSummaryList.length / summaryPageSize) || 1;
  const safeSummaryPage = Math.min(summaryPage, totalSummaryPages);
  const paginatedUserSummaryList = useMemo(() => {
    const start = (safeSummaryPage - 1) * summaryPageSize;
    return userSummaryList.slice(start, start + summaryPageSize);
  }, [userSummaryList, safeSummaryPage, summaryPageSize]);

  // Pagination for Detailed Itemized Session Logs Table (10 per page)
  const [logsPage, setLogsPage] = useState(1);
  const logsPageSize = 10;

  useEffect(() => {
    setLogsPage(1);
  }, [viewTab, selectedTaskFilter, agentSearch, anchorDate, weekStartDate, weekEndDate, selectedMonth, selectedYear]);

  const totalLogsPages = Math.ceil(filteredLogs.length / logsPageSize) || 1;
  const safeLogsPage = Math.min(logsPage, totalLogsPages);
  const paginatedLogs = useMemo(() => {
    const start = (safeLogsPage - 1) * logsPageSize;
    return filteredLogs.slice(start, start + logsPageSize);
  }, [filteredLogs, safeLogsPage, logsPageSize]);

  // Table 2: Task Category Breakdown across filtered logs
  const taskBreakdownList = useMemo(() => {
    const map = new Map<
      string,
      {
        taskName: string;
        durationSeconds: number;
        logCount: number;
        avgActivity: number;
      }
    >();

    let cumulativeTrackedSec = 0;

    filteredLogs.forEach((log) => {
      cumulativeTrackedSec += log.durationSeconds;

      const existing = map.get(log.task) || {
        taskName: log.task,
        durationSeconds: 0,
        logCount: 0,
        avgActivity: 0,
      };

      const logAvgAct = Math.round((log.mouseActivityAvg + log.keyboardActivityAvg) / 2);
      existing.durationSeconds += log.durationSeconds;
      existing.avgActivity = Math.round(
        (existing.avgActivity * existing.logCount + logAvgAct) / (existing.logCount + 1)
      );
      existing.logCount += 1;

      map.set(log.task, existing);
    });

    // Add idle time deduction entry if applicable
    if (totalIdleSeconds > 0) {
      map.set('System Idle / Break Time', {
        taskName: 'System Idle / Break Time',
        durationSeconds: totalIdleSeconds,
        logCount: 0,
        avgActivity: 0,
      });
    }

    const result: {
      taskName: string;
      durationSeconds: number;
      percentage: number;
      logCount: number;
      avgActivity: number;
    }[] = [];

    const grandTotalSec = Math.max(1, cumulativeTrackedSec + totalIdleSeconds);

    map.forEach((value) => {
      const pct = Math.round((value.durationSeconds / grandTotalSec) * 100);
      result.push({
        ...value,
        percentage: pct,
      });
    });

    return result.sort((a, b) => b.durationSeconds - a.durationSeconds);
  }, [filteredLogs, totalIdleSeconds]);

  // Section 1 Chart Data: Hours tracked & Idle hours by task category or dates for active period
  const timesheetChartData = useMemo(() => {
    if (filteredLogs.length > 0) {
      const map: Record<string, { name: string; trackedHours: number; idleHours: number }> = {};
      filteredLogs.forEach((log) => {
        const rawKey = isPersonalOnly ? formatDateDDMMYYYY(log.date) : log.task;
        const shortKey = rawKey.length > 18 ? rawKey.substring(0, 18) + '...' : rawKey;
        if (!map[shortKey]) {
          map[shortKey] = { name: shortKey, trackedHours: 0, idleHours: 0 };
        }
        map[shortKey].trackedHours += log.durationSeconds / 3600;
        map[shortKey].idleHours += (log.idleSeconds || 0) / 3600;
      });
      return Object.values(map).map((item) => ({
        ...item,
        trackedHours: Number(item.trackedHours.toFixed(1)),
        idleHours: Number(item.idleHours.toFixed(1)),
      }));
    } else {
      return [
        { name: 'Mon', trackedHours: 7.5, idleHours: 0.5 },
        { name: 'Tue', trackedHours: 8.0, idleHours: 0.3 },
        { name: 'Wed', trackedHours: 7.8, idleHours: 0.4 },
        { name: 'Thu', trackedHours: 8.2, idleHours: 0.2 },
        { name: 'Fri', trackedHours: 7.0, idleHours: 0.6 },
      ];
    }
  }, [filteredLogs, isPersonalOnly]);

  // CSV Export Handler
  const handleExportCSV = () => {
    const headers = [
      'Log ID',
      'User Name',
      'Designation',
      'Task',
      'Date',
      'GEO Start Time',
      'Total Logged Sec',
      'Idle Sec',
      'Net Recorded Sec',
      'Activity Score %',
      'Notes',
    ];

    const rows = filteredLogs.map((l) => [
      l.id,
      `"${l.userName}"`,
      `"${l.designation}"`,
      `"${l.task}"`,
      l.date,
      `"${l.geoLocalStartTime}"`,
      l.durationSeconds,
      l.idleSeconds || 0,
      Math.max(0, l.durationSeconds - (l.idleSeconds || 0)),
      Math.round((l.mouseActivityAvg + l.keyboardActivityAvg) / 2),
      `"${l.notes || ''}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `LLC_Time_Tracker_${isPersonalOnly ? 'My_Personal' : 'Team'}_Timesheet_${getPeriodLabel().replace(/[^a-zA-Z0-9]/g, '_')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const canSearchAgents = currentUser.role !== 'agent';

  return (
    <div id="timesheet-view" className="space-y-6">
      {/* Top Header Bar: Title & Primary Action Buttons */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              {isPersonalOnly ? (
                <>
                  <User className="w-6 h-6 text-emerald-600" /> My Personal Timesheet
                </>
              ) : (
                <>
                  <Calendar className="w-6 h-6 text-blue-600" /> Timesheets & Shift Records
                </>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {isPersonalOnly
                ? `View and manage your personal time logs, tracked work sessions, and task history for ${currentUser.name}.`
                : 'Monitor, review, and export employee shift logs, task activities, and time tracking data across Daily, Weekly, and Monthly periods.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Add / Request Time Button (Restricted from Agents unless in Personal view) */}
            {(currentUser.role !== 'agent' || isPersonalOnly) && (
              <button
                onClick={onOpenManualModal}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add / Request Time
              </button>
            )}

            {/* Export CSV Button */}
            {currentUser.role === 'agent' && !isPersonalOnly ? (
              <button
                disabled
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-400 font-semibold text-xs flex items-center gap-2 border border-slate-200 cursor-not-allowed opacity-75"
                title="Exporting CSV is restricted for Agent accounts"
              >
                <Lock className="w-4 h-4 text-slate-400" /> Export CSV (Restricted)
              </button>
            ) : (
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4" /> Export CSV / Spreadsheet
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MY PERSONAL TIMESHEET HERO BANNER (When in Personal Mode OR for TL in Team view) */}
      {isPersonalOnly ? (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 border border-slate-700 rounded-2xl p-6 text-white shadow-lg space-y-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-700/80">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white">
                  {currentUser.name} — Personal Timesheet
                </h3>
                <span className="bg-emerald-500 text-slate-950 text-[10px] px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1 uppercase">
                  <ShieldCheck className="w-3 h-3" /> {currentUser.role.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {currentUser.employeeCode || 'LLC-0001'} • {currentUser.designation} • {currentUser.department || 'Operations'}
              </p>
            </div>

            <span className="text-xs font-mono font-bold bg-slate-800/80 border border-slate-700 text-emerald-400 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              {viewTab.toUpperCase()} Period: {getPeriodLabel()}
            </span>
          </div>

          {/* Active Live Session Indicator (Syncs live from Desktop App Tracker) */}
          {isTracking && (
            <div className="bg-emerald-950/80 border border-emerald-500/80 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <Play className="w-5 h-5 fill-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-emerald-300">Live Active Session Tracking Right Now</span>
                    <span className="bg-emerald-500/30 text-emerald-200 border border-emerald-400/50 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                      {isPaused ? 'PAUSED' : 'RECORDING'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Currently tracking task: <strong className="text-white">"{currentTask || 'General'}"</strong> on Desktop App.
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider block">Live Session Elapsed</span>
                <span className="font-mono text-2xl font-black text-white">{formatDuration(elapsedSeconds)}</span>
              </div>
            </div>
          )}

          {/* Stat Cards Grid for Personal Timesheet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-800/60 border border-slate-700 p-3.5 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">Total Logged Time</span>
              <div className="font-mono text-xl font-bold text-white mt-1">{formatHoursMins(totalGrossSeconds)}</div>
              <span className="text-[10px] text-slate-400">Gross tracked shift time</span>
            </div>

            <div className="bg-slate-800/60 border border-slate-700 p-3.5 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Total Idle / Break Time</span>
              <div className="font-mono text-xl font-bold text-amber-400 mt-1">{formatHoursMins(totalIdleSeconds)}</div>
              <span className="text-[10px] text-slate-400">System detected idle pauses</span>
            </div>

            <div className="bg-slate-800/60 border border-slate-700 p-3.5 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Net Recorded Time</span>
              <div className="font-mono text-2xl font-black text-emerald-400 mt-1">{formatHoursMins(totalNetSeconds)}</div>
              <span className="text-[10px] text-emerald-300 font-semibold">Net Active Work Time</span>
            </div>

            <div className="bg-slate-800/60 border border-slate-700 p-3.5 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">Avg Activity Rating</span>
              <div className="font-mono text-xl font-bold text-purple-300 mt-1">{avgActivityScore}%</div>
              <span className="text-[10px] text-slate-400">Mouse & Keyboard activity</span>
            </div>
          </div>
        </div>
      ) : (
        /* Team Overview Cards when viewing general Timesheet tab */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Team Hours</span>
              <div className="font-mono text-lg font-extrabold text-slate-900">{formatHoursMins(totalGrossSeconds)}</div>
              <span className="text-[10px] text-slate-500">Gross tracked shift time</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Idle / Breaks</span>
              <div className="font-mono text-lg font-extrabold text-amber-600">{formatHoursMins(totalIdleSeconds)}</div>
              <span className="text-[10px] text-slate-500">System idle deductions</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Net Work Recorded</span>
              <div className="font-mono text-xl font-black text-emerald-700">{formatHoursMins(totalNetSeconds)}</div>
              <span className="text-[10px] text-emerald-600 font-semibold">Net Active Work</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Staff Listed</span>
              <div className="font-mono text-lg font-extrabold text-slate-900">{userSummaryList.length}</div>
              <span className="text-[10px] text-slate-500">Staff with logs in period</span>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1: Timesheet Work Volume & Idle Time Analytics Chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              {isPersonalOnly ? 'Section 1: Personal Work Volume & Productivity Chart' : 'Section 1: Team Timesheet Hours & Activity Breakdown'}
            </h3>
            <p className="text-xs text-slate-500">
              {isPersonalOnly
                ? `Visual breakdown of active tracked work hours vs idle pauses for ${currentUser.name}`
                : 'Tracked work volume and idle time distribution across logged tasks for the active period'}
            </p>
          </div>
          <span className="text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-lg">
            {viewTab.toUpperCase()} Period: {getPeriodLabel()}
          </span>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timesheetChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} unit="h" />
              <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="trackedHours" name="Tracked Active Hours" fill={isPersonalOnly ? '#10b981' : '#2563eb'} radius={[6, 6, 0, 0]} />
              <Bar dataKey="idleHours" name="Idle / Break Hours" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filter Control Bar: Daily / Weekly / Monthly View Tabs + Search Agent Name | Filter Task | Date Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* View Mode Tabs */}
          <div className="shrink-0 flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => handleTabSwitch('daily')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                viewTab === 'daily'
                  ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daily View
            </button>
            <button
              onClick={() => handleTabSwitch('weekly')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                viewTab === 'weekly'
                  ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Weekly View
            </button>
            <button
              onClick={() => handleTabSwitch('monthly')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                viewTab === 'monthly'
                  ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly View
            </button>
          </div>

          {/* Streamlined Filter Bar: Search Agent Name (Only in Team View) | Filter for task | Date Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* AGENT SEARCH INPUT (Only when NOT in personal mode & for Team Lead / Admin / Trainer / HR / Payroll) */}
            {!isPersonalOnly && canSearchAgents && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-36 sm:w-44 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all shadow-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={agentSearch}
                  onChange={(e) => setAgentSearch(e.target.value)}
                  placeholder="Search Agent..."
                  className="bg-transparent text-slate-800 text-xs font-medium focus:outline-none w-full"
                />
                {agentSearch && (
                  <button
                    type="button"
                    onClick={() => setAgentSearch('')}
                    className="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-all"
                    title="Clear Agent Search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Task Category Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
              <ListFilter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                value={selectedTaskFilter}
                onChange={(e) => setSelectedTaskFilter(e.target.value)}
                className="bg-transparent text-slate-800 text-xs font-medium focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Tasks - Filter</option>
                {TASK_LIST.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Dynamic Date Controls per ViewTab */}
            {viewTab === 'daily' && (
              <div className="relative flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm hover:bg-slate-100/80 transition-all cursor-pointer">
                <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0 pointer-events-none" />
                <span className="text-xs font-semibold text-slate-500 select-none pointer-events-none">Date:</span>
                <span className="text-xs font-semibold text-slate-800 pointer-events-none">
                  {formatDateDDMMYYYY(anchorDate)}
                </span>
                <input
                  type="date"
                  value={anchorDate}
                  onChange={(e) => {
                    setAnchorDate(e.target.value);
                    const w = getMondayFriday(e.target.value);
                    setWeekStartDate(w.start);
                    setWeekEndDate(w.end);
                    const d = new Date(e.target.value);
                    if (!isNaN(d.getTime())) {
                      setSelectedMonth(d.getMonth());
                      setSelectedYear(d.getFullYear());
                    }
                  }}
                  onClick={(e) => {
                    try {
                      (e.currentTarget as HTMLInputElement).showPicker?.();
                    } catch {}
                  }}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
              </div>
            )}

            {viewTab === 'weekly' && (
              <div className="flex items-center gap-2">
                <div className="relative flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm hover:bg-slate-100/80 transition-all cursor-pointer">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0 pointer-events-none" />
                  <span className="text-xs font-semibold text-slate-500 select-none pointer-events-none">From:</span>
                  <span className="text-xs font-semibold text-slate-800 pointer-events-none">
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

                <div className="relative flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm hover:bg-slate-100/80 transition-all cursor-pointer">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0 pointer-events-none" />
                  <span className="text-xs font-semibold text-slate-500 select-none pointer-events-none">To:</span>
                  <span className="text-xs font-semibold text-slate-800 pointer-events-none">
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

            {viewTab === 'monthly' && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="text-xs font-semibold text-slate-500 select-none">Month:</span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                    className="bg-transparent text-slate-800 text-xs font-semibold focus:outline-none cursor-pointer"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500 select-none">Year:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                    className="bg-transparent text-slate-800 text-xs font-semibold focus:outline-none cursor-pointer"
                  >
                    {YEAR_OPTIONS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TABLE 1: Whole Period / Day Shift Summary Record (Only in Team View Mode) */}
      {!isPersonalOnly && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm space-y-0">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                1. Whole Shift Record ({viewTab.toUpperCase()} Summary)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Overall shift logs showing total logged shift hours, idle time deductions, and net work recorded across all agents.
                {agentSearch && (
                  <span className="text-blue-600 font-bold ml-1">
                    Filtered by agent: "{agentSearch}"
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {agentSearch && (
                <span className="text-xs bg-amber-100 text-amber-800 border border-amber-300 font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                  Search: {agentSearch}
                  <button onClick={() => setAgentSearch('')} className="hover:text-slate-900 ml-0.5">✕</button>
                </span>
              )}
              <span className="text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-full">
                Period: {getPeriodLabel()} ({viewTab})
              </span>
            </div>
          </div>

          {userSummaryList.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              {agentSearch
                ? `No shift records found matching agent name "${agentSearch}".`
                : 'No shift records found for this period filter.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Agent / Staff</th>
                    <th className="py-3 px-4">Designation</th>
                    <th className="py-3 px-4">Selected Period</th>
                    <th className="py-3 px-4 text-slate-700">Total Logged Shift</th>
                    <th className="py-3 px-4 text-amber-700">Idle / Break Time</th>
                    <th className="py-3 px-4 text-emerald-800 font-extrabold">Net Recorded Work</th>
                    <th className="py-3 px-4">Avg Activity</th>
                    <th className="py-3 px-4">Log Entries</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                  {paginatedUserSummaryList.map((userSum) => (
                    <tr key={userSum.userId} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            name={userSum.userName}
                            size="xs"
                          />
                          <div>
                            <div className="font-bold text-slate-900">{userSum.userName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700">
                          {userSum.designation}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                        {viewTab.toUpperCase()} ({getPeriodLabel()})
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {formatHoursMins(userSum.grossSeconds)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-600">
                        {formatHoursMins(userSum.idleSeconds)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-extrabold text-emerald-700 text-sm bg-emerald-50/50">
                        {formatHoursMins(userSum.netSeconds)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          {userSum.avgActivity}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {userSum.logCount} {userSum.logCount === 1 ? 'log' : 'logs'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Controls for Whole Shift Record (10 items per page) */}
              {totalSummaryPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-t border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">
                    Showing <strong className="text-slate-800 font-bold">{(safeSummaryPage - 1) * summaryPageSize + 1}</strong> to{' '}
                    <strong className="text-slate-800 font-bold">{Math.min(safeSummaryPage * summaryPageSize, userSummaryList.length)}</strong> of{' '}
                    <strong className="text-slate-800 font-bold">{userSummaryList.length}</strong> agents ({viewTab.toUpperCase()} shift records - 10 per page)
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSummaryPage((p) => Math.max(1, p - 1))}
                      disabled={safeSummaryPage === 1}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Previous</span>
                    </button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalSummaryPages }, (_, idx) => idx + 1).map((p) => (
                        <button
                          key={p}
                          onClick={() => setSummaryPage(p)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                            p === safeSummaryPage
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setSummaryPage((p) => Math.min(totalSummaryPages, p + 1))}
                      disabled={safeSummaryPage === totalSummaryPages}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TABLE 2: Task Details Log Breakdown */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm space-y-0">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-emerald-600" />
              {isPersonalOnly ? 'Personal Task Category Breakdown' : '2. Task Details Log Breakdown'} ({viewTab.toUpperCase()})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Specific hours and percentage spent on each task category during this period.
            </p>
          </div>
        </div>

        {taskBreakdownList.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            No task logs recorded for this selected period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Task Category</th>
                  <th className="py-3 px-4">Hours Spent</th>
                  <th className="py-3 px-4">% Share of Shift</th>
                  <th className="py-3 px-4">Activity Score</th>
                  <th className="py-3 px-4">Log Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {taskBreakdownList.map((tb, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-bold">
                      {tb.taskName.includes('Idle') ? (
                        <span className="text-amber-700 flex items-center gap-1.5 font-semibold">
                          <Coffee className="w-3.5 h-3.5" /> {tb.taskName}
                        </span>
                      ) : (
                        <span className="text-blue-700 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" /> {tb.taskName}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {formatHoursMins(tb.durationSeconds)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={tb.taskName.includes('Idle') ? 'bg-amber-500 h-full' : 'bg-blue-600 h-full'}
                            style={{ width: `${tb.percentage}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-xs text-slate-700">
                          {tb.percentage}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold">
                      {tb.taskName.includes('Idle') ? (
                        <span className="text-slate-400">N/A (Idle)</span>
                      ) : (
                        <span className="text-emerald-700 font-bold">{tb.avgActivity}%</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {tb.logCount} {tb.logCount === 1 ? 'entry' : 'entries'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Itemized Session Time Logs Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
            {isPersonalOnly ? 'My Detailed Session Logs' : 'Detailed Itemized Session Logs'} ({filteredLogs.length} Entries)
          </h4>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No itemized logs match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/50 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  {!isPersonalOnly && <th className="py-3 px-4">Agent</th>}
                  <th className="py-3 px-4">Task Category</th>
                  <th className="py-3 px-4">Date & Start Time</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Activity Score</th>
                  <th className="py-3 px-4">Notes</th>
                  {!isPersonalOnly && currentUser.role === 'admin' && (
                    <th className="py-3 px-4 text-right">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    {!isPersonalOnly && (
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {log.userName}
                      </td>
                    )}
                    <td className="py-3 px-4 font-semibold text-blue-700">
                      {log.task}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {log.date} • {log.geoLocalStartTime}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold">
                      {formatDuration(log.durationSeconds)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-600">
                      {Math.round((log.mouseActivityAvg + log.keyboardActivityAvg) / 2)}%
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate" title={log.notes}>
                      {log.notes || 'Automated session log'}
                    </td>
                    {!isPersonalOnly && currentUser.role === 'admin' && (
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => deleteTimeLog(log.id)}
                          className="p-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-all"
                          title="Delete entry (Super Admin Only)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls for Detailed Itemized Session Logs Table (10 per page) */}
            {totalLogsPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-t border-slate-200">
                <span className="text-xs text-slate-500 font-medium">
                  Showing <strong className="text-slate-800 font-bold">{(safeLogsPage - 1) * logsPageSize + 1}</strong> to{' '}
                  <strong className="text-slate-800 font-bold">{Math.min(safeLogsPage * logsPageSize, filteredLogs.length)}</strong> of{' '}
                  <strong className="text-slate-800 font-bold">{filteredLogs.length}</strong> log entries (10 per page)
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                    disabled={safeLogsPage === 1}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalLogsPages }, (_, idx) => idx + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setLogsPage(p)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                          p === safeLogsPage
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setLogsPage((p) => Math.min(totalLogsPages, p + 1))}
                    disabled={safeLogsPage === totalLogsPages}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
