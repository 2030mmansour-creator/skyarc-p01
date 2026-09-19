/**
 * SkyArc Sync & Network Diagnostics Logger Service
 * Captures, stores, and analyzes all synchronization attempts,
 * Firestore network events, quota restrictions, and server disk operations.
 */

export type SyncLogService = 'firestore' | 'hostinger_server' | 'network' | 'system';

export type SyncLogOperation =
  | 'sync_to_cloud'
  | 'sync_to_cloud_differential'
  | 'sync_to_cloud_batched'
  | 'fetch_from_cloud'
  | 'test_connection'
  | 'probe_write'
  | 'probe_read'
  | 'realtime_listener'
  | 'quota_guard'
  | 'server_save'
  | 'server_fetch'
  | 'server_diagnose'
  | 'network_status';

export type SyncLogStatus = 'success' | 'failure' | 'warning' | 'throttled' | 'info';

export interface SyncLogEntry {
  id: string;
  timestamp: string; // ISO string
  service: SyncLogService;
  operation: SyncLogOperation;
  status: SyncLogStatus;
  statusCode?: string | number;
  title: string;
  message: string;
  latencyMs?: number;
  details?: {
    errorCode?: string;
    errorMessage?: string;
    errorStack?: string;
    targetPath?: string;
    payloadSizeKb?: number;
    itemsCount?: number;
    batchesCount?: number;
    changedExpenses?: number;
    deletedExpenses?: number;
    changedCustodies?: number;
    changedProjects?: number;
    quotaExhaustedUntil?: string;
    projectId?: string;
    databaseId?: string;
    url?: string;
    httpStatus?: number;
    raw?: any;
    [key: string]: any;
  };
}

const STORAGE_KEY = 'skyarc_sync_logs_v1';
const MAX_LOGS = 200;

