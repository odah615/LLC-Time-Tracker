import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  User,
  TimeLog,
  ScreenshotLog,
  IdleLog,
  LeaveRequest,
  ManualTimeRequest,
  PayrollRecord,
  TaskCategory,
  Designation,
  WorldClockItem,
  AppUsage,
  AuditLog,
  UserPresence,
  DailyAttendanceLog,
  PasswordResetRequest,
  RolePermissions,
} from '../types';
import { doc, setDoc, deleteDoc, onSnapshot, collection, getDoc, disableNetwork, enableNetwork } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getManilaDateString, getManilaTimeString, formatLogStartTime, formatLogEndTime } from '../lib/dateUtils';
import { generateUniqueUsername, deduplicateUsers, resolveCanonicalEmployee } from '../lib/userUtils';
import {
  syncDataToGoogleSheetsWebhook,
  syncEmployeesToGoogleSheetsWebhook,
  syncAgentHeartbeatToSheets,
  DEFAULT_SPREADSHEET_URL,
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_WEBHOOK_URL,
  fetchEmployeesFromGoogleSheets,
  fetchTimeLogsFromGoogleSheets,
  fetchLivePresenceFromGoogleSheets,
  isValidWebhookUrl,
  resetGoogleSpreadsheetData,
  normalizeWorkDate,
  normalizeTimeValue,
  parseDurationSeconds,
} from '../lib/googleSheetsSync';
import { playInactivityChime, playUrgentPulse } from '../lib/soundAlerts';
import {
  INITIAL_USERS,
  INITIAL_TIME_LOGS,
  INITIAL_SCREENSHOTS,
  INITIAL_IDLE_LOGS,
  INITIAL_LEAVE_REQUESTS,
  INITIAL_MANUAL_TIME_REQUESTS,
  INITIAL_PAYROLL,
  INITIAL_WORLD_CLOCKS,
  INITIAL_AUDIT_LOGS,
  TASK_LIST,
  DESIGNATION_LIST,
  DEFAULT_DESIGNATION_TASKS,
  DEFAULT_ROLE_PERMISSIONS,
} from '../data/initialData';

/**
 * Recursively cleans data for Firestore by removing any `undefined` values or properties,
 * replacing them safely so Firestore setDoc / updateDoc never throws:
 * "Function setDoc() called with invalid data. Unsupported field value: undefined"
 */
export function sanitizeForFirestore<T>(val: T): T {
  if (val === undefined) {
    return null as unknown as T;
  }
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  const result: Record<string, any> = {};
  for (const [key, v] of Object.entries(val as Record<string, any>)) {
    if (v !== undefined) {
      result[key] = sanitizeForFirestore(v);
    }
  }
  return result as T;
}

let isQuotaExhaustedGlobal = (() => {
  if (typeof window === 'undefined') return false;
  try {
    const savedEngine = localStorage.getItem('trackpulse_storage_engine');
    if (savedEngine === 'unlimited_bridge') {
      return false;
    }
    const savedQuotaDate = localStorage.getItem('trackpulse_quota_exhausted_date');
    const today = new Date().toISOString().slice(0, 10);
    if (savedQuotaDate && savedQuotaDate === today) {
      return true;
    }
    return sessionStorage.getItem('trackpulse_quota_exhausted') === 'true';
  } catch {
    return false;
  }
})();

if (isQuotaExhaustedGlobal) {
  try {
    disableNetwork(db).catch(() => {});
  } catch {}
} else {
  try {
    enableNetwork(db).catch(() => {});
  } catch {}
}

export const setCloudQuotaExhausted = () => {
  if (!isQuotaExhaustedGlobal) {
    isQuotaExhaustedGlobal = true;
    console.warn('[Storage] Quota limit reached or high-capacity bridge activated. Operating in permanent unlimited Central Server & Google Sheets Bridge mode (Zero Firestore Quota Consumption).');
    try {
      if (typeof window !== 'undefined') {
        const today = new Date().toISOString().slice(0, 10);
        sessionStorage.setItem('trackpulse_quota_exhausted', 'true');
        localStorage.setItem('trackpulse_quota_exhausted_date', today);
        localStorage.setItem('trackpulse_storage_engine', 'unlimited_bridge');
      }
    } catch {}
    try {
      disableNetwork(db).catch(() => {});
    } catch {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('firestore_quota_status_change'));
    }
  }
};

const safeSetDoc = async (docRef: any, data: any, options?: any) => {
  if (isQuotaExhaustedGlobal) {
    return Promise.resolve();
  }
  try {
    const cleanData = sanitizeForFirestore(data);
    return await (options ? setDoc(docRef, cleanData, options) : setDoc(docRef, cleanData));
  } catch (err: any) {
    const isQuota = err?.code === 'resource-exhausted' ||
                    err?.message?.includes('Quota exceeded') ||
                    err?.message?.includes('resource-exhausted');
    if (isQuota) {
      setCloudQuotaExhausted();
      return Promise.resolve();
    }
    console.warn('safeSetDoc write warning:', err);
    return Promise.resolve();
  }
};

const safeDeleteDoc = async (docRef: any) => {
  if (isQuotaExhaustedGlobal) {
    return Promise.resolve();
  }
  try {
    return await deleteDoc(docRef);
  } catch (err: any) {
    const isQuota = err?.code === 'resource-exhausted' ||
                    err?.message?.includes('Quota exceeded') ||
                    err?.message?.includes('resource-exhausted');
    if (isQuota) {
      setCloudQuotaExhausted();
      return Promise.resolve();
    }
    console.warn('safeDeleteDoc warning:', err);
    return Promise.resolve();
  }
};

interface TaskSwitchPending {
  targetTask: TaskCategory;
}

interface AppContextType {
  currentUser: User;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setCurrentUser: (user: User) => void;
  // Cloud Quota & Connection Health
  isCloudQuotaExhausted: boolean;
  // Auth state
  isAuthenticated: boolean;
  loginMode: 'webapp' | 'software';
  setLoginMode: (mode: 'webapp' | 'software') => void;
  login: (user: User, mode?: 'webapp' | 'software') => void;
  logout: (reason?: string) => void;
  // Web Session Auto-Logout (10-minute Inactivity Timer for WebApp with 5-minute warning)
  webSessionRemainingSeconds: number;
  isSessionWarningActive: boolean;
  webSessionWarningCountdown: number;
  refreshWebSession: () => void;
  sessionExpiredReason: string | null;
  clearSessionExpiredReason: () => void;
  // Offline Connection Loss & 30-Minute Grace Period Engine
  isOffline: boolean;
  offlineSinceTimestamp: number | null;
  offlineSecondsRemaining: number;
  offlineStatusStage: 'online' | 'warning_5m' | 'critical_countdown' | 'timeout';
  retryConnection: () => Promise<boolean>;
  simulateOfflineToggle: () => void;
  // Timer state
  isTracking: boolean;
  isPaused: boolean;
  currentDesignation: Designation;
  currentTask: TaskCategory;
  elapsedSeconds: number;
  currentSessionApps: AppUsage[];
  currentMouseActivity: number;
  currentKeyboardActivity: number;
  currentActiveApp: string;
  taskSwitchPending: TaskSwitchPending | null;
  // Idle Time Engine (Random 10-15m Inactivity Tracking & Shift Deduction)
  currentIdleThresholdMinutes: number;
  currentInactivitySeconds: number;
  sessionIdleDeductionSeconds: number;
  isIdleAlertActive: boolean;
  dismissIdleAlert: () => void;
  recordIdleInactivityEvent: (idleMinutes: number, reason?: string) => void;
  simulateIdleEvent: (minutes?: number) => void;
  restoreInactivityDeduction: () => void;
  isDualMonitorMode: boolean;
  toggleDualMonitorMode: () => void;
  storageEngineMode: 'unlimited_bridge' | 'firestore';
  setStorageEngineMode: (mode: 'unlimited_bridge' | 'firestore') => void;
  inactivityAlertState: {
    isOpen: boolean;
    idleMinutes: number;
    remainingSeconds: number;
  };
  respondToInactivityAlert: (action: 'stay_active' | 'pause_tracker') => void;
  // Actions
  startTracking: () => void;
  pauseTracking: () => void;
  resumeTracking: () => void;
  stopTracking: () => void;
  selectDesignation: (desig: Designation) => void;
  selectTaskWithPrompt: (task: TaskCategory) => void;
  confirmTaskSwitch: () => void;
  cancelTaskSwitch: () => void;
  // Data lists
  timeLogs: TimeLog[];
  screenshots: ScreenshotLog[];
  idleLogs: IdleLog[];
  leaveRequests: LeaveRequest[];
  manualTimeRequests: ManualTimeRequest[];
  payrollRecords: PayrollRecord[];
  worldClocks: WorldClockItem[];
  auditLogs: AuditLog[];
  userPresenceList: UserPresence[];
  dailyAttendanceLogs: DailyAttendanceLog[];
  passwordResetRequests: PasswordResetRequest[];
  addAuditLog: (entry: Omit<AuditLog, 'id' | 'timestamp' | 'dateFormatted'>) => void;
  // Save confirmation toast
  saveToast: string | null;
  setSaveToast: (msg: string | null) => void;
  // Google Sheets Webhook Sync
  googleSheetsWebhookUrl: string;
  setGoogleSheetsWebhookUrl: (url: string) => void;
  isAutoSyncToSheetsEnabled: boolean;
  setIsAutoSyncToSheetsEnabled: (val: boolean) => void;
  triggerGoogleSheetsSync: (overrideUrl?: string) => Promise<{ success: boolean; message: string }>;
  importEmployeesFromGoogleSheets: (overrideUrl?: string) => Promise<{ success: boolean; count: number; message: string }>;
  importTimeLogsFromGoogleSheets: (overrideUrl?: string) => Promise<{ success: boolean; count: number; message: string }>;
  importPresenceFromGoogleSheets: (overrideUrl?: string) => Promise<{ success: boolean; count: number; message: string }>;
  syncAllFromGoogleSheets: (overrideUrl?: string) => Promise<{ success: boolean; message: string }>;
  startAgentLiveShift: (userId: string, task?: TaskCategory) => void;
  stopAgentLiveShift: (userId: string) => void;
  simulateActiveTraineesShift: () => void;
  // Firestore loading state
  isFirestoreLoaded: boolean;
  // Desktop dock view toggle
  isDesktopDockView: boolean;
  setIsDesktopDockView: (val: boolean) => void;
  // Admin & CRUD operations
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (id: string, data: Partial<User>) => void;
  deleteUser: (id: string) => void;
  resetUserPassword: (userId: string, newPass: string, requireChangeOnNextLogin?: boolean) => void;
  requestPasswordReset: (targetUserId: string, reason?: string) => void;
  approvePasswordResetRequest: (requestId: string) => void;
  rejectPasswordResetRequest: (requestId: string, notes?: string) => void;
  addTimeLog: (log: Omit<TimeLog, 'id'>) => void;
  updateTimeLog: (id: string, data: Partial<TimeLog>) => void;
  deleteTimeLog: (id: string) => void;
  approveManualTimeRequest: (id: string) => void;
  rejectManualTimeRequest: (id: string) => void;
  submitManualTimeRequest: (req: Omit<ManualTimeRequest, 'id' | 'status'>) => void;
  approveLeaveRequest: (id: string) => void;
  rejectLeaveRequest: (id: string) => void;
  submitLeaveRequest: (req: Omit<LeaveRequest, 'id' | 'status' | 'requestedAt'>) => void;
  deleteScreenshot: (id: string) => void;
  toggleScreenshotBlur: (id: string) => void;
  updatePayrollStatus: (id: string, status: PayrollRecord['status']) => void;
  addWorldClock: (clock: Omit<WorldClockItem, 'id'>) => void;
  deleteWorldClock: (id: string) => void;
  resetDatabaseToFreshState: () => Promise<void>;
  // Designation & Task Management (Super Admin & Admin)
  designationTasks: Record<string, string[]>;
  designationList: string[];
  getTasksForDesignation: (designation?: string) => string[];
  addDesignation: (name: string, initialTasks?: string[]) => void;
  deleteDesignation: (name: string) => void;
  addTaskToDesignation: (designation: string, taskName: string) => void;
  removeTaskFromDesignation: (designation: string, taskName: string) => void;
  // Role & View Access Permissions (Super Admin & Admin)
  rolePermissions: Record<string, RolePermissions>;
  updateRolePermission: (roleKey: string, permissionKey: keyof RolePermissions, value: boolean) => void;
  updateUserCustomPermission: (userId: string, permissionKey: keyof RolePermissions, value: boolean) => void;
  hasPermission: (permissionKey: keyof RolePermissions, targetUser?: User) => boolean;
  // Helpers
  formatDuration: (totalSec: number) => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Helper to normalize Super Admin properties
  const normalizeSuperAdmin = (u: User): User => {
    const isSuperAdmin =
      u.employeeCode?.toLowerCase() === 'superadmin' ||
      u.id === 'usr-superadmin-red' ||
      u.id === 'usr-superadmin-root' ||
      u.email === 'admin@llc.com';

    if (isSuperAdmin) {
      return {
        ...u,
        id: 'usr-superadmin-red',
        name: 'Admin',
        email: 'admin@llc.com',
        employeeCode: 'SuperAdmin',
        username: u.username || 'admin',
        role: 'admin' as const,
        designation: 'Admin',
        department: 'Executive Management',
        password: u.password || 'AdminpassW0rd123!',
        mustChangePassword: false,
        screenshotMonitored: false,
        activityMonitored: false,
      };
    }

    // Ensure Trainer (Pia / LLC-0003) is permanently preserved with trainer role & trainer username
    const isTrainer =
      u.employeeCode?.toUpperCase() === 'LLC-0003' ||
      u.email?.toLowerCase() === 'piaodahcam@gmail.com' ||
      u.id === 'usr-llc-0003' ||
      u.name?.toLowerCase() === 'pia' ||
      u.designation?.toLowerCase().includes('trainer');

    if (isTrainer) {
      return {
        ...u,
        role: 'trainer' as const,
        designation: u.designation || 'Trainer',
        username: u.username && u.username !== 'agent' ? u.username : 'trainer',
        department: u.department || 'Training',
      };
    }
    return u;
  };

  // Helper to ensure all users have a guaranteed unique username and default rate of 0
  const ensureUsernames = (userList: User[]): User[] => {
    const result: User[] = [];
    for (const rawUser of userList) {
      let norm = normalizeSuperAdmin(rawUser);
      const canon = resolveCanonicalEmployee(norm);
      if (canon) {
        norm = {
          ...norm,
          name: canon.name, // Guaranteed full employee name
          username: canon.username, // Guaranteed username
          employeeCode: canon.code,
          email: canon.email || norm.email,
          role: canon.role || norm.role,
          designation: canon.designation || norm.designation,
        };
      }
      if (!norm.username || norm.username.trim() === '') {
        norm.username = generateUniqueUsername(norm.name, result, norm.id);
      }
      // Guarantee legacy default rates (23,000 / 143.75 / 60,000 / 40,000 / 35,000 / 30,000) default to 0
      const mRate = norm.monthlyRate !== undefined && norm.monthlyRate !== null ? Number(norm.monthlyRate) : 0;
      const hRate = norm.hourlyRate !== undefined && norm.hourlyRate !== null ? Number(norm.hourlyRate) : 0;
      if (mRate === 23000 || mRate === 60000 || mRate === 40000 || mRate === 35000 || mRate === 30000 || isNaN(mRate)) {
        norm = { ...norm, monthlyRate: 0, hourlyRate: 0 };
      } else if (hRate === 143.75 || hRate === 375 || hRate === 250 || hRate === 218.75 || hRate === 187.5 || isNaN(hRate)) {
        norm = { ...norm, hourlyRate: norm.monthlyRate ? Number((norm.monthlyRate / 160).toFixed(2)) : 0 };
      }
      result.push(norm);
    }
    return result;
  };

