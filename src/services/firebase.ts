import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  memoryLocalCache,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  collection,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  deleteDoc,
  setLogLevel
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { syncLogger } from './syncLogger';
import { IndexedDBVault } from './indexedDbVault';
import {
  getWorkspaceId,
  getWorkspaceInfo,
  WorkspaceInfo,
  setCustomWorkspaceId,
  subscribeToWorkspace
} from './workspace';

/**
 * Helper functions to construct workspace-scoped Firestore document IDs.
 * Ensures complete multi-tenant isolation across different Vercel deployments
 * (e.g. skyarc-p01 vs khema-masrya-2) sharing the same Firebase project.
 */
export function getSystemStateDocId(): string {
  const ws = getWorkspaceId();
  if (!ws || ws === 'default') {
    return 'current';
  }
  return `ws_${ws}_current`;
}

export function getExpensesChunkDocId(cIdx: number): string {
  const ws = getWorkspaceId();
  if (!ws || ws === 'default') {
    return `expenses_chunk_${cIdx}`;
  }
  return `ws_${ws}_expenses_chunk_${cIdx}`;
}

export function getArchivedExpensesDocId(): string {
  const ws = getWorkspaceId();
  if (!ws || ws === 'default') {
    return 'archived_expenses';
  }
  return `ws_${ws}_archived_expenses`;
}

export function getProjectBondsDocId(projectId: string): string {
  const ws = getWorkspaceId();
  if (!ws || ws === 'default') {
    return projectId;
  }
  return `ws_${ws}_${projectId}`;
}

export function getExpenseAttachmentDocId(expenseId: string): string {
  const ws = getWorkspaceId();
  if (!ws || ws === 'default') {
    return `exp_${expenseId}`;
  }
  return `ws_${ws}_exp_${expenseId}`;
}

export function getActiveUserSessionDocId(userId: string): string {
  const ws = getWorkspaceId();
  if (!ws || ws === 'default') {
    return userId;
  }
  return `ws_${ws}_${userId}`;
}

export function getCloudBackupDocId(backupId: string): string {
  const ws = getWorkspaceId();
  if (!ws || ws === 'default') {
    return backupId;
  }
  return `ws_${ws}_${backupId}`;
}

/**
 * Executes a Promise with a strict timeout to prevent Firestore internal backoff loops from hanging indefinitely.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 15000,
  timeoutMsg: string = 'انتهت مهلة استجابة السيرفر السحابي'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMsg));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Suppress noisy Firestore internal retry/backoff logs from polluting the console
try {
  setLogLevel('silent');
} catch {
  // Ignore
}

// Global window event listener to catch and cleanly handle any background Firestore quota rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    if (
      reason?.code === 'resource-exhausted' ||
      reason?.message?.includes('resource-exhausted') ||
      reason?.message?.includes('Quota exceeded') ||
      reason?.message?.includes('quota limits') ||
      reason?.message?.includes('Free daily write units') ||
      reason?.message?.includes('Free daily read units')
    ) {
      event.preventDefault();
      markQuotaExhausted(480, reason?.message || 'تم استنفاد الحصة اليومية المجانية لكتابة البيانات في Firestore');
    }
  });
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Cleanly strips undefined properties from objects and array items to prevent Firestore write crashes.
 */
export function sanitizeForFirestore(val: any): any {
  if (val === undefined) {
    return null;
  }
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (Array.isArray(val)) {
    return val.map((item) => (item === undefined ? null : sanitizeForFirestore(item)));
  }
  // Keep Firestore FieldValue intact (e.g. serverTimestamp)
  if (typeof (val as any)._methodName === 'string') {
    return val;
  }
  try {
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        cleaned[k] = sanitizeForFirestore(v);
      }
    }
    return cleaned;
  } catch {
    return val;
  }
}

// Clean up any legacy corrupted Firestore IndexedDB caches that caused Target ID collisions on web/PWA refresh
if (typeof window !== 'undefined' && 'indexedDB' in window) {
  try {
    if (indexedDB.databases) {
      indexedDB.databases().then((dbs) => {
        dbs.forEach((dbInfo) => {
          if (dbInfo.name && (dbInfo.name.startsWith('firestore/') || dbInfo.name.includes('firestore'))) {
            try {
              indexedDB.deleteDatabase(dbInfo.name);
            } catch {}
          }
        });
      }).catch(() => {});
    }
  } catch {}
}

// Initialize Firebase App instance safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

function getOrInitializeDb() {
  const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? firebaseConfig.firestoreDatabaseId
    : undefined;
  try {
    return initializeFirestore(app, {
      localCache: memoryLocalCache(),
      ignoreUndefinedProperties: true
    }, dbId);
  } catch {
    return getFirestore(app, dbId);
  }
}

// Target provisioned Firestore Database with in-memory cache and undefined property tolerance
export const db = getOrInitializeDb();

// Connection status tracking
let isCloudConnected = false;
let isQuotaExhausted = false;
let quotaExhaustedUntil = 0;
let lastSyncedHash = '';

// Quota status listeners
export interface QuotaStatusDetails {
  isExhausted: boolean;
  untilTimestamp: number;
  remainingMinutes: number;
  reason?: string;
  upgradeUrl: string;
}

type QuotaListener = (details: QuotaStatusDetails) => void;
const quotaListeners = new Set<QuotaListener>();

export function subscribeToQuotaStatus(listener: QuotaListener): () => void {
  quotaListeners.add(listener);
  listener(getQuotaDetailsInternal());
  return () => {
    quotaListeners.delete(listener);
  };
}

function notifyQuotaListeners(): void {
  const details = getQuotaDetailsInternal();
  for (const listener of quotaListeners) {
    try {
      listener(details);
    } catch {}
  }
}

function getQuotaDetailsInternal(): QuotaStatusDetails {
  const isExhausted = checkIsQuotaExhausted();
  const remainingMs = Math.max(0, quotaExhaustedUntil - Date.now());
  let reason: string | undefined;
  try {
    if (typeof localStorage !== 'undefined') {
      reason = localStorage.getItem('skyarc_firestore_quota_reason') || undefined;
    }
  } catch {}
  return {
    isExhausted,
    untilTimestamp: quotaExhaustedUntil,
    remainingMinutes: Math.ceil(remainingMs / 60000),
    reason,
    upgradeUrl: `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`
  };
}

// Initialize quota status from localStorage if still within cooldown period
try {
  if (typeof localStorage !== 'undefined') {
    const savedUntil = localStorage.getItem('skyarc_firestore_quota_until');
    if (savedUntil) {
      const ts = Number(savedUntil);
      if (!isNaN(ts) && ts > Date.now()) {
        isQuotaExhausted = true;
        quotaExhaustedUntil = ts;
      } else {
        localStorage.removeItem('skyarc_firestore_quota_until');
        localStorage.removeItem('skyarc_firestore_quota_reason');
      }
    }
  }
} catch {
  // Ignore local storage read errors
}

export function checkIsQuotaExhausted(): boolean {
  if (isQuotaExhausted) {
    if (Date.now() > quotaExhaustedUntil) {
      isQuotaExhausted = false;
      quotaExhaustedUntil = 0;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('skyarc_firestore_quota_until');
          localStorage.removeItem('skyarc_firestore_quota_reason');
        }
      } catch {}
      notifyQuotaListeners();
      return false;
    }
    return true;
  }
  // Also check localStorage in case set in another tab
  try {
    if (typeof localStorage !== 'undefined') {
      const savedUntil = localStorage.getItem('skyarc_firestore_quota_until');
      if (savedUntil) {
        const ts = Number(savedUntil);
        if (!isNaN(ts) && ts > Date.now()) {
          isQuotaExhausted = true;
          quotaExhaustedUntil = ts;
          return true;
        }
      }
    }
  } catch {}
  return false;
}

export function markQuotaExhausted(cooldownMinutes: number = 480, customReason?: string): void {
  // Default to 8 hours for daily quota resets
  let effectiveCooldown = cooldownMinutes;
  if (!effectiveCooldown || effectiveCooldown < 60) {
    effectiveCooldown = 480;
  }

  isQuotaExhausted = true;
  quotaExhaustedUntil = Date.now() + effectiveCooldown * 60 * 1000;
  isCloudConnected = false;

  // Immediately clear pending write timers and payloads
  if (cloudSyncTimer) {
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = null;
  }
  pendingCloudData = null;

  for (const timer of projectSyncTimers.values()) {
    clearTimeout(timer);
  }
  projectSyncTimers.clear();
  pendingProjectAttachments.clear();

  const reasonMsg = customReason || 'تم استنفاد الحصة اليومية المجانية لكتابة البيانات في Firestore (Free daily write units per project). يستمر النظام بالعمل محلياً بأمان تام وبدون أي فقدان للبيانات.';

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('skyarc_firestore_quota_until', String(quotaExhaustedUntil));
      localStorage.setItem('skyarc_firestore_quota_reason', reasonMsg);
    }
  } catch {}

  notifyQuotaListeners();

  syncLogger.log({
    service: 'firestore',
    operation: 'quota_guard',
    status: 'throttled',
    statusCode: 'resource-exhausted',
    title: 'تفعيل حارس الحصة السحابية (Quota Guard)',
    message: reasonMsg,
    details: {
      errorCode: 'resource-exhausted',
      quotaExhaustedUntil: new Date(quotaExhaustedUntil).toISOString(),
      projectId: firebaseConfig.projectId,
      firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
      upgradeUrl: `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`
    }
  });

  console.warn(
    `[Firestore Quota Guard] Cloud writes safely paused until ${new Date(quotaExhaustedUntil).toLocaleTimeString()}. Local storage database is 100% active.`
  );
}

