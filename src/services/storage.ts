import {
  Project,
  Expense,
  ArchivedExpense,
  ExpenseArchiveCriteria,
  CustodyRecord,
  User,
  UserRole,
  AuthSession,
  AppSettings,
  AppNotification,
  SupportTicket,
  SupervisorSummary,
  CustomRole,
  WorkflowStage
} from '../types';
import {
  INITIAL_PROJECTS,
  INITIAL_EXPENSES,
  INITIAL_CUSTODIES,
  INITIAL_USERS,
  INITIAL_SETTINGS,
  INITIAL_TICKETS,
  INITIAL_ROLES,
  INITIAL_WORKFLOW_STAGES
} from './sampleData';
import * as XLSX from 'xlsx';
import { AttachmentArchiver } from './attachmentArchiver';

const STORAGE_KEYS = {
  PROJECTS: 'sic_projects_v10',
  EXPENSES: 'sic_expenses_v10',
  ARCHIVED_EXPENSES: 'sic_archived_expenses_v10',
  CUSTODIES: 'sic_custodies_v10',
  USERS: 'sic_users_v10',
  SETTINGS: 'sic_settings_v10',
  NOTIFICATIONS: 'sic_notifications_v10',
  TICKETS: 'sic_tickets_v10',
  CURRENT_USER: 'sic_current_user_v10',
  ROLES: 'sic_roles_v10',
  WORKFLOW_STAGES: 'sic_workflow_stages_v10',
  SYNC_QUEUE: 'sic_sync_queue_v10',
  DELETED_EXPENSE_IDS: 'sic_deleted_expense_ids_v10',
  DELETED_CUSTODY_IDS: 'sic_deleted_custody_ids_v10',
  DELETED_PROJECT_IDS: 'sic_deleted_project_ids_v10',
  DELETED_USER_IDS: 'sic_deleted_user_ids_v10',
  DELETED_ROLE_IDS: 'sic_deleted_role_ids_v10',
  DELETED_STAGE_IDS: 'sic_deleted_stage_ids_v10',
  LAST_SYNC_TIME: 'sic_last_sync_time_v10',
  QUICK_SNAPSHOT: 'sic_quick_snapshot_v10',
  AUTH_SESSION: 'sic_auth_session_v10',
  REMEMBERED_CREDENTIALS: 'sic_remembered_credentials_v10',
};

/**
 * Defensive localStorage setItem that handles browser quotas safely.
 */
export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return true;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    console.warn(`LocalStorage quota or access warning for key "${key}":`, err);
    // If saving expenses failed due to quota, strip heavy base64 strings so records themselves are safely preserved!
    // The full attachments (PDFs and high-res photos) are securely stored in IndexedDB Vault.
    if (key === STORAGE_KEYS.EXPENSES || key === STORAGE_KEYS.ARCHIVED_EXPENSES) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          const trimmed = parsed.map((item: any) => ({
            ...item,
            invoicePhoto: (item.invoicePhoto && item.invoicePhoto.length < 50000 && !item.invoicePhoto.startsWith('data:application/pdf')) ? item.invoicePhoto : '',
            attachments: Array.isArray(item.attachments)
              ? item.attachments.map((att: any) => ({
                  ...att,
                  url: (att.url && att.url.length < 50000 && !att.url.startsWith('data:application/pdf')) ? att.url : ''
                }))
              : item.attachments,
            hasAttachment: Boolean(item.invoicePhoto || (item.attachments && item.attachments.length > 0))
          }));
          localStorage.setItem(key, JSON.stringify(trimmed));
          return true;
        }
      } catch (fallbackErr) {
        console.warn('Fallback stripping in localStorage also failed:', fallbackErr);
      }
    }
    return false;
  }
}

/**
 * Helper to safely read from localStorage
 */
function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * In-Memory Runtime Store (Initialized directly from local cache with initial fallbacks)
 */
function initializeRuntimeMemoryStore() {
  const parseJson = <T>(key: string, fallback: T): T => {
    try {
      const raw = safeGetItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed !== null && parsed !== undefined) {
          return parsed;
        }
      }
    } catch {}
    return fallback;
  };

  const deletedExpenseIds = parseJson<Record<string, { id: string; deletedAt: string; deletedBy?: string }>>(STORAGE_KEYS.DELETED_EXPENSE_IDS, {});
  const deletedCustodyIds = parseJson<Record<string, { id: string; deletedAt: string; deletedBy?: string }>>(STORAGE_KEYS.DELETED_CUSTODY_IDS, {});
  const deletedProjectIds = parseJson<Record<string, { id: string; deletedAt: string; deletedBy?: string }>>(STORAGE_KEYS.DELETED_PROJECT_IDS, {});
  const deletedUserIds = parseJson<Record<string, { id: string; deletedAt: string; deletedBy?: string }>>(STORAGE_KEYS.DELETED_USER_IDS, {});
  const deletedRoleIds = parseJson<Record<string, { id: string; deletedAt: string; deletedBy?: string }>>(STORAGE_KEYS.DELETED_ROLE_IDS, {});
  const deletedWorkflowStageIds = parseJson<Record<string, { id: string; deletedAt: string; deletedBy?: string }>>(STORAGE_KEYS.DELETED_STAGE_IDS, {});

  const loadedProjects = parseJson<Project[]>(STORAGE_KEYS.PROJECTS, []).filter(p => p && p.id && !deletedProjectIds[p.id]);

  const rawCustodies = parseJson<CustodyRecord[]>(STORAGE_KEYS.CUSTODIES, []);
  const loadedCustodies = rawCustodies.filter(c => c && c.id && !deletedCustodyIds[c.id]);

  const rawUsers = parseJson<User[]>(STORAGE_KEYS.USERS, [...INITIAL_USERS]);
  const loadedUsers = rawUsers.filter(u => u && u.id && !deletedUserIds[u.id]);

  const rawExpenses = parseJson<Expense[]>(STORAGE_KEYS.EXPENSES, []);
  const loadedExpenses = rawExpenses.filter(e => e && e.id && !deletedExpenseIds[e.id]);

  const rawRoles = parseJson<CustomRole[]>(STORAGE_KEYS.ROLES, [...INITIAL_ROLES]);
  const loadedRoles = rawRoles.filter(r => r && r.id && !deletedRoleIds[r.id]);

  const rawStages = parseJson<WorkflowStage[]>(STORAGE_KEYS.WORKFLOW_STAGES, [...INITIAL_WORKFLOW_STAGES]);
  const loadedStages = rawStages.filter(s => s && s.id && !deletedWorkflowStageIds[s.id]);

  return {
    projects: loadedProjects,
    expenses: loadedExpenses,
    archivedExpenses: parseJson<ArchivedExpense[]>(STORAGE_KEYS.ARCHIVED_EXPENSES, []),
    custodies: loadedCustodies,
    users: loadedUsers,
    roles: loadedRoles,
    workflowStages: loadedStages,
    settings: parseJson<AppSettings>(STORAGE_KEYS.SETTINGS, { ...INITIAL_SETTINGS }),
    notifications: parseJson<AppNotification[]>(STORAGE_KEYS.NOTIFICATIONS, [
      {
        id: 'NOTIF-1',
        title: 'تسجيل مصروف جديد',
        message: 'قام م. أحمد خالد بتسجيل مصروف بمبلغ 1,450 ر.س لمشروع مجمع فلل الياسمين بانتظار المراجعة والاعتماد.',
        type: 'expense_added',
        category: 'expense',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        read: false,
        relatedId: 'EXP-101',
        authorEmail: 'ahmed.supervisor@project-sic.sa',
        authorName: 'م. أحمد خالد',
      }
    ]),
    tickets: parseJson<SupportTicket[]>(STORAGE_KEYS.TICKETS, [...INITIAL_TICKETS]),
    deletedExpenseIds,
    deletedCustodyIds,
    deletedProjectIds,
    deletedUserIds,
    deletedRoleIds,
    deletedWorkflowStageIds,
    currentUser: parseJson<User>(STORAGE_KEYS.CURRENT_USER, INITIAL_USERS[0]),
    quickSnapshot: null as any
  };
}

const runtimeMemoryStore = initializeRuntimeMemoryStore();

/**
 * Reset In-Memory Runtime Store to initial/clean state
 */
export function resetRuntimeMemoryStore(): void {
  runtimeMemoryStore.projects = [];
  runtimeMemoryStore.expenses = [];
  runtimeMemoryStore.archivedExpenses = [];
  runtimeMemoryStore.custodies = [];
  runtimeMemoryStore.users = [...INITIAL_USERS];
  runtimeMemoryStore.roles = [...INITIAL_ROLES];
  runtimeMemoryStore.workflowStages = [...INITIAL_WORKFLOW_STAGES];
  runtimeMemoryStore.settings = { ...INITIAL_SETTINGS };
  runtimeMemoryStore.notifications = [];
  runtimeMemoryStore.tickets = [];
  runtimeMemoryStore.deletedExpenseIds = {};
  runtimeMemoryStore.currentUser = INITIAL_USERS[0];
  runtimeMemoryStore.quickSnapshot = null;
}

/**
 * Completely purge and wipe all browser storage, cache, offline databases, and sessions.
 * Used during logout or when a concurrent session is established on another device.
 */
export async function wipeAllBrowserData(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    // 1. Clear LocalStorage completely
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.clear();
      } catch {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k) localStorage.removeItem(k);
        }
      }
    }

    // 2. Clear SessionStorage completely
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.clear();
      } catch {
        // Ignore fallback
      }
    }

    // 3. Clear Service Worker and Browser Cache Storage
    if ('caches' in window) {
      try {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(key => caches.delete(key)));
      } catch {
        // Ignore cache storage error
      }
    }

    // 4. Clear IndexedDB if present
    if ('indexedDB' in window && typeof (indexedDB as any).databases === 'function') {
      try {
        const dbs = await (indexedDB as any).databases();
        for (const db of dbs) {
          if (db?.name) indexedDB.deleteDatabase(db.name);
        }
      } catch {
        // Ignore indexeddb errors
      }
    }

    // 5. Reset In-Memory State Store
    resetRuntimeMemoryStore();

    console.info('[StorageService] Complete browser storage, session, and cache wipe successfully finished.');
  } catch (err) {
    console.warn('[StorageService] Error wiping all browser data:', err);
  }
}

