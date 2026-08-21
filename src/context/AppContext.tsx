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
import { doc, setDoc, deleteDoc, onSnapshot, collection, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  syncDataToGoogleSheetsWebhook,
  DEFAULT_SPREADSHEET_URL,
  DEFAULT_SPREADSHEET_ID,
  fetchEmployeesFromGoogleSheets,
} from '../lib/googleSheetsSync';
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

const safeSetDoc = (docRef: any, data: any, options?: any) => {
  const cleanData = sanitizeForFirestore(data);
  return options ? setDoc(docRef, cleanData, options) : setDoc(docRef, cleanData);
};

interface TaskSwitchPending {
  targetTask: TaskCategory;
}

interface AppContextType {
  currentUser: User;
  users: User[];
  setCurrentUser: (user: User) => void;
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
  triggerGoogleSheetsSync: (overrideUrl?: string) => Promise<{ success: boolean; message: string }>;
  importEmployeesFromGoogleSheets: (overrideUrl?: string) => Promise<{ success: boolean; count: number; message: string }>;
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
        role: 'admin' as const,
        designation: 'Admin',
        department: 'Executive Management',
        password: u.password || 'AdminpassW0rd123!',
        mustChangePassword: false,
        screenshotMonitored: false,
        activityMonitored: false,
      };
    }
    return u;
  };

  // Load from localStorage or defaults
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('trackpulse_users');
    if (!saved) return INITIAL_USERS;
    try {
      const parsed: User[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeSuperAdmin);
      }
      return INITIAL_USERS;
    } catch {
      return INITIAL_USERS;
    }
  });

  const [currentUser, setCurrentUser] = useState<User>(() => {
    const rootUser = users.find(
      (u) =>
        u.employeeCode?.toLowerCase() === 'superadmin' ||
        u.id === 'usr-superadmin-red' ||
        u.email === 'admin@llc.com'
    );
    if (rootUser) {
      return normalizeSuperAdmin(rootUser);
    }
    return normalizeSuperAdmin(users[0] || INITIAL_USERS[0]);
  });

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('trackpulse_auth') === 'true';
  });
  const [loginMode, setLoginMode] = useState<'webapp' | 'software'>(() => {
    return (localStorage.getItem('trackpulse_login_mode') as 'webapp' | 'software') || 'webapp';
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
        return JSON.parse(saved);
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
          return parsed;
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

  const [saveToast, setSaveToast] = useState<string | null>(null);

  const [googleSheetsWebhookUrl, setGoogleSheetsWebhookUrlState] = useState<string>(() => {
    return localStorage.getItem('trackpulse_sheets_webhook') || '';
  });

  const setGoogleSheetsWebhookUrl = (url: string) => {
    const cleanUrl = (url || '').trim();
    setGoogleSheetsWebhookUrlState(cleanUrl);
    localStorage.setItem('trackpulse_sheets_webhook', cleanUrl);
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

  // Dedicated automatic sync dispatcher with fallback Firestore config fetch
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
      updatedRolePermissions = rolePermissions
    ) => {
      let activeUrl = googleSheetsWebhookUrl || localStorage.getItem('trackpulse_sheets_webhook') || '';
      if (!activeUrl || !activeUrl.trim()) {
        try {
          const cfgSnap = await getDoc(doc(db, 'system_state', 'config'));
          if (cfgSnap.exists()) {
            const cData = cfgSnap.data();
            activeUrl = cData?.webhookUrl || cData?.sheetsWebhookUrl || '';
            if (activeUrl && activeUrl.trim()) {
              setGoogleSheetsWebhookUrlState(activeUrl.trim());
              localStorage.setItem('trackpulse_sheets_webhook', activeUrl.trim());
            }
          }
        } catch (e) {}
      }
      if (activeUrl && activeUrl.trim()) {
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
          updatedRolePermissions
        ).catch((err) => console.warn('Auto-sync to Google Sheets warning:', err));
      }
    },
    [googleSheetsWebhookUrl, users, timeLogs, auditLogs, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests, designationTasks, rolePermissions]
  );

  const triggerGoogleSheetsSync = async (overrideUrl?: string): Promise<{ success: boolean; message: string }> => {
    const targetUrl = overrideUrl || googleSheetsWebhookUrl;
    if (!targetUrl) {
      setSaveToast(`✓ Saved to Central Database! (Tip: Paste Google Apps Script Webhook URL in Header to auto-sync directly to Google Sheets)`);
      setTimeout(() => setSaveToast(null), 8000);
      return { success: false, message: 'No webhook URL provided' };
    }
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
      rolePermissions
    );
    if (res.success) {
      setSaveToast(`✓ Synced all Database Tabs (including Designation Tasks & Permissions) to Google Sheets!`);
    } else {
      setSaveToast(`⚠️ Google Sheets Sync: ${res.message}`);
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
      setUsers(res.employees);
      localStorage.setItem('trackpulse_users', JSON.stringify(res.employees));
      safeSetDoc(doc(db, 'system_state', 'users'), { data: res.employees }).catch((err) =>
        console.warn('Users save err:', err)
      );

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

      setSaveToast(`✓ Two-Way Sync: Imported ${res.count} employees from Google Sheets!`);
      setTimeout(() => setSaveToast(null), 7000);

      return { success: true, count: res.count, message: res.message };
    } else {
      setSaveToast(`⚠️ Google Sheets Import: ${res.message}`);
      setTimeout(() => setSaveToast(null), 7000);
      return { success: false, count: 0, message: res.message };
    }
  };

  // Flag to avoid overwriting Firestore with initial local defaults before loading
  const [isFirestoreLoaded, setIsFirestoreLoaded] = useState(false);

  // Load and subscribe to real-time Firestore updates
  useEffect(() => {
    let unsubTimeLogs = () => {};
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

    try {
      unsubConfig = onSnapshot(doc(db, 'system_state', 'config'), (snapshot) => {
        if (snapshot.exists()) {
          const cfgData = snapshot.data();
          const remoteUrl = cfgData?.webhookUrl || cfgData?.sheetsWebhookUrl || '';
          if (remoteUrl && remoteUrl.trim()) {
            setGoogleSheetsWebhookUrlState(remoteUrl.trim());
            localStorage.setItem('trackpulse_sheets_webhook', remoteUrl.trim());
          }
        }
      }, (err) => console.warn('Config listener warning:', err));

      unsubTimeLogs = onSnapshot(doc(db, 'system_state', 'timelogs'), (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.data !== undefined) {
          const remoteLogs: TimeLog[] = snapshot.data().data;
          if (Array.isArray(remoteLogs)) {
            setTimeLogs(remoteLogs);
            localStorage.setItem('trackpulse_timelogs', JSON.stringify(remoteLogs));
          }
        }
        setIsFirestoreLoaded(true);
      }, (err) => {
        console.warn('Firestore timelogs listener warning:', err);
        setIsFirestoreLoaded(true);
      });

      unsubUsers = onSnapshot(doc(db, 'system_state', 'users'), (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.data !== undefined) {
          const remoteUsers: User[] = snapshot.data().data;
          if (Array.isArray(remoteUsers) && remoteUsers.length > 0) {
            const sanitizedUsers = remoteUsers.map(normalizeSuperAdmin);
            setUsers(sanitizedUsers);
            localStorage.setItem('trackpulse_users', JSON.stringify(sanitizedUsers));
          }
        }
      }, (err) => console.warn('Firestore users listener warning:', err));

      unsubAudit = onSnapshot(doc(db, 'system_state', 'auditlogs'), (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.data !== undefined) {
          const remoteAudit: AuditLog[] = snapshot.data().data;
          if (Array.isArray(remoteAudit)) {
            setAuditLogs(remoteAudit);
            localStorage.setItem('trackpulse_auditlogs', JSON.stringify(remoteAudit));
          }
        }
      }, (err) => console.warn('Firestore auditlogs listener warning:', err));

      unsubScreenshots = onSnapshot(doc(db, 'system_state', 'screenshots'), (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.data !== undefined) {
          const remoteScreenshots: ScreenshotLog[] = snapshot.data().data;
          if (Array.isArray(remoteScreenshots)) {
            setScreenshots(remoteScreenshots);
            localStorage.setItem('trackpulse_screenshots', JSON.stringify(remoteScreenshots));
          }
        }
      }, (err) => console.warn('Firestore screenshots listener warning:', err));

      unsubPayroll = onSnapshot(doc(db, 'system_state', 'payroll'), (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.data !== undefined) {
          const remotePayroll: PayrollRecord[] = snapshot.data().data;
          if (Array.isArray(remotePayroll)) {
            setPayrollRecords(remotePayroll);
            localStorage.setItem('trackpulse_payroll', JSON.stringify(remotePayroll));
          }
        }
      }, (err) => console.warn('Firestore payroll listener warning:', err));

      unsubAttendance = onSnapshot(doc(db, 'system_state', 'attendance'), (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.data !== undefined) {
          const remoteAtt: DailyAttendanceLog[] = snapshot.data().data;
          if (Array.isArray(remoteAtt)) {
            setDailyAttendanceLogs(remoteAtt);
            localStorage.setItem('trackpulse_attendance', JSON.stringify(remoteAtt));
          }
        }
      }, (err) => console.warn('Firestore attendance listener warning:', err));

      // Real-time live presence listener: Listens to collection('user_presence') across all active devices
      unsubPresence = onSnapshot(collection(db, 'user_presence'), (snapshot) => {
        if (!snapshot.empty) {
          const presenceMap = new Map<string, UserPresence>();
          snapshot.forEach((d) => {
            const data = d.data() as UserPresence;
            if (data && data.userId) {
              presenceMap.set(data.userId, data);
            }
          });

          setUserPresenceList((prev) => {
            const updated = prev.map((p) => {
              const live = presenceMap.get(p.userId);
              return live ? { ...p, ...live } : p;
            });
            presenceMap.forEach((live, uId) => {
              if (!updated.some((p) => p.userId === uId)) {
                updated.push(live);
              }
            });
            localStorage.setItem('trackpulse_presence', JSON.stringify(updated));
            return updated;
          });
        }
      }, (err) => {
        console.warn('Firestore user_presence collection listener warning:', err);
        // Fallback to system_state/presence if collection read had issues
        onSnapshot(doc(db, 'system_state', 'presence'), (snap) => {
          if (snap.exists() && snap.data()?.data !== undefined) {
            const remotePresence: UserPresence[] = snap.data().data;
            if (Array.isArray(remotePresence)) {
              setUserPresenceList(remotePresence);
              localStorage.setItem('trackpulse_presence', JSON.stringify(remotePresence));
            }
          }
        }, () => {});
      });

      unsubLeave = onSnapshot(doc(db, 'system_state', 'leaverequests'), (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.data !== undefined) {
          const remoteLeave: LeaveRequest[] = snapshot.data().data;
          if (Array.isArray(remoteLeave)) {
            setLeaveRequests(remoteLeave);
            localStorage.setItem('trackpulse_leaverequests', JSON.stringify(remoteLeave));
          }
        }
      }, (err) => console.warn('Firestore leave requests listener warning:', err));

      unsubManual = onSnapshot(doc(db, 'system_state', 'manualrequests'), (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.data !== undefined) {
          const remoteManual: ManualTimeRequest[] = snapshot.data().data;
          if (Array.isArray(remoteManual)) {
            setManualTimeRequests(remoteManual);
            localStorage.setItem('trackpulse_manualrequests', JSON.stringify(remoteManual));
          }
        }
      }, (err) => console.warn('Firestore manual requests listener warning:', err));

      unsubPasswordReqs = onSnapshot(doc(db, 'system_state', 'passwordrequests'), (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.data !== undefined) {
          const remoteReqs: PasswordResetRequest[] = snapshot.data().data;
          if (Array.isArray(remoteReqs)) {
            setPasswordResetRequests(remoteReqs);
            localStorage.setItem('trackpulse_pwd_requests', JSON.stringify(remoteReqs));
          }
        }
      }, (err) => console.warn('Firestore password requests listener warning:', err));

      unsubTasks = onSnapshot(doc(db, 'system_state', 'designationtasks'), (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.data !== undefined) {
          const remoteTasks = snapshot.data().data;
          if (remoteTasks && typeof remoteTasks === 'object') {
            setDesignationTasks((prev) => ({ ...prev, ...remoteTasks }));
            localStorage.setItem('trackpulse_designation_tasks', JSON.stringify(remoteTasks));
          }
        }
      }, (err) => console.warn('Firestore designation tasks listener warning:', err));

      unsubPerms = onSnapshot(doc(db, 'system_state', 'rolepermissions'), (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.data !== undefined) {
          const remotePerms = snapshot.data().data;
          if (remotePerms && typeof remotePerms === 'object') {
            setRolePermissions((prev) => ({ ...prev, ...remotePerms }));
            localStorage.setItem('trackpulse_role_permissions', JSON.stringify(remotePerms));
          }
        }
      }, (err) => console.warn('Firestore role permissions listener warning:', err));
    } catch (err) {
      console.warn('Firestore setup error:', err);
      setIsFirestoreLoaded(true);
    }

    return () => {
      unsubTimeLogs();
      unsubUsers();
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

  // Active Timer state
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentDesignation, setCurrentDesignation] = useState<Designation>(currentUser.designation || 'Agent');

  // Automatically sync currentDesignation with active currentUser profile
  useEffect(() => {
    if (currentUser) {
      setCurrentDesignation(currentUser.designation || 'Agent');
    }
  }, [currentUser]);
  const [currentTask, setCurrentTask] = useState<TaskCategory>('Email Reachout');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTimeIso, setStartTimeIso] = useState<string | null>(null);

  // Desktop App Widget vs Web Dashboard Mode
  const [isDesktopDockView, setIsDesktopDockView] = useState(() => {
    return localStorage.getItem('trackpulse_login_mode') === 'software';
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

  const lastWebActivityTimestampRef = useRef<number>(Date.now());

  const refreshWebSession = useCallback(() => {
    lastWebActivityTimestampRef.current = Date.now();
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
    localStorage.removeItem('trackpulse_session_expired_reason');
    setSessionExpiredReason(null);
    lastWebActivityTimestampRef.current = Date.now();
    setWebSessionRemainingSeconds(WEB_SESSION_TOTAL_TIMEOUT_SECONDS);
    setIsSessionWarningActive(false);
    setWebSessionWarningCountdown(300);

    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateFormatted = `${monthNames[now.getMonth()]} ${now.getDate().toString().padStart(2, '0')}, ${now.getFullYear()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    const loginLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: now.toISOString(),
      dateFormatted,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      category: 'Login',
      details: `User signed into LLC Time Tracker ${mode === 'software' ? 'Desktop Software App' : 'Web Portal'}.`,
    };
    const updatedAudit = [loginLog, ...auditLogs];
    setAuditLogs(updatedAudit);

    // Instant presence broadcast on login
    const nowIso = now.toISOString();
    const loginPresence: UserPresence = {
      userId: user.id,
      userName: user.name,
      employeeCode: user.employeeCode || '',
      role: user.role,
      designation: user.designation || 'Agent',
      department: user.department || 'Operations',
      teamLeaderId: user.teamLeaderId || '',
      isOnline: true,
      status: 'online',
      isTracking: false,
      isPaused: false,
      elapsedSeconds: 0,
      mouseActivity: 0,
      keyboardActivity: 0,
      currentTask: 'Available / Ready',
      currentApp: mode === 'software' ? 'LLC Time Tracker Desktop Software' : 'Web Portal',
      lastHeartbeat: nowIso,
      loginTime: nowIso,
    };
    safeSetDoc(doc(db, 'user_presence', user.id), loginPresence, { merge: true }).catch(() => {});

    triggerAutoSync(users, timeLogs, updatedAudit, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests);
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

      // Instant offline status broadcast
      safeSetDoc(doc(db, 'user_presence', currentUser.id), {
        isOnline: false,
        status: 'offline',
        isTracking: false,
        isPaused: false,
        lastHeartbeat: new Date().toISOString(),
      }, { merge: true }).catch(() => {});

      triggerAutoSync(users, timeLogs, updatedAudit, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests);
    }
    setIsAuthenticated(false);
    setIsSessionWarningActive(false);
    localStorage.removeItem('trackpulse_auth');
  };

  // WebApp Inactivity Auto-Logout Effect:
  // - 0 to 5 minutes inactive: Normal working state
  // - 5 to 10 minutes inactive: Triggers countdown warning (5:00 down to 0:00)
  // - At 10 minutes inactive: Automatic logout on webapp (Desktop Software is exempt)
  useEffect(() => {
    if (!isAuthenticated || loginMode !== 'webapp') return;

    lastWebActivityTimestampRef.current = Date.now();
    setWebSessionRemainingSeconds(WEB_SESSION_TOTAL_TIMEOUT_SECONDS);
    setIsSessionWarningActive(false);
    setWebSessionWarningCountdown(300);

    const handleWebUserActivity = () => {
      lastWebActivityTimestampRef.current = Date.now();
      setIsSessionWarningActive(false);
      setWebSessionWarningCountdown(300);
      setWebSessionRemainingSeconds(WEB_SESSION_TOTAL_TIMEOUT_SECONDS);
    };

    // Attach interaction listeners to reset the timer on any user action
    window.addEventListener('mousemove', handleWebUserActivity, { passive: true });
    window.addEventListener('mousedown', handleWebUserActivity, { passive: true });
    window.addEventListener('keydown', handleWebUserActivity, { passive: true });
    window.addEventListener('touchstart', handleWebUserActivity, { passive: true });
    window.addEventListener('scroll', handleWebUserActivity, { passive: true });
    window.addEventListener('click', handleWebUserActivity, { passive: true });
    window.addEventListener('wheel', handleWebUserActivity, { passive: true });

    const intervalId = setInterval(() => {
      const elapsedInactiveSeconds = Math.floor((Date.now() - lastWebActivityTimestampRef.current) / 1000);
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
        // Auto-logout user on Web Portal after 10 full minutes of inactivity
        setIsSessionWarningActive(false);
        const now = new Date();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dateFormatted = `${monthNames[now.getMonth()]} ${now.getDate().toString().padStart(2, '0')}, ${now.getFullYear()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
        
        const timeoutLog: AuditLog = {
          id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          timestamp: now.toISOString(),
          dateFormatted,
          actorId: currentUser.id,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          category: 'Logout',
          details: `Session expired: 10-minute web inactivity timeout. ${currentUser.name} automatically signed out of LLC Web Portal.`,
        };

        setAuditLogs((prev) => {
          const updated = [timeoutLog, ...prev];
          triggerAutoSync(users, timeLogs, updated, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests);
          return updated;
        });

        localStorage.setItem('trackpulse_session_expired_reason', 'inactivity_10min');
        setSessionExpiredReason('inactivity_10min');
        setIsAuthenticated(false);
        localStorage.removeItem('trackpulse_auth');
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
    };
  }, [isAuthenticated, loginMode, currentUser, users, timeLogs, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests, triggerAutoSync]);

  // Live Activity Hardware & Window Focus Detection
  const [currentMouseActivity, setCurrentMouseActivity] = useState(0);
  const [currentKeyboardActivity, setCurrentKeyboardActivity] = useState(0);
  const [currentActiveApp, setCurrentActiveApp] = useState('LLC Time Tracker Desktop Software');
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

  // Randomized Idle Inactivity Engine (Random 10 to 15 minutes)
  const getRandomIdleThreshold = () => Math.floor(Math.random() * 6) + 10; // 10, 11, 12, 13, 14, or 15 mins
  const [currentIdleThresholdMinutes, setCurrentIdleThresholdMinutes] = useState<number>(() => getRandomIdleThreshold());
  const [currentInactivitySeconds, setCurrentInactivitySeconds] = useState<number>(0);
  const [sessionIdleDeductionSeconds, setSessionIdleDeductionSeconds] = useState<number>(0);
  const [isIdleAlertActive, setIsIdleAlertActive] = useState<boolean>(false);
  const dismissIdleAlert = () => setIsIdleAlertActive(false);

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
      // Keyboard use implies user is actively at the desk
      lastMouseActiveTimestampRef.current = Date.now();
    };

    const handleFocus = () => {
      setCurrentActiveApp('LLC Time Tracker Desktop Software');
      lastMouseActiveTimestampRef.current = Date.now();
      lastKeyboardActiveTimestampRef.current = Date.now();
    };
    const handleBlur = () => {
      setCurrentActiveApp('Google Chrome / External Application');
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
    };
  }, [isTracking, isPaused]);

  // Dedicated Multi-Device Real-Time Presence Heartbeat Broadcaster
  // Broadcasts active presence to Firestore user_presence collection every 5 seconds
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;

    const broadcastPresence = () => {
      const nowIso = new Date().toISOString();
      const statusValue = isPaused ? 'idle' : 'online';
      const taskDisplay = isTracking 
        ? (isPaused ? `Paused (${currentTask})` : currentTask)
        : 'Available / Ready';

      const presenceDoc: UserPresence = {
        userId: currentUser.id,
        userName: currentUser.name,
        employeeCode: currentUser.employeeCode || '',
        role: currentUser.role,
        designation: currentDesignation || currentUser.designation || 'Agent',
        department: currentUser.department || 'Operations',
        teamLeaderId: currentUser.teamLeaderId || '',
        isOnline: true,
        status: statusValue,
        isTracking: !!isTracking,
        isPaused: !!isPaused,
        elapsedSeconds: elapsedSeconds || 0,
        mouseActivity: isTracking ? currentMouseActivity : 0,
        keyboardActivity: isTracking ? currentKeyboardActivity : 0,
        currentTask: taskDisplay,
        currentApp: currentActiveApp || (loginMode === 'software' ? 'LLC Time Tracker Desktop App' : 'LLC Web Portal'),
        lastHeartbeat: nowIso,
        loginTime: nowIso,
      };

      safeSetDoc(doc(db, 'user_presence', currentUser.id), presenceDoc, { merge: true }).catch((err) => {
        console.warn('Presence broadcast warning:', err);
      });
    };

    // Immediate initial broadcast
    broadcastPresence();

    // 5-second recurring heartbeat interval
    const interval = setInterval(broadcastPresence, 5000);

    // On window unload / close, notify immediately that user went offline
    const handleUnload = () => {
      const offlineDoc = {
        isOnline: false,
        status: 'offline',
        isTracking: false,
        isPaused: false,
        lastHeartbeat: new Date().toISOString(),
      };
      safeSetDoc(doc(db, 'user_presence', currentUser.id), offlineDoc, { merge: true }).catch(() => {});
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [
    isAuthenticated,
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
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayStr = now.toISOString().split('T')[0];

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

    setSaveToast(`⚠️ Inactivity Alert: ${idleMinutes}m idle tagged & deducted from daily timesheet. Shift extended by ${idleMinutes}m. Synced to Google Sheets!`);
    setTimeout(() => setSaveToast(null), 8000);

    // Auto Sync to Google Sheets
    triggerAutoSync(users, timeLogs, updatedAudit, payrollRecords, updatedAttendance, updatedIdleLogs, leaveRequests);

    // Reset inactivity tracker refs and assign new random threshold for next cycle (10 to 15 mins)
    lastMouseActiveTimestampRef.current = Date.now();
    lastKeyboardActiveTimestampRef.current = Date.now();
    setCurrentInactivitySeconds(0);
    const nextThreshold = getRandomIdleThreshold();
    setCurrentIdleThresholdMinutes(nextThreshold);
  };

  // Simulate or manually test idle event (e.g. 10m or 15m)
  const simulateIdleEvent = (minutes?: number) => {
    const idleMins = minutes || currentIdleThresholdMinutes || getRandomIdleThreshold();
    recordIdleInactivityEvent(idleMins, `Simulated/Triggered Inactivity Check (${idleMins} mins idle)`);
  };

  // Timer Tick Engine & 2-Minute Activity Window Processing
  useEffect(() => {
    let interval: any = null;
    if (isTracking && !isPaused) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);

        const now = Date.now();
        const ACTIVITY_SUSTAIN_WINDOW_MS = 120000; // 2 minutes (120 seconds)

        const timeSinceMouse = lastMouseActiveTimestampRef.current > 0
          ? now - lastMouseActiveTimestampRef.current
          : 0;
        const timeSinceKey = lastKeyboardActiveTimestampRef.current > 0
          ? now - lastKeyboardActiveTimestampRef.current
          : 0;

        // If activity happened within the 2-minute window -> stay at 100%
        // If inactive for more than 2 minutes -> drop to 0%
        let mousePercent = 0;
        let keyPercent = 0;

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

        setCurrentMouseActivity(mousePercent);
        setCurrentKeyboardActivity(keyPercent);

        // Record history for session averaging
        mouseActivityHistoryRef.current.push(mousePercent);
        keyboardActivityHistoryRef.current.push(keyPercent);

        // Update active application duration
        setCurrentSessionApps((prev) =>
          prev.map((app) =>
            currentActiveApp.includes(app.appName.split(' ')[0])
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
  }, [isTracking, isPaused, currentActiveApp]);

  // Real-time Background Inactivity Detector: Random 10-15 minute threshold check
  useEffect(() => {
    let idleInterval: any = null;
    if (isTracking && !isPaused) {
      idleInterval = setInterval(() => {
        const now = Date.now();
        const lastActive = Math.max(lastMouseActiveTimestampRef.current || 0, lastKeyboardActiveTimestampRef.current || 0);
        const inactivitySec = lastActive > 0 ? Math.floor((now - lastActive) / 1000) : 0;
        setCurrentInactivitySeconds(inactivitySec);

        const thresholdSeconds = currentIdleThresholdMinutes * 60;
        if (inactivitySec >= thresholdSeconds && thresholdSeconds > 0) {
          recordIdleInactivityEvent(currentIdleThresholdMinutes);
        }
      }, 1000);
    } else {
      setCurrentInactivitySeconds(0);
    }
    return () => clearInterval(idleInterval);
  }, [isTracking, isPaused, currentIdleThresholdMinutes, currentUser, currentTask, dailyAttendanceLogs, idleLogs, auditLogs, payrollRecords, users, timeLogs, leaveRequests]);

  // Periodic Random Screenshot Generator Simulator (Randomized 10–15 min intervals)
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
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    lastMouseActiveTimestampRef.current = Date.now();
    lastKeyboardActiveTimestampRef.current = Date.now();
    mouseActivityHistoryRef.current = [];
    keyboardActivityHistoryRef.current = [];
    setCurrentMouseActivity(100);
    setCurrentKeyboardActivity(100);
    setCurrentInactivitySeconds(0);
    setSessionIdleDeductionSeconds(0);
    setCurrentIdleThresholdMinutes(getRandomIdleThreshold());
    setIsIdleAlertActive(false);
    setIsTracking(true);
    setIsPaused(false);
    setElapsedSeconds(0);
    const nowIso = new Date().toISOString();
    setStartTimeIso(nowIso);

    // Instant presence broadcast on tracking start
    if (currentUser) {
      safeSetDoc(doc(db, 'user_presence', currentUser.id), {
        isOnline: true,
        status: 'online',
        isTracking: true,
        isPaused: false,
        elapsedSeconds: 0,
        currentTask: currentTask,
        currentApp: currentActiveApp || (loginMode === 'software' ? 'LLC Time Tracker Desktop App' : 'LLC Web Portal'),
        mouseActivity: 100,
        keyboardActivity: 100,
        lastHeartbeat: nowIso,
      }, { merge: true }).catch(() => {});
    }
  };

  // Pause tracking
  const pauseTracking = () => {
    setIsPaused(true);
  };

  // Resume tracking
  const resumeTracking = () => {
    setIsPaused(false);
  };

  // Stop tracking and create time log
  const stopTracking = () => {
    if (!isTracking) return;

    const nowIso = new Date().toISOString();
    const startTimeStr = startTimeIso || new Date(Date.now() - elapsedSeconds * 1000).toISOString();
    const todayStr = new Date().toISOString().split('T')[0];

    const localTimeFormatted = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: currentUser.geoTimezone || 'America/New_York',
    });

    const trackedSecs = Math.max(elapsedSeconds, 1);

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
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      designation: currentDesignation,
      task: currentTask,
      startTime: startTimeStr,
      endTime: nowIso,
      durationSeconds: trackedSecs,
      status: 'completed',
      geoTimezone: currentUser.geoTimezone || 'America/Toronto',
      geoLocalStartTime: localTimeFormatted,
      mouseActivityAvg: mouseAvg,
      keyboardActivityAvg: keyAvg,
      idleSeconds: sessionIdleDeductionSeconds,
      date: todayStr,
      notes: `Logged via LLC Time Tracker desktop client (${currentDesignation})${idleNote}`,
      appsUsed: [
        { appName: currentActiveApp || 'LLC Desktop App', icon: 'Globe', durationSeconds: trackedSecs, category: 'productive' },
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
      timestamp: localTimeFormatted,
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
    safeSetDoc(doc(db, 'system_state', 'timelogs'), { data: updatedLogs }).catch((err) =>
      console.warn('TimeLogs sync err:', err)
    );
    safeSetDoc(doc(db, 'system_state', 'screenshots'), { data: updatedScreenshots }).catch((err) =>
      console.warn('Screenshots sync err:', err)
    );

    // Recalculate payroll record for this user
    const updatedPayroll = payrollRecords.map((rec) => {
      if (rec.userId === currentUser.id) {
        const additionalHours = trackedSecs / 3600;
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
        const newSecs = att.totalLoggedSeconds + trackedSecs;
        return {
          ...att,
          totalLoggedSeconds: newSecs,
          totalLoggedHours: Number((newSecs / 3600).toFixed(2)),
          lastLogoutTime: localTimeFormatted,
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
      details: `Clocked out session (${formatDuration(trackedSecs)}) on ${currentTask}. Saved to Timesheets, Database & Google Sheets.`,
    });

    setSaveToast(`✓ Saved to Database & Synced to Timesheets! (${currentUser.name} - ${formatDuration(trackedSecs)} on ${currentTask})`);
    setTimeout(() => setSaveToast(null), 7000);

    triggerAutoSync(users, updatedLogs, auditLogs, updatedPayroll, updatedAttendance, idleLogs, leaveRequests);

    // Instant presence broadcast on tracking stop
    if (currentUser) {
      safeSetDoc(doc(db, 'user_presence', currentUser.id), {
        isOnline: true,
        status: 'online',
        isTracking: false,
        isPaused: false,
        elapsedSeconds: 0,
        currentTask: 'Available / Ready',
        lastHeartbeat: new Date().toISOString(),
      }, { merge: true }).catch(() => {});
    }

    setIsTracking(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    setStartTimeIso(null);
    setSessionIdleDeductionSeconds(0);
    setCurrentInactivitySeconds(0);
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
      setSaveToast('✓ Internet Connection Restored! Live sync active.');
      triggerAutoSync(users, timeLogs, auditLogs, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests);
      return true;
    }
    try {
      await fetch('/api/health', { method: 'HEAD', cache: 'no-store' });
      setIsOffline(false);
      setOfflineSinceTimestamp(null);
      setOfflineSecondsRemaining(TOTAL_OFFLINE_LIMIT_SECONDS);
      setOfflineStatusStage('online');
      setSaveToast('✓ Internet Connection Restored! Live sync active.');
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
        setSaveToast('✓ Internet Connection Restored (Simulated)');
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
      setSaveToast('✓ Internet Connection Restored! Live sync active.');
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

  // Task selection with Confirmation Prompt when active
  const selectTaskWithPrompt = (task: TaskCategory) => {
    if (task === currentTask) return;

    if (isTracking) {
      // Prompt user confirmation
      setTaskSwitchPending({ targetTask: task });
    } else {
      setCurrentTask(task);
    }
  };

  // Confirm task switch
  const confirmTaskSwitch = () => {
    if (!taskSwitchPending) return;

    // Log current task segment if running
    if (isTracking && elapsedSeconds > 5) {
      const nowIso = new Date().toISOString();
      const newLog: TimeLog = {
        id: `log-${Date.now()}`,
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar,
        designation: currentDesignation,
        task: currentTask,
        startTime: startTimeIso || new Date(Date.now() - elapsedSeconds * 1000).toISOString(),
        endTime: nowIso,
        durationSeconds: elapsedSeconds,
        status: 'completed',
        geoTimezone: currentUser.geoTimezone || 'America/Toronto',
        geoLocalStartTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mouseActivityAvg: currentMouseActivity,
        keyboardActivityAvg: currentKeyboardActivity,
        idleSeconds: 0,
        date: new Date().toISOString().split('T')[0],
        notes: `Task switched to ${taskSwitchPending.targetTask}`,
        appsUsed: [
          { appName: currentActiveApp, icon: 'Globe', durationSeconds: elapsedSeconds, category: 'productive' },
        ],
      };
      setTimeLogs((prev) => [newLog, ...prev]);
    }

    // Switch task and reset timer
    setCurrentTask(taskSwitchPending.targetTask);
    setElapsedSeconds(0);
    setStartTimeIso(new Date().toISOString());
    setTaskSwitchPending(null);
  };

  // Cancel task switch
  const cancelTaskSwitch = () => {
    setTaskSwitchPending(null);
  };

  // CRUD User
  const addUser = (userData: Omit<User, 'id'>) => {
    const newUser: User = {
      ...userData,
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

    // Seed presence and attendance
    const today = new Date().toISOString().split('T')[0];
    const newAttendance: DailyAttendanceLog = {
      id: `att-${newUser.id}-${today}`,
      userId: newUser.id,
      userName: newUser.name,
      employeeCode: newUser.employeeCode,
      date: today,
      firstLoginTime: '08:30:00 AM',
      totalLoggedSeconds: 0,
      totalLoggedHours: 0,
      status: 'present',
      syncedToGoogleSheets: true,
    };
    const updatedAttendance = [newAttendance, ...dailyAttendanceLogs];
    setDailyAttendanceLogs(updatedAttendance);

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
      mouseActivity: 0,
      keyboardActivity: 0,
      lastHeartbeat: new Date().toISOString(),
      loginTime: new Date().toISOString(),
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
    safeSetDoc(doc(db, 'system_state', 'users'), { data: updatedUsers }).catch((err) =>
      console.warn('Users save err:', err)
    );

    setSaveToast(`✓ Saved new employee "${newUser.name}" to Database & Google Sheets!`);
    setTimeout(() => setSaveToast(null), 6000);

    triggerAutoSync(
      updatedUsers,
      timeLogs,
      updatedAudit,
      updatedPayroll,
      updatedAttendance,
      idleLogs,
      leaveRequests,
      designationTasks,
      rolePermissions
    );
  };

  const updateUser = (id: string, data: Partial<User>) => {
    const targetUser = users.find((u) => u.id === id);
    const updatedUsers = users.map((u) => (u.id === id ? { ...u, ...data } : u));
    setUsers(updatedUsers);
    localStorage.setItem('trackpulse_users', JSON.stringify(updatedUsers));
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
      .map((k) => `${k}: "${(targetUser as any)?.[k]}" → "${(data as any)[k]}"`)
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

    setSaveToast(`✓ Saved edits for "${targetUser?.name || 'Employee'}" to Database & Google Sheets!`);
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
      rolePermissions
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

    setSaveToast(`✓ Deleted employee "${targetUser?.name || id}" and synchronized Database!`);
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
      rolePermissions
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
      setSaveToast(`ⓘ A password reset request for ${targetUser.name} is already pending Super Admin approval.`);
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

    setSaveToast(`✓ Password reset request for ${targetUser.name} submitted! Super Admin (Red) has been notified for approval.`);
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

    setSaveToast(`✓ Approved password reset for ${targetReq.targetUserName}! Credentials reset to "Password123!".`);
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

    setSaveToast(`ⓘ Rejected password reset request for ${targetReq.targetUserName}.`);
    setTimeout(() => setSaveToast(null), 6000);
  };

  // Time logs CRUD
  const addTimeLog = (logData: Omit<TimeLog, 'id'>) => {
    const newLog: TimeLog = { ...logData, id: `log-${Date.now()}` };
    const updatedLogs = [newLog, ...timeLogs];
    setTimeLogs(updatedLogs);
    localStorage.setItem('trackpulse_timelogs', JSON.stringify(updatedLogs));
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

    setSaveToast(`✓ Saved time log to Database & Google Sheets!`);
    setTimeout(() => setSaveToast(null), 6000);

    triggerAutoSync(users, updatedLogs, auditLogs, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests);
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

    triggerAutoSync(users, updatedLogs, auditLogs, payrollRecords, dailyAttendanceLogs, idleLogs, leaveRequests);
  };

  const deleteTimeLog = (id: string) => {
    const targetLog = timeLogs.find((l) => l.id === id);
    const updatedLogs = timeLogs.filter((l) => l.id !== id);
    setTimeLogs(updatedLogs);
    localStorage.setItem('trackpulse_timelogs', JSON.stringify(updatedLogs));
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

    setSaveToast(`✓ Removed time log and synchronized Database!`);
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

    setSaveToast(`✓ Approved manual time request and added to Database & Google Sheets!`);
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

    setSaveToast(`✓ Rejected manual time request and synchronized Database!`);
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

    setSaveToast(`✓ Submitted manual time request to Database & Supervisors!`);
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

    setSaveToast(`✓ Approved leave request and updated Database & Google Sheets!`);
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

    setSaveToast(`✓ Rejected leave request and synchronized Database!`);
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

    setSaveToast(`✓ Submitted leave request to Database & Google Sheets!`);
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

    setSaveToast(`✓ Updated payroll status to ${status.toUpperCase()} and synced Database & Google Sheets!`);
    setTimeout(() => setSaveToast(null), 6000);

    triggerAutoSync(users, timeLogs, auditLogs, updatedPayroll, dailyAttendanceLogs, idleLogs, leaveRequests);
  };

  // Reset database to fresh Super Admin only state
  const resetDatabaseToFreshState = async () => {
    setUsers(INITIAL_USERS);
    setCurrentUser(INITIAL_USERS[0]);
    setTimeLogs([]);
    setScreenshots([]);
    setIdleLogs([]);
    setLeaveRequests([]);
    setManualTimeRequests([]);
    setPayrollRecords(INITIAL_PAYROLL);
    setDailyAttendanceLogs([]);
    setUserPresenceList(
      INITIAL_USERS.map((u) => ({
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
      }))
    );
    setAuditLogs(INITIAL_AUDIT_LOGS);

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
      setSaveToast('✓ Database reset to clean state! Super Admin account retained.');
    } catch (err) {
      console.warn('Reset database error:', err);
      setSaveToast('✓ Local database cleared! (Firestore update queued)');
    }
    setTimeout(() => setSaveToast(null), 5000);
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
    setSaveToast(`✓ Created designation "${trimmed}"!`);
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
    setSaveToast(`✓ Deleted designation "${name}"!`);
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
    setSaveToast(`✓ Added task "${trimmed}" to ${designation}!`);
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
    setSaveToast(`✓ Removed task "${taskName}" from ${designation}!`);
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
    setSaveToast(`✓ Updated permission [${permissionKey}] for "${roleKey}" and synced Database!`);
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
    setSaveToast(`✓ Updated custom permission for ${target?.name || 'user'} and synced Database!`);
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
    setSaveToast(`✓ Reset permissions for ${target?.name || 'user'} to standard designation defaults and synced Database!`);
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
    setSaveToast(`✓ Created Role / Category "${trimmedKey}" and synced to Database!`);
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
    setSaveToast(`✓ Removed custom category "${roleKey}" and synced Database!`);
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

  return (
    <AppContext.Provider
      value={{
        currentUser,
        users,
        setCurrentUser,
        isAuthenticated,
        loginMode,
        setLoginMode,
        login,
        logout,
        webSessionRemainingSeconds,
        isSessionWarningActive,
        webSessionWarningCountdown,
        refreshWebSession,
        sessionExpiredReason,
        clearSessionExpiredReason,
        isOffline,
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
        triggerGoogleSheetsSync,
        importEmployeesFromGoogleSheets,
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
