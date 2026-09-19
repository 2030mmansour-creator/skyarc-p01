import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Bell,
  X,
  CheckCircle2,
  AlertTriangle,
  Info,
  Trash2,
  CheckCheck,
  User as UserIcon,
  Receipt,
  Clock,
  XCircle,
  Wallet,
  TrendingUp,
  FileCheck
} from 'lucide-react';

export const NotificationsModal: React.FC = () => {
  const {
    accessibleNotifications,
    userUnreadNotificationsCount,
    isNotificationsOpen,
    setIsNotificationsOpen,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    clearAllNotifications,
    setSelectedExpenseForDetail,
    setCurrentView,
    expenses,
    confirmAction
  } = useApp();

  const [activeTab, setActiveTab] = useState<'all' | 'expenses' | 'custodies'>('all');

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'expenses') {
      return accessibleNotifications.filter(
        n =>
          n.category === 'expense' ||
          n.category === 'approval' ||
          n.type === 'expense_added' ||
          n.type === 'pending_approval' ||
          n.type === 'approved' ||
          n.type === 'rejected'
      );
    }
    if (activeTab === 'custodies') {
      return accessibleNotifications.filter(
        n =>
          n.category === 'custody' ||
          n.category === 'replenishment' ||
          n.type === 'custody_issued' ||
          n.type === 'custody_replenishment' ||
          n.type === 'low_balance'
      );
    }
    return accessibleNotifications;
  }, [accessibleNotifications, activeTab]);

  if (!isNotificationsOpen) return null;

  const handleNotificationClick = (n: any) => {
    markNotificationAsRead(n.id);
    const relatedExpId = n.relatedId || n.relatedExpenseId;
    if (relatedExpId) {
      const exp = expenses.find(e => e.id === relatedExpId);
      if (exp) {
        setSelectedExpenseForDetail(exp);
        setIsNotificationsOpen(false);
        return;
      }
    }

    if (n.category === 'custody' || n.category === 'replenishment' || n.type === 'custody_issued' || n.type === 'custody_replenishment' || n.type === 'low_balance') {
      setCurrentView('custodies');
      setIsNotificationsOpen(false);
    }
  };

  const handleDeleteNotification = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteNotification(id);
  };

  const getNotificationDetails = (n: any) => {
    const type = n.type || '';
    const category = n.category || '';

    if (type === 'expense_added' || (category === 'expense' && !type.includes('approved'))) {
      return {
        icon: <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
        badgeText: 'إضافة مصروف',
        badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/50',
        bgAccent: 'border-r-emerald-500'
      };
    }

    if (type === 'approved' || category === 'approval') {
      return {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
        badgeText: 'اعتماد مرحلي / نهائي',
        badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/50',
        bgAccent: 'border-r-emerald-500'
      };
    }

    if (type === 'rejected') {
      return {
        icon: <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />,
        badgeText: 'رفض مصروف',
        badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200/50 dark:border-rose-800/50',
        bgAccent: 'border-r-rose-500'
      };
    }

    if (type === 'custody_issued' || category === 'custody') {
      return {
        icon: <Wallet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
        badgeText: 'تسليم وصرف عهدة',
        badgeClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200/50 dark:border-indigo-800/50',
        bgAccent: 'border-r-indigo-500'
      };
    }

    if (type === 'custody_replenishment' || type === 'low_balance' || category === 'replenishment') {
      return {
        icon: <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
        badgeText: 'طلب تعزيز عهدة',
        badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/50 dark:border-amber-800/50',
        bgAccent: 'border-r-amber-500'
      };
    }

    if (type === 'pending_approval') {
      return {
        icon: <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
        badgeText: 'بانتظار الاعتماد',
        badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/50 dark:border-amber-800/50',
        bgAccent: 'border-r-amber-500'
      };
    }

    return {
      icon: <FileCheck className="w-4 h-4 text-slate-600 dark:text-slate-400" />,
      badgeText: 'عملية مالية',
      badgeClass: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200/50 dark:border-slate-700/50',
      bgAccent: 'border-r-slate-400'
    };
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center sm:justify-end p-3 sm:p-6 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden mt-12 sm:mt-16 flex flex-col max-h-[88vh]">
        
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              مركز التنبيهات الذكية
            </h3>
            {userUnreadNotificationsCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold animate-pulse">
                {userUnreadNotificationsCount} جديد
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-medium">
                مقروءة
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {accessibleNotifications.length > 0 && (
              <>
                {userUnreadNotificationsCount > 0 && (
                  <button
                    onClick={() => markAllNotificationsAsRead()}
                    className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 px-2 py-1 rounded transition-colors cursor-pointer"
                    title="تحديد الكل كمقروء"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>قراءة الكل</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    confirmAction({
                      title: 'تأكيد مسح التنبيهات من حسابك',
                      message: 'هل أنت متأكد من مسح جميع التنبيهات؟ سيتم حذفها من شاشتك فقط دون التأثير على باقي المستخدمين.',
                      type: 'warning',
                      confirmText: 'نعم، مسح الكل',
                      cancelText: 'إلغاء',
                      onConfirm: () => {
                        clearAllNotifications();
                      }
                    });
                  }}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-500 px-2 py-1 rounded transition-colors cursor-pointer"
                  title="مسح كافة التنبيهات"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>مسح</span>
                </button>
              </>
            )}
            <button
              onClick={() => setIsNotificationsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-3 py-2 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 shrink-0 text-xs">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all text-xs cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs border border-slate-200/80 dark:border-slate-700 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            الكل ({accessibleNotifications.length})
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all text-xs cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'expenses'
                ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs border border-slate-200/80 dark:border-slate-700 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>المصروفات والاعتمادات</span>
          </button>
          <button
            onClick={() => setActiveTab('custodies')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all text-xs cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'custodies'
                ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs border border-slate-200/80 dark:border-slate-700 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>العهد والتعزيز</span>
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">لا توجد تنبيهات في هذا القسم حالياً.</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">يقتصر مركز التنبيهات على العمليات المالية المهمة فقط (إضافة مصروف، اعتماد مراحل، تعزيز عهدة، تسليم عهدة).</p>
            </div>
          ) : (
            filteredNotifications.map((n, idx) => {
              const details = getNotificationDetails(n);
              return (
                <div
                  key={`${n.id || 'notif'}-${idx}`}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 sm:p-4 transition-all cursor-pointer flex items-start gap-3 group relative border-r-3 ${details.bgAccent} ${
                    !n.read
                      ? 'bg-emerald-50/30 dark:bg-emerald-950/20 hover:bg-emerald-50/60'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 opacity-85 hover:opacity-100'
                  }`}
                >
                  <div className="mt-0.5 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shrink-0 shadow-2xs">
                    {details.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${details.badgeClass}`}>
                          {details.badgeText}
                        </span>
                        <h4 className={`text-xs truncate ${!n.read ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                          {n.title}
                        </h4>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                        {new Date(n.createdAt || n.timestamp || Date.now()).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {n.message}
                    </p>

                    <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                      {n.authorName ? (
                        <div className="flex items-center gap-1">
                          <UserIcon className="w-3 h-3" />
                          <span>بواسطة: {n.authorName}</span>
                        </div>
                      ) : <span />}

                      {n.relatedId && (
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
                          انقر لعرض التفاصيل ←
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Individual delete & unread indicator */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 shadow-xs" title="تنبيه غير مقروء" />
                    )}
                    <button
                      onClick={(e) => handleDeleteNotification(e, n.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded transition-all cursor-pointer"
                      title="حذف هذا التنبيه من شاشتي فقط"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};
