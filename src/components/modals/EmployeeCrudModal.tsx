import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { User, UserRole, Designation } from '../../types';
import { DESIGNATION_LIST } from '../../data/initialData';
import { Users, X, Check, Lock, KeyRound, Eye, EyeOff, RefreshCw, Calendar } from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';

interface EmployeeCrudModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingUser: User | null;
}

export const EmployeeCrudModal: React.FC<EmployeeCrudModalProps> = ({
  isOpen,
  onClose,
  editingUser,
}) => {
  const { users, addUser, updateUser, currentUser, addAuditLog } = useApp();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('agent');
  const [designation, setDesignation] = useState<Designation>('Sales Agent');
  const [monthlyRate, setMonthlyRate] = useState(23000);
  const [geoCity, setGeoCity] = useState('Manila, Philippines');
  const [geoTimezone, setGeoTimezone] = useState('Asia/Manila');
  const [employeeCode, setEmployeeCode] = useState('0002');
  const [joinDate, setJoinDate] = useState(new Date().toISOString().split('T')[0]);
  const [teamLeaderId, setTeamLeaderId] = useState<string>('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [avatar, setAvatar] = useState(
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'
  );

  // List available team leaders / trainers
  const teamLeaders = users.filter((u) => !u.isSecretBackup && (u.role === 'team_lead' || u.role === 'trainer' || u.role === 'admin' || u.role === 'va_admin'));

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let pass = 'LLC-';
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
  };

  useEffect(() => {
    if (editingUser) {
      setName(editingUser.name);
      setEmail(editingUser.email);
      setPassword(editingUser.password || 'Password123!');
      setRole(editingUser.role);
      setDesignation(editingUser.designation);
      setMonthlyRate(editingUser.monthlyRate || (editingUser.role === 'agent' ? 23000 : 27000));
      setGeoCity(editingUser.geoCity);
      setGeoTimezone(editingUser.geoTimezone);
      setEmployeeCode(editingUser.employeeCode);
      setJoinDate(editingUser.joinDate || new Date().toISOString().split('T')[0]);
      setTeamLeaderId(editingUser.teamLeaderId || '');
      setStatus(editingUser.status || 'active');
      setAvatar(editingUser.avatar);
    } else {
      setName('');
      setEmail('');
      setPassword('Password123!');
      setRole('agent');
      setDesignation('Sales Agent');
      setMonthlyRate(23000);
      setGeoCity('Manila, Philippines');
      setGeoTimezone('Asia/Manila');
      setEmployeeCode(`00${Math.floor(10 + Math.random() * 90)}`);
      setJoinDate(new Date().toISOString().split('T')[0]);
      setTeamLeaderId(teamLeaders[0]?.id || '');
      setStatus('active');
      setAvatar(
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'
      );
    }
  }, [editingUser, isOpen]);

  const isEditingSuperAdmin = editingUser
    ? editingUser.employeeCode?.toLowerCase() === 'superadmin' ||
      editingUser.id === 'usr-superadmin-red' ||
      editingUser.id === 'usr-superadmin-root' ||
      editingUser.email === 'admin@llc.com' ||
      (editingUser.role === 'admin' && editingUser.employeeCode === 'SuperAdmin')
    : false;

  const [showConfirm, setShowConfirm] = useState(false);

  if (!isOpen) return null;

  const executeSave = () => {
    const mRate = Number(monthlyRate) || (isEditingSuperAdmin ? 60000 : 23000);
    const calcHourly = mRate / 160;
    const finalJoinDate = joinDate.trim() || new Date().toISOString().split('T')[0];
    const finalRole = isEditingSuperAdmin ? 'admin' : role;
    const finalDesignation = isEditingSuperAdmin ? 'Admin' : designation;
    const finalEmployeeCode = isEditingSuperAdmin ? 'SuperAdmin' : employeeCode;

    if (editingUser) {
      updateUser(editingUser.id, {
        name,
        email,
        password: password.trim() || editingUser.password || 'Password123!',
        role: finalRole,
        designation: finalDesignation,
        monthlyRate: mRate,
        hourlyRate: Number(calcHourly.toFixed(2)),
        geoCity,
        geoTimezone,
        employeeCode: finalEmployeeCode,
        joinDate: finalJoinDate,
        teamLeaderId: isEditingSuperAdmin ? undefined : teamLeaderId || undefined,
        status,
        avatar,
      });
      addAuditLog({
        actorId: currentUser.id,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        category: 'Employee Updated',
        targetEmployeeId: editingUser.id,
        targetEmployeeName: name,
        fromValue: editingUser.role,
        toValue: finalRole,
        details: `Updated employee record for ${name} (${finalEmployeeCode}). Hired: ${finalJoinDate}. Credentials/role synchronized.`,
      });
    } else {
      const initialPass = password.trim() || 'Password123!';
      addUser({
        name,
        email,
        password: initialPass,
        mustChangePassword: true,
        role: finalRole,
        designation: finalDesignation,
        monthlyRate: mRate,
        hourlyRate: Number(calcHourly.toFixed(2)),
        geoCity,
        geoTimezone,
        employeeCode: finalEmployeeCode,
        teamLeaderId: teamLeaderId || undefined,
        status,
        avatar,
        joinDate: finalJoinDate,
        screenshotMonitored: false,
        activityMonitored: false,
        department: finalDesignation.includes('Sales')
          ? 'Sales & Outreach'
          : finalDesignation.includes('QA')
          ? 'Quality Assurance'
          : finalDesignation.includes('HR')
          ? 'Human Resources'
          : finalDesignation.includes('Payroll')
          ? 'Finance & Payroll'
          : 'Operations',
      });
      addAuditLog({
        actorId: currentUser.id,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        category: 'Employee Added',
        targetEmployeeName: name,
        fromValue: 'Unregistered',
        toValue: `${role.toUpperCase()} (${designation})`,
        details: `Registered new employee ${name} (${employeeCode}) as ${designation}. Date Hired: ${finalJoinDate}. Assigned initial credentials.`,
      });
    }

    setShowConfirm(false);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    setShowConfirm(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-slate-800">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            {editingUser ? 'Edit Employee Details' : 'Add New Employee / Team Member'}
          </h3>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Alex Rivera"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 font-medium"
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Email Address (Login)</label>
              <input
                type="email"
                placeholder="user@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 font-medium"
                required
              />
            </div>
          </div>

          {/* Account Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-slate-700 font-semibold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-600" /> Account Login Password
              </label>
              <button
                type="button"
                onClick={generateRandomPassword}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Auto-Generate
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Assign login password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 pr-10 focus:ring-2 focus:ring-blue-500 font-mono font-medium"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              This password will be used by the employee to log into the Web Portal and Desktop Software.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1 flex items-center justify-between">
                <span>System Role</span>
                {isEditingSuperAdmin && (
                  <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Locked
                  </span>
                )}
              </label>
              <select
                value={isEditingSuperAdmin ? 'admin' : role}
                disabled={isEditingSuperAdmin}
                onChange={(e) => {
                  const newRole = e.target.value as UserRole;
                  setRole(newRole);
                  if (newRole === 'agent') setDesignation('Sales Agent');
                  else if (newRole === 'team_lead') setDesignation('Team Lead');
                  else if (newRole === 'trainer') setDesignation('Trainer');
                  else if (newRole === 'va_admin') setDesignation('VA Operations Admin');
                  else if (newRole === 'admin') setDesignation('Admin');
                }}
                className={`w-full border rounded-xl p-2.5 font-medium transition-all ${
                  isEditingSuperAdmin
                    ? 'bg-slate-100/90 border-slate-300 text-slate-500 cursor-not-allowed select-none shadow-none font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-2 focus:ring-blue-500'
                }`}
              >
                <option value="agent">Agent</option>
                <option value="team_lead">Team Leader</option>
                <option value="trainer">Trainer</option>
                <option value="va_admin">VA Admin</option>
                <option value="admin">Main Admin</option>
              </select>
              {isEditingSuperAdmin && (
                <p className="text-[10px] text-slate-400 mt-1 italic">
                  SuperAdmin role cannot be changed.
                </p>
              )}
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1 flex items-center justify-between">
                <span>Designation</span>
                {isEditingSuperAdmin && (
                  <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Locked
                  </span>
                )}
              </label>
              <select
                value={isEditingSuperAdmin ? 'Admin' : designation}
                disabled={isEditingSuperAdmin}
                onChange={(e) => setDesignation(e.target.value as Designation)}
                className={`w-full border rounded-xl p-2.5 font-medium transition-all ${
                  isEditingSuperAdmin
                    ? 'bg-slate-100/90 border-slate-300 text-slate-500 cursor-not-allowed select-none shadow-none font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-2 focus:ring-blue-500'
                }`}
              >
                {DESIGNATION_LIST.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {isEditingSuperAdmin && (
                <p className="text-[10px] text-slate-400 mt-1 italic">
                  SuperAdmin designation cannot be changed.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Assigned Team Leader / Supervisor</label>
              <select
                value={isEditingSuperAdmin ? '' : teamLeaderId}
                disabled={isEditingSuperAdmin}
                onChange={(e) => setTeamLeaderId(e.target.value)}
                className={`w-full border rounded-xl p-2.5 font-medium transition-all ${
                  isEditingSuperAdmin
                    ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed select-none'
                    : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-2 focus:ring-blue-500'
                }`}
              >
                <option value="">{isEditingSuperAdmin ? 'Top-Level Executive (No Supervisor)' : 'None / Independent'}</option>
                {!isEditingSuperAdmin &&
                  teamLeaders.map((tl) => (
                    <option key={tl.id} value={tl.id}>
                      {tl.name} ({tl.designation})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Employment Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Monthly Rate (₱)</label>
              <input
                type="number"
                step="500"
                value={monthlyRate}
                onChange={(e) => setMonthlyRate(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 font-mono font-medium"
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Employee Code</label>
              <input
                type="text"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 font-mono font-medium"
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-blue-600" /> Date Hired
              </label>
              <input
                type="date"
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 font-mono font-medium"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">GEO City & Country</label>
              <input
                type="text"
                placeholder="e.g. Manila, Philippines"
                value={geoCity}
                onChange={(e) => setGeoCity(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 font-medium"
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">GEO Timezone String</label>
              <input
                type="text"
                placeholder="e.g. Asia/Manila"
                value={geoTimezone}
                onChange={(e) => setGeoTimezone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 font-mono font-medium"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-4 h-4" /> {editingUser ? 'Save Changes' : 'Create Employee'}
            </button>
          </div>
        </form>

        <ConfirmationModal
          isOpen={showConfirm}
          onClose={() => setShowConfirm(false)}
          onConfirm={executeSave}
          title={editingUser ? 'Confirm Employee Information Update' : 'Confirm New Employee Creation'}
          description={
            editingUser
              ? `Are you sure you want to save modifications to the employee profile for ${name}?`
              : `Are you sure you want to register ${name} (${role.toUpperCase()}) into the organization system?`
          }
          employeeName={name}
          employeeCode={employeeCode}
          fromValue={editingUser ? editingUser.role.toUpperCase() : 'New Account'}
          toValue={role.toUpperCase()}
          confirmText={editingUser ? 'Yes, Save Changes' : 'Yes, Create Employee'}
          variant="info"
        />
      </div>
    </div>
  );
};
