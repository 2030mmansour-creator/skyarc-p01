/**
 * SkyArc Server-Side Persistence & Real-time Synchronization Service
 * Ensures all projects, expenses, custodies, and settings are saved directly
 * to the server's disk storage and shared across all devices & users.
 * Supports Node.js Express (/api/state) and Hostinger / LiteSpeed / Apache PHP (/api/state.php).
 */

import { syncLogger } from './syncLogger';
import { StorageService } from './storage';
import { PCloudService } from './pcloudService';

export interface ServerStateResponse {
  success: boolean;
  exists: boolean;
  data: any | null;
  lastModified?: string;
  version?: number;
  storageFile?: string;
  sessionEvicted?: boolean;
  activeSession?: any;
  stats?: {
    expenses: number;
    projects: number;
    custodies: number;
    users: number;
  };
  error?: string;
}

export interface ServerInfoResponse {
  status: string;
  mode: string;
  serverEngine?: string;
  exists: boolean;
  fileSizeKb: number;
  lastModified: string | null;
  version: number;
  expensesCount: number;
  projectsCount: number;
  usersCount: number;
  storageFile?: string;
  isWritable?: boolean;
  phpVersion?: string;
  postMaxSize?: string;
}

export interface ServerDiagnosticResult {
  success: boolean;
  workingUrl: string | null;
  engine: string;
  storageFile: string;
  isWritable: boolean;
  latencyMs: number;
  details: string;
  rawResponse?: any;
}

let serverSyncDebounceTimer: any = null;
let pendingServerPayload: any = null;
let lastSyncedPayloadHash: string = '';
let currentServerVersion: number = 0;
let isServerConnectedState: boolean = true;
let lastServerSyncTimestamp: string | null = null;
let lastServerSyncError: string | null = null;
let verifiedWorkingApiEndpoint: string | null = null;
let isServerSavingState: boolean = false;
let serverSavingListeners: Array<(isSaving: boolean) => void> = [];
let sessionEvictedListeners: Array<(activeSessionInfo?: any) => void> = [];

export function subscribeToSavingState(cb: (isSaving: boolean) => void): () => void {
  serverSavingListeners.push(cb);
  try { cb(isServerSavingState); } catch {}
  return () => {
    serverSavingListeners = serverSavingListeners.filter(l => l !== cb);
  };
}

export function subscribeToSessionEvicted(cb: (activeSessionInfo?: any) => void): () => void {
  sessionEvictedListeners.push(cb);
  return () => {
    sessionEvictedListeners = sessionEvictedListeners.filter(l => l !== cb);
  };
}

function notifySessionEvicted(activeSessionInfo?: any) {
  sessionEvictedListeners.forEach(cb => {
    try { cb(activeSessionInfo); } catch {}
  });
}

function setSavingState(saving: boolean) {
  isServerSavingState = saving;
  serverSavingListeners.forEach(cb => {
    try { cb(saving); } catch {}
  });
}

// Resolve candidate API endpoints for Node.js, Hostinger PHP, and subdirectories
function getCandidateEndpoints(action: string): string[] {
  const candidates: string[] = [];

  // 1. If we already verified a working endpoint prefix in this session or localStorage, prioritize it
  const cached = verifiedWorkingApiEndpoint || (typeof localStorage !== 'undefined' ? localStorage.getItem('skyarc_working_api_prefix') : null);
  if (cached) {
    if (cached.includes('.php')) {
      candidates.push(cached.replace(/state\.php$/, `${action}.php`).replace(/server-info\.php$/, `${action}.php`).replace(/session\.php$/, `${action}.php`));
    } else {
      candidates.push(`${cached}/${action}`);
      candidates.push(`${cached}/${action}.php`);
    }
  }

  // 2. Primary clean rewrite candidates (Node.js Express or Vite API router)
  candidates.push(`/api/${action}`);
  candidates.push(`api/${action}`);
  candidates.push(`./api/${action}`);

  // 3. Direct PHP candidates (On Hostinger LiteSpeed/Apache)
  candidates.push(`/api/${action}.php`);
  candidates.push(`api/${action}.php`);
  candidates.push(`./api/${action}.php`);

  // 4. Subdirectory hosting support (e.g. hostinger.com/subfolder/)
  if (typeof window !== 'undefined' && window.location.pathname.length > 1) {
    const rawPath = window.location.pathname;
    const dir = rawPath.substring(0, rawPath.lastIndexOf('/') + 1);
    if (dir && dir !== '/') {
      const cleanDir = dir.endsWith('/') ? dir : dir + '/';
      candidates.push(`${cleanDir}api/${action}`);
      candidates.push(`${cleanDir}api/${action}.php`);
    }
  }

  // Deduplicate candidates preserving priority order
  return Array.from(new Set(candidates));
}