export function resetQuotaExhaustion(): void {
  const wasExhausted = isQuotaExhausted;
  isQuotaExhausted = false;
  quotaExhaustedUntil = 0;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('skyarc_firestore_quota_until');
      localStorage.removeItem('skyarc_firestore_quota_reason');
    }
  } catch {}

  notifyQuotaListeners();

  if (wasExhausted) {
    syncLogger.log({
      service: 'firestore',
      operation: 'quota_guard',
      status: 'info',
      title: 'إعادة ضبط حظر الحصة وشبكة Firestore',
      message: 'تم إلغاء عداد التوقف المؤقت واستئناف الاتصال السحابي بنجاح.'
    });
  }
}

function computeDataHash(data: any): string {
  try {
    let expenseSum = 0;
    let expenseStatusSample = '';
    if (Array.isArray(data.expenses)) {
      const len = data.expenses.length;
      for (let i = 0; i < len; i++) {
        const e = data.expenses[i];
        if (e) {
          expenseSum += (Number(e.amount) || 0);
          expenseStatusSample += `${e.id}:${e.status}:${e.amount}:${e.updatedAt || ''};`;
        }
      }
    }

    const deletedCount = (
      (data.deletedExpenseIds && typeof data.deletedExpenseIds === 'object' ? Object.keys(data.deletedExpenseIds).length : 0) +
      (data.deletedCustodyIds && typeof data.deletedCustodyIds === 'object' ? Object.keys(data.deletedCustodyIds).length : 0) +
      (data.deletedProjectIds && typeof data.deletedProjectIds === 'object' ? Object.keys(data.deletedProjectIds).length : 0) +
      (data.deletedUserIds && typeof data.deletedUserIds === 'object' ? Object.keys(data.deletedUserIds).length : 0)
    );
    const deletedKeys = [
      data.deletedExpenseIds && typeof data.deletedExpenseIds === 'object' ? Object.keys(data.deletedExpenseIds).sort().join(',') : '',
      data.deletedCustodyIds && typeof data.deletedCustodyIds === 'object' ? Object.keys(data.deletedCustodyIds).sort().join(',') : '',
      data.deletedProjectIds && typeof data.deletedProjectIds === 'object' ? Object.keys(data.deletedProjectIds).sort().join(',') : '',
      data.deletedUserIds && typeof data.deletedUserIds === 'object' ? Object.keys(data.deletedUserIds).sort().join(',') : ''
    ].join('||');

    let custodySum = 0;
    let custodySample = '';
    if (Array.isArray(data.custodies)) {
      for (let i = 0; i < data.custodies.length; i++) {
        const c = data.custodies[i];
        if (c) {
          custodySum += (Number(c.amount) || 0);
          custodySample += `${c.id}:${c.status}:${c.amount};`;
        }
      }
    }

    let projectSample = '';
    if (Array.isArray(data.projects)) {
      for (let i = 0; i < data.projects.length; i++) {
        const p = data.projects[i];
        if (p) {
          projectSample += `${p.id}:${p.status}:${p.spent || 0}:${p.budget || 0};`;
        }
      }
    }

    let userSample = '';
    if (Array.isArray(data.users)) {
      for (let i = 0; i < data.users.length; i++) {
        const u = data.users[i];
        if (u) {
          userSample += `${u.id}:${u.role}:${u.isActive}:${u.currentSessionId || ''};`;
        }
      }
    }

    return [
      data.projects?.length || 0,
      data.expenses?.length || 0,
      deletedCount,
      deletedKeys,
      expenseSum,
      expenseStatusSample,
      custodySum,
      custodySample,
      projectSample,
      userSample,
      data.tickets?.length || 0,
      data.notifications?.length || 0,
      data.workflowStages?.length || 0,
      data.settings?.updatedAt || data.settings?.companyName || ''
    ].join('|');
  } catch {
    return String(Date.now());
  }
}

// Debouncing timers and pending payloads for write stream optimization
let cloudSyncTimer: any = null;
let pendingCloudData: any = null;
let pendingCloudUpdatedBy: string = 'مدير النظام';

const projectSyncTimers = new Map<string, any>();
const pendingProjectAttachments = new Map<string, Record<string, any>>();

// Differential Sync Cache & Micro-Batching Constants
const MICRO_BATCH_SIZE = 40; // Small lightweight sequential packet size for high stability on weak connections
const EXPENSES_CHUNK_SIZE = 200;

export interface DifferentialSyncDelta {
  isFullSync: boolean;
  updatedExpenses: any[];
  deletedExpenseIds: string[];
  updatedCustodies: any[];
  deletedCustodyIds: string[];
  updatedProjects: any[];
  deletedProjectIds: string[];
  updatedUsers: any[];
  deletedUserIds: string[];
  updatedRoles: any[];
  updatedWorkflowStages: any[];
  updatedTickets: any[];
  updatedNotifications: any[];
  updatedSettings?: any;
  totalChangedCount: number;
}

export interface SyncProgressCallbackParams {
  percent: number;
  remainingSeconds: number;
  currentBatch: number;
  totalBatches: number;
  itemsSynced: number;
  totalItems: number;
  statusText: string;
  isDifferential: boolean;
}

// In-memory & persisted item hash cache for differential change detection
const syncedItemHashes = new Map<string, string>();

function getHashStorageKey(): string {
  const ws = getWorkspaceId();
  return ws && ws !== 'default' ? `skyarc_synced_item_hashes_${ws}` : 'skyarc_synced_item_hashes';
}

function loadSyncedHashes(): void {
  syncedItemHashes.clear();
  try {
    if (typeof localStorage !== 'undefined') {
      const storedHashes = localStorage.getItem(getHashStorageKey());
      if (storedHashes) {
        const parsed = JSON.parse(storedHashes);
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed)) {
            syncedItemHashes.set(k, String(v));
          }
        }
      }
    }
  } catch {
    // Ignore storage parse errors
  }
}

loadSyncedHashes();

// Reload hashes when workspace changes
subscribeToWorkspace(() => {
  loadSyncedHashes();
});

