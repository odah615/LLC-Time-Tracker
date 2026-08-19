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
  AuditLog,
} from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'usr-superadmin-red',
    name: 'Admin',
    email: 'admin@llc.com',
    role: 'admin',
    designation: 'Admin',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=250',
    monthlyRate: 60000,
    hourlyRate: 375.00,
    geoTimezone: 'Asia/Manila',
    geoCity: 'Manila, Philippines',
    teamId: 'management',
    status: 'active',
    joinDate: '2024-01-01',
    employeeCode: 'SuperAdmin',
    department: 'Executive Management',
    password: 'AdminpassW0rd123!',
    mustChangePassword: false,
    screenshotMonitored: false,
    activityMonitored: false,
  },
];

export const DEFAULT_DESIGNATION_TASKS: Record<string, string[]> = {
  'Agent': [
    'Data Entry & Market Research',
    'Email Reachout',
    'Follow-up',
    'Training',
    'Team Meeting',
    'Coaching',
  ],
  'Team Leader': [
    'Team Supervision',
    'Team Meeting',
    'Training',
    'Coaching',
    'QA Review',
    'On Shift',
  ],
  'Trainer': [
    'Training',
    'Coaching',
    'Team Meeting',
    'QA Review',
    'On Shift',
  ],
  'Admin': [
    'System Ops Review',
    'On Shift',
  ],
  'QA Specialist': [
    'QA Email Audit',
    'Other QA Reviews',
    'QA Coaching',
  ],
  'Writer': [
    'Content Writing',
    'Team Meeting',
    'On Shift',
  ],
  'HR': [
    'Team Meeting',
    'HR & Recruitment',
    'On Shift',
  ],
  'Payroll Officer': [
    'Payroll task',
    'On Shift',
    'Team Meeting',
  ],
};

export const DEFAULT_ROLE_PERMISSIONS: Record<string, import('../types').RolePermissions> = {
  'admin': {
    canEditEmployees: true,
    canAssignTeamLeader: true,
    canViewActivityLogs: true,
    canViewScreenshots: true,
    canViewTimesheets: true,
    canViewPayroll: true,
    canManageTasks: true,
    canManageRoles: true,
    canSyncSheets: true,
  },
  'trainer': {
    canEditEmployees: true, // Requested: Trainer can do CRUD operations
    canAssignTeamLeader: true, // Requested: Trainer can change Team Leader assignment
    canViewActivityLogs: true, // Requested: Trainer can view activity monitors
    canViewScreenshots: true, // Requested: Trainer can view screenshots
    canViewTimesheets: true,
    canViewPayroll: false,
    canManageTasks: true,
    canManageRoles: false,
    canSyncSheets: false,
  },
  'team_lead': {
    canEditEmployees: false,
    canAssignTeamLeader: true,
    canViewActivityLogs: true,
    canViewScreenshots: true,
    canViewTimesheets: true,
    canViewPayroll: false,
    canManageTasks: false,
    canManageRoles: false,
    canSyncSheets: false,
  },
  'qa': {
    canEditEmployees: false,
    canAssignTeamLeader: false,
    canViewActivityLogs: true,
    canViewScreenshots: true,
    canViewTimesheets: true,
    canViewPayroll: false,
    canManageTasks: false,
    canManageRoles: false,
    canSyncSheets: false,
  },
  'writer': {
    canEditEmployees: false,
    canAssignTeamLeader: false,
    canViewActivityLogs: false,
    canViewScreenshots: false,
    canViewTimesheets: false,
    canViewPayroll: false,
    canManageTasks: false,
    canManageRoles: false,
    canSyncSheets: false,
  },
  'hr': {
    canEditEmployees: true,
    canAssignTeamLeader: false,
    canViewActivityLogs: false,
    canViewScreenshots: false,
    canViewTimesheets: true,
    canViewPayroll: false,
    canManageTasks: false,
    canManageRoles: false,
    canSyncSheets: false,
  },
  'payroll': {
    canEditEmployees: false,
    canAssignTeamLeader: false,
    canViewActivityLogs: false,
    canViewScreenshots: false,
    canViewTimesheets: true,
    canViewPayroll: true,
    canManageTasks: false,
    canManageRoles: false,
    canSyncSheets: false,
  },
  'agent': {
    canEditEmployees: false,
    canAssignTeamLeader: false,
    canViewActivityLogs: false,
    canViewScreenshots: false,
    canViewTimesheets: false,
    canViewPayroll: false,
    canManageTasks: false,
    canManageRoles: false,
    canSyncSheets: false,
  },
};

export const TASK_LIST: TaskCategory[] = [
  'Data Entry & Market Research',
  'Email Reachout',
  'Follow-up',
  'Training',
  'Team Meeting',
  'Coaching',
  'Team Supervision',
  'QA Review',
  'QA Email Audit',
  'Other QA Reviews',
  'QA Coaching',
  'Content Writing',
  'HR & Recruitment',
  'Payroll task',
  'System Ops Review',
  'On Shift',
];

export const DESIGNATION_LIST: Designation[] = [
  'Agent',
  'Team Leader',
  'Trainer',
  'Admin',
  'QA Specialist',
  'Writer',
  'HR',
  'Payroll Officer',
];

export const INITIAL_WORLD_CLOCKS: WorldClockItem[] = [
  {
    id: 'wc-1',
    label: 'Agent GEO',
    timezone: 'America/Toronto',
    city: 'Toronto, Canada',
    countryCode: 'CA',
    isAgentGeo: true,
  },
  {
    id: 'wc-2',
    label: 'Manila Time (PHT)',
    timezone: 'Asia/Manila',
    city: 'Manila, Philippines',
    countryCode: 'PH',
  },
];

export const INITIAL_TIME_LOGS: TimeLog[] = [];

export const INITIAL_SCREENSHOTS: ScreenshotLog[] = [];

export const INITIAL_IDLE_LOGS: IdleLog[] = [];

export const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = [];

export const INITIAL_MANUAL_TIME_REQUESTS: ManualTimeRequest[] = [];

export const INITIAL_PAYROLL: PayrollRecord[] = [
  {
    id: 'pay-0001',
    userId: 'usr-superadmin-red',
    userName: 'Red',
    employeeCode: 'SuperAdmin',
    designation: 'Admin',
    hourlyRate: 375.0,
    totalTrackedHours: 0,
    regularHours: 0,
    overtimeHours: 0,
    lateDeductions: 0,
    grossPay: 0,
    netPay: 0,
    payPeriod: 'Aug 01 - Aug 15, 2026',
    status: 'pending',
  },
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'audit-001',
    timestamp: new Date().toISOString(),
    dateFormatted: new Date().toLocaleString(),
    actorId: 'usr-superadmin-red',
    actorName: 'Red',
    actorRole: 'admin',
    category: 'System Initialize',
    targetEmployeeId: 'usr-superadmin-red',
    targetEmployeeName: 'Red',
    fromValue: 'Fresh Workspace',
    toValue: 'Active',
    details: 'Initialized clean production database with Super Admin root account (Red / SuperAdmin). Ready for team onboarding.',
  },
];

