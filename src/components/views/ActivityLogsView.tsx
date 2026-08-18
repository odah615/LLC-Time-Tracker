import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Camera,
  MousePointer,
  Keyboard,
  Monitor,
  Trash2,
  Maximize2,
  AlertTriangle,
  Clock,
  Filter,
  Search,
  Globe,
  FileText,
  Code,
  MessageSquare,
  Video,
  Calendar,
  X,
  Layers,
  BarChart3,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Users,
  ChevronLeft,
  ChevronRight,
  Lock,
  Eye,
  EyeOff,
  Shield,
  Info,
  Sparkles,
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
import { ScreenshotLog, User } from '../../types';
import { ConfirmationModal } from '../modals/ConfirmationModal';

type ViewTabMode = 'daily' | 'weekly' | 'monthly';

export const ActivityLogsView: React.FC = () => {
  const {
    screenshots,
    idleLogs,
    timeLogs,
    currentUser,
    users,
    updateUser,
    deleteScreenshot,
    toggleScreenshotBlur,
  } = useApp();

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedImage, setSelectedImage] = useState<ScreenshotLog | null>(null);
  const [viewTab, setViewTab] = useState<ViewTabMode>('daily');
  const [anchorDate, setAnchorDate] = useState<string>(todayStr);
  const [screenshotFilter, setScreenshotFilter] = useState<'all' | 'low_activity' | 'blurred'>('all');
  const [hoveredScrId, setHoveredScrId] = useState<string | null>(null);

  // Confirmation Modal State
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

  const handleToggleScreenshotPrompt = (usr: User, currentVal?: boolean) => {
    const isCurrentlyOn = currentVal === true;
    const fromVal = isCurrentlyOn ? 'Screenshot Monitoring ON' : 'Screenshot Monitoring OFF';
    const toVal = !isCurrentlyOn ? 'Screenshot Monitoring ON' : 'Screenshot Monitoring OFF';

    setConfirmModal({
      isOpen: true,
      title: 'Confirm Screenshot Surveillance Change',
      description: `Are you sure you want to turn ${isCurrentlyOn ? 'OFF' : 'ON'} automated desktop screenshot capture for ${usr.name}?`,
      employeeName: usr.name,
      employeeCode: usr.employeeCode,
      fromValue: fromVal,
      toValue: toVal,
      confirmText: `Yes, Turn ${!isCurrentlyOn ? 'ON' : 'OFF'}`,
      variant: 'warning',
      action: () => {
        updateUser(usr.id, { screenshotMonitored: !isCurrentlyOn });
      },
    });
  };

  const handleToggleActivityPrompt = (usr: User, currentVal?: boolean) => {
    const isCurrentlyOn = currentVal === true;
    const fromVal = isCurrentlyOn ? 'Activity Monitoring ON' : 'Activity Monitoring OFF';
    const toVal = !isCurrentlyOn ? 'Activity Monitoring ON' : 'Activity Monitoring OFF';

    setConfirmModal({
      isOpen: true,
      title: 'Confirm Activity Monitoring Change',
      description: `Are you sure you want to turn ${isCurrentlyOn ? 'OFF' : 'ON'} mouse and keyboard activity level tracking for ${usr.name}?`,
      employeeName: usr.name,
      employeeCode: usr.employeeCode,
      fromValue: fromVal,
      toValue: toVal,
      confirmText: `Yes, Turn ${!isCurrentlyOn ? 'ON' : 'OFF'}`,
      variant: 'warning',
      action: () => {
        updateUser(usr.id, { activityMonitored: !isCurrentlyOn });
      },
    });
  };

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
      start: monday.toISOString().split('T')[0],
      end: friday.toISOString().split('T')[0],
    };
  };

  const initialWeek = getMondayFriday(todayStr);
  const [weekStartDate, setWeekStartDate] = useState<string>(initialWeek.start);
  const [weekEndDate, setWeekEndDate] = useState<string>(initialWeek.end);

  const currentYear = 2026;
  const currentMonth = 7; // August (0-indexed)
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => 2026 - 3 + i);

  const formatDateDDMMYYYY = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

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

  const handleTabSwitch = (newMode: ViewTabMode) => {
    setViewTab(newMode);
    if (newMode === 'weekly' && (!weekStartDate || !weekEndDate)) {
      const w = getMondayFriday(anchorDate || '2026-08-10');
      setWeekStartDate(w.start);
      setWeekEndDate(w.end);
    }
  };

  const [userFilter, setUserFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const isAgentOnly = currentUser.role === 'agent';
  const effectiveFilter = isAgentOnly ? currentUser.id : userFilter;

  // Helper: Date in period check
  const isLogInPeriod = (logDateStr: string, mode: ViewTabMode) => {
    if (!logDateStr) return false;

    if (mode === 'daily') {
      return logDateStr === anchorDate;
    }

    if (mode === 'weekly') {
      if (!weekStartDate || !weekEndDate) return true;
      return logDateStr >= weekStartDate && logDateStr <= weekEndDate;
    }

    if (mode === 'monthly') {
      const monthPadded = String(selectedMonth + 1).padStart(2, '0');
      const targetPrefix = `${selectedYear}-${monthPadded}`;
      return logDateStr.startsWith(targetPrefix);
    }

    return true;
  };

  // Map screenshot to date via associated time log
  const getScreenshotDate = (scr: ScreenshotLog): string => {
    const relatedTimeLog = timeLogs.find((t) => t.id === scr.timeLogId);
    return relatedTimeLog ? relatedTimeLog.date : '2026-08-10';
  };

  // Filtered Screenshots based on Period, User Filter & Search Query
  const filteredScreenshots = useMemo(() => {
    return screenshots.filter((s) => {
      // User role / selection filter
      if (effectiveFilter !== 'ALL' && s.userId !== effectiveFilter) {
        return false;
      }

      // Period filter (Daily / Weekly / Monthly)
      const scrDate = getScreenshotDate(s);
      if (!isLogInPeriod(scrDate, viewTab)) {
        return false;
      }

      // Search query filter (Agent Name or App Name)
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchesUser = s.userName.toLowerCase().includes(q);
        const matchesApp = s.activeApp.toLowerCase().includes(q);
        if (!matchesUser && !matchesApp) return false;
      }

      // Smart Privacy / Low Activity filter
      if (screenshotFilter === 'low_activity') {
        const isLow = s.lowActivityAlert || s.activityPercent < 45;
        if (!isLow) return false;
      } else if (screenshotFilter === 'blurred') {
        if (!s.isBlurred) return false;
      }

      return true;
    });
  }, [screenshots, timeLogs, effectiveFilter, anchorDate, weekStartDate, weekEndDate, selectedMonth, selectedYear, viewTab, searchQuery, screenshotFilter]);

  // Activity rating average for current period
  const avgActivity = useMemo(() => {
    if (filteredScreenshots.length === 0) return 85;
    const total = filteredScreenshots.reduce((acc, s) => acc + s.activityPercent, 0);
    return Math.round(total / filteredScreenshots.length);
  }, [filteredScreenshots]);

  // Surveillance Table Pagination & Idle Calculations
  const [surveillancePage, setSurveillancePage] = useState(1);
  const surveillancePageSize = 5;

  const visibleSurveillanceUsers = useMemo(() => users.filter((u) => !u.isSecretBackup), [users]);
  const totalSurveillancePages = Math.ceil(visibleSurveillanceUsers.length / surveillancePageSize) || 1;
  const safeSurveillancePage = Math.min(surveillancePage, totalSurveillancePages);

  const paginatedSurveillanceUsers = useMemo(() => {
    const start = (safeSurveillancePage - 1) * surveillancePageSize;
    return visibleSurveillanceUsers.slice(start, start + surveillancePageSize);
  }, [visibleSurveillanceUsers, safeSurveillancePage, surveillancePageSize]);

  // Idle time calculation per user
  const getUserIdleTimeStr = (userId: string) => {
    const userIdleSec = idleLogs
      .filter((i) => i.userId === userId)
      .reduce((acc, i) => acc + i.durationSeconds, 0);

    if (userIdleSec === 0) return '0m Idle';
    const hrs = Math.floor(userIdleSec / 3600);
    const mins = Math.floor((userIdleSec % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m Idle`;
    }
    return `${mins}m Idle`;
  };

  // Chart Data for Activity Scores & Input Levels
  const activityChartData = useMemo(() => {
    if (filteredScreenshots.length > 0) {
      const userMap: Record<string, { name: string; activity: number; mouse: number; keyboard: number; count: number }> = {};
      filteredScreenshots.forEach((scr) => {
        const shortName = scr.userName.split(' ')[0] || scr.userName;
        if (!userMap[shortName]) {
          userMap[shortName] = { name: shortName, activity: 0, mouse: 0, keyboard: 0, count: 0 };
        }
        userMap[shortName].activity += scr.activityPercent;
        userMap[shortName].mouse += scr.mouseClicks;
        userMap[shortName].keyboard += scr.keyboardStrokes;
        userMap[shortName].count += 1;
      });

      return Object.values(userMap).map((item) => ({
        name: item.name,
        avgActivity: Math.round(item.activity / item.count),
        totalClicks: item.mouse,
        totalKeystrokes: item.keyboard,
      }));
    } else {
      return [
        { name: 'Alex', avgActivity: 92, totalClicks: 1450, totalKeystrokes: 3200 },
        { name: 'David', avgActivity: 88, totalClicks: 1200, totalKeystrokes: 2800 },
        { name: 'Marcus', avgActivity: 85, totalClicks: 980, totalKeystrokes: 2100 },
        { name: 'Amanda', avgActivity: 95, totalClicks: 1600, totalKeystrokes: 3900 },
      ];
    }
  }, [filteredScreenshots]);

  return (
    <div id="activity-logs-view" className="space-y-6">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Camera className="w-6 h-6 text-blue-600" /> Activity Monitoring & Screenshots Vault
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Realtime keyboard/mouse activity metrics, desktop window tracking, and visual screenshot timeline.
          </p>
        </div>

        {isAgentOnly ? (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2 rounded-xl text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Agent Activity Vault: <strong>{currentUser.name}</strong></span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700">
            <Monitor className="w-4 h-4 text-emerald-600" />
            <span>Active Monitoring Mode: <strong>Full Team Overview</strong></span>
          </div>
        )}
      </div>

      {/* SECTION 1: Activity Scores & Keystroke / Mouse Input Trend Chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Activity Level & Peripheral Input Chart
            </h3>
            <p className="text-xs text-slate-500">
              Average activity score percentage, mouse clicks, and keyboard strokes recorded per team member
            </p>
          </div>
          <span className="text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-lg">
            Period: {getPeriodLabel()}
          </span>
        </div>

        <div className="h-60 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={activityChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} unit="%" />
              <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="avgActivity" name="Average Activity %" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SECTION 2: Employee Directory - Surveillance & Screenshot / Activity Toggles */}
      {!isAgentOnly && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Employee Directory — Surveillance & Monitoring Controls
              </h3>
              <p className="text-xs text-slate-500">
                Quick 1-click toggles for Screenshot Captures, Keyboard/Mouse Activity Monitoring, and Idle Time summary.
              </p>
            </div>
            <span className="text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1 rounded-lg">
              Showing {paginatedSurveillanceUsers.length} of {users.length} Staff
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Role & Designation</th>
                  {currentUser.role !== 'va_admin' && (
                    <>
                      <th className="py-3 px-4 text-center">Screenshot Monitoring</th>
                      <th className="py-3 px-4 text-center">Activity Monitoring</th>
                    </>
                  )}
                  <th className="py-3 px-4 text-right">Idle Time Tracked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {paginatedSurveillanceUsers.map((usr) => {
                  const isScreenshotOn = usr.screenshotMonitored === true;
                  const isActivityOn = usr.activityMonitored === true;

                  return (
                    <tr key={usr.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={usr.avatar}
                            alt={usr.name}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200"
                          />
                          <div>
                            <div className="font-bold text-slate-900">{usr.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{usr.employeeCode || 'LLC-0001'}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{usr.designation}</div>
                        <span className="text-[10px] uppercase font-bold text-slate-500">{usr.role.replace('_', ' ')}</span>
                      </td>

                      {currentUser.role !== 'va_admin' && (
                        <>
                          {/* Screenshot Monitoring Toggle */}
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleToggleScreenshotPrompt(usr, isScreenshotOn)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                                isScreenshotOn
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                              }`}
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>{isScreenshotOn ? 'Screenshots ON' : 'Screenshots OFF'}</span>
                            </button>
                          </td>

                          {/* Activity Monitoring Toggle */}
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleToggleActivityPrompt(usr, isActivityOn)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                                isActivityOn
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                              }`}
                            >
                              <MousePointer className="w-3.5 h-3.5" />
                              <span>{isActivityOn ? 'Activity ON' : 'Activity OFF'}</span>
                            </button>
                          </td>
                        </>
                      )}

                      {/* Idle Time Tracked */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg text-xs inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          {getUserIdleTimeStr(usr.id)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Pagination */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500 font-medium">
              Page {safeSurveillancePage} of {totalSurveillancePages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSurveillancePage((p) => Math.max(1, p - 1))}
                disabled={safeSurveillancePage <= 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-xs font-semibold text-slate-700 flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                onClick={() => setSurveillancePage((p) => Math.min(totalSurveillancePages, p + 1))}
                disabled={safeSurveillancePage >= totalSurveillancePages}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-xs font-semibold text-slate-700 flex items-center gap-1"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Period View Tabs & Search Filter Control Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Daily, Weekly, Monthly Tabs */}
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

          {/* Search Agent Name / App Name & Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-36 sm:w-44 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all shadow-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAgentOnly ? "Search App..." : "Search Agent..."}
                className="bg-transparent text-slate-800 text-xs font-medium focus:outline-none w-full"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-all"
                  title="Clear Search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* User Filter Dropdown for Team Lead / Admin */}
            {!isAgentOnly && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
                <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <select
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="bg-transparent text-slate-800 text-xs font-medium focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Agents & Staff</option>
                  {Array.from(new Set(screenshots.map((s) => s.userId))).map((uId) => {
                    const name = screenshots.find((s) => s.userId === uId)?.userName;
                    return (
                      <option key={uId} value={uId}>
                        {name}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

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

      {/* Active Application Usage Metrics Summary */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4 pb-2 border-b border-slate-200">
          <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
            <Monitor className="w-5 h-5 text-emerald-600" /> Top Desktop Applications Tracked
          </h3>
          <span className="text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full">
            Avg Activity: {avgActivity}% ({viewTab.toUpperCase()} View)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-3">
            <div className="p-3 rounded-lg bg-blue-100 text-blue-700 border border-blue-200">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">Google Chrome</div>
              <div className="text-xs text-slate-500">Hubspot CRM / Gmail</div>
              <div className="text-xs font-mono font-bold text-blue-700 mt-1">4h 12m Active</div>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-3">
            <div className="p-3 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">Microsoft Excel</div>
              <div className="text-xs text-slate-500">Leads & Data Entry</div>
              <div className="text-xs font-mono font-bold text-emerald-700 mt-1">2h 45m Active</div>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-3">
            <div className="p-3 rounded-lg bg-purple-100 text-purple-700 border border-purple-200">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">Slack Workspace</div>
              <div className="text-xs text-slate-500">Team Channels</div>
              <div className="text-xs font-mono font-bold text-purple-700 mt-1">1h 10m Active</div>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-3">
            <div className="p-3 rounded-lg bg-amber-100 text-amber-700 border border-amber-200">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">Zoom Meetings</div>
              <div className="text-xs text-slate-500">Client Call Sync</div>
              <div className="text-xs font-mono font-bold text-amber-700 mt-1">1h 30m Active</div>
            </div>
          </div>
        </div>
      </div>

      {/* Screenshots Gallery Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-600" /> Automated Visual Screenshots Vault
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Visual desktop captures synchronized with shift activity logs and securely stored in database.
            </p>
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setScreenshotFilter('all')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  screenshotFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({screenshots.length})
              </button>
              <button
                type="button"
                onClick={() => setScreenshotFilter('low_activity')}
                className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  screenshotFilter === 'low_activity'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-amber-700 hover:bg-amber-100/60'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                Low Activity ({screenshots.filter((s) => s.lowActivityAlert || s.activityPercent < 45).length})
              </button>
              <button
                type="button"
                onClick={() => setScreenshotFilter('blurred')}
                className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  screenshotFilter === 'blurred'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-blue-700 hover:bg-blue-100/60'
                }`}
              >
                <Lock className="w-3 h-3" />
                Privacy Blurred ({screenshots.filter((s) => s.isBlurred && !s.lowActivityAlert && s.activityPercent >= 45).length})
              </button>
            </div>
            <span className="text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-full">
              Period: {getPeriodLabel()} ({viewTab})
            </span>
          </div>
        </div>

        {filteredScreenshots.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-1">
            <p className="font-semibold text-slate-700">No screenshots found for the selected filter and period.</p>
            <p className="text-xs text-slate-400">
              Period: {getPeriodLabel()} ({viewTab} view)
              {searchQuery ? ` matching "${searchQuery}"` : ''}
              {screenshotFilter !== 'all' ? ` [Filter: ${screenshotFilter}]` : ''}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredScreenshots.map((scr) => {
              const isTiredOrLowActivity = scr.lowActivityAlert || scr.activityPercent < 45;
              const isCardBlurred = scr.isBlurred && !isTiredOrLowActivity;
              const isHovered = hoveredScrId === scr.id;

              return (
                <div
                  key={scr.id}
                  onMouseEnter={() => setHoveredScrId(scr.id)}
                  onMouseLeave={() => setHoveredScrId(null)}
                  className={`bg-slate-50 border rounded-xl overflow-hidden group transition-all shadow-sm flex flex-col justify-between ${
                    isTiredOrLowActivity
                      ? 'border-amber-300 ring-1 ring-amber-400/40'
                      : 'border-slate-200 hover:border-blue-400'
                  }`}
                >
                  {/* Image Container with Smart Blur */}
                  <div className="relative aspect-video bg-slate-900 overflow-hidden select-none">
                    <img
                      src={scr.imageUrl}
                      alt={scr.activeApp}
                      className={`w-full h-full object-cover transition-all duration-300 ${
                        isCardBlurred && !isHovered
                          ? 'blur-md grayscale-[25%] scale-105 opacity-90'
                          : 'blur-0 scale-100 opacity-100 group-hover:scale-105'
                      }`}
                    />

                    {/* Overlay Action Buttons on Hover */}
                    <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-20">
                      <button
                        type="button"
                        onClick={() => setSelectedImage(scr)}
                        className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 shadow-md transition-all cursor-pointer"
                        title="Zoom Full Resolution"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleScreenshotBlur(scr.id)}
                        className="p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 shadow-md border border-slate-600 transition-all cursor-pointer"
                        title={scr.isBlurred ? 'Permanent Unblur' : 'Blur Screenshot'}
                      >
                        {scr.isBlurred ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-amber-400" />}
                      </button>
                      {(currentUser.role === 'admin' || currentUser.role === 'team_lead') && (
                        <button
                          type="button"
                          onClick={() => deleteScreenshot(scr.id)}
                          className="p-2 rounded-lg bg-red-600 text-white hover:bg-red-500 shadow-md transition-all cursor-pointer"
                          title="Delete screenshot capture"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Info Metadata */}
                  <div className="p-3 text-xs space-y-1.5 bg-white">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span className="truncate max-w-[140px]">{scr.userName}</span>
                      <span className="text-blue-600 font-mono text-[10px] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                        {scr.timestamp}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 truncate" title={scr.activeApp}>
                      App: <span className="text-slate-900 font-semibold">{scr.activeApp}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 text-[10px] border-t border-slate-100">
                      <span className="text-slate-500">Activity Level:</span>
                      <span
                        className={`font-mono font-bold px-1.5 py-0.5 rounded border ${
                          scr.activityPercent < 45
                            ? 'text-red-700 bg-red-50 border-red-200'
                            : scr.activityPercent < 70
                            ? 'text-amber-700 bg-amber-50 border-amber-200'
                            : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        }`}
                      >
                        {scr.activityPercent}% Active
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hardware Inactivity & Shift Extension Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-2 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" /> Random Inactivity Logs & Shift Extensions
            </h3>
            <p className="text-xs text-slate-500">
              Hardware inactivity logs triggered on random 10–15m intervals. Subtracted from employee daily shift time and synced to Google Sheets.
            </p>
          </div>
          <span className="text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 rounded-full font-mono">
            {idleLogs.length} Idle Events Recorded
          </span>
        </div>

        {idleLogs.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No idle periods or inactivity deductions recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Employee</th>
                  <th className="py-3 px-3">Time Detected</th>
                  <th className="py-3 px-3">Inactivity Duration</th>
                  <th className="py-3 px-3 text-red-600">Subtracted from Shift</th>
                  <th className="py-3 px-3 text-emerald-700">Required Shift Extension</th>
                  <th className="py-3 px-3">Active Task</th>
                  <th className="py-3 px-3">Reason / Trigger</th>
                  <th className="py-3 px-3">DB & Sheets Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {idleLogs.map((log) => {
                  const deductMins = log.deductedFromShiftMinutes || log.durationMinutes;
                  const extendMins = log.requiredExtensionMinutes || log.durationMinutes;
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-900">{log.userName}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{log.timestamp}</td>
                      <td className="py-3 px-3 font-bold text-amber-700">{log.durationMinutes} mins</td>
                      <td className="py-3 px-3 font-bold text-red-600 font-mono">-{deductMins} mins</td>
                      <td className="py-3 px-3 font-bold text-emerald-700 font-mono">+{extendMins} mins</td>
                      <td className="py-3 px-3">
                        <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded font-medium">
                          {log.task}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-xs truncate" title={log.reason}>
                        {log.reason}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          ✓ Synced (Idle_Time_Logs)
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Zoom Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-md p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-slate-900">{selectedImage.userName}</h3>
                  <span className="text-xs font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                    {selectedImage.timestamp}
                  </span>
                  {selectedImage.lowActivityAlert || selectedImage.activityPercent < 45 ? (
                    <span className="text-xs font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-300">
                      <AlertTriangle className="w-3 h-3" /> Low Activity / Fatigue ({selectedImage.activityPercent}%)
                    </span>
                  ) : (
                    <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                      {selectedImage.activityPercent}% Activity Score
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Active Application: <span className="font-semibold text-slate-800">{selectedImage.activeApp}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleScreenshotBlur(selectedImage.id)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-300 flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  {selectedImage.isBlurred ? (
                    <>
                      <Eye className="w-3.5 h-3.5 text-emerald-600" /> Reveal (Unblur)
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-slate-600" /> Apply Privacy Blur
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm cursor-pointer transition-all"
                >
                  Close Window
                </button>
              </div>
            </div>

            <div className="relative rounded-xl overflow-hidden border border-slate-300 bg-slate-950 max-h-[60vh] flex items-center justify-center">
              <img
                src={selectedImage.imageUrl}
                alt={selectedImage.activeApp}
                className={`max-h-[60vh] object-contain w-full transition-all duration-300 ${
                  selectedImage.isBlurred && !(selectedImage.lowActivityAlert || selectedImage.activityPercent < 45)
                    ? 'blur-md grayscale-[25%]'
                    : 'blur-0'
                }`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
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

