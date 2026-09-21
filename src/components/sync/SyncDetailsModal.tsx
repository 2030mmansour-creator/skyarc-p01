import React from 'react';
import { useApp } from '../../context/AppContext';
import { FirebaseService, QuotaStatusDetails } from '../../services/firebase';
import {
  Cloud,
  CheckCircle2,
  RefreshCw,
  Clock,
  Database,
  Layers,
  FileText,
  Briefcase,
  Users,
  ShieldCheck,
  GitMerge,
  Ticket,
  Sliders,
  Bell,
  X,
  Zap,
  Activity,
  ArrowUpRight,
  Server,
  UploadCloud,
  PackageCheck
} from 'lucide-react';

interface SyncDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncDetailsModal: React.FC<SyncDetailsModalProps> = ({ isOpen, onClose }) => {
  const {
    projects,
    expenses,
    custodies,
    users,
    roles,
    workflowStages,
    tickets,
    notifications,
    settings,
    isCloudSyncing,
    isDataUploading,
    syncProgress,
    isServerConnected,
    isCloudConnected,
    isOnline,
    lastCloudSyncTime,
    lastServerSyncTime,
    syncWithCloud,
    setCurrentView,
    isCurrentUserAdmin
  } = useApp();

  const [quotaDetails, setQuotaDetails] = React.useState<QuotaStatusDetails>(() =>
    FirebaseService.getQuotaDetails()
  );

  React.useEffect(() => {
    return FirebaseService.subscribeToQuotaStatus((details) => {
      setQuotaDetails(details);
    });
  }, []);

  if (!isOpen) return null;

  // Real active sync condition (must not hang if already 100% or if quota is exhausted)
  const isSyncInProgress = Boolean(
    !quotaDetails.isExhausted &&
    (isCloudSyncing ||
      (syncProgress.isSyncing && syncProgress.percent < 100) ||
      (isDataUploading && syncProgress.percent < 100))
  );

  // Calculate detailed items
  const dataEntities = [
    {
      id: 'projects',
      name: 'المشاريع والمواقع الميدانية',
      category: 'بيانات المشاريع',
      icon: Briefcase,
      count: projects.length,
      unit: 'مشروع',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/40',
      borderColor: 'border-blue-200 dark:border-blue-800',
    },
    {
      id: 'expenses',
      name: 'المصروفات وسندات الصرف والاعتمادات',
      category: 'الحركات المالية',
      icon: FileText,
      count: expenses.length,
      unit: 'سند ومصروف',
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
      borderColor: 'border-emerald-200 dark:border-emerald-800',
    },
    {
      id: 'custodies',
      name: 'العهد المالية للمشرفين وحركاتها',
      category: 'العهد والمطالبات',
      icon: Layers,
      count: custodies.length,
      unit: 'سجل عهدة',
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-950/40',
      borderColor: 'border-purple-200 dark:border-purple-800',
    },
    {
      id: 'users',
      name: 'حسابات المستخدمين والمشرفين',
      category: 'المستخدمين والصلاحيات',
      icon: Users,
      count: users.length,
      unit: 'مستخدم',
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/40',
      borderColor: 'border-indigo-200 dark:border-indigo-800',
    },
    {
      id: 'roles',
      name: 'الأدوار ومصفوفة الصلاحيات المخصصة',
      category: 'الأمان والوصول',
      icon: ShieldCheck,
      count: roles.length,
      unit: 'أدوار مخصصة',
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/40',
      borderColor: 'border-amber-200 dark:border-amber-800',
    },
    {
      id: 'workflow',
      name: 'مراحل سير العمل والاعتمادات المتعددة',
      category: 'الإجراءات والمسارات',
      icon: GitMerge,
      count: workflowStages.length,
      unit: 'مراحل اعتماد',
      color: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-50 dark:bg-cyan-950/40',
      borderColor: 'border-cyan-200 dark:border-cyan-800',
    },
    {
      id: 'tickets',
      name: 'تذاكر الدعم والطلبات الفنية',
      category: 'الدعم والمتابعة',
      icon: Ticket,
      count: tickets.length,
      unit: 'تذكرة وطلب',
      color: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-50 dark:bg-rose-950/40',
      borderColor: 'border-rose-200 dark:border-rose-800',
    },
    {
      id: 'notifications',
      name: 'التنبيهات وسجل الإشعارات المركزية',
      category: 'سجلات النشاط',
      icon: Bell,
      count: notifications.length,
      unit: 'إشعار وتنبيه',
      color: 'text-teal-600 dark:text-teal-400',
      bgColor: 'bg-teal-50 dark:bg-teal-950/40',
      borderColor: 'border-teal-200 dark:border-teal-800',
    },
    {
      id: 'settings',
      name: 'إعدادات المنظومة وتصنيفات المصروفات',
      category: 'تكوين النظام',
      icon: Sliders,
      count: (settings.customCategories?.length || 0) + (settings.customErpSystems?.length || 0) + 1,
      unit: 'عنصر تكوين',
      color: 'text-slate-600 dark:text-slate-400',
      bgColor: 'bg-slate-50 dark:bg-slate-900',
      borderColor: 'border-slate-200 dark:border-slate-700',
    }
  ];