export const StorageService = {
  // Purge any lingering domain cache
  purgeBrowserCache(): void {
    resetRuntimeMemoryStore();
  },

  // Load Projects
  getProjects(): Project[] {
    const deletedMap = this.getDeletedProjectIds();
    return runtimeMemoryStore.projects
      .filter(p => p && p.id && !deletedMap[p.id])
      .map(p => {
        const initMatch = INITIAL_PROJECTS.find(ip => ip.id === p.id);
        const assignedUserIds = p.assignedUserIds && p.assignedUserIds.length > 0
          ? p.assignedUserIds
          : (initMatch?.assignedUserIds || []);
        const assignedEmails = p.assignedEmails && p.assignedEmails.length > 0
          ? p.assignedEmails
          : (p.emails ? p.emails.split(',').map(e => e.trim()).filter(Boolean) : (initMatch?.assignedEmails || []));
        return {
          ...p,
          assignedUserIds,
          assignedEmails,
        };
      });
  },

  saveProjects(projects: Project[]): void {
    if (Array.isArray(projects)) {
      const deletedMap = this.getDeletedProjectIds();
      const clean = projects.filter(p => p && p.id && !deletedMap[p.id]);
      runtimeMemoryStore.projects = clean;
      safeSetItem(STORAGE_KEYS.PROJECTS, JSON.stringify(clean));
    }
  },

  // Tombstone Deletion Registry (Permanent protection against deleted items resurrecting during sync)
  getDeletedExpenseIds(): Record<string, { id: string; deletedAt: string; deletedBy?: string }> {
    return { ...runtimeMemoryStore.deletedExpenseIds };
  },

  saveDeletedExpenseIds(deletedMap: Record<string, { id: string; deletedAt: string; deletedBy?: string }>): void {
    if (deletedMap && typeof deletedMap === 'object') {
      runtimeMemoryStore.deletedExpenseIds = { ...deletedMap };
      safeSetItem(STORAGE_KEYS.DELETED_EXPENSE_IDS, JSON.stringify(deletedMap));
    }
  },

  recordDeletedExpense(id: string, deletedBy: string = 'مستخدم النظام'): void {
    if (!id) return;
    const current = this.getDeletedExpenseIds();
    current[id] = {
      id,
      deletedAt: new Date().toISOString(),
      deletedBy
    };
    this.saveDeletedExpenseIds(current);

    // Prune immediately from in-memory expenses
    try {
      runtimeMemoryStore.expenses = runtimeMemoryStore.expenses.filter(e => e.id !== id);
      safeSetItem(STORAGE_KEYS.EXPENSES, JSON.stringify(runtimeMemoryStore.expenses));
    } catch {}
  },

  recordDeletedExpenses(ids: string[], deletedBy: string = 'مستخدم النظام'): void {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const current = this.getDeletedExpenseIds();
    const nowIso = new Date().toISOString();
    ids.forEach(id => {
      if (id) {
        current[id] = { id, deletedAt: nowIso, deletedBy };
      }
    });
    this.saveDeletedExpenseIds(current);

    const idsSet = new Set(ids);
    try {
      runtimeMemoryStore.expenses = runtimeMemoryStore.expenses.filter(e => !idsSet.has(e.id));
      safeSetItem(STORAGE_KEYS.EXPENSES, JSON.stringify(runtimeMemoryStore.expenses));
    } catch {}
  },

  isExpenseDeleted(id: string): boolean {
    if (!id) return false;
    const current = this.getDeletedExpenseIds();
    return Boolean(current[id]);
  },

  // Custody Tombstones
  getDeletedCustodyIds(): Record<string, { id: string; deletedAt: string; deletedBy?: string }> {
    return { ...(runtimeMemoryStore as any).deletedCustodyIds || {} };
  },
  saveDeletedCustodyIds(deletedMap: Record<string, any>): void {
    if (deletedMap && typeof deletedMap === 'object') {
      (runtimeMemoryStore as any).deletedCustodyIds = { ...deletedMap };
      safeSetItem(STORAGE_KEYS.DELETED_CUSTODY_IDS, JSON.stringify(deletedMap));
    }
  },
  recordDeletedCustody(id: string, deletedBy: string = 'مستخدم النظام'): void {
    if (!id) return;
    const current = this.getDeletedCustodyIds();
    current[id] = { id, deletedAt: new Date().toISOString(), deletedBy };
    this.saveDeletedCustodyIds(current);
    try {
      runtimeMemoryStore.custodies = runtimeMemoryStore.custodies.filter(c => c.id !== id);
      safeSetItem(STORAGE_KEYS.CUSTODIES, JSON.stringify(runtimeMemoryStore.custodies));
    } catch {}
  },

  // Project Tombstones
  getDeletedProjectIds(): Record<string, { id: string; deletedAt: string; deletedBy?: string }> {
    return { ...(runtimeMemoryStore as any).deletedProjectIds || {} };
  },
  saveDeletedProjectIds(deletedMap: Record<string, any>): void {
    if (deletedMap && typeof deletedMap === 'object') {
      (runtimeMemoryStore as any).deletedProjectIds = { ...deletedMap };
      safeSetItem(STORAGE_KEYS.DELETED_PROJECT_IDS, JSON.stringify(deletedMap));
    }
  },
  recordDeletedProject(id: string, deletedBy: string = 'مستخدم النظام'): void {
    if (!id) return;
    const current = this.getDeletedProjectIds();
    current[id] = { id, deletedAt: new Date().toISOString(), deletedBy };
    this.saveDeletedProjectIds(current);
    try {
      runtimeMemoryStore.projects = runtimeMemoryStore.projects.filter(p => p.id !== id);
      safeSetItem(STORAGE_KEYS.PROJECTS, JSON.stringify(runtimeMemoryStore.projects));
    } catch {}
  },

  // User Tombstones
  getDeletedUserIds(): Record<string, { id: string; deletedAt: string; deletedBy?: string }> {
    return { ...(runtimeMemoryStore as any).deletedUserIds || {} };
  },
  saveDeletedUserIds(deletedMap: Record<string, any>): void {
    if (deletedMap && typeof deletedMap === 'object') {
      (runtimeMemoryStore as any).deletedUserIds = { ...deletedMap };
      safeSetItem(STORAGE_KEYS.DELETED_USER_IDS, JSON.stringify(deletedMap));
    }
  },
  recordDeletedUser(id: string, deletedBy: string = 'مستخدم النظام'): void {
    if (!id) return;
    const current = this.getDeletedUserIds();
    current[id] = { id, deletedAt: new Date().toISOString(), deletedBy };
    this.saveDeletedUserIds(current);
    try {
      runtimeMemoryStore.users = runtimeMemoryStore.users.filter(u => u.id !== id);
      safeSetItem(STORAGE_KEYS.USERS, JSON.stringify(runtimeMemoryStore.users));
    } catch {}
  },

  // Role Tombstones
  getDeletedRoleIds(): Record<string, { id: string; deletedAt: string; deletedBy?: string }> {
    return { ...(runtimeMemoryStore as any).deletedRoleIds || {} };
  },
  saveDeletedRoleIds(deletedMap: Record<string, any>): void {
    if (deletedMap && typeof deletedMap === 'object') {
      (runtimeMemoryStore as any).deletedRoleIds = { ...deletedMap };
      safeSetItem(STORAGE_KEYS.DELETED_ROLE_IDS, JSON.stringify(deletedMap));
    }
  },
  recordDeletedRole(id: string, deletedBy: string = 'مستخدم النظام'): void {
    if (!id) return;
    const current = this.getDeletedRoleIds();
    current[id] = { id, deletedAt: new Date().toISOString(), deletedBy };
    this.saveDeletedRoleIds(current);
    try {
      runtimeMemoryStore.roles = runtimeMemoryStore.roles.filter(r => r.id !== id);
      safeSetItem(STORAGE_KEYS.ROLES, JSON.stringify(runtimeMemoryStore.roles));
    } catch {}
  },

  // Workflow Stage Tombstones
  getDeletedWorkflowStageIds(): Record<string, { id: string; deletedAt: string; deletedBy?: string }> {
    return { ...(runtimeMemoryStore as any).deletedWorkflowStageIds || {} };
  },
  saveDeletedWorkflowStageIds(deletedMap: Record<string, any>): void {
    if (deletedMap && typeof deletedMap === 'object') {
      (runtimeMemoryStore as any).deletedWorkflowStageIds = { ...deletedMap };
      safeSetItem(STORAGE_KEYS.DELETED_STAGE_IDS, JSON.stringify(deletedMap));
    }
  },
  recordDeletedWorkflowStage(id: string, deletedBy: string = 'مستخدم النظام'): void {
    if (!id) return;
    const current = this.getDeletedWorkflowStageIds();
    current[id] = { id, deletedAt: new Date().toISOString(), deletedBy };
    this.saveDeletedWorkflowStageIds(current);
    try {
      runtimeMemoryStore.workflowStages = runtimeMemoryStore.workflowStages.filter(s => s.id !== id);
      safeSetItem(STORAGE_KEYS.WORKFLOW_STAGES, JSON.stringify(runtimeMemoryStore.workflowStages));
    } catch {}
  },

  // Helper to repair supervisor name if mistakenly overwritten by an approver
  repairExpenseSupervisor(e: Expense, usersList?: { email?: string; name?: string }[]): Expense {
    if (!e) return e;

    const currentSupervisor = (e.supervisorName || '').trim();
    let correctedSupervisor = currentSupervisor;
    let approverName = e.supervisorApproverName || e.projectManagerName;

    // 1. Check workflow submission record (the true author of the expense)
    const submissionAction = e.workflowHistory?.find(w => w.stageId === 'submission');
    const submissionAuthor = submissionAction?.actionByName?.trim();

    // 2. Collect all approver names from subsequent stages
    const approverNames = new Set<string>();
    if (e.projectManagerName?.trim()) approverNames.add(e.projectManagerName.trim());
    if (e.managementName?.trim()) approverNames.add(e.managementName.trim());
    if (e.accountantName?.trim()) approverNames.add(e.accountantName.trim());
    if (e.supervisorApproverName?.trim()) approverNames.add(e.supervisorApproverName.trim());
    e.workflowHistory?.forEach(w => {
      if (w.stageId !== 'submission' && w.actionByName?.trim()) {
        approverNames.add(w.actionByName.trim());
      }
    });

    // If current supervisorName equals one of the approvers, but original submitter was different
    if (submissionAuthor && approverNames.has(currentSupervisor) && currentSupervisor !== submissionAuthor) {
      correctedSupervisor = submissionAuthor;
      if (!approverName) approverName = currentSupervisor;
    } else if (!submissionAuthor && e.supervisorEmail && approverNames.has(currentSupervisor)) {
      const activeUsers = usersList || runtimeMemoryStore.users;
      const matchedUser = activeUsers?.find(u => u.email?.toLowerCase().trim() === e.supervisorEmail?.toLowerCase().trim());
      if (matchedUser?.name?.trim() && matchedUser.name.trim() !== currentSupervisor) {
        correctedSupervisor = matchedUser.name.trim();
        if (!approverName) approverName = currentSupervisor;
      }
    }

    if (correctedSupervisor !== currentSupervisor || (approverName && approverName !== e.supervisorApproverName)) {
      return {
        ...e,
        supervisorName: correctedSupervisor,
        supervisorApproverName: approverName,
      };
    }

    return e;
  },

  // Load Expenses
  getExpenses(): Expense[] {
    const deletedMap = runtimeMemoryStore.deletedExpenseIds;

    return runtimeMemoryStore.expenses
      .filter(e => e && e.id && !deletedMap[e.id])
      .map(e => {
        let resolvedPhoto = e.invoicePhoto;
        let resolvedAttachments = e.attachments;
        if (e.projectId) {
          try {
            const arc = AttachmentArchiver.getAttachmentByExpenseId(e.projectId, e.id);
            if (arc) {
              if ((!resolvedPhoto || resolvedPhoto.trim() === '') && arc.dataUrl) {
                resolvedPhoto = arc.dataUrl;
              }
              if ((!resolvedAttachments || resolvedAttachments.length === 0) && Array.isArray(arc.attachments) && arc.attachments.length > 0) {
                resolvedAttachments = arc.attachments;
              }
            }
          } catch {}
        }

        // Return the stored expense faithfully, healing supervisor name if corrupted by an approver
        const healed = this.repairExpenseSupervisor(e);
        if (healed.supervisorName !== e.supervisorName) {
          e.supervisorName = healed.supervisorName;
          e.supervisorApproverName = healed.supervisorApproverName;
        }

        return {
          ...healed,
          invoicePhoto: resolvedPhoto,
          attachments: resolvedAttachments,
          status: healed.status || 'بانتظار الاعتماد',
          currentStageId: healed.currentStageId !== undefined ? healed.currentStageId : (healed.status === 'معتمد' ? undefined : 'stage_supervisor'),
          currentStageIndex: typeof healed.currentStageIndex === 'number' ? healed.currentStageIndex : (healed.status === 'معتمد' ? 3 : 0),
          supervisorApproval: healed.supervisorApproval || 'غير معتمد',
          projectManagerApproval: healed.projectManagerApproval || 'غير معتمد',
          accountantApproval: healed.accountantApproval || 'غير معتمد',
          managementApproval: healed.managementApproval || 'غير معتمد',
          erpPostingStatus: healed.erpPostingStatus || 'غير مرحل',
        };
      });
  },

  saveExpenses(expenses: Expense[]): void {
    if (!Array.isArray(expenses)) return;

    // Filter out any expense marked as deleted in the tombstone registry
    const deletedMap = runtimeMemoryStore.deletedExpenseIds;
    const filteredExpenses = expenses.filter(e => e && e.id && !deletedMap[e.id]);

    try {
      // Group expenses with attachments by project and save to high-capacity IndexedDB vault
      const projectMap = new Map<string, Expense[]>();
      filteredExpenses.forEach(e => {
        const hasDataPhoto = e.invoicePhoto && e.invoicePhoto.startsWith('data:');
        const hasDataAttachments = Array.isArray(e.attachments) && e.attachments.some(a => a.url && a.url.startsWith('data:'));
        if (e.projectId && (hasDataPhoto || hasDataAttachments)) {
          const list = projectMap.get(e.projectId) || [];
          list.push(e);
          projectMap.set(e.projectId, list);
        }
      });

      projectMap.forEach((projectExpenses, projectId) => {
        AttachmentArchiver.saveBatchProjectAttachments(projectId, projectExpenses);
      });
    } catch (err) {
      console.warn('Offloading attachments to vault warning:', err);
    }

    runtimeMemoryStore.expenses = filteredExpenses;
    safeSetItem(STORAGE_KEYS.EXPENSES, JSON.stringify(filteredExpenses));
  },

  // Load Archived Expenses (Historical Archive stored in runtime memory)
  getArchivedExpenses(): ArchivedExpense[] {
    return runtimeMemoryStore.archivedExpenses.map(e => {
      let resolvedPhoto = e.invoicePhoto;
      if ((!resolvedPhoto || resolvedPhoto.trim() === '') && e.projectId) {
        try {
          const arc = AttachmentArchiver.getAttachmentByExpenseId(e.projectId, e.id);
          if (arc?.dataUrl) {
            resolvedPhoto = arc.dataUrl;
          }
        } catch {}
      }
      return {
        ...e,
        invoicePhoto: resolvedPhoto,
        isArchived: true,
        fiscalYear: e.fiscalYear || new Date(e.date || e.fingerprintTime).getFullYear(),
        archivedAt: e.archivedAt || new Date().toISOString(),
        archivedBy: e.archivedBy || 'مدير النظام',
      };
    });
  },

  saveArchivedExpenses(archivedExpenses: ArchivedExpense[]): void {
    if (!Array.isArray(archivedExpenses)) return;
    runtimeMemoryStore.archivedExpenses = [...archivedExpenses];
    safeSetItem(STORAGE_KEYS.ARCHIVED_EXPENSES, JSON.stringify(archivedExpenses));
  },

  // Execute Archiving by Criteria: moves records from active expenses to archived expenses
  archiveExpenses(
    criteria: ExpenseArchiveCriteria,
    archivedBy: string = 'مدير النظام'
  ): {
    archivedCount: number;
    archivedAmount: number;
    activeExpensesRemaining: Expense[];
    updatedArchivedExpenses: ArchivedExpense[];
  } {
    const currentActive = this.getExpenses();
    const currentArchived = this.getArchivedExpenses();
    const nowIso = new Date().toISOString();

    const toArchive: Expense[] = [];
    const remainingActive: Expense[] = [];

    const targetCutoffYear = criteria.targetFiscalYear || (criteria.currentFiscalYear ? criteria.currentFiscalYear - 1 : 2025);

    currentActive.forEach(e => {
      const expDate = e.date ? new Date(e.date) : new Date(e.fingerprintTime);
      const expYear = expDate.getFullYear();

      let matches = false;

      if (criteria.mode === 'prior_fiscal_years') {
        // All expenses prior to the specified current fiscal year
        const currentYear = criteria.currentFiscalYear || 2026;
        matches = expYear < currentYear;
      } else if (criteria.mode === 'specific_year') {
        matches = expYear === targetCutoffYear;
      } else if (criteria.mode === 'before_date') {
        if (criteria.beforeDate) {
          matches = (e.date || '').slice(0, 10) < criteria.beforeDate;
        }
      } else if (criteria.mode === 'completed_projects') {
        if (criteria.projectIds && criteria.projectIds.length > 0) {
          matches = criteria.projectIds.includes(e.projectId) || criteria.projectIds.includes(e.projectName);
        } else {
          // If no specific project IDs provided, match all projects with status 'مكتمل'
          const completedProjects = this.getProjects().filter(p => p.status === 'مكتمل');
          const completedIds = completedProjects.map(p => p.id);
          const completedNames = completedProjects.map(p => p.name);
          matches = completedIds.includes(e.projectId) || completedNames.includes(e.projectName);
        }
      } else if (criteria.mode === 'custom_selection') {
        if (criteria.expenseIds && criteria.expenseIds.length > 0) {
          matches = criteria.expenseIds.includes(e.id);
        }
      }

      // Check project filter if specified alongside other non-completed_projects modes
      if (matches && criteria.mode !== 'completed_projects' && criteria.projectIds && criteria.projectIds.length > 0) {
        const matchesProject = criteria.projectIds.includes(e.projectId) || criteria.projectIds.includes(e.projectName);
        if (!matchesProject) {
          matches = false;
        }
      }

      // Check approval filter if enabled
      if (matches && criteria.onlyApproved) {
        const isApproved =
          e.status === 'معتمد' ||
          e.erpPostingStatus === 'تم الترحيل للبرنامج المحاسبي' ||
          e.managementApproval === 'تم اعتماد الادارة';
        if (!isApproved) {
          matches = false;
        }
      }

      if (matches) {
        toArchive.push(e);
      } else {
        remainingActive.push(e);
      }
    });

    if (toArchive.length === 0) {
      return {
        archivedCount: 0,
        archivedAmount: 0,
        activeExpensesRemaining: currentActive,
        updatedArchivedExpenses: currentArchived,
      };
    }

    const shouldStripAttachments = Boolean(criteria.stripAttachments && !criteria.keepAttachments);

    const newArchivedRecords: ArchivedExpense[] = toArchive.map(e => ({
      ...e,
      invoicePhoto: shouldStripAttachments ? '' : (e.invoicePhoto || ''),
      isArchived: true,
      archivedAt: nowIso,
      archivedBy: archivedBy || 'مدير النظام',
      archivedReason: criteria.reason || (
        criteria.mode === 'prior_fiscal_years'
          ? `أرشفة آلية للسنوات السابقة لما قبل ${criteria.currentFiscalYear || 2026}`
          : criteria.mode === 'specific_year'
          ? `أرشفة المصروفات المنتهية لسنة ${targetCutoffYear}`
          : criteria.mode === 'before_date'
          ? `أرشفة ما قبل تاريخ ${criteria.beforeDate}`
          : 'أرشفة يدوية بواسطة الإدارة'
      ),
      fiscalYear: e.date ? new Date(e.date).getFullYear() : new Date().getFullYear(),
    }));

    const updatedArchived = [...currentArchived, ...newArchivedRecords];

    this.saveExpenses(remainingActive);
    this.saveArchivedExpenses(updatedArchived);

    const totalAmount = toArchive.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    return {
      archivedCount: toArchive.length,
      archivedAmount: totalAmount,
      activeExpensesRemaining: remainingActive,
      updatedArchivedExpenses: updatedArchived,
    };
  },

  // Restore archived expenses back into active dataset
  restoreArchivedExpenses(expenseIds: string[]): {
    restoredCount: number;
    activeExpenses: Expense[];
    remainingArchived: ArchivedExpense[];
  } {
    const currentActive = this.getExpenses();
    const currentArchived = this.getArchivedExpenses();

    const idsSet = new Set(expenseIds);
    const toRestore: Expense[] = [];
    const remainingArchived: ArchivedExpense[] = [];

    currentArchived.forEach(item => {
      if (idsSet.has(item.id)) {
        const { isArchived, archivedAt, archivedBy, archivedReason, ...activeItem } = item;
        toRestore.push(activeItem as Expense);
      } else {
        remainingArchived.push(item);
      }
    });

    const updatedActive = [...currentActive, ...toRestore];

    this.saveExpenses(updatedActive);
    this.saveArchivedExpenses(remainingArchived);

    return {
      restoredCount: toRestore.length,
      activeExpenses: updatedActive,
      remainingArchived,
    };
  },

  // Permanently delete archived expenses from the archive store
  deleteArchivedExpenses(expenseIds: string[]): {
    deletedCount: number;
    remainingArchived: ArchivedExpense[];
  } {
    const currentArchived = this.getArchivedExpenses();
    const idsSet = new Set(expenseIds);
    const remainingArchived = currentArchived.filter(item => !idsSet.has(item.id));
    this.saveArchivedExpenses(remainingArchived);
    return {
      deletedCount: currentArchived.length - remainingArchived.length,
      remainingArchived,
    };
  },

  // Load Custodies
  getCustodies(): CustodyRecord[] {
    const deletedMap = this.getDeletedCustodyIds();
    return runtimeMemoryStore.custodies.filter(c => c && c.id && !deletedMap[c.id]);
  },

  saveCustodies(custodies: CustodyRecord[]): void {
    if (Array.isArray(custodies)) {
      const deletedMap = this.getDeletedCustodyIds();
      const clean = custodies.filter(c => c && c.id && !deletedMap[c.id]);
      runtimeMemoryStore.custodies = clean;
      safeSetItem(STORAGE_KEYS.CUSTODIES, JSON.stringify(clean));
    }
  },

  // Load Users (Full RBAC support: system roles + custom roles)
  getUsers(): User[] {
    const deletedMap = this.getDeletedUserIds();
    const users = runtimeMemoryStore.users.filter(u => u && u.id && !deletedMap[u.id]);
    const availableRoles = this.getRoles();

    return users.map(u => {
      const initUser = INITIAL_USERS.find(iu => iu.id === u.id || iu.email?.toLowerCase() === u.email?.toLowerCase());
      
      let username = u.username;
      if (!username) {
        if (u.id === 'USR-01' || u.email?.toLowerCase().includes('mansour')) {
          username = 'm.mansour';
        } else if (initUser?.username) {
          username = initUser.username;
        } else if (u.email) {
          username = u.email.split('@')[0];
        } else {
          username = `user_${u.id.toLowerCase()}`;
        }
      }

      const password = u.password || initUser?.password || 'Password@2026';
      const avatar = u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
      const assignedProjects = Array.isArray(u.assignedProjects) && u.assignedProjects.length > 0
        ? u.assignedProjects
        : (initUser?.assignedProjects || (u.id === 'USR-03' ? ['PRJ-01', 'PRJ-02'] : []));

      // Resolve role & roleId dynamically against available system and custom roles
      let matchedRole: CustomRole | undefined;

      // 1. Match by roleId directly if available
      if (u.roleId) {
        matchedRole = availableRoles.find(r => r.id === u.roleId);
      }

      // 2. Match by exact role name if not matched by roleId
      if (!matchedRole && u.role) {
        matchedRole = availableRoles.find(r => r.name === u.role);
      }

      // 3. Fallback matching for default initial accounts if no specific role was configured
      if (!matchedRole && !u.roleId && !u.role) {
        if (u.id === 'USR-01' || u.email?.toLowerCase() === '2030m.mansour@gmail.com') {
          matchedRole = availableRoles.find(r => r.id === 'role_admin');
        } else if (u.id === 'USR-02') {
          matchedRole = availableRoles.find(r => r.id === 'role_accountant');
        } else if (u.id === 'USR-03') {
          matchedRole = availableRoles.find(r => r.id === 'role_supervisor');
        }
      }

      // 4. Keyword fallback only if role is a legacy arabic string without roleId
      if (!matchedRole && !u.roleId && u.role) {
        if (
          u.role.includes('مدير') ||
          u.role.includes('عليا') ||
          u.role.includes('تنفيذي') ||
          u.role.includes('عام')
        ) {
          matchedRole = availableRoles.find(r => r.id === 'role_admin');
        } else if (u.role.includes('محاسب')) {
          matchedRole = availableRoles.find(r => r.id === 'role_accountant');
        } else if (u.role === 'مشرف' || u.role === 'مشرف موقع') {
          matchedRole = availableRoles.find(r => r.id === 'role_supervisor');
        }
      }

      // If matched with an existing system or custom role, preserve all settings
      if (matchedRole) {
        return {
          ...u,
          username: username || (matchedRole.id === 'role_admin' ? 'm.mansour' : matchedRole.id === 'role_accountant' ? 'sami.accountant' : u.username || 'user'),
          password,
          avatar,
          assignedProjects,
          role: matchedRole.name as UserRole,
          roleId: matchedRole.id,
          permissions: u.permissions || matchedRole.permissions,
        };
      }

      // If user has a custom role name and roleId that wasn't found in memory yet, NEVER overwrite it!
      if (u.role && u.roleId) {
        return {
          ...u,
          username: username || 'user',
          password,
          avatar,
          assignedProjects,
          role: u.role,
          roleId: u.roleId,
          permissions: u.permissions,
        };
      }

      // Ultimate fallback only for unassigned users
      const defaultSupervisorRole = availableRoles.find(r => r.id === 'role_supervisor');
      return {
        ...u,
        username: username || (u.id === 'USR-03' ? 'ahmed.supervisor' : 'user'),
        password,
        avatar,
        assignedProjects,
        role: u.role || (defaultSupervisorRole ? (defaultSupervisorRole.name as UserRole) : 'مشرف موقع'),
        roleId: u.roleId || 'role_supervisor',
        permissions: u.permissions || defaultSupervisorRole?.permissions,
      };
    });
  },

  saveUsers(users: User[]): void {
    if (Array.isArray(users)) {
      const deletedMap = this.getDeletedUserIds();
      const clean = users.filter(u => u && u.id && !deletedMap[u.id]);
      runtimeMemoryStore.users = clean;
      safeSetItem(STORAGE_KEYS.USERS, JSON.stringify(clean));
    }
  },

  // Load Roles (Core system roles + custom roles defined by users)
  getRoles(): CustomRole[] {
    const deletedMap = this.getDeletedRoleIds();
    const allMasterScreens = [
      'dashboard',
      'expenses',
      'approvals',
      'custodies',
      'projects',
      'supervisors',
      'reports',
      'settings',
      'support'
    ];

    const parsed = runtimeMemoryStore.roles.filter(r => r && r.id && !deletedMap[r.id]);
    const defaultAdmin = INITIAL_ROLES.find(ir => ir.id === 'role_admin')!;
    const defaultAccountant = INITIAL_ROLES.find(ir => ir.id === 'role_accountant')!;
    const defaultSupervisor = INITIAL_ROLES.find(ir => ir.id === 'role_supervisor')!;

    const storedAdmin = parsed.find(r => r.id === 'role_admin' || r.id === 'role_management');
    const storedAccountant = parsed.find(r => r.id === 'role_accountant');
    const storedSupervisor = parsed.find(r => r.id === 'role_supervisor');

    const result: CustomRole[] = [
      // Role 1: مدير تنفيذي أو مدير عام / إدارة عليا (Sovereign Manager)
      {
        ...defaultAdmin,
        ...(storedAdmin || {}),
        id: 'role_admin',
        name: 'مدير تنفيذي أو مدير عام / إدارة عليا',
        description: defaultAdmin.description,
        badgeColor: defaultAdmin.badgeColor,
        isSystem: true,
        permissions: {
          ...defaultAdmin.permissions,
          ...(storedAdmin?.permissions || {}),
          allowedScreens: allMasterScreens, // Open & visible permanently
          canViewAllProjects: true,
          canViewAllExpenses: true,
          canViewFinancialReports: true,
          canViewCustodies: true,
          canViewTeamMembers: true,
          canCreateExpense: true,
          canEditExpense: true,
          canDeleteExpense: true,
          expenseEditGraceMinutes: 9999,
          canManageCustody: true,
          canManageProjects: true,
          canApproveAsProjectManager: true,
          canApproveAsAccountant: true,
          canExportToExternalERP: true,
          canApproveAsManagement: true,
          canBatchApprove: true,
          canManageRolesAndPermissions: true,
          canConfigureWorkflow: true,
          canExportExcelAndBackup: true,
        }
      },
      // Role 2: محاسب مالي
      {
        ...defaultAccountant,
        ...(storedAccountant || {}),
        id: 'role_accountant',
        name: 'محاسب مالي',
        description: defaultAccountant.description,
        badgeColor: defaultAccountant.badgeColor,
        isSystem: true,
        permissions: {
          ...defaultAccountant.permissions,
          ...(storedAccountant?.permissions || {}),
          allowedScreens: (Array.isArray(storedAccountant?.permissions?.allowedScreens) && storedAccountant.permissions.allowedScreens.length > 0
            ? storedAccountant.permissions.allowedScreens
            : defaultAccountant.permissions.allowedScreens
          ).filter(s => s !== 'supervisors' && s !== 'settings'),
          canViewAllProjects: storedAccountant?.permissions?.canViewAllProjects ?? true,
          canViewAllExpenses: storedAccountant?.permissions?.canViewAllExpenses ?? true,
          canViewTeamMembers: false,
          canManageProjects: false,
        }
      },
      // Role 3: مشرف موقع
      {
        ...defaultSupervisor,
        ...(storedSupervisor || {}),
        id: 'role_supervisor',
        name: 'مشرف موقع',
        description: defaultSupervisor.description,
        badgeColor: defaultSupervisor.badgeColor,
        isSystem: true,
        permissions: {
          ...defaultSupervisor.permissions,
          ...(storedSupervisor?.permissions || {}),
          allowedScreens: Array.isArray(storedSupervisor?.permissions?.allowedScreens) && storedSupervisor.permissions.allowedScreens.length > 0
            ? storedSupervisor.permissions.allowedScreens
            : defaultSupervisor.permissions.allowedScreens,
          canViewAllProjects: false,
          canViewAllExpenses: false,
          canManageProjects: false,
          expenseEditGraceMinutes:
            typeof storedSupervisor?.permissions?.expenseEditGraceMinutes === 'number'
              ? storedSupervisor.permissions.expenseEditGraceMinutes
              : 30,
        }
      }
    ];

    // Preserve and return all custom roles created by users
    const customRoles = parsed.filter(r => {
      const isSystemRole = r.id === 'role_admin' || r.id === 'role_management' || r.id === 'role_accountant' || r.id === 'role_supervisor';
      return !isSystemRole;
    });

    result.push(...customRoles);

    return result;
  },

  saveRoles(roles: CustomRole[]): void {
    const allMasterScreens = [
      'dashboard',
      'expenses',
      'approvals',
      'custodies',
      'projects',
      'supervisors',
      'reports',
      'settings',
      'support'
    ];

    const sanitized = roles.map(r => {
      const isManagerRole = r.id === 'role_admin' || r.id === 'role_management';
      if (isManagerRole) {
        return {
          ...r,
          id: 'role_admin',
          name: r.name || 'مدير تنفيذي أو مدير عام / إدارة عليا',
          isSystem: true,
          permissions: {
            ...r.permissions,
            allowedScreens: allMasterScreens,
            canViewAllProjects: true,
            canViewAllExpenses: true,
            canViewFinancialReports: true,
            canViewCustodies: true,
            canViewTeamMembers: true,
            canCreateExpense: true,
            canEditExpense: true,
            canDeleteExpense: true,
            expenseEditGraceMinutes: 9999,
            canManageCustody: true,
            canManageProjects: true,
            canApproveAsProjectManager: true,
            canApproveAsAccountant: true,
            canExportToExternalERP: true,
            canApproveAsManagement: true,
            canBatchApprove: true,
            canManageRolesAndPermissions: true,
            canConfigureWorkflow: true,
            canExportExcelAndBackup: true,
          }
        };
      }
      return r;
    });

    runtimeMemoryStore.roles = sanitized;
    safeSetItem(STORAGE_KEYS.ROLES, JSON.stringify(sanitized));
  },

  // Load Workflow Stages
  getWorkflowStages(): WorkflowStage[] {
    const deletedMap = this.getDeletedWorkflowStageIds();
    const raw = runtimeMemoryStore.workflowStages || [];
    const parsed = raw.filter(s => s && s.id && !deletedMap[s.id]);

    if (parsed.length === 0) {
      const init = [...INITIAL_WORKFLOW_STAGES].filter(s => !deletedMap[s.id]);
      runtimeMemoryStore.workflowStages = init;
      return init;
    }

    // Sort by order ascending (from top to bottom)
    const sorted = [...parsed].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    return sorted.map((s, idx) => ({
      ...s,
      order: idx + 1,
      requiredRoleName:
        s.requiredRoleName ||
        (s.requiredRoleId === 'role_admin' || s.requiredRoleId === 'role_management'
          ? 'مدير تنفيذي أو مدير عام / إدارة عليا'
          : s.requiredRoleId === 'role_accountant'
          ? 'محاسب مالي'
          : s.requiredRoleId === 'role_supervisor'
          ? 'مشرف موقع'
          : s.requiredRoleId)
    }));
  },

  saveWorkflowStages(stages: WorkflowStage[]): void {
    if (Array.isArray(stages)) {
      runtimeMemoryStore.workflowStages = [...stages];
      safeSetItem(STORAGE_KEYS.WORKFLOW_STAGES, JSON.stringify(stages));
    }
  },

  // Load Settings
  getSettings(): AppSettings {
    const parsed = runtimeMemoryStore.settings;
    return {
      ...INITIAL_SETTINGS,
      ...parsed,
      customCategories:
        Array.isArray(parsed?.customCategories) && parsed.customCategories.length > 0
          ? parsed.customCategories
          : INITIAL_SETTINGS.customCategories,
      customErpSystems:
        Array.isArray(parsed?.customErpSystems) && parsed.customErpSystems.length > 0
          ? parsed.customErpSystems
          : INITIAL_SETTINGS.customErpSystems,
      erpSystemName: parsed?.erpSystemName || INITIAL_SETTINGS.erpSystemName || 'Odoo ERP (أودو)',
    };
  },

  saveSettings(settings: AppSettings): void {
    if (settings && typeof settings === 'object') {
      runtimeMemoryStore.settings = { ...settings };
      safeSetItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    }
  },

  // Per-User Isolated Theme Management
  getUserTheme(userId?: string): 'system' | 'light' | 'dark' {
    try {
      if (userId) {
        const userSpecific = localStorage.getItem(`skyarc_user_theme_${userId}`);
        if (userSpecific === 'light' || userSpecific === 'dark' || userSpecific === 'system') {
          return userSpecific;
        }
      }
      const session = this.getAuthSession();
      if (session?.userId) {
        const sessionUserTheme = localStorage.getItem(`skyarc_user_theme_${session.userId}`);
        if (sessionUserTheme === 'light' || sessionUserTheme === 'dark' || sessionUserTheme === 'system') {
          return sessionUserTheme;
        }
        const user = this.getUsers().find(u => u.id === session.userId);
        if (user?.themePreference) {
          return user.themePreference;
        }
      }
      const active = localStorage.getItem('skyarc_active_user_theme');
      if (active === 'light' || active === 'dark' || active === 'system') {
        return active;
      }
      return 'light';
    } catch {
      return 'light';
    }
  },

  setUserTheme(theme: 'system' | 'light' | 'dark', userId?: string): void {
    try {
      localStorage.setItem('skyarc_active_user_theme', theme);
      if (userId) {
        localStorage.setItem(`skyarc_user_theme_${userId}`, theme);
      }
      const session = this.getAuthSession();
      if (session?.userId) {
        localStorage.setItem(`skyarc_user_theme_${session.userId}`, theme);
      }
    } catch (e) {
      console.warn('Could not save user theme:', e);
    }
  },

  // Load Notifications
  getNotifications(): AppNotification[] {
    return [...runtimeMemoryStore.notifications];
  },

  saveNotifications(notifications: AppNotification[]): void {
    if (Array.isArray(notifications)) {
      runtimeMemoryStore.notifications = [...notifications];
      safeSetItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    }
  },

  // Support Tickets
  getTickets(): SupportTicket[] {
    return [...runtimeMemoryStore.tickets];
  },

  saveTickets(tickets: SupportTicket[]): void {
    if (Array.isArray(tickets)) {
      runtimeMemoryStore.tickets = [...tickets];
      safeSetItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
    }
  },

  // Current User (With dynamic RBAC support)
  getCurrentUser(): User {
    if (runtimeMemoryStore.currentUser) {
      const u = runtimeMemoryStore.currentUser;
      const availableRoles = this.getRoles();

      let matchedRole: CustomRole | undefined;
      if (u.roleId) {
        matchedRole = availableRoles.find(r => r.id === u.roleId);
      }
      if (!matchedRole && u.role) {
        matchedRole = availableRoles.find(r => r.name === u.role);
      }

      if (!matchedRole) {
        if (
          u.role?.includes('مدير') ||
          u.role?.includes('عليا') ||
          u.role?.includes('تنفيذي') ||
          u.role?.includes('عام') ||
          u.email?.toLowerCase() === '2030m.mansour@gmail.com'
        ) {
          matchedRole = availableRoles.find(r => r.id === 'role_admin');
        } else if (u.role?.includes('محاسب')) {
          matchedRole = availableRoles.find(r => r.id === 'role_accountant');
        }
      }

      if (matchedRole) {
        return {
          ...u,
          role: matchedRole.name as UserRole,
          roleId: matchedRole.id,
          permissions: u.permissions || matchedRole.permissions,
        };
      }

      if (u.role && u.roleId) {
        return { ...u };
      }

      const defaultSupervisor = availableRoles.find(r => r.id === 'role_supervisor');
      return {
        ...u,
        role: u.role || (defaultSupervisor ? (defaultSupervisor.name as UserRole) : 'مشرف موقع'),
        roleId: u.roleId || 'role_supervisor',
        permissions: u.permissions || defaultSupervisor?.permissions,
      };
    }
    const users = this.getUsers();
    return users[0] || INITIAL_USERS[0]; // Executive Manager by default
  },

  saveCurrentUser(user: User): void {
    if (user && typeof user === 'object') {
      runtimeMemoryStore.currentUser = { ...user };
      safeSetItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    }
  },

  // Authentication Session
  getAuthSession(): AuthSession | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // fallback
    }
    return null;
  },

  saveAuthSession(session: AuthSession | null): void {
    if (session) {
      safeSetItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    }
  },

  clearAuthSession(): void {
    localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
  },

  // Full browser data wipe (Logout / Concurrent Session eviction)
  async wipeAllBrowserData(): Promise<void> {
    await wipeAllBrowserData();
  },

  resetRuntimeMemoryStore(): void {
    resetRuntimeMemoryStore();
  },

  // Remembered Login Credentials on this device
  getRememberedCredentials(): { identifier: string; password?: string; rememberMe: boolean } | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.REMEMBERED_CREDENTIALS);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // fallback
    }
    return null;
  },

  saveRememberedCredentials(creds: { identifier: string; password?: string; rememberMe: boolean } | null): void {
    if (creds && creds.rememberMe) {
      safeSetItem(STORAGE_KEYS.REMEMBERED_CREDENTIALS, JSON.stringify(creds));
    } else {
      localStorage.removeItem(STORAGE_KEYS.REMEMBERED_CREDENTIALS);
    }
  },

  clearRememberedCredentials(): void {
    localStorage.removeItem(STORAGE_KEYS.REMEMBERED_CREDENTIALS);
  },

  // Reset all users password (by Admin/Executive Manager)
  resetAllUsersPassword(newPassword: string = 'Password@2026'): User[] {
    const users = this.getUsers();
    const now = new Date().toISOString();
    const updatedUsers = users.map(u => ({
      ...u,
      password: newPassword,
      passwordChangedAt: now,
      passwordResetByAdmin: true
    }));
    this.saveUsers(updatedUsers);
    return updatedUsers;
  },

  // Sync Queue (for Offline changes)
  getSyncQueue(): { id: string; type: 'expense' | 'custody' | 'project'; action: 'create' | 'update' | 'delete'; data: any; timestamp: string }[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  addToSyncQueue(item: { type: 'expense' | 'custody' | 'project'; action: 'create' | 'update' | 'delete'; data: any }): void {
    const queue = this.getSyncQueue();
    queue.push({
      id: 'SYNC-' + Math.random().toString(36).substring(2, 9),
      ...item,
      timestamp: new Date().toISOString(),
    });
    safeSetItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
  },

  clearSyncQueue(): void {
    localStorage.removeItem(STORAGE_KEYS.SYNC_QUEUE);
    safeSetItem(STORAGE_KEYS.LAST_SYNC_TIME, new Date().toISOString());
  },

  getLastSyncTime(): string {
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNC_TIME) || new Date().toISOString();
  },

  // Get complete system backup object
  getFullBackupData() {
    const currentUser = this.getCurrentUser();
    return {
      app: 'SkyArc Expenses & Custody System',
      version: '10.0',
      exportedAt: new Date().toISOString(),
      exportedBy: currentUser ? `${currentUser.name} (${currentUser.username})` : 'مدير النظام',
      projects: this.getProjects(),
      deletedProjectIds: this.getDeletedProjectIds(),
      expenses: this.getExpenses(),
      deletedExpenseIds: this.getDeletedExpenseIds(),
      custodies: this.getCustodies(),
      deletedCustodyIds: this.getDeletedCustodyIds(),
      users: this.getUsers(),
      deletedUserIds: this.getDeletedUserIds(),
      roles: this.getRoles(),
      deletedRoleIds: this.getDeletedRoleIds(),
      workflowStages: this.getWorkflowStages(),
      deletedWorkflowStageIds: this.getDeletedWorkflowStageIds(),
      settings: this.getSettings(),
      tickets: this.getTickets(),
      notifications: this.getNotifications(),
    };
  },

  // Export full system backup to JSON string
  exportBackupJSON(): string {
    const backup = this.getFullBackupData();
    return JSON.stringify(backup, null, 2);
  },

  // Trigger immediate browser download of backup JSON file
  downloadBackupJSON(): {
    success: boolean;
    filename: string;
    stats: {
      projectsCount: number;
      expensesCount: number;
      custodiesCount: number;
      usersCount: number;
      rolesCount: number;
      stagesCount: number;
      ticketsCount: number;
    };
  } {
    try {
      const backup = this.getFullBackupData();
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
      const filename = `نسخة_احتياطية_شاملة_سكاي_ارك_${dateStr}_${timeStr}.json`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);

      return {
        success: true,
        filename,
        stats: {
          projectsCount: backup.projects?.length || 0,
          expensesCount: backup.expenses?.length || 0,
          custodiesCount: backup.custodies?.length || 0,
          usersCount: backup.users?.length || 0,
          rolesCount: backup.roles?.length || 0,
          stagesCount: backup.workflowStages?.length || 0,
          ticketsCount: backup.tickets?.length || 0,
        }
      };
    } catch (e) {
      console.error('Download backup failed:', e);
      throw e;
    }
  },

  // Validate backup file before importing and return contents summary
  validateBackupJSON(jsonStr: string): {
    isValid: boolean;
    error?: string;
    stats?: {
      exportedAt?: string;
      version?: string;
      exportedBy?: string;
      projectsCount: number;
      expensesCount: number;
      custodiesCount: number;
      usersCount: number;
      rolesCount: number;
      stagesCount: number;
      workflowStagesCount: number;
      ticketsCount: number;
      fileSizeKb: number;
    };
    data?: any;
  } {
    try {
      if (!jsonStr || typeof jsonStr !== 'string' || !jsonStr.trim()) {
        return { isValid: false, error: 'الملف المختار فارغ أو تالف' };
      }
      const parsed = JSON.parse(jsonStr);
      if (typeof parsed !== 'object' || parsed === null) {
        return { isValid: false, error: 'تنسيق ملف JSON غير صالح' };
      }

      // Unpack wrapped structures (e.g. { data: { ... } }, { backup: { ... } }, { central_state: { ... } })
      let root = parsed;
      if (root.data && typeof root.data === 'object' && (root.data.expenses || root.data.projects || root.data.المصروفات || root.data.المشاريع)) {
        root = root.data;
      } else if (root.backup && typeof root.backup === 'object') {
        root = root.backup;
      } else if (root.state && typeof root.state === 'object') {
        root = root.state;
      } else if (root.central_state && typeof root.central_state === 'object') {
        root = root.central_state;
      }

      // Normalize Arabic keys
      const projects = root.projects || root.المشاريع || root.مشاريع || [];
      const expenses = root.expenses || root.المصروفات || root.مصروفات || root.السندات || root.سندات || [];
      const custodies = root.custodies || root.العهد || root.عهد || root.العهد_المسلمة || root.عهد_المشرفين || [];
      const users = root.users || root.المستخدمين || root.مستخدمين || root.المستخدمون || [];
      const roles = root.roles || root.الأدوار || root.الأدوار_والصلاحيات || root.ادوار || [];
      const workflowStages = root.workflowStages || root.مراحل_الاعتماد || root.المراحل || [];
      const settings = root.settings || root.الإعدادات || root.اعدادات || undefined;
      const tickets = root.tickets || root.التذاكر || root.تذاكر || [];
      const notifications = root.notifications || root.الإشعارات || root.اشعارات || [];
      const archivedExpenses = root.archivedExpenses || root.الأرشيف || root.المصروفات_المؤرشفة || [];
      const deletedExpenseIds = root.deletedExpenseIds || {};

      const normalized = {
        app: root.app || 'SkyArc Expenses & Custody System',
        version: root.version || '10.0',
        exportedAt: root.exportedAt || new Date().toISOString(),
        exportedBy: root.exportedBy || 'نسخة احتياطية',
        projects: Array.isArray(projects) ? projects : [],
        expenses: Array.isArray(expenses) ? expenses : [],
        custodies: Array.isArray(custodies) ? custodies : [],
        users: Array.isArray(users) ? users : [],
        roles: Array.isArray(roles) ? roles : [],
        workflowStages: Array.isArray(workflowStages) ? workflowStages : [],
        settings: (settings && typeof settings === 'object') ? settings : undefined,
        tickets: Array.isArray(tickets) ? tickets : [],
        notifications: Array.isArray(notifications) ? notifications : [],
        archivedExpenses: Array.isArray(archivedExpenses) ? archivedExpenses : [],
        deletedExpenseIds: (deletedExpenseIds && typeof deletedExpenseIds === 'object') ? deletedExpenseIds : {},
      };

      // Check if it contains recognizable system collections
      const hasCollections =
        normalized.projects.length > 0 ||
        normalized.expenses.length > 0 ||
        normalized.custodies.length > 0 ||
        normalized.users.length > 0 ||
        Boolean(normalized.settings);

      if (!hasCollections) {
        return {
          isValid: false,
          error: 'الملف المختار ليس نسخة احتياطية متوافقة أو لا يحتوي على أي سجلات مشاريع أو مصروفات أو عهد.'
        };
      }

      const fileSizeKb = Math.round((new Blob([jsonStr]).size / 1024) * 10) / 10;

      return {
        isValid: true,
        stats: {
          exportedAt: normalized.exportedAt,
          version: normalized.version || '10.0',
          exportedBy: normalized.exportedBy,
          projectsCount: normalized.projects.length,
          expensesCount: normalized.expenses.length,
          custodiesCount: normalized.custodies.length,
          usersCount: normalized.users.length,
          rolesCount: normalized.roles.length,
          stagesCount: normalized.workflowStages.length,
          workflowStagesCount: normalized.workflowStages.length,
          ticketsCount: normalized.tickets.length,
          fileSizeKb,
        },
        data: normalized
      };
    } catch (e: any) {
      return { isValid: false, error: e?.message || 'تعذر تحليل وقراءة ملف JSON' };
    }
  },

  // Validate and parse an Excel workbook (.xlsx or .xls) as a full system backup
  validateBackupExcel(buffer: ArrayBuffer): {
    isValid: boolean;
    error?: string;
    stats?: {
      exportedAt?: string;
      version?: string;
      exportedBy?: string;
      projectsCount: number;
      expensesCount: number;
      custodiesCount: number;
      usersCount: number;
      rolesCount: number;
      stagesCount: number;
      workflowStagesCount: number;
      ticketsCount: number;
      fileSizeKb: number;
    };
    data?: any;
  } {
    try {
      if (!buffer || buffer.byteLength === 0) {
        return { isValid: false, error: 'الملف المختار فارغ' };
      }

      const wb = XLSX.read(buffer, { type: 'array' });
      if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
        return { isValid: false, error: 'تعذر قراءة أوراق العمل من ملف إكسيل' };
      }

      const findSheet = (patterns: string[]) => {
        const name = wb.SheetNames.find(sName => {
          const lower = sName.trim().toLowerCase();
          return patterns.some(p => lower.includes(p.toLowerCase()));
        });
        return name ? wb.Sheets[name] : null;
      };

      const nowIso = new Date().toISOString();

      const parseDate = (val: any): string => {
        if (!val) return nowIso.split('T')[0];
        if (typeof val === 'number') {
          try {
            const date = new Date((val - (25567 + 2)) * 86400 * 1000);
            if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
          } catch {}
        }
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed.match(/^\d{4}-\d{2}-\d{2}/)) return trimmed.slice(0, 10);
          const d = new Date(trimmed);
          if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        }
        return nowIso.split('T')[0];
      };

      // 1. Projects Sheet
      const wsPrj = findSheet(['المشاريع', 'مشاريع', 'project', 'projects']);
      let parsedProjects: Project[] = [];
      if (wsPrj) {
        const rows = XLSX.utils.sheet_to_json<any>(wsPrj);
        parsedProjects = rows.map((r, idx) => {
          const code = String(r['كود المشروع'] || r['كود'] || r['code'] || r['id'] || `PRJ-${idx + 1}`).trim();
          const id = String(r['كود المشروع'] || r['id'] || `project-${idx + 1}`).trim();
          const name = String(r['اسم المشروع'] || r['المشروع'] || r['name'] || `مشروع ${idx + 1}`).trim();
          const budget = Number(r['الميزانية المرصودة (ر.س)'] || r['الميزانية المرصودة'] || r['الميزانية'] || r['budget'] || 0);
          const clientName = r['العميل / المالك'] || r['العميل'] || r['المالك'] || r['clientName'] || '';
          const location = r['الموقع'] || r['مكان المشروع'] || r['location'] || '';
          const emails = r['المشرفين'] || r['مشرفين'] || r['emails'] || '';
          const status = r['الحالة'] || r['status'] || 'قيد التنفيذ';

          return {
            id,
            code,
            name,
            budget,
            clientName,
            location,
            emails,
            status: status === 'مكتمل' ? 'مكتمل' : 'جاري',
            createdAt: parseDate(r['تاريخ الإنشاء'] || r['التاريخ'] || nowIso),
            assignedEmails: typeof emails === 'string' ? emails.split(',').map((e: string) => e.trim()).filter(Boolean) : [],
            assignedUserIds: [],
          } as Project;
        }).filter(p => p.name);
      }

      // Map existing project names and codes for expense linking
      const projectMapByName = new Map<string, string>();
      const existingProjects = this.getProjects();
      existingProjects.forEach(p => {
        projectMapByName.set(p.name.trim().toLowerCase(), p.id);
        projectMapByName.set((p.code || '').trim().toLowerCase(), p.id);
      });
      parsedProjects.forEach(p => {
        projectMapByName.set(p.name.trim().toLowerCase(), p.id);
        projectMapByName.set(p.code.trim().toLowerCase(), p.id);
      });

      // 2. Expenses Sheet
      const wsExp = findSheet(['المصروفات', 'مصروفات', 'السندات', 'سندات', 'expense', 'expenses']);
      let parsedExpenses: Expense[] = [];

      if (wsExp) {
        const rows = XLSX.utils.sheet_to_json<any>(wsExp);
        parsedExpenses = rows.map((r, idx) => {
          const id = String(r['رقم السند'] || r['كود السند'] || r['id'] || r['ID'] || `EXP-${Date.now().toString().slice(-6)}-${idx + 1}`).trim();
          const prjName = String(r['المشروع'] || r['اسم المشروع'] || r['project'] || r['projectName'] || '').trim();
          let projectId = projectMapByName.get(prjName.toLowerCase()) || (parsedProjects[0]?.id || 'project-1');

          // If project didn't exist in project list, dynamically synthesize it
          if (prjName && !parsedProjects.some(p => p.name.trim().toLowerCase() === prjName.toLowerCase())) {
            const newPrjId = `prj_auto_${Date.now()}_${idx + 1}`;
            const newPrj: Project = {
              id: newPrjId,
              code: `PRJ-${parsedProjects.length + 1}`,
              name: prjName,
              budget: 100000,
              status: 'جاري',
              emails: '',
              createdAt: nowIso,
              assignedEmails: [],
              assignedUserIds: []
            };
            parsedProjects.push(newPrj);
            projectMapByName.set(prjName.toLowerCase(), newPrjId);
            projectId = newPrjId;
          }

          const rawAmount = r['المبلغ (ر.س)'] ?? r['المبلغ'] ?? r['amount'] ?? 0;
          const cleanAmount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(/[^0-9.-]/g, '')) || 0;
          const rawTax = r['الضريبة (ر.س)'] ?? r['الضريبة'] ?? r['taxAmount'] ?? 0;
          const cleanTax = typeof rawTax === 'number' ? rawTax : parseFloat(String(rawTax).replace(/[^0-9.-]/g, '')) || 0;

          const expDate = parseDate(r['التاريخ'] || r['تاريخ'] || r['date']);
          const supName = String(r['المشرف'] || r['اسم المشرف'] || r['supervisor'] || r['supervisorName'] || 'مشرف المشروع').trim();
          const supEmail = String(r['بريد المشرف'] || r['البريد'] || r['supervisorEmail'] || `${supName.replace(/\s+/g, '_')}@company.com`).trim();
          const cat = String(r['البند'] || r['التصنيف'] || r['الفئة'] || r['category'] || 'أخرى').trim() as any;
          const details = String(r['التفاصيل والبيان'] || r['البيان'] || r['التفاصيل'] || r['details'] || '-').trim();
          const invoiceNum = r['رقم الفاتورة'] || r['الفاتورة'] || r['invoiceNumber'] || undefined;
          const status = (r['حالة الاعتماد النهائية'] || r['الحالة'] || r['status'] || 'معتمد') as any;

          return {
            id,
            date: expDate,
            fingerprintTime: new Date(expDate).toISOString(),
            projectId,
            projectName: prjName || 'مشروع عام',
            supervisorName: supName,
            supervisorEmail: supEmail,
            category: cat,
            details,
            amount: cleanAmount,
            taxAmount: cleanTax,
            invoiceNumber: invoiceNum ? String(invoiceNum).trim() : undefined,
            status: status || 'معتمد',
            projectManagerApproval: r['اعتماد مدير المشروع'] || 'تم اعتماد المشرف',
            projectManagerNotes: r['ملاحظات مدير المشروع'] || undefined,
            accountantApproval: r['اعتماد المحاسب'] || 'تم الاعتماد',
            accountantNotes: r['ملاحظات المحاسب'] || undefined,
            managementApproval: r['اعتماد الإدارة'] || 'تم اعتماد الادارة',
            managementNotes: r['ملاحظات الإدارة'] || undefined,
            erpPostingStatus: r['حالة الترحيل المحاسبي'] || 'غير مرحل',
            erpSystemName: r['برنامج المحاسبة الخارجي'] || undefined,
            erpReferenceNumber: r['رقم القيد الخارجي'] || undefined,
            synced: true,
            updatedAt: nowIso
          } as Expense;
        }).filter(e => e.amount > 0 || e.details);
      }

      // 3. Custodies Sheet
      const wsCust = findSheet(['العهد المسلمة', 'العهد', 'عهد', 'custody', 'custodies']);
      let parsedCustodies: CustodyRecord[] = [];
      if (wsCust) {
        const rows = XLSX.utils.sheet_to_json<any>(wsCust);
        parsedCustodies = rows.map((r, idx) => {
          const id = String(r['رقم إيصال العهدة'] || r['رقم السند'] || r['id'] || `CUST-${Date.now().toString().slice(-5)}-${idx + 1}`).trim();
          const rawAmount = r['المبلغ المسلم (ر.س)'] ?? r['المبلغ المسلم'] ?? r['المبلغ'] ?? r['amount'] ?? 0;
          const cleanAmount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(/[^0-9.-]/g, '')) || 0;
          const supName = String(r['اسم المشرف المستلم'] || r['المشرف'] || r['supervisorName'] || 'مشرف').trim();
          const supEmail = String(r['البريد الإلكتروني'] || r['البريد'] || r['supervisorEmail'] || '').trim();

          return {
            id,
            date: parseDate(r['التاريخ'] || r['تاريخ'] || r['date']),
            supervisorName: supName,
            supervisorEmail: supEmail,
            amount: cleanAmount,
            paymentMethod: r['طريقة الدفع'] || r['paymentMethod'] || 'تحويل بنكي',
            receiptNumber: r['رقم الحوالة / السند'] || r['رقم الحوالة'] || r['receiptNumber'] || undefined,
            notes: r['ملاحظات'] || r['notes'] || undefined,
            issuedBy: r['المسلم بواسطة'] || r['issuedBy'] || 'الإدارة المالية',
            synced: true,
          } as CustodyRecord;
        }).filter(c => c.amount > 0);
      }

      // 4. Users Sheet
      const wsUsers = findSheet(['المستخدمين', 'مستخدمين', 'المستخدمون', 'user', 'users']);
      let parsedUsers: User[] = [];
      if (wsUsers) {
        const rows = XLSX.utils.sheet_to_json<any>(wsUsers);
        parsedUsers = rows.map((r, idx) => {
          const username = String(r['اسم الدخول'] || r['اسم المستخدم'] || r['username'] || `user_${idx + 1}`).trim();
          const name = String(r['الاسم الكامل'] || r['الاسم'] || r['name'] || username).trim();
          const role = String(r['الدور الوظيفي'] || r['الدور'] || r['role'] || 'مشرف').trim();
          const email = String(r['البريد الإلكتروني'] || r['البريد'] || r['email'] || `${username}@company.com`).trim();
          const phone = r['رقم الجوال'] || r['الجوال'] || r['phone'] || undefined;
          const isActive = r['الحالة'] ? (String(r['الحالة']).includes('نشط') || r['الحالة'] === true) : true;

          return {
            id: `usr_${username}`,
            username,
            name,
            role,
            email,
            phone: phone ? String(phone) : undefined,
            isActive
          } as unknown as User;
        });
      }

      // 5. Roles Sheet
      const wsRoles = findSheet(['الأدوار والصلاحيات', 'الأدوار', 'ادوار', 'roles', 'role']);
      let parsedRoles: CustomRole[] = [];
      if (wsRoles) {
        const rows = XLSX.utils.sheet_to_json<any>(wsRoles);
        parsedRoles = rows.map((r, idx) => {
          const id = String(r['معرف الدور'] || r['id'] || `role_${idx + 1}`).trim();
          const name = String(r['اسم الدور'] || r['name'] || `دور ${idx + 1}`).trim();
          const desc = String(r['الوصف'] || r['description'] || '').trim();
          return {
            id,
            name,
            isSystem: String(r['النوع']).includes('نظامي'),
            description: desc,
            permissions: {
              canAddExpense: true,
              canEditExpense: true,
              canDeleteExpense: true,
              canApproveSupervisor: true,
              canApproveAccountant: true,
              canApproveManagement: true,
              canManageCustody: true,
              canManageProjects: true,
              canManageUsers: true,
              canViewReports: true,
              canViewAllProjects: true,
              canAccessErpIntegration: true,
              canModifyWorkflow: true,
            }
          } as unknown as CustomRole;
        });
      }

      const hasContent = parsedExpenses.length > 0 || parsedProjects.length > 0 || parsedCustodies.length > 0 || parsedUsers.length > 0;
      if (!hasContent) {
        return {
          isValid: false,
          error: 'لم يتم العثور على أي بيانات مصروفات أو مشاريع أو عهد أو مستخدمين صالحة داخل أوراق عمل ملف إكسيل.'
        };
      }

      const backupObject = {
        app: 'SkyArc Expenses & Custody System',
        version: '10.0 (مصنف إكسل)',
        exportedAt: nowIso,
        exportedBy: 'استيراد مصنف إكسل',
        projects: parsedProjects,
        expenses: parsedExpenses,
        custodies: parsedCustodies,
        users: parsedUsers,
        roles: parsedRoles,
        workflowStages: [],
        deletedExpenseIds: {},
      };

      const fileSizeKb = Math.round((buffer.byteLength / 1024) * 10) / 10;

      return {
        isValid: true,
        stats: {
          exportedAt: nowIso,
          version: '10.0 (مصنف إكسل)',
          exportedBy: 'مصنف إكسل شامل',
          projectsCount: parsedProjects.length,
          expensesCount: parsedExpenses.length,
          custodiesCount: parsedCustodies.length,
          usersCount: parsedUsers.length,
          rolesCount: parsedRoles.length,
          stagesCount: 0,
          workflowStagesCount: 0,
          ticketsCount: 0,
          fileSizeKb,
        },
        data: backupObject
      };
    } catch (err: any) {
      console.error('Error validating Excel backup:', err);
      return { isValid: false, error: err?.message || 'فشل قراءة وتفسير ملف إكسيل' };
    }
  },

  // Import parsed backup data with full replace or smart merge
  importBackupData(parsed: any, mode: 'replace' | 'merge' = 'replace'): boolean {
    try {
      if (!parsed || typeof parsed !== 'object') return false;

      // 1. Unwrap if nested inside wrapper
      let root = parsed;
      if (root.data && typeof root.data === 'object' && (root.data.expenses || root.data.projects || root.data.المصروفات || root.data.المشاريع)) {
        root = root.data;
      } else if (root.backup && typeof root.backup === 'object') {
        root = root.backup;
      } else if (root.state && typeof root.state === 'object') {
        root = root.state;
      } else if (root.central_state && typeof root.central_state === 'object') {
        root = root.central_state;
      }

      // Map Arabic keys if any
      const incomingProjects = (root.projects || root.المشاريع || root.مشاريع || root.Projects || root.projectList || []) as Project[];
      const incomingExpenses = (root.expenses || root.المصروفات || root.مصروفات || root.السندات || root.سندات || root.Expenses || root.expenseList || []) as Expense[];
      const incomingCustodies = (root.custodies || root.العهد || root.عهد || root.العهد_المسلمة || root.عهد_المشرفين || root.Custodies || []) as CustodyRecord[];
      const incomingUsers = (root.users || root.المستخدمين || root.مستخدمين || root.المستخدمون || root.Users || []) as User[];
      const incomingRoles = (root.roles || root.الأدوار || root.الأدوار_والصلاحيات || root.ادوار || root.Roles || []) as CustomRole[];
      const incomingStages = (root.workflowStages || root.مراحل_الاعتماد || root.المراحل || root.WorkflowStages || []) as WorkflowStage[];
      const incomingSettings = root.settings || root.الإعدادات || root.اعدادات || root.Settings || undefined;
      const incomingTickets = (root.tickets || root.التذاكر || root.تذاكر || root.Tickets || []) as any[];
      const incomingNotifications = (root.notifications || root.الإشعارات || root.اشعارات || root.Notifications || []) as any[];
      const incomingArchived = (root.archivedExpenses || root.الأرشيف || root.المصروفات_المؤرشفة || root.ArchivedExpenses || []) as ArchivedExpense[];
      const incomingDeleted = (root.deletedExpenseIds && typeof root.deletedExpenseIds === 'object') ? root.deletedExpenseIds : {};
      const incomingDeletedCustodies = (root.deletedCustodyIds && typeof root.deletedCustodyIds === 'object') ? root.deletedCustodyIds : {};
      const incomingDeletedProjects = (root.deletedProjectIds && typeof root.deletedProjectIds === 'object') ? root.deletedProjectIds : {};
      const incomingDeletedUsers = (root.deletedUserIds && typeof root.deletedUserIds === 'object') ? root.deletedUserIds : {};
      const incomingDeletedRoles = (root.deletedRoleIds && typeof root.deletedRoleIds === 'object') ? root.deletedRoleIds : {};
      const incomingDeletedStages = (root.deletedWorkflowStageIds && typeof root.deletedWorkflowStageIds === 'object') ? root.deletedWorkflowStageIds : {};

      if (mode === 'replace') {
        // In REPLACE mode, overwrite local tombstones completely with incoming tombstones
        this.saveDeletedExpenseIds(incomingDeleted);
        this.saveDeletedCustodyIds(incomingDeletedCustodies);
        this.saveDeletedProjectIds(incomingDeletedProjects);
        this.saveDeletedUserIds(incomingDeletedUsers);
        this.saveDeletedRoleIds(incomingDeletedRoles);
        this.saveDeletedWorkflowStageIds(incomingDeletedStages);

        // Sanitize and save projects
        if (Array.isArray(incomingProjects)) {
          const cleanProjects = incomingProjects.filter((p: any) => p && p.id && !incomingDeletedProjects[p.id]);
          this.saveProjects(cleanProjects);
        }

        // Sanitize and save expenses (strictly excluding incoming deleted IDs)
        if (Array.isArray(incomingExpenses)) {
          const cleanExpenses = incomingExpenses
            .filter((e: any) => e && e.id && !incomingDeleted[e.id])
            .map((e: any) => this.repairExpenseSupervisor(e, Array.isArray(incomingUsers) ? incomingUsers : undefined));
          this.saveExpenses(cleanExpenses);

          // Batch save attachments to vault
          try {
            const projectGroups = new Map<string, any[]>();
            cleanExpenses.forEach((exp: any) => {
              if (exp.projectId) {
                const group = projectGroups.get(exp.projectId) || [];
                group.push(exp);
                projectGroups.set(exp.projectId, group);
              }
            });
            projectGroups.forEach((groupExpenses, prjId) => {
              AttachmentArchiver.saveBatchProjectAttachments(prjId, groupExpenses);
            });
          } catch (attErr) {
            console.warn('Failed to batch save restored attachments in replace mode:', attErr);
          }
        }

        // Custodies
        if (Array.isArray(incomingCustodies)) {
          const cleanCustodies = incomingCustodies.filter((c: any) => c && c.id && !incomingDeletedCustodies[c.id]);
          this.saveCustodies(cleanCustodies);
        }

        // Users
        if (Array.isArray(incomingUsers)) {
          const cleanUsers = incomingUsers.filter((u: any) => u && u.id && !incomingDeletedUsers[u.id]);
          this.saveUsers(cleanUsers);
        }

        // Roles
        if (Array.isArray(incomingRoles) && incomingRoles.length > 0) {
          const cleanRoles = incomingRoles.filter((r: any) => r && r.id && !incomingDeletedRoles[r.id]);
          this.saveRoles(cleanRoles);
        }

        // Workflow Stages
        if (Array.isArray(incomingStages) && incomingStages.length > 0) {
          const cleanStages = incomingStages.filter((s: any) => s && s.id && !incomingDeletedStages[s.id]);
          this.saveWorkflowStages(cleanStages);
        }

        // Settings
        if (incomingSettings && typeof incomingSettings === 'object') {
          this.saveSettings(incomingSettings);
        }

        // Tickets & Notifications & Archived
        if (Array.isArray(incomingTickets)) {
          this.saveTickets(incomingTickets);
        }
        if (Array.isArray(incomingNotifications)) {
          this.saveNotifications(incomingNotifications);
        }
        if (Array.isArray(incomingArchived)) {
          const cleanArchived = incomingArchived.filter((a: any) => a && a.id && !incomingDeleted[a.id]);
          this.saveArchivedExpenses(cleanArchived);
        }
      } else {
        // Smart Merge Mode (Add missing or update existing by primary key, un-tombstoning active incoming items)
        const curDeletedProjects = { ...this.getDeletedProjectIds() };
        incomingProjects.forEach((p: any) => {
          if (p && p.id && !incomingDeletedProjects[p.id]) delete curDeletedProjects[p.id];
        });
        this.saveDeletedProjectIds({ ...curDeletedProjects, ...incomingDeletedProjects });

        const curDeletedExpenses = { ...this.getDeletedExpenseIds() };
        incomingExpenses.forEach((e: any) => {
          if (e && e.id && !incomingDeleted[e.id]) delete curDeletedExpenses[e.id];
        });
        this.saveDeletedExpenseIds({ ...curDeletedExpenses, ...incomingDeleted });

        const curDeletedCustodies = { ...this.getDeletedCustodyIds() };
        incomingCustodies.forEach((c: any) => {
          if (c && c.id && !incomingDeletedCustodies[c.id]) delete curDeletedCustodies[c.id];
        });
        this.saveDeletedCustodyIds({ ...curDeletedCustodies, ...incomingDeletedCustodies });

        const curDeletedUsers = { ...this.getDeletedUserIds() };
        incomingUsers.forEach((u: any) => {
          if (u && u.id && !incomingDeletedUsers[u.id]) delete curDeletedUsers[u.id];
        });
        this.saveDeletedUserIds({ ...curDeletedUsers, ...incomingDeletedUsers });

        const curDeletedStages = { ...this.getDeletedWorkflowStageIds() };
        incomingStages.forEach((s: any) => {
          if (s && s.id && !incomingDeletedStages[s.id]) delete curDeletedStages[s.id];
        });
        this.saveDeletedWorkflowStageIds({ ...curDeletedStages, ...incomingDeletedStages });

        if (Array.isArray(incomingProjects) && incomingProjects.length > 0) {
          const current = this.getProjects();
          const map = new Map<string, any>(current.map(p => [p.id, p]));
          incomingProjects.forEach((p: any) => {
            if (!p || !p.id || incomingDeletedProjects[p.id]) return;
            const existing = map.get(p.id);
            map.set(p.id, existing ? { ...existing, ...p } : p);
          });
          this.saveProjects(Array.from(map.values()).filter(p => !incomingDeletedProjects[p.id]));
        }

        if (Array.isArray(incomingExpenses) && incomingExpenses.length > 0) {
          const current = this.getExpenses();
          const map = new Map<string, any>(current.map(e => [e.id, e]));
          incomingExpenses.forEach((e: any) => {
            if (!e || !e.id || incomingDeleted[e.id]) return;
            const existing = map.get(e.id);
            if (!existing) {
              map.set(e.id, e);
            } else {
              // Merge attachments arrays without losing items
              const existingAtts = Array.isArray(existing.attachments) ? existing.attachments : [];
              const incomingAtts = Array.isArray(e.attachments) ? e.attachments : [];
              
              let mergedAtts = incomingAtts;
              if (existingAtts.length > 0 && incomingAtts.length === 0) {
                mergedAtts = existingAtts;
              } else if (existingAtts.length > 0 && incomingAtts.length > 0) {
                const attMap = new Map<string, any>();
                existingAtts.forEach((att: any, i: number) => {
                  const key = att.id || att.fileName || `existing_${i}`;
                  attMap.set(key, att);
                });
                incomingAtts.forEach((att: any, i: number) => {
                  const key = att.id || att.fileName || `incoming_${i}`;
                  const prev = attMap.get(key);
                  if (prev && !att.url && prev.url) {
                    attMap.set(key, { ...att, url: prev.url });
                  } else {
                    attMap.set(key, att);
                  }
                });
                mergedAtts = Array.from(attMap.values());
              }

              const mergedInvoicePhoto = e.invoicePhoto || existing.invoicePhoto || '';

              map.set(e.id, {
                ...existing,
                ...e,
                attachments: mergedAtts,
                invoicePhoto: mergedInvoicePhoto,
                updatedAt: new Date().toISOString()
              });
            }
          });
          const finalActive = Array.from(map.values()).filter(e => !incomingDeleted[e.id]);
          this.saveExpenses(finalActive);

          // Save restored attachments to vault
          try {
            const projectGroups = new Map<string, any[]>();
            finalActive.forEach((exp: any) => {
              if (exp.projectId) {
                const group = projectGroups.get(exp.projectId) || [];
                group.push(exp);
                projectGroups.set(exp.projectId, group);
              }
            });
            projectGroups.forEach((groupExpenses, prjId) => {
              AttachmentArchiver.saveBatchProjectAttachments(prjId, groupExpenses);
            });
          } catch (attErr) {
            console.warn('Failed to batch save restored attachments in merge mode:', attErr);
          }
        }

        if (Array.isArray(incomingCustodies) && incomingCustodies.length > 0) {
          const current = this.getCustodies();
          const map = new Map<string, any>(current.map(c => [c.id, c]));
          incomingCustodies.forEach((c: any) => {
            if (!c || !c.id || incomingDeletedCustodies[c.id]) return;
            const existing = map.get(c.id);
            map.set(c.id, existing ? { ...existing, ...c } : c);
          });
          this.saveCustodies(Array.from(map.values()).filter(c => !incomingDeletedCustodies[c.id]));
        }

        if (Array.isArray(incomingUsers) && incomingUsers.length > 0) {
          const current = this.getUsers();
          const map = new Map<string, any>(current.map(u => [u.id, u]));
          incomingUsers.forEach((u: any) => {
            if (!u || !u.id || incomingDeletedUsers[u.id]) return;
            const existing = map.get(u.id);
            map.set(u.id, existing ? { ...existing, ...u } : u);
          });
          this.saveUsers(Array.from(map.values()).filter(u => !incomingDeletedUsers[u.id]));
        }

        if (Array.isArray(incomingRoles) && incomingRoles.length > 0) {
          const current = this.getRoles();
          const map = new Map<string, any>(current.map(r => [r.id, r]));
          incomingRoles.forEach((r: any) => {
            if (!r || !r.id) return;
            const existing = map.get(r.id);
            map.set(r.id, existing ? { ...existing, ...r } : r);
          });
          this.saveRoles(Array.from(map.values()));
        }

        if (incomingSettings && typeof incomingSettings === 'object') {
          const current = this.getSettings();
          this.saveSettings({ ...current, ...incomingSettings });
        }

        if (Array.isArray(incomingStages) && incomingStages.length > 0) {
          const current = this.getWorkflowStages();
          const map = new Map<string, any>(current.map(s => [s.id, s]));
          incomingStages.forEach((s: any) => {
            if (!s || !s.id || incomingDeletedStages[s.id]) return;
            const existing = map.get(s.id);
            map.set(s.id, existing ? { ...existing, ...s } : s);
          });
          this.saveWorkflowStages(Array.from(map.values()).filter(s => !incomingDeletedStages[s.id]));
        }

        if (Array.isArray(incomingArchived) && incomingArchived.length > 0) {
          const current = this.getArchivedExpenses();
          const map = new Map<string, any>(current.map(a => [a.id, a]));
          incomingArchived.forEach((a: any) => {
            if (!a || !a.id || incomingDeleted[a.id]) return;
            map.set(a.id, a);
          });
          this.saveArchivedExpenses(Array.from(map.values()).filter(a => !incomingDeleted[a.id]));
        }
      }

      return true;
    } catch (e) {
      console.error('Failed to import backup data:', e);
      return false;
    }
  },

  // Import JSON backup from string
  importBackupJSON(jsonStr: string, mode: 'replace' | 'merge' = 'replace'): boolean {
    const validation = this.validateBackupJSON(jsonStr);
    if (!validation.isValid || !validation.data) return false;
    return this.importBackupData(validation.data, mode);
  },

  // Local Browser Quick Snapshots
  createQuickSnapshot(): {
    success: boolean;
    timestamp: string;
    stats: {
      projectsCount: number;
      expensesCount: number;
      custodiesCount: number;
      usersCount: number;
    };
  } {
    const backup = this.getFullBackupData();
    const sanitizedBackup = {
      ...backup,
      expenses: (backup.expenses || []).map((e: any) => ({
        ...e,
        invoicePhoto: e.invoicePhoto
      }))
    };
    const snapshot = {
      timestamp: new Date().toISOString(),
      data: sanitizedBackup
    };
    safeSetItem(STORAGE_KEYS.QUICK_SNAPSHOT, JSON.stringify(snapshot));
    return {
      success: true,
      timestamp: snapshot.timestamp,
      stats: {
        projectsCount: backup.projects?.length || 0,
        expensesCount: backup.expenses?.length || 0,
        custodiesCount: backup.custodies?.length || 0,
        usersCount: backup.users?.length || 0,
      }
    };
  },

  getQuickSnapshot(): {
    timestamp: string;
    stats: {
      projectsCount: number;
      expensesCount: number;
      custodiesCount: number;
      usersCount: number;
    };
    data: any;
  } | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.QUICK_SNAPSHOT);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.data) return null;
      return {
        timestamp: parsed.timestamp,
        stats: {
          projectsCount: parsed.data.projects?.length || 0,
          expensesCount: parsed.data.expenses?.length || 0,
          custodiesCount: parsed.data.custodies?.length || 0,
          usersCount: parsed.data.users?.length || 0,
        },
        data: parsed.data
      };
    } catch {
      return null;
    }
  },

  restoreQuickSnapshot(): boolean {
    const snapshot = this.getQuickSnapshot();
    if (!snapshot || !snapshot.data) return false;
    return this.importBackupData(snapshot.data, 'replace');
  },

  // Factory Reset completely cancelled & deleted to protect live business data
  resetToSampleData(): void {
    console.warn('استعادة البيانات النموذجية الأولية (Factory Reset) ملغاة ومحذوفة نهائياً لحماية وتأمين بيانات النظام.');
  },

  // Export to Excel file (.xlsx) with multiple formatted sheets
  exportToExcel(
    projects: Project[],
    expenses: Expense[],
    custodies: CustodyRecord[],
    supervisors: SupervisorSummary[],
    currencySymbol: string = 'ر.س'
  ): void {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Expenses (المصروفات)
    const expensesData = expenses.map(e => ({
      'رقم السند': e.id,
      'التاريخ': e.date,
      'وقت البصمة': new Date(e.fingerprintTime).toLocaleString('ar-SA'),
      'المشروع': e.projectName,
      'المشرف': e.supervisorName,
      'بريد المشرف': e.supervisorEmail,
      'البند': e.category,
      'التفاصيل والبيان': e.details,
      [`المبلغ (${currencySymbol})`]: e.amount,
      [`الضريبة (${currencySymbol})`]: e.taxAmount || 0,
      'رقم الفاتورة': e.invoiceNumber || '-',
      'حالة الاعتماد النهائية': e.status,
      'اعتماد مدير المشروع': e.projectManagerApproval || 'غير معتمد',
      'ملاحظات مدير المشروع': e.projectManagerNotes || '-',
      'اعتماد المحاسب': e.accountantApproval,
      'ملاحظات المحاسب': e.accountantNotes || '-',
      'حالة الترحيل المحاسبي': e.erpPostingStatus || 'غير مرحل',
      'برنامج المحاسبة الخارجي': e.erpSystemName || '-',
      'رقم القيد الخارجي': e.erpReferenceNumber || '-',
      'اعتماد الإدارة': e.managementApproval,
      'ملاحظات الإدارة': e.managementNotes || '-',
      'إحداثيات الموقع GPS': e.gpsLocation ? `${e.gpsLocation.lat.toFixed(5)}, ${e.gpsLocation.lng.toFixed(5)}` : '-',
      'حالة المزامنة': e.synced ? 'متزامن سحابياً' : 'محلي (معلق)',
    }));
    const wsExpenses = XLSX.utils.json_to_sheet(expensesData);
    XLSX.utils.book_append_sheet(wb, wsExpenses, 'المصروفات');

    // Sheet 2: Custodies (العهد المسلمة)
    const custodiesData = custodies.map(c => ({
      'رقم إيصال العهدة': c.id,
      'التاريخ': c.date,
      'اسم المشرف المستلم': c.supervisorName,
      'البريد الإلكتروني': c.supervisorEmail,
      [`المبلغ المسلم (${currencySymbol})`]: c.amount,
      'طريقة الدفع': c.paymentMethod,
      'رقم الحوالة / السند': c.receiptNumber || '-',
      'ملاحظات': c.notes || '-',
      'المسلم بواسطة': c.issuedBy || 'الإدارة',
    }));
    const wsCustodies = XLSX.utils.json_to_sheet(custodiesData);
    XLSX.utils.book_append_sheet(wb, wsCustodies, 'العهد المسلمة');

    // Sheet 3: Supervisor Balances (أرصدة المشرفين)
    const supData = supervisors.map(s => ({
      'الاسم': s.name,
      'البريد الإلكتروني': s.email,
      'رقم الجوال': s.phone,
      [`إجمالي العهد المسلمة (${currencySymbol})`]: s.totalCustody,
      [`المصروفات المعتمدة (${currencySymbol})`]: s.totalApprovedExpenses,
      [`المصروفات قيد المراجعة (${currencySymbol})`]: s.totalPendingExpenses,
      [`الرصيد المتبقي حالياً (${currencySymbol})`]: s.remainingBalance,
      'حالة العهدة': s.status,
    }));
    const wsSup = XLSX.utils.json_to_sheet(supData);
    XLSX.utils.book_append_sheet(wb, wsSup, 'أرصدة المشرفين والعهد');

    // Sheet 4: Projects (المشاريع)
    const prjData = projects.map(p => {
      const prjExpenses = expenses.filter(e => e.projectId === p.id && e.status === 'معتمد');
      const spent = prjExpenses.reduce((acc, curr) => acc + curr.amount, 0);
      return {
        'كود المشروع': p.code,
        'اسم المشروع': p.name,
        'الحالة': p.status,
        'العميل / المالك': p.clientName || '-',
        'الموقع': p.location || '-',
        [`الميزانية المرصودة (${currencySymbol})`]: p.budget,
        [`إجمالي المنصرف المعتمد (${currencySymbol})`]: spent,
        [`المتبقي من الميزانية (${currencySymbol})`]: p.budget - spent,
        'نسبة الاستهلاك': `${Math.round((spent / (p.budget || 1)) * 100)}%`,
        'المشرفين': p.emails,
      };
    });
    const wsPrj = XLSX.utils.json_to_sheet(prjData);
    XLSX.utils.book_append_sheet(wb, wsPrj, 'المشاريع');

    // Sheet 5: Users (المستخدمين)
    const allUsers = this.getUsers();
    const usersData = allUsers.map(u => ({
      'اسم الدخول': u.username,
      'الاسم الكامل': u.name,
      'الدور الوظيفي': u.role,
      'البريد الإلكتروني': u.email,
      'رقم الجوال': u.phone || '-',
      'الحالة': (u as any).isActive !== false ? 'نشط' : 'معطل',
    }));
    const wsUsers = XLSX.utils.json_to_sheet(usersData);
    XLSX.utils.book_append_sheet(wb, wsUsers, 'المستخدمين');

    // Sheet 6: Roles (الأدوار والصلاحيات)
    const allRoles = this.getRoles();
    const rolesData = allRoles.map(r => ({
      'معرف الدور': r.id,
      'اسم الدور': r.name,
      'النوع': r.isSystem ? 'دور نظامي' : 'مخصص',
      'الوصف': r.description,
      'مهلة التعديل (دقائق)': r.gracePeriodMinutes ?? '-',
    }));
    const wsRoles = XLSX.utils.json_to_sheet(rolesData);
    XLSX.utils.book_append_sheet(wb, wsRoles, 'الأدوار والصلاحيات');

    // Sheet 7: Backup Info (معلومات التصدير الشامل)
    const infoData = [
      { 'البيان': 'تاريخ ووقت التصدير', 'القيمة': new Date().toLocaleString('ar-SA') },
      { 'البيان': 'إجمالي المشاريع', 'القيمة': projects.length },
      { 'البيان': 'إجمالي المصروفات', 'القيمة': expenses.length },
      { 'البيان': 'إجمالي العهد المسلمة', 'القيمة': custodies.length },
      { 'البيان': 'إجمالي المستخدمين', 'القيمة': allUsers.length },
      { 'البيان': 'العملة المعتمدة', 'القيمة': currencySymbol },
      { 'البيان': 'النظام والإصدار', 'القيمة': 'SkyArc System v10.0' }
    ];
    const wsInfo = XLSX.utils.json_to_sheet(infoData);
    XLSX.utils.book_append_sheet(wb, wsInfo, 'معلومات التصدير');

    // Generate and download
    const fileName = `تصدير_قاعدة_البيانات_الشاملة_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  },

  // Export Archived Expenses to Excel
  exportArchivedExpensesToExcel(
    archivedExpenses: ArchivedExpense[],
    currencySymbol: string = 'ر.س'
  ): void {
    const wb = XLSX.utils.book_new();

    const data = archivedExpenses.map(e => ({
      'رقم السند': e.id,
      'السنة المالية': e.fiscalYear || (e.date ? new Date(e.date).getFullYear() : '-'),
      'التاريخ': e.date,
      'تاريخ الأرشفة': e.archivedAt ? new Date(e.archivedAt).toLocaleString('ar-SA') : '-',
      'أرشف بواسطة': e.archivedBy || '-',
      'سبب الأرشفة': e.archivedReason || '-',
      'المشروع': e.projectName,
      'المشرف': e.supervisorName,
      'البند': e.category,
      'التفاصيل والبيان': e.details,
      [`المبلغ (${currencySymbol})`]: e.amount,
      [`الضريبة (${currencySymbol})`]: e.taxAmount || 0,
      'رقم الفاتورة': e.invoiceNumber || '-',
      'حالة الاعتماد': e.status,
      'حالة الترحيل المحاسبي': e.erpPostingStatus || 'غير مرحل',
      'رقم القيد المحاسبي': e.erpReferenceNumber || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'أرشيف المصروفات المنتهية');

    const fileName = `أرشيف_المصروفات_السنوات_السابقة_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  },

  // Export to CSV
  exportToCSV(data: any[], filename: string): void {
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  },

  // Get full snapshot of local state
  getFullState(): Record<string, any> {
    return {
      projects: this.getProjects(),
      expenses: this.getExpenses(),
      custodies: this.getCustodies(),
      users: this.getUsers(),
      settings: this.getSettings(),
      tickets: this.getTickets(),
      roles: this.getRoles(),
      archivedExpenses: this.getArchivedExpenses()
    };
  },

  // Generate comprehensive Excel workbook blob for browser-based upload & download
  generateComprehensiveExcelBlob(stateInput?: any): Blob {
    const wb = XLSX.utils.book_new();
    const state = stateInput || this.getFullState();
    const currencySymbol = state?.settings?.currencySymbol || this.getSettings()?.currencySymbol || 'ر.س';

    const projects: Project[] = Array.isArray(state?.projects) ? state.projects : this.getProjects();
    const expenses: Expense[] = Array.isArray(state?.expenses) ? state.expenses : this.getExpenses();
    const custodies: CustodyRecord[] = Array.isArray(state?.custodies) ? state.custodies : this.getCustodies();
    const allUsers: User[] = Array.isArray(state?.users) ? state.users : this.getUsers();
    const allRoles = Array.isArray(state?.roles) ? state.roles : this.getRoles();

    // 1. Sheet: Expenses (المصروفات)
    const expensesData = expenses.map(e => ({
      'رقم السند': e.id,
      'التاريخ': e.date,
      'وقت البصمة': e.fingerprintTime ? new Date(e.fingerprintTime).toLocaleString('ar-SA') : '-',
      'المشروع': e.projectName,
      'المشرف': e.supervisorName,
      'بريد المشرف': e.supervisorEmail,
      'البند': e.category,
      'التفاصيل والبيان': e.details,
      [`المبلغ (${currencySymbol})`]: e.amount,
      [`الضريبة (${currencySymbol})`]: e.taxAmount || 0,
      'رقم الفاتورة': e.invoiceNumber || '-',
      'حالة الاعتماد النهائية': e.status,
      'اعتماد مدير المشروع': e.projectManagerApproval || 'غير معتمد',
      'ملاحظات مدير المشروع': e.projectManagerNotes || '-',
      'اعتماد المحاسب': e.accountantApproval,
      'ملاحظات المحاسب': e.accountantNotes || '-',
      'حالة الترحيل المحاسبي': e.erpPostingStatus || 'غير مرحل',
      'برنامج المحاسبة الخارجي': e.erpSystemName || '-',
      'رقم القيد الخارجي': e.erpReferenceNumber || '-',
      'اعتماد الإدارة': e.managementApproval,
      'ملاحظات الإدارة': e.managementNotes || '-',
      'إحداثيات الموقع GPS': e.gpsLocation ? `${e.gpsLocation.lat.toFixed(5)}, ${e.gpsLocation.lng.toFixed(5)}` : '-',
      'حالة المزامنة': e.synced ? 'متزامن سحابياً' : 'محلي (معلق)',
    }));
    const wsExpenses = XLSX.utils.json_to_sheet(expensesData.length > 0 ? expensesData : [{ 'تنبيه': 'لا توجد مصروفات مسجلة حتى الآن' }]);
    XLSX.utils.book_append_sheet(wb, wsExpenses, 'المصروفات');

    // 2. Sheet: Custodies (العهد المسلمة)
    const custodiesData = custodies.map(c => ({
      'رقم إيصال العهدة': c.id,
      'التاريخ': c.date,
      'اسم المشرف المستلم': c.supervisorName,
      'البريد الإلكتروني': c.supervisorEmail,
      [`المبلغ المسلم (${currencySymbol})`]: c.amount,
      'طريقة الدفع': c.paymentMethod,
      'رقم الحوالة / السند': c.receiptNumber || '-',
      'ملاحظات': c.notes || '-',
      'المسلم بواسطة': c.issuedBy || 'الإدارة',
    }));
    const wsCustodies = XLSX.utils.json_to_sheet(custodiesData.length > 0 ? custodiesData : [{ 'تنبيه': 'لا توجد عهد مسجلة' }]);
    XLSX.utils.book_append_sheet(wb, wsCustodies, 'العهد المسلمة');

    // 3. Sheet: Supervisor Balances (أرصدة المشرفين والعهد)
    const supervisors = allUsers.filter(u => u.role === 'مشرف' || (u as any).roleId === 'role_supervisor' || u.role === 'مدير مشروع');
    const supData = supervisors.map(s => {
      const sCustody = custodies.filter(c => c.supervisorEmail === s.email).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
      const sApproved = expenses.filter(e => e.supervisorEmail === s.email && e.status === 'معتمد').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const sPending = expenses.filter(e => e.supervisorEmail === s.email && e.status !== 'معتمد' && e.status !== 'مرفوض').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      return {
        'الاسم': s.name,
        'البريد الإلكتروني': s.email,
        'رقم الجوال': s.phone || '-',
        [`إجمالي العهد المسلمة (${currencySymbol})`]: sCustody,
        [`المصروفات المعتمدة (${currencySymbol})`]: sApproved,
        [`المصروفات قيد المراجعة (${currencySymbol})`]: sPending,
        [`الرصيد المتبقي حالياً (${currencySymbol})`]: sCustody - (sApproved + sPending),
        'حالة العهدة': (sCustody - (sApproved + sPending)) < 0 ? 'عجز في العهدة' : 'متزن'
      };
    });
    const wsSup = XLSX.utils.json_to_sheet(supData.length > 0 ? supData : [{ 'تنبيه': 'لا يوجد مشرفين مسجلين' }]);
    XLSX.utils.book_append_sheet(wb, wsSup, 'أرصدة المشرفين والعهد');

    // 4. Sheet: Projects (المشاريع)
    const prjData = projects.map(p => {
      const prjExpenses = expenses.filter(e => e.projectId === p.id && e.status === 'معتمد');
      const spent = prjExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      return {
        'كود المشروع': p.code || '-',
        'اسم المشروع': p.name,
        'الحالة': p.status,
        'العميل / المالك': p.clientName || '-',
        'الموقع': p.location || '-',
        [`الميزانية المرصودة (${currencySymbol})`]: p.budget || 0,
        [`إجمالي المنصرف المعتمد (${currencySymbol})`]: spent,
        [`المتبقي من الميزانية (${currencySymbol})`]: (p.budget || 0) - spent,
        'نسبة الاستهلاك': `${Math.round((spent / (p.budget || 1)) * 100)}%`,
        'المشرفين': p.emails,
      };
    });
    const wsPrj = XLSX.utils.json_to_sheet(prjData.length > 0 ? prjData : [{ 'تنبيه': 'لا توجد مشاريع مسجلة' }]);
    XLSX.utils.book_append_sheet(wb, wsPrj, 'المشاريع');

    // 5. Sheet: Users (المستخدمين)
    const usersData = allUsers.map(u => ({
      'اسم الدخول': u.username || '-',
      'الاسم الكامل': u.name,
      'الدور الوظيفي': u.role,
      'البريد الإلكتروني': u.email,
      'رقم الجوال': u.phone || '-',
      'الحالة': (u as any).isActive !== false ? 'نشط' : 'معطل',
    }));
    const wsUsers = XLSX.utils.json_to_sheet(usersData.length > 0 ? usersData : [{ 'تنبيه': 'لا يوجد مستخدمين' }]);
    XLSX.utils.book_append_sheet(wb, wsUsers, 'المستخدمين');

    // 6. Sheet: Roles (الأدوار والصلاحيات)
    const rolesData = allRoles.map((r: any) => ({
      'معرف الدور': r.id,
      'اسم الدور': r.name,
      'النوع': r.isSystem ? 'دور نظامي' : 'مخصص',
      'الوصف': r.description || '-',
      'مهلة التعديل (دقائق)': r.gracePeriodMinutes ?? '-',
    }));
    const wsRoles = XLSX.utils.json_to_sheet(rolesData.length > 0 ? rolesData : [{ 'تنبيه': 'لا توجد أدوار إضافية' }]);
    XLSX.utils.book_append_sheet(wb, wsRoles, 'الأدوار والصلاحيات');

    // 7. Sheet: Backup Info (معلومات التصدير والنسخة الاحتياطية)
    const totalExpensesAmount = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalCustodiesAmount = custodies.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const infoData = [
      { 'البيان': 'نوع الملف', 'القيمة': 'حزمة مصنف إكسل الشامل (.xlsx) - النسخة الاحتياطية المعتمدة' },
      { 'البيان': 'تاريخ ووقت التصدير', 'القيمة': new Date().toLocaleString('ar-SA') },
      { 'البيان': 'إجمالي المشاريع', 'القيمة': projects.length },
      { 'البيان': 'إجمالي المصروفات', 'القيمة': expenses.length },
      { 'البيان': `إجمالي قيمة المصروفات (${currencySymbol})`, 'القيمة': totalExpensesAmount },
      { 'البيان': 'إجمالي العهد المسلمة', 'القيمة': custodies.length },
      { 'البيان': `إجمالي قيمة العهد المسلمة (${currencySymbol})`, 'القيمة': totalCustodiesAmount },
      { 'البيان': 'إجمالي المستخدمين', 'القيمة': allUsers.length },
      { 'البيان': 'العملة المعتمدة', 'القيمة': currencySymbol },
      { 'البيان': 'النظام والإصدار', 'القيمة': 'SkyArc Financial & Custody System v10.0' }
    ];
    const wsInfo = XLSX.utils.json_to_sheet(infoData);
    XLSX.utils.book_append_sheet(wb, wsInfo, 'معلومات التصدير');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  },

  // Download comprehensive Excel directly in browser
  downloadComprehensiveExcel(stateInput?: any, customFileName?: string): void {
    const blob = this.generateComprehensiveExcelBlob(stateInput);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = customFileName || `حزمة_مصنف_إكسل_الشامل_${dateStr}.xlsx`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  load(): Record<string, any> {
    return this.getFullState();
  }
};
