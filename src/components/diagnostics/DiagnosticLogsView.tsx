import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { syncLogger, SyncLogEntry, SyncLogService, SyncLogStatus } from '../../services/syncLogger';
import { FirebaseService } from '../../services/firebase';
import { ServerSyncService, ServerDiagnosticResult } from '../../services/serverSync';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Trash2,
  Download,
  Search,
  Server,
  Cloud,
  Wifi,
  Clock,
  ArrowLeft,
  Copy,
  Check,
  ShieldAlert,
  Zap,
  HardDrive,
  FileCode,
  Terminal,
  Database,
  ExternalLink,
  Info
} from 'lucide-react';

export const DiagnosticLogsView: React.FC = () => {
  const { setCurrentView, syncWithCloud, isCurrentUserAdmin } = useApp();
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<any | null>(null);
  const [serverProbeResult, setServerProbeResult] = useState<ServerDiagnosticResult | null>(null);
  const [quotaDetails, setQuotaDetails] = useState(() => FirebaseService.getQuotaDetails());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Subscribe to log events
  useEffect(() => {
    const unsubscribe = syncLogger.subscribe((updatedLogs) => {
      setLogs(updatedLogs);
    });
    return () => unsubscribe();
  }, []);

  // Update quota status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setQuotaDetails(FirebaseService.getQuotaDetails());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Stats calculation
  const stats = useMemo(() => {
    return syncLogger.getStats();
  }, [logs]);

  // Root cause analysis
  const diagnosis = useMemo(() => {
    return syncLogger.diagnoseCurrentStatus();
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedService !== 'all' && log.service !== selectedService) {
        return false;
      }
      if (selectedStatus !== 'all') {
        if (selectedStatus === 'errors' && log.status !== 'failure' && log.status !== 'throttled') {
          return false;
        }
        if (selectedStatus === 'success' && log.status !== 'success') {
          return false;
        }
        if (selectedStatus === 'warnings' && log.status !== 'warning' && log.status !== 'throttled') {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = log.title?.toLowerCase().includes(q);
        const matchMsg = log.message?.toLowerCase().includes(q);
        const matchCode = String(log.statusCode || '').toLowerCase().includes(q);
        const matchPath = log.details?.targetPath?.toLowerCase().includes(q);
        const matchErr = log.details?.errorMessage?.toLowerCase().includes(q);
        return matchTitle || matchMsg || matchCode || matchPath || matchErr;
      }
      return true;
    });
  }, [logs, selectedService, selectedStatus, searchQuery]);

  // Run comprehensive end-to-end active probe
  const handleRunFullProbe = async () => {
    setIsProbing(true);
    try {
      const [firestoreResult, srvResult] = await Promise.all([
        FirebaseService.runFirestoreDiagnostics(),
        ServerSyncService.diagnoseServerConnection()
      ]);
      setProbeResult(firestoreResult);
      setServerProbeResult(srvResult);
      setQuotaDetails(FirebaseService.getQuotaDetails());
    } catch (e: any) {
      console.error('Probe error:', e);
    } finally {
      setIsProbing(false);
    }
  };

  // Reset quota limit lock & force enable network
  const handleResetQuotaGuard = () => {
    FirebaseService.resetQuotaLimitState();
    setQuotaDetails(FirebaseService.getQuotaDetails());
    syncLogger.log({
      service: 'firestore',
      operation: 'quota_guard',
      status: 'info',
      title: 'إلغاء حظر الحصة يدوياً',
      message: 'قام المستخدم بطلب إعادة ضبط حارس الحصة وتفعيل اتصال شبكة Firestore فوراً.'
    });
  };

  // Export logs as JSON
  const handleExportJson = () => {
    const jsonStr = syncLogger.exportLogsAsJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skyarc-sync-logs-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export logs as text report
  const handleExportText = () => {
    const textStr = syncLogger.exportLogsAsText();
    const blob = new Blob([textStr], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skyarc-sync-diagnostic-report-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isCurrentUserAdmin) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-md mx-auto mt-12 space-y-4" dir="rtl">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800/80">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            شاشة التشخيص وسجلات المزامنة متاحة للمدير فقط
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            هذه الشاشة مخصصة لإدارة النظام والمدير العام فقط لمتابعة سجلات المزامنة والتشخيص الفني المباشر.
          </p>
        </div>
        <button
          onClick={() => setCurrentView('expenses')}
          className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
        >
          الانتقال إلى شاشة المصروفات
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300" dir="rtl">
      {/* Top Header & Navigation Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700/80 text-amber-400 text-xs font-mono">
              <Terminal className="w-3.5 h-3.5" />
              <span>لوحة التشخيص والتحليل الفني المخفية (Hidden Diagnostic View)</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-3">
              <Activity className="w-6 h-6 text-emerald-400 shrink-0" />
              سجلات المزامنة وفحص أخطاء الشبكة (Sync Logs)
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              تتبع فوري ومفصل لجميع استدعاءات Firestore ومحاولات المزامنة الفاشلة وحالة حارس الحصة
              وسيرفر Hostinger لتحديد سبب توقف المزامنة بدقة وسرعة.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleRunFullProbe}
              disabled={isProbing}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Zap className={`w-4 h-4 ${isProbing ? 'animate-spin' : 'text-emerald-200'}`} />
              <span>{isProbing ? 'جاري الفحص المباشر...' : 'فحص الاتصال المباشر (Probe)'}</span>
            </button>

            <button
              onClick={handleResetQuotaGuard}
              className="px-3.5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
              title="إلغاء حظر الحصة وإعادة تشغيل اتصال Firestore"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>إلغاء حظر الحصة</span>
            </button>

            <button
              onClick={() => setCurrentView('dashboard')}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer border border-slate-700"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>العودة للنظام</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
            <span className="text-[11px] text-slate-400 block font-medium">إجمالي السجلات</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-lg font-black text-white font-mono">{stats.total}</span>
              <Activity className="w-4 h-4 text-slate-400" />
            </div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
            <span className="text-[11px] text-rose-400 block font-medium">محاولات فاشلة</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-lg font-black text-rose-400 font-mono">{stats.failures}</span>
              <XCircle className="w-4 h-4 text-rose-400" />
            </div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
            <span className="text-[11px] text-emerald-400 block font-medium">عمليات ناجحة</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-lg font-black text-emerald-400 font-mono">{stats.successes}</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
            <span className="text-[11px] text-amber-400 block font-medium">أخطاء Firestore</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-lg font-black text-amber-400 font-mono">{stats.firestoreErrors}</span>
              <Cloud className="w-4 h-4 text-amber-400" />
            </div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
            <span className="text-[11px] text-cyan-400 block font-medium">أخطاء السيرفر</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-lg font-black text-cyan-400 font-mono">{stats.serverErrors}</span>
              <Server className="w-4 h-4 text-cyan-400" />
            </div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
            <span className="text-[11px] text-slate-400 block font-medium">حارس الحصة</span>
            <div className="flex items-center justify-between mt-1">
              <span
                className={`text-xs font-black px-2 py-0.5 rounded-md ${
                  quotaDetails.isExhausted
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {quotaDetails.isExhausted ? `معلق (${quotaDetails.remainingMinutes} د)` : 'نشط وطبيعي'}
              </span>
              <ShieldAlert
                className={`w-4 h-4 ${quotaDetails.isExhausted ? 'text-amber-400' : 'text-emerald-400'}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Automated Diagnostic Conclusion / Root Cause Analysis */}
      <div
        className={`p-5 rounded-3xl border transition-all ${
          diagnosis.severity === 'error'
            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
            : diagnosis.severity === 'warning'
            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
            : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200'
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-2xl shrink-0 ${
              diagnosis.severity === 'error'
                ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
                : diagnosis.severity === 'warning'
                ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {diagnosis.severity === 'error' ? (
              <XCircle className="w-6 h-6" />
            ) : diagnosis.severity === 'warning' ? (
              <AlertTriangle className="w-6 h-6" />
            ) : (
              <CheckCircle2 className="w-6 h-6" />
            )}
          </div>

          <div className="space-y-1.5 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm sm:text-base font-bold">
                تحليل سبب حالة المزامنة: {diagnosis.primaryCause}
              </h3>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                  diagnosis.severity === 'error'
                    ? 'bg-rose-200 dark:bg-rose-800 text-rose-900 dark:text-rose-100'
                    : diagnosis.severity === 'warning'
                    ? 'bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100'
                    : 'bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100'
                }`}
              >
                {diagnosis.severity === 'error'
                  ? 'خطأ حرج'
                  : diagnosis.severity === 'warning'
                  ? 'تنبيه توقف'
                  : 'مستقر'}
              </span>
            </div>
            <p className="text-xs leading-relaxed opacity-90">{diagnosis.details}</p>
            <div className="mt-2 pt-2 border-t border-black/10 dark:border-white/10 flex items-center gap-2 text-xs font-semibold">
              <span className="shrink-0 font-bold">الإجراء الموصى به:</span>
              <span className="opacity-95">{diagnosis.recommendedAction}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Probe Results Box (If run) */}
      {(probeResult || serverProbeResult) && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-500" />
              نتائج الفحص المباشر المتقدم (Active Diagnostics Report)
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              {new Date().toLocaleTimeString('ar-SA')}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Firestore Ping */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">اتصال Firestore Ping</span>
                {probeResult?.networkProbe?.success ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" /> ناجح
                  </span>
                ) : (
                  <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-bold text-[11px]">
                    <XCircle className="w-3.5 h-3.5" /> فاشل
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                زمن الاستجابة: {probeResult?.networkProbe?.latencyMs ?? 0}ms
              </p>
              {probeResult?.networkProbe?.error && (
                <p className="text-[11px] text-rose-500 leading-tight">
                  {probeResult.networkProbe.error}
                </p>
              )}
            </div>

            {/* Firestore Read */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">قراءة الوثيقة المركزية</span>
                {probeResult?.readProbe?.success ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" /> متاحة
                  </span>
                ) : (
                  <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-bold text-[11px]">
                    <XCircle className="w-3.5 h-3.5" /> تعذرت
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                الحجم: {Math.round((probeResult?.readProbe?.docSizeBytes || 0) / 1024)} KB | السندات: {probeResult?.readProbe?.expensesCount || 0}
              </p>
              {probeResult?.readProbe?.error && (
                <p className="text-[11px] text-rose-500 leading-tight">{probeResult.readProbe.error}</p>
              )}
            </div>

            {/* Firestore Write Test */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">تجربة كتابة وحذف حية</span>
                {probeResult?.writeProbe?.success ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" /> مسموح بها
                  </span>
                ) : (
                  <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-bold text-[11px]">
                    <XCircle className="w-3.5 h-3.5" /> مرفوضة
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                المدة: {probeResult?.writeProbe?.latencyMs ?? 0}ms
              </p>
              {probeResult?.writeProbe?.error && (
                <p className="text-[11px] text-rose-500 leading-tight">{probeResult.writeProbe.error}</p>
              )}
            </div>

            {/* Hostinger Server Storage */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">سيرفر Hostinger القرصي</span>
                {serverProbeResult?.success ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" /> متصل وقابل للكتابة
                  </span>
                ) : (
                  <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-bold text-[11px]">
                    <XCircle className="w-3.5 h-3.5" /> غير متصل
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                المسار: {serverProbeResult?.workingUrl || 'api/state.php'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                المحرك: {serverProbeResult?.engine || 'Hostinger PHP'}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300">
            <span className="font-bold text-slate-900 dark:text-white">التقييم الشامل: </span>
            {probeResult?.overallAssessment}
          </div>
        </div>
      )}

      {/* Filter and Control Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث في السجلات، رموز الأخطاء، أو المسارات..."
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                مسح
              </button>
            )}
          </div>

          {/* Service & Status Filter Chips */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setSelectedService('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedService === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                الكل
              </button>
              <button
                onClick={() => setSelectedService('firestore')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedService === 'firestore'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Firestore
              </button>
              <button
                onClick={() => setSelectedService('hostinger_server')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedService === 'hostinger_server'
                    ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                سيرفر Hostinger
              </button>
              <button
                onClick={() => setSelectedService('network')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedService === 'network'
                    ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                الشبكة
              </button>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setSelectedStatus('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedStatus === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                جميع الحالات
              </button>
              <button
                onClick={() => setSelectedStatus('errors')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedStatus === 'errors'
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                الأخطاء فقط ({stats.failures})
              </button>
              <button
                onClick={() => setSelectedStatus('success')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedStatus === 'success'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                الناجحة
              </button>
            </div>
          </div>

          {/* Tools & Export */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              onClick={handleExportJson}
              className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="تصدير السجلات كملف JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">تصدير JSON</span>
            </button>

            <button
              onClick={handleExportText}
              className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="تصدير تقرير نصي شامل"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">تقرير TXT</span>
            </button>

            <button
              onClick={() => syncLogger.clearLogs()}
              className="p-2 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="مسح سجلات الجلسة الحالية"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">مسح</span>
            </button>
          </div>
        </div>
      </div>

      {/* Logs Stream List */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              لا توجد سجلات تطابق معايير الفلترة المحددة
            </p>
            <p className="text-xs text-slate-400">
              جرب تغيير كلمات البحث أو إعادة ضبط خيارات الفلترة لعرض كافة السجلات.
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isExpanded = expandedLogId === log.id;
            const isFailure = log.status === 'failure';
            const isThrottled = log.status === 'throttled';
            const isSuccess = log.status === 'success';

            return (
              <div
                key={log.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all overflow-hidden ${
                  isFailure
                    ? 'border-rose-200 dark:border-rose-900/60 shadow-xs'
                    : isThrottled
                    ? 'border-amber-200 dark:border-amber-900/60 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div
                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                  className="p-4 sm:p-5 flex items-start gap-4 cursor-pointer select-none"
                >
                  {/* Status Indicator Icon */}
                  <div
                    className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                      isFailure
                        ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/80 dark:text-rose-400'
                        : isThrottled
                        ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400'
                        : isSuccess
                        ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400'
                        : 'bg-blue-100 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400'
                    }`}
                  >
                    {isFailure ? (
                      <XCircle className="w-5 h-5" />
                    ) : isThrottled ? (
                      <ShieldAlert className="w-5 h-5" />
                    ) : isSuccess ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Info className="w-5 h-5" />
                    )}
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Service Chip */}
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                            log.service === 'firestore'
                              ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                              : log.service === 'hostinger_server'
                              ? 'bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800'
                              : log.service === 'network'
                              ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {log.service === 'firestore'
                            ? 'Google Firestore'
                            : log.service === 'hostinger_server'
                            ? 'Hostinger Disk'
                            : log.service === 'network'
                            ? 'Network'
                            : 'System'}
                        </span>

                        {/* Operation Tag */}
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          {log.operation}
                        </span>

                        {/* Status Code (if present) */}
                        {log.statusCode && (
                          <span
                            className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md ${
                              isFailure
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {log.statusCode}
                          </span>
                        )}

                        {/* Latency */}
                        {typeof log.latencyMs === 'number' && (
                          <span className="text-[11px] text-slate-400 font-mono">
                            {log.latencyMs}ms
                          </span>
                        )}
                      </div>

                      {/* Timestamp */}
                      <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(log.timestamp).toLocaleTimeString('ar-SA', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {log.title}
                    </h4>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                      {log.message}
                    </p>
                  </div>
                </div>

                {/* Expanded Technical Details Drawer */}
                {isExpanded && log.details && (
                  <div className="px-5 pb-5 pt-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-slate-400" />
                        التفاصيل التقنية الدقيقة ومسار الوثيقة (Technical Payload & Path):
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyText(log.id, JSON.stringify(log.details, null, 2));
                        }}
                        className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-bold"
                      >
                        {copiedId === log.id ? (
                          <>
                            <Check className="w-3 h-3" /> تم النسخ
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> نسخ التفاصيل
                          </>
                        )}
                      </button>
                    </div>

                    {log.details.targetPath && (
                      <div className="text-xs">
                        <span className="text-slate-400 block text-[11px]">المسار السحابي المستهدف:</span>
                        <code className="text-amber-600 dark:text-amber-400 font-mono font-bold">
                          {log.details.targetPath}
                        </code>
                      </div>
                    )}

                    {log.details.errorMessage && (
                      <div className="text-xs">
                        <span className="text-slate-400 block text-[11px]">رسالة الخطأ الخام:</span>
                        <code className="text-rose-600 dark:text-rose-400 font-mono text-[11px] block bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg border border-rose-200 dark:border-rose-900/60">
                          {log.details.errorMessage}
                        </code>
                      </div>
                    )}

                    {log.details.errorStack && (
                      <div className="text-xs">
                        <span className="text-slate-400 block text-[11px]">سجل التتبع البرمجي (Stack Trace):</span>
                        <pre className="text-[10px] text-slate-400 bg-slate-900 text-slate-200 p-3 rounded-xl overflow-x-auto font-mono max-h-40">
                          {log.details.errorStack}
                        </pre>
                      </div>
                    )}

                    {log.details.raw && (
                      <div className="text-xs">
                        <span className="text-slate-400 block text-[11px]">البيانات الخام (Raw Payload):</span>
                        <pre className="text-[10px] bg-slate-900 text-emerald-300 p-3 rounded-xl overflow-x-auto font-mono max-h-40">
                          {JSON.stringify(log.details.raw, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Educational Architecture Explanation */}
      <div className="bg-slate-100 dark:bg-slate-900/60 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-2">
        <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Info className="w-4 h-4 text-emerald-500" />
          معلومات فنية عن هيكلية المزامنة المزدوجة (Dual-Sync Architecture):
        </h4>
        <p className="leading-relaxed">
          المنظومة مصممة بهيكلية أمان مزدوجة: يتم حفظ كل سند أو مشروع أولاً في الذاكرة المحلية
          (IndexedDB/LocalStorage)، ثم يتم إرساله فوراً إلى مسار الـ API المباشر على قرص سيرفر Hostinger
          (<code className="font-mono text-emerald-600 dark:text-emerald-400">api/state.php</code>).
          مزامنة Google Firestore تعمل كقناة ثانوية للتزامن اللحظي بين الأجهزة. حتى لو توقفت مزامنة
          Firestore بسبب نفاد الحصة اليومية المجانية (Spark Quota Limit: 20k writes) أو انقطاع شبكة
          Google، فإن سيرفر Hostinger يحفظ البيانات كاملة دون أي فقدان أو انقطاع للعمليات.
        </p>
      </div>
    </div>
  );
};