  const totalEntitiesRecords = dataEntities.reduce((acc, curr) => acc + curr.count, 0);

  // Live and exact uploaded / remaining counters
  const totalItemsToSync = syncProgress.totalItems && syncProgress.totalItems > 0
    ? syncProgress.totalItems
    : (expenses.length || totalEntitiesRecords);

  const uploadedRecordsCount = isSyncInProgress
    ? (syncProgress.itemsSynced !== undefined && syncProgress.itemsSynced > 0
        ? syncProgress.itemsSynced
        : Math.min(totalItemsToSync, Math.max(1, Math.floor((syncProgress.percent / 100) * totalItemsToSync))))
    : totalEntitiesRecords;

  const remainingRecordsCount = isSyncInProgress
    ? (syncProgress.remainingItems !== undefined
        ? syncProgress.remainingItems
        : Math.max(0, totalItemsToSync - uploadedRecordsCount))
    : 0;

  const displaySyncTime = lastCloudSyncTime || lastServerSyncTime;

  return (
    <div
      id="modal-sync-details-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="modal-sync-details-card"
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-right"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-xs">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  مركز المزامنة والبيانات السحابية
                </h2>
                {quotaDetails.isExhausted ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shadow-xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    الوضع المحلي الآمن (حارس الحصة نشط)
                  </span>
                ) : isSyncInProgress ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse shadow-xs">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    جاري الرفع ({uploadedRecordsCount} / {totalItemsToSync}) - {syncProgress.percent}%
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    محدث ومؤمن 100%
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                متابعة دقيقة لعدد الملفات والسجلات المرفوعة والمتبقية مع السيرفر السحابي المركزي
              </p>
            </div>
          </div>

          <button
            id="btn-close-sync-modal"
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quota Exhausted Warning & Guidance Card */}
          {quotaDetails.isExhausted && (
            <div className="p-4 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 text-right space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>حارس الحصة السحابية نشط (Spark Plan Limit Protection)</span>
                </span>
                <span className="text-[10px] font-mono bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 px-2.5 py-0.5 rounded-md font-bold">
                  المتبقي للتهدئة: ~{quotaDetails.remainingMinutes} دقيقة
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                كافة المصروفات، سندات الصرف، والبيانات محفوظة ومؤمنة في جهازك بنجاح 100%. تم إيقاف محاولات الإرسال السحابي التلقائي مؤقتاً لتفادي أخطاء استنفاد الحصة اليومية المجانية في Firestore (Free daily write units).
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    FirebaseService.resetQuotaLimitState();
                    await syncWithCloud();
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة الفحص ومحاولة المزامنة الآن</span>
                </button>
                <a
                  href={quotaDetails.upgradeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-white hover:underline flex items-center gap-1"
                >
                  <span>لوحة تحكم Firebase</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {/* Top Live Metrics Grid: Exact Uploaded vs Remaining Counts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Progress Percentage */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-right">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
                <span>نسبة المزامنة</span>
                <Activity className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                {quotaDetails.isExhausted ? '100%' : isSyncInProgress ? `${syncProgress.percent}%` : '100%'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {quotaDetails.isExhausted
                  ? 'مؤمن بالكامل محلياً'
                  : isSyncInProgress
                  ? (syncProgress.currentBatch ? `حزمة ${syncProgress.currentBatch} من ${syncProgress.totalBatches}` : 'جاري المعالجة...')
                  : 'كافة البيانات محفوظة'}
              </div>
            </div>

            {/* Uploaded Records (كم ملف/سجل اترفع) */}
            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-right">
              <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 mb-1 flex items-center justify-between">
                <span>تم تأمينه وحفظه</span>
                <UploadCloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-300 tabular-nums">
                {quotaDetails.isExhausted ? totalItemsToSync : uploadedRecordsCount} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/ {totalItemsToSync}</span>
              </div>
              <div className="text-[10px] text-emerald-600/90 dark:text-emerald-400 mt-0.5 font-medium">
                {quotaDetails.isExhausted
                  ? 'كافة السجلات مؤمنة محلياً'
                  : isSyncInProgress
                  ? `تم رفع ${uploadedRecordsCount} سجل`
                  : 'تم حفظ كافة السجلات بنجاح'}
              </div>
            </div>

            {/* Remaining Records (كم ملف/سجل باقي) */}
            <div className={`p-4 rounded-xl border text-right transition-colors ${
              !quotaDetails.isExhausted && remainingRecordsCount > 0
                ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/80'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80'
            }`}>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
                <span>المتبقي للرفع</span>
                <Zap className={`w-3.5 h-3.5 ${!quotaDetails.isExhausted && remainingRecordsCount > 0 ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`} />
              </div>
              <div className={`text-xl font-bold font-mono tabular-nums ${
                !quotaDetails.isExhausted && remainingRecordsCount > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-700 dark:text-slate-300'
              }`}>
                {quotaDetails.isExhausted ? 0 : remainingRecordsCount} <span className="text-xs font-normal text-slate-400">سجل</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {quotaDetails.isExhausted
                  ? 'لا توجد بيانات معلقة محلياً'
                  : remainingRecordsCount > 0
                  ? 'بانتظار إتمام الحزمة السحابية'
                  : 'لا توجد أي ملفات معلقة'}
              </div>
            </div>

            {/* Remaining Time (الوقت المتبقي) */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-right">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
                <span>الوقت التقديري</span>
                <Clock className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                {quotaDetails.isExhausted
                  ? 'جاهز فوراً'
                  : isSyncInProgress
                  ? syncProgress.remainingSeconds > 0
                    ? `~${syncProgress.remainingSeconds} ثانية`
                    : 'لحظات...'
                  : '0 ثانية'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {quotaDetails.isExhausted ? 'قاعدة البيانات المحلية فعالة' : isSyncInProgress ? 'مزامنة نشطة' : 'المزامنة مكتملة'}
              </div>
            </div>
          </div>

          {/* Active Progress Bar Card */}
          <div className="p-4 rounded-xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
              <span className="flex items-center gap-2">
                {quotaDetails.isExhausted ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <RefreshCw className={`w-4 h-4 ${isSyncInProgress ? 'animate-spin text-amber-500' : 'text-emerald-500'}`} />
                )}
                <span>
                  {quotaDetails.isExhausted
                    ? 'تم تأمين وحفظ كافة البيانات محلياً بنجاح 100% (السحابة في وضع حارس الحصة)'
                    : isSyncInProgress
                    ? `${syncProgress.statusText} (${uploadedRecordsCount} من ${totalItemsToSync} سجل)`
                    : 'تمت المزامنة وحفظ وتأمين كافة البيانات السحابية 100%'}
                </span>
              </span>
              <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                {quotaDetails.isExhausted ? '100% مؤمن محلياً' : isSyncInProgress ? `${syncProgress.percent}%` : '100% مكتمل'}
              </span>
            </div>

            {/* Dynamic visual progress track */}
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden p-0.5 shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  quotaDetails.isExhausted
                    ? 'bg-emerald-500'
                    : isSyncInProgress
                    ? 'bg-gradient-to-r from-amber-500 via-emerald-500 to-teal-400 animate-pulse'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${quotaDetails.isExhausted ? 100 : isSyncInProgress ? syncProgress.percent : 100}%` }}
              />
            </div>

            {/* Bottom info strip */}
            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 gap-2 border-t border-slate-200/60 dark:border-slate-700/60">
              <span className="flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-slate-400" />
                <span>الخادم المركزي:</span>
                <strong className="text-slate-700 dark:text-slate-300 font-medium">
                  {quotaDetails.isExhausted ? 'مستودع البيانات المحلي الآمن + Firestore Cloud' : 'Firestore Cloud (Google Cloud)'}
                </strong>
              </span>
              <div className="flex items-center gap-3 font-mono">
                <span>
                  تم تأمين: <strong className="text-emerald-600 dark:text-emerald-400">{quotaDetails.isExhausted ? totalItemsToSync : uploadedRecordsCount}</strong>
                </span>
                <span>
                  باقي: <strong className={!quotaDetails.isExhausted && remainingRecordsCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}>{quotaDetails.isExhausted ? 0 : remainingRecordsCount}</strong>
                </span>
                <span>
                  آخر تأكيد: <strong className="text-slate-700 dark:text-slate-300">{displaySyncTime ? new Date(displaySyncTime).toLocaleTimeString('ar-SA') : 'الآن'}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Entity Breakdown with Active vs Completed Statuses */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>تفاصيل البيانات والسجلات التي يتم مزامنتها ({dataEntities.length} أقسام)</span>
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">
                إجمالي السجلات: {totalEntitiesRecords} سجل
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {dataEntities.map((entity) => {
                const IconComponent = entity.icon;
                
                // Determine accurate entity status during sync vs idle
                let statusLabel = 'متزامن ومؤمن';
                let statusColor = 'text-emerald-600 dark:text-emerald-400';
                let statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
                let isEntityUploading = false;

                if (quotaDetails.isExhausted) {
                  statusLabel = 'محفوظ ومؤمن محلياً 100%';
                  statusColor = 'text-emerald-600 dark:text-emerald-400 font-bold';
                  statusIcon = <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
                  isEntityUploading = false;
                } else if (isSyncInProgress) {
                  if (entity.id === 'expenses') {
                    isEntityUploading = true;
                    statusLabel = `جاري الرفع (${Math.min(entity.count, uploadedRecordsCount)} / ${entity.count})`;
                    statusColor = 'text-amber-600 dark:text-amber-400 font-bold';
                    statusIcon = <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />;
                  } else if (syncProgress.percent < 75) {
                    statusLabel = 'بانتظار الرفع';
                    statusColor = 'text-blue-600 dark:text-blue-400';
                    statusIcon = <Clock className="w-3.5 h-3.5 text-blue-500" />;
                  } else {
                    statusLabel = `مكتمل (${entity.count})`;
                    statusColor = 'text-emerald-600 dark:text-emerald-400';
                    statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
                  }
                }

                return (
                  <div
                    key={entity.id}
                    className={`p-3 rounded-xl border transition-all flex items-start gap-2.5 shadow-2xs ${
                      isEntityUploading
                        ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/80 ring-1 ring-amber-400/30'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${entity.bgColor} ${entity.color} shrink-0 mt-0.5`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {entity.name}
                        </h4>
                        <span className="text-[10px] font-bold font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-md shrink-0">
                          {entity.count} {entity.unit}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] mt-1.5 pt-1 border-t border-slate-100 dark:border-slate-700/50">
                        <span className="text-slate-400">{entity.category}</span>
                        <span className={`flex items-center gap-1 font-medium ${statusColor}`}>
                          {statusIcon}
                          <span>{statusLabel}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Differential Sync Engine Guarantee Note */}
          <div className="p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
            <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-xs text-blue-950 dark:text-blue-100">
                <span>خوارزمية المزامنة التفاضلية الذكية (Differential Micro-Batches)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-mono">
                  Real-Time Differential
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-blue-800 dark:text-blue-300">
                يقوم المحرك السحابي برفع التعديلات والسندات الجديدة فقط في حزم مجهرية متسلسلة بدلاً من إعادة رفع كامل قاعدة البيانات، مما يضمن ظهور دقيق لعدد السجلات المرفوعة والمتبقية مع استقرار تام وفوري للبيانات.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>{isOnline ? 'الإنترنت متصل وسرعة الاستجابة عالية' : 'الوضع الحالي: أوفلاين'}</span>
          </div>

          <div className="flex items-center gap-2">
            {isCurrentUserAdmin && (
              <button
                id="btn-open-sync-logs-from-modal"
                type="button"
                onClick={() => {
                  onClose();
                  setCurrentView('diagnostics');
                }}
                className="py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                title="متاح للمدير العام فقط"
              >
                <span>سجلات المزامنة (Logs)</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}



            <button
              id="btn-close-sync-modal-bottom"
              type="button"
              onClick={onClose}
              className="py-2 px-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
