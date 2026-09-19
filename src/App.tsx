import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { OverviewDashboard } from './components/dashboard/OverviewDashboard';
import { ExpenseList } from './components/expenses/ExpenseList';
import { ExpenseModal } from './components/expenses/ExpenseModal';
import { ExpenseDetailModal } from './components/expenses/ExpenseDetailModal';
import { ApprovalWorkflow } from './components/approvals/ApprovalWorkflow';
import { CustodyManagement } from './components/custody/CustodyManagement';
import { ProjectsView } from './components/projects/ProjectsView';
import { SupervisorsView } from './components/supervisors/SupervisorsView';
import { ReportsView } from './components/reports/ReportsView';
import { SupportCenter } from './components/support/SupportCenter';
import { SettingsView } from './components/settings/SettingsView';
import { DiagnosticLogsView } from './components/diagnostics/DiagnosticLogsView';
import { NotificationsModal } from './components/common/NotificationsModal';
import { PrintVoucher } from './components/common/PrintVoucher';
import { ConfirmModal } from './components/common/ConfirmModal';
import { AttachmentPreviewModal } from './components/common/AttachmentPreviewModal';
import { OperationStatusBanner } from './components/common/OperationStatusBanner';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { LoginPage } from './components/auth/LoginPage';
import { ConcurrentSessionModal } from './components/auth/ConcurrentSessionModal';
import { DatabaseBootLoadingScreen } from './components/common/DatabaseBootLoadingScreen';
import { WifiOff, ShieldAlert } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    currentUser,
    currentUserRole,
    isCurrentUserAdmin,
    isScreenAllowed,
    isOnline,
    pendingSyncCount,
    triggerCloudSync,
    isSyncing,
    setIsNotificationsOpen
  } = useApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Global secret shortcut and URL hash listener for diagnostic screen (Available for Manager only)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Shift + D or Cmd + Shift + D (Manager only)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        if (isCurrentUserAdmin) {
          setCurrentView(currentView === 'diagnostics' ? 'dashboard' : 'diagnostics');
        }
      }
    };

    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#diagnostics' || hash === '#sync-logs' || hash === '#logs') {
        if (isCurrentUserAdmin) {
          setCurrentView('diagnostics');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [currentView, setCurrentView, isCurrentUserAdmin]);

  const renderActiveView = () => {
    // Dynamic Role-based protection: check if current screen is allowed for this role
    if (!isScreenAllowed(currentView)) {
      const allowedScreens = currentUserRole?.permissions.allowedScreens || ['expenses'];
      const defaultScreen = allowedScreens[0] || 'expenses';

      return (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm max-w-md mx-auto mt-12 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800/80">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              غير مصرح بالدخول لهذه الشاشة
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              وفقاً لمصفوفة الصلاحيات والأدوار المحددة لدورك (<span className="font-bold text-emerald-600 dark:text-emerald-400">{currentUserRole?.name || currentUser.role}</span>)، تم حجب هذه الشاشة. يمكن لمدير النظام أو المشرفين المخولين تعديل الشاشات المسموحة من لوحة إعدادات الصلاحيات.
            </p>
          </div>
          <button
            onClick={() => setCurrentView(defaultScreen)}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
          >
            الانتقال إلى الشاشات المصرح بها
          </button>
        </div>
      );
    }

    switch (currentView) {
      case 'dashboard':
        return <OverviewDashboard />;
      case 'expenses':
        return <ExpenseList />;
      case 'approvals':
        return <ApprovalWorkflow />;
      case 'custody':
      case 'custodies':
        return <CustodyManagement />;
      case 'projects':
        return <ProjectsView />;
      case 'supervisors':
        return <SupervisorsView />;
      case 'reports':
        return <ReportsView />;
      case 'support':
        return <SupportCenter />;
      case 'settings':
        return <SettingsView />;
      case 'diagnostics':
      case 'sync-logs':
      case 'logs':
        return <DiagnosticLogsView />;
      default:
        return <OverviewDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      
      {/* Offline Status Persistent Indicator */}
      {!isOnline && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-sm z-50">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4" />
            <span>
              أنت تعمل حالياً في وضع عدم الاتصال (Offline). يتم حفظ كافة الفواتير والعمليات محلياً وستتم المزامنة تلقائياً فور عودة الشبكة ({pendingSyncCount} معلقة).
            </span>
          </div>
          <button
            onClick={() => triggerCloudSync()}
            disabled={isSyncing}
            className="px-3 py-1 bg-slate-900 text-white rounded-lg text-[11px] font-bold hover:bg-slate-800 transition-colors"
          >
            {isSyncing ? 'جاري الفحص...' : 'إعادة محاولة المزامنة'}
          </button>
        </div>
      )}

      {/* Top Header */}
      <Header
        onOpenSidebar={() => setIsSidebarOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto p-3 sm:p-5 gap-5">
        {/* Navigation Sidebar */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Dynamic View Canvas */}
        <main className="flex-1 min-w-0 pb-16 md:pb-6">
          {renderActiveView()}
        </main>
      </div>

      {/* Modals & Overlays */}
      <OperationStatusBanner />
      <ExpenseModal />
      <ExpenseDetailModal />
      <AttachmentPreviewModal />
      <NotificationsModal />
      <PrintVoucher />
      <ConfirmModal />

    </div>
  );
};

const AppContentGate: React.FC = () => {
  const {
    isAuthenticated,
    sessionEvictedInfo,
    dismissSessionEvictedModal,
    isInitialDatabaseLoading,
    bypassDatabaseLoading,
    databaseLoadSource
  } = useApp();

  if (isInitialDatabaseLoading) {
    return (
      <DatabaseBootLoadingScreen
        onBypass={bypassDatabaseLoading}
        loadSource={databaseLoadSource}
      />
    );
  }

  return (
    <>
      {isAuthenticated ? <MainAppContent /> : <LoginPage />}
      <ConcurrentSessionModal
        info={sessionEvictedInfo}
        onDismiss={dismissSessionEvictedModal}
      />
    </>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContentGate />
      </AppProvider>
    </ErrorBoundary>
  );
}
