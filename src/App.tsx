import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { LoginView } from './components/views/LoginView';
import { DesktopTrackerWidget } from './components/DesktopTrackerWidget';
import { AgentDashboardView } from './components/views/AgentDashboardView';
import { TeamLeadDashboardView } from './components/views/TeamLeadDashboardView';
import { AdminDashboardView } from './components/views/AdminDashboardView';
import { HrDashboardView } from './components/views/HrDashboardView';
import { EmployeeDetailsView } from './components/views/EmployeeDetailsView';
import { TrainerDashboardView } from './components/views/TrainerDashboardView';
import { TimesheetView } from './components/views/TimesheetView';
import { ActivityLogsView } from './components/views/ActivityLogsView';
import { PayrollView } from './components/views/PayrollView';
import { LeaveRequestsView } from './components/views/LeaveRequestsView';
import { AuditLogsView } from './components/views/AuditLogsView';
import { TaskSwitchModal } from './components/modals/TaskSwitchModal';
import { InactivityWarningModal } from './components/modals/InactivityWarningModal';
import { ManualTimeModal } from './components/modals/ManualTimeModal';
import { LeaveModal } from './components/modals/LeaveModal';
import { EmployeeCrudModal } from './components/modals/EmployeeCrudModal';
import { OfflineBanner } from './components/OfflineBanner';
import { User } from './types';
import { Shield, Clock, Heart, Globe, Laptop, LogOut, Maximize2, Sparkles, ExternalLink, RefreshCw, CheckCircle2, ArrowUpCircle } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { currentUser, isAuthenticated, isDesktopDockView, setIsDesktopDockView, logout, saveToast, setSaveToast } = useApp();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [showUpdateSuccess, setShowUpdateSuccess] = useState(false);

  const handleDesktopSyncUpdate = () => {
    setIsCheckingUpdate(true);
    setTimeout(() => {
      setIsCheckingUpdate(false);
      setShowUpdateSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }, 800);
  };

  // Ensure any account (Admin, Team Lead, Trainer, VA Admin, HR, Agent, Payroll) defaults into Dashboard on login
  useEffect(() => {
    if (isAuthenticated) {
      setActiveTab('dashboard');
    }
  }, [currentUser?.id, isAuthenticated]);

  // Modals state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isEmployeeCrudOpen, setIsEmployeeCrudOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const currentWebUrl = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin.replace('ais-dev-', 'ais-pre-')
    : 'https://ais-pre-liozj4uigw5okmp2bspkg2-388952805706.asia-southeast1.run.app';

  // If not authenticated, render Login Page
  if (!isAuthenticated) {
    return <LoginView />;
  }

  // If in Desktop Software App Mode (Desktop Dock)
  if (isDesktopDockView) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative font-sans">
        {/* Offline Grace Period Alert Banner */}
        <div className="w-full max-w-2xl mb-4">
          <OfflineBanner />
        </div>

        {/* Top Software Bar */}
        <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center font-bold text-white shadow-md">
              <Laptop className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-white">LLC Time Tracker Desktop Software</span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                  ACTIVE SHIFT
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Logged in as <strong className="text-white">{currentUser.name}</strong> ({currentUser.employeeCode}) • {currentUser.designation}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDesktopSyncUpdate}
              disabled={isCheckingUpdate}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
              title="Check for system updates and sync live cloud changes"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
              <span>{isCheckingUpdate ? 'Syncing...' : showUpdateSuccess ? 'Up to Date!' : 'Check Updates'}</span>
            </button>
            <a
              href={`${currentWebUrl}${currentWebUrl.includes('?') ? '&' : '?'}user=${encodeURIComponent(currentUser.employeeCode || currentUser.id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-600/20 transition-all"
              title="Open Web Portal in new browser window"
            >
              <Globe className="w-4 h-4" />
              <span>Open Web App Portal in Browser</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={logout}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-red-950 hover:text-red-300 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
              title="Sign Out of Software"
            >
              <LogOut className="w-4 h-4 text-red-400" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Live Over-The-Air Update Banner */}
        <div className="max-w-2xl w-full mb-4 bg-blue-950/40 border border-blue-800/40 rounded-xl px-3.5 py-2 flex items-center justify-between text-xs text-blue-200">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              <strong>Zero-Download Updates:</strong> Live cloud sync is active. System updates, staff logins, and features refresh automatically.
            </span>
          </div>
          <button
            onClick={handleDesktopSyncUpdate}
            className="text-[11px] underline font-bold text-blue-300 hover:text-white shrink-0 ml-2"
          >
            Refresh Now
          </button>
        </div>

        {/* Desktop Tracker Widget Container */}
        <div className="max-w-3xl w-full">
          <DesktopTrackerWidget isFullPage={true} />
        </div>

        {/* Essential Modals: Inactivity Warnings & Task Switch confirmations for Desktop mode */}
        <InactivityWarningModal />
        <TaskSwitchModal />
      </div>
    );
  }

  const handleOpenAddUser = () => {
    setEditingUser(null);
    setIsEmployeeCrudOpen(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setIsEmployeeCrudOpen(true);
  };

  const renderDashboardByRole = () => {
    switch (currentUser.role) {
      case 'admin':
      case 'va_admin':
        return (
          <AdminDashboardView
            onOpenAddUserModal={handleOpenAddUser}
            onEditUser={handleEditUser}
          />
        );
      case 'team_lead':
        return <TeamLeadDashboardView />;
      case 'hr':
        return (
          <HrDashboardView
            onOpenAddUserModal={handleOpenAddUser}
            onEditUser={handleEditUser}
            onNavigateToEmployees={() => setActiveTab('employees')}
            onNavigateToRequests={() => setActiveTab('requests')}
          />
        );
      case 'trainer':
        return (
          <TrainerDashboardView
            onOpenAddUserModal={handleOpenAddUser}
            onEditUser={handleEditUser}
          />
        );
      case 'payroll':
        return <PayrollView />;
      case 'agent':
      default:
        return (
          <AgentDashboardView
            onOpenManualModal={() => setIsManualModalOpen(true)}
            onOpenLeaveModal={() => setIsLeaveModalOpen(true)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex flex-col selection:bg-blue-500 selection:text-white">
      {/* Save Notification Toast */}
      {saveToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-emerald-600 text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400/50">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-200 animate-ping" />
            <span>{saveToast}</span>
            <button
              onClick={() => setSaveToast(null)}
              className="ml-2 hover:bg-emerald-700 p-1 rounded-lg text-emerald-100 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Offline Grace Period Alert Banner */}
      <OfflineBanner />

      {/* Header with Navigation & World Clock Bar */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Container Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {activeTab === 'dashboard' && renderDashboardByRole()}
        {activeTab === 'timesheet' && (
          <TimesheetView onOpenManualModal={() => setIsManualModalOpen(true)} isPersonalOnly={false} />
        )}
        {activeTab === 'my_timesheet' && (
          <TimesheetView onOpenManualModal={() => setIsManualModalOpen(true)} isPersonalOnly={true} />
        )}
        {activeTab === 'activity' && (
          currentUser.role === 'admin' ? (
            <ActivityLogsView />
          ) : (
            renderDashboardByRole()
          )
        )}
        {activeTab === 'employees' && (
          <EmployeeDetailsView
            onOpenAddUserModal={handleOpenAddUser}
            onEditUser={handleEditUser}
          />
        )}
        {activeTab === 'requests' && (
          <LeaveRequestsView
            onOpenLeaveModal={() => setIsLeaveModalOpen(true)}
          />
        )}
        {activeTab === 'payroll' && <PayrollView />}
        {activeTab === 'audit_sheets' && <AuditLogsView />}
      </main>

      {/* Confirmation & Entry Modals */}
      <TaskSwitchModal />
      <InactivityWarningModal />
      <ManualTimeModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
      />
      <LeaveModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
      />
      <EmployeeCrudModal
        isOpen={isEmployeeCrudOpen}
        onClose={() => {
          setIsEmployeeCrudOpen(false);
          setEditingUser(null);
        }}
        editingUser={editingUser}
      />

      {/* Modern Clean Footer */}
      <footer className="border-t border-slate-200 bg-white py-5 px-4 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-slate-800">LLC Time Tracker</span>
            <span className="text-slate-400">• Agent Time & Activity System</span>
          </div>

          <div className="flex items-center gap-4 text-slate-500">
            <span>© {new Date().getFullYear()} LLC Time Tracker. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
