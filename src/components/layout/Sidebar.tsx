import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  ReceiptText,
  CheckCircle2,
  Wallet,
  Briefcase,
  Users,
  FileSpreadsheet,
  Headphones,
  Settings,
  Plus,
  Send,
  MessageCircle,
  Download,
  AlertTriangle,
  Building2,
  X,
  LogOut
} from 'lucide-react';
import { WhatsAppService } from '../../services/whatsappService';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose = () => {} }) => {
  const {
    currentView,
    setCurrentView,
    totalPendingApprovalsCount,
    currentUser,
    currentUserRole,
    hasPermission,
    isScreenAllowed,
    currentSupervisorSummary,
    settings,
    projects,
    exportAllToExcel,
    setIsExpenseModalOpen,
    setEditingExpense,
    logout
  } = useApp();

  const navItems = [
    {
      id: 'dashboard',
      label: 'نظرة عامة والتحليلات',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'expenses',
      label: 'المصروفات والفواتير',
      icon: ReceiptText,
      badge: null,
    },
    {
      id: 'approvals',
      label: 'دورة الاعتمادات والترحيل',
      icon: CheckCircle2,
      badge: totalPendingApprovalsCount > 0 ? totalPendingApprovalsCount : null,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'custodies',
      label: 'العهد وأرصدة المشرفين',
      icon: Wallet,
      badge: null,
    },
    {
      id: 'projects',
      label: 'المشاريع والمواقع',
      icon: Briefcase,
      badge: null,
    },
    {
      id: 'supervisors',
      label: 'المشرفين وفريق العمل',
      icon: Users,
      badge: null,
    },
    {
      id: 'reports',
      label: 'التقارير والتصدير',
      icon: FileSpreadsheet,
      badge: null,
    },
    {
      id: 'settings',
      label: 'الإعدادات والصلاحيات (RBAC)',
      icon: Settings,
      badge: null,
    },
    {
      id: 'support',
      label: 'الدعم الفني والمساعدة',
      icon: Headphones,
      badge: null,
    },
  ];

  // Check if current user is Manager / Super Admin
  const isCurrentUserAdmin =
    currentUser.role === 'مدير' ||
    currentUser.role === 'مدير عام' ||
    currentUser.roleId === 'role_admin' ||
    currentUserRole?.id === 'role_admin' ||
    currentUserRole?.name === 'مدير عام' ||
    currentUser.email?.toLowerCase() === '2030m.mansour@gmail.com';

  // Dynamically filter navigation items based on the active role's allowedScreens from RBAC
  // For the Manager: All items are permanently visible and can NEVER be hidden
  const filteredNavItems = navItems.filter(item => isCurrentUserAdmin || isScreenAllowed(item.id));

  const handleNavClick = (viewId: string) => {
    setCurrentView(viewId);
    onClose();
  };

  const handleQuickAddExpense = () => {
    setEditingExpense(null);
    setIsExpenseModalOpen(true);
    onClose();
  };

  // Quick WhatsApp message to manager for custody top-up
  const handleRequestCustodyWhatsApp = () => {
    if (!currentSupervisorSummary) return;
    const managerPhone = settings.whatsappRecipient || settings.supportPhone || '+966 50 123 4567';
    const assignedProjectNames = currentSupervisorSummary.assignedProjects
      .map(pid => projects.find(p => p.id === pid)?.name || pid)
      .join('، ');

    WhatsAppService.sendCustodyTopUpRequest({
      supervisorName: currentSupervisorSummary.name,
      remainingBalance: currentSupervisorSummary.actualRemainingBalance ?? currentSupervisorSummary.remainingBalance,
      pendingExpenses: currentSupervisorSummary.totalPendingExpenses,
      approvedBalance: currentSupervisorSummary.approvedBookBalance,
      projects: assignedProjectNames || undefined,
      currencySymbol: settings.currencySymbol,
      managerPhone,
    });
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 right-0 z-50 w-72 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:rounded-2xl lg:border lg:border-slate-200/90 dark:lg:border-slate-800 lg:shadow-sm ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Mobile Header Close Button */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 lg:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden p-0.5 shrink-0">
              {settings.companyLogo ? (
                <img
                  src={settings.companyLogo}
                  alt={settings.companyName}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Building2 className="w-4 h-4 text-emerald-600" />
              )}
            </div>
            <span className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate max-w-[170px]">
              {settings.companyName}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Company Identity Header for Desktop */}
        <div className="hidden lg:block p-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex items-center justify-center overflow-hidden p-1 shrink-0">
              {settings.companyLogo ? (
                <img
                  src={settings.companyLogo}
                  alt={settings.companyName}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
              )}
            </div>
            <div className="overflow-hidden">
              <h2 className="text-xs font-black text-slate-900 dark:text-white truncate">
                {settings.companyName}
              </h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {settings.companySubtitle || 'الرقابة المالية والميدانية'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Add Button inside sidebar (Displayed only if role has canCreateExpense permission) */}
        {hasPermission('canCreateExpense') && (
          <div className="p-4 pb-2">
            <button
              onClick={handleQuickAddExpense}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl shadow-sm shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all text-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل مصروف جديد</span>
            </button>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {filteredNavItems.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                      item.badgeColor || 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Supervisor Balance & Urgent Top-up Widget */}
        {currentSupervisorSummary && (
          <div className="p-3.5 mx-3 mb-3 rounded-xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">رصيد عهدتك المتبقي</span>
              {currentSupervisorSummary.remainingBalance <= settings.lowBalanceThreshold && (
                <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                  <AlertTriangle className="w-3 h-3" />
                  منخفض
                </span>
              )}
            </div>
            
            <p className="text-lg font-black text-slate-900 dark:text-white tabular-nums">
              {currentSupervisorSummary.remainingBalance.toLocaleString()}{' '}
              <span className="text-xs font-normal text-slate-500">{settings.currencySymbol}</span>
            </p>

            {currentSupervisorSummary.remainingBalance <= settings.lowBalanceThreshold && (
              <button
                onClick={handleRequestCustodyWhatsApp}
                className="mt-2.5 w-full py-2 px-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                title="إرسال طلب تعزيز عهدة للمدير عبر واتساب"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>طلب تعزيز عهدة عبر واتساب</span>
              </button>
            )}
          </div>
        )}

        {/* Footer Actions: Excel Multi-Sheet Quick Export & Safe Logout */}
        <div className="p-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
          <button
            onClick={() => exportAllToExcel()}
            className="w-full py-2 px-3 bg-slate-100/90 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl border border-slate-200/70 dark:border-slate-700 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>تصدير تقرير إكسيل شامل (.xlsx)</span>
          </button>
          <button
            onClick={() => logout()}
            className="w-full py-2 px-3 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl border border-rose-200 dark:border-rose-900/60 flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
            title="تسجيل الخروج والعودة لشاشة الدخول الأساسية"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج من البرنامج</span>
          </button>
        </div>
      </aside>
    </>
  );
};
