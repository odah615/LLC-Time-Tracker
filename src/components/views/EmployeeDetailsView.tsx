import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  syncEmployeesToGoogleSheetsWebhook,
  generateAppsScriptCode,
} from '../../lib/googleSheetsSync';
import {
  Users,
  Search,
  Filter,
  UserCheck,
  UserPlus,
  Edit,
  Mail,
  Building2,
  Calendar,
  DollarSign,
  MapPin,
  CheckCircle2,
  XCircle,
  Shield,
  Layers,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  RefreshCw,
  Download,
  UploadCloud,
  ArrowDownCircle,
  ArrowUpCircle,
  KeyRound,
  Lock,
  Unlock,
  Send,
  Eye,
  EyeOff,
  Clock,
  Check,
  X,
  AlertCircle,
  Link2,
  Code,
  Copy,
} from 'lucide-react';
import { User, UserRole, PasswordResetRequest } from '../../types';
import { UserAvatar } from '../UserAvatar';
import { PasswordResetModal } from '../modals/PasswordResetModal';
import { maskPassword } from '../../lib/googleSheetsSync';

interface EmployeeDetailsViewProps {
  onOpenAddUserModal: () => void;
  onEditUser: (user: User) => void;
}

export const EmployeeDetailsView: React.FC<EmployeeDetailsViewProps> = ({
  onOpenAddUserModal,
  onEditUser,
}) => {
  const {
    users,
    currentUser,
    updateUser,
    resetUserPassword,
    passwordResetRequests,
    requestPasswordReset,
    approvePasswordResetRequest,
    rejectPasswordResetRequest,
    addAuditLog,
    triggerGoogleSheetsSync,
    importEmployeesFromGoogleSheets,
    googleSheetsWebhookUrl,
    setGoogleSheetsWebhookUrl,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [isPullingSheets, setIsPullingSheets] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [showWebhookBanner, setShowWebhookBanner] = useState(false);
  const [webhookInputVal, setWebhookInputVal] = useState(googleSheetsWebhookUrl || '');
  const [copiedScript, setCopiedScript] = useState(false);

  useEffect(() => {
    setWebhookInputVal(googleSheetsWebhookUrl || '');
  }, [googleSheetsWebhookUrl]);
  
  // Modals & Admin Key
  const [resetModalUser, setResetModalUser] = useState<User | null>(null);
  const [requestModalUser, setRequestModalUser] = useState<User | null>(null);
  const [requestReason, setRequestReason] = useState('Employee forgot password / needs reset to default');
  const [showAdminDecryptedPasswords, setShowAdminDecryptedPasswords] = useState(false);

  const isAdmin = currentUser.role === 'admin' || currentUser.employeeCode.toLowerCase() === 'superadmin' || currentUser.id === 'usr-superadmin-red';
  const isTeamLead = currentUser.role === 'team_lead' || currentUser.role === 'trainer' || currentUser.role === 'team_leader';

  // Pending reset requests
  const pendingRequests = useMemo(() => {
    return passwordResetRequests.filter((r) => r.status === 'pending');
  }, [passwordResetRequests]);

  const handleOpenRequestModal = (target: User) => {
    setRequestModalUser(target);
    setRequestReason('Employee forgot password / needs credential reset to default');
  };

  const handleConfirmSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestModalUser) return;
    requestPasswordReset(requestModalUser.id, requestReason);
    setRequestModalUser(null);
  };

  const handleSyncToSheets = async () => {
    const activeUrl = googleSheetsWebhookUrl || localStorage.getItem('trackpulse_sheets_webhook') || webhookInputVal.trim();
    if (!activeUrl || !activeUrl.trim().startsWith('https://')) {
      setShowWebhookBanner(true);
      setSyncStatusMsg({ type: 'error', text: '⚠️ Please paste your Google Apps Script Web App URL below first to connect your Google Sheet.' });
      setTimeout(() => setSyncStatusMsg(null), 8000);
      return;
    }
    setIsSyncingSheets(true);
    setSyncStatusMsg({ type: 'info', text: 'Pushing full employee roster directly to Google Sheets Employee_Directory & mployee_Directory...' });

    // Step 1: Immediate targeted push to Employee_Directory
    const empRes = await syncEmployeesToGoogleSheetsWebhook(activeUrl, users);

    // Step 2: Also trigger background sync for all other tables
    triggerGoogleSheetsSync(activeUrl).catch(() => {});

    setIsSyncingSheets(false);
    if (empRes && empRes.success) {
      setSyncStatusMsg({ type: 'success', text: empRes.message || `✓ Successfully populated ${users.length} employees into Google Sheets Employee_Directory & mployee_Directory!` });
    } else {
      setSyncStatusMsg({ type: 'error', text: `⚠️ ${empRes?.message || 'Sync failed. Verify Apps Script deployment is set to Anyone.'}` });
    }
    setTimeout(() => setSyncStatusMsg(null), 8000);
  };

  const handlePullFromSheets = async () => {
    const activeUrl = googleSheetsWebhookUrl || localStorage.getItem('trackpulse_sheets_webhook') || webhookInputVal.trim();
    if (!activeUrl || !activeUrl.trim().startsWith('https://')) {
      setShowWebhookBanner(true);
      setSyncStatusMsg({ type: 'error', text: '⚠️ Please paste your Google Apps Script Web App URL below first.' });
      setTimeout(() => setSyncStatusMsg(null), 8000);
      return;
    }
    setIsPullingSheets(true);
    setSyncStatusMsg({ type: 'info', text: 'Pulling and importing staff records from Google Sheets Employee_Directory...' });
    const res = await importEmployeesFromGoogleSheets(activeUrl);
    setIsPullingSheets(false);
    if (res && res.success) {
      setSyncStatusMsg({ type: 'success', text: `✓ ${res.message}` });
    } else {
      setSyncStatusMsg({ type: 'error', text: `⚠️ ${res.message}` });
    }
    setTimeout(() => setSyncStatusMsg(null), 8000);
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Filtered employees
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.designation.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesDept = departmentFilter === 'all' || u.department === departmentFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && (u.status === 'active' || !u.status)) ||
        (statusFilter === 'inactive' && u.status === 'inactive');

      return matchesSearch && matchesRole && matchesDept && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, departmentFilter, statusFilter]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
  const safePage = Math.min(currentPage, totalPages);

  const paginatedUsers = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [filteredUsers, safePage, pageSize]);

  const activeCount = users.filter((u) => u.status !== 'inactive').length;
  const inactiveCount = users.filter((u) => u.status === 'inactive').length;

  const departments = Array.from(new Set(users.map((u) => u.department || 'Operations')));

  const toggleUserStatus = (userId: string, currentStatus?: string) => {
    const newStatus = currentStatus === 'inactive' ? 'active' : 'inactive';
    updateUser(userId, { status: newStatus });
  };

  const getTeamLeaderName = (leaderId?: string) => {
    if (!leaderId) return 'None / Direct';
    const leader = users.find((u) => u.id === leaderId || u.employeeCode === leaderId);
    return leader ? leader.name : leaderId;
  };

  return (
    <div id="employee-details-view" className="space-y-6">
      {/* Top Banner / Actions Bar */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-purple-900/60 text-purple-200 border border-purple-700/60 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <UserCheck className="w-3 h-3 text-purple-400" /> HR Personnel Management
            </span>
          </div>
          <h2 className="text-2xl font-extrabold text-white">Employee Directory</h2>
          <p className="text-xs text-slate-300 mt-1">
            Centralized directory of staff credentials, password states, supervisor assignments, and roles.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
            <div className="text-center px-2 border-r border-slate-800">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Total Staff</div>
              <div className="text-lg font-bold text-white">{users.length}</div>
            </div>
            <div className="text-center px-2 border-r border-slate-800">
              <div className="text-[10px] text-emerald-400 font-semibold uppercase">Active</div>
              <div className="text-lg font-bold text-emerald-400">{activeCount}</div>
            </div>
            <div className="text-center px-2">
              <div className="text-[10px] text-rose-400 font-semibold uppercase">Inactive</div>
              <div className="text-lg font-bold text-rose-400">{inactiveCount}</div>
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowAdminDecryptedPasswords(!showAdminDecryptedPasswords)}
              className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-all shrink-0 cursor-pointer ${
                showAdminDecryptedPasswords
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700'
              }`}
              title="Admin Security Key: Reveal or hide actual stored employee passwords"
            >
              {showAdminDecryptedPasswords ? (
                <>
                  <EyeOff className="w-4 h-4 text-slate-950" />
                  <span>Lock Passwords</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                  <span>Admin Key: Reveal Passwords</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={() => setShowWebhookBanner(!showWebhookBanner)}
            className={`px-3 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-all shrink-0 cursor-pointer border ${
              googleSheetsWebhookUrl
                ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-emerald-500/40'
                : 'bg-amber-950/70 hover:bg-amber-900/70 text-amber-300 border-amber-500/70 animate-pulse'
            }`}
            title="Configure Google Apps Script Webhook URL for Employee Directory Sync"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>{googleSheetsWebhookUrl ? 'Sheets Webhook: Connected' : 'Connect Sheets Webhook'}</span>
          </button>

          <button
            disabled={isPullingSheets}
            onClick={handlePullFromSheets}
            className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all shrink-0 disabled:opacity-50 cursor-pointer"
            title="Import/Update staff accounts directly from Google Spreadsheet Employee_Directory"
          >
            <ArrowDownCircle className="w-4 h-4 text-blue-200" />
            <span>{isPullingSheets ? 'Pulling...' : 'Pull from Sheets'}</span>
          </button>

          <button
            disabled={isSyncingSheets}
            onClick={handleSyncToSheets}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all shrink-0 disabled:opacity-50 cursor-pointer"
            title="Push employee directory to Google Spreadsheet"
          >
            <ArrowUpCircle className="w-4 h-4 text-emerald-200" />
            <span>{isSyncingSheets ? 'Pushing...' : 'Push to Sheets'}</span>
          </button>

          <button
            onClick={onOpenAddUserModal}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Add Employee
          </button>
        </div>
      </div>

      {/* Webhook Configuration Dropdown Banner */}
      {showWebhookBanner && (
        <div className="bg-slate-900 border-2 border-emerald-500/40 rounded-2xl p-4 shadow-xl space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Google Sheets Webhook URL (Employee Directory Sync)</span>
            </div>
            <button
              onClick={() => setShowWebhookBanner(false)}
              className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-slate-800 cursor-pointer"
            >
              ✕ Close
            </button>
          </div>

          <div className="p-3 bg-slate-950/90 rounded-xl border border-slate-800 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-blue-400" />
                <span>Central Google Apps Script Code</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  const code = generateAppsScriptCode();
                  navigator.clipboard.writeText(code);
                  setCopiedScript(true);
                  setTimeout(() => setCopiedScript(false), 3000);
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition active:scale-95 cursor-pointer self-start sm:self-auto"
              >
                {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedScript ? '✓ Copied Script Code to Clipboard!' : 'Copy Central Apps Script Code'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              <strong className="text-amber-300">Important:</strong> Use the script directly from this website. In your Google Sheet, open <strong>Extensions → Apps Script</strong>, paste this code, click <strong>Deploy → New deployment → Web app</strong> (Execute as: <em>Me</em>, Who has access: <em>Anyone</em>), then paste the resulting <code className="text-emerald-400 font-mono">/exec</code> URL below.
            </p>
          </div>

          <p className="text-xs text-slate-300">
            Paste your deployed Google Apps Script Web App URL below (ends in <code className="text-emerald-400 bg-slate-950 px-1.5 py-0.5 rounded font-mono">/exec</code>).
            When configured, all newly created and updated employees will sync directly into your spreadsheet's <code className="text-emerald-400 bg-slate-950 px-1.5 py-0.5 rounded font-mono">Employee_Directory</code> tab.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={webhookInputVal}
              onChange={(e) => setWebhookInputVal(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-emerald-300 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={async () => {
                const val = webhookInputVal.trim();
                if (!val.startsWith('https://') || val.includes('...')) {
                  setSyncStatusMsg({ type: 'error', text: 'Please enter a valid deployed Google Apps Script Web App URL ending in /exec.' });
                  setTimeout(() => setSyncStatusMsg(null), 6000);
                  return;
                }
                setGoogleSheetsWebhookUrl(val);
                setSyncStatusMsg({ type: 'info', text: 'Google Sheets Webhook URL saved! Pushing Employee Directory now...' });
                const res = await syncEmployeesToGoogleSheetsWebhook(val, users);
                triggerGoogleSheetsSync(val).catch(() => {});
                if (res && res.success) {
                  setSyncStatusMsg({ type: 'success', text: res.message || '✓ Successfully populated all employees into Google Sheets!' });
                } else {
                  setSyncStatusMsg({ type: 'error', text: `⚠️ ${res?.message || 'Sync failed.'}` });
                }
                setTimeout(() => setSyncStatusMsg(null), 8000);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Save & Push to Sheets</span>
            </button>
          </div>
        </div>
      )}

      {/* Admin Password Reset Requests Queue Banner */}
      {isAdmin && pendingRequests.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 shadow-md space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-amber-950 text-sm flex items-center gap-2">
                  <span>Pending Password Reset Requests</span>
                  <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full font-extrabold">
                    {pendingRequests.length} Pending
                  </span>
                </h3>
                <p className="text-xs text-amber-800">
                  Team Leads requested password resets for employees. Approving will reset their password to <strong>Password123!</strong> and prompt them to set their own password upon first login.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white border border-amber-200 p-3.5 rounded-xl shadow-xs flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-sm">{req.targetUserName}</span>
                    <span className="font-mono text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                      #{req.targetUserCode}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span>Requested by:</span>
                      <strong className="text-slate-800">{req.requestedByUserName}</strong>
                      <span className="text-[10px] bg-slate-100 px-1 rounded uppercase font-semibold">{req.requestedByUserRole}</span>
                    </div>
                    {req.reason && (
                      <div className="text-[11px] text-slate-700 bg-amber-50/70 p-1.5 rounded border border-amber-100 mt-1">
                        <em>"{req.reason}"</em>
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400 mt-1">{req.dateFormatted || req.timestamp}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => approvePasswordResetRequest(req.id)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" /> Approve & Reset to Password123!
                  </button>
                  <button
                    onClick={() => rejectPasswordResetRequest(req.id)}
                    className="py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 font-semibold text-xs transition-all cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sync / Action Notification */}
      {syncStatusMsg && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm border ${
            syncStatusMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : syncStatusMsg.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          {syncStatusMsg.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
          {syncStatusMsg.type === 'error' && <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          {syncStatusMsg.type === 'info' && <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />}
          <span>{syncStatusMsg.text}</span>
        </div>
      )}

      {/* Filter & Search Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4 text-xs">
        {/* Search Input */}
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search name, email, code, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-9 pr-3 py-2 font-medium focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Role Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-semibold text-slate-600">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-none"
            >
              <option value="all">All Roles</option>
              <option value="employee">Employee</option>
              <option value="agent">Agent</option>
              <option value="team_leader">Team Lead</option>
              <option value="team_lead">Team Lead (Alt)</option>
              <option value="trainer">Trainer</option>
              <option value="hr">HR Specialist</option>
              <option value="payroll">Payroll Officer</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-semibold text-slate-600">Department:</span>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-none"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <span className="font-semibold text-slate-600">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Employee Details Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Employee Details</th>
                <th className="py-3.5 px-4">System Role</th>
                <th className="py-3.5 px-4">Designation & Dept</th>
                <th className="py-3.5 px-4">Assigned Supervisor</th>
                <th className="py-3.5 px-4">Login Password</th>
                <th className="py-3.5 px-4">Join Date</th>
                <th className="py-3.5 px-4">GEO Location</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No employee records match the selected search/filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((usr) => {
                  const isActive = usr.status !== 'inactive';
                  const userPassword = usr.password || 'Password123!';
                  const hasPendingReq = pendingRequests.some((r) => r.targetUserId === usr.id);

                  return (
                    <tr key={usr.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={usr.name}
                            role={usr.role}
                            size="md"
                          />
                          <div>
                            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                              <span>{usr.name}</span>
                              {usr.employeeCode.toLowerCase() === 'superadmin' && (
                                <span className="bg-purple-100 text-purple-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-purple-300">
                                  SUPER ADMIN
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2">
                              <span>{usr.email}</span>
                              <span className="font-mono font-semibold text-purple-600">
                                #{usr.employeeCode}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* System Role */}
                      <td className="py-3.5 px-4">
                        <span className="bg-purple-50 border border-purple-200 text-purple-800 px-2 py-0.5 rounded font-bold uppercase text-[10px]">
                          {usr.role === 'admin' ? 'Admin' : usr.role === 'team_leader' || usr.role === 'team_lead' ? 'Team Leader' : usr.role === 'trainer' ? 'Trainer' : usr.role === 'qa' ? 'QA Specialist' : usr.role === 'writer' ? 'Writer' : usr.role === 'hr' ? 'HR' : usr.role === 'payroll' ? 'Payroll Officer' : 'Agent'}
                        </span>
                      </td>

                      {/* Designation */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{usr.designation}</div>
                        <div className="text-[10px] text-slate-500">{usr.department || 'Operations'}</div>
                      </td>

                      {/* Assigned Supervisor */}
                      <td className="py-3.5 px-4 font-semibold text-slate-700">
                        {getTeamLeaderName(usr.teamLeaderId)}
                      </td>

                      {/* Password Column */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {isAdmin ? (
                            showAdminDecryptedPasswords ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-xs bg-emerald-50 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded flex items-center gap-1 shadow-xs">
                                  <Unlock className="w-3 h-3 text-emerald-600" />
                                  {userPassword}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 font-mono text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs w-fit">
                                <Lock className="w-3 h-3 text-slate-400" />
                                <span>{maskPassword(userPassword)}</span>
                              </div>
                            )
                          ) : (
                            <div className="flex items-center gap-1.5 font-mono text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs w-fit">
                              <Lock className="w-3 h-3 text-slate-400" />
                              <span>{maskPassword(userPassword)}</span>
                            </div>
                          )}

                          {usr.mustChangePassword && (
                            <div className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded w-fit">
                              Pending 1st Login Change
                            </div>
                          )}
                          {hasPendingReq && (
                            <div className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded w-fit flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 text-amber-600" />
                              Reset Requested
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Join Date */}
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-600">
                        {usr.joinDate || '2024-01-01'}
                      </td>

                      {/* GEO Location */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 text-slate-700 font-medium">
                          <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>{usr.geoCity}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{usr.geoTimezone}</div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full text-[10px] font-bold">
                            <XCircle className="w-3 h-3 text-rose-600" /> Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Admin Direct Reset */}
                          {isAdmin && (
                            <button
                              onClick={() => setResetModalUser(usr)}
                              className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-semibold transition-all cursor-pointer"
                              title="Reset Password (Admin)"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Team Lead Request Reset (No 1-click reset) */}
                          {!isAdmin && (
                            <button
                              onClick={() => handleOpenRequestModal(usr)}
                              className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-semibold transition-all flex items-center gap-1 cursor-pointer"
                              title="Request Password Reset from Super Admin (Red)"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => onEditUser(usr)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-all cursor-pointer"
                            title="Edit Employee Details"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => toggleUserStatus(usr.id, usr.status)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all shadow-sm cursor-pointer ${
                              isActive
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {isActive ? 'Deactivate' : 'Activate'}
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

        {/* Pagination Footer */}
        {filteredUsers.length > 0 && (
          <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
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
                Showing {Math.min((safePage - 1) * pageSize + 1, filteredUsers.length)} to{' '}
                {Math.min(safePage * pageSize, filteredUsers.length)} of {filteredUsers.length} entries
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-semibold mr-1">
                Page {safePage} of {totalPages}
              </span>
              <button
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Team Lead Request Password Reset Modal */}
      {requestModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 text-slate-800 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-bold">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Request Password Reset</h3>
                  <p className="text-xs text-slate-500">Notify Super Admin (Red) for Approval</p>
                </div>
              </div>
              <button
                onClick={() => setRequestModalUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
              <UserAvatar name={requestModalUser.name} role={requestModalUser.role} size="md" />
              <div>
                <div className="font-bold text-slate-900 text-sm">{requestModalUser.name}</div>
                <div className="text-xs text-slate-500">#{requestModalUser.employeeCode} &bull; {requestModalUser.designation}</div>
              </div>
            </div>

            <form onSubmit={handleConfirmSubmitRequest} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Password Reset
                </label>
                <textarea
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="e.g. Employee forgot password, locked out of terminal, or requested credential reset..."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  required
                />
              </div>

              <div className="p-2.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-[11px] text-indigo-900 leading-relaxed">
                Super Admin (Red) will review this request. Once approved, the employee's password will be reset to default <strong>Password123!</strong> and they will be prompted to create a new unique password upon their next login.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRequestModalUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" /> Submit Request to Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Password Reset Modal */}
      {resetModalUser && (
        <PasswordResetModal
          isOpen={!!resetModalUser}
          onClose={() => setResetModalUser(null)}
          targetUser={resetModalUser}
          onResetPassword={resetUserPassword}
        />
      )}
    </div>
  );
};
