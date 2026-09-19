import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Bell,
  Wifi,
  WifiOff,
  RefreshCw,
  Sun,
  Moon,
  Plus,
  ShieldCheck,
  UserCheck,
  HardHat,
  Menu,
  ChevronDown,
  Layers,
  Sparkles,
  KeyRound,
  LogOut,
  Cloud,
  CheckCircle2,
  Database,
  X,
  Info,
  Terminal,
  Activity
} from 'lucide-react';
import { UserRole } from '../../types';
import { ChangePasswordModal } from '../supervisors/ChangePasswordModal';
import { SyncDetailsModal } from '../sync/SyncDetailsModal';

interface HeaderProps {
  onOpenSidebar?: () => void;
  onOpenNotifications?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSidebar = () => {}, onOpenNotifications }) => {
  const {
    currentUser,
    currentUserRole,
    hasPermission,
    logout,
    isOnline,
    syncQueueCount,
    isSyncing,
    triggerSync,
    isCloudConnected,
    isCloudSyncing,
    isSavingToServer,
    isDataUploading,
    isJustUploaded,
    syncWithCloud,
    syncProgress,
    isServerConnected,
    saveToServerNow,
    lastServerSyncTime,
    settings,
    updateSettings,
    theme,
    isDarkMode,
    toggleTheme,
    userUnreadNotificationsCount,
    accessibleNotifications,
    setIsNotificationsOpen,
    setIsExpenseModalOpen,
    setEditingExpense,
    currentSupervisorSummary,
    setCurrentView,
    isScreenAllowed,
    isCurrentUserAdmin
  } = useApp();

  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [isSyncDetailsModalOpen, setIsSyncDetailsModalOpen] = useState(false);

  const isSupervisor =
    currentUser.role === 'مشرف' ||
    currentUser.role === 'مشرف موقع' ||
    currentUser.roleId === 'role_supervisor' ||
    currentUser.role.includes('مشرف');

  const unreadCount = userUnreadNotificationsCount;
  const isUploading = Boolean((isDataUploading || isSyncing || isCloudSyncing || isSavingToServer) && syncProgress.percent < 100);

  const handleAddNewExpense = () => {
    setEditingExpense(null);
    setIsExpenseModalOpen(true);
  };

  const getRoleIcon = (role: UserRole | string) => {
    if (role.includes('مدير') || role.includes('عليا')) {
      return <ShieldCheck className="w-4 h-4 text-emerald-500" />;
    }
    if (role.includes('محاسب')) {
      return <UserCheck className="w-4 h-4 text-blue-500" />;
    }
    return <HardHat className="w-4 h-4 text-amber-500" />;
  };

  const getRoleBadgeColor = (role: UserRole | string) => {
    if (role.includes('مدير') || role.includes('عليا')) {
      return 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100/70';
    }
    if (role.includes('محاسب')) {
      return 'bg-blue-50 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100/70';
    }
    return 'bg-amber-50 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100/70';
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-colors">
      <div className="max-w-[1600px] w-full mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          
          {/* Right Section: Mobile Menu + Brand / Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenSidebar}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              aria-label="القائمة"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex items-center justify-center overflow-hidden p-1 shrink-0">
                {settings.companyLogo ? (
                  <img
                    src={settings.companyLogo}
                    alt={settings.companyName}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center">
                    <Layers className="w-5 h-5" />
                  </div>
                )}
              </div>
              <div className="hidden sm:block">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {settings.companyName}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                  {settings.companySubtitle}
                </p>
              </div>
            </div>
          </div>

          {/* Center Section: Quick Supervisor Status Alert if applicable */}
          {currentSupervisorSummary && (
            <div
              onClick={() => {
                if (!isSupervisor) {
                  setCurrentView('custodies');
                } else {
                  setCurrentView('expenses');
                }
              }}
              className="hidden md:flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700 text-xs cursor-pointer hover:bg-slate-100/90 dark:hover:bg-slate-700/80 transition-all shadow-2xs"
              title={`الرصيد الفعلي المتبقي بعد كل المسجل: ${currentSupervisorSummary.actualRemainingBalance.toLocaleString()} ${settings.currencySymbol} | الرصيد الدفتري المعتمد: ${currentSupervisorSummary.approvedBookBalance.toLocaleString()} ${settings.currencySymbol}`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 dark:text-slate-400 font-medium">رصيد العهدة الفعلي:</span>
                <span className={`font-black ${
                  currentSupervisorSummary.actualRemainingBalance < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : currentSupervisorSummary.actualRemainingBalance <= settings.lowBalanceThreshold
                    ? 'text-amber-600 dark:text-amber-400 animate-pulse'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {currentSupervisorSummary.actualRemainingBalance.toLocaleString()} {settings.currencySymbol}
                </span>
              </div>
              {currentSupervisorSummary.totalPendingExpenses > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800">
                  (قيد التدقيق: {currentSupervisorSummary.totalPendingExpenses.toLocaleString()})
                </span>
              )}
            </div>
          )}

          {/* Left Section: Actions, Connectivity, Sync, Notifications & Role Switcher */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            
            {/* Network & Cloud Connectivity Status Indicator Badge */}
            <div className="flex items-center">
              <button
                type="button"
                id="btn-network-status-indicator"
                onClick={() => setIsNetworkModalOpen(true)}
                title={
                  isOnline
                    ? 'أنت متصل بالإنترنت وقاعدة البيانات السحابية (انقر لعرض تفاصيل الشبكة والمزامنة)'
                    : 'أنت في وضع العمل دون إنترنت (Offline) - يتم حفظ السندات محلياً وتزامن تلقائياً فور عودة الشبكة'
                }
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all border cursor-pointer ${
                  isOnline
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100/80 shadow-2xs'
                    : 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700 animate-pulse shadow-2xs'
                }`}
              >
                {isOnline ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="hidden sm:inline">متصل بالإنترنت</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span className="hidden sm:inline">دون إنترنت (أوفلاين)</span>
                  </>
                )}
              </button>
            </div>



            {/* Notifications Bell */}
            <button
              onClick={() => {
                setIsNotificationsOpen(true);
                onOpenNotifications?.();
              }}
              className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
              title="التنبيهات والإشعارات"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold text-white bg-rose-500 rounded-full px-1 shadow-sm animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Dark / Light Mode Toggle (Per-User Isolated) */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
              title={isDarkMode ? 'التبديل إلى الوضع النهاري (خاص بحسابك)' : 'التبديل إلى الوضع الليلي (خاص بحسابك)'}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>



            {/* Current User Profile & Logout Menu (User switching removed - strictly login/logout screen) */}
            <div className="relative">
              <button
                onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-2xs cursor-pointer ${getRoleBadgeColor(
                  currentUser.role
                )}`}
                title="الملف الشخصي والحساب الحالي"
              >
                <img
                  src={currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'}
                  alt={currentUser.name}
                  className="w-5 h-5 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shadow-xs shrink-0"
                />
                <span className="hidden md:inline font-bold">{currentUser.role}</span>
                <span className="hidden lg:inline text-[11px] opacity-80 truncate max-w-[100px]">
                  ({currentUser.name.split(' ')[0]})
                </span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </button>

              {isRoleDropdownOpen && (
                <div
                  className="absolute left-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-3 z-50 animate-in fade-in slide-in-from-top-2 space-y-3"
                  onClick={() => setIsRoleDropdownOpen(false)}
                >
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'}
                        alt={currentUser.name}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">@{currentUser.username || (currentUser.email ? currentUser.email.split('@')[0] : 'user')}</p>
                        <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-md border font-bold ${getRoleBadgeColor(currentUser.role)}`}>
                          {currentUser.role}
                        </span>
                      </div>
                    </div>

                    {currentUser.assignedProjects && currentUser.assignedProjects.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        المشاريع المسندة: {currentUser.assignedProjects.length} مشاريع
                      </div>
                    )}

                    <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      <span>جلسة نشطة عبر شاشة الدخول المعتمدة</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsRoleDropdownOpen(false);
                        setIsChangePasswordOpen(true);
                      }}
                      className="w-full text-center py-2 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs border border-amber-200 dark:border-amber-800/80"
                    >
                      <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>تغيير كلمة المرور واسم المستخدم</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsRoleDropdownOpen(false);
                        logout();
                      }}
                      className="w-full text-center py-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs border border-rose-200 dark:border-rose-800/80"
                    >
                      <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      <span>تسجيل الخروج من النظام</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Direct Logout Button in Header Bar */}
            <button
              onClick={() => logout()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/80 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
              title="تسجيل الخروج من النظام والعودة لشاشة الدخول"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">خروج</span>
            </button>

          </div>
        </div>
      </div>

      {/* Direct Change Password Modal for Current User */}
      {isChangePasswordOpen && currentUser && (
        <ChangePasswordModal
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
          targetUser={currentUser}
        />
      )}

      {/* Network & Cloud Synchronization Diagnostics Modal */}
      {isNetworkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in zoom-in-95 duration-150 text-right">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <Wifi className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    حالة الاتصال
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    مؤشر اتصال الشبكة والسيرفر السحابي
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNetworkModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Diagnostics Cards - Connection Status Only */}
            <div className="space-y-2.5 text-xs">
              
              {/* Internet Status */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${isOnline ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'}`}>
                    {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">شبكة الإنترنت</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isOnline ? 'جهازك متصل بالإنترنت بشكل سليم' : 'جهازك حالياً في وضع عدم الاتصال'}
                    </span>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  isOnline 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse'
                }`}>
                  {isOnline ? 'متصل ونشط' : 'دون اتصال'}
                </span>
              </div>

              {/* Cloud Database Status */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                    <Cloud className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">السيرفر السحابي (Cloud DB)</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isCloudConnected ? 'قاعدة البيانات السحابية متصلة' : 'قيد الاتصال'}
                    </span>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  isCloudConnected 
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' 
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                  {isCloudConnected ? 'متصل' : 'قيد المراجعة'}
                </span>
              </div>

            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsNetworkModalOpen(false)}
                className="w-full py-2.5 px-4 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Cloud & Server Sync Detailed Center Modal */}
      <SyncDetailsModal
        isOpen={isSyncDetailsModalOpen}
        onClose={() => setIsSyncDetailsModalOpen(false)}
      />
    </header>
  );
};