class SyncLoggerService {
  private logs: SyncLogEntry[] = [];
  private listeners: Set<(logs: SyncLogEntry[]) => void> = new Set();
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;
    this.initialized = true;

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            this.logs = parsed.slice(0, MAX_LOGS);
          }
        }
      } catch (err) {
        console.warn('Could not load sync logs from localStorage:', err);
      }

      // Automatically capture unhandled rejections related to Firestore
      window.addEventListener('unhandledrejection', (e) => {
        const reason = e?.reason;
        const msg = reason?.message || String(reason || '');
        const code = reason?.code || '';
        
        if (
          code.includes('resource-exhausted') ||
          msg.includes('resource-exhausted') ||
          code.includes('permission-denied') ||
          msg.includes('permission-denied') ||
          code.includes('unavailable') ||
          msg.includes('offline') ||
          msg.includes('Firestore')
        ) {
          this.log({
            service: 'firestore',
            operation: 'sync_to_cloud',
            status: 'failure',
            statusCode: code || 'UNHANDLED_PROMISE',
            title: 'خطأ استثناء غير معالج في محرك Firestore',
            message: msg || 'حدث خطأ في عملية سحابية بالخلفية',
            details: {
              errorCode: code,
              errorMessage: msg,
              errorStack: reason?.stack
            }
          });
        }
      });

      // Capture browser connectivity changes
      window.addEventListener('online', () => {
        this.log({
          service: 'network',
          operation: 'network_status',
          status: 'info',
          title: 'استعادة الاتصال بالإنترنت (Online)',
          message: 'تم رصد عودة اتصال جهاز المستخدم بالشبكة العامة بنجاح.'
        });
      });

      window.addEventListener('offline', () => {
        this.log({
          service: 'network',
          operation: 'network_status',
          status: 'warning',
          statusCode: 'OFFLINE',
          title: 'انقطاع الاتصال بالإنترنت (Offline)',
          message: 'انقطع اتصال الجهاز بالشبكة. النظام يعمل الآن بوضع الأوفلاين المحلي دون فقدان للبيانات.'
        });
      });

      // Initial log entry if empty
      if (this.logs.length === 0) {
        this.log({
          service: 'system',
          operation: 'network_status',
          status: 'info',
          title: 'بدء تشغيل مسجل التشخيص وسجلات المزامنة',
          message: 'تم تفعيل مسجل الأحداث التشخيصي لمراقبة اتصالات Firestore وسيرفر النظام.'
        });
      }
    }
  }

  public log(entry: Omit<SyncLogEntry, 'id' | 'timestamp'> & { timestamp?: string }): SyncLogEntry {
    const newEntry: SyncLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
      ...entry
    };

    this.logs.unshift(newEntry);
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(0, MAX_LOGS);
    }

    this.persist();
    this.notify();
    return newEntry;
  }

  public getLogs(): SyncLogEntry[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
    this.persist();
    this.notify();
    this.log({
      service: 'system',
      operation: 'network_status',
      status: 'info',
      title: 'تم مسح السجلات',
      message: 'تم مسح كافة سجلات المزامنة السابقة وبدء جلسة تشخيص جديدة.'
    });
  }

  public subscribe(listener: (logs: SyncLogEntry[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.logs]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const snapshot = [...this.logs];
    this.listeners.forEach((l) => {
      try {
        l(snapshot);
      } catch (e) {
        console.error('Error notifying sync log listener:', e);
      }
    });
  }

  private persist() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs.slice(0, 150)));
    } catch {
      // Local storage limit safe
    }
  }

  public exportLogsAsJson(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        totalLogs: this.logs.length,
        logs: this.logs
      },
      null,
      2
    );
  }

  public exportLogsAsText(): string {
    const lines = [
      `=== تقرير سجلات المزامنة والشبكة (SkyArc Sync Diagnostic Logs) ===`,
      `تاريخ التصدير: ${new Date().toLocaleString('ar-SA')}`,
      `عدد السجلات: ${this.logs.length}`,
      `----------------------------------------------------------------------`
    ];

    for (const log of this.logs) {
      lines.push(
        `[${new Date(log.timestamp).toLocaleTimeString('ar-SA')}] [${log.service.toUpperCase()}] [${log.status.toUpperCase()}] - ${log.title}`
      );
      lines.push(`  العملية: ${log.operation} | الكود: ${log.statusCode || 'N/A'}${log.latencyMs ? ` | المدة: ${log.latencyMs}ms` : ''}`);
      lines.push(`  الرسالة: ${log.message}`);
      if (log.details) {
        if (log.details.targetPath) lines.push(`  المسار: ${log.details.targetPath}`);
        if (log.details.errorCode) lines.push(`  رمز الخطأ: ${log.details.errorCode}`);
        if (log.details.errorMessage) lines.push(`  تفاصيل الخطأ: ${log.details.errorMessage}`);
      }
      lines.push(`----------------------------------------------------------------------`);
    }

    return lines.join('\n');
  }

  public getStats() {
    const total = this.logs.length;
    const failures = this.logs.filter((l) => l.status === 'failure').length;
    const successes = this.logs.filter((l) => l.status === 'success').length;
    const warnings = this.logs.filter((l) => l.status === 'warning' || l.status === 'throttled').length;
    const firestoreErrors = this.logs.filter(
      (l) => l.service === 'firestore' && (l.status === 'failure' || l.status === 'throttled')
    ).length;
    const serverErrors = this.logs.filter((l) => l.service === 'hostinger_server' && l.status === 'failure').length;

    return {
      total,
      failures,
      successes,
      warnings,
      firestoreErrors,
      serverErrors,
      errorRate: total > 0 ? Math.round((failures / total) * 100) : 0
    };
  }

  /**
   * Evaluates recent logs and returns actionable technical insights
   * on why Firestore synchronization might have stopped.
   */
  public diagnoseCurrentStatus(): {
    hasIssue: boolean;
    primaryCause: string;
    details: string;
    recommendedAction: string;
    severity: 'error' | 'warning' | 'info' | 'success';
  } {
    const recentLogs = this.logs.slice(0, 30);
    const quotaLogs = recentLogs.filter(
      (l) =>
        l.statusCode === 'resource-exhausted' ||
        l.message?.includes('resource-exhausted') ||
        l.message?.includes('الحد اليومي') ||
        l.title?.includes('الحصة')
    );

    if (quotaLogs.length > 0) {
      return {
        hasIssue: true,
        primaryCause: 'تم استنفاد الحصة اليومية المجانية لكتابة Firestore (Resource Exhausted)',
        details:
          'مشروع Firebase يعمل على الخطة المجانية (Spark Plan) والتي تتيح 20,000 عملية كتابة يومياً فقط. عند تجاوزها يتم إيقاف الكتابة مؤقتاً تلقائياً لحماية النظام.',
        recommendedAction:
          '1) استخدم زر "إلغاء حظر الحصة" في هذه الصفحة لاختبار الاتصال الفوري. 2) اعتمد على سيرفر Hostinger القرصي المباشر الذي تم ربطه بنجاح والذي يوفر سعة غير محدودة دون قيود الحصص.',
        severity: 'warning'
      };
    }

    const permissionLogs = recentLogs.filter(
      (l) =>
        l.statusCode === 'permission-denied' ||
        l.message?.includes('permission-denied') ||
        l.message?.includes('Missing or insufficient permissions')
    );

    if (permissionLogs.length > 0) {
      return {
        hasIssue: true,
        primaryCause: 'رفض الصلاحيات في قواعد أمان Firestore (Permission Denied)',
        details:
          'قواعد الحماية (firestore.rules) ترفض عملية القراءة أو الكتابة على مسار الوثيقة المطلوبة.',
        recommendedAction:
          'التحقق من ملف firestore.rules والتأكد من وجود قاعدة allow read, write: if true; للمسارات المستخدمة مثل /system_state/{docId}.',
        severity: 'error'
      };
    }

    const offlineLogs = recentLogs.filter(
      (l) =>
        l.statusCode === 'client-offline' ||
        l.statusCode === 'unavailable' ||
        l.message?.includes('the client is offline') ||
        l.message?.includes('Failed to get document because the client is offline')
    );

    if (offlineLogs.length > 0) {
      return {
        hasIssue: true,
        primaryCause: 'عميل Firestore في وضع عدم الاتصال (Client is Offline)',
        details:
          'مكتبة Firestore إما تم تعطيل شبكتها برمجياً (disableNetwork) أو أن خوادم Google غير متاحة مؤقتاً من المتصفح.',
        recommendedAction:
          'انقر على زر "إعادة تهيئة شبكة Firestore" في هذه الصفحة لإعادة استدعاء enableNetwork(db) فوراً.',
        severity: 'warning'
      };
    }

    const docSizeLogs = recentLogs.filter(
      (l) =>
        l.message?.includes('exceeds the maximum allowed size') ||
        l.message?.includes('1048576 bytes') ||
        l.message?.includes('1MB')
    );

    if (docSizeLogs.length > 0) {
      return {
        hasIssue: true,
        primaryCause: 'تجاوز حجم الوثيقة المركزية حد 1 ميجابايت (Doc Size Limit)',
        details:
          'وثائق Firestore مقيدة بحد أقصى 1,048,576 بايت. تم تفعيل نظام التجزئة التلقائي (Chunking) لمعالجة ذلك.',
        recommendedAction:
          'تأكد من عدم تخزين صور الفواتير الكبيرة بصيغة Base64 داخل الوثيقة المركزية.',
        severity: 'error'
      };
    }

    return {
      hasIssue: false,
      primaryCause: 'لا توجد أخطاء حرجة مسجلة مؤخراً',
      details: 'المزامنة السحابية وقاعدة البيانات تعملان بشكل اعتيادي دون أخطاء حظر مستمرة.',
      recommendedAction: 'يمكنك استخدام أدوات الاختبار المباشرة أدناه لإرسال حزمة فحص والتأكد من الاستجابة.',
      severity: 'success'
    };
  }
}

export const syncLogger = new SyncLoggerService();