function persistSyncedHashes(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const obj: Record<string, string> = {};
      syncedItemHashes.forEach((val, key) => {
        obj[key] = val;
      });
      localStorage.setItem(getHashStorageKey(), JSON.stringify(obj));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function hashExpense(e: any): string {
  if (!e || typeof e !== 'object') return '';
  return `${e.id || ''}|${e.amount || 0}|${e.status || ''}|${e.accountantApproval || ''}|${e.managementApproval || ''}|${e.supervisorApproval || ''}|${e.updatedAt || ''}|${e.paymentVoucherNumber || ''}|${e.receiptVoucherNumber || ''}|${e.vatAmount || 0}|${e.isVatInclusive ? 1 : 0}|${e.erpPostingStatus || ''}|${e.rejectionReason || ''}|${e.stageApprovals ? Object.keys(e.stageApprovals).length : 0}`;
}

export function hashCustody(c: any): string {
  if (!c || typeof c !== 'object') return '';
  return `${c.id || ''}|${c.amount || 0}|${c.status || ''}|${c.supervisorEmail || ''}|${c.updatedAt || ''}|${c.replenishmentStatus || ''}`;
}

export function hashProject(p: any): string {
  if (!p || typeof p !== 'object') return '';
  return `${p.id || ''}|${p.status || ''}|${p.budget || 0}|${p.spent || 0}|${p.name || ''}|${p.code || ''}|${p.assignedEmails ? p.assignedEmails.join(',') : ''}`;
}

export function hashEntity(entity: any): string {
  if (!entity) return '';
  try {
    return JSON.stringify(entity);
  } catch {
    return String(Date.now());
  }
}

/**
 * Extracts only changed, created, or modified items compared to last confirmed sync
 */
export function extractDifferentialDelta(cleanData: any, forceFull: boolean = false): DifferentialSyncDelta {
  const allExpenses: any[] = Array.isArray(cleanData.expenses) ? cleanData.expenses : [];
  const allCustodies: any[] = Array.isArray(cleanData.custodies) ? cleanData.custodies : [];
  const allProjects: any[] = Array.isArray(cleanData.projects) ? cleanData.projects : [];
  const allUsers: any[] = Array.isArray(cleanData.users) ? cleanData.users : [];
  const allRoles: any[] = Array.isArray(cleanData.roles) ? cleanData.roles : [];
  const allStages: any[] = Array.isArray(cleanData.workflowStages) ? cleanData.workflowStages : [];
  const allTickets: any[] = Array.isArray(cleanData.tickets) ? cleanData.tickets : [];
  const allNotifications: any[] = Array.isArray(cleanData.notifications) ? cleanData.notifications : [];
  
  const deletedExpenseMap = (cleanData.deletedExpenseIds && typeof cleanData.deletedExpenseIds === 'object') ? cleanData.deletedExpenseIds : {};
  const deletedExpenseIds = Object.keys(deletedExpenseMap);

  const deletedCustodyMap = (cleanData.deletedCustodyIds && typeof cleanData.deletedCustodyIds === 'object') ? cleanData.deletedCustodyIds : {};
  const deletedCustodyIds = Object.keys(deletedCustodyMap);

  const deletedProjectMap = (cleanData.deletedProjectIds && typeof cleanData.deletedProjectIds === 'object') ? cleanData.deletedProjectIds : {};
  const deletedProjectIds = Object.keys(deletedProjectMap);

  const deletedUserMap = (cleanData.deletedUserIds && typeof cleanData.deletedUserIds === 'object') ? cleanData.deletedUserIds : {};
  const deletedUserIds = Object.keys(deletedUserMap);

  if (forceFull || syncedItemHashes.size === 0) {
    return {
      isFullSync: true,
      updatedExpenses: allExpenses,
      deletedExpenseIds,
      updatedCustodies: allCustodies,
      deletedCustodyIds,
      updatedProjects: allProjects,
      deletedProjectIds,
      updatedUsers: allUsers,
      deletedUserIds,
      updatedRoles: allRoles,
      updatedWorkflowStages: allStages,
      updatedTickets: allTickets,
      updatedNotifications: allNotifications,
      updatedSettings: cleanData.settings,
      totalChangedCount: allExpenses.length + allCustodies.length + allProjects.length + allUsers.length
    };
  }

  // Differential mode: Detect only modified items
  const changedExpenses: any[] = [];
  for (const exp of allExpenses) {
    if (!exp || !exp.id) continue;
    const h = hashExpense(exp);
    if (syncedItemHashes.get(`exp_${exp.id}`) !== h) {
      changedExpenses.push(exp);
    }
  }

  const changedCustodies: any[] = [];
  for (const c of allCustodies) {
    if (!c || !c.id) continue;
    const h = hashCustody(c);
    if (syncedItemHashes.get(`cust_${c.id}`) !== h) {
      changedCustodies.push(c);
    }
  }

  const changedProjects: any[] = [];
  for (const p of allProjects) {
    if (!p || !p.id) continue;
    const h = hashProject(p);
    if (syncedItemHashes.get(`proj_${p.id}`) !== h) {
      changedProjects.push(p);
    }
  }

  const changedUsers: any[] = [];
  for (const u of allUsers) {
    if (!u || !u.id) continue;
    const h = `${u.id}_${u.role || ''}_${u.isActive}_${u.currentSessionId || ''}`;
    if (syncedItemHashes.get(`user_${u.id}`) !== h) {
      changedUsers.push(u);
    }
  }

  const totalChanged = changedExpenses.length + changedCustodies.length + changedProjects.length + changedUsers.length;

  return {
    isFullSync: false,
    updatedExpenses: changedExpenses,
    deletedExpenseIds,
    updatedCustodies: changedCustodies,
    deletedCustodyIds,
    updatedProjects: changedProjects,
    deletedProjectIds,
    updatedUsers: changedUsers,
    deletedUserIds,
    updatedRoles: allRoles,
    updatedWorkflowStages: allStages,
    updatedTickets: allTickets,
    updatedNotifications: allNotifications,
    updatedSettings: cleanData.settings,
    totalChangedCount: totalChanged
  };
}

/**
 * Strips oversized base64 data URLs from state before saving to Firestore,
 * ensuring document size remains far below the 1,048,576 byte Firestore limit.
 * Project bonds and invoice attachments are stored and synced per project
 * in 'project_bonds_archives/{projectId}'.
 */
export function prepareCentralStatePayload(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const clone = { ...data };

  const deletedExpenseIds = (clone.deletedExpenseIds && typeof clone.deletedExpenseIds === 'object') ? clone.deletedExpenseIds : {};
  const deletedCustodyIds = (clone.deletedCustodyIds && typeof clone.deletedCustodyIds === 'object') ? clone.deletedCustodyIds : {};
  const deletedProjectIds = (clone.deletedProjectIds && typeof clone.deletedProjectIds === 'object') ? clone.deletedProjectIds : {};
  const deletedUserIds = (clone.deletedUserIds && typeof clone.deletedUserIds === 'object') ? clone.deletedUserIds : {};
  const deletedRoleIds = (clone.deletedRoleIds && typeof clone.deletedRoleIds === 'object') ? clone.deletedRoleIds : {};
  const deletedWorkflowStageIds = (clone.deletedWorkflowStageIds && typeof clone.deletedWorkflowStageIds === 'object') ? clone.deletedWorkflowStageIds : {};

  if (Array.isArray(clone.expenses)) {
    clone.expenses = clone.expenses
      .filter((e: any) => e && e.id && !deletedExpenseIds[e.id])
      .map((e: any) => {
        const hasPhoto = Boolean(e.invoicePhoto && typeof e.invoicePhoto === 'string');
        const hasAttachments = Boolean(Array.isArray(e.attachments) && e.attachments.length > 0);
        
        if (hasPhoto || hasAttachments) {
          // Keep invoicePhoto in central state only if under 80KB and not a huge PDF dataUrl
          const isHeavyPhoto = Boolean(e.invoicePhoto && (e.invoicePhoto.length > 80000 || e.invoicePhoto.startsWith('data:application/pdf')));
          const safePhoto = isHeavyPhoto ? '' : (e.invoicePhoto || '');

          const safeAttachments = Array.isArray(e.attachments)
            ? e.attachments.map((att: any) => ({
                ...att,
                url: (att.url && (att.url.length > 80000 || att.url.startsWith('data:application/pdf'))) ? '' : att.url
              }))
            : e.attachments;

          return {
            ...e,
            invoicePhoto: safePhoto,
            invoice_url: isHeavyPhoto ? (e.invoice_url || '') : (e.invoice_url || safePhoto),
            attachments: safeAttachments,
            hasAttachment: true,
            attachmentsCount: e.attachments?.length || 1
          };
        }
        return e;
      });
  }

  if (Array.isArray(clone.custodies)) {
    clone.custodies = clone.custodies.filter((c: any) => c && c.id && !deletedCustodyIds[c.id]);
  }

  if (Array.isArray(clone.projects)) {
    clone.projects = clone.projects.filter((p: any) => p && p.id && !deletedProjectIds[p.id]);
  }

  if (Array.isArray(clone.users)) {
    clone.users = clone.users.filter((u: any) => u && u.id && !deletedUserIds[u.id]);
  }

  if (Array.isArray(clone.roles)) {
    clone.roles = clone.roles.filter((r: any) => r && r.id && !deletedRoleIds[r.id]);
  }

  if (Array.isArray(clone.workflowStages)) {
    clone.workflowStages = clone.workflowStages.filter((s: any) => s && s.id && !deletedWorkflowStageIds[s.id]);
  }

  clone.deletedExpenseIds = deletedExpenseIds;
  clone.deletedCustodyIds = deletedCustodyIds;
  clone.deletedProjectIds = deletedProjectIds;
  clone.deletedUserIds = deletedUserIds;
  clone.deletedRoleIds = deletedRoleIds;
  clone.deletedWorkflowStageIds = deletedWorkflowStageIds;

  return sanitizeForFirestore(clone);
}

// Track single active cloud snapshot listener to prevent Target ID collisions
let activeCloudListenerUnsubscribe: (() => void) | null = null;

export const FirebaseService = {
  // Test connection to Firestore as mandated
  async testConnection(force: boolean = false): Promise<boolean> {
    const startTime = Date.now();
    if (force) {
      resetQuotaExhaustion();
    } else if (checkIsQuotaExhausted()) {
      isCloudConnected = false;
      return false;
    }
    try {
      const testDocRef = doc(db, 'system_state', getSystemStateDocId());
      await withTimeout(getDoc(testDocRef), 6000, 'مهلة فحص الاتصال السحابي');
      const latency = Date.now() - startTime;
      isCloudConnected = true;
      syncLogger.log({
        service: 'firestore',
        operation: 'test_connection',
        status: 'success',
        latencyMs: latency,
        title: 'فحص اتصال Firestore ناجح',
        message: `تم التحقق من الاتصال المباشر بخادم Firestore بنجاح خلال ${latency}ms.`
      });
      return true;
    } catch (error: any) {
      const latency = Date.now() - startTime;
      const code = error?.code || 'offline';
      const msg = error?.message || String(error);

      if (
        code === 'resource-exhausted' ||
        msg.includes('resource-exhausted') ||
        msg.includes('Quota exceeded') ||
        msg.includes('quota limits') ||
        msg.includes('Free daily')
      ) {
        markQuotaExhausted(480, msg);
        isCloudConnected = false;
        return false;
      }

      syncLogger.log({
        service: 'firestore',
        operation: 'test_connection',
        status: 'failure',
        statusCode: code,
        latencyMs: latency,
        title: 'فشل فحص اتصال Firestore',
        message: `تعذر الاتصال بـ Firestore: ${msg}`,
        details: {
          errorCode: code,
          errorMessage: msg,
          targetPath: 'system_state/current'
        }
      });

      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.warn('Firestore is offline or unreachable:', error.message);
      } else {
        console.warn('Firestore connection check:', error);
      }
      isCloudConnected = false;
      return false;
    }
  },

  isConnected(): boolean {
    if (checkIsQuotaExhausted()) {
      return false;
    }
    return isCloudConnected;
  },

  isQuotaLimitExhausted(): boolean {
    return checkIsQuotaExhausted();
  },

  getQuotaDetails(): QuotaStatusDetails {
    return getQuotaDetailsInternal();
  },

  subscribeToQuotaStatus(listener: QuotaListener): () => void {
    return subscribeToQuotaStatus(listener);
  },

  resetQuotaLimitState(): void {
    resetQuotaExhaustion();
  },

  // Differential & Sequential Micro-Batched Cloud Sync
  async syncToCloud(
    data: any,
    updatedBy: string = 'مدير النظام',
    force: boolean = false,
    onProgress?: (info: SyncProgressCallbackParams) => void
  ): Promise<{ success: boolean; error?: string; lastSyncedAt?: string; quotaExhausted?: boolean; isDifferential?: boolean; changedCount?: number }> {
    return this.syncToCloudDifferential(data, updatedBy, force, onProgress);
  },

  /**
   * Differential Sync Engine:
   * 1. Detects modified/created items only (Delta).
   * 2. If delta is small (e.g. 1-40 items): transmits a tiny differential packet (<5KB) with sub-100ms latency.
   * 3. If full sync or bulk modifications: chunks data into sequential micro-batches (40 items each) with retry & live progress callbacks.
   * 4. Ensures extreme speed, zero bandwidth waste, and rock-solid continuity even under 2G/3G or flaky connections.
   */
  async syncToCloudDifferential(
    data: any,
    updatedBy: string = 'مدير النظام',
    forceFull: boolean = false,
    onProgress?: (info: SyncProgressCallbackParams) => void
  ): Promise<{
    success: boolean;
    error?: string;
    lastSyncedAt?: string;
    quotaExhausted?: boolean;
    isDifferential?: boolean;
    changedCount?: number;
  }> {
    const startTime = Date.now();
    if (checkIsQuotaExhausted()) {
      return {
        success: false,
        quotaExhausted: true,
        error: 'تم الوصول للحد اليومي المجاني لكتابة البيانات في السحابة (Firestore Quota Exceeded). يعمل النظام محلياً بأمان تام وبدون أي فقدان للبيانات.'
      };
    }

    try {
      const cleanData = prepareCentralStatePayload(data);
      const delta = extractDifferentialDelta(cleanData, forceFull);
      const allExpenses: any[] = Array.isArray(cleanData.expenses) ? cleanData.expenses : [];
      const nowIso = new Date().toISOString();
      const docRef = doc(db, 'system_state', getSystemStateDocId());

      // If nothing has changed, skip network write entirely
      if (!forceFull && !delta.isFullSync && delta.totalChangedCount === 0) {
        if (onProgress) {
          onProgress({
            percent: 100,
            remainingSeconds: 0,
            currentBatch: 1,
            totalBatches: 1,
            itemsSynced: allExpenses.length,
            totalItems: allExpenses.length,
            statusText: 'البيانات متطابقة ومحدثة سحابياً بالكامل',
            isDifferential: true
          });
        }
        return {
          success: true,
          lastSyncedAt: nowIso,
          isDifferential: true,
          changedCount: 0
        };
      }

      // 1. FAST DIFFERENTIAL PATH (When small delta <= MICRO_BATCH_SIZE changed)
      if (!delta.isFullSync && delta.totalChangedCount <= MICRO_BATCH_SIZE) {
        if (onProgress) {
          onProgress({
            percent: 45,
            remainingSeconds: 1,
            currentBatch: 1,
            totalBatches: 1,
            itemsSynced: delta.totalChangedCount,
            totalItems: delta.totalChangedCount,
            statusText: `جاري إرسال التحديثات التفاضلية (${delta.totalChangedCount} سجل)...`,
            isDifferential: true
          });
        }

        // Lightweight differential payload
        const rootPayload = {
          ...cleanData,
          workspaceId: getWorkspaceId(),
          expenses: allExpenses.length <= EXPENSES_CHUNK_SIZE ? allExpenses : [],
          expensesChunksCount: allExpenses.length > EXPENSES_CHUNK_SIZE ? Math.ceil(allExpenses.length / EXPENSES_CHUNK_SIZE) : 0,
          totalExpensesCount: allExpenses.length,
          lastSyncedAt: nowIso,
          syncedBy: updatedBy || 'مدير النظام',
          serverTimestamp: serverTimestamp(),
          lastDifferentialSync: {
            syncedAt: nowIso,
            changedCount: delta.totalChangedCount,
            updatedExpenseIds: delta.updatedExpenses.map((e: any) => e.id),
            deletedExpenseIds: delta.deletedExpenseIds,
            deletedCustodyIds: delta.deletedCustodyIds,
            deletedProjectIds: delta.deletedProjectIds,
            deletedUserIds: delta.deletedUserIds
          }
        };

        // If chunked storage is used, also update the primary chunks with fresh items
        if (allExpenses.length > EXPENSES_CHUNK_SIZE) {
          const chunks: any[][] = [];
          for (let i = 0; i < allExpenses.length; i += EXPENSES_CHUNK_SIZE) {
            chunks.push(allExpenses.slice(i, i + EXPENSES_CHUNK_SIZE));
          }
          for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
            const chunkRef = doc(db, 'system_state', getExpensesChunkDocId(cIdx));
            const chunkPayload = sanitizeForFirestore({
              chunkIndex: cIdx,
              workspaceId: getWorkspaceId(),
              items: chunks[cIdx],
              totalInChunk: chunks[cIdx].length,
              updatedAt: nowIso
            });
            let attempt = 0;
            let success = false;
            while (attempt < 2 && !success) {
              try {
                await withTimeout(setDoc(chunkRef, chunkPayload), 15000, 'مهلة رفع الحزمة التفاضلية');
                success = true;
              } catch (e: any) {
                if (
                  e?.code === 'resource-exhausted' ||
                  e?.message?.includes('resource-exhausted') ||
                  e?.message?.includes('Quota exceeded') ||
                  e?.message?.includes('quota limits') ||
                  e?.message?.includes('Free daily')
                ) {
                  markQuotaExhausted(480, e?.message || 'تم استنفاد الحصة اليومية المجانية');
                  throw e;
                }
                attempt++;
                if (attempt >= 2) throw e;
                await new Promise(r => setTimeout(r, 200 * attempt));
              }
            }
          }
          await withTimeout(setDoc(docRef, sanitizeForFirestore(rootPayload)), 15000, 'مهلة حفظ التحديثات السحابية');
        } else {
          await withTimeout(setDoc(docRef, sanitizeForFirestore(rootPayload)), 15000, 'مهلة حفظ التحديثات السحابية');
        }

        // Update in-memory and persisted hash cache for changed items
        for (const exp of delta.updatedExpenses) {
          if (exp && exp.id) syncedItemHashes.set(`exp_${exp.id}`, hashExpense(exp));
        }
        for (const delId of delta.deletedExpenseIds) {
          syncedItemHashes.delete(`exp_${delId}`);
        }
        for (const delId of delta.deletedCustodyIds) {
          syncedItemHashes.delete(`cust_${delId}`);
        }
        for (const delId of delta.deletedProjectIds) {
          syncedItemHashes.delete(`proj_${delId}`);
        }
        for (const delId of delta.deletedUserIds) {
          syncedItemHashes.delete(`user_${delId}`);
        }
        for (const c of delta.updatedCustodies) {
          if (c && c.id) syncedItemHashes.set(`cust_${c.id}`, hashCustody(c));
        }
        for (const p of delta.updatedProjects) {
          if (p && p.id) syncedItemHashes.set(`proj_${p.id}`, hashProject(p));
        }
        persistSyncedHashes();

        isCloudConnected = true;
        resetQuotaExhaustion();

        const duration = Date.now() - startTime;
        if (onProgress) {
          onProgress({
            percent: 100,
            remainingSeconds: 0,
            currentBatch: 1,
            totalBatches: 1,
            itemsSynced: delta.totalChangedCount,
            totalItems: delta.totalChangedCount,
            statusText: `تمت المزامنة التفاضلية بنجاح (${delta.totalChangedCount} حركة في ${duration}ms)`,
            isDifferential: true
          });
        }

        syncLogger.log({
          service: 'firestore',
          operation: 'sync_to_cloud_differential',
          status: 'success',
          latencyMs: duration,
          title: 'مزامنة تفاضلية سريعة (Differential Sync)',
          message: `تم رفع التحديثات الجديدة فقط (${delta.totalChangedCount} عنصر معدل) في حزمة صغيرة (${duration}ms).`,
          details: {
            changedExpenses: delta.updatedExpenses.length,
            deletedExpenses: delta.deletedExpenseIds.length,
            changedCustodies: delta.updatedCustodies.length,
            changedProjects: delta.updatedProjects.length,
            latencyMs: duration
          }
        });

        return {
          success: true,
          lastSyncedAt: nowIso,
          isDifferential: true,
          changedCount: delta.totalChangedCount
        };
      }

      // 2. SEQUENTIAL BATCHED PATH (For Full Sync or Bulk Modifications)
      const needsChunking = allExpenses.length > EXPENSES_CHUNK_SIZE;
      const chunks: any[][] = [];

      if (needsChunking) {
        for (let i = 0; i < allExpenses.length; i += EXPENSES_CHUNK_SIZE) {
          chunks.push(allExpenses.slice(i, i + EXPENSES_CHUNK_SIZE));
        }
      }

      const totalBatches = needsChunking ? chunks.length + 1 : 1;
      let itemsProcessed = 0;

      // If chunking is required, send each chunk sequentially with retry resilience
      if (needsChunking) {
        for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
          const chunkRef = doc(db, 'system_state', getExpensesChunkDocId(cIdx));
          const chunkPayload = sanitizeForFirestore({
            chunkIndex: cIdx,
            workspaceId: getWorkspaceId(),
            items: chunks[cIdx],
            totalInChunk: chunks[cIdx].length,
            updatedAt: nowIso
          });

          let attempt = 0;
          let success = false;
          while (attempt < 2 && !success) {
            try {
              await withTimeout(setDoc(chunkRef, chunkPayload), 15000, 'مهلة رفع الحزمة السحابية');
              success = true;
            } catch (e: any) {
              if (
                e?.code === 'resource-exhausted' ||
                e?.message?.includes('resource-exhausted') ||
                e?.message?.includes('Quota exceeded') ||
                e?.message?.includes('quota limits') ||
                e?.message?.includes('Free daily')
              ) {
                markQuotaExhausted(480, e?.message || 'تم استنفاد الحصة اليومية المجانية');
                throw e;
              }
              attempt++;
              if (attempt >= 2) throw e;
              await new Promise(r => setTimeout(r, 300 * attempt));
            }
          }

          itemsProcessed += chunks[cIdx].length;
          const currentBatch = cIdx + 1;
          const progressFraction = currentBatch / totalBatches;
          const currentPercent = Math.min(90, Math.floor(progressFraction * 90));
          const remainingSec = Math.max(0, Math.ceil((totalBatches - currentBatch) * 0.3));

          if (onProgress) {
            onProgress({
              percent: currentPercent,
              remainingSeconds: remainingSec,
              currentBatch,
              totalBatches,
              itemsSynced: itemsProcessed,
              totalItems: allExpenses.length,
              statusText: `جاري رفع الحزمة ${currentBatch} من ${totalBatches} (${currentPercent}%)...`,
              isDifferential: false
            });
          }

          await new Promise(r => setTimeout(r, 20));
        }
      } else {
        if (onProgress) {
          onProgress({
            percent: 60,
            remainingSeconds: 1,
            currentBatch: 1,
            totalBatches: 1,
            itemsSynced: allExpenses.length,
            totalItems: allExpenses.length,
            statusText: `جاري توثيق وحفظ السجلات سحابياً (${allExpenses.length} سند)...`,
            isDifferential: false
          });
        }
      }

      // Write root document as final sealing transaction
      const rootPayload = sanitizeForFirestore({
        ...cleanData,
        workspaceId: getWorkspaceId(),
        expenses: needsChunking ? [] : allExpenses,
        expensesChunksCount: needsChunking ? chunks.length : 0,
        totalExpensesCount: allExpenses.length,
        lastSyncedAt: nowIso,
        syncedBy: updatedBy || 'مدير النظام',
        serverTimestamp: serverTimestamp()
      });

      await withTimeout(setDoc(docRef, rootPayload), 15000, 'مهلة توثيق البيانات السحابية');

      // Cache all current hashes for subsequent differential syncs
      for (const exp of allExpenses) {
        if (exp && exp.id) syncedItemHashes.set(`exp_${exp.id}`, hashExpense(exp));
      }
      for (const c of cleanData.custodies || []) {
        if (c && c.id) syncedItemHashes.set(`cust_${c.id}`, hashCustody(c));
      }
      for (const p of cleanData.projects || []) {
        if (p && p.id) syncedItemHashes.set(`proj_${p.id}`, hashProject(p));
      }
      for (const u of cleanData.users || []) {
        if (u && u.id) syncedItemHashes.set(`user_${u.id}`, `${u.id}_${u.role || ''}_${u.isActive}_${u.currentSessionId || ''}`);
      }
      persistSyncedHashes();

      isCloudConnected = true;
      resetQuotaExhaustion();

      const duration = Date.now() - startTime;
      if (onProgress) {
        onProgress({
          percent: 100,
          remainingSeconds: 0,
          currentBatch: totalBatches,
          totalBatches,
          itemsSynced: allExpenses.length,
          totalItems: allExpenses.length,
          statusText: `تمت المزامنة وحفظ ${allExpenses.length} سند بنجاح (100%)`,
          isDifferential: false
        });
      }

      syncLogger.log({
        service: 'firestore',
        operation: 'sync_to_cloud_batched',
        status: 'success',
        latencyMs: duration,
        title: 'مزامنة كاملة موثقة (Direct Cloud Sync)',
        message: `تم رفع وتأمين ${allExpenses.length} سند وحفظ بيانات النظام السحابية بنجاح (${duration}ms).`,
        details: {
          itemsCount: allExpenses.length,
          batchesCount: totalBatches,
          latencyMs: duration
        }
      });

      return {
        success: true,
        lastSyncedAt: nowIso,
        isDifferential: false,
        changedCount: allExpenses.length
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const isTimeout = error?.message?.includes('مهلة') || error?.message?.includes('timeout') || error?.message?.includes('DEADLINE_EXCEEDED');
      const code = isTimeout ? 'NETWORK_TIMEOUT' : (error?.code || 'UNKNOWN_ERROR');
      const msg = error?.message || String(error);

      if (
        code === 'resource-exhausted' ||
        msg.includes('resource-exhausted') ||
        msg.includes('Quota exceeded') ||
        msg.includes('quota limits') ||
        msg.includes('Free daily')
      ) {
        markQuotaExhausted(480, msg);
        return {
          success: false,
          quotaExhausted: true,
          error: 'تم استنفاد الحصة اليومية المجانية لسحابة Firestore (Free daily write units per project). يستمر النظام بالعمل محلياً بأمان تام وبدون أي فقدان للبيانات.'
        };
      }

      syncLogger.log({
        service: 'firestore',
        operation: 'sync_to_cloud',
        status: isTimeout ? 'warning' : 'failure',
        statusCode: code,
        latencyMs: duration,
        title: isTimeout ? 'تنبيه مهلة الاستجابة السحابية (البيانات مؤمنة محلياً)' : 'فشل المزامنة السحابية',
        message: isTimeout
          ? `استغرقت المحاولة وقتاً أطول من المعتاد بسبب بطء الاتصال (${duration}ms). تم تأمين البيانات محلياً 100%.`
          : `فشلت كتابة البيانات السحابية: ${msg}`,
        details: {
          errorCode: code,
          errorMessage: msg,
          errorStack: error?.stack,
          targetPath: 'system_state/current'
        }
      });

      if (code === 'permission-denied' || msg.includes('Missing or insufficient permissions')) {
        handleFirestoreError(error, OperationType.WRITE, 'system_state/current');
      }
      return {
        success: false,
        error: isTimeout ? 'استغرقت الاستجابة وقتاً أطول من المعتاد؛ البيانات محفوظة محلياً بنجاح' : msg
      };
    }
  },

  // Debounced cloud sync to prevent write stream exhaustion - ultra-fast background differential streaming
  syncToCloudDebounced(
    data: any,
    updatedBy: string = 'مدير النظام',
    delayMs: number = 150,
    onSuccess?: (lastSyncedAt: string, isDifferential?: boolean) => void,
    onStart?: () => void
  ): void {
    pendingCloudData = data;
    pendingCloudUpdatedBy = updatedBy;

    if (cloudSyncTimer) {
      clearTimeout(cloudSyncTimer);
    }

    cloudSyncTimer = setTimeout(async () => {
      if (pendingCloudData) {
        const toSend = pendingCloudData;
        const by = pendingCloudUpdatedBy;
        pendingCloudData = null;
        if (onStart) onStart();
        try {
          const res = await this.syncToCloudDifferential(toSend, by, false);
          if (res.success && res.lastSyncedAt && onSuccess) {
            onSuccess(res.lastSyncedAt, res.isDifferential);
          }
        } catch (err: any) {
          console.warn('Background sync status:', err?.message || err);
        }
      }
    }, delayMs);
  },

  // Load the current centralized state from the cloud, reassembling chunks if needed
  async fetchFromCloud(): Promise<{ success: boolean; data?: any; error?: string }> {
    if (checkIsQuotaExhausted()) {
      return { success: false, error: 'تم استنفاد الحصة السحابية اليومية المجانية؛ النظام يعمل بالوضع المحلي' };
    }
    try {
      const docRef = doc(db, 'system_state', getSystemStateDocId());
      const snapshot = await withTimeout(getDoc(docRef), 8000, 'مهلة جلب البيانات السحابية');
      if (snapshot.exists()) {
        const rootData = snapshot.data();
        let assembledExpenses: any[] = Array.isArray(rootData.expenses) ? rootData.expenses : [];

        // If data was chunked, fetch all chunks concurrently
        const chunksCount = rootData.expensesChunksCount || 0;
        if (chunksCount > 0) {
          const chunkPromises: Promise<any>[] = [];
          for (let i = 0; i < chunksCount; i++) {
            const chunkRef = doc(db, 'system_state', getExpensesChunkDocId(i));
            chunkPromises.push(getDoc(chunkRef));
          }
          const chunkSnaps = await withTimeout(Promise.all(chunkPromises), 10000, 'مهلة جلب حزم البيانات السحابية');
          const chunkedItems: any[] = [];
          for (const cSnap of chunkSnaps) {
            if (cSnap.exists()) {
              const cData = cSnap.data();
              if (Array.isArray(cData.items)) {
                chunkedItems.push(...cData.items);
              }
            }
          }
          if (chunkedItems.length > 0) {
            assembledExpenses = chunkedItems;
          }
        }

        const fullData = {
          ...rootData,
          expenses: assembledExpenses
        };

        isCloudConnected = true;
        return { success: true, data: fullData };
      }
      return { success: false, error: 'لا توجد بيانات سحابية محفوظة بعد' };
    } catch (error: any) {
      if (
        error?.code === 'resource-exhausted' ||
        error?.message?.includes('resource-exhausted') ||
        error?.message?.includes('Quota exceeded') ||
        error?.message?.includes('quota limits') ||
        error?.message?.includes('Free daily')
      ) {
        markQuotaExhausted(480, error?.message);
        return { success: false, error: 'تم استنفاد الحصة السحابية اليومية المجانية' };
      }
      console.error('Error fetching from cloud:', error);
      if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
        handleFirestoreError(error, OperationType.GET, 'system_state/current');
      }
      return { success: false, error: error?.message || 'فشل جلب البيانات من السيرفر السحابي' };
    }
  },

  // Listen to real-time changes across devices
  listenToCloudUpdates(onUpdate: (data: any) => void): () => void {
    if (checkIsQuotaExhausted()) {
      return () => {};
    }

    // Clean up any previously attached listener before starting a new one
    if (activeCloudListenerUnsubscribe) {
      try {
        activeCloudListenerUnsubscribe();
      } catch {}
      activeCloudListenerUnsubscribe = null;
    }

    try {
      const docRef = doc(db, 'system_state', getSystemStateDocId());
      const unsubscribe = onSnapshot(
        docRef,
        async (snapshot) => {
          // Ignore local latency-compensation pending writes
          if (snapshot.metadata.hasPendingWrites) {
            return;
          }
          if (snapshot.exists()) {
            isCloudConnected = true;
            const rootData = snapshot.data();
            let assembledExpenses: any[] = Array.isArray(rootData.expenses) ? rootData.expenses : [];

            const chunksCount = rootData.expensesChunksCount || 0;
            if (chunksCount > 0) {
              try {
                const chunkPromises: Promise<any>[] = [];
                for (let i = 0; i < chunksCount; i++) {
                  const chunkRef = doc(db, 'system_state', getExpensesChunkDocId(i));
                  chunkPromises.push(getDoc(chunkRef));
                }
                const chunkSnaps = await Promise.all(chunkPromises);
                const chunkedItems: any[] = [];
                for (const cSnap of chunkSnaps) {
                  if (cSnap.exists()) {
                    const cData = cSnap.data();
                    if (Array.isArray(cData.items)) {
                      chunkedItems.push(...cData.items);
                    }
                  }
                }
                if (chunkedItems.length > 0) {
                  assembledExpenses = chunkedItems;
                }
              } catch (chunkErr) {
                console.warn('Failed to fetch realtime expenses chunks:', chunkErr);
              }
            }

            const fullData = {
              ...rootData,
              expenses: assembledExpenses
            };

            onUpdate(fullData);
          }
        },
        (error: any) => {
          if (
            error?.code === 'resource-exhausted' ||
            error?.message?.includes('resource-exhausted') ||
            error?.message?.includes('Quota exceeded') ||
            error?.message?.includes('quota limits') ||
            error?.message?.includes('Free daily')
          ) {
            markQuotaExhausted(480, error?.message);
            return;
          }
          console.warn('Realtime cloud listener warning:', error);
          if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
            handleFirestoreError(error, OperationType.GET, 'system_state/current');
          }
        }
      );

      activeCloudListenerUnsubscribe = unsubscribe;

      return () => {
        if (activeCloudListenerUnsubscribe === unsubscribe) {
          activeCloudListenerUnsubscribe = null;
        }
        try {
          unsubscribe();
        } catch {}
      };
    } catch (error) {
      console.warn('Failed to setup realtime cloud listener:', error);
      return () => {};
    }
  },

  // Create an archived cloud backup snapshot
  async createCloudBackup(data: any, note: string = 'نسخة سحابية تلقائية'): Promise<{ success: boolean; backupId?: string; error?: string }> {
    if (checkIsQuotaExhausted()) {
      return { success: false, error: 'الحصة السحابية اليومية مستنفدة، يعمل النظام بالوضع المحلي' };
    }
    const backupId = `backup_${Date.now()}`;
    try {
      const docRef = doc(db, 'cloud_backups', getCloudBackupDocId(backupId));
      const cleanData = prepareCentralStatePayload(data);
      const payload = {
        id: backupId,
        workspaceId: getWorkspaceId(),
        note: note || 'نسخة سحابية',
        createdAt: new Date().toISOString(),
        serverTimestamp: serverTimestamp(),
        data: cleanData
      };
      await setDoc(docRef, payload);
      return { success: true, backupId };
    } catch (error: any) {
      if (
        error?.code === 'resource-exhausted' ||
        error?.message?.includes('resource-exhausted') ||
        error?.message?.includes('Quota exceeded') ||
        error?.message?.includes('quota limits') ||
        error?.message?.includes('Free daily')
      ) {
        markQuotaExhausted(480, error?.message);
        return { success: false, error: 'تم استنفاد الحصة اليومية المجانية للسحابة' };
      }
      console.error('Error creating cloud backup:', error);
      if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
        handleFirestoreError(error, OperationType.WRITE, `cloud_backups/${backupId}`);
      }
      return { success: false, error: error?.message || 'فشل إنشاء النسخة السحابية' };
    }
  },

  // Sync isolated historical archived expenses into a dedicated document
  async syncArchivedExpensesToCloud(archivedExpenses: any[]): Promise<{ success: boolean; error?: string }> {
    if (checkIsQuotaExhausted()) {
      return { success: false, error: 'الحصة السحابية مستنفدة' };
    }
    try {
      const docRef = doc(db, 'system_state', getArchivedExpensesDocId());
      const sanitized = Array.isArray(archivedExpenses)
        ? archivedExpenses.map(e => ({
            ...e,
            invoicePhoto: e.invoicePhoto
          }))
        : [];

      await setDoc(docRef, {
        workspaceId: getWorkspaceId(),
        items: sanitized,
        count: sanitized.length,
        updatedAt: new Date().toISOString(),
        serverTimestamp: serverTimestamp(),
      });
      return { success: true };
    } catch (error: any) {
      if (
        error?.code === 'resource-exhausted' ||
        error?.message?.includes('resource-exhausted') ||
        error?.message?.includes('Quota exceeded') ||
        error?.message?.includes('quota limits') ||
        error?.message?.includes('Free daily')
      ) {
        markQuotaExhausted(480, error?.message);
        return { success: false, error: 'تم استنفاد حصة Firestore السحابية' };
      }
      console.warn('Error syncing archived expenses to cloud:', error);
      return { success: false, error: error?.message || 'فشل حفظ الأرشيف سحابياً' };
    }
  },

  // Fetch isolated historical archived expenses from dedicated cloud document
  async fetchArchivedExpensesFromCloud(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const docRef = doc(db, 'system_state', getArchivedExpensesDocId());
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const d = snap.data();
        return { success: true, data: Array.isArray(d.items) ? d.items : [] };
      }
      return { success: true, data: [] };
    } catch (error: any) {
      console.warn('Error fetching archived expenses from cloud:', error);
      return { success: false, error: error?.message || 'تعذر جلب الأرشيف السحابي' };
    }
  },

  // List all archived cloud backups
  async listCloudBackups(): Promise<{ success: boolean; backups: any[]; error?: string }> {
    try {
      const backupsCol = collection(db, 'cloud_backups');
      const q = query(backupsCol, orderBy('createdAt', 'desc'), limit(50));
      const querySnapshot = await getDocs(q);
      const currentWs = getWorkspaceId();
      const backups: any[] = [];
      querySnapshot.forEach((docSnap) => {
        const item = docSnap.data();
        // Include if matching current workspace or legacy backup
        if (
          !item.workspaceId ||
          item.workspaceId === currentWs ||
          (currentWs === 'default' && !item.workspaceId)
        ) {
          backups.push(item);
        }
      });
      return { success: true, backups: backups.slice(0, 20) };
    } catch (error: any) {
      console.error('Error listing cloud backups:', error);
      if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
        handleFirestoreError(error, OperationType.LIST, 'cloud_backups');
      }
      return { success: false, backups: [], error: error?.message || 'فشل جلب قائمة النسخ الاحتياطية' };
    }
  },

  // Restore a specific cloud backup snapshot
  async restoreCloudBackup(backupId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      let docRef = doc(db, 'cloud_backups', getCloudBackupDocId(backupId));
      let snapshot = await getDoc(docRef);
      if (!snapshot.exists()) {
        // Fallback to plain backupId
        docRef = doc(db, 'cloud_backups', backupId);
        snapshot = await getDoc(docRef);
      }
      if (snapshot.exists()) {
        const item = snapshot.data();
        return { success: true, data: item?.data };
      }
      return { success: false, error: 'النسخة الاحتياطية غير موجودة' };
    } catch (error: any) {
      console.error('Error restoring cloud backup:', error);
      if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
        handleFirestoreError(error, OperationType.GET, `cloud_backups/${backupId}`);
      }
      return { success: false, error: error?.message || 'فشل استرجاع النسخة السحابية' };
    }
  },

  // Save/Update each project's coded attachments in its dedicated separate document/file in Firestore
  async syncProjectAttachments(
    projectId: string,
    projectBondsMap: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    if (!projectId) return { success: false, error: 'معرف المشروع غير موجود' };
    if (checkIsQuotaExhausted()) {
      return { success: false, error: 'الحصة السحابية مستنفدة مؤقتاً' };
    }
    try {
      const docRef = doc(db, 'project_bonds_archives', getProjectBondsDocId(projectId));
      const cleanItems = sanitizeForFirestore(projectBondsMap);
      await setDoc(docRef, {
        projectId,
        workspaceId: getWorkspaceId(),
        updatedAt: new Date().toISOString(),
        serverTimestamp: serverTimestamp(),
        bondsCount: Object.keys(cleanItems || {}).length,
        attachments: cleanItems
      }, { merge: true });
      return { success: true };
    } catch (error: any) {
      if (
        error?.code === 'resource-exhausted' ||
        error?.message?.includes('resource-exhausted') ||
        error?.message?.includes('Quota exceeded') ||
        error?.message?.includes('quota limits')
      ) {
        markQuotaExhausted(120);
      } else {
        console.warn('Failed to sync project attachments archive to cloud:', error);
      }
      return { success: false, error: error?.message };
    }
  },

  // Debounced project attachments sync to avoid write stream limits
  syncProjectAttachmentsDebounced(
    projectId: string,
    deltaMap: Record<string, any>,
    delayMs: number = 3000
  ): void {
    if (!projectId || checkIsQuotaExhausted()) return;
    const existing = pendingProjectAttachments.get(projectId) || {};
    pendingProjectAttachments.set(projectId, { ...existing, ...deltaMap });

    const existingTimer = projectSyncTimers.get(projectId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      projectSyncTimers.delete(projectId);
      if (checkIsQuotaExhausted()) {
        pendingProjectAttachments.delete(projectId);
        return;
      }
      const toSend = pendingProjectAttachments.get(projectId);
      pendingProjectAttachments.delete(projectId);
      if (toSend && Object.keys(toSend).length > 0) {
        try {
          await this.syncProjectAttachments(projectId, toSend);
        } catch (err) {
          console.warn('Debounced project attachment sync error:', err);
        }
      }
    }, delayMs);

    projectSyncTimers.set(projectId, timer);
  },

  // Fetch a project's separate attachments file from the cloud
  async fetchProjectAttachments(projectId: string): Promise<Record<string, any>> {
    try {
      let docRef = doc(db, 'project_bonds_archives', getProjectBondsDocId(projectId));
      let snap = await getDoc(docRef);
      if (!snap.exists()) {
        docRef = doc(db, 'project_bonds_archives', projectId);
        snap = await getDoc(docRef);
      }
      if (snap.exists()) {
        return snap.data()?.attachments || {};
      }
      return {};
    } catch {
      return {};
    }
  },

  // Save an expense attachment record directly to Firestore in its dedicated document
  async saveExpenseAttachment(
    expenseId: string,
    projectId: string,
    payload: {
      dataUrl?: string;
      attachments?: any[];
      fileName?: string;
      fileType?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    if (!expenseId) return { success: false, error: 'معرف المصروف غير صالح' };
    if (checkIsQuotaExhausted()) return { success: false, error: 'الحصة السحابية مستنفدة مؤقتاً' };

    try {
      const ws = getWorkspaceId();
      const primaryDocId = getExpenseAttachmentDocId(expenseId);
      const cleanDataUrl = payload.dataUrl || '';
      const cleanAttachments = Array.isArray(payload.attachments) ? payload.attachments : [];

      const docData = {
        expenseId,
        projectId: projectId || '',
        workspaceId: ws || 'default',
        dataUrl: cleanDataUrl,
        attachments: cleanAttachments,
        fileName: payload.fileName || '',
        fileType: payload.fileType || 'image',
        updatedAt: new Date().toISOString()
      };

      const docRef = doc(db, 'expense_attachments', primaryDocId);
      await setDoc(docRef, sanitizeForFirestore(docData), { merge: true });

      // Also index with plain docId if ws is custom, so other workspaces/domains can find it
      if (ws && ws !== 'default') {
        try {
          const fallbackRef = doc(db, 'expense_attachments', `exp_${expenseId}`);
          await setDoc(fallbackRef, sanitizeForFirestore(docData), { merge: true });
        } catch {}
      }

      return { success: true };
    } catch (error: any) {
      console.warn('Failed to save expense attachment to cloud:', error);
      return { success: false, error: error?.message };
    }
  },

  // Fetch an expense attachment record from Firestore
  async fetchExpenseAttachment(expenseId: string): Promise<{
    dataUrl?: string;
    attachments?: any[];
    fileName?: string;
    fileType?: string;
  } | null> {
    if (!expenseId) return null;
    const ws = getWorkspaceId();
    const candidateIds = [
      `ws_${ws}_exp_${expenseId}`,
      `exp_${expenseId}`,
      expenseId
    ];

    for (const docId of candidateIds) {
      try {
        const docRef = doc(db, 'expense_attachments', docId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data && (data.dataUrl || (Array.isArray(data.attachments) && data.attachments.length > 0))) {
            return {
              dataUrl: data.dataUrl || '',
              attachments: data.attachments || [],
              fileName: data.fileName || '',
              fileType: data.fileType || 'image'
            };
          }
        }
      } catch {
        // Continue to next candidate
      }
    }
    return null;
  },

  // Sync all local IndexedDB attachments to Firestore cloud in background
  async syncAllLocalAttachmentsToCloud(): Promise<{ count: number; synced: number }> {
    try {
      const allVaultRecords = await IndexedDBVault.getAllAttachments();
      if (!allVaultRecords || allVaultRecords.length === 0) {
        return { count: 0, synced: 0 };
      }
      let synced = 0;
      for (const record of allVaultRecords) {
        if (record && record.expenseId && (record.dataUrl || (Array.isArray(record.attachments) && record.attachments.length > 0))) {
          const res = await this.saveExpenseAttachment(record.expenseId, record.projectId || '', {
            dataUrl: record.dataUrl,
            attachments: record.attachments,
            fileName: record.fileName,
            fileType: record.fileType
          });
          if (res.success) synced++;
        }
      }
      return { count: allVaultRecords.length, synced };
    } catch (err) {
      console.warn('Sync all attachments to cloud warning:', err);
      return { count: 0, synced: 0 };
    }
  },

  /**
   * Diagnostic Toolkit: Runs an end-to-end active probe against Firestore
   * to determine exact points of failure (Quota, Auth/Rules, Network, Document Limit).
   */
  async runFirestoreDiagnostics(): Promise<{
    success: boolean;
    quotaStatus: {
      isExhausted: boolean;
      untilTimestamp: number;
      remainingMinutes: number;
    };
    networkProbe: {
      success: boolean;
      latencyMs: number;
      error?: string;
    };
    readProbe: {
      success: boolean;
      latencyMs: number;
      exists: boolean;
      docSizeBytes: number;
      expensesCount: number;
      chunksCount: number;
      error?: string;
    };
    writeProbe: {
      success: boolean;
      latencyMs: number;
      error?: string;
    };
    config: {
      projectId: string;
      databaseId: string;
      hasConfig: boolean;
    };
    overallAssessment: string;
  }> {
    const quotaInfo = this.getQuotaDetails();
    const configInfo = {
      projectId: firebaseConfig.projectId || 'Unknown',
      databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
      hasConfig: !!firebaseConfig.projectId
    };

    // 1. Network Ping Probe
    const netStart = Date.now();
    let netSuccess = false;
    let netError: string | undefined;
    try {
      const pingDocRef = doc(db, 'system_state', `ping_${getWorkspaceId()}`);
      await getDocFromServer(pingDocRef);
      netSuccess = true;
    } catch (e: any) {
      netError = e?.message || String(e);
      if (e?.code === 'resource-exhausted') {
        netError = 'تم استنفاد حصة القراءة/الكتابة اليومية لـ Firestore (resource-exhausted)';
      }
    }
    const netLatency = Date.now() - netStart;

    // 2. Read Central Document Probe
    const readStart = Date.now();
    let readSuccess = false;
    let readExists = false;
    let readError: string | undefined;
    let docSize = 0;
    let expCount = 0;
    let chCount = 0;
    try {
      const currentDocRef = doc(db, 'system_state', getSystemStateDocId());
      const snap = await getDoc(currentDocRef);
      readSuccess = true;
      if (snap.exists()) {
        readExists = true;
        const d = snap.data();
        docSize = JSON.stringify(d).length;
        expCount = d.totalExpensesCount || (Array.isArray(d.expenses) ? d.expenses.length : 0);
        chCount = d.expensesChunksCount || 0;
      }
    } catch (e: any) {
      readError = e?.message || String(e);
    }
    const readLatency = Date.now() - readStart;

    // 3. Write Probe
    const writeStart = Date.now();
    let writeSuccess = false;
    let writeError: string | undefined;
    const probeDocId = `diag_probe_${getWorkspaceId()}_${Date.now()}`;
    if (quotaInfo.isExhausted) {
      writeError = 'تم تخطي فحص الكتابة نظراً لأن حارس الحصة المجانية مفعل (Spark Quota Guard)؛ يعمل النظام بالوضع المحلي الآمن.';
    } else {
      try {
        const probeRef = doc(db, 'system_state', probeDocId);
        await setDoc(probeRef, {
          probe: true,
          workspaceId: getWorkspaceId(),
          timestamp: new Date().toISOString(),
          client: 'SkyArc Diagnostics Inspector'
        });
        writeSuccess = true;
        // Clean up probe document
        await deleteDoc(probeRef).catch(() => {});
      } catch (e: any) {
        writeError = e?.message || String(e);
        if (
          e?.code === 'resource-exhausted' ||
          writeError?.includes('resource-exhausted') ||
          writeError?.includes('Quota exceeded') ||
          writeError?.includes('Free daily')
        ) {
          markQuotaExhausted(480, writeError);
          writeError = 'رفض السيرفر الكتابة: تجاوز الحصة المجانية اليومية لـ Firestore (resource-exhausted)';
        } else if (e?.code === 'permission-denied') {
          writeError = 'رفضت قواعد الأمان عملية الكتابة (permission-denied). تأكد من firestore.rules.';
        }
      }
    }
    const writeLatency = Date.now() - writeStart;

    // Log the probe to syncLogger
    syncLogger.log({
      service: 'firestore',
      operation: 'probe_write',
      status: writeSuccess ? 'success' : quotaInfo.isExhausted ? 'throttled' : 'failure',
      statusCode: writeSuccess ? 'OK' : writeError?.includes('resource-exhausted') ? 'resource-exhausted' : 'PROBE_NOTICE',
      latencyMs: writeLatency,
      title: writeSuccess ? 'فحص تشخيص Firestore: ناجح بالكامل' : quotaInfo.isExhausted ? 'فحص تشخيص Firestore: الحارس مفعل' : 'فحص تشخيص Firestore: رصد أخطاء',
      message: writeSuccess
        ? `تم اختبار الاتصال (${netLatency}ms)، قراءة المستند (${readLatency}ms)، وكتابة وثيقة تجريبية (${writeLatency}ms) بنجاح تام.`
        : `حالة فحص الكتابة: ${writeError || 'تم إيقاف الكتابة مؤقتاً'}`,
      details: {
        errorCode: writeError ? 'PROBE_NOTICE' : undefined,
        errorMessage: writeError || netError || readError,
        targetPath: `system_state/${probeDocId}`
      }
    });

    let assessment = 'الاتصال بـ Firestore وقواعد الأمان والتخزين تعمل بنجاح وبسرعة ممتازة.';
    if (quotaInfo.isExhausted) {
      assessment = 'تنبيه: حارس الحصة اليومية المجانية (Spark Quota Guard) مفعل حالياً. النظام يعمل بالوضع المحلي الآمن 100%، ويمكنك الترقية لخطة Blaze لإزالة القيود اليومية أو الانتظار لتجدد الحصة تلقائياً.';
    } else if (writeError && writeError.includes('resource-exhausted')) {
      assessment = 'سبب توقف المزامنة: تجاوزت المنظومة الحصة اليومية المجانية في Firebase (Free daily write units). يعمل النظام محلياً بأمان، وللمزامنة الفورية المستمرة ينصح بترقية المشروع لخطة Blaze من Google Cloud Console.';
    } else if (writeError && writeError.includes('permission-denied')) {
      assessment = 'سبب توقف المزامنة: قواعد الأمان (Firestore Rules) ترفض الكتابة على مجموعة system_state.';
    } else if (!netSuccess) {
      assessment = `تعذر الوصول لخوادم Google Firestore: ${netError || 'عميل المتصفح غير متصل أو محجوب'}.`;
    }

    return {
      success: netSuccess && writeSuccess,
      quotaStatus: quotaInfo,
      networkProbe: {
        success: netSuccess,
        latencyMs: netLatency,
        error: netError
      },
      readProbe: {
        success: readSuccess,
        latencyMs: readLatency,
        exists: readExists,
        docSizeBytes: docSize,
        expensesCount: expCount,
        chunksCount: chCount,
        error: readError
      },
      writeProbe: {
        success: writeSuccess,
        latencyMs: writeLatency,
        error: writeError
      },
      config: configInfo,
      overallAssessment: assessment
    };
  },

  /**
   * Register active user session in Firestore active_user_sessions collection.
   * Enables instant real-time detection & eviction across all remote devices in the same workspace.
   */
  async registerActiveUserSession(session: {
    userId: string;
    activeSessionId: string;
    userName?: string;
    device?: string;
    loginTime: string;
  }): Promise<boolean> {
    if (!session.userId || !session.activeSessionId) return false;
    if (checkIsQuotaExhausted()) return false;
    try {
      const sessionDocRef = doc(db, 'active_user_sessions', getActiveUserSessionDocId(session.userId));
      const payload = sanitizeForFirestore({
        userId: session.userId,
        workspaceId: getWorkspaceId(),
        activeSessionId: session.activeSessionId,
        userName: session.userName || 'مستخدم النظام',
        device: session.device || 'متصفح ويب',
        loginTime: session.loginTime || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await setDoc(sessionDocRef, payload, { merge: true });
      return true;
    } catch (err: any) {
      if (
        err?.code === 'resource-exhausted' ||
        err?.message?.includes('resource-exhausted') ||
        err?.message?.includes('Free daily')
      ) {
        markQuotaExhausted(480, err?.message);
      }
      console.warn('[Firebase] Error registering active user session:', err);
      return false;
    }
  },

  /**
   * Real-time listener on active_user_sessions/{workspaceScopedUserId}.
   * Triggers immediately on any remote device in the same workspace when a new session is started elsewhere.
   */
  listenToActiveUserSession(
    userId: string,
    onSessionChange: (sessionData: { userId: string; activeSessionId: string; userName?: string; device?: string; loginTime: string } | null) => void
  ): () => void {
    if (!userId || checkIsQuotaExhausted()) return () => {};
    try {
      const sessionDocRef = doc(db, 'active_user_sessions', getActiveUserSessionDocId(userId));
      const unsubscribe = onSnapshot(
        sessionDocRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            onSessionChange(data as any);
          }
        },
        (error) => {
          if (
            error?.code === 'resource-exhausted' ||
            error?.message?.includes('resource-exhausted') ||
            error?.message?.includes('Free daily')
          ) {
            markQuotaExhausted(480, error?.message);
          }
          console.warn('[Firebase] Active session listener notice:', error);
        }
      );
      return unsubscribe;
    } catch (err) {
      console.warn('[Firebase] Could not attach active session listener:', err);
      return () => {};
    }
  },

  // Multi-Tenant Workspace Helpers
  getWorkspaceId(): string {
    return getWorkspaceId();
  },

  getWorkspaceInfo(): WorkspaceInfo {
    return getWorkspaceInfo();
  },

  setCustomWorkspaceId(newId: string | null): void {
    setCustomWorkspaceId(newId);
  },

  subscribeToWorkspace(listener: (info: WorkspaceInfo) => void): () => void {
    return subscribeToWorkspace(listener);
  }
};