// Fetch helper that safely queries candidate endpoints, rejects HTML responses, and returns parsed JSON
async function fetchCandidateJson(
  action: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: any; url: string; error?: string }> {
  const candidates = getCandidateEndpoints(action);
  let lastError = 'تعذر الوصول إلى مسار السيرفر';
  let lastStatus = 0;

  // Retrieve current active user session headers
  const authSession = StorageService.getAuthSession();
  const sessionHeaders: Record<string, string> = {};
  if (authSession?.userId) {
    sessionHeaders['X-User-Id'] = authSession.userId;
  }
  if (authSession?.sessionId) {
    sessionHeaders['X-Session-Id'] = authSession.sessionId;
  }

  const mergedHeaders = {
    ...sessionHeaders,
    ...(options.headers || {})
  };

  for (const url of candidates) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(url, {
        ...options,
        headers: mergedHeaders,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      lastStatus = res.status;
      const text = await res.text().catch(() => '');

      // Check if server returned an HTML error page, directory listing, or SPA index.html
      const trimmed = text.trim();
      if (
        trimmed.startsWith('<!DOCTYPE') ||
        trimmed.startsWith('<!doctype') ||
        trimmed.startsWith('<html') ||
        trimmed.startsWith('<br') ||
        trimmed.startsWith('<head')
      ) {
        // Returned HTML (e.g. mod_rewrite sent request to index.html because script was not found)
        continue;
      }

      // Try parsing JSON
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Not valid JSON, skip this candidate
        continue;
      }

      if (parsed && typeof parsed === 'object') {
        // Check if server indicated session eviction
        if (parsed.sessionEvicted === true) {
          notifySessionEvicted(parsed.activeSession);
          return {
            ok: false,
            status: res.status || 403,
            data: parsed,
            url,
            error: 'SESSION_EVICTED'
          };
        }

        if (res.ok || parsed.success === true) {
          // Success! Save working endpoint prefix for immediate future queries
          if (url.includes('.php')) {
            verifiedWorkingApiEndpoint = url;
            try { localStorage.setItem('skyarc_working_api_prefix', url); } catch {}
          } else {
            const prefix = url.substring(0, url.lastIndexOf('/'));
            verifiedWorkingApiEndpoint = prefix || '/api';
            try { localStorage.setItem('skyarc_working_api_prefix', verifiedWorkingApiEndpoint); } catch {}
          }

          return { ok: true, status: res.status, data: parsed, url };
        } else {
          lastError = parsed.error || parsed.message || `خطأ استجابة من السيرفر (كود ${res.status})`;
          // If the server deliberately responded with structured JSON (e.g. 400 Bad Request or validation failure), return it directly
          if (res.status === 400 || res.status === 422 || parsed.isPubLink !== undefined) {
            return { ok: false, status: res.status, data: parsed, url, error: lastError };
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        lastError = 'انتهت مهلة الاتصال بالسيرفر';
      } else {
        lastError = err?.message || 'تعذر الاتصال بالسيرفر';
      }
    }
  }

  return { ok: false, status: lastStatus, data: null, url: candidates[0], error: lastError };
}

// Ensure payload size stays safely under Hostinger post_max_size (usually 8M-16M)
function sanitizePayloadForServer(data: any): any {
  if (!data || typeof data !== 'object') return data;
  try {
    const rawJson = JSON.stringify(data);
    // If payload is well under 6MB, send the entire untouched database with photos
    if (rawJson.length < 6 * 1024 * 1024) {
      return data;
    }

    // Retain invoicePhoto fully so attachments are never pruned and are visible to all team members
    const clone = { ...data };
    if (Array.isArray(clone.expenses)) {
      clone.expenses = clone.expenses.map((e: any) => {
        if (e.invoicePhoto && typeof e.invoicePhoto === 'string') {
          return {
            ...e,
            invoicePhoto: e.invoicePhoto,
            invoice_url: e.invoice_url || e.invoicePhoto,
            hasAttachment: true
          };
        }
        return e;
      });
    }
    return clone;
  } catch {
    return data;
  }
}

// Accurate change-detection hash function that catches expense status changes, notes, amounts, custodies, projects, and deletions
function computeDataHash(data: any): string {
  try {
    let expenseSum = 0;
    let expenseStatusSample = '';
    if (Array.isArray(data.expenses)) {
      const len = data.expenses.length;
      for (let i = 0; i < len; i++) {
        const e = data.expenses[i];
        expenseSum += (Number(e.amount) || 0);
        if (i < 25 || i > len - 25 || i % 7 === 0) {
          expenseStatusSample += `${e.id}:${e.status}:${e.erpPostingStatus || ''}:${e.updatedAt || ''};`;
        }
      }
    }

    const deletedCount = data.deletedExpenseIds && typeof data.deletedExpenseIds === 'object'
      ? Object.keys(data.deletedExpenseIds).length
      : 0;
    const deletedSample = data.deletedExpenseIds && typeof data.deletedExpenseIds === 'object'
      ? Object.keys(data.deletedExpenseIds).slice(-5).join(',')
      : '';

    const deletedCustodiesCount = data.deletedCustodyIds && typeof data.deletedCustodyIds === 'object'
      ? Object.keys(data.deletedCustodyIds).length
      : 0;
    const deletedProjectsCount = data.deletedProjectIds && typeof data.deletedProjectIds === 'object'
      ? Object.keys(data.deletedProjectIds).length
      : 0;
    const deletedUsersCount = data.deletedUserIds && typeof data.deletedUserIds === 'object'
      ? Object.keys(data.deletedUserIds).length
      : 0;

    let custodySum = 0;
    if (Array.isArray(data.custodies)) {
      for (let i = 0; i < data.custodies.length; i++) {
        custodySum += (Number(data.custodies[i].amount) || 0);
      }
    }

    let projectStatusSample = '';
    if (Array.isArray(data.projects)) {
      for (let i = 0; i < data.projects.length; i++) {
        const p = data.projects[i];
        projectStatusSample += `${p.id}:${p.status}:${p.budget};`;
      }
    }

    return [
      data.projects?.length || 0,
      data.expenses?.length || 0,
      deletedCount,
      deletedSample,
      deletedCustodiesCount,
      deletedProjectsCount,
      deletedUsersCount,
      expenseSum,
      expenseStatusSample,
      custodySum,
      projectStatusSample,
      data.custodies?.length || 0,
      data.users?.length || 0,
      data.tickets?.length || 0,
      data.notifications?.length || 0,
      data.workflowStages?.length || 0,
      data.settings?.updatedAt || data.settings?.companyName || ''
    ].join('|');
  } catch {
    return String(Date.now());
  }
}

// Flush pending server save on window unload or hidden visibility
if (typeof window !== 'undefined') {
  const handleFlushOnExit = () => {
    if (pendingServerPayload) {
      const { data, updatedBy } = pendingServerPayload;
      pendingServerPayload = null;
      try {
        const safeData = sanitizePayloadForServer(data);
        const payload = JSON.stringify({
          data: safeData,
          updatedBy,
          timestamp: new Date().toISOString(),
          clientVersion: currentServerVersion
        });
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: 'application/json' });
          const targetUrl = verifiedWorkingApiEndpoint && verifiedWorkingApiEndpoint.includes('.php')
            ? verifiedWorkingApiEndpoint.replace(/server-info\.php$/, 'state.php')
            : 'api/state.php';
          navigator.sendBeacon(targetUrl, blob);
        }
      } catch {
        // best effort on exit
      }
    }
  };

  window.addEventListener('beforeunload', handleFlushOnExit);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && pendingServerPayload) {
      handleFlushOnExit();
    }
  });
}