  // Load from localStorage or defaults
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('trackpulse_users');
    if (!saved) return deduplicateUsers(ensureUsernames(INITIAL_USERS));
    try {
      const parsed: User[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const cleaned = deduplicateUsers(ensureUsernames(parsed));
        localStorage.setItem('trackpulse_users', JSON.stringify(cleaned));
        return cleaned;
      }
      return deduplicateUsers(ensureUsernames(INITIAL_USERS));
    } catch {
      return deduplicateUsers(ensureUsernames(INITIAL_USERS));
    }
  });

  const [currentUser, setCurrentUser] = useState<User>(() => {
    try {
      // 1. Check URL parameters first (allows Desktop App "Open in Web Portal" to preserve exact logged-in agent)
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const userParam = urlParams.get('user') || urlParams.get('userId');
        if (userParam) {
          const foundByParam = users.find(
            (u) =>
              u.id === userParam ||
              (u.employeeCode && u.employeeCode.toLowerCase() === userParam.toLowerCase()) ||
              (u.username && u.username.toLowerCase() === userParam.toLowerCase())
          );
          if (foundByParam) {
            localStorage.setItem('trackpulse_current_user', JSON.stringify(foundByParam));
            localStorage.setItem('trackpulse_auth', 'true');
            return foundByParam.role === 'admin' ? normalizeSuperAdmin(foundByParam) : foundByParam;
          }
        }
      }

      // 2. Check saved session in localStorage
      const savedUserStr = localStorage.getItem('trackpulse_current_user');
      if (savedUserStr) {
        const parsed = JSON.parse(savedUserStr);
        if (parsed && parsed.id) {
          const found = users.find(
            (u) =>
              u.id === parsed.id ||
              (u.employeeCode && parsed.employeeCode && u.employeeCode.toLowerCase() === parsed.employeeCode.toLowerCase())
          );
          if (found) {
            return found.role === 'admin' ? normalizeSuperAdmin(found) : found;
          }
          return parsed.role === 'admin' ? normalizeSuperAdmin(parsed) : parsed;
        }
      }
    } catch (e) {}

    // Default fallback (used only if not authenticated)
    return users[0] || INITIAL_USERS[0];
  });

  // Authentication State: Only authenticated if explicit saved user or valid session exists
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const isAuth = typeof window !== 'undefined' && localStorage.getItem('trackpulse_auth') === 'true';
    const hasUser = typeof window !== 'undefined' && !!localStorage.getItem('trackpulse_current_user');
    const isTracking = typeof window !== 'undefined' && localStorage.getItem('trackpulse_active_tracking') === 'true';
    const isElectron = typeof window !== 'undefined' && (
      (window as any).isElectronApp === true ||
      window.navigator.userAgent.includes('Electron')
    );

    // 10-Minute Web Session Inactivity Auto-Logout:
    // If authenticated on the website (not Electron desktop software) and not actively tracking a shift:
    if (isAuth && !isElectron && !isTracking) {
      const lastActiveStr = localStorage.getItem('trackpulse_last_active_timestamp');
      const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : 0;
      // If user was away/closed the website for 10+ minutes (600s), session is EXPIRED
      if (lastActive > 0 && Date.now() - lastActive >= 600 * 1000) {
        localStorage.removeItem('trackpulse_auth');
        localStorage.setItem('trackpulse_session_expired_reason', 'inactivity_10min');
        return false;
      }
      if (!lastActiveStr) {
        localStorage.setItem('trackpulse_last_active_timestamp', Date.now().toString());
      }
    }

    if (typeof window !== 'undefined') {
      const isExpired = localStorage.getItem('trackpulse_session_expired_reason') === 'inactivity_10min';
      if (!isExpired) {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('user') || urlParams.get('userId')) {
          return true;
        }
      }
    }

    return isAuth && hasUser;
  });
  const [loginMode, setLoginMode] = useState<'webapp' | 'software'>(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      if (
        search.includes('mode=desktop') ||
        search.includes('source=software') ||
        search.includes('appMode=desktop') ||
        search.includes('mode=software') ||
        window.navigator.userAgent.includes('Electron') ||
        (window as any).isElectronApp === true ||
        Boolean((window as any).electronAPI)
      ) {
        return 'software';
      }
    }
    return 'webapp';
  });

  const [timeLogs, setTimeLogs] = useState<TimeLog[]>(() => {
    const saved = localStorage.getItem('trackpulse_timelogs');
    return saved ? JSON.parse(saved) : [];
  });

  const [screenshots, setScreenshots] = useState<ScreenshotLog[]>(() => {
    const saved = localStorage.getItem('trackpulse_screenshots');
    return saved ? JSON.parse(saved) : [];
  });

  const [idleLogs, setIdleLogs] = useState<IdleLog[]>(() => {
    const saved = localStorage.getItem('trackpulse_idlelogs');
    return saved ? JSON.parse(saved) : [];
  });

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    const saved = localStorage.getItem('trackpulse_leaverequests');
    return saved ? JSON.parse(saved) : [];
  });

  const [manualTimeRequests, setManualTimeRequests] = useState<ManualTimeRequest[]>(() => {
    const saved = localStorage.getItem('trackpulse_manualrequests');
    return saved ? JSON.parse(saved) : [];
  });

  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>(() => {
    const saved = localStorage.getItem('trackpulse_payroll');
    return saved ? JSON.parse(saved) : INITIAL_PAYROLL;
  });

  const [dailyAttendanceLogs, setDailyAttendanceLogs] = useState<DailyAttendanceLog[]>(() => {
    const saved = localStorage.getItem('trackpulse_attendance');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Clean out any legacy dummy auto-seeded logs with 08:30:00 AM and 0 tracked seconds
          return parsed.filter(
            (a: DailyAttendanceLog) =>
              !(a.firstLoginTime === '08:30:00 AM' && (a.totalLoggedSeconds === 0 || !a.lastLogoutTime))
          );
        }
      } catch {
        // fallback
      }
    }
    return [];
  });

  const [passwordResetRequests, setPasswordResetRequests] = useState<PasswordResetRequest[]>(() => {
    const saved = localStorage.getItem('trackpulse_pwd_requests');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return [];
  });

  const [userPresenceList, setUserPresenceList] = useState<UserPresence[]>(() => {
    const saved = localStorage.getItem('trackpulse_presence');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const now = Date.now();
          return parsed.map((p: UserPresence) => {
            const canon = resolveCanonicalEmployee({
              employeeCode: p.employeeCode,
              username: p.userName,
              name: p.userName,
              id: p.userId,
            });
            const resolvedName = canon?.name || p.userName;
            const lastMs = p.lastHeartbeat ? new Date(p.lastHeartbeat).getTime() : 0;
            // Clean up stale inactive sessions (> 10 mins) on initial load
            if (p.isOnline && now - lastMs > 45 * 1000) {
              return {
                ...p,
                userName: resolvedName,
                employeeCode: canon?.code || p.employeeCode,
                isOnline: false,
                status: 'offline' as const,
                isTracking: false,
                currentTask: 'Shift Concluded',
              };
            }
            return {
              ...p,
              userName: resolvedName,
              employeeCode: canon?.code || p.employeeCode,
            };
          });
        }
      } catch {
        // fallback
      }
    }
    return INITIAL_USERS.map((u) => ({
      userId: u.id,
      userName: u.name,
      role: u.role,
      designation: u.designation,
      employeeCode: u.employeeCode,
      department: u.department || 'Executive Management',
      teamLeaderId: u.teamLeaderId || '',
      isOnline: false,
      status: 'offline',
      mouseActivity: 0,
      keyboardActivity: 0,
      lastHeartbeat: new Date().toISOString(),
    }));
  });

  const [worldClocks, setWorldClocks] = useState<WorldClockItem[]>(() => {
    const saved = localStorage.getItem('trackpulse_worldclocks');
    return saved ? JSON.parse(saved) : INITIAL_WORLD_CLOCKS;
  });

  // Custom Designation & Tasks Management State
  const [designationTasks, setDesignationTasks] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('trackpulse_designation_tasks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULT_DESIGNATION_TASKS, ...parsed };
        }
      } catch (e) {
        // fallback
      }
    }
    return DEFAULT_DESIGNATION_TASKS;
  });

  // Granular Role & Designation Access Permissions State
  const [rolePermissions, setRolePermissions] = useState<Record<string, RolePermissions>>(() => {
    const saved = localStorage.getItem('trackpulse_role_permissions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULT_ROLE_PERMISSIONS, ...parsed };
        }
      } catch (e) {
        // fallback
      }
    }
    return DEFAULT_ROLE_PERMISSIONS;
  });

  const [isCloudQuotaExhausted, setIsCloudQuotaExhausted] = useState(isQuotaExhaustedGlobal);

  useEffect(() => {
    const handleQuotaChange = () => {
      setIsCloudQuotaExhausted(isQuotaExhaustedGlobal);
    };
    window.addEventListener('firestore_quota_status_change', handleQuotaChange);
    return () => window.removeEventListener('firestore_quota_status_change', handleQuotaChange);
  }, []);

  const [saveToast, setSaveToast] = useState<string | null>(null);

  const [googleSheetsWebhookUrl, setGoogleSheetsWebhookUrlState] = useState<string>(() => {
    const saved = localStorage.getItem('trackpulse_sheets_webhook') || '';
    if (saved && isValidWebhookUrl(saved)) {
      return saved;
    }
    return DEFAULT_WEBHOOK_URL;
  });

  const setGoogleSheetsWebhookUrl = (url: string) => {
    const cleanUrl = (url || '').trim();
    if (!cleanUrl || !isValidWebhookUrl(cleanUrl)) {
      setGoogleSheetsWebhookUrlState('');
      localStorage.removeItem('trackpulse_sheets_webhook');
      fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: '' }),
      }).catch(() => {});
      return;
    }
    setGoogleSheetsWebhookUrlState(cleanUrl);
    localStorage.setItem('trackpulse_sheets_webhook', cleanUrl);
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl: cleanUrl }),
    }).catch(() => {});
    safeSetDoc(doc(db, 'system_state', 'config'), {
      webhookUrl: cleanUrl,
      sheetsWebhookUrl: cleanUrl,
      lastUpdated: new Date().toISOString(),
    }, { merge: true }).catch((err) =>
      console.warn('Webhook URL config save err:', err)
    );
  };

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('trackpulse_auditlogs');
    return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
  });

  const [isAutoSyncToSheetsEnabled, setIsAutoSyncToSheetsEnabledState] = useState<boolean>(() => {
    return localStorage.getItem('trackpulse_auto_sync_enabled') !== 'false'; // Defaults to TRUE for automatic real-time spreadsheet persistence
  });

  const setIsAutoSyncToSheetsEnabled = (enabled: boolean) => {
    setIsAutoSyncToSheetsEnabledState(enabled);
    localStorage.setItem('trackpulse_auto_sync_enabled', enabled ? 'true' : 'false');
  };

  const liveTrackingSnapshotRef = useRef<{
    isTracking: boolean;
    elapsedSeconds: number;
    currentTask: string;
    currentDesignation: string;
    startTimeIso: string | null;
    mouseActivity: number;
    keyboardActivity: number;
    activeApp: string;
  }>({
    isTracking: false,
    elapsedSeconds: 0,
    currentTask: 'Email Reachout',
    currentDesignation: 'Agent',
    startTimeIso: null,
    mouseActivity: 95,
    keyboardActivity: 95,
    activeApp: 'LLC Time Tracker Desktop App',
  });

  const lastAutoSyncTimestampRef = useRef<number>(0);

  // Dedicated automatic sync dispatcher with fallback API Bridge & Firestore config fetch
  const triggerAutoSync = useCallback(
    async (
      updatedUsers = users,
      updatedLogs = timeLogs,
      updatedAudit = auditLogs,
      updatedPayroll = payrollRecords,
      updatedAttendance = dailyAttendanceLogs,
      updatedIdle = idleLogs,
      updatedLeaves = leaveRequests,
      updatedDesignationTasks = designationTasks,
      updatedRolePermissions = rolePermissions,
      forcePush = false
    ) => {
      // If auto-sync is disabled, do not execute background pushes (keeps Google Sheets calm and static without constant reloading)
      if (!isAutoSyncToSheetsEnabled && !forcePush) {
        return;
      }

      // Throttle background pushes to at most once per 60 seconds unless explicitly forced
      const now = Date.now();
      if (!forcePush && now - lastAutoSyncTimestampRef.current < 60000) {
        return;
      }
      lastAutoSyncTimestampRef.current = now;

      let activeUrl = googleSheetsWebhookUrl || localStorage.getItem('trackpulse_sheets_webhook') || DEFAULT_WEBHOOK_URL;
      if (activeUrl && !isValidWebhookUrl(activeUrl)) {
        activeUrl = DEFAULT_WEBHOOK_URL;
      }

      if (activeUrl && isValidWebhookUrl(activeUrl)) {
        // Collect active live sessions from all employees currently tracking time
        const activeTrackersMap = new Map<string, {
          userId: string;
          userName: string;
          employeeCode?: string;
          designation: string;
          currentTask: string;
          elapsedSeconds: number;
          startTime: string;
          mouseActivity: number;
          keyboardActivity: number;
          currentApp: string;
        }>();

        // 1. Collect from presence list
        userPresenceList.forEach((p) => {
          if (p && p.isTracking && p.userId) {
            activeTrackersMap.set(p.userId, {
              userId: p.userId,
              userName: p.userName,
              employeeCode: p.employeeCode,
              designation: p.designation || 'Agent',
              currentTask: p.currentTask || 'Active Work',
              elapsedSeconds: p.elapsedSeconds || 1,
              startTime: p.startTime || p.loginTime || p.lastHeartbeat || new Date().toISOString(),
              mouseActivity: p.mouseActivity || 95,
              keyboardActivity: p.keyboardActivity || 95,
              currentApp: p.currentApp || 'LLC Time Tracker Desktop App',
            });
          }
        });

        // 2. Ensure current client user is included if actively tracking
        const liveSnap = liveTrackingSnapshotRef.current;
        if (currentUser && liveSnap.isTracking) {
          const currentElapsed = Math.max(liveSnap.elapsedSeconds, 1);
          const currentStart = liveSnap.startTimeIso || new Date(Date.now() - currentElapsed * 1000).toISOString();
          activeTrackersMap.set(currentUser.id, {
            userId: currentUser.id,
            userName: currentUser.name,
            employeeCode: currentUser.employeeCode,
            designation: liveSnap.currentDesignation || currentUser.designation || 'Agent',
            currentTask: liveSnap.currentTask || 'Active Work',
            elapsedSeconds: currentElapsed,
            startTime: currentStart,
            mouseActivity: liveSnap.mouseActivity || 95,
            keyboardActivity: liveSnap.keyboardActivity || 95,
            currentApp: liveSnap.activeApp || 'LLC Time Tracker Desktop App',
          });
        }

        const liveSessions: TimeLog[] = Array.from(activeTrackersMap.values()).map((p) => {
          const startFormatted = formatLogStartTime(p.startTime, 'Asia/Manila');
          return {
            id: `live-${p.userId}`,
            userId: p.userId,
            userName: p.userName,
            employeeCode: p.employeeCode,
            userAvatar: '',
            designation: p.designation,
            task: p.currentTask,
            startTime: p.startTime,
            endTime: 'Running Live',
            durationSeconds: p.elapsedSeconds,
            status: 'running' as const,
            geoTimezone: 'Asia/Manila',
            geoLocalStartTime: startFormatted,
            mouseActivityAvg: p.mouseActivity,
            keyboardActivityAvg: p.keyboardActivity,
            idleSeconds: 0,
            date: getManilaDateString(),
            notes: 'Tracking live in LLC Time Tracker Client',
            appsUsed: [{ appName: p.currentApp, icon: 'Globe', durationSeconds: p.elapsedSeconds, category: 'productive' as const }],
          };
        });

        syncDataToGoogleSheetsWebhook(
          activeUrl.trim(),
          updatedLogs,
          updatedUsers,
          updatedAudit,
          updatedPayroll,
          updatedAttendance,
          updatedIdle,
          updatedLeaves,
          updatedDesignationTasks,
          updatedRolePermissions,
          liveSessions,
          userPresenceList
        ).catch((err) => console.warn('Auto-sync to Google Sheets warning:', err));
      }
    },
    [isAutoSyncToSheetsEnabled, googleSheetsWebhookUrl, users, timeLogs, auditLogs, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests, designationTasks, rolePermissions, userPresenceList, currentUser]
  );

  const triggerGoogleSheetsSync = async (overrideUrl?: string): Promise<{ success: boolean; message: string }> => {
    let targetUrl = overrideUrl || googleSheetsWebhookUrl || localStorage.getItem('trackpulse_sheets_webhook') || '';
    if (!targetUrl || !targetUrl.trim()) {
      try {
        const apiRes = await fetch('/api/config');
        if (apiRes.ok) {
          const apiCfg = await apiRes.json();
          if (apiCfg?.webhookUrl && isValidWebhookUrl(apiCfg.webhookUrl)) {
            targetUrl = apiCfg.webhookUrl.trim();
            setGoogleSheetsWebhookUrlState(targetUrl);
            localStorage.setItem('trackpulse_sheets_webhook', targetUrl);
          }
        }
      } catch (e) {}
    }

    if (!targetUrl || !targetUrl.trim()) {
      setSaveToast(`âœ“ Saved to Central Database! (Tip: Paste Google Apps Script Webhook URL in Header to auto-sync directly to Google Sheets)`);
      setTimeout(() => setSaveToast(null), 8000);
      return { success: false, message: 'No webhook URL provided' };
    }

    const activeTrackersMap = new Map<string, {
      userId: string;
      userName: string;
      employeeCode?: string;
      designation: string;
      currentTask: string;
      elapsedSeconds: number;
      startTime: string;
      mouseActivity: number;
      keyboardActivity: number;
      currentApp: string;
    }>();

    userPresenceList.forEach((p) => {
      if (p && p.isTracking && p.userId) {
        activeTrackersMap.set(p.userId, {
          userId: p.userId,
          userName: p.userName,
          employeeCode: p.employeeCode,
          designation: p.designation || 'Agent',
          currentTask: p.currentTask || 'Active Work',
          elapsedSeconds: p.elapsedSeconds || 1,
          startTime: p.startTime || p.loginTime || p.lastHeartbeat || new Date().toISOString(),
          mouseActivity: p.mouseActivity || 95,
          keyboardActivity: p.keyboardActivity || 95,
          currentApp: p.currentApp || 'LLC Time Tracker Desktop App',
        });
      }
    });

    const liveSnap = liveTrackingSnapshotRef.current;
    if (currentUser && liveSnap.isTracking) {
      const currentElapsed = Math.max(liveSnap.elapsedSeconds, 1);
      const currentStart = liveSnap.startTimeIso || new Date(Date.now() - currentElapsed * 1000).toISOString();
      activeTrackersMap.set(currentUser.id, {
        userId: currentUser.id,
        userName: currentUser.name,
        employeeCode: currentUser.employeeCode,
        designation: liveSnap.currentDesignation || currentUser.designation || 'Agent',
        currentTask: liveSnap.currentTask || 'Active Work',
        elapsedSeconds: currentElapsed,
        startTime: currentStart,
        mouseActivity: liveSnap.mouseActivity || 95,
        keyboardActivity: liveSnap.keyboardActivity || 95,
        currentApp: liveSnap.activeApp || 'LLC Time Tracker Desktop App',
      });
    }

    const liveSessions: TimeLog[] = Array.from(activeTrackersMap.values()).map((p) => {
      const startFormatted = formatLogStartTime(p.startTime, 'Asia/Manila');
      return {
        id: `live-${p.userId}`,
        userId: p.userId,
        userName: p.userName,
        employeeCode: p.employeeCode,
        userAvatar: '',
        designation: p.designation,
        task: p.currentTask,
        startTime: p.startTime,
        endTime: 'Running Live',
        durationSeconds: p.elapsedSeconds,
        status: 'running' as const,
        geoTimezone: 'Asia/Manila',
        geoLocalStartTime: startFormatted,
        mouseActivityAvg: p.mouseActivity,
        keyboardActivityAvg: p.keyboardActivity,
        idleSeconds: 0,
        date: getManilaDateString(),
        notes: 'Tracking live in LLC Time Tracker Client',
        appsUsed: [{ appName: p.currentApp, icon: 'Globe', durationSeconds: p.elapsedSeconds, category: 'productive' as const }],
      };
    });

    const res = await syncDataToGoogleSheetsWebhook(
      targetUrl,
      timeLogs,
      users,
      auditLogs,
      payrollRecords,
      dailyAttendanceLogs,
      idleLogs,
      leaveRequests,
      designationTasks,
      rolePermissions,
      liveSessions,
      userPresenceList
    );
    if (res.success) {
      setSaveToast(`âœ“ Synced all Database Tabs (including Time Logs & Active Sessions) to Google Sheets!`);
    } else {
      setSaveToast(`âš ï¸ Google Sheets Sync: ${res.message}`);
    }
    setTimeout(() => setSaveToast(null), 8000);
    return res;
  };

  // Two-Way Sync: Pull employees directly from Google Sheets Employee_Directory tab
  const importEmployeesFromGoogleSheets = async (
    overrideUrl?: string
  ): Promise<{ success: boolean; count: number; message: string }> => {
    const targetUrl = overrideUrl || googleSheetsWebhookUrl || localStorage.getItem('trackpulse_sheets_webhook') || '';
    const res = await fetchEmployeesFromGoogleSheets(targetUrl, DEFAULT_SPREADSHEET_ID, users);

    if (res.success && res.employees.length > 0) {
  const deduplicated = deduplicateUsers(res.employees);

  // IMPORTANT:
  // Google Sheets is an employee directory source, NOT a delete source.
  // Merge Sheets employees into the existing app roster.
  // Employees missing temporarily from Sheets must NOT be deleted.

  const existingById = new Map<string, User>(users.map((u) => [u.id, u]));

  const existingByCode = new Map<string, User>(
    users
      .filter((u) => u.employeeCode)
      .map((u) => [String(u.employeeCode).toUpperCase(), u])
  );

  const mergedUsers = [...users];

  for (const sheetUser of deduplicated) {
    const code = String(sheetUser.employeeCode || '').toUpperCase();

    const existing =
      existingById.get(sheetUser.id) ||
      (code ? existingByCode.get(code) : undefined);

    if (existing) {
      const index = mergedUsers.findIndex((u) => u.id === existing.id);

      if (index >= 0) {
        mergedUsers[index] = {
          ...existing,
          ...sheetUser,

          // Employee_Directory contains masked passwords.
          // Never overwrite a real local password with "*****".
          password:
            sheetUser.password &&
            !String(sheetUser.password).includes('*')
              ? sheetUser.password
              : existing.password,
        };
      }
    } else {
      // New employee found in Sheets â†’ add them.
      mergedUsers.push(sheetUser);
    }
  }

  const finalUsers = deduplicateUsers(mergedUsers);

  setUsers(finalUsers);
  localStorage.setItem(
    'trackpulse_users',
    JSON.stringify(finalUsers)
  );

  // Google Sheets employee import is READ-ONLY.
  // Do NOT publish imported Sheet data back into Firestore.
  // The admin roster is the authoritative user source.

      // Firestore remains the authoritative user-record store.
      // Do not push roster imports into the Central Bridge from a client import.

      // Rebuild and update Presence List
      const updatedPresence = res.employees.map((u) => {
        const existingPres = userPresenceList.find((p) => p.userId === u.id || p.employeeCode === u.employeeCode);
        return existingPres
          ? {
              ...existingPres,
              userName: u.name,
              role: u.role,
              designation: u.designation,
              employeeCode: u.employeeCode,
              department: u.department || 'Operations',
              teamLeaderId: u.teamLeaderId || '',
            }
          : {
              userId: u.id,
              userName: u.name,
              role: u.role,
              designation: u.designation,
              employeeCode: u.employeeCode,
              department: u.department || 'Operations',
              teamLeaderId: u.teamLeaderId || '',
              isOnline: false,
              status: 'offline' as const,
              mouseActivity: 0,
              keyboardActivity: 0,
              lastHeartbeat: new Date().toISOString(),
            };
      });
      setUserPresenceList(updatedPresence);
      localStorage.setItem('trackpulse_presence', JSON.stringify(updatedPresence));
      safeSetDoc(doc(db, 'system_state', 'presence'), { data: updatedPresence }).catch((err) =>
        console.warn('Presence save err:', err)
      );

      // Seed payroll records for any newly imported employees
      const existingPayUserIds = new Set(payrollRecords.map((p) => p.userId));
      const newPayrolls = res.employees
        .filter((u) => !existingPayUserIds.has(u.id))
        .map((u) => ({
          id: `pay-${u.id}-${Date.now()}`,
          userId: u.id,
          userName: u.name,
          employeeCode: u.employeeCode,
          designation: u.designation,
          hourlyRate: u.hourlyRate,
          monthlyRate: u.monthlyRate,
          totalTrackedHours: 0,
          regularHours: 0,
          overtimeHours: 0,
          lateDeductions: 0,
          grossPay: 0,
          netPay: 0,
          payPeriod: 'Aug 01 - Aug 15, 2026',
          status: 'pending' as const,
        }));
      if (newPayrolls.length > 0) {
        const updatedPayroll = [...payrollRecords, ...newPayrolls];
        setPayrollRecords(updatedPayroll);
        localStorage.setItem('trackpulse_payroll', JSON.stringify(updatedPayroll));
        safeSetDoc(doc(db, 'system_state', 'payroll'), { data: updatedPayroll }).catch((err) =>
          console.warn('Payroll save err:', err)
        );
      }

      addAuditLog({
        actorId: currentUser.id,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        category: 'User Management',
        details: `Two-Way Sync: Imported ${res.count} employee profiles directly from Google Spreadsheet Employee_Directory tab.`,
      });

      setSaveToast(`âœ“ Two-Way Sync: Imported ${res.count} employees from Google Sheets!`);
      setTimeout(() => setSaveToast(null), 7000);

      return { success: true, count: res.count, message: res.message };
    } else {
      setSaveToast(`âš ï¸ Google Sheets Import: ${res.message}`);
      setTimeout(() => setSaveToast(null), 7000);
      return { success: false, count: 0, message: res.message };
    }
  };

  // Two-Way Sync: Pull time logs directly from Google Sheets Time_Logs / Active_Logs tab
  const importTimeLogsFromGoogleSheets = async (
    overrideUrl?: string
  ): Promise<{ success: boolean; count: number; message: string }> => {
    const targetUrl =
      overrideUrl ||
      googleSheetsWebhookUrl ||
      localStorage.getItem('trackpulse_sheets_webhook') ||
      DEFAULT_WEBHOOK_URL;
    const res = await fetchTimeLogsFromGoogleSheets(targetUrl, DEFAULT_SPREADSHEET_ID);

    if (res.success && Array.isArray(res.timeLogs) && res.timeLogs.length > 0) {
      setTimeLogs((prev) => {
        const map = new Map<string, TimeLog>();
        prev.forEach((l) => {
          if (l?.id) map.set(l.id, l);
        });

        for (const log of res.timeLogs) {
          if (!log?.id) continue;
          const existing = map.get(log.id);
          const logEmpCode = ((log as any).employeeCode || '').trim();
          const logUserName = (log.userName || '').trim();

          const canonical = resolveCanonicalEmployee(logEmpCode || logUserName || log.userId);
          const matchedUser =
            (logEmpCode ? users.find((u) => u.employeeCode && u.employeeCode.toUpperCase() === logEmpCode.toUpperCase()) : null) ||
            (logUserName ? users.find((u) => u.name && u.name.toLowerCase() === logUserName.toLowerCase()) : null) ||
            (log.userId ? users.find((u) => u.id === log.userId) : null) ||
            canonical;

          const resolvedEmpCode =
            logEmpCode ||
            existing?.employeeCode ||
            matchedUser?.employeeCode ||
            canonical?.code ||
            '';

          const resolvedUserId =
            log.userId ||
            existing?.userId ||
            matchedUser?.id ||
            (resolvedEmpCode ? `usr-${resolvedEmpCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : 'usr-imported');

          const resolvedUserName =
            logUserName ||
            matchedUser?.name ||
            canonical?.name ||
            existing?.userName ||
            'Employee';

          const normDate = normalizeWorkDate(log.date || existing?.date, log.startTime || existing?.startTime);
          const normStartTime = normalizeTimeValue(log.startTime || existing?.startTime, getManilaTimeString());
          const normEndTime = normalizeTimeValue(log.endTime || existing?.endTime, '');

          const statusStr = String(log.status || existing?.status || 'completed').toLowerCase();
          const isRunning =
            statusStr === 'running' ||
            normEndTime === 'Running Live' ||
            String(log.endTime || '').includes('Running');

          const parsedSec = parseDurationSeconds(
            log.durationSeconds,
            (log as any).totalTime || (log as any).durationFormatted,
            normStartTime,
            normEndTime
          );

          let durSec = 0;
          if (isRunning) {
            durSec = Math.max(parsedSec, existing?.durationSeconds || 0);
          } else if (parsedSec > 0) {
            durSec = parsedSec;
          } else if (existing?.durationSeconds) {
            durSec = existing.durationSeconds;
          }

          map.set(log.id, {
            ...(existing || {}),
            ...log,
            id: log.id,
            employeeCode: resolvedEmpCode,
            userId: resolvedUserId,
            userName: resolvedUserName,
            userAvatar: log.userAvatar || existing?.userAvatar || matchedUser?.avatar || '',
            designation: log.designation || existing?.designation || matchedUser?.designation || canonical?.designation || 'Agent',
            task: log.task || existing?.task || 'General Work',
            startTime: normStartTime,
            endTime: isRunning ? 'Running Live' : (normEndTime || '--:--'),
            durationSeconds: durSec,
            status: isRunning ? 'running' : 'completed',
            geoTimezone: log.geoTimezone || existing?.geoTimezone || 'Asia/Manila',
            geoLocalStartTime: normStartTime,
            geoLocalEndTime: isRunning ? 'Running Live' : (normEndTime || '--:--'),
            mouseActivityAvg: log.mouseActivityAvg ?? existing?.mouseActivityAvg ?? 95,
            keyboardActivityAvg: log.keyboardActivityAvg ?? existing?.keyboardActivityAvg ?? 95,
            idleSeconds: log.idleSeconds ?? existing?.idleSeconds ?? 0,
            date: normDate,
            notes: log.notes || existing?.notes || 'Imported from Google Sheets Time_Logs',
            appsUsed: log.appsUsed || existing?.appsUsed || [],
          } as TimeLog);
        }

        const merged = Array.from(map.values());
        try {
          localStorage.setItem('trackpulse_timelogs', JSON.stringify(merged));
        } catch {}
        safeSetDoc(doc(db, 'system_state', 'timelogs'), { data: merged }).catch(() => {});
        return merged;
      });

      return { success: true, count: res.timeLogs.length, message: res.message };
    } else {
      return { success: false, count: 0, message: res.message };
    }
  };

  // Two-Way Sync: Pull Live Presence directly from Google Sheets Live_Presence / Live_Sessions tab
  const importPresenceFromGoogleSheets = async (
    overrideUrl?: string
  ): Promise<{ success: boolean; count: number; message: string }> => {
    const targetUrl = overrideUrl || googleSheetsWebhookUrl || localStorage.getItem('trackpulse_sheets_webhook') || '';
    const res = await fetchLivePresenceFromGoogleSheets(targetUrl, DEFAULT_SPREADSHEET_ID, users);

    if (res.success && res.presenceList.length > 0) {
      setUserPresenceList((prev) => {
        const map = new Map<string, UserPresence>(prev.map((p) => [p.userId, p]));
        for (const p of res.presenceList) {
          if (p && p.userId) {
            const existing = map.get(p.userId);
            const updatedItem = { ...(existing || p), ...p };
            map.set(p.userId, updatedItem);
            safeSetDoc(doc(db, 'user_presence', p.userId), updatedItem, { merge: true }).catch(() => {});
            fetch('/api/presence', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updatedItem),
            }).catch(() => {});
          }
        }
        const merged = Array.from(map.values());
        localStorage.setItem('trackpulse_presence', JSON.stringify(merged));
        safeSetDoc(doc(db, 'system_state', 'presence'), { data: merged }).catch(() => {});
        return merged;
      });

          return {
      success: true,
      count: res.presenceList.length,
      message: res.message,
    };
    } else {
      setSaveToast(`âš ï¸ Google Sheets Presence: ${res.message}`);
      setTimeout(() => setSaveToast(null), 7000);
      return { success: false, count: 0, message: res.message };
    }
  };

  // Live dashboard refresh from Google Sheets
/*useEffect(() => {
  if (!isAuthenticated) return;

  const refreshLivePresence = async () => {
    try {
      await importPresenceFromGoogleSheets();
    } catch (err) {
      console.warn('[LIVE PRESENCE] Dashboard refresh failed:', err);
    }
  };

  refreshLivePresence();

  const interval = setInterval(refreshLivePresence, 15000);

  return () => clearInterval(interval);
}, [isAuthenticated, users]); */

  // Comprehensive One-Click Two-Way Sync for All Tabs from Google Sheets
  const syncAllFromGoogleSheets = async (overrideUrl?: string): Promise<{ success: boolean; message: string }> => {
    const targetUrl = overrideUrl || googleSheetsWebhookUrl || localStorage.getItem('trackpulse_sheets_webhook') || '';
    setSaveToast('â³ Connecting to Google Sheets and pulling latest tables...');
    try {
      const [empRes, timeRes, presRes] = await Promise.all([
        importEmployeesFromGoogleSheets(targetUrl),
        importTimeLogsFromGoogleSheets(targetUrl),
        importPresenceFromGoogleSheets(targetUrl),
      ]);
      const success = empRes.success || timeRes.success || presRes.success;
      const msg = `Synced from Google Sheets: ${empRes.count} employees, ${timeRes.count} time logs, ${presRes.count} presence records.`;
      setSaveToast(success ? `âœ“ ${msg}` : `âš ï¸ Sync Notice: ${empRes.message || timeRes.message || presRes.message}`);
      setTimeout(() => setSaveToast(null), 8000);
      return { success, message: msg };
    } catch (err: any) {
      setSaveToast(`âš ï¸ Google Sheets Sync Failed: ${err?.message || 'Network error'}`);
      setTimeout(() => setSaveToast(null), 7000);
      return { success: false, message: err?.message || 'Sync failed' };
    }
  };

  // Start a live shift for any agent/trainee (updates presence, attendance, running time log, and auto-syncs to Google Sheets)
  const startAgentLiveShift = (userId: string, taskCategory?: TaskCategory) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;
    const now = new Date();
    const nowIso = now.toISOString();
    const taskName = taskCategory || 'Email Reachout';
    const timeStr = getManilaTimeString(now);
    const todayStr = getManilaDateString(now);

    const presenceDoc: UserPresence = {
      userId: targetUser.id,
      userName: targetUser.name,
      employeeCode: targetUser.employeeCode || '',
      role: targetUser.role,
      designation: targetUser.designation || 'Agent',
      department: targetUser.department || 'Operations',
      teamLeaderId: targetUser.teamLeaderId || '',
      isOnline: true,
      status: 'online',
      isTracking: true,
      isPaused: false,
      elapsedSeconds: 0,
      mouseActivity: 92,
      keyboardActivity: 88,
      currentTask: taskName,
      currentApp: 'LLC Time Tracker Desktop App',
      lastHeartbeat: nowIso,
      loginTime: nowIso,
      loginPlatform: 'software',
    };

    // Update presence
    setUserPresenceList((prev) => {
      const map = new Map<string, UserPresence>(prev.map((p) => [p.userId, p]));
      map.set(targetUser.id, presenceDoc);
      const merged = Array.from(map.values());
      localStorage.setItem('trackpulse_presence', JSON.stringify(merged));
      safeSetDoc(doc(db, 'system_state', 'presence'), { data: merged }).catch(() => {});
      return merged;
    });

    safeSetDoc(doc(db, 'user_presence', targetUser.id), presenceDoc, { merge: true }).catch(() => {});
    fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(presenceDoc),
    }).catch(() => {});

    // Update Attendance
    setDailyAttendanceLogs((prev) => {
      const existing = prev.find((a) => a.userId === targetUser.id && a.date === todayStr);
      let updated: DailyAttendanceLog[];
      if (existing) {
        updated = prev.map((a) =>
          a.userId === targetUser.id && a.date === todayStr
            ? { ...a, firstLoginTime: a.firstLoginTime === '--:--' ? timeStr : a.firstLoginTime, status: 'present' as const }
            : a
        );
      } else {
        const newAtt: DailyAttendanceLog = {
          id: `att-${targetUser.id}-${Date.now()}`,
          userId: targetUser.id,
          userName: targetUser.name,
          employeeCode: targetUser.employeeCode || '',
          date: todayStr,
          firstLoginTime: timeStr,
          lastLogoutTime: '',
          totalLoggedSeconds: 0,
          totalLoggedHours: 0,
          totalIdleDeductionsMinutes: 0,
          requiredExtensionMinutes: 0,
          status: 'present',
        };
        updated = [newAtt, ...prev];
      }
      localStorage.setItem('trackpulse_attendance', JSON.stringify(updated));
      safeSetDoc(doc(db, 'system_state', 'attendance'), { data: updated }).catch(() => {});
      return updated;
    });

    // Create active time log
    const newLog: TimeLog = {
      id: `log-${targetUser.id}-${Date.now()}`,
      userId: targetUser.id,
      userName: targetUser.name,
      userAvatar: '',
      designation: targetUser.designation || 'Agent',
      task: taskName,
      startTime: nowIso,
      endTime: '',
      durationSeconds: 0,
      status: 'running',
      geoTimezone: 'Asia/Manila',
      geoLocalStartTime: timeStr,
      geoLocalEndTime: '',
      mouseActivityAvg: 92,
      keyboardActivityAvg: 88,
      idleSeconds: 0,
      date: todayStr,
      notes: 'Desktop Software Live Shift',
      appsUsed: [{ appName: 'LLC Time Tracker Desktop App', icon: 'laptop', durationSeconds: 0, category: 'productive' }],
    };

    setTimeLogs((prev) => {
      const merged = [newLog, ...prev];
      localStorage.setItem('trackpulse_timelogs', JSON.stringify(merged));
      safeSetDoc(doc(db, 'system_state', 'timelogs'), { data: merged }).catch(() => {});
      fetch('/api/timelogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      }).catch(() => {});
      return merged;
    });

    addAuditLog({
      actorId: currentUser?.id || 'sys',
      actorName: currentUser?.name || 'Trainer',
      actorRole: currentUser?.role || 'trainer',
      category: 'Time Tracking',
      targetEmployeeId: targetUser.id,
      targetEmployeeName: targetUser.name,
      details: `Started Desktop Live Tracker session for ${targetUser.name} on task "${taskName}". Synced to Google Sheets & Database.`,
    });

    setSaveToast(`âœ“ Connected ${targetUser.name} to Desktop Tracker (${taskName})! Synced to Google Sheets.`);
    setTimeout(() => setSaveToast(null), 8000);

    triggerAutoSync();
  };

  // Stop a live shift for an agent/trainee
  const stopAgentLiveShift = (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;
    const now = new Date();
    const nowIso = now.toISOString();
    const timeStr = getManilaTimeString(now);
    const todayStr = getManilaDateString(now);

    const offlineDoc = {
      isOnline: false,
      status: 'offline' as const,
      isTracking: false,
      isPaused: false,
      currentTask: 'Shift Concluded',
      lastHeartbeat: nowIso,
    };

    setUserPresenceList((prev) => {
      const updated = prev.map((p) => (p.userId === targetUser.id ? { ...p, ...offlineDoc } : p));
      localStorage.setItem('trackpulse_presence', JSON.stringify(updated));
      safeSetDoc(doc(db, 'system_state', 'presence'), { data: updated }).catch(() => {});
      return updated;
    });

    safeSetDoc(doc(db, 'user_presence', targetUser.id), offlineDoc, { merge: true }).catch(() => {});
    fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: targetUser.id, ...offlineDoc }),
    }).catch(() => {});

    // Finalize running logs
    setTimeLogs((prev) => {
      const updated = prev.map((l) => {
        if (l.userId === targetUser.id && l.status === 'running') {
          const startMs = new Date(l.startTime).getTime();
          const durSec = startMs > 0 ? Math.max(60, Math.floor((Date.now() - startMs) / 1000)) : 300;
          return {
            ...l,
            endTime: nowIso,
            geoLocalEndTime: timeStr,
            durationSeconds: durSec,
            status: 'completed' as const,
          };
        }
        return l;
      });
      localStorage.setItem('trackpulse_timelogs', JSON.stringify(updated));
      safeSetDoc(doc(db, 'system_state', 'timelogs'), { data: updated }).catch(() => {});
      fetch('/api/timelogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch(() => {});
      return updated;
    });

    // Update Attendance
    setDailyAttendanceLogs((prev) => {
      const updated = prev.map((a) =>
        a.userId === targetUser.id && a.date === todayStr ? { ...a, lastLogoutTime: timeStr } : a
      );
      localStorage.setItem('trackpulse_attendance', JSON.stringify(updated));
      safeSetDoc(doc(db, 'system_state', 'attendance'), { data: updated }).catch(() => {});
      return updated;
    });

    addAuditLog({
      actorId: currentUser?.id || 'sys',
      actorName: currentUser?.name || 'Trainer',
      actorRole: currentUser?.role || 'trainer',
      category: 'Time Tracking',
      targetEmployeeId: targetUser.id,
      targetEmployeeName: targetUser.name,
      details: `Concluded Desktop Tracker shift for ${targetUser.name}. Timesheet saved & synced to Google Sheets.`,
    });

    setSaveToast(`âœ“ Concluded shift for ${targetUser.name}. Timesheet saved & synced to Google Sheets!`);
    setTimeout(() => setSaveToast(null), 8000);

    triggerAutoSync();
  };

  // Simulate multiple active trainees tracking in parallel for testing & verification
  const simulateActiveTraineesShift = () => {
    const trainees = users.filter((u) => u.role === 'agent' && u.id !== currentUser?.id).slice(0, 4);
    if (trainees.length === 0) return;
    const sampleTasks: TaskCategory[] = ['Email Reachout', 'Lead Generation', 'Customer Calling', 'Data Entry & Cleanup'];
    trainees.forEach((t, idx) => {
      startAgentLiveShift(t.id, sampleTasks[idx % sampleTasks.length]);
    });
    setSaveToast(`âœ“ Activated live tracking simulation for ${trainees.length} trainees! Synced to Google Sheets.`);
    setTimeout(() => setSaveToast(null), 8000);
  };

  // Flag to avoid overwriting Firestore with initial local defaults before loading
  const [isFirestoreLoaded, setIsFirestoreLoaded] = useState(false);

  // Load and subscribe to real-time Firestore updates
  useEffect(() => {
    if (isQuotaExhaustedGlobal) {
      setIsFirestoreLoaded(true);
      return;
    }

    let unsubTimeLogs = () => {};
    let unsubLiveTimeLogs = () => {};
    let unsubUsers = () => {};
    let unsubAudit = () => {};
    let unsubScreenshots = () => {};
    let unsubPayroll = () => {};
    let unsubAttendance = () => {};
    let unsubPresence = () => {};
    let unsubLeave = () => {};
    let unsubManual = () => {};
    let unsubPasswordReqs = () => {};
    let unsubTasks = () => {};
    let unsubPerms = () => {};
    let unsubConfig = () => {};

    const unsubAll = () => {
      try { unsubTimeLogs(); } catch (e) {}
      try { unsubLiveTimeLogs(); } catch (e) {}
      try { unsubAudit(); } catch (e) {}
      try { unsubScreenshots(); } catch (e) {}
      try { unsubPayroll(); } catch (e) {}
      try { unsubAttendance(); } catch (e) {}
      try { unsubPresence(); } catch (e) {}
      try { unsubLeave(); } catch (e) {}
      try { unsubManual(); } catch (e) {}
      try { unsubPasswordReqs(); } catch (e) {}
      try { unsubTasks(); } catch (e) {}
      try { unsubPerms(); } catch (e) {}
      try { unsubConfig(); } catch (e) {}
    };

    const handleSnapshotError = (name: string, err: any) => {
      setIsFirestoreLoaded(true);
      const isQuota = err?.code === 'resource-exhausted' || 
                      err?.message?.includes('Quota exceeded') || 
                      err?.message?.includes('resource-exhausted');
      if (isQuota) {
        setCloudQuotaExhausted();
        unsubAll();
        return;
      }
      console.warn(`Firestore ${name} listener warning:`, err);
    };

    try {
      unsubConfig = onSnapshot(doc(db, 'system_state', 'config'), (snapshot) => {
        if (snapshot.exists()) {
          const cfgData = snapshot.data();
          const remoteUrl = (cfgData?.webhookUrl || cfgData?.sheetsWebhookUrl || '').trim();
          if (remoteUrl && isValidWebhookUrl(remoteUrl)) {
            setGoogleSheetsWebhookUrlState(remoteUrl);
            localStorage.setItem('trackpulse_sheets_webhook', remoteUrl);
          }
        }
      }, (err) => handleSnapshotError('config', err));

      // Individual timelogs and presence are managed by Central Sync Bridge (/api/timelogs and /api/presence)
      // to guarantee zero Firestore read/write quota consumption across 100+ concurrent agents.
      unsubTimeLogs = onSnapshot(doc(db, 'system_state', 'timelogs'), (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.data !== undefined) {
          const remoteLogs: TimeLog[] = snapshot.data().data;
          if (Array.isArray(remoteLogs)) {
            setTimeLogs((prev) => {
              const map = new Map<string, TimeLog>();
              prev.forEach((l) => map.set(l.id, l));
              remoteLogs.forEach((l) => map.set(l.id, l));
              const merged = Array.from(map.values()).sort((a, b) => {
                const tA = new Date(a.date + ' ' + (a.startTime || '00:00')).getTime();
                const tB = new Date(b.date + ' ' + (b.startTime || '00:00')).getTime();
                return tB - tA;
              });
              localStorage.setItem('trackpulse_timelogs', JSON.stringify(merged));
              return merged;
            });
          }
        }
        setIsFirestoreLoaded(true);
      }, (err) => handleSnapshotError('timelogs', err));


      unsubAudit = onSnapshot(doc(db, 'system_state', 'auditlogs'), (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.data !== undefined) {
          const remoteAudit: AuditLog[] = snapshot.data().data;
          if (Array.isArray(remoteAudit)) {
            setAuditLogs(remoteAudit);
            localStorage.setItem('trackpulse_auditlogs', JSON.stringify(remoteAudit));
          }
        }
      }, (err) => handleSnapshotError('auditlogs', err));

      unsubScreenshots = onSnapshot(doc(db, 'system_state', 'screenshots'), (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.data !== undefined) {
          const remoteScreenshots: ScreenshotLog[] = snapshot.data().data;
          if (Array.isArray(remoteScreenshots)) {
            setScreenshots(remoteScreenshots);
            localStorage.setItem('trackpulse_screenshots', JSON.stringify(remoteScreenshots));
          }
        }
      }, (err) => handleSnapshotError('screenshots', err));

      unsubPayroll = onSnapshot(doc(db, 'system_state', 'payroll'), (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.data !== undefined) {
          const remotePayroll: PayrollRecord[] = snapshot.data().data;
          if (Array.isArray(remotePayroll)) {
            setPayrollRecords(remotePayroll);
            localStorage.setItem('trackpulse_payroll', JSON.stringify(remotePayroll));
          }
        }
      }, (err) => handleSnapshotError('payroll', err));

      unsubAttendance = onSnapshot(doc(db, 'system_state', 'attendance'), (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.data !== undefined) {
          const remoteAtt: DailyAttendanceLog[] = snapshot.data().data;
          if (Array.isArray(remoteAtt)) {
            const cleanAtt = remoteAtt.filter(
              (a: DailyAttendanceLog) =>
                !(a.firstLoginTime === '08:30:00 AM' && (a.totalLoggedSeconds === 0 || !a.lastLogoutTime))
            );
            setDailyAttendanceLogs((prev) => {
              const map = new Map<string, DailyAttendanceLog>();
              prev.forEach((a) => map.set(`${a.userId}_${a.date}`, a));
              cleanAtt.forEach((a) => map.set(`${a.userId}_${a.date}`, a));
              const merged = Array.from(map.values());
              localStorage.setItem('trackpulse_attendance', JSON.stringify(merged));
              return merged;
            });
            if (cleanAtt.length !== remoteAtt.length && !isQuotaExhaustedGlobal) {
              safeSetDoc(doc(db, 'system_state', 'attendance'), { data: cleanAtt }).catch(() => {});
            }
          }
        }
      }, (err) => handleSnapshotError('attendance', err));

      // Real-time live presence is synchronized via Firestore collection user_presence & system_state/presence
            unsubPresence = onSnapshot(
        collection(db, 'user_presence'),
        (snapshot) => {
          if (snapshot.empty) return;

          const remotePresenceList: UserPresence[] = snapshot.docs.map(
            (d) => d.data() as UserPresence
          );

          setUserPresenceList((prev) => {
            const map = new Map<string, UserPresence>(
              prev.map((p) => [p.userId, p])
            );

            remotePresenceList.forEach((remote) => {
              if (!remote?.userId) return;

              const existing = map.get(remote.userId);

              // Always accept a presence record if we don't have one locally yet.
              if (!existing) {
                map.set(remote.userId, remote);
                return;
              }

              const remoteMs = remote.lastHeartbeat
                ? new Date(remote.lastHeartbeat).getTime()
                : 0;

              const existingMs = existing.lastHeartbeat
                ? new Date(existing.lastHeartbeat).getTime()
                : 0;

              // Only allow Firestore to replace local presence when
              // the Firestore heartbeat is newer.
              if (remoteMs >= existingMs) {
                map.set(remote.userId, {
                  ...existing,
                  ...remote,
                });
              }
            });

            const merged = Array.from(map.values());
            localStorage.setItem('trackpulse_presence', JSON.stringify(merged));

            return merged;
          });
        },
        (err) => handleSnapshotError('presence', err)
      );

      unsubLeave = onSnapshot(doc(db, 'system_state', 'leaverequests'), (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.data !== undefined) {
          const remoteLeave: LeaveRequest[] = snapshot.data().data;
          if (Array.isArray(remoteLeave)) {
            setLeaveRequests(remoteLeave);
            localStorage.setItem('trackpulse_leaverequests', JSON.stringify(remoteLeave));
          }
        }
      }, (err) => handleSnapshotError('leaverequests', err));

      unsubManual = onSnapshot(doc(db, 'system_state', 'manualrequests'), (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.data !== undefined) {
          const remoteManual: ManualTimeRequest[] = snapshot.data().data;
          if (Array.isArray(remoteManual)) {
            setManualTimeRequests(remoteManual);
            localStorage.setItem('trackpulse_manualrequests', JSON.stringify(remoteManual));
          }
        }
      }, (err) => handleSnapshotError('manualrequests', err));

      unsubPasswordReqs = onSnapshot(doc(db, 'system_state', 'passwordrequests'), (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.data !== undefined) {
          const remoteReqs: PasswordResetRequest[] = snapshot.data().data;
          if (Array.isArray(remoteReqs)) {
            setPasswordResetRequests(remoteReqs);
            localStorage.setItem('trackpulse_pwd_requests', JSON.stringify(remoteReqs));
          }
        }
      }, (err) => handleSnapshotError('passwordrequests', err));

      unsubTasks = onSnapshot(doc(db, 'system_state', 'designationtasks'), (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.data !== undefined) {
          const remoteTasks = snapshot.data().data;
          if (remoteTasks && typeof remoteTasks === 'object') {
            setDesignationTasks((prev) => ({ ...prev, ...remoteTasks }));
            localStorage.setItem('trackpulse_designation_tasks', JSON.stringify(remoteTasks));
          }
        }
      }, (err) => handleSnapshotError('designationtasks', err));

      unsubPerms = onSnapshot(doc(db, 'system_state', 'rolepermissions'), (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.data !== undefined) {
          const remotePerms = snapshot.data().data;
          if (remotePerms && typeof remotePerms === 'object') {
            setRolePermissions((prev) => ({ ...prev, ...remotePerms }));
            localStorage.setItem('trackpulse_role_permissions', JSON.stringify(remotePerms));
          }
        }
      }, (err) => handleSnapshotError('rolepermissions', err));
    } catch (err) {
      console.warn('Firestore setup error:', err);
      setIsFirestoreLoaded(true);
    }

    return () => {
      unsubTimeLogs();
      unsubAudit();
      unsubScreenshots();
      unsubPayroll();
      unsubAttendance();
      unsubPresence();
      unsubLeave();
      unsubManual();
      unsubPasswordReqs();
      unsubTasks();
      unsubPerms();
      unsubConfig();
    };
  }, []);

  // Central Sync Bridge & Google Sheets Auto-Hydration on Mount
  useEffect(() => {
    let isCancelled = false;

    const initConfigAndHydrate = async () => {
      let activeWebhookUrl =
        googleSheetsWebhookUrl ||
        localStorage.getItem('trackpulse_sheets_webhook') ||
        DEFAULT_WEBHOOK_URL;

      // 1. Fetch shared Webhook URL & sync config from server
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const cfg = await res.json();
          if (cfg?.webhookUrl && typeof cfg.webhookUrl === 'string' && isValidWebhookUrl(cfg.webhookUrl)) {
            activeWebhookUrl = cfg.webhookUrl.trim();
            setGoogleSheetsWebhookUrlState(activeWebhookUrl);
            localStorage.setItem('trackpulse_sheets_webhook', activeWebhookUrl);
          }
        }
      } catch (e) {}

      if (isCancelled) return;

      // Pre-populate server with local users and timelogs if available
      const cleanRoster = deduplicateUsers(users);
      if (cleanRoster.length !== users.length || JSON.stringify(cleanRoster) !== JSON.stringify(users)) {
        setUsers(cleanRoster);
        localStorage.setItem('trackpulse_users', JSON.stringify(cleanRoster));
      }

      // 1.5. Initial Time Logs hydration with confirmed webhook URL
      try {
        await importTimeLogsFromGoogleSheets(activeWebhookUrl);
      } catch (err) {
        console.warn('[Sheets] Initial time log hydration notice:', err);
      }

      if (isCancelled) return;

      // 1.6. Initial Employee Directory hydration
      try {
        const result = await fetchEmployeesFromGoogleSheets(
          activeWebhookUrl,
          DEFAULT_SPREADSHEET_ID,
          users
        );

        if (result.success && Array.isArray(result.employees) && result.employees.length > 0) {
          setUsers((prev) => {
            const existingMap = new Map<string, User>();
            prev.forEach((u) => {
              if (u && u.id) existingMap.set(u.id, u);
              if (u && u.employeeCode) existingMap.set(u.employeeCode.toUpperCase(), u);
            });

            const merged = [...prev];
            for (const emp of result.employees) {
              if (!emp) continue;
              const codeKey = (emp.employeeCode || '').toUpperCase();
              const existing = (emp.id && existingMap.get(emp.id)) || (codeKey && existingMap.get(codeKey));
              if (existing) {
                const idx = merged.findIndex((u) => u.id === existing.id);
                if (idx !== -1) {
                  merged[idx] = {
                    ...existing,
                    ...emp,
                    password: (existing.password && existing.password !== 'Password123!' && !existing.password.includes('*'))
                      ? existing.password
                      : (emp.password || existing.password || 'Password123!'),
                  };
                }
              } else {
                merged.push(emp);
                if (emp.id) existingMap.set(emp.id, emp);
                if (codeKey) existingMap.set(codeKey, emp);
              }
            }
            const deduplicated = deduplicateUsers(merged);
            localStorage.setItem('trackpulse_users', JSON.stringify(deduplicated));
            return deduplicated;
          });
        }
      } catch (err) {
        console.warn('Initial employee hydration error:', err);
      }
    };

    initConfigAndHydrate();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    // 2. Continuous Central Sync Bridge (timelogs, users, presence across desktop & web)
    const fetchCentralSync = () => {
      // 2a. Sync timelogs across desktop software and web portal
      fetch('/api/timelogs')
        .then((res) => (res.ok ? res.json() : null))
        .then((remoteLogs) => {
          if (Array.isArray(remoteLogs) && remoteLogs.length > 0) {
            setTimeLogs((prev) => {
              const map = new Map<string, any>(prev.map((l) => [l.id, l]));
              let hasChanges = false;
              for (const item of remoteLogs) {
                if (!item || !item.id) continue;
                const existing = map.get(item.id);
                if (!existing) {
                  map.set(item.id, item);
                  hasChanges = true;
                  continue;
                }
                const mergedItem = { ...existing, ...item };
                if (JSON.stringify(existing) !== JSON.stringify(mergedItem)) {
                  map.set(item.id, mergedItem);
                  hasChanges = true;
                }
              }
              if (hasChanges) {
                const merged = Array.from(map.values());
                localStorage.setItem('trackpulse_timelogs', JSON.stringify(merged));
                return merged;
              }
              return prev;
            });
          }
        })
        .catch(() => {});

 
      // 2d. Sync Audit Logs across sessions (login/logout/trainee activity logs)
      fetch('/api/auditlogs')
        .then((res) => (res.ok ? res.json() : null))
        .then((remoteAudit: AuditLog[]) => {
          if (Array.isArray(remoteAudit) && remoteAudit.length > 0) {
            setAuditLogs((prev) => {
              const map = new Map<string, AuditLog>(prev.map((a) => [a.id, a]));
              let hasNew = false;
              for (const item of remoteAudit) {
                if (item && item.id && !map.has(item.id)) {
                  map.set(item.id, item);
                  hasNew = true;
                }
              }
              if (hasNew) {
                const merged = Array.from(map.values()).sort(
                  (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );
                localStorage.setItem('trackpulse_auditlogs', JSON.stringify(merged));
                return merged;
              }
              return prev;
            });
          }
        })
        .catch(() => {});

      // 2e. Sync Daily Attendance logs across sessions
      fetch('/api/attendance')
        .then((res) => (res.ok ? res.json() : null))
        .then((remoteAtt: DailyAttendanceLog[]) => {
          if (Array.isArray(remoteAtt) && remoteAtt.length > 0) {
            setDailyAttendanceLogs((prev) => {
              const map = new Map<string, DailyAttendanceLog>(prev.map((a) => [`${a.userId}_${a.date}`, a]));
              let hasNew = false;
              for (const item of remoteAtt) {
                if (item && item.userId && item.date) {
                  const k = `${item.userId}_${item.date}`;
                  if (!map.has(k)) {
                    map.set(k, item);
                    hasNew = true;
                  }
                }
              }
              if (hasNew) {
                const merged = Array.from(map.values());
                localStorage.setItem('trackpulse_attendance', JSON.stringify(merged));
                return merged;
              }
              return prev;
            });
          }
        })
        .catch(() => {});
    };

    fetchCentralSync();
    const centralSyncInterval = setInterval(fetchCentralSync, 60000);

    // Google Sheets Employee_Directory is NOT used as an automatic roster source.
    // The Central Bridge/Admin roster is authoritative. Sheets remains a sync/reporting destination.

    return () => {
      clearInterval(centralSyncInterval);
    };
  }, []);

  // Read-only Central Bridge presence polling so the web portal can see Desktop Tracker live status.
  useEffect(() => {
    if (!isAuthenticated) return;

    const syncRemotePresence = async () => {
      try {
        const res = await fetch('/api/presence', { cache: 'no-store' });
        if (!res.ok) return;
        const payload = await res.json();
        const remotePresence: UserPresence[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.presence)
            ? payload.presence
            : [];
        if (!Array.isArray(remotePresence)) return;

        setUserPresenceList((prev) => {
          const map = new Map<string, UserPresence>(prev.map((p) => [p.userId, p]));
          for (const p of remotePresence) {
            if (!p?.userId) continue;
            const canon = resolveCanonicalEmployee({
              employeeCode: p.employeeCode,
              username: p.userName,
              name: p.userName,
              id: p.userId,
            });
            const sanitizedPresence: UserPresence = {
              ...p,
              userName:
                canon?.name ||
                (p.userName && p.userName !== p.userId ? p.userName : 'Agent'),
              employeeCode: canon?.code || p.employeeCode || '',
            };
            const existing = map.get(p.userId);
            map.set(p.userId, { ...(existing || {}), ...sanitizedPresence });
          }
          return Array.from(map.values());
        });
      } catch {}
    };

    syncRemotePresence();
    const interval = setInterval(syncRemotePresence, 15000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('trackpulse_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('trackpulse_timelogs', JSON.stringify(timeLogs));
  }, [timeLogs]);

  useEffect(() => {
    localStorage.setItem('trackpulse_screenshots', JSON.stringify(screenshots));
  }, [screenshots]);

  useEffect(() => {
    localStorage.setItem('trackpulse_idlelogs', JSON.stringify(idleLogs));
  }, [idleLogs]);

  useEffect(() => {
    localStorage.setItem('trackpulse_leaverequests', JSON.stringify(leaveRequests));
  }, [leaveRequests]);

  useEffect(() => {
    localStorage.setItem('trackpulse_manualrequests', JSON.stringify(manualTimeRequests));
  }, [manualTimeRequests]);

  useEffect(() => {
    localStorage.setItem('trackpulse_payroll', JSON.stringify(payrollRecords));
  }, [payrollRecords]);

  useEffect(() => {
    localStorage.setItem('trackpulse_attendance', JSON.stringify(dailyAttendanceLogs));
  }, [dailyAttendanceLogs]);

  useEffect(() => {
    localStorage.setItem('trackpulse_presence', JSON.stringify(userPresenceList));
  }, [userPresenceList]);

  useEffect(() => {
    localStorage.setItem('trackpulse_worldclocks', JSON.stringify(worldClocks));
  }, [worldClocks]);

  useEffect(() => {
    localStorage.setItem('trackpulse_auditlogs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  const addAuditLog = useCallback(
    (entry: Omit<AuditLog, 'id' | 'timestamp' | 'dateFormatted'>) => {
      const now = new Date();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dateFormatted = `${monthNames[now.getMonth()]} ${now.getDate().toString().padStart(2, '0')}, ${now.getFullYear()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      const newLog: AuditLog = {
        ...entry,
        id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: now.toISOString(),
        dateFormatted,
      };
      setAuditLogs((prev) => {
        const updated = [newLog, ...prev].slice(0, 500);
        localStorage.setItem('trackpulse_auditlogs', JSON.stringify(updated));
        safeSetDoc(doc(db, 'system_state', 'auditlogs'), { data: updated }).catch((err) =>
          console.warn('AuditLogs sync warning:', err)
        );
        fetch('/api/auditlogs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newLog),
        }).catch(() => {});
        return updated;
      });
    },
    []
  );

  // Sync user's GEO timezone into world clock list
  useEffect(() => {
    if (currentUser) {
      setWorldClocks((prev) => {
        const filtered = prev.filter(
          (c) => !c.isAgentGeo && !c.label.includes('HQ') && !c.label.includes('EMEA') && !c.city.includes('London') && c.id !== 'wc-4'
        );
        return [
          {
            id: `wc-agent-${currentUser.id}`,
            label: `Agent GEO (${currentUser.geoCity})`,
            timezone: currentUser.geoTimezone,
            city: currentUser.geoCity,
            countryCode: 'GEO',
            isAgentGeo: true,
          },
          ...filtered,
        ];
      });
    }
  }, [currentUser]);

  // Saved Active Tracking Session (restores shift upon minimize, refresh, or process sleep/wake)
  // ARCHITECTURE RULE: Only an authentic Desktop/Software Tracker runtime may initialize
  // active tracking from persisted localStorage. The normal Web Portal is a viewer/reader
  // and must NEVER inherit or activate an active tracking session from shared localStorage.
  const savedActiveTracking = (() => {
    if (typeof window === 'undefined') return null;
    const search = window.location.search;
    const isDesktopRuntime = Boolean(
      search.includes('mode=desktop') ||
      search.includes('source=software') ||
      search.includes('appMode=desktop') ||
      search.includes('mode=software') ||
      window.navigator.userAgent.includes('Electron') ||
      (window as any).isElectronApp === true ||
      Boolean((window as any).electronAPI)
    );
    if (!isDesktopRuntime) {
      return null;
    }
    try {
      const raw = localStorage.getItem('trackpulse_active_tracking');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  // Active Timer state
  const [isTracking, setIsTracking] = useState<boolean>(() => !!savedActiveTracking?.isTracking);
  const [isPaused, setIsPaused] = useState<boolean>(() => !!savedActiveTracking?.isPaused);
  const [currentDesignation, setCurrentDesignation] = useState<Designation>(() => savedActiveTracking?.designation || currentUser.designation || 'Agent');

  // Automatically sync currentDesignation with active currentUser profile if not actively tracking
  useEffect(() => {
    if (currentUser && !savedActiveTracking?.isTracking) {
      setCurrentDesignation(currentUser.designation || 'Agent');
    }
  }, [currentUser]);
  const [currentTask, setCurrentTask] = useState<TaskCategory>(() => savedActiveTracking?.task || 'Email Reachout');
  const [startTimeIso, setStartTimeIso] = useState<string | null>(() => savedActiveTracking?.startTimeIso || null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => {
    if (!savedActiveTracking || !savedActiveTracking.isTracking) return 0;
    if (savedActiveTracking.isPaused) return savedActiveTracking.accumulatedSec || 0;
    const additional = savedActiveTracking.lastActiveMs > 0 ? Math.floor((Date.now() - savedActiveTracking.lastActiveMs) / 1000) : 0;
    return (savedActiveTracking.accumulatedSec || 0) + Math.max(0, additional);
  });

  // Desktop App Widget vs Web Dashboard Mode
  const [isDesktopDockView, setIsDesktopDockView] = useState(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      if (
        search.includes('mode=desktop') ||
        search.includes('source=software') ||
        search.includes('appMode=desktop') ||
        search.includes('mode=software') ||
        window.navigator.userAgent.includes('Electron') ||
        (window as any).isElectronApp === true ||
        Boolean((window as any).electronAPI)
      ) {
        return true;
      }
    }
    return false;
  });

  // 10-Minute Web Session Inactivity Auto-Logout Engine with 5-Minute Inactivity Warning Trigger
  const WEB_SESSION_TOTAL_TIMEOUT_SECONDS = 600; // 10 minutes total = 600 seconds
  const WEB_SESSION_WARNING_THRESHOLD_SECONDS = 300; // 5 minutes inactivity triggers countdown warning

  const [webSessionRemainingSeconds, setWebSessionRemainingSeconds] = useState<number>(WEB_SESSION_TOTAL_TIMEOUT_SECONDS);
  const [isSessionWarningActive, setIsSessionWarningActive] = useState<boolean>(false);
  const [webSessionWarningCountdown, setWebSessionWarningCountdown] = useState<number>(300); // 300s -> 0s
  const [sessionExpiredReason, setSessionExpiredReason] = useState<string | null>(() => {
    return localStorage.getItem('trackpulse_session_expired_reason');
  });
  const clearSessionExpiredReason = useCallback(() => {
    setSessionExpiredReason(null);
    localStorage.removeItem('trackpulse_session_expired_reason');
  }, []);

  const lastWebActivityTimestampRef = useRef<number>(
    typeof window !== 'undefined' && localStorage.getItem('trackpulse_last_active_timestamp')
      ? parseInt(localStorage.getItem('trackpulse_last_active_timestamp')!, 10) || Date.now()
      : Date.now()
  );

  const refreshWebSession = useCallback(() => {
    const nowMs = Date.now();
    lastWebActivityTimestampRef.current = nowMs;
    lastMouseActiveTimestampRef.current = nowMs;
    lastKeyboardActiveTimestampRef.current = nowMs;
    localStorage.setItem('trackpulse_last_active_timestamp', nowMs.toString());
    setWebSessionRemainingSeconds(WEB_SESSION_TOTAL_TIMEOUT_SECONDS);
    setIsSessionWarningActive(false);
    setWebSessionWarningCountdown(300);
  }, []);

  const login = (user: User, mode: 'webapp' | 'software' = 'webapp') => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    setLoginMode(mode);
    setIsDesktopDockView(mode === 'software');
    localStorage.setItem('trackpulse_auth', 'true');
    localStorage.setItem('trackpulse_login_mode', mode);
    localStorage.setItem('trackpulse_current_user', JSON.stringify(user));
    localStorage.setItem('trackpulse_last_active_timestamp', Date.now().toString());
    localStorage.removeItem('trackpulse_session_expired_reason');
    setSessionExpiredReason(null);
    lastWebActivityTimestampRef.current = Date.now();
    lastMouseActiveTimestampRef.current = Date.now();
    lastKeyboardActiveTimestampRef.current = Date.now();
    setWebSessionRemainingSeconds(WEB_SESSION_TOTAL_TIMEOUT_SECONDS);
    setIsSessionWarningActive(false);
    setWebSessionWarningCountdown(300);

    const now = new Date();
    const nowMs = Date.now();
    const nowIso = now.toISOString();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateFormatted = `${monthNames[now.getMonth()]} ${now.getDate().toString().padStart(2, '0')}, ${now.getFullYear()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    const loginLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: nowIso,
      dateFormatted,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      category: 'Login',
      details: `User signed into LLC Time Tracker ${mode === 'software' ? 'Desktop Software App. Live shift automatically activated.' : 'Web Portal. No live shift tracking started.'}`,
    };
    const updatedAudit = [loginLog, ...auditLogs];
    setAuditLogs(updatedAudit);

 // Auto-activate live shift tracking ONLY for Desktop Software login
const userDesig = user.designation || 'Agent';
const allowedTasks =
  designationTasks[userDesig] ||
  designationTasks['Agent'] ||
  ['Email Reachout', 'Data Entry & Market Research'];

const initialTask = allowedTasks[0] || 'Email Reachout';

if (mode === 'software') {
  setIsTracking(true);
  setIsPaused(false);
  setElapsedSeconds(0);
  setStartTimeIso(nowIso);
  setCurrentTask(initialTask as TaskCategory);
  setCurrentDesignation(userDesig);

  trackingSessionStartMsRef.current = nowMs;
  lastActiveIntervalStartMsRef.current = nowMs;
  trackingAccumulatedSecondsRef.current = 0;
  lastMouseActiveTimestampRef.current = nowMs;
  lastKeyboardActiveTimestampRef.current = nowMs;

  mouseActivityHistoryRef.current = [100];
  keyboardActivityHistoryRef.current = [100];

  setCurrentMouseActivity(100);
  setCurrentKeyboardActivity(100);
  setCurrentInactivitySeconds(0);
  setSessionIdleDeductionSeconds(0);
  setIsIdleAlertActive(false);

  currentTaskSegmentStartMsRef.current = nowMs;
  currentTaskSegmentStartTimeIsoRef.current = nowIso;

  localStorage.setItem(
    'trackpulse_active_tracking',
    JSON.stringify({
      isTracking: true,
      isPaused: false,
      startTimeIso: nowIso,
      startMs: nowMs,
      lastActiveMs: nowMs,
      accumulatedSec: 0,
      task: initialTask,
      designation: userDesig,
      currentTaskSegmentStartMs: nowMs,
      currentTaskSegmentStartTimeIso: nowIso,
    })
  );
} else {
  // Web Portal login must NEVER inherit or start a tracking session.
  setIsTracking(false);
  setIsPaused(false);
  setElapsedSeconds(0);
  setStartTimeIso(null);
  localStorage.removeItem('trackpulse_active_tracking');
}

    // Create daily attendance record
    const today = getManilaDateString(now);
    const checkInTime = getManilaTimeString(now);
    const existingAttendance = dailyAttendanceLogs.find(
      (a) => a.userId === user.id && a.date === today
    );
    let currentAttendanceList = dailyAttendanceLogs;
    if (!existingAttendance) {
      const newAtt: DailyAttendanceLog = {
        id: `att-${user.id}-${today}`,
        userId: user.id,
        userName: user.name,
        employeeCode: user.employeeCode || '',
        date: today,
        firstLoginTime: checkInTime,
        totalLoggedSeconds: 0,
        totalLoggedHours: 0,
        status: 'present',
        syncedToGoogleSheets: true,
      };
      currentAttendanceList = [newAtt, ...dailyAttendanceLogs];
      setDailyAttendanceLogs(currentAttendanceList);
      localStorage.setItem('trackpulse_attendance', JSON.stringify(currentAttendanceList));
      safeSetDoc(doc(db, 'system_state', 'attendance'), { data: currentAttendanceList }).catch(() => {});
    }

    // Active live presence broadcast on login:
    const isDesktop = mode === 'software';
    const existingPresence = userPresenceList.find(
      (p) => p.userId === user.id || (p.employeeCode && user.employeeCode && p.employeeCode === user.employeeCode)
    );
    const hasActiveDesktopSession = existingPresence && existingPresence.isTracking && existingPresence.loginPlatform === 'software';

    if (hasActiveDesktopSession && !isDesktop) {
      console.log('[Login] User already actively tracking on desktop; preserving live tracking presence.');
    } else {
      const loginPresence: UserPresence = {
        userId: user.id,
        userName: user.name,
        employeeCode: user.employeeCode || '',
        role: user.role,
        designation: userDesig,
        department: user.department || 'Operations',
        teamLeaderId: user.teamLeaderId || '',
        isOnline: true,
        status: isDesktop ? 'online' : 'online',
        isTracking: isDesktop,
        isPaused: false,
        elapsedSeconds: isDesktop ? 0 : (existingPresence?.elapsedSeconds || 0),
        mouseActivity: 100,
        keyboardActivity: 100,
        currentTask: isDesktop ? initialTask : (existingPresence?.currentTask || initialTask),
        currentApp: isDesktop ? 'LLC Time Tracker Desktop App' : 'LLC Web Portal',
        lastHeartbeat: nowIso,
        loginTime: existingPresence?.loginTime || nowIso,
        loginPlatform: isDesktop ? 'software' : (existingPresence?.loginPlatform || 'webapp'),
      };
      safeSetDoc(doc(db, 'user_presence', user.id), loginPresence, { merge: true }).catch(() => {});
      fetch('/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginPresence),
      }).catch(() => {});
      setUserPresenceList((prev) => {
        const existing = prev.find((p) => p.userId === user.id);
        const updated = existing
          ? prev.map((p) => (p.userId === user.id ? { ...p, ...loginPresence } : p))
          : [loginPresence, ...prev];
        safeSetDoc(doc(db, 'system_state', 'presence'), { data: updated }).catch(() => {});
        return updated;
      });

      // Transmit instant login heartbeat to Google Sheets only if running in desktop tracking client
      const activeHook = googleSheetsWebhookUrl || localStorage.getItem('trackpulse_sheets_webhook') || DEFAULT_WEBHOOK_URL;
      if (isDesktop && activeHook && isValidWebhookUrl(activeHook)) {
        syncAgentHeartbeatToSheets(activeHook.trim(), {
          userId: user.id,
          employeeCode: user.employeeCode || '',
          userName: user.name,
          role: user.role,
          designation: userDesig,
          platformMode: isDesktop ? 'Desktop Tracker' : 'Website',
          status: 'online',
          statusLabel: isDesktop ? '🟢 Live Tracking' : '🟢 Online',
          isOnline: true,
          isTracking: isDesktop,
          isPaused: false,
          elapsedSeconds: 0,
          currentTask: initialTask,
          currentApp: isDesktop ? 'LLC Time Tracker Desktop App' : 'LLC Web Portal',
          loginPlatform: isDesktop ? 'software' : 'webapp',
          firstCheckin: getManilaTimeString(now),
          timezone: user.geoTimezone || 'Asia/Manila (GMT+8)',
          lastHeartbeat: nowIso,
          mouseActivity: 100,
          keyboardActivity: 100,
        }).catch((err) => console.warn('Instant login heartbeat warning:', err));
      }
    }

    triggerAutoSync(users, timeLogs, updatedAudit, payrollRecords, currentAttendanceList, idleLogs, leaveRequests, undefined, undefined, true);
  };

  const logout = (reason?: string) => {
    if (currentUser) {
      const now = new Date();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dateFormatted = `${monthNames[now.getMonth()]} ${now.getDate().toString().padStart(2, '0')}, ${now.getFullYear()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      const logoutLog: AuditLog = {
        id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: now.toISOString(),
        dateFormatted,
        actorId: currentUser.id,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        category: 'Logout',
        details: reason ? `User signed out of LLC Time Tracker (${reason}).` : `User signed out of LLC Time Tracker.`,
      };
      const updatedAudit = [logoutLog, ...auditLogs];
      setAuditLogs(updatedAudit);

      // Check if user is currently tracking on desktop client
      const existingPres = userPresenceList.find(
        (p) => p.userId === currentUser.id || (p.employeeCode && currentUser.employeeCode && p.employeeCode === currentUser.employeeCode)
      );
      const isDesktopTracking = loginMode !== 'software' && existingPres && existingPres.isTracking && existingPres.loginPlatform === 'software';

      if (!isDesktopTracking) {
        // Instant offline status broadcast
        const offlineDoc = {
          isOnline: false,
          status: 'offline' as const,
          isTracking: false,
          isPaused: false,
          currentTask: 'Shift Concluded',
          lastHeartbeat: new Date().toISOString(),
        };
        safeSetDoc(doc(db, 'user_presence', currentUser.id), offlineDoc, { merge: true }).catch(() => {});
        fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id, ...offlineDoc }),
        }).catch(() => {});
        setUserPresenceList((prev) =>
          prev.map((p) =>
            p.userId === currentUser.id
              ? { ...p, ...offlineDoc }
              : p
          )
        );

        const isDesktopApp =
          loginMode === 'software' ||
          (typeof window !== 'undefined' &&
            Boolean(
              (window as any).electronAPI ||
              navigator.userAgent.includes('Electron') ||
              localStorage.getItem('trackpulse_login_mode') === 'software'
            ));

        // Transmit instant logout heartbeat to Google Sheets only if logging out from the actual desktop tracking client
        const activeHook = googleSheetsWebhookUrl || localStorage.getItem('trackpulse_sheets_webhook') || DEFAULT_WEBHOOK_URL;
        if (isDesktopApp && activeHook && isValidWebhookUrl(activeHook)) {
          syncAgentHeartbeatToSheets(activeHook.trim(), {
            userId: currentUser.id,
            employeeCode: currentUser.employeeCode || '',
            userName: currentUser.name,
            role: currentUser.role,
            designation: currentUser.designation || 'Agent',
            platformMode: 'None / Offline',
            status: 'offline',
            statusLabel: '⚪ Offline',
            isOnline: false,
            isTracking: false,
            isPaused: false,
            elapsedSeconds: 0,
            currentTask: 'Shift Concluded',
            currentApp: 'None / Offline',
            loginPlatform: 'webapp',
            lastHeartbeat: new Date().toISOString(),
          }).catch((err) => console.warn('Instant logout heartbeat warning:', err));
        }

        triggerAutoSync(users, timeLogs, updatedAudit, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests, undefined, undefined, true);
      }
    }
    setIsAuthenticated(false);
    setIsSessionWarningActive(false);
    localStorage.removeItem('trackpulse_auth');
    localStorage.removeItem('trackpulse_current_user');
    localStorage.removeItem('trackpulse_active_tracking');
  };

  // WebApp Inactivity Auto-Logout Effect:
  // - 0 to 5 minutes inactive: Normal working state
  // - 5 to 10 minutes inactive: Triggers countdown warning (5:00 down to 0:00)
  // - At 10 minutes inactive: Automatic logout on webapp (Desktop Software is exempt)
  // - Persistent across tabs, background throttling, and closed browser intervals
  useEffect(() => {
    const isElectron = typeof window !== 'undefined' && (
      (window as any).isElectronApp === true ||
      window.navigator.userAgent.includes('Electron')
    );
    if (!isAuthenticated || isElectron || isTracking) return;

    const performWebInactivityLogout = () => {
      setIsSessionWarningActive(false);
      const now = new Date();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dateFormatted = `${monthNames[now.getMonth()]} ${now.getDate().toString().padStart(2, '0')}, ${now.getFullYear()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

      const timeoutLog: AuditLog = {
        id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: now.toISOString(),
        dateFormatted,
        actorId: currentUser?.id || 'agent',
        actorName: currentUser?.name || 'Agent',
        actorRole: currentUser?.role || 'agent',
        category: 'Logout',
        details: `Session expired: 10-minute web inactivity timeout. ${currentUser?.name || 'Agent'} automatically signed out of LLC Web Portal.`,
      };

      setAuditLogs((prev) => {
        const updated = [timeoutLog, ...prev];
        triggerAutoSync(users, timeLogs, updated, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests);
        return updated;
      });

      // Set offline in database and memory
      if (currentUser) {
        const offlineDoc = {
          isOnline: false,
          status: 'offline' as const,
          isTracking: false,
          isPaused: false,
          currentTask: 'Shift Concluded',
          lastHeartbeat: now.toISOString(),
        };
        safeSetDoc(doc(db, 'user_presence', currentUser.id), offlineDoc, { merge: true }).catch(() => {});
        fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id, ...offlineDoc }),
        }).catch(() => {});
        setUserPresenceList((prev) => prev.map((p) => (p.userId === currentUser.id ? { ...p, ...offlineDoc } : p)));
      }

      localStorage.setItem('trackpulse_session_expired_reason', 'inactivity_10min');
      setSessionExpiredReason('inactivity_10min');
      setIsAuthenticated(false);
      localStorage.removeItem('trackpulse_auth');
    };

    // Check if user was already inactive for 10+ minutes before opening/restoring the site
    const initialSavedStr = localStorage.getItem('trackpulse_last_active_timestamp');
    const initialSavedTime = initialSavedStr ? parseInt(initialSavedStr, 10) : 0;
    if (initialSavedTime > 0 && Date.now() - initialSavedTime >= WEB_SESSION_TOTAL_TIMEOUT_SECONDS * 1000) {
      performWebInactivityLogout();
      return;
    }

    const nowTimestamp = Date.now();
    lastWebActivityTimestampRef.current = initialSavedTime > 0 ? initialSavedTime : nowTimestamp;
    setWebSessionRemainingSeconds(WEB_SESSION_TOTAL_TIMEOUT_SECONDS);
    setIsSessionWarningActive(false);
    setWebSessionWarningCountdown(300);

    const handleWebUserActivity = () => {
      const activeNow = Date.now();
      lastWebActivityTimestampRef.current = activeNow;
      localStorage.setItem('trackpulse_last_active_timestamp', activeNow.toString());
      setIsSessionWarningActive(false);
      setWebSessionWarningCountdown(300);
      setWebSessionRemainingSeconds(WEB_SESSION_TOTAL_TIMEOUT_SECONDS);
    };

    const handleVisibilityOrFocus = () => {
      const savedStr = localStorage.getItem('trackpulse_last_active_timestamp');
      const savedTime = savedStr ? parseInt(savedStr, 10) : 0;
      if (savedTime > 0 && Date.now() - savedTime >= WEB_SESSION_TOTAL_TIMEOUT_SECONDS * 1000) {
        performWebInactivityLogout();
      }
    };

    // Attach interaction listeners to reset the timer on any user action
    window.addEventListener('mousemove', handleWebUserActivity, { passive: true });
    window.addEventListener('mousedown', handleWebUserActivity, { passive: true });
    window.addEventListener('keydown', handleWebUserActivity, { passive: true });
    window.addEventListener('touchstart', handleWebUserActivity, { passive: true });
    window.addEventListener('scroll', handleWebUserActivity, { passive: true });
    window.addEventListener('click', handleWebUserActivity, { passive: true });
    window.addEventListener('wheel', handleWebUserActivity, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    const intervalId = setInterval(() => {
      if (isTracking) {
        lastWebActivityTimestampRef.current = Date.now();
        localStorage.setItem('trackpulse_last_active_timestamp', Date.now().toString());
        setIsSessionWarningActive(false);
        setWebSessionWarningCountdown(300);
        setWebSessionRemainingSeconds(WEB_SESSION_TOTAL_TIMEOUT_SECONDS);
        return;
      }

      const lastActiveTime = lastWebActivityTimestampRef.current || Date.now();
      const elapsedInactiveSeconds = Math.floor((Date.now() - lastActiveTime) / 1000);
      const remainingTotal = Math.max(0, WEB_SESSION_TOTAL_TIMEOUT_SECONDS - elapsedInactiveSeconds);
      setWebSessionRemainingSeconds(remainingTotal);

      // Check if user has reached 5 minutes of inactivity
      if (elapsedInactiveSeconds >= WEB_SESSION_WARNING_THRESHOLD_SECONDS && remainingTotal > 0) {
        setIsSessionWarningActive(true);
        setWebSessionWarningCountdown(remainingTotal);
      } else if (elapsedInactiveSeconds < WEB_SESSION_WARNING_THRESHOLD_SECONDS) {
        setIsSessionWarningActive(false);
        setWebSessionWarningCountdown(300);
      }

      if (remainingTotal <= 0) {
        performWebInactivityLogout();
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('mousemove', handleWebUserActivity);
      window.removeEventListener('mousedown', handleWebUserActivity);
      window.removeEventListener('keydown', handleWebUserActivity);
      window.removeEventListener('touchstart', handleWebUserActivity);
      window.removeEventListener('scroll', handleWebUserActivity);
      window.removeEventListener('click', handleWebUserActivity);
      window.removeEventListener('wheel', handleWebUserActivity);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [isAuthenticated, loginMode, isTracking, currentUser, users, timeLogs, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests, triggerAutoSync]);

  // Live Activity Hardware & Window Focus Detection
  const [currentMouseActivity, setCurrentMouseActivity] = useState(0);
  const [currentKeyboardActivity, setCurrentKeyboardActivity] = useState(0);
  const [currentActiveApp, setCurrentActiveApp] = useState('LLC Time Tracker Desktop Software');
  const currentActiveAppRef = useRef<string>('LLC Time Tracker Desktop Software');
  useEffect(() => {
    currentActiveAppRef.current = currentActiveApp;
  }, [currentActiveApp]);
  const [currentSessionApps, setCurrentSessionApps] = useState<AppUsage[]>([
    { appName: 'LLC Time Tracker Desktop', icon: 'Clock', durationSeconds: 0, category: 'productive' },
    { appName: 'Google Chrome', icon: 'Globe', durationSeconds: 0, category: 'productive' },
    { appName: 'Work Workspace', icon: 'Briefcase', durationSeconds: 0, category: 'productive' },
  ]);

  // Hardware activity timestamp refs
  const lastMouseActiveTimestampRef = useRef<number>(0);
  const lastKeyboardActiveTimestampRef = useRef<number>(0);
  const mouseActivityHistoryRef = useRef<number[]>([]);
  const keyboardActivityHistoryRef = useRef<number[]>([]);

  // Wall-clock tracking refs for exact tracking across background/minimized windows
  const trackingSessionStartMsRef = useRef<number>(savedActiveTracking?.startMs || 0);
  const lastActiveIntervalStartMsRef = useRef<number>(
    savedActiveTracking?.isPaused ? 0 : (savedActiveTracking?.lastActiveMs || (savedActiveTracking?.isTracking ? Date.now() : 0))
  );
  const trackingAccumulatedSecondsRef = useRef<number>(savedActiveTracking?.accumulatedSec || 0);

  // Task segment refs: records separate rows per task in the database and spreadsheet
  const currentTaskSegmentStartMsRef = useRef<number>(
    savedActiveTracking?.currentTaskSegmentStartMs || savedActiveTracking?.startMs || 0
  );
  const currentTaskSegmentStartTimeIsoRef = useRef<string>(
    savedActiveTracking?.currentTaskSegmentStartTimeIso || savedActiveTracking?.startTimeIso || ''
  );

  // Compute live elapsed wall-clock seconds accurately, immune to OS/browser background timer throttling
  const getLiveElapsedSeconds = useCallback(() => {
    if (!isTracking) return 0;
    if (isPaused || lastActiveIntervalStartMsRef.current === 0) {
      return trackingAccumulatedSecondsRef.current;
    }
    const currentSegmentSec = Math.floor((Date.now() - lastActiveIntervalStartMsRef.current) / 1000);
    return trackingAccumulatedSecondsRef.current + Math.max(0, currentSegmentSec);
  }, [isTracking, isPaused]);

  // Storage Engine Mode ('unlimited_bridge' | 'firestore')
  const [storageEngineMode, setStorageEngineModeState] = useState<'unlimited_bridge' | 'firestore'>(() => {
    if (typeof window === 'undefined') return 'firestore';
    const saved = localStorage.getItem('trackpulse_storage_engine');
    return (saved === 'unlimited_bridge' ? 'unlimited_bridge' : 'firestore') as 'unlimited_bridge' | 'firestore';
  });

  const setStorageEngineMode = (mode: 'unlimited_bridge' | 'firestore') => {
    setStorageEngineModeState(mode);
    localStorage.setItem('trackpulse_storage_engine', mode);
    if (mode === 'unlimited_bridge') {
      isQuotaExhaustedGlobal = true;
      setIsCloudQuotaExhausted(true);
      try {
        disableNetwork(db).catch(() => {});
      } catch {}
      setSaveToast('âš¡ Unlimited High-Capacity Server Bridge Active (Zero Quota Limits for 100+ Agents)');
    } else {
      localStorage.removeItem('trackpulse_quota_exhausted_date');
      sessionStorage.removeItem('trackpulse_quota_exhausted');
      isQuotaExhaustedGlobal = false;
      setIsCloudQuotaExhausted(false);
      try {
        enableNetwork(db).catch(() => {});
      } catch {}
      setSaveToast('Cloud Firestore Direct Mode Active');
    }
    setTimeout(() => setSaveToast(null), 3500);
  };

  // Dual Monitor & Multi-Window Mode State (Default ON to prevent false idle popups)
  const [isDualMonitorMode, setIsDualMonitorMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('trackpulse_dual_monitor');
    return stored === null ? true : stored === 'true';
  });

  // Keep live tracking snapshot ref continuously synced for auto-sync operations
  useEffect(() => {
    liveTrackingSnapshotRef.current = {
      isTracking,
      elapsedSeconds: getLiveElapsedSeconds ? getLiveElapsedSeconds() : elapsedSeconds,
      currentTask,
      currentDesignation,
      startTimeIso,
      mouseActivity: currentMouseActivity || 95,
      keyboardActivity: currentKeyboardActivity || 95,
      activeApp: currentActiveApp || 'LLC Time Tracker Desktop App',
    };
  }, [isTracking, elapsedSeconds, currentTask, currentDesignation, startTimeIso, currentMouseActivity, currentKeyboardActivity, currentActiveApp, getLiveElapsedSeconds]);

  const toggleDualMonitorMode = () => {
    setIsDualMonitorMode((prev) => {
      const next = !prev;
      localStorage.setItem('trackpulse_dual_monitor', String(next));
      setSaveToast(next ? 'ðŸ–¥ï¸ Dual Monitor Mode ON: False hardware inactivity prevented' : 'Single Monitor Mode active');
      setTimeout(() => setSaveToast(null), 3500);
      return next;
    });
  };

  // 10-Minute Inactivity Engine with 5-Minute Grace Prompt (15m Total Auto-Logout & Deduction)
  const currentIdleThresholdMinutes = 10;
  const [currentInactivitySeconds, setCurrentInactivitySeconds] = useState<number>(0);
  const [sessionIdleDeductionSeconds, setSessionIdleDeductionSeconds] = useState<number>(0);
  const [isIdleAlertActive, setIsIdleAlertActive] = useState<boolean>(false);
  const isAlertOpenRef = useRef<boolean>(false);
  const alertRemainingRef = useRef<number>(300);
  const [inactivityAlertState, setInactivityAlertState] = useState<{
    isOpen: boolean;
    idleMinutes: number;
    remainingSeconds: number;
  }>({
    isOpen: false,
    idleMinutes: 10,
    remainingSeconds: 300,
  });

  const respondToInactivityAlert = (action: 'stay_active' | 'pause_tracker') => {
    isAlertOpenRef.current = false;
    alertRemainingRef.current = 300;
    if (action === 'stay_active') {
      lastMouseActiveTimestampRef.current = Date.now();
      lastKeyboardActiveTimestampRef.current = Date.now();
      setCurrentInactivitySeconds(0);
      setInactivityAlertState({ isOpen: false, idleMinutes: 10, remainingSeconds: 300 });
      setIsIdleAlertActive(false);
      setSaveToast("âœ“ Confirmed active â€” Timer continuing smoothly with 0 deductions!");
      setTimeout(() => setSaveToast(null), 3500);
    } else {
      pauseTracking();
      setInactivityAlertState({ isOpen: false, idleMinutes: 10, remainingSeconds: 300 });
      setIsIdleAlertActive(false);
      setSaveToast("â¸ï¸ Tracker paused for break/inactivity.");
      setTimeout(() => setSaveToast(null), 3500);
    }
  };

  const dismissIdleAlert = () => {
    respondToInactivityAlert('stay_active');
  };

  // Restore falsely deducted inactivity time (e.g. agent was working on second monitor or in external app)
  const restoreInactivityDeduction = () => {
    const secondsToRestore = sessionIdleDeductionSeconds > 0 ? sessionIdleDeductionSeconds : 600; // default 10m
    const minutesToRestore = Math.round(secondsToRestore / 60);

    // 1. Add back elapsed seconds to current active timer
    setElapsedSeconds((prev) => prev + secondsToRestore);
    trackingAccumulatedSecondsRef.current += secondsToRestore;

    // 2. Remove idle deduction from current session
    setSessionIdleDeductionSeconds(0);
    setIsIdleAlertActive(false);

    // 3. Mark last idle log as cancelled / restored
    const todayStr = getManilaDateString();
    setIdleLogs((prev) =>
      prev.map((log, i) =>
        i === 0 && log.userId === currentUser.id
          ? { ...log, reason: `${log.reason} [RESTORED: Active work verified across monitors]`, status: 'cleared', deductedFromShiftMinutes: 0 }
          : log
      )
    );

    // 4. Restore daily attendance productive hours
    setDailyAttendanceLogs((prev) =>
      prev.map((att) => {
        if (att.userId === currentUser.id && att.date === todayStr) {
          const newSecs = att.totalLoggedSeconds + secondsToRestore;
          const newDeductions = Math.max(0, (att.totalIdleDeductionsMinutes || 0) - minutesToRestore);
          return {
            ...att,
            totalLoggedSeconds: newSecs,
            totalLoggedHours: Number((newSecs / 3600).toFixed(2)),
            totalIdleDeductionsMinutes: newDeductions,
            requiredExtensionMinutes: newDeductions,
          };
        }
        return att;
      })
    );

    // 5. Resume tracking if paused
    if (isPaused) {
      resumeTracking();
    }

    setSaveToast(`âœ“ ${minutesToRestore}m Productive Work Restored! Inactivity deduction cancelled.`);
    setTimeout(() => setSaveToast(null), 4000);
  };

  // Real Hardware Event Listeners (mouse movement, clicks, scrolls, keystrokes, inputs)
  useEffect(() => {
    if (!isTracking || isPaused) return;

    // Immediately mark active upon starting
    if (lastMouseActiveTimestampRef.current === 0) {
      lastMouseActiveTimestampRef.current = Date.now();
      lastKeyboardActiveTimestampRef.current = Date.now();
    }

    const handleMouseActivity = () => {
      lastMouseActiveTimestampRef.current = Date.now();
    };

    const handleKeyboardActivity = () => {
      lastKeyboardActiveTimestampRef.current = Date.now();
      lastMouseActiveTimestampRef.current = Date.now();
    };

    const handleFocus = () => {
      setCurrentActiveApp('LLC Time Tracker Desktop Software');
      currentActiveAppRef.current = 'LLC Time Tracker Desktop Software';
      lastMouseActiveTimestampRef.current = Date.now();
      lastKeyboardActiveTimestampRef.current = Date.now();
      setCurrentInactivitySeconds(0);
      if (isTracking && !isPaused) {
        setElapsedSeconds(getLiveElapsedSeconds());
      }
    };

    const handleBlur = () => {
      setCurrentActiveApp('Google Chrome / External Application');
      currentActiveAppRef.current = 'Google Chrome / External Application';
      // Employee switched to external work window or minimized tracker
      lastMouseActiveTimestampRef.current = Date.now();
      lastKeyboardActiveTimestampRef.current = Date.now();
      setCurrentInactivitySeconds(0);
    };

    const handleVisibilityChange = () => {
      const isHidden = typeof document !== 'undefined' && (document.hidden || document.visibilityState === 'hidden');
      lastMouseActiveTimestampRef.current = Date.now();
      lastKeyboardActiveTimestampRef.current = Date.now();
      setCurrentInactivitySeconds(0);
      if (!isHidden && isTracking && !isPaused) {
        setElapsedSeconds(getLiveElapsedSeconds());
      }
    };

    // Attach capturing listeners to window and document to catch all events regardless of focused element
    window.addEventListener('mousemove', handleMouseActivity, { passive: true, capture: true });
    window.addEventListener('mousedown', handleMouseActivity, { passive: true, capture: true });
    window.addEventListener('mouseup', handleMouseActivity, { passive: true, capture: true });
    window.addEventListener('wheel', handleMouseActivity, { passive: true, capture: true });
    window.addEventListener('pointermove', handleMouseActivity, { passive: true, capture: true });
    window.addEventListener('pointerdown', handleMouseActivity, { passive: true, capture: true });
    window.addEventListener('click', handleMouseActivity, { passive: true, capture: true });

    window.addEventListener('keydown', handleKeyboardActivity, { passive: true, capture: true });
    window.addEventListener('keyup', handleKeyboardActivity, { passive: true, capture: true });
    window.addEventListener('keypress', handleKeyboardActivity, { passive: true, capture: true });
    window.addEventListener('input', handleKeyboardActivity, { passive: true, capture: true });

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('mousemove', handleMouseActivity, true);
      window.removeEventListener('mousedown', handleMouseActivity, true);
      window.removeEventListener('mouseup', handleMouseActivity, true);
      window.removeEventListener('wheel', handleMouseActivity, true);
      window.removeEventListener('pointermove', handleMouseActivity, true);
      window.removeEventListener('pointerdown', handleMouseActivity, true);
      window.removeEventListener('click', handleMouseActivity, true);

      window.removeEventListener('keydown', handleKeyboardActivity, true);
      window.removeEventListener('keyup', handleKeyboardActivity, true);
      window.removeEventListener('keypress', handleKeyboardActivity, true);
      window.removeEventListener('input', handleKeyboardActivity, true);

      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isTracking, isPaused, getLiveElapsedSeconds]);

  // Ref tracking latest state for presence broadcast without triggering re-renders or quota thrashing
  const presenceLatestRef = useRef({
    currentUser,
    isTracking,
    isPaused,
    currentTask,
    currentDesignation,
    elapsedSeconds,
    currentMouseActivity,
    currentKeyboardActivity,
    currentActiveApp,
    loginMode,
  });

  useEffect(() => {
    presenceLatestRef.current = {
      currentUser,
      isTracking,
      isPaused,
      currentTask,
      currentDesignation,
      elapsedSeconds,
      currentMouseActivity,
      currentKeyboardActivity,
      currentActiveApp,
      loginMode,
    };
  }, [
    currentUser,
    isTracking,
    isPaused,
    currentTask,
    currentDesignation,
    elapsedSeconds,
    currentMouseActivity,
    currentKeyboardActivity,
    currentActiveApp,
    loginMode,
  ]);

  const broadcastPresence = useCallback((overrideOffline?: boolean, isHeartbeatOnly: boolean = false) => {
    if (!isAuthenticated) return;
    const snap = presenceLatestRef.current;
    if (!snap.currentUser) return;

    const nowIso = new Date().toISOString();
    if (overrideOffline) {
      const offlineDoc = {
        isOnline: false,
        status: 'offline' as const,
        isTracking: false,
        isPaused: false,
        currentTask: 'Shift Concluded',
        lastHeartbeat: nowIso,
      };
      safeSetDoc(doc(db, 'user_presence', snap.currentUser.id), offlineDoc, { merge: true }).catch(() => {});
      fetch('/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: snap.currentUser.id, ...offlineDoc }),
      }).catch(() => {});
      setUserPresenceList((prev) => {
        const updated = prev.map((p) =>
          p.userId === snap.currentUser.id ? { ...p, ...offlineDoc } : p
        );
        safeSetDoc(doc(db, 'system_state', 'presence'), { data: updated }).catch(() => {});
        return updated;
      });
      return;
    }

    // Check if user already has an active desktop tracking session running
    const existingPres = userPresenceList.find(
      (p) => p.userId === snap.currentUser.id || (p.employeeCode && snap.currentUser.employeeCode && p.employeeCode === snap.currentUser.employeeCode)
    );

    // If web portal is open but this employee is actively tracking on their desktop app, do not overwrite desktop tracking
    if (!snap.isTracking && snap.loginMode !== 'software' && existingPres && existingPres.isTracking && existingPres.loginPlatform === 'software') {
      return;
    }

    const isTracking = Boolean(snap.isTracking);
    const isDesktop = snap.loginMode === 'software' || isTracking;
    const isEffectivelyOnline = true;
    const statusValue = isTracking ? (snap.isPaused ? 'idle' : 'online') : (isDesktop ? 'online' : 'online');
    const taskDisplay = isTracking 
      ? (snap.isPaused ? `Paused (${snap.currentTask})` : snap.currentTask)
      : (isDesktop ? 'Desktop App Standby (Timer Not Started)' : 'Web Portal Active');

    // Preserve original loginTime from previous presence state instead of overwriting on every heartbeat
    const resolvedLoginTime = existingPres?.loginTime || nowIso;

    const presenceDoc: UserPresence = {
      userId: snap.currentUser.id,
      userName: snap.currentUser.name,
      employeeCode: snap.currentUser.employeeCode || '',
      role: snap.currentUser.role,
      designation: snap.currentDesignation || snap.currentUser.designation || 'Agent',
      department: snap.currentUser.department || 'Operations',
      teamLeaderId: snap.currentUser.teamLeaderId || '',
      isOnline: isEffectivelyOnline,
      status: statusValue,
      isTracking: isTracking,
      isPaused: !!snap.isPaused,
      elapsedSeconds: snap.elapsedSeconds || 0,
      mouseActivity: isTracking ? snap.currentMouseActivity : 0,
      keyboardActivity: isTracking ? snap.currentKeyboardActivity : 0,
      currentTask: taskDisplay,
      currentApp: snap.currentActiveApp || (isDesktop ? 'LLC Time Tracker Desktop App' : 'Web Browser'),
      lastHeartbeat: nowIso,
      loginTime: resolvedLoginTime,
      loginPlatform: isDesktop ? 'software' : 'webapp',
    };

    // Always sync presence to Firestore so Trainer and Admins see live status in real-time
    safeSetDoc(doc(db, 'user_presence', snap.currentUser.id), presenceDoc, { merge: true }).catch(() => {});
    fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(presenceDoc),
    }).catch(() => {});
    setUserPresenceList((prev) => {
      const exists = prev.some((p) => p.userId === snap.currentUser.id);
      const updated = exists
        ? prev.map((p) => (p.userId === snap.currentUser.id ? { ...p, ...presenceDoc } : p))
        : [presenceDoc, ...prev];
      safeSetDoc(doc(db, 'system_state', 'presence'), { data: updated }).catch(() => {});
      return updated;
    });
  }, [isAuthenticated]);

  // 15-second periodic presence heartbeat to sync live presence, current task, and elapsed seconds
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;

    // Initial broadcast on login / load
    broadcastPresence();

    // 15-second recurring heartbeat
    const interval = setInterval(() => {
      broadcastPresence(false, false);
    }, 15000);

    // On window unload / close, notify immediately that user went offline
    const handleUnload = () => {
      broadcastPresence(true);
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [isAuthenticated, currentUser?.id, broadcastPresence]);

  // Immediate presence broadcast when major tracking state changes (start, stop, pause, resume, task change)
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    broadcastPresence();
  }, [isAuthenticated, currentUser?.id, isTracking, isPaused, currentTask, broadcastPresence]);

  // Dedicated 60-second individual agent heartbeat loop to Google Sheets (action: 'HEARTBEAT_UPDATE')
  // Transmits targeted individual tracking pulses while user runs the tracker app
  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      return;
    }

    const sendGoogleSheetsAgentHeartbeat = async () => {
      let activeUrl =
        googleSheetsWebhookUrl ||
        localStorage.getItem('trackpulse_sheets_webhook') ||
        DEFAULT_WEBHOOK_URL;

      if (!activeUrl || !isValidWebhookUrl(activeUrl)) {
        activeUrl = DEFAULT_WEBHOOK_URL;
      }

      if (!activeUrl || !isValidWebhookUrl(activeUrl)) {
        console.warn('[SHEETS HEARTBEAT] No valid webhook URL');
        return;
      }

      const snap = liveTrackingSnapshotRef.current;

      const isDesktop =
        loginMode === 'software' ||
        snap.loginMode === 'software' ||
        (typeof window !== 'undefined' &&
          Boolean(
            (window as any).electronAPI ||
            (window as any).isElectronApp === true ||
            navigator.userAgent.includes('Electron') ||
            window.location.search.includes('mode=desktop') ||
            window.location.search.includes('source=software') ||
            window.location.search.includes('appMode=desktop') ||
            window.location.search.includes('mode=software')
          ));

      const isEffTracking = isTracking && !isPaused;

      // ARCHITECTURE RULE: Only an actively running Desktop/Software Tracker runtime may transmit tracking heartbeats.
      // A Web Portal viewer/reader must NEVER transmit tracking heartbeats to Google Sheets.
      if (!isDesktop || !isEffTracking) {
        return;
      }

      console.log('[SHEETS HEARTBEAT] CALLING', currentUser.employeeCode);

      const currentElapsed = Math.max(getLiveElapsedSeconds(), elapsedSeconds, snap.elapsedSeconds || 0);

      const statusLabel = isPaused
        ? '🟡 Idle / Break'
        : '🟢 Live Tracking';

      const startFormatted =
        snap.startTimeIso || startTimeIso
          ? formatLogStartTime(snap.startTimeIso || startTimeIso, 'Asia/Manila')
          : '--:--';

      const taskName = isEffTracking
        ? (currentTask || snap.currentTask || 'Active Work')
        : (isDesktop ? 'Desktop Standby' : 'Website Session');

      syncAgentHeartbeatToSheets(activeUrl, {
        userId: currentUser.id,
        employeeCode: currentUser.employeeCode || '',
        userName: currentUser.name,
        role: currentUser.role,
        designation: currentDesignation || currentUser.designation || 'Agent',
        platformMode: isDesktop ? 'Desktop Tracker' : 'Website',
        status: isPaused ? 'idle' : 'online',
        statusLabel,
        isOnline: true,
        isTracking: isEffTracking,
        isPaused: isPaused,
        elapsedSeconds: currentElapsed,
        currentTask: taskName,
        currentApp: currentActiveAppRef.current || currentActiveApp || (isDesktop ? 'LLC Time Tracker Desktop App' : 'Web Browser'),
        loginPlatform: isDesktop ? 'software' : 'webapp',
        firstCheckin: startFormatted,
        timezone: currentUser.geoTimezone || 'Asia/Manila (GMT+8)',
        lastHeartbeat: new Date().toISOString(),
        mouseActivity: isEffTracking ? (snap.mouseActivity || 95) : 0,
        keyboardActivity: isEffTracking ? (snap.keyboardActivity || 95) : 0,
      }).catch((err) => {
        console.warn('[SHEETS HEARTBEAT] Failed:', err);
      });
    };

    // Initial pulse after 1.5 seconds
    const initialTimer = setTimeout(sendGoogleSheetsAgentHeartbeat, 1500);

    // Recurring heartbeat (every 20s while tracking, 45s when on standby)
    const intervalMs = isTracking && !isPaused ? 20000 : 45000;
    const sheetHbInterval = setInterval(sendGoogleSheetsAgentHeartbeat, intervalMs);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(sheetHbInterval);
    };
  }, [
    isAuthenticated,
    currentUser?.id,
    currentUser?.employeeCode,
    currentUser?.name,
    currentUser?.role,
    currentUser?.designation,
    currentUser?.geoTimezone,
    isTracking,
    isPaused,
    currentTask,
    currentDesignation,
    googleSheetsWebhookUrl,
  ]);

  // Task Switch Confirmation Modal state
  const [taskSwitchPending, setTaskSwitchPending] = useState<TaskSwitchPending | null>(null);

  // Core Idle Handler: Records idle log, deducts from timesheet, requires shift extension, and auto-syncs
  const recordIdleInactivityEvent = (idleMinutes: number, customReason?: string) => {
    const idleSecs = idleMinutes * 60;

    // Deduct from current elapsed session time
    setElapsedSeconds((prev) => Math.max(0, prev - idleSecs));
    setSessionIdleDeductionSeconds((prev) => prev + idleSecs);
    setIsIdleAlertActive(true);

    const now = new Date();
    const timeStr = getManilaTimeString(now);
    const todayStr = getManilaDateString(now);

    // Create Idle Log entry
    const newIdle: IdleLog = {
      id: `idle-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      timestamp: timeStr,
      durationMinutes: idleMinutes,
      task: currentTask,
      reason: customReason || `Random inactivity check triggered (${idleMinutes} min without mouse/keyboard input)`,
      status: 'logged',
      deductedFromShiftMinutes: idleMinutes,
      requiredExtensionMinutes: idleMinutes,
      syncedToGoogleSheets: true,
    };
    const updatedIdleLogs = [newIdle, ...idleLogs];
    setIdleLogs(updatedIdleLogs);

    // Update Daily Attendance Log (subtract productive time, record required shift extension)
    const updatedAttendance = dailyAttendanceLogs.map((att) => {
      if (att.userId === currentUser.id && att.date === todayStr) {
        const prevDeductions = att.totalIdleDeductionsMinutes || 0;
        const newDeductions = prevDeductions + idleMinutes;
        const newLoggedSecs = Math.max(0, att.totalLoggedSeconds - idleSecs);
        return {
          ...att,
          totalIdleDeductionsMinutes: newDeductions,
          requiredExtensionMinutes: newDeductions,
          totalLoggedSeconds: newLoggedSecs,
          totalLoggedHours: Number((newLoggedSecs / 3600).toFixed(2)),
        };
      }
      return att;
    });
    setDailyAttendanceLogs(updatedAttendance);

    // Update user presence
    const updatedPresence = userPresenceList.map((p) =>
      p.userId === currentUser.id
        ? {
            ...p,
            status: 'idle' as const,
            mouseActivity: 0,
            keyboardActivity: 0,
            lastHeartbeat: now.toISOString(),
          }
        : p
    );
    setUserPresenceList(updatedPresence);

    // Audit Log entry
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateFormatted = `${monthNames[now.getMonth()]} ${now.getDate().toString().padStart(2, '0')}, ${now.getFullYear()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    const auditEntry: AuditLog = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: now.toISOString(),
      dateFormatted,
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'Idle Inactivity Detected',
      targetEmployeeId: currentUser.id,
      targetEmployeeName: currentUser.name,
      details: `Idle inactivity tagged (${idleMinutes} mins). Deducted ${idleMinutes} mins from daily timesheet. Shift extended by +${idleMinutes} mins to cover up. Saved to Database & Google Sheets.`,
    };
    const updatedAudit = [auditEntry, ...auditLogs];
    setAuditLogs(updatedAudit);

    setSaveToast(`âš ï¸ Inactivity Alert: ${idleMinutes}m idle tagged & deducted from daily timesheet. Shift extended by ${idleMinutes}m. Synced to Google Sheets!`);
    setTimeout(() => setSaveToast(null), 8000);

    // Auto Sync to Google Sheets
    triggerAutoSync(users, timeLogs, updatedAudit, payrollRecords, updatedAttendance, updatedIdleLogs, leaveRequests);

    // Reset inactivity tracker refs
    lastMouseActiveTimestampRef.current = Date.now();
    lastKeyboardActiveTimestampRef.current = Date.now();
    setCurrentInactivitySeconds(0);
  };

  // Simulate or manually test idle event (e.g. 10m idle with 5m grace prompt)
  const simulateIdleEvent = (minutes?: number) => {
    const idleMins = minutes || 10;
    isAlertOpenRef.current = true;
    alertRemainingRef.current = 300;
    playInactivityChime();
    setIsIdleAlertActive(true);
    setInactivityAlertState({
      isOpen: true,
      idleMinutes: idleMins,
      remainingSeconds: 300,
    });
  };

  // Timer Tick Engine & 2-Minute Activity Window Processing
  useEffect(() => {
    let interval: any = null;
    if (isTracking && !isPaused) {
      interval = setInterval(() => {
        const liveSecs = getLiveElapsedSeconds();
        setElapsedSeconds(liveSecs);

        // Keep active session saved in localStorage every 5 seconds
        if (liveSecs % 5 === 0) {
          localStorage.setItem('trackpulse_active_tracking', JSON.stringify({
            isTracking: true,
            isPaused: false,
            startTimeIso,
            startMs: trackingSessionStartMsRef.current,
            lastActiveMs: lastActiveIntervalStartMsRef.current,
            accumulatedSec: trackingAccumulatedSecondsRef.current,
            task: currentTask,
            designation: currentDesignation || currentUser?.designation || 'Agent',
          }));
        }

        // Auto-sync live progress and active task to Google Sheets every 15 minutes (900 seconds)
        if (liveSecs > 0 && liveSecs % 900 === 0) {
          triggerAutoSync();
        }

        const now = Date.now();
        const ACTIVITY_SUSTAIN_WINDOW_MS = 120000; // 2 minutes (120 seconds)

        const isAppHiddenOrMinimized = typeof document !== 'undefined' && (
          document.hidden || 
          document.visibilityState === 'hidden'
        );

        let mousePercent = 0;
        let keyPercent = 0;

        if (isAppHiddenOrMinimized) {
          // Running in background / minimized while agent works in other desktop applications
          mousePercent = 100;
          keyPercent = 100;
          lastMouseActiveTimestampRef.current = now;
          lastKeyboardActiveTimestampRef.current = now;
        } else {
          const timeSinceMouse = lastMouseActiveTimestampRef.current > 0
            ? now - lastMouseActiveTimestampRef.current
            : 0;
          const timeSinceKey = lastKeyboardActiveTimestampRef.current > 0
            ? now - lastKeyboardActiveTimestampRef.current
            : 0;

          if (timeSinceMouse <= ACTIVITY_SUSTAIN_WINDOW_MS && lastMouseActiveTimestampRef.current > 0) {
            mousePercent = 100;
          } else {
            mousePercent = 0;
          }

          if (timeSinceKey <= ACTIVITY_SUSTAIN_WINDOW_MS && lastKeyboardActiveTimestampRef.current > 0) {
            keyPercent = 100;
          } else {
            keyPercent = 0;
          }
        }

        setCurrentMouseActivity(mousePercent);
        setCurrentKeyboardActivity(keyPercent);

        // Record history for session averaging
        mouseActivityHistoryRef.current.push(mousePercent);
        keyboardActivityHistoryRef.current.push(keyPercent);

        // Update active application duration
        const activeAppNow = currentActiveAppRef.current || currentActiveApp;
        setCurrentSessionApps((prev) =>
          prev.map((app) =>
            activeAppNow.includes(app.appName.split(' ')[0])
              ? { ...app, durationSeconds: app.durationSeconds + 1 }
              : app
          )
        );
      }, 1000);
    } else {
      setCurrentMouseActivity(0);
      setCurrentKeyboardActivity(0);
    }
    return () => clearInterval(interval);
  }, [isTracking, isPaused, getLiveElapsedSeconds]);

  // Real-time Background Inactivity Detector: 10-Minute Inactivity Prompt with 5-Minute Grace (15m Total Auto-Logout & Deduction)
  useEffect(() => {
    let idleInterval: any = null;
    if (isTracking && !isPaused) {
      idleInterval = setInterval(async () => {
        // 1. Check OS-Level hardware idle tracking in Electron Desktop App across all monitors & software
        const electronApi = typeof window !== 'undefined' && (window as any).electronAPI;
        if (electronApi && typeof electronApi.getSystemIdleTime === 'function') {
          try {
            const osIdleSec = await electronApi.getSystemIdleTime();
            if (typeof osIdleSec === 'number' && osIdleSec < 15) {
              // Active mouse or keyboard activity detected on any monitor or application!
              lastMouseActiveTimestampRef.current = Date.now();
              lastKeyboardActiveTimestampRef.current = Date.now();
              setCurrentInactivitySeconds(0);
              if (isAlertOpenRef.current) {
                isAlertOpenRef.current = false;
                setIsIdleAlertActive(false);
                setInactivityAlertState({ isOpen: false, idleMinutes: 10, remainingSeconds: 300 });
              }
              return;
            }
          } catch (e) {}
        }

        // 2. Dual-Monitor & External Window Awareness in Web & Desktop Clients
        const isWindowFocused = typeof document !== 'undefined' && document.hasFocus && document.hasFocus();
        const isAppHiddenOrMinimized = typeof document !== 'undefined' && (
          document.hidden || 
          document.visibilityState === 'hidden' ||
          !isWindowFocused
        );

        // When the desktop tracker is on a secondary monitor, blurred, minimized, or running in the background,
        // the employee is actively working in other apps on their computer (CRM, Excel, Chrome, Zendesk, etc.).
        if (isAppHiddenOrMinimized) {
          lastMouseActiveTimestampRef.current = Date.now();
          lastKeyboardActiveTimestampRef.current = Date.now();
          setCurrentInactivitySeconds(0);
          if (isAlertOpenRef.current) {
            isAlertOpenRef.current = false;
            setIsIdleAlertActive(false);
            setInactivityAlertState({ isOpen: false, idleMinutes: 10, remainingSeconds: 300 });
          }
          return;
        }

        const now = Date.now();
        const lastActive = Math.max(lastMouseActiveTimestampRef.current || 0, lastKeyboardActiveTimestampRef.current || 0);
        const inactivitySec = lastActive > 0 ? Math.floor((now - lastActive) / 1000) : 0;
        setCurrentInactivitySeconds(inactivitySec);

        const IDLE_PROMPT_START_SECONDS = 10 * 60; // 10 minutes = 600s
        const TOTAL_AUTO_LOGOUT_SECONDS = 15 * 60; // 15 minutes = 900s

        // 3. Trigger 5-Minute Inactivity Confirmation Prompt at 10 Minutes
        if (inactivitySec >= IDLE_PROMPT_START_SECONDS) {
          const remainingGraceSeconds = Math.max(0, TOTAL_AUTO_LOGOUT_SECONDS - inactivitySec);
          
          if (!isAlertOpenRef.current) {
            isAlertOpenRef.current = true;
            playInactivityChime();
            setIsIdleAlertActive(true);
          }

          setInactivityAlertState({
            isOpen: true,
            idleMinutes: 10,
            remainingSeconds: remainingGraceSeconds,
          });

          // Play audio warning chimes
          if (remainingGraceSeconds <= 15 && remainingGraceSeconds % 3 === 0) {
            playUrgentPulse();
          } else if (remainingGraceSeconds % 30 === 0) {
            playInactivityChime();
          }

          // 4. 15 Minutes Continuous Inactivity reached -> Auto Logout & Deduct 15 Minutes from Timesheet
          if (remainingGraceSeconds <= 0) {
            isAlertOpenRef.current = false;
            setIsIdleAlertActive(false);
            setInactivityAlertState({ isOpen: false, idleMinutes: 10, remainingSeconds: 300 });

            // Record 15 minutes idle deduction
            recordIdleInactivityEvent(15, "15-minute continuous inactivity: 10m idle + 5m prompt unanswered");
            stopTracking();
            localStorage.setItem('trackpulse_session_expired_reason', 'inactivity_15min_software');
            setSessionExpiredReason('inactivity_15min_software');
            logout('15-minute desktop inactivity: 10m idle + 5m prompt unanswered');
          }
        } else if (isAlertOpenRef.current && inactivitySec < IDLE_PROMPT_START_SECONDS) {
          // Inactivity cleared by user hardware activity
          isAlertOpenRef.current = false;
          setIsIdleAlertActive(false);
          setInactivityAlertState({ isOpen: false, idleMinutes: 10, remainingSeconds: 300 });
        }
      }, 1000);
    } else {
      setCurrentInactivitySeconds(0);
      if (isAlertOpenRef.current) {
        isAlertOpenRef.current = false;
        setIsIdleAlertActive(false);
        setInactivityAlertState({ isOpen: false, idleMinutes: 10, remainingSeconds: 300 });
      }
    }
    return () => clearInterval(idleInterval);
  }, [isTracking, isPaused, currentUser, currentTask, dailyAttendanceLogs, idleLogs, auditLogs, payrollRecords, users, timeLogs, leaveRequests, loginMode]);

  // Periodic Random Screenshot Generator Simulator (Randomized 10â€“15 min intervals)
  useEffect(() => {
    if (isTracking && !isPaused && elapsedSeconds > 0 && elapsedSeconds % 90 === 0) {
      const sampleImages = [
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&q=80&w=600',
      ];
      const randomImg = sampleImages[Math.floor(Math.random() * sampleImages.length)];
      const avgCurrentActivity = Math.round((currentMouseActivity + currentKeyboardActivity) / 2);
      const isTiredOrLowActivity = avgCurrentActivity < 45;
      const now = new Date();
      const dateStr = getManilaDateString(now);
      const timeStr = getManilaTimeString(now);
      const isoStr = now.toISOString();

      const newScreenshot: ScreenshotLog = {
        id: `scr-${Date.now()}`,
        timeLogId: `log-live`,
        userId: currentUser.id,
        userName: currentUser.name,
        employeeCode: currentUser.employeeCode || '',
        userEmail: currentUser.email || '',
        department: currentUser.department || 'Operations',
        designation: currentUser.designation || currentDesignation || 'Virtual Assistant',
        date: dateStr,
        timestamp: timeStr,
        capturedAtIso: isoStr,
        imageUrl: randomImg,
        activityPercent: avgCurrentActivity > 0 ? avgCurrentActivity : 0,
        mouseActivityPercent: currentMouseActivity,
        keyboardActivityPercent: currentKeyboardActivity,
        activeApp: currentActiveApp,
        // If employee was tired / low activity (<45%), keep crystal clear for supervision review.
        // Otherwise, new captures apply standard privacy blur with instant hover/click reveal.
        isBlurred: !isTiredOrLowActivity,
        isNew: true,
        lowActivityAlert: isTiredOrLowActivity,
        resolution: '1920x1080',
        syncedToDatabase: true,
      };
      setScreenshots((prev) => [newScreenshot, ...prev]);
    }
  }, [elapsedSeconds, isTracking, isPaused, currentUser, currentActiveApp, currentMouseActivity, currentKeyboardActivity, currentDesignation]);

  // Start tracking
  const startTracking = () => {
    const nowMs = Date.now();
    trackingSessionStartMsRef.current = nowMs;
    lastActiveIntervalStartMsRef.current = nowMs;
    trackingAccumulatedSecondsRef.current = 0;
    lastMouseActiveTimestampRef.current = nowMs;
    lastKeyboardActiveTimestampRef.current = nowMs;
    mouseActivityHistoryRef.current = [];
    keyboardActivityHistoryRef.current = [];
    setCurrentMouseActivity(100);
    setCurrentKeyboardActivity(100);
    setCurrentInactivitySeconds(0);
    setSessionIdleDeductionSeconds(0);
    setIsIdleAlertActive(false);
    setIsTracking(true);
    setIsPaused(false);
    setElapsedSeconds(0);
    const nowIso = new Date().toISOString();
    setStartTimeIso(nowIso);
    currentTaskSegmentStartMsRef.current = nowMs;
    currentTaskSegmentStartTimeIsoRef.current = nowIso;

    // Save active tracking session to localStorage (immune to minimize, tab throttling, or accidental refresh)
    localStorage.setItem('trackpulse_active_tracking', JSON.stringify({
      isTracking: true,
      isPaused: false,
      startTimeIso: nowIso,
      startMs: nowMs,
      lastActiveMs: nowMs,
      accumulatedSec: 0,
      task: currentTask,
      designation: currentDesignation || currentUser?.designation || 'Agent',
      currentTaskSegmentStartMs: nowMs,
      currentTaskSegmentStartTimeIso: nowIso,
    }));

    // Instant presence broadcast on tracking start
    if (currentUser) {
      const today = getManilaDateString();
      const existingAttendance = dailyAttendanceLogs.find(
        (a) => a.userId === currentUser.id && a.date === today
      );
      if (!existingAttendance) {
        const checkInTime = getManilaTimeString(new Date());
        const newAtt: DailyAttendanceLog = {
          id: `att-${currentUser.id}-${today}`,
          userId: currentUser.id,
          userName: currentUser.name,
          employeeCode: currentUser.employeeCode || '',
          date: today,
          firstLoginTime: checkInTime,
          totalLoggedSeconds: 0,
          totalLoggedHours: 0,
          status: 'present',
          syncedToGoogleSheets: true,
        };
        const updatedAttendance = [newAtt, ...dailyAttendanceLogs];
        setDailyAttendanceLogs(updatedAttendance);
        localStorage.setItem('trackpulse_attendance', JSON.stringify(updatedAttendance));
        safeSetDoc(doc(db, 'system_state', 'attendance'), { data: updatedAttendance }).catch(() => {});
      }

      const startTrackingPresence = {
        userId: currentUser.id,
        userName: currentUser.name,
        employeeCode: currentUser.employeeCode || '',
        role: currentUser.role,
        designation: currentDesignation || currentUser.designation || 'Agent',
        department: currentUser.department || 'Operations',
        teamLeaderId: currentUser.teamLeaderId || '',
        isOnline: true,
        status: 'online' as const,
        isTracking: true,
        isPaused: false,
        elapsedSeconds: 0,
        currentTask: currentTask,
        currentApp: currentActiveApp || (loginMode === 'software' ? 'LLC Time Tracker Desktop App' : 'LLC Web Portal'),
        mouseActivity: 100,
        keyboardActivity: 100,
        lastHeartbeat: nowIso,
        loginTime: nowIso,
      };

      safeSetDoc(doc(db, 'user_presence', currentUser.id), startTrackingPresence, { merge: true }).catch(() => {});
      fetch('/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(startTrackingPresence),
      }).catch(() => {});

      setUserPresenceList((prev) =>
        prev.map((p) =>
          p.userId === currentUser.id
            ? {
                ...p,
                ...startTrackingPresence,
              }
            : p
        )
      );

      // Instantly sync active tracking status to Google Sheets database
      const activeHook = googleSheetsWebhookUrl || localStorage.getItem('trackpulse_sheets_webhook') || DEFAULT_WEBHOOK_URL;
      if (activeHook && isValidWebhookUrl(activeHook)) {
        syncAgentHeartbeatToSheets(activeHook.trim(), {
          userId: currentUser.id,
          employeeCode: currentUser.employeeCode || '',
          userName: currentUser.name,
          role: currentUser.role,
          designation: currentDesignation || currentUser.designation || 'Agent',
          platformMode: 'Desktop Tracker',
          status: 'online',
          statusLabel: '🟢 Live Tracking',
          isOnline: true,
          isTracking: true,
          isPaused: false,
          elapsedSeconds: 0,
          currentTask: currentTask,
          currentApp: currentActiveApp || (loginMode === 'software' ? 'LLC Time Tracker Desktop App' : 'LLC Web Portal'),
          loginPlatform: 'software',
          firstCheckin: getManilaTimeString(new Date()),
          timezone: currentUser.geoTimezone || 'Asia/Manila (GMT+8)',
          lastHeartbeat: nowIso,
          mouseActivity: 100,
          keyboardActivity: 100,
        }).catch((err) => console.warn('Instant start tracking heartbeat warning:', err));
      }

      triggerAutoSync();
    }
  };

  // Pause tracking
  const pauseTracking = () => {
    let accSec = trackingAccumulatedSecondsRef.current;
    if (lastActiveIntervalStartMsRef.current > 0) {
      const segmentSec = Math.floor((Date.now() - lastActiveIntervalStartMsRef.current) / 1000);
      accSec += Math.max(0, segmentSec);
      trackingAccumulatedSecondsRef.current = accSec;
      lastActiveIntervalStartMsRef.current = 0;
    }
    setIsPaused(true);
    localStorage.setItem('trackpulse_active_tracking', JSON.stringify({
      isTracking: true,
      isPaused: true,
      startTimeIso,
      startMs: trackingSessionStartMsRef.current,
      lastActiveMs: 0,
      accumulatedSec: accSec,
      task: currentTask,
      designation: currentDesignation || currentUser?.designation || 'Agent',
    }));
    triggerAutoSync();
  };

  // Resume tracking
  const resumeTracking = () => {
    const nowMs = Date.now();
    lastActiveIntervalStartMsRef.current = nowMs;
    lastMouseActiveTimestampRef.current = nowMs;
    lastKeyboardActiveTimestampRef.current = nowMs;
    setIsPaused(false);
    localStorage.setItem('trackpulse_active_tracking', JSON.stringify({
      isTracking: true,
      isPaused: false,
      startTimeIso,
      startMs: trackingSessionStartMsRef.current,
      lastActiveMs: nowMs,
      accumulatedSec: trackingAccumulatedSecondsRef.current,
      task: currentTask,
      designation: currentDesignation || currentUser?.designation || 'Agent',
    }));
    triggerAutoSync();
  };

  // Stop tracking and create time log
  const stopTracking = () => {
    if (!isTracking) return;

    const trackedSecs = Math.max(getLiveElapsedSeconds(), elapsedSeconds, 1);
    const nowIso = new Date().toISOString();
    const sessionStartDate = new Date(startTimeIso || new Date(Date.now() - trackedSecs * 1000).toISOString());
    const sessionEndDate = new Date(nowIso);
    const userTz = currentUser.geoTimezone || 'Asia/Manila';
    const localEndTimeFormatted = getManilaTimeString(sessionEndDate, userTz);
    const todayStr = getManilaDateString();

    // Calculate duration for the final task segment
    const segmentStartMs =
      currentTaskSegmentStartMsRef.current ||
      trackingSessionStartMsRef.current;
    const calculatedFinalSegmentSec =
      segmentStartMs > 0
        ? Math.floor((Date.now() - segmentStartMs) / 1000)
        : 0;
    const finalSegmentSec =
      calculatedFinalSegmentSec > 0
        ? calculatedFinalSegmentSec
        : trackedSecs;
    const finalStartIso = currentTaskSegmentStartTimeIsoRef.current || startTimeIso || new Date(Date.now() - finalSegmentSec * 1000).toISOString();
    const finalStartDate = new Date(finalStartIso);
    const finalLocalStartTimeFormatted = getManilaTimeString(finalStartDate, userTz);

    const mouseAvg = mouseActivityHistoryRef.current.length > 0
      ? Math.round(mouseActivityHistoryRef.current.reduce((a, b) => a + b, 0) / mouseActivityHistoryRef.current.length)
      : currentMouseActivity;
    const keyAvg = keyboardActivityHistoryRef.current.length > 0
      ? Math.round(keyboardActivityHistoryRef.current.reduce((a, b) => a + b, 0) / keyboardActivityHistoryRef.current.length)
      : currentKeyboardActivity;

    const idleDeductionMins = Math.round(sessionIdleDeductionSeconds / 60);
    const idleNote = sessionIdleDeductionSeconds > 0
      ? ` (Subtracted ${idleDeductionMins}m idle inactivity; shift extended by +${idleDeductionMins}m)`
      : '';

    const newLog: TimeLog = {
      id: `log-${Date.now()}`,
      userId: currentUser.id,
      employeeCode: currentUser.employeeCode || '',
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      designation: currentDesignation,
      task: currentTask,
      startTime: finalStartIso,
      endTime: nowIso,
      durationSeconds: finalSegmentSec,
      status: 'completed',
      geoTimezone: userTz,
      geoLocalStartTime: finalLocalStartTimeFormatted,
      geoLocalEndTime: localEndTimeFormatted,
      mouseActivityAvg: mouseAvg,
      keyboardActivityAvg: keyAvg,
      idleSeconds: sessionIdleDeductionSeconds,
      date: todayStr,
      notes: `Logged via LLC Time Tracker desktop client (${currentDesignation})${idleNote}`,
      appsUsed: [
        { appName: currentActiveApp || 'LLC Desktop App', icon: 'Globe', durationSeconds: finalSegmentSec, category: 'productive' },
      ],
    };

    const sampleImgs = [
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=600',
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=600',
      'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&q=80&w=600',
    ];

    const overallActivity = Math.round((mouseAvg + keyAvg) / 2);
    const isTiredOrLowActivity = overallActivity < 45;
    const newScreenshot: ScreenshotLog = {
      id: `scr-${Date.now()}`,
      timeLogId: newLog.id,
      userId: currentUser.id,
      userName: currentUser.name,
      employeeCode: currentUser.employeeCode || '',
      userEmail: currentUser.email || '',
      department: currentUser.department || 'Operations',
      designation: currentDesignation || currentUser.designation || 'Virtual Assistant',
      date: todayStr,
      timestamp: localEndTimeFormatted,
      capturedAtIso: nowIso,
      imageUrl: sampleImgs[Math.floor(Math.random() * sampleImgs.length)],
      activityPercent: overallActivity,
      mouseActivityPercent: mouseAvg,
      keyboardActivityPercent: keyAvg,
      activeApp: currentActiveApp || 'LLC Time Tracker Desktop Window',
      isBlurred: !isTiredOrLowActivity,
      isNew: true,
      lowActivityAlert: isTiredOrLowActivity,
      resolution: '1920x1080',
      syncedToDatabase: true,
    };

    setTimeLogs((prev) => [newLog, ...prev]);
    setScreenshots((prev) => [newScreenshot, ...prev]);

    const updatedLogs = [newLog, ...timeLogs];
    const updatedScreenshots = [newScreenshot, ...screenshots];
    localStorage.setItem('trackpulse_timelogs', JSON.stringify(updatedLogs));
    localStorage.setItem('trackpulse_screenshots', JSON.stringify(updatedScreenshots));

    // Instantly sync to Central Bridge across desktop & web clients
    fetch('/api/timelogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLog),
    }).catch(() => {});

    // Save individual time log document to Firestore 'timelogs' collection
    safeSetDoc(doc(db, 'timelogs', newLog.id), newLog).catch((err) =>
      console.warn('Timelog collection write warning:', err)
    );

    safeSetDoc(doc(db, 'system_state', 'timelogs'), { data: updatedLogs }).catch((err) =>
      console.warn('TimeLogs sync err:', err)
    );
    safeSetDoc(doc(db, 'system_state', 'screenshots'), { data: updatedScreenshots }).catch((err) =>
      console.warn('Screenshots sync err:', err)
    );

    // Recalculate payroll record for this user
    const updatedPayroll = payrollRecords.map((rec) => {
      if (rec.userId === currentUser.id) {
        const additionalHours = finalSegmentSec / 3600;
        const newTotal = rec.totalTrackedHours + additionalHours;
        const reg = Math.min(newTotal, 80);
        const ot = Math.max(0, newTotal - 80);
        const gross = reg * rec.hourlyRate + ot * rec.hourlyRate * 1.5;
        return {
          ...rec,
          totalTrackedHours: Number(newTotal.toFixed(2)),
          regularHours: Number(reg.toFixed(2)),
          overtimeHours: Number(ot.toFixed(2)),
          grossPay: Number(gross.toFixed(2)),
          netPay: Number((gross * 0.9).toFixed(2)),
        };
      }
      return rec;
    });
    setPayrollRecords(updatedPayroll);
    localStorage.setItem('trackpulse_payroll', JSON.stringify(updatedPayroll));
    safeSetDoc(doc(db, 'system_state', 'payroll'), { data: updatedPayroll }).catch((err) =>
      console.warn('Payroll sync err:', err)
    );

    // Update daily attendance log
    const updatedAttendance = dailyAttendanceLogs.map((att) => {
      if (att.userId === currentUser.id && att.date === todayStr) {
        const newSecs = att.totalLoggedSeconds + finalSegmentSec;
        return {
          ...att,
          totalLoggedSeconds: newSecs,
          totalLoggedHours: Number((newSecs / 3600).toFixed(2)),
          lastLogoutTime: localEndTimeFormatted,
        };
      }
      return att;
    });
    setDailyAttendanceLogs(updatedAttendance);
    localStorage.setItem('trackpulse_attendance', JSON.stringify(updatedAttendance));
    safeSetDoc(doc(db, 'system_state', 'attendance'), { data: updatedAttendance }).catch((err) =>
      console.warn('Attendance sync err:', err)
    );

    // Record audit log entry
    addAuditLog({
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'Clock Out',
      targetEmployeeId: currentUser.id,
      targetEmployeeName: currentUser.name,
      details: `Clocked out session (${formatDuration(trackedSecs)} total; final segment ${formatDuration(finalSegmentSec)} on ${currentTask}). Saved to Timesheets, Database & Google Sheets.`,
    });

    setSaveToast(`âœ“ Saved to Database & Synced to Timesheets! (${currentUser.name} - ${formatDuration(trackedSecs)} on ${currentTask})`);
    setTimeout(() => setSaveToast(null), 7000);

    triggerAutoSync(users, updatedLogs, auditLogs, updatedPayroll, updatedAttendance, idleLogs, leaveRequests);

    // Instant presence broadcast on tracking stop
    if (currentUser) {
      const stopDoc = {
        isOnline: true,
        status: 'online' as const,
        isTracking: false,
        isPaused: false,
        elapsedSeconds: 0,
        currentTask: 'Available / Ready',
        lastHeartbeat: new Date().toISOString(),
      };
      safeSetDoc(doc(db, 'user_presence', currentUser.id), stopDoc, { merge: true }).catch(() => {});
      fetch('/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, ...stopDoc }),
      }).catch(() => {});
      setUserPresenceList((prev) =>
        prev.map((p) =>
          p.userId === currentUser.id
            ? { ...p, ...stopDoc }
            : p
        )
      );
    }

    trackingSessionStartMsRef.current = 0;
    lastActiveIntervalStartMsRef.current = 0;
    trackingAccumulatedSecondsRef.current = 0;
    localStorage.removeItem('trackpulse_active_tracking');
    setIsTracking(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    setStartTimeIso(null);
    setSessionIdleDeductionSeconds(0);
    setCurrentInactivitySeconds(0);

    // Direct targeted Google Sheets heartbeat to clear live tracking tag immediately
    const webhookTarget = googleSheetsWebhookUrl || localStorage.getItem('trackpulse_sheets_webhook') || DEFAULT_WEBHOOK_URL;
    if (webhookTarget && isValidWebhookUrl(webhookTarget)) {
      syncAgentHeartbeatToSheets(webhookTarget, {
        userId: currentUser.id,
        userName: currentUser.name,
        employeeCode: currentUser.employeeCode || '',
        role: currentUser.role,
        designation: currentDesignation || currentUser.designation || 'Agent',
        teamLeaderId: currentUser.teamLeaderId || '',
        isOnline: true,
        status: 'online',
        isTracking: false,
        isPaused: false,
        elapsedSeconds: 0,
        currentTask: 'Available / Ready',
        currentApp: 'LLC Time Tracker Desktop App',
        timezone: currentUser.geoTimezone || 'Asia/Manila (GMT+8)',
        lastHeartbeat: new Date().toISOString(),
        mouseActivity: 0,
        keyboardActivity: 0,
      }).catch(() => {});
    }

    // Sync newly finalized time logs and updated attendance to Google Sheets database with forced immediate push
    triggerAutoSync(
      users,
      updatedLogs,
      auditLogs,
      updatedPayroll,
      updatedAttendance,
      idleLogs,
      leaveRequests,
      designationTasks,
      rolePermissions,
      true
    );
  };

  // 30-Minute Offline Connection Loss & Grace Period Engine
  const TOTAL_OFFLINE_LIMIT_SECONDS = 1800; // 30 minutes total leeway = 1800s
  const STAGE1_WARNING_SECONDS = 300; // 5 minutes = 300s

  const [isOffline, setIsOffline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined') {
      return !navigator.onLine;
    }
    return false;
  });
  const [offlineSinceTimestamp, setOfflineSinceTimestamp] = useState<number | null>(null);
  const [offlineSecondsRemaining, setOfflineSecondsRemaining] = useState<number>(TOTAL_OFFLINE_LIMIT_SECONDS);
  const [offlineStatusStage, setOfflineStatusStage] = useState<'online' | 'warning_5m' | 'critical_countdown' | 'timeout'>('online');

  // Manual Retry / Re-test Connection
  const retryConnection = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      setIsOffline(false);
      setOfflineSinceTimestamp(null);
      setOfflineSecondsRemaining(TOTAL_OFFLINE_LIMIT_SECONDS);
      setOfflineStatusStage('online');
      setSaveToast('âœ“ Internet Connection Restored! Live sync active.');
      triggerAutoSync(users, timeLogs, auditLogs, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests);
      return true;
    }
    try {
      await fetch('/api/health', { method: 'HEAD', cache: 'no-store' });
      setIsOffline(false);
      setOfflineSinceTimestamp(null);
      setOfflineSecondsRemaining(TOTAL_OFFLINE_LIMIT_SECONDS);
      setOfflineStatusStage('online');
      setSaveToast('âœ“ Internet Connection Restored! Live sync active.');
      triggerAutoSync(users, timeLogs, auditLogs, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests);
      return true;
    } catch {
      setIsOffline(true);
      return false;
    }
  }, [users, timeLogs, auditLogs, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests, triggerAutoSync]);

  // Dev simulation tool to test offline flow
  const simulateOfflineToggle = useCallback(() => {
    setIsOffline((prev) => {
      const next = !prev;
      if (next) {
        setOfflineSinceTimestamp(Date.now());
        setOfflineStatusStage('warning_5m');
      } else {
        setOfflineSinceTimestamp(null);
        setOfflineSecondsRemaining(TOTAL_OFFLINE_LIMIT_SECONDS);
        setOfflineStatusStage('online');
        setSaveToast('âœ“ Internet Connection Restored (Simulated)');
      }
      return next;
    });
  }, []);

  // Window network online / offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setOfflineSinceTimestamp(null);
      setOfflineSecondsRemaining(TOTAL_OFFLINE_LIMIT_SECONDS);
      setOfflineStatusStage('online');
      setSaveToast('âœ“ Internet Connection Restored! Live sync active.');
      triggerAutoSync(users, timeLogs, auditLogs, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setOfflineSinceTimestamp((prev) => prev || Date.now());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [users, timeLogs, auditLogs, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests, triggerAutoSync]);

  // Offline Grace Period Ticker (30 minutes total leeway)
  useEffect(() => {
    if (!isAuthenticated || !isTracking) {
      if (!isOffline) {
        setOfflineSinceTimestamp(null);
        setOfflineSecondsRemaining(TOTAL_OFFLINE_LIMIT_SECONDS);
        setOfflineStatusStage('online');
      }
      return;
    }

    const interval = setInterval(() => {
      const currentNetworkOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;
      const effectiveOffline = isOffline || currentNetworkOffline;

      if (effectiveOffline) {
        if (!isOffline) setIsOffline(true);
        const startTs = offlineSinceTimestamp || Date.now();
        if (!offlineSinceTimestamp) {
          setOfflineSinceTimestamp(startTs);
        }

        const elapsedOfflineSec = Math.floor((Date.now() - startTs) / 1000);
        const remaining = Math.max(0, TOTAL_OFFLINE_LIMIT_SECONDS - elapsedOfflineSec);
        setOfflineSecondsRemaining(remaining);

        if (elapsedOfflineSec < STAGE1_WARNING_SECONDS) {
          setOfflineStatusStage('warning_5m');
        } else if (remaining > 0) {
          setOfflineStatusStage('critical_countdown');
        } else {
          // Timeout reached (30 minutes continuous offline)
          setOfflineStatusStage('timeout');
          clearInterval(interval);

          // Finalize tracking safely
          stopTracking();

          // Record audit log
          const now = new Date();
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const dateFormatted = `${monthNames[now.getMonth()]} ${now.getDate().toString().padStart(2, '0')}, ${now.getFullYear()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
          const timeoutAudit: AuditLog = {
            id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp: now.toISOString(),
            dateFormatted,
            actorId: currentUser?.id || 'system',
            actorName: currentUser?.name || 'System',
            actorRole: currentUser?.role || 'agent',
            category: 'Logout',
            details: `Shift automatically stopped and user logged out: Internet connection lost for >30 minutes (${currentUser?.name}). 30 minutes of tracked work preserved locally.`,
          };
          setAuditLogs((prev) => [timeoutAudit, ...prev]);

          localStorage.setItem('trackpulse_session_expired_reason', 'offline_30min');
          setSessionExpiredReason('offline_30min');
          setIsAuthenticated(false);
          localStorage.removeItem('trackpulse_auth');
        }
      } else {
        setOfflineStatusStage('online');
        setOfflineSecondsRemaining(TOTAL_OFFLINE_LIMIT_SECONDS);
        if (offlineSinceTimestamp !== null) {
          setOfflineSinceTimestamp(null);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, isTracking, isOffline, offlineSinceTimestamp, currentUser]);

  // Designation selection
  const selectDesignation = (desig: Designation) => {
    setCurrentDesignation(desig);
  };

  // Task Selection with Confirmation Prompt (Prevents accidental task changes)
  const selectTaskWithPrompt = (task: TaskCategory) => {
    if (task === currentTask) return;

    if (isTracking) {
      // Prompt agent with confirmation modal before switching tasks
      setTaskSwitchPending({ targetTask: task });
    } else {
      setCurrentTask(task);
    }
  };

  // Confirm Task Switch: Records previous task segment as separate row on database sheet,
  // and continues desktop tracker timer seamlessly from current elapsed time onwards!
  const confirmTaskSwitch = () => {
    if (!taskSwitchPending || !isTracking || !currentUser) {
      setTaskSwitchPending(null);
      return;
    }

    const prevTask = currentTask;
    const targetTask = taskSwitchPending.targetTask;
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    // 1. Calculate duration of the completed segment for previous task
    const segmentStartMs = currentTaskSegmentStartMsRef.current || trackingSessionStartMsRef.current || nowMs;
    const segmentDurationSec = Math.max(1, Math.floor((nowMs - segmentStartMs) / 1000));
    const segStartTime = currentTaskSegmentStartTimeIsoRef.current || startTimeIso || new Date(segmentStartMs).toISOString();
    const userTz = currentUser.geoTimezone || 'Asia/Manila';
    const segStartFormatted = formatLogStartTime(segStartTime, userTz);
    const segEndFormatted = formatLogEndTime(nowIso, userTz);
    const todayStr = getManilaDateString();

    const mouseAvg = mouseActivityHistoryRef.current.length > 0
      ? Math.round(mouseActivityHistoryRef.current.reduce((a, b) => a + b, 0) / mouseActivityHistoryRef.current.length)
      : (currentMouseActivity || 100);
    const keyAvg = keyboardActivityHistoryRef.current.length > 0
      ? Math.round(keyboardActivityHistoryRef.current.reduce((a, b) => a + b, 0) / keyboardActivityHistoryRef.current.length)
      : (currentKeyboardActivity || 100);

    // 2. Record previous task as a distinct completed row in Timesheets & Database Spreadsheet
    const newLog: TimeLog = {
      id: `log-${Date.now()}`,
      userId: currentUser.id,
      employeeCode: currentUser.employeeCode || '',
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      designation: currentDesignation || currentUser.designation || 'Agent',
      task: prevTask,
      startTime: segStartTime,
      endTime: nowIso,
      durationSeconds: segmentDurationSec,
      status: 'completed',
      geoTimezone: userTz,
      geoLocalStartTime: segStartFormatted,
      geoLocalEndTime: segEndFormatted,
      mouseActivityAvg: mouseAvg,
      keyboardActivityAvg: keyAvg,
      idleSeconds: 0,
      date: todayStr,
      notes: `Task segment for ${prevTask} (Switched to ${targetTask})`,
      appsUsed: [
        { appName: currentActiveApp || 'LLC Desktop App', icon: 'Globe', durationSeconds: segmentDurationSec, category: 'productive' },
      ],
    };

    const updatedLogs = [newLog, ...timeLogs];
    setTimeLogs(updatedLogs);
    localStorage.setItem('trackpulse_timelogs', JSON.stringify(updatedLogs));

    // Save to Central Bridge & Firestore
    safeSetDoc(doc(db, 'timelogs', newLog.id), newLog).catch(() => {});
    fetch('/api/timelogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLog),
    }).catch(() => {});

    // Update daily attendance log with completed segment
    const updatedAttendance = dailyAttendanceLogs.map((att) => {
      if (att.userId === currentUser.id && att.date === todayStr) {
        const newSecs = att.totalLoggedSeconds + segmentDurationSec;
        return {
          ...att,
          totalLoggedSeconds: newSecs,
          totalLoggedHours: Number((newSecs / 3600).toFixed(2)),
          lastLogoutTime: segEndFormatted,
        };
      }
      return att;
    });
    setDailyAttendanceLogs(updatedAttendance);
    localStorage.setItem('trackpulse_attendance', JSON.stringify(updatedAttendance));
    safeSetDoc(doc(db, 'system_state', 'attendance'), { data: updatedAttendance }).catch(() => {});

    // Recalculate payroll record for completed segment
    const updatedPayroll = payrollRecords.map((rec) => {
      if (rec.userId === currentUser.id) {
        const additionalHours = segmentDurationSec / 3600;
        const newTotal = rec.totalTrackedHours + additionalHours;
        const reg = Math.min(newTotal, 80);
        const ot = Math.max(0, newTotal - 80);
        const gross = reg * rec.hourlyRate + ot * rec.hourlyRate * 1.5;
        return {
          ...rec,
          totalTrackedHours: Number(newTotal.toFixed(2)),
          regularHours: Number(reg.toFixed(2)),
          overtimeHours: Number(ot.toFixed(2)),
          grossPay: Number(gross.toFixed(2)),
          netPay: Number((gross * 0.9).toFixed(2)),
        };
      }
      return rec;
    });
    setPayrollRecords(updatedPayroll);
    localStorage.setItem('trackpulse_payroll', JSON.stringify(updatedPayroll));
    safeSetDoc(doc(db, 'system_state', 'payroll'), { data: updatedPayroll }).catch(() => {});

    // Immediately trigger auto-sync to Google Sheets (populates Time_Logs sheet with new row!)
    triggerAutoSync(users, updatedLogs, auditLogs, updatedPayroll, updatedAttendance, idleLogs, leaveRequests);

    // 3. Switch to target task:
    // IMPORTANT: Overall tracker timer continues smoothly from current elapsed time onwards!
    setCurrentTask(targetTask);
    currentTaskSegmentStartMsRef.current = nowMs;
    currentTaskSegmentStartTimeIsoRef.current = nowIso;
    setTaskSwitchPending(null);

    // Persist active session state
    localStorage.setItem('trackpulse_active_tracking', JSON.stringify({
      isTracking: true,
      isPaused,
      startTimeIso,
      startMs: trackingSessionStartMsRef.current,
      lastActiveMs: lastActiveIntervalStartMsRef.current,
      accumulatedSec: trackingAccumulatedSecondsRef.current,
      task: targetTask,
      designation: currentDesignation || currentUser?.designation || 'Agent',
      currentTaskSegmentStartMs: nowMs,
      currentTaskSegmentStartTimeIso: nowIso,
    }));

    // Broadcast updated task in presence
    const switchPresence = {
      userId: currentUser.id,
      currentTask: targetTask,
      lastHeartbeat: nowIso,
    };
    safeSetDoc(doc(db, 'user_presence', currentUser.id), switchPresence, { merge: true }).catch(() => {});
    fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(switchPresence),
    }).catch(() => {});

    setSaveToast(`âœ“ Switched to "${targetTask}"! Recorded "${prevTask}" (${formatDuration(segmentDurationSec)}) to database & spreadsheet.`);
    setTimeout(() => setSaveToast(null), 5000);
  };

  // Cancel task switch
  const cancelTaskSwitch = () => {
    setTaskSwitchPending(null);
  };

  // CRUD User
  const addUser = (userData: Omit<User, 'id'>) => {
    const assignedUsername = userData.username?.trim().toLowerCase() || generateUniqueUsername(userData.name, users);
    const newUser: User = {
      ...userData,
      username: assignedUsername,
      id: `usr-${Date.now()}`,
    };
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);

    // Also seed a payroll record for new user
    const newPayroll: PayrollRecord = {
      id: `pay-${Date.now()}`,
      userId: newUser.id,
      userName: newUser.name,
      employeeCode: newUser.employeeCode,
      designation: newUser.designation,
      hourlyRate: newUser.hourlyRate,
      totalTrackedHours: 0,
      regularHours: 0,
      overtimeHours: 0,
      lateDeductions: 0,
      grossPay: 0,
      netPay: 0,
      payPeriod: 'Aug 01 - Aug 15, 2026',
      status: 'pending',
    };
    const updatedPayroll = [...payrollRecords, newPayroll];
    setPayrollRecords(updatedPayroll);

    // Seed offline presence for new user
    const newPresence: UserPresence = {
      userId: newUser.id,
      userName: newUser.name,
      role: newUser.role,
      designation: newUser.designation,
      employeeCode: newUser.employeeCode,
      department: newUser.department || 'Operations',
      teamLeaderId: newUser.teamLeaderId,
      isOnline: false,
      status: 'offline',
      isTracking: false,
      isPaused: false,
      elapsedSeconds: 0,
      mouseActivity: 0,
      keyboardActivity: 0,
      currentTask: 'Shift Concluded',
      currentApp: 'None',
      lastHeartbeat: new Date(0).toISOString(),
      loginTime: new Date(0).toISOString(),
    };
    const updatedPresence = [newPresence, ...userPresenceList];
    setUserPresenceList(updatedPresence);

    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateFormatted = `${monthNames[now.getMonth()]} ${now.getDate().toString().padStart(2, '0')}, ${now.getFullYear()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    const auditEntry: AuditLog = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: now.toISOString(),
      dateFormatted,
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'User Management',
      targetEmployeeId: newUser.id,
      targetEmployeeName: newUser.name,
      toValue: `${newUser.role} (${newUser.designation})`,
      details: `Added new employee ${newUser.name} (#${newUser.employeeCode}) as ${newUser.designation} in ${newUser.department || 'Operations'}. Saved to Database & Google Sheets.`,
    };
    const updatedAudit = [auditEntry, ...auditLogs];
    setAuditLogs(updatedAudit);

    localStorage.setItem('trackpulse_users', JSON.stringify(updatedUsers));
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    }).catch(() => {});
    safeSetDoc(doc(db, 'system_state', 'users'), { data: updatedUsers }).catch((err) =>
      console.warn('Users save err:', err)
    );

    // Fast-path immediate sync to Google Sheets Employee_Directory
    const targetHook = googleSheetsWebhookUrl || localStorage.getItem('trackpulse_sheets_webhook');
    if (targetHook && isValidWebhookUrl(targetHook)) {
      syncEmployeesToGoogleSheetsWebhook(targetHook, updatedUsers).catch((err) => {
        console.warn('Direct employee push notice:', err);
      });
    }

    setSaveToast(`âœ“ Saved new employee "${newUser.name}" to Database & Google Sheets!`);
    setTimeout(() => setSaveToast(null), 6000);

    triggerAutoSync(
      updatedUsers,
      timeLogs,
      updatedAudit,
      updatedPayroll,
      dailyAttendanceLogs,
      idleLogs,
      leaveRequests,
      designationTasks,
      rolePermissions,
      true
    );
  };

  const updateUser = (id: string, data: Partial<User>) => {
    const targetUser = users.find((u) => u.id === id);
    const updatedUsers = users.map((u) => (u.id === id ? { ...u, ...data } : u));
    setUsers(updatedUsers);
    localStorage.setItem('trackpulse_users', JSON.stringify(updatedUsers));

    // Instantly sync updated user record to Central Bridge
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedUsers.find((u) => u.id === id)),
    }).catch(() => {});

    // Fast-path immediate sync to Google Sheets Employee_Directory
    const targetHook = googleSheetsWebhookUrl || localStorage.getItem('trackpulse_sheets_webhook');
    if (targetHook && isValidWebhookUrl(targetHook)) {
      syncEmployeesToGoogleSheetsWebhook(targetHook, updatedUsers).catch((err) => {
        console.warn('Direct employee push notice:', err);
      });
    }

    safeSetDoc(doc(db, 'system_state', 'users'), { data: updatedUsers }).catch((err) =>
      console.warn('Users save err:', err)
    );
    if (currentUser.id === id) {
      setCurrentUser((prev) => ({ ...prev, ...data }));
    }

    // Update presence list if name/role/designation changed
    const updatedPresence = userPresenceList.map((p) =>
      p.userId === id
        ? {
            ...p,
            userName: data.name || p.userName,
            role: data.role || p.role,
            designation: data.designation || p.designation,
            department: data.department || p.department,
            teamLeaderId: data.teamLeaderId !== undefined ? data.teamLeaderId : p.teamLeaderId,
          }
        : p
    );
    setUserPresenceList(updatedPresence);

    // Create audit log of what changed
    const changes = Object.keys(data)
      .filter((k) => k !== 'id' && (data as any)[k] !== (targetUser as any)?.[k])
      .map((k) => `${k}: "${(targetUser as any)?.[k]}" â†’ "${(data as any)[k]}"`)
      .join(', ');

    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateFormatted = `${monthNames[now.getMonth()]} ${now.getDate().toString().padStart(2, '0')}, ${now.getFullYear()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    const auditEntry: AuditLog = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: now.toISOString(),
      dateFormatted,
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: data.role ? 'Role Change' : (data.teamLeaderId !== undefined ? 'Supervisor Assignment' : 'User Management'),
      targetEmployeeId: id,
      targetEmployeeName: targetUser?.name || id,
      fromValue: targetUser ? `${targetUser.role} / ${targetUser.designation}` : undefined,
      toValue: data.role || data.designation || undefined,
      details: `Updated employee ${targetUser?.name || id} (#${targetUser?.employeeCode || 'N/A'}): ${changes || 'Profile details modified'}. Saved to Database & Google Sheets.`,
    };
    const updatedAudit = [auditEntry, ...auditLogs];
    setAuditLogs(updatedAudit);

    setSaveToast(`âœ“ Saved edits for "${targetUser?.name || 'Employee'}" to Database & Google Sheets!`);
    setTimeout(() => setSaveToast(null), 6000);

    triggerAutoSync(
      updatedUsers,
      timeLogs,
      updatedAudit,
      payrollRecords,
      dailyAttendanceLogs,
      idleLogs,
      leaveRequests,
      designationTasks,
      rolePermissions,
      true
    );
  };

  const deleteUser = (id: string) => {
    const targetUser = users.find((u) => u.id === id);
    const updatedUsers = users.filter((u) => u.id !== id);
    setUsers(updatedUsers);
    localStorage.setItem('trackpulse_users', JSON.stringify(updatedUsers));
    safeSetDoc(doc(db, 'system_state', 'users'), { data: updatedUsers }).catch((err) =>
      console.warn('Users save err:', err)
    );
    const updatedPresence = userPresenceList.filter((p) => p.userId !== id);
    setUserPresenceList(updatedPresence);

    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateFormatted = `${monthNames[now.getMonth()]} ${now.getDate().toString().padStart(2, '0')}, ${now.getFullYear()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    const auditEntry: AuditLog = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: now.toISOString(),
      dateFormatted,
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'User Management',
      targetEmployeeId: id,
      targetEmployeeName: targetUser?.name || id,
      fromValue: targetUser?.role || 'active',
      toValue: 'Deleted',
      details: `Deleted employee profile ${targetUser?.name || id} (#${targetUser?.employeeCode || 'N/A'}). Saved to Database & Google Sheets.`,
    };
    const updatedAudit = [auditEntry, ...auditLogs];
    setAuditLogs(updatedAudit);

    setSaveToast(`âœ“ Deleted employee "${targetUser?.name || id}" and synchronized Database!`);
    setTimeout(() => setSaveToast(null), 6000);

    triggerAutoSync(
      updatedUsers,
      timeLogs,
      updatedAudit,
      payrollRecords,
      dailyAttendanceLogs,
      idleLogs,
      leaveRequests,
      designationTasks,
      rolePermissions,
      true
    );
  };

  const resetUserPassword = (userId: string, newPass: string, requireChangeOnNextLogin?: boolean) => {
    const targetUser = users.find((u) => u.id === userId);
    const mustChange = requireChangeOnNextLogin !== undefined ? requireChangeOnNextLogin : (newPass === 'Password123!');
    updateUser(userId, { password: newPass, mustChangePassword: mustChange });
    addAuditLog({
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'Password Reset',
      targetEmployeeId: userId,
      targetEmployeeName: targetUser?.name || userId,
      details: `Reset portal password for employee ${targetUser?.name || userId} (#${targetUser?.employeeCode || 'N/A'}) to ${newPass === 'Password123!' ? 'default "Password123!" (Requires password change on next login)' : 'custom password'}. Saved to Database & Google Sheets.`,
    });
  };

  const requestPasswordReset = (targetUserId: string, reason?: string) => {
    const targetUser = users.find((u) => u.id === targetUserId);
    if (!targetUser) return;

    // Check if there is already a pending request for this user
    const existingPending = passwordResetRequests.find((r) => r.targetUserId === targetUserId && r.status === 'pending');
    if (existingPending) {
      setSaveToast(`â“˜ A password reset request for ${targetUser.name} is already pending Super Admin approval.`);
      setTimeout(() => setSaveToast(null), 5000);
      return;
    }

    const newReq: PasswordResetRequest = {
      id: `pwd-req-${Date.now()}`,
      requestedByUserId: currentUser.id,
      requestedByUserName: currentUser.name,
      requestedByUserRole: currentUser.role,
      targetUserId: targetUser.id,
      targetUserName: targetUser.name,
      targetUserCode: targetUser.employeeCode || 'N/A',
      timestamp: new Date().toISOString(),
      dateFormatted: new Date().toLocaleString(),
      reason: reason || 'Forgot password / credential recovery request',
      status: 'pending',
    };

    const updated = [newReq, ...passwordResetRequests];
    setPasswordResetRequests(updated);
    localStorage.setItem('trackpulse_pwd_requests', JSON.stringify(updated));
    safeSetDoc(doc(db, 'system_state', 'passwordrequests'), { data: updated }).catch((err) =>
      console.warn('Password request sync warning:', err)
    );

    addAuditLog({
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'Password Reset Request',
      targetEmployeeId: targetUser.id,
      targetEmployeeName: targetUser.name,
      details: `${currentUser.name} (${currentUser.role}) submitted a Password Reset Request for ${targetUser.name} (#${targetUser.employeeCode}). Waiting for Super Admin (Red) approval.`,
    });

    setSaveToast(`âœ“ Password reset request for ${targetUser.name} submitted! Super Admin (Red) has been notified for approval.`);
    setTimeout(() => setSaveToast(null), 6000);
  };

  const approvePasswordResetRequest = (requestId: string) => {
    const targetReq = passwordResetRequests.find((r) => r.id === requestId);
    if (!targetReq) return;

    // 1. Reset employee's password to default Password123! with forced change on next login
    resetUserPassword(targetReq.targetUserId, 'Password123!', true);

    // 2. Mark request as approved
    const updated = passwordResetRequests.map((r) =>
      r.id === requestId
        ? {
            ...r,
            status: 'approved' as const,
            resolvedAt: new Date().toISOString(),
            resolvedBy: currentUser.name,
          }
        : r
    );

    setPasswordResetRequests(updated);
    localStorage.setItem('trackpulse_pwd_requests', JSON.stringify(updated));
    safeSetDoc(doc(db, 'system_state', 'passwordrequests'), { data: updated }).catch((err) =>
      console.warn('Password request sync warning:', err)
    );

    addAuditLog({
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'Password Reset Approved',
      targetEmployeeId: targetReq.targetUserId,
      targetEmployeeName: targetReq.targetUserName,
      details: `Admin ${currentUser.name} approved password reset request for ${targetReq.targetUserName} (#${targetReq.targetUserCode}). Account reset to default "Password123!" with mandatory first-login password creation.`,
    });

    setSaveToast(`âœ“ Approved password reset for ${targetReq.targetUserName}! Credentials reset to "Password123!".`);
    setTimeout(() => setSaveToast(null), 6000);
  };

  const rejectPasswordResetRequest = (requestId: string, notes?: string) => {
    const targetReq = passwordResetRequests.find((r) => r.id === requestId);
    if (!targetReq) return;

    const updated = passwordResetRequests.map((r) =>
      r.id === requestId
        ? {
            ...r,
            status: 'rejected' as const,
            resolvedAt: new Date().toISOString(),
            resolvedBy: currentUser.name,
            reason: notes ? `${r.reason || ''} [Rejected note: ${notes}]` : r.reason,
          }
        : r
    );

    setPasswordResetRequests(updated);
    localStorage.setItem('trackpulse_pwd_requests', JSON.stringify(updated));
    safeSetDoc(doc(db, 'system_state', 'passwordrequests'), { data: updated }).catch((err) =>
      console.warn('Password request sync warning:', err)
    );

    addAuditLog({
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'Password Reset Rejected',
      targetEmployeeId: targetReq.targetUserId,
      targetEmployeeName: targetReq.targetUserName,
      details: `Admin ${currentUser.name} rejected password reset request for ${targetReq.targetUserName} (#${targetReq.targetUserCode}). ${notes ? `Note: ${notes}` : ''}`,
    });

    setSaveToast(`â“˜ Rejected password reset request for ${targetReq.targetUserName}.`);
    setTimeout(() => setSaveToast(null), 6000);
  };

  // Time logs CRUD
  const addTimeLog = (logData: Omit<TimeLog, 'id'>) => {
    const newLog: TimeLog = { ...logData, id: `log-${Date.now()}` };
    const updatedLogs = [newLog, ...timeLogs];
    setTimeLogs(updatedLogs);
    localStorage.setItem('trackpulse_timelogs', JSON.stringify(updatedLogs));

    // Instantly sync to Central Bridge across desktop & web clients
    fetch('/api/timelogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLog),
    }).catch(() => {});

    // Save individual time log document to Firestore 'timelogs' collection
    safeSetDoc(doc(db, 'timelogs', newLog.id), newLog).catch(() => {});

    safeSetDoc(doc(db, 'system_state', 'timelogs'), { data: updatedLogs }).catch((err) =>
      console.warn('TimeLog add sync error:', err)
    );

    addAuditLog({
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'Time Entry Created',
      targetEmployeeId: newLog.userId,
      targetEmployeeName: newLog.userName,
      details: `Added time entry for ${newLog.userName} (${newLog.task}, ${formatDuration(newLog.durationSeconds)}). Saved to Database & Google Sheets.`,
    });

    setSaveToast(`âœ“ Saved time log to Database & Google Sheets!`);
    setTimeout(() => setSaveToast(null), 6000);

    triggerAutoSync(users, updatedLogs, auditLogs, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests, designationTasks, rolePermissions, true);
  };

  const updateTimeLog = (id: string, data: Partial<TimeLog>) => {
    const targetLog = timeLogs.find((l) => l.id === id);
    const updatedLogs = timeLogs.map((l) => (l.id === id ? { ...l, ...data } : l));
    setTimeLogs(updatedLogs);
    localStorage.setItem('trackpulse_timelogs', JSON.stringify(updatedLogs));
    safeSetDoc(doc(db, 'system_state', 'timelogs'), { data: updatedLogs }).catch((err) =>
      console.warn('TimeLog update sync error:', err)
    );

    addAuditLog({
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'Time Entry Edit',
      targetEmployeeId: targetLog?.userId,
      targetEmployeeName: targetLog?.userName,
      details: `Updated time log (${targetLog?.task || id}): ${data.task ? `Task changed to ${data.task}` : 'Notes/Duration modified'}. Saved to Database & Google Sheets.`,
    });

    setSaveToast(`✓ Saved time log edits to Database & Google Sheets!`);
    setTimeout(() => setSaveToast(null), 6000);

    triggerAutoSync(users, updatedLogs, auditLogs, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests, designationTasks, rolePermissions, true);
  };

  const deleteTimeLog = (id: string) => {
    const targetLog = timeLogs.find((l) => l.id === id);
    const updatedLogs = timeLogs.filter((l) => l.id !== id);
    setTimeLogs(updatedLogs);
    localStorage.setItem('trackpulse_timelogs', JSON.stringify(updatedLogs));
    safeDeleteDoc(doc(db, 'timelogs', id)).catch(() => {});
    safeSetDoc(doc(db, 'system_state', 'timelogs'), { data: updatedLogs }).catch((err) =>
      console.warn('TimeLog delete sync error:', err)
    );

    addAuditLog({
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'Time Entry Deleted',
      targetEmployeeId: targetLog?.userId,
      targetEmployeeName: targetLog?.userName,
      details: `Deleted time log entry for ${targetLog?.userName || id} (${targetLog?.task || 'Task'}). Saved to Database & Google Sheets.`,
    });

    setSaveToast(`âœ“ Removed time log and synchronized Database!`);
    setTimeout(() => setSaveToast(null), 6000);

    triggerAutoSync(users, updatedLogs, auditLogs, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests);
  };

  // Manual time requests
  const approveManualTimeRequest = (id: string) => {
    const req = manualTimeRequests.find((r) => r.id === id);
    if (!req) return;

    const updatedRequests = manualTimeRequests.map((r) => (r.id === id ? { ...r, status: 'approved' as const } : r));
    setManualTimeRequests(updatedRequests);
    localStorage.setItem('trackpulse_manualrequests', JSON.stringify(updatedRequests));
    safeSetDoc(doc(db, 'system_state', 'manualrequests'), { data: updatedRequests }).catch((err) =>
      console.warn('Manual time approve sync error:', err)
    );

    // Convert to actual time log
    const targetUser = users.find((u) => u.id === req.userId) || currentUser;
    const newLog: TimeLog = {
      id: `log-manual-${Date.now()}`,
      userId: req.userId,
      userName: req.userName,
      userAvatar: targetUser.avatar,
      designation: targetUser.designation,
      task: req.task,
      startTime: `${req.date}T${req.startTime}:00.000Z`,
      endTime: `${req.date}T${req.endTime}:00.000Z`,
      durationSeconds: 5400, // 1.5 hrs
      status: 'completed',
      geoTimezone: targetUser.geoTimezone,
      geoLocalStartTime: req.startTime,
      mouseActivityAvg: 85,
      keyboardActivityAvg: 88,
      idleSeconds: 0,
      date: req.date,
      notes: `Manual Time Approved: ${req.reason}`,
      appsUsed: [{ appName: 'Manual Entry', icon: 'Edit', durationSeconds: 5400, category: 'productive' }],
    };
    const updatedLogs = [newLog, ...timeLogs];
    setTimeLogs(updatedLogs);
    localStorage.setItem('trackpulse_timelogs', JSON.stringify(updatedLogs));
    safeSetDoc(doc(db, 'system_state', 'timelogs'), { data: updatedLogs }).catch((err) =>
      console.warn('Manual time to timelog sync error:', err)
    );

    addAuditLog({
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'Manual Time Approval',
      targetEmployeeId: req.userId,
      targetEmployeeName: req.userName,
      details: `Approved manual time request for ${req.userName} on ${req.date} (${req.task}, ${req.startTime}-${req.endTime}). Saved to Database & Google Sheets.`,
    });

    setSaveToast(`âœ“ Approved manual time request and added to Database & Google Sheets!`);
    setTimeout(() => setSaveToast(null), 6000);

    triggerAutoSync(users, updatedLogs, auditLogs, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests);
  };

  const rejectManualTimeRequest = (id: string) => {
    const req = manualTimeRequests.find((r) => r.id === id);
    const updatedRequests = manualTimeRequests.map((r) => (r.id === id ? { ...r, status: 'rejected' as const } : r));
    setManualTimeRequests(updatedRequests);
    localStorage.setItem('trackpulse_manualrequests', JSON.stringify(updatedRequests));
    safeSetDoc(doc(db, 'system_state', 'manualrequests'), { data: updatedRequests }).catch((err) =>
      console.warn('Manual time reject sync error:', err)
    );

    if (req) {
      addAuditLog({
        actorId: currentUser.id,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        category: 'Manual Time Rejected',
        targetEmployeeId: req.userId,
        targetEmployeeName: req.userName,
        details: `Rejected manual time request for ${req.userName} on ${req.date} (${req.task}). Saved to Database & Google Sheets.`,
      });
    }

    setSaveToast(`âœ“ Rejected manual time request and synchronized Database!`);
    setTimeout(() => setSaveToast(null), 6000);
  };

  const submitManualTimeRequest = (reqData: Omit<ManualTimeRequest, 'id' | 'status'>) => {
    const newReq: ManualTimeRequest = {
      ...reqData,
      id: `mtr-${Date.now()}`,
      status: 'pending',
    };
    const updated = [newReq, ...manualTimeRequests];
    setManualTimeRequests(updated);
    localStorage.setItem('trackpulse_manualrequests', JSON.stringify(updated));
    safeSetDoc(doc(db, 'system_state', 'manualrequests'), { data: updated }).catch((err) =>
      console.warn('Manual time submit sync error:', err)
    );

    addAuditLog({
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'Manual Time Submission',
      targetEmployeeId: reqData.userId,
      targetEmployeeName: reqData.userName,
      details: `Submitted manual time request for ${reqData.date} (${reqData.task}, ${reqData.startTime}-${reqData.endTime}): ${reqData.reason}. Saved to Database & Google Sheets.`,
    });

    setSaveToast(`âœ“ Submitted manual time request to Database & Supervisors!`);
    setTimeout(() => setSaveToast(null), 6000);
  };

  // Leave requests
  const approveLeaveRequest = (id: string) => {
    const req = leaveRequests.find((r) => r.id === id);
    const updatedLeaves = leaveRequests.map((r) => (r.id === id ? { ...r, status: 'approved' as const } : r));
    setLeaveRequests(updatedLeaves);
    localStorage.setItem('trackpulse_leaverequests', JSON.stringify(updatedLeaves));
    safeSetDoc(doc(db, 'system_state', 'leaverequests'), { data: updatedLeaves }).catch((err) =>
      console.warn('Leave approve sync error:', err)
    );

    if (req) {
      addAuditLog({
        actorId: currentUser.id,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        category: 'Leave Approval',
        targetEmployeeId: req.userId,
        targetEmployeeName: req.userName,
        details: `Approved ${req.type} leave request for ${req.userName} (${req.startDate} to ${req.endDate}). Saved to Database & Google Sheets.`,
      });
    }

    setSaveToast(`âœ“ Approved leave request and updated Database & Google Sheets!`);
    setTimeout(() => setSaveToast(null), 6000);

    triggerAutoSync(users, timeLogs, auditLogs, payrollRecords, dailyAttendanceLogs, idleLogs, updatedLeaves);
  };

  const rejectLeaveRequest = (id: string) => {
    const req = leaveRequests.find((r) => r.id === id);
    const updatedLeaves = leaveRequests.map((r) => (r.id === id ? { ...r, status: 'rejected' as const } : r));
    setLeaveRequests(updatedLeaves);
    localStorage.setItem('trackpulse_leaverequests', JSON.stringify(updatedLeaves));
    safeSetDoc(doc(db, 'system_state', 'leaverequests'), { data: updatedLeaves }).catch((err) =>
      console.warn('Leave reject sync error:', err)
    );

    if (req) {
      addAuditLog({
        actorId: currentUser.id,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        category: 'Leave Rejected',
        targetEmployeeId: req.userId,
        targetEmployeeName: req.userName,
        details: `Rejected ${req.type} leave request for ${req.userName} (${req.startDate} to ${req.endDate}). Saved to Database & Google Sheets.`,
      });
    }

    setSaveToast(`âœ“ Rejected leave request and synchronized Database!`);
    setTimeout(() => setSaveToast(null), 6000);

    triggerAutoSync(users, timeLogs, auditLogs, payrollRecords, dailyAttendanceLogs, idleLogs, updatedLeaves);
  };

  const submitLeaveRequest = (reqData: Omit<LeaveRequest, 'id' | 'status' | 'requestedAt'>) => {
    const newReq: LeaveRequest = {
      ...reqData,
      id: `leave-${Date.now()}`,
      status: 'pending',
      requestedAt: new Date().toISOString().split('T')[0],
    };
    const updatedLeaves = [newReq, ...leaveRequests];
    setLeaveRequests(updatedLeaves);
    localStorage.setItem('trackpulse_leaverequests', JSON.stringify(updatedLeaves));
    safeSetDoc(doc(db, 'system_state', 'leaverequests'), { data: updatedLeaves }).catch((err) =>
      console.warn('Leave submit sync error:', err)
    );

    addAuditLog({
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'Leave Submission',
      targetEmployeeId: reqData.userId,
      targetEmployeeName: reqData.userName,
      details: `Submitted ${reqData.type} leave request (${reqData.startDate} to ${reqData.endDate}): ${reqData.reason}. Saved to Database & Google Sheets.`,
    });

    setSaveToast(`âœ“ Submitted leave request to Database & Google Sheets!`);
    setTimeout(() => setSaveToast(null), 6000);

    triggerAutoSync(users, timeLogs, auditLogs, payrollRecords, dailyAttendanceLogs, idleLogs, updatedLeaves);
  };

  // Screenshots CRUD
  const deleteScreenshot = (id: string) => {
    const updated = screenshots.filter((s) => s.id !== id);
    setScreenshots(updated);
    localStorage.setItem('trackpulse_screenshots', JSON.stringify(updated));
    safeSetDoc(doc(db, 'system_state', 'screenshots'), { data: updated }).catch((err) =>
      console.warn('Delete screenshot update doc error:', err)
    );
    deleteDoc(doc(db, 'screenshots', id)).catch((err) => console.warn('Delete screenshot doc error:', err));
  };

  const toggleScreenshotBlur = (id: string) => {
    const updated = screenshots.map((s) => (s.id === id ? { ...s, isBlurred: !s.isBlurred } : s));
    setScreenshots(updated);
    localStorage.setItem('trackpulse_screenshots', JSON.stringify(updated));
    safeSetDoc(doc(db, 'system_state', 'screenshots'), { data: updated }).catch((err) =>
      console.warn('Toggle screenshot blur doc error:', err)
    );
  };

  // Payroll updates
  const updatePayrollStatus = (id: string, status: PayrollRecord['status']) => {
    const targetRecord = payrollRecords.find((p) => p.id === id);
    const updatedPayroll = payrollRecords.map((p) =>
      p.id === id
        ? {
            ...p,
            status,
            paidDate: status === 'paid' ? new Date().toISOString().split('T')[0] : p.paidDate,
          }
        : p
    );
    setPayrollRecords(updatedPayroll);
    localStorage.setItem('trackpulse_payroll', JSON.stringify(updatedPayroll));
    safeSetDoc(doc(db, 'system_state', 'payroll'), { data: updatedPayroll }).catch((err) =>
      console.warn('Payroll sync error:', err)
    );

    addAuditLog({
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'Payroll Update',
      targetEmployeeId: targetRecord?.userId,
      targetEmployeeName: targetRecord?.userName,
      details: `Updated payroll status for ${targetRecord?.userName || id} (${targetRecord?.payPeriod}) to "${status.toUpperCase()}". Saved to Database & Google Sheets.`,
    });

    setSaveToast(`âœ“ Updated payroll status to ${status.toUpperCase()} and synced Database & Google Sheets!`);
    setTimeout(() => setSaveToast(null), 6000);

    triggerAutoSync(users, timeLogs, auditLogs, updatedPayroll, dailyAttendanceLogs, idleLogs, leaveRequests);
  };

  // Reset database to fresh Super Admin only state
  const resetDatabaseToFreshState = async () => {
    // Stop any active tracking session immediately
    setIsTracking(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    setStartTimeIso(null);
    trackingSessionStartMsRef.current = 0;
    lastActiveIntervalStartMsRef.current = 0;
    trackingAccumulatedSecondsRef.current = 0;
    currentTaskSegmentStartMsRef.current = 0;
    currentTaskSegmentStartTimeIsoRef.current = null;
    mouseActivityHistoryRef.current = [];
    keyboardActivityHistoryRef.current = [];
    setCurrentInactivitySeconds(0);
    setSessionIdleDeductionSeconds(0);
    setIsIdleAlertActive(false);

    setUsers(INITIAL_USERS);
    setCurrentUser(INITIAL_USERS[0]);
    setTimeLogs([]);
    setScreenshots([]);
    setIdleLogs([]);
    setLeaveRequests([]);
    setManualTimeRequests([]);
    setPayrollRecords(INITIAL_PAYROLL);
    setDailyAttendanceLogs([]);
    const cleanPresenceList = INITIAL_USERS.map((u) => ({
      userId: u.id,
      userName: u.name,
      role: u.role,
      designation: u.designation,
      employeeCode: u.employeeCode,
      department: u.department || 'Executive Management',
      teamLeaderId: u.teamLeaderId || '',
      isOnline: false,
      status: 'offline' as const,
      mouseActivity: 0,
      keyboardActivity: 0,
      lastHeartbeat: new Date().toISOString(),
    }));
    setUserPresenceList(cleanPresenceList);
    setAuditLogs(INITIAL_AUDIT_LOGS);

    // Clean all localStorage keys
    localStorage.removeItem('trackpulse_active_tracking');
    localStorage.setItem('trackpulse_users', JSON.stringify(INITIAL_USERS));
    localStorage.setItem('trackpulse_timelogs', JSON.stringify([]));
    localStorage.setItem('trackpulse_screenshots', JSON.stringify([]));
    localStorage.setItem('trackpulse_idlelogs', JSON.stringify([]));
    localStorage.setItem('trackpulse_leaverequests', JSON.stringify([]));
    localStorage.setItem('trackpulse_manualrequests', JSON.stringify([]));
    localStorage.setItem('trackpulse_payroll', JSON.stringify(INITIAL_PAYROLL));
    localStorage.setItem('trackpulse_attendance', JSON.stringify([]));
    localStorage.setItem('trackpulse_presence', JSON.stringify([]));
    localStorage.setItem('trackpulse_auditlogs', JSON.stringify(INITIAL_AUDIT_LOGS));
    localStorage.setItem('trackpulse_clean_v8', 'true');

    // Notify backend bridge to reset in-memory caches
    fetch('/api/timelogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'RESET_ALL' }),
    }).catch(() => {});

    // If connected to Google Sheets webhook, trigger RESET_ALL in Google Spreadsheet as well
    const webhookUrl = googleSheetsWebhookUrl || localStorage.getItem('trackpulse_sheets_webhook');
    if (webhookUrl && isValidWebhookUrl(webhookUrl)) {
      resetGoogleSpreadsheetData(webhookUrl).catch((err) =>
        console.warn('Google Sheets reset error:', err)
      );
    }

    try {
      await Promise.all([
        safeSetDoc(doc(db, 'system_state', 'users'), { data: INITIAL_USERS }),
        safeSetDoc(doc(db, 'system_state', 'timelogs'), { data: [] }),
        safeSetDoc(doc(db, 'system_state', 'screenshots'), { data: [] }),
        safeSetDoc(doc(db, 'system_state', 'idlelogs'), { data: [] }),
        safeSetDoc(doc(db, 'system_state', 'leaverequests'), { data: [] }),
        safeSetDoc(doc(db, 'system_state', 'manualrequests'), { data: [] }),
        safeSetDoc(doc(db, 'system_state', 'payroll'), { data: INITIAL_PAYROLL }),
        safeSetDoc(doc(db, 'system_state', 'attendance'), { data: [] }),
        safeSetDoc(doc(db, 'system_state', 'auditlogs'), { data: INITIAL_AUDIT_LOGS }),
      ]);
      setSaveToast('âœ“ Complete System Reset! All time logs, tasks, sessions, and database tables have been reset to clean state.');
    } catch (err) {
      console.warn('Reset database error:', err);
      setSaveToast('âœ“ Local system & cache reset to clean state! (Firestore update queued)');
    }
    setTimeout(() => setSaveToast(null), 7000);
  };

  // World Clocks CRUD
  const addWorldClock = (clock: Omit<WorldClockItem, 'id'>) => {
    const newClock: WorldClockItem = { ...clock, id: `wc-${Date.now()}` };
    setWorldClocks((prev) => [...prev, newClock]);
  };

  const deleteWorldClock = (id: string) => {
    setWorldClocks((prev) => prev.filter((c) => c.id !== id));
  };

  // Designation & Task Management System (Admin / Super Admin)
  const designationList = Object.keys(designationTasks);

  const getTasksForDesignation = useCallback(
    (designation?: string): string[] => {
      const target = designation || currentDesignation || currentUser?.designation || 'Agent';
      if (designationTasks[target] && designationTasks[target].length > 0) {
        return designationTasks[target];
      }
      const matchedKey = Object.keys(designationTasks).find(
        (k) => k.toLowerCase() === target.toLowerCase()
      );
      if (matchedKey && designationTasks[matchedKey].length > 0) {
        return designationTasks[matchedKey];
      }
      return designationTasks['Agent'] || [
        'Data Entry & Market Research',
        'Email Reachout',
        'Follow-up',
        'Training',
        'Team Meeting',
        'Coaching',
      ];
    },
    [designationTasks, currentDesignation, currentUser]
  );

  const addDesignation = (name: string, initialTasks: string[] = ['On Shift', 'Team Meeting']) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const updated = {
      ...designationTasks,
      [trimmed]: initialTasks.length > 0 ? initialTasks : ['On Shift', 'Team Meeting'],
    };
    setDesignationTasks(updated);
    localStorage.setItem('trackpulse_designation_tasks', JSON.stringify(updated));
    safeSetDoc(doc(db, 'system_state', 'designationtasks'), { data: updated }).catch((err) =>
      console.warn('Designation tasks sync error:', err)
    );
    addAuditLog({
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'Designation Added',
      targetEmployeeName: trimmed,
      details: `Created new designation "${trimmed}" with ${updated[trimmed].length} default tasks.`,
    });
    setSaveToast(`âœ“ Created designation "${trimmed}"!`);
    setTimeout(() => setSaveToast(null), 5000);
  };

  const deleteDesignation = (name: string) => {
    const updated = { ...designationTasks };
    delete updated[name];
    setDesignationTasks(updated);
    localStorage.setItem('trackpulse_designation_tasks', JSON.stringify(updated));
    safeSetDoc(doc(db, 'system_state', 'designationtasks'), { data: updated }).catch((err) =>
      console.warn('Designation tasks sync error:', err)
    );
    addAuditLog({
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'Designation Deleted',
      targetEmployeeName: name,
      details: `Deleted designation "${name}" and its associated tasks.`,
    });
    setSaveToast(`âœ“ Deleted designation "${name}"!`);
    setTimeout(() => setSaveToast(null), 5000);
  };

  const addTaskToDesignation = (designation: string, taskName: string) => {
    const trimmed = taskName.trim();
    if (!trimmed) return;
    const existing = designationTasks[designation] || [];
    if (existing.includes(trimmed)) return;
    const updated = {
      ...designationTasks,
      [designation]: [...existing, trimmed],
    };
    setDesignationTasks(updated);
    localStorage.setItem('trackpulse_designation_tasks', JSON.stringify(updated));
    safeSetDoc(doc(db, 'system_state', 'designationtasks'), { data: updated }).catch((err) =>
      console.warn('Designation tasks sync error:', err)
    );
    addAuditLog({
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'Task Category Added',
      targetEmployeeName: designation,
      details: `Added task "${trimmed}" to designation "${designation}".`,
    });
    setSaveToast(`âœ“ Added task "${trimmed}" to ${designation}!`);
    setTimeout(() => setSaveToast(null), 5000);
  };

  const removeTaskFromDesignation = (designation: string, taskName: string) => {
    const existing = designationTasks[designation] || [];
    const updated = {
      ...designationTasks,
      [designation]: existing.filter((t) => t !== taskName),
    };
    setDesignationTasks(updated);
    localStorage.setItem('trackpulse_designation_tasks', JSON.stringify(updated));
    safeSetDoc(doc(db, 'system_state', 'designationtasks'), { data: updated }).catch((err) =>
      console.warn('Designation tasks sync error:', err)
    );
    addAuditLog({
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'Task Category Removed',
      targetEmployeeName: designation,
      details: `Removed task "${taskName}" from designation "${designation}".`,
    });
    setSaveToast(`âœ“ Removed task "${taskName}" from ${designation}!`);
    setTimeout(() => setSaveToast(null), 5000);
  };

  // Granular Access Permissions Manager (Super Admin)
  const updateRolePermission = (roleKey: string, permissionKey: keyof RolePermissions, value: boolean) => {
    const current = rolePermissions[roleKey] || DEFAULT_ROLE_PERMISSIONS[roleKey] || {
      canEditEmployees: false,
      canAssignTeamLeader: false,
      canViewActivityLogs: false,
      canViewScreenshots: false,
      canViewTimesheets: false,
      canViewPayroll: false,
      canManageTasks: false,
      canManageRoles: false,
      canSyncSheets: false,
    };
    const updated = {
      ...rolePermissions,
      [roleKey]: {
        ...current,
        [permissionKey]: value,
      },
    };
    setRolePermissions(updated);
    localStorage.setItem('trackpulse_role_permissions', JSON.stringify(updated));
    safeSetDoc(doc(db, 'system_state', 'rolepermissions'), { data: updated }).catch((err) =>
      console.warn('Role permissions sync error:', err)
    );
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateFormatted = `${monthNames[now.getMonth()]} ${now.getDate().toString().padStart(2, '0')}, ${now.getFullYear()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    const auditEntry: AuditLog = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: now.toISOString(),
      dateFormatted,
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'Permissions Updated',
      targetEmployeeName: roleKey,
      details: `Super Admin updated permission [${permissionKey} = ${value ? 'GRANTED' : 'REVOKED'}] for role/designation "${roleKey}". Saved to Spreadsheet Database.`,
    };
    const updatedAudit = [auditEntry, ...auditLogs];
    setAuditLogs(updatedAudit);
    triggerAutoSync(users, timeLogs, updatedAudit, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests, designationTasks, updated);
    setSaveToast(`âœ“ Updated permission [${permissionKey}] for "${roleKey}" and synced Database!`);
    setTimeout(() => setSaveToast(null), 5000);
  };

  const updateUserCustomPermission = (userId: string, permissionKey: keyof RolePermissions, value: boolean) => {
    const target = users.find((u) => u.id === userId);
    const updatedUsers = users.map((u) => {
      if (u.id === userId) {
        return {
          ...u,
          customPermissions: {
            ...(u.customPermissions || {}),
            [permissionKey]: value,
          },
        };
      }
      return u;
    });
    setUsers(updatedUsers);
    localStorage.setItem('trackpulse_users', JSON.stringify(updatedUsers));
    safeSetDoc(doc(db, 'system_state', 'users'), { data: updatedUsers }).catch((err) =>
      console.warn('User custom permissions sync error:', err)
    );
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateFormatted = `${monthNames[now.getMonth()]} ${now.getDate().toString().padStart(2, '0')}, ${now.getFullYear()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    const auditEntry: AuditLog = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: now.toISOString(),
      dateFormatted,
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'User Custom Permission Set',
      targetEmployeeId: userId,
      targetEmployeeName: target?.name || userId,
      details: `Set individual permission override [${permissionKey} = ${value ? 'GRANTED' : 'REVOKED'}] for ${target?.name || userId}. Saved to Spreadsheet Database.`,
    };
    const updatedAudit = [auditEntry, ...auditLogs];
    setAuditLogs(updatedAudit);
    triggerAutoSync(updatedUsers, timeLogs, updatedAudit, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests, designationTasks, rolePermissions);
    setSaveToast(`âœ“ Updated custom permission for ${target?.name || 'user'} and synced Database!`);
    setTimeout(() => setSaveToast(null), 5000);
  };

  const resetUserCustomPermissions = (userId: string) => {
    const target = users.find((u) => u.id === userId);
    const updatedUsers = users.map((u) => {
      if (u.id === userId) {
        const copy = { ...u };
        delete copy.customPermissions;
        return copy;
      }
      return u;
    });
    setUsers(updatedUsers);
    localStorage.setItem('trackpulse_users', JSON.stringify(updatedUsers));
    safeSetDoc(doc(db, 'system_state', 'users'), { data: updatedUsers }).catch((err) =>
      console.warn('User custom permissions reset sync error:', err)
    );
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateFormatted = `${monthNames[now.getMonth()]} ${now.getDate().toString().padStart(2, '0')}, ${now.getFullYear()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    const auditEntry: AuditLog = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: now.toISOString(),
      dateFormatted,
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'User Custom Permission Reset',
      targetEmployeeId: userId,
      targetEmployeeName: target?.name || userId,
      details: `Reset individual permissions for ${target?.name || userId} back to designation defaults. Saved to Spreadsheet Database.`,
    };
    const updatedAudit = [auditEntry, ...auditLogs];
    setAuditLogs(updatedAudit);
    triggerAutoSync(updatedUsers, timeLogs, updatedAudit, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests, designationTasks, rolePermissions);
    setSaveToast(`âœ“ Reset permissions for ${target?.name || 'user'} to standard designation defaults and synced Database!`);
    setTimeout(() => setSaveToast(null), 5000);
  };

  const addRoleCategory = (roleKey: string, initialPermissions?: Partial<RolePermissions>) => {
    const trimmedKey = roleKey.trim();
    if (!trimmedKey) return;
    const defaultPerms: RolePermissions = {
      canEditEmployees: false,
      canAssignTeamLeader: false,
      canViewActivityLogs: false,
      canViewScreenshots: false,
      canViewTimesheets: false,
      canViewPayroll: false,
      canManageTasks: false,
      canManageRoles: false,
      canSyncSheets: false,
      ...(initialPermissions || {}),
    };
    const updated = {
      ...rolePermissions,
      [trimmedKey]: defaultPerms,
    };
    setRolePermissions(updated);
    localStorage.setItem('trackpulse_role_permissions', JSON.stringify(updated));
    safeSetDoc(doc(db, 'system_state', 'rolepermissions'), { data: updated }).catch((err) =>
      console.warn('Role permissions sync error:', err)
    );
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateFormatted = `${monthNames[now.getMonth()]} ${now.getDate().toString().padStart(2, '0')}, ${now.getFullYear()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    const auditEntry: AuditLog = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: now.toISOString(),
      dateFormatted,
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'Permissions Updated',
      targetEmployeeName: trimmedKey,
      details: `Created new Role / Category permission matrix for "${trimmedKey}". Saved to Spreadsheet Database.`,
    };
    const updatedAudit = [auditEntry, ...auditLogs];
    setAuditLogs(updatedAudit);
    triggerAutoSync(users, timeLogs, updatedAudit, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests, designationTasks, updated);
    setSaveToast(`âœ“ Created Role / Category "${trimmedKey}" and synced to Database!`);
    setTimeout(() => setSaveToast(null), 5000);
  };

  const deleteRoleCategory = (roleKey: string) => {
    const updated = { ...rolePermissions };
    delete updated[roleKey];
    setRolePermissions(updated);
    localStorage.setItem('trackpulse_role_permissions', JSON.stringify(updated));
    safeSetDoc(doc(db, 'system_state', 'rolepermissions'), { data: updated }).catch((err) =>
      console.warn('Role permissions sync error:', err)
    );
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateFormatted = `${monthNames[now.getMonth()]} ${now.getDate().toString().padStart(2, '0')}, ${now.getFullYear()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    const auditEntry: AuditLog = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: now.toISOString(),
      dateFormatted,
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'Permissions Updated',
      targetEmployeeName: roleKey,
      details: `Deleted custom Role / Category permission matrix for "${roleKey}". Saved to Spreadsheet Database.`,
    };
    const updatedAudit = [auditEntry, ...auditLogs];
    setAuditLogs(updatedAudit);
    triggerAutoSync(users, timeLogs, updatedAudit, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests, designationTasks, updated);
    setSaveToast(`âœ“ Removed custom category "${roleKey}" and synced Database!`);
    setTimeout(() => setSaveToast(null), 5000);
  };

  const hasPermission = useCallback(
    (permissionKey: keyof RolePermissions, targetUser?: User): boolean => {
      const u = targetUser || currentUser;
      if (!u) return false;

      // Super Admin always has full access
      const isSuper =
        u.employeeCode?.toLowerCase() === 'superadmin' ||
        u.id === 'usr-superadmin-red' ||
        u.id === 'usr-superadmin-root' ||
        u.email === 'admin@llc.com';
      if (isSuper) return true;

      // Check User-level custom override
      if (u.customPermissions && u.customPermissions[permissionKey] !== undefined) {
        return Boolean(u.customPermissions[permissionKey]);
      }

      // Check Role-level permissions (e.g., 'trainer', 'team_lead', 'admin', 'qa', 'hr', 'payroll', 'agent')
      const roleKey = u.role?.toLowerCase();
      if (rolePermissions[roleKey] && rolePermissions[roleKey][permissionKey] !== undefined) {
        return Boolean(rolePermissions[roleKey][permissionKey]);
      }

      // Check Designation-level permissions (e.g., 'Trainer', 'Team Leader', 'QA', 'Writer', 'HR', 'Payroll')
      const desigKey = u.designation;
      if (rolePermissions[desigKey] && rolePermissions[desigKey][permissionKey] !== undefined) {
        return Boolean(rolePermissions[desigKey][permissionKey]);
      }

      // Admin role default fallback
      if (u.role === 'admin' && permissionKey !== 'canManageRoles') return true;

      return false;
    },
    [currentUser, rolePermissions]
  );

  // Format total seconds into HH:MM:SS
  const formatDuration = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const [presenceClock, setPresenceClock] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPresenceClock(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const getLoginDurationSeconds = (loginTime?: string) => {
    if (!loginTime) return 0;

    const loginMs = new Date(loginTime).getTime();

    if (!Number.isFinite(loginMs)) return 0;

    return Math.max(
      0,
      Math.floor((presenceClock - loginMs) / 1000)
    );
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        users,
        setUsers,
        setCurrentUser,
        isCloudQuotaExhausted,
        isAuthenticated,
        loginMode,
        setLoginMode,
        login,
        logout,
        getLoginDurationSeconds,
        webSessionRemainingSeconds,
        isSessionWarningActive,
        webSessionWarningCountdown,
        refreshWebSession,
        sessionExpiredReason,
        clearSessionExpiredReason,
        isOffline,
        isFirestoreLoaded,
        offlineSinceTimestamp,
        offlineSecondsRemaining,
        offlineStatusStage,
        retryConnection,
        simulateOfflineToggle,
        isTracking,
        isPaused,
        currentDesignation,
        currentTask,
        elapsedSeconds,
        currentSessionApps,
        currentMouseActivity,
        currentKeyboardActivity,
        currentActiveApp,
        taskSwitchPending,
        currentIdleThresholdMinutes,
        currentInactivitySeconds,
        sessionIdleDeductionSeconds,
        isIdleAlertActive,
        dismissIdleAlert,
        recordIdleInactivityEvent,
        simulateIdleEvent,
        restoreInactivityDeduction,
        isDualMonitorMode,
        toggleDualMonitorMode,
        storageEngineMode,
        setStorageEngineMode,
        inactivityAlertState,
        respondToInactivityAlert,
        startTracking,
        pauseTracking,
        resumeTracking,
        stopTracking,
        selectDesignation,
        selectTaskWithPrompt,
        confirmTaskSwitch,
        cancelTaskSwitch,
        timeLogs,
        screenshots,
        idleLogs,
        leaveRequests,
        manualTimeRequests,
        payrollRecords,
        worldClocks,
        auditLogs,
        userPresenceList,
        dailyAttendanceLogs,
        passwordResetRequests,
        addAuditLog,
        saveToast,
        setSaveToast,
        googleSheetsWebhookUrl,
        setGoogleSheetsWebhookUrl,
        isAutoSyncToSheetsEnabled,
        setIsAutoSyncToSheetsEnabled,
        triggerGoogleSheetsSync,
        importEmployeesFromGoogleSheets,
        importTimeLogsFromGoogleSheets,
        importPresenceFromGoogleSheets,
        syncAllFromGoogleSheets,
        startAgentLiveShift,
        stopAgentLiveShift,
        simulateActiveTraineesShift,
        isDesktopDockView,
        setIsDesktopDockView,
        addUser,
        updateUser,
        deleteUser,
        resetUserPassword,
        requestPasswordReset,
        approvePasswordResetRequest,
        rejectPasswordResetRequest,
        addTimeLog,
        updateTimeLog,
        deleteTimeLog,
        approveManualTimeRequest,
        rejectManualTimeRequest,
        submitManualTimeRequest,
        approveLeaveRequest,
        rejectLeaveRequest,
        submitLeaveRequest,
        deleteScreenshot,
        toggleScreenshotBlur,
        updatePayrollStatus,
        addWorldClock,
        deleteWorldClock,
        resetDatabaseToFreshState,
        designationTasks,
        designationList,
        getTasksForDesignation,
        addDesignation,
        deleteDesignation,
        addTaskToDesignation,
        removeTaskFromDesignation,
        rolePermissions,
        updateRolePermission,
        updateUserCustomPermission,
        resetUserCustomPermissions,
        addRoleCategory,
        deleteRoleCategory,
        hasPermission,
        formatDuration,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

