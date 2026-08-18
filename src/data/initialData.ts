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

export const TASK_LIST: TaskCategory[] = [
  'Data Entry & Market Research',
  'Email Reachout',
  'Follow-up',
  'Training',
  'Team Meeting',
  'Coaching',
  'Escalation Resolution',
  'QA Review',
  'System Operations',
  'HR & Recruitment',
  'Payroll Audit & Processing',
  'Team Supervision',
];

export const DESIGNATION_LIST: Designation[] = [
  'Sales Agent',
  'QA Specialist',
  'Trainer',
  'Team Lead',
  'Admin',
  'VA Operations Admin',
  'Customer Support',
  'Data Entry Specialist',
  'HR Specialist',
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