export const ServerSyncService = {
  // Check if server is reachable and get server storage status
  async checkServerStatus(): Promise<{ success: boolean; info?: ServerInfoResponse; error?: string }> {
    try {
      const result = await fetchCandidateJson('server-info', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });

      if (!result.ok || !result.data) {
        isServerConnectedState = false;
        lastServerSyncError = result.error || 'السيرفر غير متاح';
        return { success: false, error: lastServerSyncError };
      }

      const info: ServerInfoResponse = result.data;
      isServerConnectedState = true;
      lastServerSyncError = null;

      if (info.version) {
        currentServerVersion = info.version;
      }
      if (info.lastModified) {
        lastServerSyncTimestamp = info.lastModified;
      }
      return { success: true, info };
    } catch (err: any) {
      isServerConnectedState = false;
      lastServerSyncError = err?.message || 'Server unreachable';
      return { success: false, error: lastServerSyncError };
    }
  },

  // Quick lightweight heartbeat to check if remote state changed on server disk without downloading full DB
  async checkServerTimestamp(): Promise<{ success: boolean; lastModified: string | null; version?: number; exists: boolean }> {
    try {
      const result = await fetchCandidateJson('state/timestamp', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });

      if (result.ok && result.data && result.data.success) {
        return {
          success: true,
          lastModified: result.data.lastModified || null,
          version: result.data.version || 0,
          exists: Boolean(result.data.exists)
        };
      }

      // Fallback to server-info
      const infoRes = await this.checkServerStatus();
      if (infoRes.success && infoRes.info) {
        return {
          success: true,
          lastModified: infoRes.info.lastModified,
          version: infoRes.info.version,
          exists: infoRes.info.exists
        };
      }

      return { success: false, lastModified: null, exists: false };
    } catch {
      return { success: false, lastModified: null, exists: false };
    }
  },

  isServerConnected(): boolean {
    return isServerConnectedState;
  },

  isSavingToServer(): boolean {
    return isServerSavingState;
  },

  subscribeToSavingState(cb: (isSaving: boolean) => void): () => void {
    return subscribeToSavingState(cb);
  },

  getLastSyncTimestamp(): string | null {
    return lastServerSyncTimestamp || localStorage.getItem('skyarc_last_server_sync');
  },

  getLastSyncError(): string | null {
    return lastServerSyncError;
  },

  getServerVersion(): number {
    return currentServerVersion;
  },

  getWorkingEndpoint(): string | null {
    return verifiedWorkingApiEndpoint;
  },

  // Complete end-to-end diagnostic test
  async diagnoseServerConnection(): Promise<ServerDiagnosticResult> {
    const startTime = Date.now();
    try {
      // 1. Probe server info
      const infoRes = await fetchCandidateJson('server-info', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });

      const latencyMs = Date.now() - startTime;

      if (infoRes.ok && infoRes.data) {
        const info = infoRes.data;
        isServerConnectedState = true;
        return {
          success: true,
          workingUrl: infoRes.url,
          engine: info.serverEngine || (info.mode === 'hostinger_php_disk_storage' ? 'Hostinger PHP Engine' : 'Node.js Express'),
          storageFile: info.storageFile || 'system_state.json',
          isWritable: info.isWritable !== false,
          latencyMs,
          details: `تم الاتصال بنجاح بالمسار (${infoRes.url})، ملف التخزين (${info.storageFile || 'system_state.json'}) بحجم ${info.fileSizeKb || 0} ك.ب وهو قابل للكتابة.`,
          rawResponse: info
        };
      }

      // 2. Try pinging state directly
      const stateRes = await fetchCandidateJson('state', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });

      if (stateRes.ok && stateRes.data) {
        isServerConnectedState = true;
        return {
          success: true,
          workingUrl: stateRes.url,
          engine: 'Hostinger API',
          storageFile: stateRes.data.storageFile || 'system_state.json',
          isWritable: true,
          latencyMs: Date.now() - startTime,
          details: `تم الاتصال بنجاح بالمسار (${stateRes.url})، قاعدة البيانات متصلة وجاهزة للحفظ.`,
          rawResponse: stateRes.data
        };
      }

      isServerConnectedState = false;
      return {
        success: false,
        workingUrl: null,
        engine: 'غير متصل',
        storageFile: 'تعذر التحديد',
        isWritable: false,
        latencyMs: Date.now() - startTime,
        details: infoRes.error || stateRes.error || 'تعذر الوصول إلى أي من مسارات الـ API (api/state.php أو api/state). يرجى التأكد من رفع مجلد api وملف .htaccess إلى المجلد الرئيسي في Hostinger (public_html).',
        rawResponse: { infoError: infoRes.error, stateError: stateRes.error }
      };
    } catch (err: any) {
      isServerConnectedState = false;
      return {
        success: false,
        workingUrl: null,
        engine: 'خطأ اتصال',
        storageFile: 'تعذر التحديد',
        isWritable: false,
        latencyMs: Date.now() - startTime,
        details: err?.message || 'حدث استثناء غير متوقع أثناء فحص السيرفر',
        rawResponse: err
      };
    }
  },

  // Fetch current system state from the server disk storage
  async fetchServerState(): Promise<ServerStateResponse> {
    try {
      const result = await fetchCandidateJson('state', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        cache: 'no-store'
      });

      if (!result.ok || !result.data) {
        isServerConnectedState = false;
        lastServerSyncError = result.error || 'فشل الاتصال بقاعدة بيانات السيرفر';
        return {
          success: false,
          exists: false,
          data: null,
          error: lastServerSyncError
        };
      }

      const resData = result.data;
      isServerConnectedState = true;
      lastServerSyncError = null;

      if (resData.success && resData.exists && resData.data) {
        if (resData.version) currentServerVersion = resData.version;
        if (resData.lastModified) {
          lastServerSyncTimestamp = resData.lastModified;
          try { localStorage.setItem('skyarc_last_server_sync', resData.lastModified); } catch {}
        }
        lastSyncedPayloadHash = computeDataHash(resData.data);
      }

      return resData;
    } catch (err: any) {
      isServerConnectedState = false;
      lastServerSyncError = err?.message || 'تعذر الوصول إلى خادم النظام';
      return {
        success: false,
        exists: false,
        data: null,
        error: lastServerSyncError
      };
    }
  },

  // Save full system state directly to server disk storage
  async saveServerState(
    data: any,
    updatedBy: string = 'مستخدم النظام',
    force: boolean = false
  ): Promise<{ success: boolean; savedAt?: string; version?: number; storageLocation?: string; error?: string }> {
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'بيانات غير صالحة للحفظ على السيرفر' };
    }

    const currentHash = computeDataHash(data);
    if (!force && lastSyncedPayloadHash && lastSyncedPayloadHash === currentHash) {
      return {
        success: true,
        savedAt: lastServerSyncTimestamp || new Date().toISOString(),
        version: currentServerVersion
      };
    }

    setSavingState(true);
    try {
      const safeData = sanitizePayloadForServer(data);

      const payload = {
        data: safeData,
        updatedBy,
        timestamp: new Date().toISOString(),
        clientVersion: currentServerVersion
      };

      const result = await fetchCandidateJson('state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!result.ok || !result.data) {
        isServerConnectedState = false;
        lastServerSyncError = result.error || 'فشل حفظ البيانات على السيرفر';
        syncLogger.log({
          service: 'hostinger_server',
          operation: 'server_save',
          status: 'failure',
          statusCode: result.status || 'ERR',
          title: 'فشل الحفظ على سيرفر النظام القرصي',
          message: lastServerSyncError,
          details: { url: result.url }
        });
        return { success: false, error: lastServerSyncError };
      }

      const res = result.data;
      if (res.success) {
        isServerConnectedState = true;
        lastServerSyncError = null;
        lastSyncedPayloadHash = currentHash;
        if (res.version) currentServerVersion = res.version;
        if (res.savedAt) {
          lastServerSyncTimestamp = res.savedAt;
          try { localStorage.setItem('skyarc_last_server_sync', res.savedAt); } catch {}
        }
        syncLogger.log({
          service: 'hostinger_server',
          operation: 'server_save',
          status: 'success',
          title: 'حفظ ناجح على سيرفر النظام',
          message: `تم حفظ نسخة فورية على قرص السيرفر (${res.storageLocation || 'api/storage/system_state.json'}).`,
          details: {
            url: result.url,
            raw: { version: res.version, savedAt: res.savedAt }
          }
        });
        return {
          success: true,
          savedAt: res.savedAt,
          version: res.version,
          storageLocation: res.storageLocation
        };
      }

      isServerConnectedState = false;
      lastServerSyncError = res.error || 'فشل حفظ البيانات على السيرفر';
      syncLogger.log({
        service: 'hostinger_server',
        operation: 'server_save',
        status: 'failure',
        title: 'رفض السيرفر حفظ البيانات',
        message: lastServerSyncError,
        details: { url: result.url, raw: res }
      });
      return { success: false, error: lastServerSyncError };
    } catch (err: any) {
      isServerConnectedState = false;
      lastServerSyncError = err?.message || 'تعذر إرسال البيانات إلى السيرفر';
      syncLogger.log({
        service: 'hostinger_server',
        operation: 'server_save',
        status: 'failure',
        title: 'استثناء أثناء الإرسال للسيرفر',
        message: lastServerSyncError,
        details: { errorMessage: err?.message, errorStack: err?.stack }
      });
      return { success: false, error: lastServerSyncError };
    } finally {
      setSavingState(false);
    }
  },

  // Save incremental delta updates (Delta Sync) rather than sending all data
  async saveServerDelta(
    deltas: {
      expenses?: any[];
      projects?: any[];
      custodies?: any[];
      users?: any[];
      settings?: any;
      deletedExpenseIds?: Record<string, boolean>;
    },
    updatedBy: string = 'مستخدم النظام'
  ): Promise<{ success: boolean; savedAt?: string; version?: number; error?: string }> {
    setSavingState(true);
    try {
      const payload = {
        deltas,
        lastSyncedAt: lastServerSyncTimestamp,
        updatedBy,
        timestamp: new Date().toISOString(),
        clientVersion: currentServerVersion
      };

      const result = await fetchCandidateJson('sync/delta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!result.ok || !result.data || !result.data.success) {
        // Fallback to full save if delta endpoint is unavailable
        return await this.saveServerState(deltas, updatedBy, true);
      }

      const res = result.data;
      isServerConnectedState = true;
      lastServerSyncError = null;
      if (res.version) currentServerVersion = res.version;
      if (res.savedAt) {
        lastServerSyncTimestamp = res.savedAt;
        try { localStorage.setItem('skyarc_last_server_sync', res.savedAt); } catch {}
      }

      syncLogger.log({
        service: 'hostinger_server',
        operation: 'incremental_delta_sync' as any,
        status: 'success',
        title: 'مزامنة انتقائية ناجحة (Delta Sync)',
        message: `تم إرسال التغييرات فقط وتحديث السيرفر بنجاح (الإصدار ${res.version}).`,
        details: { url: result.url, version: res.version }
      });

      return { success: true, savedAt: res.savedAt, version: res.version };
    } catch (err: any) {
      isServerConnectedState = false;
      lastServerSyncError = err?.message || 'تعذر إرسال التغييرات الانتقائية';
      return { success: false, error: lastServerSyncError };
    } finally {
      setSavingState(false);
    }
  },

  // Debounced auto-save to server (smoothly batches state changes)
  saveServerStateDebounced(
    data: any,
    updatedBy: string = 'مستخدم النظام',
    delayMs: number = 1500,
    onSuccess?: (savedAt: string) => void,
    onError?: (error: string) => void
  ): void {
    pendingServerPayload = { data, updatedBy };
    setSavingState(true);

    if (serverSyncDebounceTimer) {
      clearTimeout(serverSyncDebounceTimer);
    }

    serverSyncDebounceTimer = setTimeout(async () => {
      if (!pendingServerPayload) return;
      const { data: d, updatedBy: u } = pendingServerPayload;
      pendingServerPayload = null;

      const res = await ServerSyncService.saveServerState(d, u);
      if (res.success && res.savedAt) {
        onSuccess?.(res.savedAt);
      } else if (!res.success && res.error) {
        onError?.(res.error);
      }
    }, delayMs);
  },

  // Trigger immediate flush of any pending server save
  async flushPendingSave(): Promise<void> {
    if (serverSyncDebounceTimer) {
      clearTimeout(serverSyncDebounceTimer);
      serverSyncDebounceTimer = null;
    }
    if (pendingServerPayload) {
      const { data, updatedBy } = pendingServerPayload;
      pendingServerPayload = null;
      await this.saveServerState(data, updatedBy);
    }
  },

  // Create a backup snapshot directly on the server disk
  async createServerBackup(data?: any, label?: string): Promise<{ success: boolean; filename?: string; error?: string }> {
    try {
      const result = await fetchCandidateJson('backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, label })
      });
      if (!result.ok || !result.data) {
        return { success: false, error: result.error || 'تعذر إنشاء نسخة احتياطية' };
      }
      return result.data;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to create server backup' };
    }
  },

  // List all backup files stored on the server disk
  async listServerBackups(): Promise<{ success: boolean; backups: any[]; error?: string }> {
    try {
      const result = await fetchCandidateJson('backups', { method: 'GET' });
      if (!result.ok || !result.data) return { success: false, backups: [], error: result.error };
      return result.data;
    } catch (err: any) {
      return { success: false, backups: [], error: err?.message };
    }
  },

  // Restore state from a server-side backup file
  async restoreServerBackup(filename: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const result = await fetchCandidateJson('restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      if (!result.ok || !result.data) return { success: false, error: result.error };
      const res = result.data;
      if (res.success && res.data) {
        lastSyncedPayloadHash = computeDataHash(res.data);
      }
      return res;
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  },

  // Trigger daily backup creation (stored on server disk and uploaded to pCloud)
  async runDailyBackup(fullState?: any, pcloudUrl?: string): Promise<{
    success: boolean;
    pcloudUploaded?: boolean;
    pcloudConfigured?: boolean;
    pcloudFiles?: string[];
    pcloudError?: string | null;
    message: string;
    excelFileName?: string;
    jsonFileName?: string;
    excelSizeKb?: number;
    jsonSizeKb?: number;
    error?: string;
  }> {
    try {
      const result = await fetchCandidateJson('backup/run-daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullState, pcloudUrl })
      });
      if (result.ok && result.data && result.data.success) {
        return result.data;
      }
    } catch (err: any) {
      console.warn('[runDailyBackup] Server call failed, trying direct pCloud upload:', err);
    }

    // Direct fallback if pcloudUrl is supplied
    if (pcloudUrl) {
      const pcloudRes = await this.uploadDailyBackupToPCloud(pcloudUrl, fullState);
      if (pcloudRes.success) {
        return {
          success: true,
          pcloudUploaded: true,
          pcloudConfigured: true,
          pcloudFiles: pcloudRes.uploadedFiles || [
            pcloudRes.excelFileName || `حزمة_مصنف_إكسل_الشامل_${new Date().toISOString().slice(0, 10)}.xlsx`,
            pcloudRes.jsonFileName || `نسخة_احتياطية_كاملة_${new Date().toISOString().slice(0, 10)}.json`
          ],
          message: pcloudRes.message || 'تم بنجاح رفع حزمة إكسل والنسخة الاحتياطية إلى سحابة pCloud مباشرة!',
          excelFileName: pcloudRes.excelFileName || `حزمة_مصنف_إكسل_الشامل_${new Date().toISOString().slice(0, 10)}.xlsx`,
          jsonFileName: pcloudRes.jsonFileName || `نسخة_احتياطية_كاملة_${new Date().toISOString().slice(0, 10)}.json`
        };
      }
    }

    return {
      success: false,
      message: 'تعذر تشغيل النسخ الاحتياطي اليومي عبر الخادم.',
      error: 'تعذر الاتصال بالخادم.'
    };
  },

  // Alias for backward compatibility
  async sendDailyBackupEmail(_recipientEmail?: string, fullState?: any, pcloudUrl?: string): Promise<{
    success: boolean;
    emailSent?: boolean;
    pcloudUploaded?: boolean;
    pcloudConfigured?: boolean;
    pcloudFiles?: string[];
    pcloudError?: string | null;
    message: string;
    excelFileName?: string;
    jsonFileName?: string;
    excelSizeKb?: number;
    jsonSizeKb?: number;
    error?: string;
  }> {
    const res = await this.runDailyBackup(fullState, pcloudUrl);
    return {
      ...res,
      emailSent: false
    };
  },

  // Upload daily backup directly to a pCloud Upload Link (File Request) or via Access Token
  async uploadDailyBackupToPCloud(
    link?: string,
    fullState?: any,
    token?: string
  ): Promise<{
    success: boolean;
    isPubLink?: boolean;
    pcloudUploaded?: boolean;
    uploadedFiles?: string[];
    excelFileName?: string;
    jsonFileName?: string;
    dateStr?: string;
    message?: string;
    error?: string;
  }> {
    // 1. Try server endpoint first
    try {
      const result = await fetchCandidateJson('backup/upload-pcloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link, fullState, token })
      });
      if (result.ok && result.data && result.data.success === true) {
        return {
          ...result.data,
          success: true
        };
      }
      if (result.data && result.data.isPubLink) {
        return {
          ...result.data,
          success: false
        };
      }
    } catch {
      // Server endpoint not reachable, fallback to direct browser upload below
    }

    // 2. Direct browser upload fallback (works on any static, Vercel, or serverless environment!)
    if (link) {
      try {
        const code = PCloudService.extractCode(link);
        if (code) {
          const state = fullState || StorageService.load() || {};
          const dateStr = new Date().toISOString().slice(0, 10);
          const jsonFileName = `نسخة_احتياطية_كاملة_${dateStr}.json`;
          const excelFileName = `حزمة_مصنف_إكسل_الشامل_${dateStr}.xlsx`;

          // Generate JSON Backup
          const jsonString = JSON.stringify(state, null, 2);
          const jsonBlob = new Blob([jsonString], { type: 'application/json' });

          // Generate Comprehensive Excel Workbook (.xlsx)
          const excelBlob = StorageService.generateComprehensiveExcelBlob(state);

          // Upload both files to pCloud Upload Link
          const uploadedFiles: string[] = [];
          const [resExcel, resJson] = await Promise.allSettled([
            PCloudService.uploadFileToLinkDirect(code, excelFileName, excelBlob),
            PCloudService.uploadFileToLinkDirect(code, jsonFileName, jsonBlob)
          ]);

          if (resExcel.status === 'fulfilled' && resExcel.value.success) {
            uploadedFiles.push(excelFileName);
          }
          if (resJson.status === 'fulfilled' && resJson.value.success) {
            uploadedFiles.push(jsonFileName);
          }

          if (uploadedFiles.length > 0) {
            return {
              success: true,
              pcloudUploaded: true,
              uploadedFiles,
              dateStr,
              excelFileName,
              jsonFileName,
              message: `تم بنجاح رفع ${uploadedFiles.join(' و ')} مباشرة من المتصفح إلى مجلد pCloud السحابي الخاص بك بدون كلمة سر!`
            };
          } else {
            // Check if publink
            const check = await PCloudService.testUploadLinkDirect(link);
            if (check.isPubLink) {
              return {
                success: false,
                isPubLink: true,
                error: check.message || 'هذا الرابط هو رابط مشاركة وتنزيل فقط (Share link). موقع pCloud يمنع رفع الملفات عبر روابط المشاركة لحماية المجلد.\n\nالحل: اختر "Request files (طلب ملفات)" من خيارات المجلد في pCloud والصق الرابط هنا.'
              };
            }
          }
        }
      } catch (directErr: any) {
        console.warn('[Direct Browser pCloud Upload] Error:', directErr);
      }
    }

    return {
      success: false,
      message: 'تعذر إتمام الرفع إلى pCloud. تأكد من أن الرابط هو رابط طلب ملفات (Request files / File Request) سارٍ.',
      error: 'تعذر إتمام الرفع إلى pCloud.'
    };
  },

  // Validate and test a pCloud upload link (File Request)
  async testPCloudUploadLink(link: string): Promise<{
    success: boolean;
    isUploadLink?: boolean;
    isPubLink?: boolean;
    folderName?: string;
    region?: string;
    message?: string;
    error?: string;
  }> {
    // 1. Try server endpoint first
    try {
      const result = await fetchCandidateJson('pcloud/test-upload-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link })
      });
      if (result.ok && result.data && (result.data.success || result.data.isPubLink !== undefined)) {
        return result.data;
      }
      if (result.data && result.data.error && !result.error?.includes('تعذر الوصول إلى مسار السيرفر')) {
        return result.data;
      }
    } catch {
      // Server endpoint failed or returned HTML, fallback to direct browser testing
    }

    // 2. Direct browser fallback (directly queries pCloud API from client with CORS support)
    try {
      const directResult = await PCloudService.testUploadLinkDirect(link);
      return directResult;
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'تعذر التحقق من رابط pCloud.'
      };
    }
  },

  // Get status of the daily automated backup
  async getDailyBackupStatus(): Promise<{ success: boolean; status: any; pcloudConfigured?: boolean }> {
    try {
      const result = await fetchCandidateJson('backup/daily-status', { method: 'GET' });
      if (!result.ok || !result.data) return { success: false, status: null };
      return result.data;
    } catch {
      return { success: false, status: null };
    }
  },

  /**
   * Register active user session on the server disk.
   * Evicts any existing active session for this user on other devices immediately.
   */
  async registerActiveSession(session: {
    userId: string;
    sessionId: string;
    userName?: string;
    device?: string;
    loginTime?: string;
  }): Promise<{ success: boolean; activeSession?: any; error?: string }> {
    try {
      const result = await fetchCandidateJson('session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session)
      });
      if (result.ok && result.data?.success) {
        return { success: true, activeSession: result.data.activeSession };
      }
      return { success: false, error: result.error || 'Failed to register active session on server' };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  },

  /**
   * Query the server to check if the current user session is still active or was evicted by another login.
   */
  async checkActiveSession(
    userId: string,
    sessionId: string
  ): Promise<{ success: boolean; isCurrentSessionActive: boolean; sessionEvicted: boolean; activeSession?: any }> {
    try {
      const result = await fetchCandidateJson(`session?userId=${encodeURIComponent(userId)}&sessionId=${encodeURIComponent(sessionId)}`, {
        method: 'GET'
      });
      if (result.ok && result.data) {
        return {
          success: true,
          isCurrentSessionActive: result.data.isCurrentSessionActive !== false,
          sessionEvicted: result.data.sessionEvicted === true,
          activeSession: result.data.activeSession
        };
      }
      if (result.data?.sessionEvicted === true) {
        return {
          success: true,
          isCurrentSessionActive: false,
          sessionEvicted: true,
          activeSession: result.data.activeSession
        };
      }
      return { success: false, isCurrentSessionActive: true, sessionEvicted: false };
    } catch {
      return { success: false, isCurrentSessionActive: true, sessionEvicted: false };
    }
  }
};

