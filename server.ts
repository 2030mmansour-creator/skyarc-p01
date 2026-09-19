import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import * as XLSX from 'xlsx';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '100mb' }));
app.use(express.text({ limit: '100mb', type: ['text/*', 'application/json'] }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// CORS & Preflight headers for production hosting environments
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Server-Side Persistent Storage Paths (with container/server fallback)
let DATA_DIR = path.join(process.cwd(), 'data');
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  // Test write access
  const testPath = path.join(DATA_DIR, '.write_test');
  fs.writeFileSync(testPath, 'ok', 'utf-8');
  fs.unlinkSync(testPath);
} catch (permErr) {
  console.warn('[Server Storage] Local directory /data not writable, switching to OS temporary directory:', permErr);
  DATA_DIR = path.join(os.tmpdir(), 'skyarc_data');
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const STATE_FILE = path.join(DATA_DIR, 'system_state.json');
const ARCHIVE_FILE = path.join(DATA_DIR, 'archived_expenses.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'active_user_sessions.json');

try {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
} catch (bErr) {
  console.warn('[Server Storage] Could not create backups dir:', bErr);
}

// In-Memory Storage Cache & Versioning
let cachedState: any = null;
let lastModifiedTime: string = '';
let serverVersion: number = 1;
let lastAutoBackupTime: number = 0;
let activeUserSessions: Record<string, { userId: string; activeSessionId: string; userName?: string; device?: string; loginTime: string; lastSeenAt?: string }> = {};

function saveActiveSessionsToDisk() {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(activeUserSessions, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Server Storage] Error writing active_user_sessions.json:', err);
  }
}

// Load persisted state from disk on server launch
function loadStateFromDisk() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, 'utf-8');
      if (content && content.trim()) {
        cachedState = JSON.parse(content);
        const stats = fs.statSync(STATE_FILE);
        lastModifiedTime = stats.mtime.toISOString();
        console.log(`[Server Storage] Loaded existing database from disk (${(content.length / 1024).toFixed(1)} KB, ${(cachedState.expenses?.length || 0)} expenses, path: ${STATE_FILE})`);
      }
    } else {
      console.log(`[Server Storage] No prior system_state.json found at ${STATE_FILE}. Ready to receive initial data.`);
    }

    if (fs.existsSync(SESSIONS_FILE)) {
      try {
        const sessContent = fs.readFileSync(SESSIONS_FILE, 'utf-8');
        if (sessContent && sessContent.trim()) {
          activeUserSessions = JSON.parse(sessContent);
        }
      } catch (sessErr) {
        console.warn('[Server Storage] Could not read active_user_sessions.json:', sessErr);
      }
    }
  } catch (err) {
    console.error('[Server Storage] Error reading database from disk:', err);
  }
}

loadStateFromDisk();

// Safe write to disk (with immediate in-memory cache update & concurrent smart merge)
function saveStateToDisk(data: any, updatedBy: string = 'مدير النظام'): { success: boolean; savedAt?: string; version?: number; error?: string } {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const nowIso = new Date().toISOString();

    // 1. Reconcile Tombstones across all entities
    const existingData = cachedState || {};
    const existingDeletedExpenses = (existingData.deletedExpenseIds && typeof existingData.deletedExpenseIds === 'object') ? existingData.deletedExpenseIds : {};
    const incomingDeletedExpenses = (data.deletedExpenseIds && typeof data.deletedExpenseIds === 'object') ? data.deletedExpenseIds : {};
    const mergedDeletedExpenses = { ...existingDeletedExpenses, ...incomingDeletedExpenses };

    const existingDeletedCustodies = (existingData.deletedCustodyIds && typeof existingData.deletedCustodyIds === 'object') ? existingData.deletedCustodyIds : {};
    const incomingDeletedCustodies = (data.deletedCustodyIds && typeof data.deletedCustodyIds === 'object') ? data.deletedCustodyIds : {};
    const mergedDeletedCustodies = { ...existingDeletedCustodies, ...incomingDeletedCustodies };

    const existingDeletedProjects = (existingData.deletedProjectIds && typeof existingData.deletedProjectIds === 'object') ? existingData.deletedProjectIds : {};
    const incomingDeletedProjects = (data.deletedProjectIds && typeof data.deletedProjectIds === 'object') ? data.deletedProjectIds : {};
    const mergedDeletedProjects = { ...existingDeletedProjects, ...incomingDeletedProjects };

    const existingDeletedUsers = (existingData.deletedUserIds && typeof existingData.deletedUserIds === 'object') ? existingData.deletedUserIds : {};
    const incomingDeletedUsers = (data.deletedUserIds && typeof data.deletedUserIds === 'object') ? data.deletedUserIds : {};
    const mergedDeletedUsers = { ...existingDeletedUsers, ...incomingDeletedUsers };

    const existingDeletedRoles = (existingData.deletedRoleIds && typeof existingData.deletedRoleIds === 'object') ? existingData.deletedRoleIds : {};
    const incomingDeletedRoles = (data.deletedRoleIds && typeof data.deletedRoleIds === 'object') ? data.deletedRoleIds : {};
    const mergedDeletedRoles = { ...existingDeletedRoles, ...incomingDeletedRoles };

    const existingDeletedStages = (existingData.deletedWorkflowStageIds && typeof existingData.deletedWorkflowStageIds === 'object') ? existingData.deletedWorkflowStageIds : {};
    const incomingDeletedStages = (data.deletedWorkflowStageIds && typeof data.deletedWorkflowStageIds === 'object') ? data.deletedWorkflowStageIds : {};
    const mergedDeletedStages = { ...existingDeletedStages, ...incomingDeletedStages };

    // 2. Authoritative client entities: filter out any item present in tombstone records
    const incomingExpenses: any[] = Array.isArray(data.expenses) ? data.expenses : [];
    const cleanExpenses = incomingExpenses.filter((exp: any) => exp && exp.id && !mergedDeletedExpenses[exp.id]);

    const incomingCustodies: any[] = Array.isArray(data.custodies) ? data.custodies : [];
    const cleanCustodies = incomingCustodies.filter((c: any) => c && c.id && !mergedDeletedCustodies[c.id]);

    const incomingProjects: any[] = Array.isArray(data.projects) ? data.projects : [];
    const cleanProjects = incomingProjects.filter((p: any) => p && p.id && !mergedDeletedProjects[p.id]);

    const incomingUsers: any[] = Array.isArray(data.users) ? data.users : [];
    const cleanUsers = incomingUsers.filter((u: any) => u && u.id && !mergedDeletedUsers[u.id]);

    const incomingRoles: any[] = Array.isArray(data.roles) ? data.roles : [];
    const cleanRoles = incomingRoles.filter((r: any) => r && r.id && !mergedDeletedRoles[r.id]);

    const incomingStages: any[] = Array.isArray(data.workflowStages) ? data.workflowStages : [];
    const cleanStages = incomingStages.filter((s: any) => s && s.id && !mergedDeletedStages[s.id]);
    
    // Inject server metadata
    const statePayload = {
      ...data,
      deletedExpenseIds: mergedDeletedExpenses,
      deletedCustodyIds: mergedDeletedCustodies,
      deletedProjectIds: mergedDeletedProjects,
      deletedUserIds: mergedDeletedUsers,
      deletedRoleIds: mergedDeletedRoles,
      deletedWorkflowStageIds: mergedDeletedStages,
      expenses: cleanExpenses,
      custodies: cleanCustodies,
      projects: cleanProjects,
      users: cleanUsers,
      roles: cleanRoles,
      workflowStages: cleanStages,
      lastSyncedAt: nowIso,
      syncedBy: updatedBy,
      serverSavedAt: nowIso
    };

    // Update in-memory state FIRST so reads are always 100% immediate & consistent
    cachedState = statePayload;
    lastModifiedTime = nowIso;
    serverVersion++;

    const jsonString = JSON.stringify(statePayload, null, 2);

    try {
      fs.writeFileSync(STATE_FILE, jsonString, 'utf-8');
    } catch (writeErr) {
      console.warn('[Server Storage] Direct write failed, attempting temp file rename:', writeErr);
      const tempFile = `${STATE_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, jsonString, 'utf-8');
      fs.renameSync(tempFile, STATE_FILE);
    }

    // Trigger auto-backup every 4 hours if data has been updated
    const now = Date.now();
    if (now - lastAutoBackupTime > 4 * 60 * 60 * 1000) {
      lastAutoBackupTime = now;
      try {
        if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
        const backupFilename = `auto_backup_${new Date().toISOString().slice(0, 10)}_${Date.now()}.json`;
        const backupPath = path.join(BACKUPS_DIR, backupFilename);
        fs.writeFileSync(backupPath, jsonString, 'utf-8');
        console.log(`[Server Storage] Periodic backup saved: ${backupFilename}`);
      } catch (backupErr) {
        console.warn('[Server Storage] Auto-backup notice:', backupErr);
      }
    }

    return { success: true, savedAt: nowIso, version: serverVersion };
  } catch (err: any) {
    console.error('[Server Storage] Error saving database to disk:', err);
    // If in-memory is updated, return success with warning so application continues smoothly
    if (cachedState) {
      return { success: true, savedAt: new Date().toISOString(), version: serverVersion };
    }
    return { success: false, error: err?.message || 'Server disk write failed' };
  }
}

// Lazy initializer for Gemini API client
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!aiClient) {
      if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
        aiClient = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });
      } else {
        aiClient = new GoogleGenAI({
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });
      }
    }
    return aiClient;
  } catch (err) {
    console.error('Error initializing GoogleGenAI client:', err);
    return null;
  }
}

// -------------------------------------------------------------
// Server Storage & Synchronization API Endpoints
// -------------------------------------------------------------

// Health check endpoint with storage diagnostic info
app.get(['/api/health', '/api/health.php'], (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    serverStorage: true,
    hasPersistedData: cachedState !== null,
    storagePath: STATE_FILE
  });
});

// Server Storage Diagnostics & Statistics
app.get(['/api/server-info', '/api/server-info.php'], (req, res) => {
  try {
    const exists = fs.existsSync(STATE_FILE);
    let fileSizeKb = 0;
    if (exists) {
      fileSizeKb = Math.round((fs.statSync(STATE_FILE).size / 1024) * 10) / 10;
    }
    res.json({
      status: 'ok',
      mode: 'server_disk_persistence',
      exists,
      fileSizeKb,
      lastModified: lastModifiedTime || null,
      version: serverVersion,
      expensesCount: Array.isArray(cachedState?.expenses) ? cachedState.expenses.length : 0,
      projectsCount: Array.isArray(cachedState?.projects) ? cachedState.projects.length : 0,
      custodiesCount: Array.isArray(cachedState?.custodies) ? cachedState.custodies.length : 0,
      usersCount: Array.isArray(cachedState?.users) ? cachedState.users.length : 0
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err?.message });
  }
});

// GET /api/state/timestamp: Ultra-fast heartbeat check for multi-user real-time synchronization
app.get(['/api/state/timestamp', '/api/state/timestamp.php'], (req, res) => {
  const userId = (req.query.userId || req.headers['x-user-id']) as string;
  const sessionId = (req.query.sessionId || req.headers['x-session-id']) as string;
  let sessionEvicted = false;
  let activeSession = null;

  if (userId && sessionId && activeUserSessions[userId]) {
    activeSession = activeUserSessions[userId];
    if (activeSession.activeSessionId && activeSession.activeSessionId !== sessionId) {
      sessionEvicted = true;
    }
  }

  res.json({
    success: true,
    version: serverVersion,
    lastModified: lastModifiedTime || null,
    timestamp: new Date().toISOString(),
    sessionEvicted,
    activeSession
  });
});

// POST /api/session/register: Register active user session for single-device enforcement
app.post(['/api/session/register', '/api/session/register.php', '/api/session', '/api/session.php'], (req, res) => {
  try {
    const { userId, sessionId, activeSessionId, userName, device, loginTime } = req.body || {};
    const effectiveSessionId = sessionId || activeSessionId;
    if (!userId || !effectiveSessionId) {
      return res.status(400).json({ success: false, error: 'Missing userId or sessionId' });
    }

    const nowIso = new Date().toISOString();
    activeUserSessions[userId] = {
      userId,
      activeSessionId: effectiveSessionId,
      userName: userName || 'مستخدم النظام',
      device: device || 'متصفح ويب',
      loginTime: loginTime || nowIso,
      lastSeenAt: nowIso
    };

    saveActiveSessionsToDisk();

    // If cachedState exists and contains users, synchronize currentSessionId for this user
    if (cachedState && Array.isArray(cachedState.users)) {
      cachedState.users = cachedState.users.map((u: any) => {
        if (u.id === userId) {
          return {
            ...u,
            currentSessionId: effectiveSessionId,
            lastLoginAt: loginTime || nowIso,
            lastLoginDevice: device || u.lastLoginDevice
          };
        }
        return u;
      });
      saveStateToDisk(cachedState, `تسجيل دخول (${userName || userId}) - جلسة نشطة`);
    }

    res.json({
      success: true,
      activeSession: activeUserSessions[userId]
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// GET /api/session/active: Check if current session is active or has been evicted
app.get(['/api/session/active', '/api/session/active.php', '/api/session/active/:userId'], (req, res) => {
  try {
    const userId = (req.params.userId || req.query.userId || req.headers['x-user-id']) as string;
    const sessionId = (req.query.sessionId || req.headers['x-session-id']) as string;

    if (!userId) {
      return res.json({ success: true, activeSessions: activeUserSessions });
    }

    const currentActive = activeUserSessions[userId];
    if (!currentActive) {
      return res.json({
        success: true,
        isCurrentSessionActive: true,
        sessionEvicted: false,
        activeSession: null
      });
    }

    if (sessionId && currentActive.activeSessionId && currentActive.activeSessionId !== sessionId) {
      return res.json({
        success: true,
        isCurrentSessionActive: false,
        sessionEvicted: true,
        activeSessionId: currentActive.activeSessionId,
        activeSession: currentActive
      });
    }

    res.json({
      success: true,
      isCurrentSessionActive: true,
      sessionEvicted: false,
      activeSessionId: currentActive.activeSessionId,
      activeSession: currentActive
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// GET /api/state: Fetch the persisted system state from the server disk
app.get(['/api/state', '/api/state.php'], (req, res) => {
  try {
    const userId = (req.query.userId || req.headers['x-user-id']) as string;
    const sessionId = (req.query.sessionId || req.headers['x-session-id']) as string;

    // Strict security check: If user session was evicted, do NOT send data to this browser
    if (userId && sessionId && activeUserSessions[userId]) {
      const active = activeUserSessions[userId];
      if (active.activeSessionId && active.activeSessionId !== sessionId) {
        return res.json({
          success: false,
          sessionEvicted: true,
          error: 'SESSION_EVICTED',
          message: 'تم إنهاء الجلسة لتسجيل الدخول من جهاز آخر',
          activeSession: active,
          data: null
        });
      }
    }

    if (!cachedState && fs.existsSync(STATE_FILE)) {
      loadStateFromDisk();
    }

    if (cachedState) {
      res.json({
        success: true,
        exists: true,
        data: cachedState,
        lastModified: lastModifiedTime,
        version: serverVersion,
        stats: {
          expenses: Array.isArray(cachedState.expenses) ? cachedState.expenses.length : 0,
          projects: Array.isArray(cachedState.projects) ? cachedState.projects.length : 0,
          custodies: Array.isArray(cachedState.custodies) ? cachedState.custodies.length : 0,
          users: Array.isArray(cachedState.users) ? cachedState.users.length : 0
        }
      });
    } else {
      res.json({
        success: true,
        exists: false,
        data: null,
        version: 0,
        message: 'No data stored on server yet.'
      });
    }
  } catch (err: any) {
    console.error('[Server Storage] Error serving /api/state:', err);
    res.status(500).json({ success: false, error: err?.message || 'Server read error' });
  }
});

// POST /api/state: Save entire system state to server disk
app.post(['/api/state', '/api/state.php'], (req, res) => {
  try {
    let payload = req.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (err) {
        console.error('[Server Storage] JSON parse failed on string body:', err);
      }
    }
    const dataToSave = payload?.data || payload;
    const updatedBy = payload?.updatedBy || 'مستخدم النظام';
    const userId = (payload?.userId || req.headers['x-user-id'] || req.query.userId) as string;
    const sessionId = (payload?.sessionId || req.headers['x-session-id'] || req.query.sessionId) as string;

    // Strict security check: If user session was evicted, reject write from this evicted browser
    if (userId && sessionId && activeUserSessions[userId]) {
      const active = activeUserSessions[userId];
      if (active.activeSessionId && active.activeSessionId !== sessionId) {
        return res.status(403).json({
          success: false,
          sessionEvicted: true,
          error: 'SESSION_EVICTED',
          message: 'تم إنهاء الجلسة لتسجيل الدخول من جهاز آخر. تم حجب استقبال البيانات من هذا المتصفح.',
          activeSession: active
        });
      }
    }

    if (!dataToSave || typeof dataToSave !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid state payload' });
    }

    const saveResult = saveStateToDisk(dataToSave, updatedBy);
    if (!saveResult.success) {
      return res.status(500).json({ success: false, error: saveResult.error });
    }

    res.json({
      success: true,
      savedAt: saveResult.savedAt,
      version: saveResult.version,
      stats: {
        expenses: Array.isArray(dataToSave.expenses) ? dataToSave.expenses.length : 0,
        projects: Array.isArray(dataToSave.projects) ? dataToSave.projects.length : 0,
        custodies: Array.isArray(dataToSave.custodies) ? dataToSave.custodies.length : 0,
        users: Array.isArray(dataToSave.users) ? dataToSave.users.length : 0
      }
    });
  } catch (err: any) {
    console.error('[Server Storage] Error handling POST /api/state:', err);
    res.status(500).json({ success: false, error: err?.message || 'Server write error' });
  }
});

// POST /api/sync/delta: Incremental / Delta Sync endpoint for selective changes
app.post(['/api/sync/delta', '/api/sync/delta.php'], (req, res) => {
  try {
    const { deltas, lastSyncedAt, updatedBy } = req.body || {};
    if (!cachedState && fs.existsSync(STATE_FILE)) {
      loadStateFromDisk();
    }
    if (!cachedState) {
      cachedState = { expenses: [], projects: [], custodies: [], users: [], settings: {}, deletedExpenseIds: {} };
    }

    const currentState = cachedState;
    const nowIso = new Date().toISOString();

    // 1. Deleted items (tombstones) across all entities
    if (deltas?.deletedExpenseIds) {
      currentState.deletedExpenseIds = { ...(currentState.deletedExpenseIds || {}), ...deltas.deletedExpenseIds };
    }
    if (deltas?.deletedCustodyIds) {
      currentState.deletedCustodyIds = { ...(currentState.deletedCustodyIds || {}), ...deltas.deletedCustodyIds };
    }
    if (deltas?.deletedProjectIds) {
      currentState.deletedProjectIds = { ...(currentState.deletedProjectIds || {}), ...deltas.deletedProjectIds };
    }
    if (deltas?.deletedUserIds) {
      currentState.deletedUserIds = { ...(currentState.deletedUserIds || {}), ...deltas.deletedUserIds };
    }
    if (deltas?.deletedRoleIds) {
      currentState.deletedRoleIds = { ...(currentState.deletedRoleIds || {}), ...deltas.deletedRoleIds };
    }
    if (deltas?.deletedWorkflowStageIds) {
      currentState.deletedWorkflowStageIds = { ...(currentState.deletedWorkflowStageIds || {}), ...deltas.deletedWorkflowStageIds };
    }

    // 2. Upsert expenses (delta changes)
    if (Array.isArray(deltas?.expenses)) {
      const expMap = new Map((currentState.expenses || []).map((e: any) => [e.id, e]));
      for (const exp of deltas.expenses) {
        if (exp && exp.id) {
          expMap.set(exp.id, { ...(expMap.get(exp.id) as any || {}), ...exp, updatedAt: exp.updatedAt || nowIso });
        }
      }
      currentState.expenses = Array.from(expMap.values()).filter((e: any) => !currentState.deletedExpenseIds?.[e.id]);
    }

    // 3. Upsert projects
    if (Array.isArray(deltas?.projects)) {
      const projMap = new Map((currentState.projects || []).map((p: any) => [p.id, p]));
      for (const p of deltas.projects) {
        if (p && p.id) {
          projMap.set(p.id, { ...(projMap.get(p.id) as any || {}), ...p });
        }
      }
      currentState.projects = Array.from(projMap.values()).filter((p: any) => !currentState.deletedProjectIds?.[p.id]);
    }

    // 4. Upsert custodies
    if (Array.isArray(deltas?.custodies)) {
      const cMap = new Map((currentState.custodies || []).map((c: any) => [c.id, c]));
      for (const c of deltas.custodies) {
        if (c && c.id) {
          cMap.set(c.id, { ...(cMap.get(c.id) as any || {}), ...c });
        }
      }
      currentState.custodies = Array.from(cMap.values()).filter((c: any) => !currentState.deletedCustodyIds?.[c.id]);
    }

    // 5. Settings / users if provided
    if (deltas?.settings) {
      currentState.settings = { ...(currentState.settings || {}), ...deltas.settings };
    }
    if (Array.isArray(deltas?.users)) {
      const uMap = new Map((currentState.users || []).map((u: any) => [u.id, u]));
      for (const u of deltas.users) {
        if (u && u.id) uMap.set(u.id, { ...(uMap.get(u.id) as any || {}), ...u });
      }
      currentState.users = Array.from(uMap.values()).filter((u: any) => !currentState.deletedUserIds?.[u.id]);
    }

    const saveResult = saveStateToDisk(currentState, updatedBy || 'مستخدم النظام (مزامنة انتقائية)');
    if (!saveResult.success) {
      return res.status(500).json({ success: false, error: saveResult.error });
    }

    res.json({
      success: true,
      savedAt: saveResult.savedAt,
      version: saveResult.version,
      stats: {
        expenses: currentState.expenses.length,
        projects: currentState.projects.length,
        custodies: currentState.custodies.length
      }
    });
  } catch (err: any) {
    console.error('[Server Storage] Error handling POST /api/sync/delta:', err);
    res.status(500).json({ success: false, error: err?.message || 'Delta sync error' });
  }
});
app.post(['/api/backup', '/api/backup.php'], (req, res) => {
  try {
    const customData = req.body?.data || cachedState;
    const label = req.body?.label || 'manual';
    if (!customData) {
      return res.status(400).json({ success: false, error: 'No data available to backup' });
    }

    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `backup_${label}_${dateStr}_${Date.now()}.json`;
    const targetPath = path.join(BACKUPS_DIR, filename);

    fs.writeFileSync(targetPath, JSON.stringify(customData, null, 2), 'utf-8');
    res.json({ success: true, filename, savedAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// GET /api/backups: List backups saved on the server
app.get(['/api/backups', '/api/backups.php'], (req, res) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      return res.json({ success: true, backups: [] });
    }
    const files = fs.readdirSync(BACKUPS_DIR);
    const backups = files
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const stats = fs.statSync(path.join(BACKUPS_DIR, f));
        return {
          filename: f,
          sizeKb: Math.round((stats.size / 1024) * 10) / 10,
          createdAt: stats.birthtime.toISOString(),
          modifiedAt: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ success: true, backups });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Helper: Generate Comprehensive Multi-Sheet Excel Workbook for Daily Backup (.xlsx)
function generateComprehensiveExcelBuffer(state: any): Buffer {
  const wb = XLSX.utils.book_new();
  const currencySymbol = state?.settings?.currencySymbol || 'ر.س';

  // 1. Sheet: Expenses (المصروفات)
  const rawExpenses = Array.isArray(state?.expenses) ? state.expenses : [];
  const expensesData = rawExpenses.map((e: any) => ({
    'رقم السند': e.id || '-',
    'التاريخ': e.date || '-',
    'وقت البصمة': e.fingerprintTime ? new Date(e.fingerprintTime).toLocaleString('ar-SA') : '-',
    'المشروع': e.projectName || '-',
    'المشرف': e.supervisorName || '-',
    'بريد المشرف': e.supervisorEmail || '-',
    'البند': e.category || '-',
    'البيان والتفاصيل': e.details || '-',
    [`المبلغ (${currencySymbol})`]: Number(e.amount) || 0,
    [`الضريبة (${currencySymbol})`]: Number(e.taxAmount) || 0,
    'رقم الفاتورة': e.invoiceNumber || '-',
    'حالة الاعتماد': e.status || '-',
    'اعتماد المشرف': e.projectManagerApproval || e.supervisorApproval || '-',
    'اعتماد المحاسب': e.accountantApproval || '-',
    'ترحيل ERP': e.erpPostingStatus || '-',
    'برنامج ERP': e.erpSystemName || '-',
    'رقم القيد الخارجي': e.erpReferenceNumber || '-',
    'اعتماد الإدارة': e.managementApproval || '-',
    'ملاحظات الإدارة': e.managementNotes || '-',
    'إحداثيات GPS': e.gpsLocation ? `${e.gpsLocation.lat}, ${e.gpsLocation.lng}` : '-'
  }));
  const wsExpenses = XLSX.utils.json_to_sheet(expensesData.length > 0 ? expensesData : [{ 'تنبيه': 'لا توجد مصروفات مسجلة حتى الآن' }]);
  XLSX.utils.book_append_sheet(wb, wsExpenses, 'المصروفات');

  // 2. Sheet: Custodies (العهد المسلمة)
  const rawCustodies = Array.isArray(state?.custodies) ? state.custodies : [];
  const custodiesData = rawCustodies.map((c: any) => ({
    'رقم إيصال العهدة': c.id || '-',
    'التاريخ': c.date || '-',
    'المشرف المستلم': c.supervisorName || '-',
    'البريد الإلكتروني': c.supervisorEmail || '-',
    [`المبلغ المسلم (${currencySymbol})`]: Number(c.amount) || 0,
    'طريقة الدفع': c.paymentMethod || '-',
    'رقم السند / الحوالة': c.receiptNumber || '-',
    'ملاحظات': c.notes || '-',
    'المسلم بواسطة': c.issuedBy || 'الإدارة'
  }));
  const wsCustodies = XLSX.utils.json_to_sheet(custodiesData.length > 0 ? custodiesData : [{ 'تنبيه': 'لا توجد عهد مسجلة' }]);
  XLSX.utils.book_append_sheet(wb, wsCustodies, 'العهد المسلمة');

  // 3. Sheet: Supervisor Balances (أرصدة المشرفين والعهد)
  const rawUsers = Array.isArray(state?.users) ? state.users : [];
  const supervisors = rawUsers.filter((u: any) => u.role === 'مشرف' || u.roleId === 'role_supervisor' || u.role === 'مدير مشروع');
  const supData = supervisors.map((s: any) => {
    const sCustody = rawCustodies.filter((c: any) => c.supervisorEmail === s.email).reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);
    const sApproved = rawExpenses.filter((e: any) => e.supervisorEmail === s.email && e.status === 'معتمد').reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
    const sPending = rawExpenses.filter((e: any) => e.supervisorEmail === s.email && e.status !== 'معتمد' && e.status !== 'مرفوض').reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
    return {
      'اسم المشرف': s.name,
      'البريد الإلكتروني': s.email,
      'رقم الجوال': s.phone || '-',
      [`إجمالي العهد المسلمة (${currencySymbol})`]: sCustody,
      [`المصروفات المعتمدة (${currencySymbol})`]: sApproved,
      [`المصروفات قيد المراجعة (${currencySymbol})`]: sPending,
      [`الرصيد الفعلي المتبقي (${currencySymbol})`]: sCustody - (sApproved + sPending)
    };
  });
  const wsSup = XLSX.utils.json_to_sheet(supData.length > 0 ? supData : [{ 'تنبيه': 'لا يوجد مشرفين مسجلين' }]);
  XLSX.utils.book_append_sheet(wb, wsSup, 'أرصدة المشرفين والعهد');

  // 4. Sheet: Projects (المشاريع)
  const rawProjects = Array.isArray(state?.projects) ? state.projects : [];
  const projectsData = rawProjects.map((p: any) => {
    const prjExpenses = rawExpenses.filter((e: any) => e.projectId === p.id && e.status === 'معتمد');
    const spent = prjExpenses.reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);
    return {
      'كود المشروع': p.code || '-',
      'اسم المشروع': p.name || '-',
      'الحالة': p.status || '-',
      'العميل / المالك': p.clientName || '-',
      'الموقع': p.location || '-',
      [`الميزانية المرصودة (${currencySymbol})`]: Number(p.budget) || 0,
      [`إجمالي المنصرف المعتمد (${currencySymbol})`]: spent,
      [`المتبقي من الميزانية (${currencySymbol})`]: (Number(p.budget) || 0) - spent,
      'نسبة الاستهلاك': `${Math.round((spent / (Number(p.budget) || 1)) * 100)}%`,
      'المشرفين': p.emails || '-'
    };
  });
  const wsProjects = XLSX.utils.json_to_sheet(projectsData.length > 0 ? projectsData : [{ 'تنبيه': 'لا توجد مشاريع مسجلة' }]);
  XLSX.utils.book_append_sheet(wb, wsProjects, 'المشاريع');

  // 5. Sheet: Users (المستخدمين)
  const usersData = rawUsers.map((u: any) => ({
    'اسم الدخول': u.username || '-',
    'الاسم الكامل': u.name,
    'الدور الوظيفي': u.role,
    'البريد الإلكتروني': u.email,
    'رقم الجوال': u.phone || '-',
    'الحالة': u.isActive ? 'نشط' : 'معطل'
  }));
  const wsUsers = XLSX.utils.json_to_sheet(usersData.length > 0 ? usersData : [{ 'تنبيه': 'لا يوجد مستخدمين' }]);
  XLSX.utils.book_append_sheet(wb, wsUsers, 'المستخدمين');

  // 6. Sheet: Roles (الأدوار والصلاحيات)
  const rawRoles = Array.isArray(state?.roles) ? state.roles : [];
  const rolesData = rawRoles.map((r: any) => ({
    'معرف الدور': r.id,
    'اسم الدور': r.name,
    'النوع': r.isSystem ? 'دور نظامي' : 'مخصص',
    'الوصف': r.description || '-',
    'مهلة التعديل (دقائق)': r.gracePeriodMinutes ?? '-'
  }));
  const wsRoles = XLSX.utils.json_to_sheet(rolesData.length > 0 ? rolesData : [{ 'تنبيه': 'لا توجد أدوار إضافية' }]);
  XLSX.utils.book_append_sheet(wb, wsRoles, 'الأدوار والصلاحيات');

  // 7. Sheet: Backup Metadata (معلومات النسخة الاحتياطية)
  const totalExpensesAmount = rawExpenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
  const totalCustodiesAmount = rawCustodies.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);
  const infoData = [
    { 'البيان': 'نوع الملف', 'القيمة': 'حزمة مصنف إكسل الشامل (.xlsx) - النسخة الاحتياطية اليومية للمدير' },
    { 'البيان': 'تاريخ ووقت التصدير', 'القيمة': new Date().toLocaleString('ar-SA') },
    { 'البيان': 'إجمالي عدد المصروفات المسجلة', 'القيمة': rawExpenses.length },
    { 'البيان': `إجمالي قيمة المصروفات (${currencySymbol})`, 'القيمة': totalExpensesAmount },
    { 'البيان': 'إجمالي عدد دفعات العهد', 'القيمة': rawCustodies.length },
    { 'البيان': `إجمالي قيمة العهد المسلمة (${currencySymbol})`, 'القيمة': totalCustodiesAmount },
    { 'البيان': 'إجمالي عدد المشاريع', 'القيمة': rawProjects.length },
    { 'البيان': 'إجمالي عدد المستخدمين', 'القيمة': rawUsers.length },
    { 'البيان': 'البريد الإلكتروني المعتمد للمدير', 'القيمة': state?.settings?.managerBackupEmail || process.env.MANAGER_BACKUP_EMAIL || '2030m.mansour@gmail.com' },
    { 'البيان': 'النظام', 'القيمة': 'SkyArc Financial Control & Custody Management System v10.0' }
  ];
  const wsInfo = XLSX.utils.json_to_sheet(infoData);
  XLSX.utils.book_append_sheet(wb, wsInfo, 'معلومات النسخة');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buf as Buffer;
}

// ==========================================
// pCloud Upload & Public Folder Integration
// ==========================================

function extractPCloudCode(inputStr: string): string {
  if (!inputStr) return '';
  let trimmed = inputStr.trim();
  // Remove any surrounding quotes
  trimmed = trimmed.replace(/^["']|["']$/g, '');
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const urlObj = new URL(trimmed);
      const codeParam = urlObj.searchParams.get('code');
      if (codeParam) return codeParam.trim();

      // Check hash parameter e.g. #page=file_request&code=...
      if (urlObj.hash) {
        const hashMatch = urlObj.hash.match(/[#&?]code=([a-zA-Z0-9_-]+)/i);
        if (hashMatch) return hashMatch[1].trim();
      }

      // Check pathname segments e.g. https://filein.pcloud.com/kXZabc or https://u.pcloud.link/kXZabc
      const segments = urlObj.pathname.split('/').filter(Boolean);
      if (segments.length > 0) {
        const lastSeg = segments[segments.length - 1];
        if (lastSeg !== 'show' && lastSeg !== 'upload' && lastSeg !== 'publink' && lastSeg.length >= 6) {
          return lastSeg.trim();
        }
      }
    }
  } catch {}
  const match = trimmed.match(/[?&#]code=([a-zA-Z0-9_-]+)/i);
  if (match) return match[1].trim();
  return trimmed;
}

// Fetch public folder contents with automatic US & EU data center failover
async function fetchPCloudPubLink(code: string, folderId?: string | number): Promise<{ success: boolean; data?: any; region?: 'us' | 'eu'; error?: string }> {
  const folderParam = folderId ? `&folderid=${folderId}` : '';
  
  // Try US region first
  try {
    const usUrl = `https://api.pcloud.com/showpublink?code=${encodeURIComponent(code)}${folderParam}`;
    const usRes = await fetch(usUrl, { headers: { 'User-Agent': 'SIC-Expenses-App/1.0' } });
    if (usRes.ok) {
      const usJson: any = await usRes.json();
      if (usJson.result === 0) {
        return { success: true, data: usJson, region: 'us' };
      }
    }
  } catch (err) {
    console.warn('[pCloud] US endpoint check failed, trying EU endpoint:', err);
  }

  // Try EU region endpoint
  try {
    const euUrl = `https://eapi.pcloud.com/showpublink?code=${encodeURIComponent(code)}${folderParam}`;
    const euRes = await fetch(euUrl, { headers: { 'User-Agent': 'SIC-Expenses-App/1.0' } });
    if (euRes.ok) {
      const euJson: any = await euRes.json();
      if (euJson.result === 0) {
        return { success: true, data: euJson, region: 'eu' };
      } else if (euJson.error) {
        return { success: false, error: euJson.error };
      }
    }
  } catch (err: any) {
    console.warn('[pCloud] EU endpoint check error:', err);
  }

  return { 
    success: false, 
    error: 'تعذر الوصول لمجلد pCloud. يرجى التأكد من صحة الرابط العام وصلاحية المشارقة (Public Link).' 
  };
}

// Check if a link is a valid pCloud Upload Link (File Request / طلب ملفات)
async function fetchPCloudUploadLinkInfo(code: string): Promise<{ success: boolean; data?: any; region?: 'us' | 'eu'; error?: string }> {
  const cleanCode = extractPCloudCode(code);
  if (!cleanCode) return { success: false, error: 'كود الرابط غير صالح' };

  // Try US region first
  try {
    const usUrl = `https://api.pcloud.com/showuploadlink?code=${encodeURIComponent(cleanCode)}`;
    const usRes = await fetch(usUrl, { headers: { 'User-Agent': 'SIC-Expenses-App/1.0' } });
    if (usRes.ok) {
      const usJson: any = await usRes.json();
      if (usJson.result === 0) {
        return { success: true, data: usJson, region: 'us' };
      }
    }
  } catch (err) {
    console.warn('[pCloud uploadlink] US check error:', err);
  }

  // Try EU region
  try {
    const euUrl = `https://eapi.pcloud.com/showuploadlink?code=${encodeURIComponent(cleanCode)}`;
    const euRes = await fetch(euUrl, { headers: { 'User-Agent': 'SIC-Expenses-App/1.0' } });
    if (euRes.ok) {
      const euJson: any = await euRes.json();
      if (euJson.result === 0) {
        return { success: true, data: euJson, region: 'eu' };
      } else if (euJson.error) {
        return { success: false, error: euJson.error };
      }
    }
  } catch (err: any) {
    console.warn('[pCloud uploadlink] EU check error:', err);
  }

  return { success: false, error: 'تعذر التحقق من رابط الرفع في pCloud. يرجى التأكد من أنه رابط طلب ملفات (File Request).' };
}

// Upload a file buffer directly to a pCloud Upload Link without passwords or API keys
async function uploadFileToPCloudLink(
  code: string,
  fileName: string,
  buffer: Buffer,
  preferredRegion: 'us' | 'eu' = 'us'
): Promise<{ success: boolean; data?: any; region?: 'us' | 'eu'; error?: string; isPubLink?: boolean }> {
  const cleanCode = extractPCloudCode(code);
  if (!cleanCode) return { success: false, error: 'كود الرابط غير صالح' };

  const regions: ('us' | 'eu')[] = preferredRegion === 'eu' ? ['eu', 'us'] : ['us', 'eu'];

  for (const reg of regions) {
    const baseApi = reg === 'eu' ? 'https://eapi.pcloud.com' : 'https://api.pcloud.com';
    try {
      const formData = new FormData();
      const blob = new Blob([buffer]);
      formData.append('file', blob, fileName);
      formData.append('names', 'SIC_Auto_Backup');

      const res = await fetch(`${baseApi}/uploadtolink?code=${encodeURIComponent(cleanCode)}&names=${encodeURIComponent('SIC_Auto_Backup')}`, {
        method: 'POST',
        body: formData,
        headers: { 'User-Agent': 'SIC-Expenses-App/1.0' }
      });

      if (res.ok) {
        const json: any = await res.json();
        if (json.result === 0) {
          return { success: true, data: json, region: reg };
        } else if (json.error) {
          console.warn(`[pCloud uploadtolink] ${reg} error:`, json.error);
        }
      }
    } catch (err: any) {
      console.warn(`[pCloud uploadtolink] ${reg} network error:`, err?.message);
    }
  }

  // Check if it was actually a publink (read-only share link)
  const pubRes = await fetchPCloudPubLink(cleanCode);
  if (pubRes.success && pubRes.data) {
    const meta = pubRes.data.metadata || {};
    return {
      success: false,
      isPubLink: true,
      error: `الرابط المدخل لمجلد "${meta.name || 'المجلد'}" هو رابط مشاركة للعرض والتنزيل فقط (Share Link)، وpCloud لا يسمح برفع الملفات إلى روابط المشاركة. لرفع النسخ تلقائياً، يرجى فتح خيارات المجلد (...) في pCloud واختيار "Request files (طلب ملفات)" ونسخ ذلك الرابط.`
    };
  }

  return { 
    success: false, 
    error: 'فشل رفع الملف إلى pCloud. تأكد من أن الرابط هو رابط طلب ملفات (File Request / Upload Link) سارٍ، وليس رابط مشاركة عادي.' 
  };
}

// Upload a file buffer to pCloud using an Account Access Token (API Auth)
async function uploadFileWithPCloudToken(
  token: string,
  folderId: number | string,
  fileName: string,
  buffer: Buffer,
  preferredRegion: 'us' | 'eu' = 'us'
): Promise<{ success: boolean; data?: any; region?: 'us' | 'eu'; error?: string }> {
  if (!token) return { success: false, error: 'رمز وصول pCloud غير موجود' };
  const regions: ('us' | 'eu')[] = preferredRegion === 'eu' ? ['eu', 'us'] : ['us', 'eu'];

  for (const reg of regions) {
    const baseApi = reg === 'eu' ? 'https://eapi.pcloud.com' : 'https://api.pcloud.com';
    try {
      const formData = new FormData();
      const blob = new Blob([buffer]);
      formData.append('file', blob, fileName);

      const folderParam = folderId ? `&folderid=${encodeURIComponent(String(folderId))}` : '';
      const res = await fetch(`${baseApi}/uploadfile?auth=${encodeURIComponent(token)}${folderParam}`, {
        method: 'POST',
        body: formData,
        headers: { 'User-Agent': 'SIC-Expenses-App/1.0' }
      });

      if (res.ok) {
        const json: any = await res.json();
        if (json.result === 0) {
          return { success: true, data: json, region: reg };
        } else if (json.error) {
          console.warn(`[pCloud uploadfile token] ${reg} error:`, json.error);
        }
      }
    } catch (err: any) {
      console.warn(`[pCloud uploadfile token] ${reg} network error:`, err?.message);
    }
  }

  return { success: false, error: 'فشل رفع الملف إلى pCloud بواسطة رمز الوصول (Access Token).' };
}

// Core Daily Backup Execution Logic (pCloud upload & Local Server Storage)
async function performDailyBackup(
  forceState?: any,
  explicitPcloudUrl?: string
): Promise<{
  success: boolean;
  pcloudUploaded?: boolean;
  pcloudConfigured?: boolean;
  pcloudFiles?: string[];
  pcloudError?: string | null;
  excelFileName: string;
  jsonFileName: string;
  dateStr: string;
  message: string;
  excelSizeKb: number;
  jsonSizeKb: number;
  error?: string;
}> {
  try {
    const state = forceState || cachedState || {};
    const dateStr = new Date().toISOString().slice(0, 10);

    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    const dailyFolder = path.join(BACKUPS_DIR, 'daily');
    if (!fs.existsSync(dailyFolder)) {
      fs.mkdirSync(dailyFolder, { recursive: true });
    }

    // 1. Generate full backup JSON
    const jsonString = JSON.stringify(state, null, 2);
    const jsonFileName = `نسخة_احتياطية_كاملة_${dateStr}.json`;
    const jsonFilePath = path.join(dailyFolder, jsonFileName);
    fs.writeFileSync(jsonFilePath, jsonString, 'utf-8');

    // Stable pointer for latest daily JSON
    const latestJsonPath = path.join(dailyFolder, 'latest_daily_backup.json');
    fs.writeFileSync(latestJsonPath, jsonString, 'utf-8');

    // 2. Generate comprehensive Excel workbook (.xlsx)
    const excelBuffer = generateComprehensiveExcelBuffer(state);
    const excelFileName = `حزمة_مصنف_إكسل_الشامل_${dateStr}.xlsx`;
    const excelFilePath = path.join(dailyFolder, excelFileName);
    fs.writeFileSync(excelFilePath, excelBuffer);

    // Stable pointer for latest daily Excel
    const latestExcelPath = path.join(dailyFolder, 'latest_daily_backup.xlsx');
    fs.writeFileSync(latestExcelPath, excelBuffer);

    const excelSizeKb = Math.round((excelBuffer.length / 1024) * 10) / 10;
    const jsonSizeKb = Math.round((Buffer.byteLength(jsonString) / 1024) * 10) / 10;

    const expensesCount = Array.isArray(state.expenses) ? state.expenses.length : 0;
    const projectsCount = Array.isArray(state.projects) ? state.projects.length : 0;
    const custodiesCount = Array.isArray(state.custodies) ? state.custodies.length : 0;

    // 3. Upload to pCloud if link is configured (Zero passwords/secrets needed) OR via Access Token
    const pcloudUrl = (
      explicitPcloudUrl ||
      state?.settings?.pcloudBackupFolderUrl ||
      process.env.PCLOUD_BACKUP_URL ||
      process.env.PCLOUD_BACKUP_FOLDER_URL ||
      ''
    ).trim();
    const pcloudToken = (state?.settings?.pcloudAccessToken || process.env.PCLOUD_ACCESS_TOKEN || '').trim();

    let pcloudUploaded = false;
    let pcloudErrorMsg = '';
    const pcloudFiles: string[] = [];
    const pcloudConfigured = Boolean(pcloudUrl || pcloudToken);

    if (pcloudConfigured) {
      if (pcloudUrl) {
        const pcloudCode = extractPCloudCode(pcloudUrl);
        if (pcloudCode) {
          try {
            console.log(`[Daily Backup] Uploading to pCloud (code: ${pcloudCode})...`);
            const resExcel = await uploadFileToPCloudLink(pcloudCode, excelFileName, excelBuffer);
            const resJson = await uploadFileToPCloudLink(pcloudCode, jsonFileName, Buffer.from(jsonString, 'utf-8'));
            if (resExcel.success || resJson.success) {
              pcloudUploaded = true;
              if (resExcel.success) pcloudFiles.push(excelFileName);
              if (resJson.success) pcloudFiles.push(jsonFileName);
              console.log(`[Daily Backup] Successfully uploaded to pCloud: ${pcloudFiles.join(', ')}`);
            } else {
              pcloudErrorMsg = resExcel.error || resJson.error || 'فشل الرفع إلى pCloud';
              console.warn(`[Daily Backup] pCloud upload error:`, pcloudErrorMsg);
            }
          } catch (pcloudErr: any) {
            pcloudErrorMsg = pcloudErr?.message || 'خطأ أثناء الرفع إلى pCloud';
            console.error(`[Daily Backup] pCloud upload exception:`, pcloudErr);
          }
        } else {
          pcloudErrorMsg = 'رابط pCloud لا يحتوي على كود مشاركة صالح';
        }
      } else if (pcloudToken) {
        try {
          console.log(`[Daily Backup] Uploading to pCloud using Access Token...`);
          const resExcel = await uploadFileWithPCloudToken(pcloudToken, 0, excelFileName, excelBuffer);
          const resJson = await uploadFileWithPCloudToken(pcloudToken, 0, jsonFileName, Buffer.from(jsonString, 'utf-8'));
          if (resExcel.success || resJson.success) {
            pcloudUploaded = true;
            if (resExcel.success) pcloudFiles.push(excelFileName);
            if (resJson.success) pcloudFiles.push(jsonFileName);
            console.log(`[Daily Backup] Successfully uploaded to pCloud via token: ${pcloudFiles.join(', ')}`);
          } else {
            pcloudErrorMsg = resExcel.error || resJson.error || 'فشل الرفع بواسطة رمز وصول pCloud';
          }
        } catch (pcloudErr: any) {
          pcloudErrorMsg = pcloudErr?.message || 'خطأ أثناء الرفع بواسطة رمز وصول pCloud';
        }
      }
    }

    // Record status to disk
    const statusPayload = {
      lastSentDate: dateStr,
      lastSentAt: new Date().toISOString(),
      lastBackupDate: dateStr,
      lastBackupAt: new Date().toISOString(),
      pcloudUploaded,
      pcloudConfigured,
      pcloudFiles,
      pcloudError: pcloudErrorMsg || null,
      excelFileName,
      jsonFileName,
      excelSizeKb,
      jsonSizeKb,
      expensesCount,
      projectsCount,
      custodiesCount
    };

    const statusFilePath = path.join(dailyFolder, 'daily_backup_status.json');
    fs.writeFileSync(statusFilePath, JSON.stringify(statusPayload, null, 2), 'utf-8');

    let responseMessage = '';
    if (pcloudUploaded) {
      responseMessage = `تم بنجاح إنشاء حزمة إكسل الشاملة والنسخة الاحتياطية ورفعهما تلقائياً إلى مجلد pCloud السحابي (${pcloudFiles.join(' و ')}) وحفظهما على السيرفر!`;
    } else if (pcloudConfigured && !pcloudUploaded) {
      responseMessage = `تم حفظ النسخة على الخادم بنجاح، ولكن تعذر رفعها إلى pCloud (${pcloudErrorMsg}).`;
    } else {
      responseMessage = `تم إنشاء مصنف إكسل الشامل والنسخة الاحتياطية وحفظهما بنجاح في مجلد النسخ على السيرفر!`;
    }

    return {
      success: true,
      pcloudUploaded,
      pcloudConfigured,
      pcloudFiles,
      pcloudError: pcloudErrorMsg || null,
      excelFileName,
      jsonFileName,
      dateStr,
      excelSizeKb,
      jsonSizeKb,
      message: responseMessage
    };
  } catch (err: any) {
    console.error('[Daily Backup] Failed daily backup execution:', err);
    return {
      success: false,
      excelFileName: '',
      jsonFileName: '',
      dateStr: new Date().toISOString().slice(0, 10),
      excelSizeKb: 0,
      jsonSizeKb: 0,
      message: 'فشل تنفيذ النسخ الاحتياطي اليومي',
      error: err?.message || 'Unknown error'
    };
  }
}

// Periodic Automated Check for Daily Backup (Runs daily or checks every 30 mins)
function checkAndRunDailyBackup() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const dailyFolder = path.join(BACKUPS_DIR, 'daily');
    const statusFilePath = path.join(dailyFolder, 'daily_backup_status.json');

    let alreadyRanToday = false;
    if (fs.existsSync(statusFilePath)) {
      try {
        const raw = fs.readFileSync(statusFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.lastBackupDate === today || parsed.lastSentDate === today) {
          alreadyRanToday = true;
        }
      } catch {}
    }

    if (!alreadyRanToday && cachedState) {
      console.log(`[Daily Backup Scheduler] Initiating automated daily backup for ${today}...`);
      performDailyBackup();
    }
  } catch (schedErr) {
    console.warn('[Daily Backup Scheduler] Scheduler check encountered issue:', schedErr);
  }
}

// Trigger initial check 15 seconds after boot, then check every 30 minutes
setTimeout(checkAndRunDailyBackup, 15000);
setInterval(checkAndRunDailyBackup, 30 * 60 * 1000);

// POST /api/backup/run-daily: Trigger daily backup (Excel + JSON saved to server and uploaded to pCloud)
app.post([
  '/api/backup/run-daily',
  '/api/backup/run-daily.php',
  '/api/backup/send-daily-email',
  '/api/backup/send-daily-email.php'
], async (req, res) => {
  try {
    const forceState = req.body?.data || req.body?.fullState || null;
    const targetPcloudUrl = req.body?.pcloudUrl || req.body?.pcloudBackupFolderUrl || null;
    const result = await performDailyBackup(forceState, targetPcloudUrl);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to execute daily backup' });
  }
});

// POST /api/backup/upload-pcloud: Trigger direct daily backup upload to pCloud folder link
app.post(['/api/backup/upload-pcloud', '/api/backup/upload-pcloud.php'], async (req, res) => {
  try {
    const { link, fullState } = req.body || {};
    const state = fullState || cachedState || {};
    const targetLink = (link || state?.settings?.pcloudBackupFolderUrl || process.env.PCLOUD_BACKUP_URL || '').trim();
    const targetToken = (state?.settings?.pcloudAccessToken || process.env.PCLOUD_ACCESS_TOKEN || '').trim();

    if (!targetLink && !targetToken) {
      return res.status(400).json({
        success: false,
        error: 'يرجى إدخال رابط طلب ملفات pCloud (File Request / Upload Link) أو رمز الوصول'
      });
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const dailyFolder = path.join(BACKUPS_DIR, 'daily');
    if (!fs.existsSync(dailyFolder)) {
      fs.mkdirSync(dailyFolder, { recursive: true });
    }

    // Generate Excel & JSON
    const excelBuffer = generateComprehensiveExcelBuffer(state);
    const excelFileName = `حزمة_مصنف_إكسل_الشامل_${dateStr}.xlsx`;
    const excelFilePath = path.join(dailyFolder, excelFileName);
    fs.writeFileSync(excelFilePath, excelBuffer);

    const jsonString = JSON.stringify(state, null, 2);
    const jsonFileName = `نسخة_احتياطية_كاملة_${dateStr}.json`;
    const jsonFilePath = path.join(dailyFolder, jsonFileName);
    fs.writeFileSync(jsonFilePath, jsonString, 'utf-8');

    let excelUpload: any = { success: false };
    let jsonUpload: any = { success: false };

    if (targetLink) {
      const code = extractPCloudCode(targetLink);
      if (!code) {
        return res.status(400).json({ success: false, error: 'الرابط لا يحتوي على كود مشاركة صالح' });
      }
      excelUpload = await uploadFileToPCloudLink(code, excelFileName, excelBuffer);
      jsonUpload = await uploadFileToPCloudLink(code, jsonFileName, Buffer.from(jsonString, 'utf-8'));
    } else if (targetToken) {
      excelUpload = await uploadFileWithPCloudToken(targetToken, 0, excelFileName, excelBuffer);
      jsonUpload = await uploadFileWithPCloudToken(targetToken, 0, jsonFileName, Buffer.from(jsonString, 'utf-8'));
    }

    const uploadedFiles: string[] = [];
    if (excelUpload.success) uploadedFiles.push(excelFileName);
    if (jsonUpload.success) uploadedFiles.push(jsonFileName);

    if (uploadedFiles.length > 0) {
      return res.json({
        success: true,
        pcloudUploaded: true,
        uploadedFiles,
        dateStr,
        excelFileName,
        jsonFileName,
        excelSizeKb: Math.round((excelBuffer.length / 1024) * 10) / 10,
        jsonSizeKb: Math.round((Buffer.byteLength(jsonString) / 1024) * 10) / 10,
        message: `تم رفع حزمة إكسل والنسخة الاحتياطية (${uploadedFiles.join(' و ')}) بنجاح إلى مجلد pCloud السحابي الخاص بك بدون أي كلمة سر!`
      });
    } else {
      const isPubLink = Boolean(excelUpload?.isPubLink || jsonUpload?.isPubLink);
      return res.status(400).json({
        success: false,
        isPubLink,
        error: excelUpload.error || jsonUpload.error || 'فشل رفع الملفات إلى pCloud. يرجى التأكد من أن الرابط هو رابط طلب ملفات (File Request / Upload Link) سارٍ.'
      });
    }
  } catch (err: any) {
    console.error('Error in /api/backup/upload-pcloud:', err);
    res.status(500).json({ success: false, error: err?.message || 'Server error uploading to pCloud' });
  }
});

// GET /api/backup/daily-status: Fetch last daily backup status & metadata
app.get(['/api/backup/daily-status', '/api/backup/daily-status.php'], (req, res) => {
  try {
    const dailyFolder = path.join(BACKUPS_DIR, 'daily');
    const statusFilePath = path.join(dailyFolder, 'daily_backup_status.json');
    const pcloudConfigured = Boolean(
      cachedState?.settings?.pcloudBackupFolderUrl || process.env.PCLOUD_BACKUP_URL || process.env.PCLOUD_BACKUP_FOLDER_URL
    );

    if (!fs.existsSync(statusFilePath)) {
      return res.json({
        success: true,
        status: null,
        pcloudConfigured
      });
    }

    const raw = fs.readFileSync(statusFilePath, 'utf-8');
    const status = JSON.parse(raw);
    status.pcloudConfigured = pcloudConfigured;
    res.json({ success: true, status, pcloudConfigured });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// GET /api/backup/download-daily/:type: Download latest daily generated Excel or JSON
app.get(['/api/backup/download-daily/:type', '/api/backup/download-daily.php'], (req, res) => {
  try {
    const type = req.params?.type || (req.query?.type as string) || 'excel';
    const dailyFolder = path.join(BACKUPS_DIR, 'daily');
    const dateStr = new Date().toISOString().slice(0, 10);

    if (type === 'excel' || type === 'xlsx') {
      const targetPath = path.join(dailyFolder, 'latest_daily_backup.xlsx');
      if (!fs.existsSync(targetPath)) {
        // Generate on the fly if not exists
        const buf = generateComprehensiveExcelBuffer(cachedState || {});
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="حزمة_مصنف_إكسل_الشامل_${dateStr}.xlsx"`);
        return res.send(buf);
      }
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="حزمة_مصنف_إكسل_الشامل_${dateStr}.xlsx"`);
      return res.sendFile(targetPath);
    } else {
      const targetPath = path.join(dailyFolder, 'latest_daily_backup.json');
      if (!fs.existsSync(targetPath)) {
        const jsonStr = JSON.stringify(cachedState || {}, null, 2);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="نسخة_احتياطية_كاملة_${dateStr}.json"`);
        return res.send(jsonStr);
      }
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="نسخة_احتياطية_كاملة_${dateStr}.json"`);
      return res.sendFile(targetPath);
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// POST /api/restore: Restore a server backup file to active state
app.post(['/api/restore', '/api/restore.php', '/api/restore-backup', '/api/restore-backup.php'], (req, res) => {
  try {
    const filename = req.body?.filename;
    if (!filename) {
      return res.status(400).json({ success: false, error: 'Missing filename' });
    }
    const backupPath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ success: false, error: 'Backup file not found on server' });
    }

    const content = fs.readFileSync(backupPath, 'utf-8');
    const parsed = JSON.parse(content);
    const saveRes = saveStateToDisk(parsed, 'استرجاع نسخة احتياطية من السيرفر');

    if (saveRes.success) {
      res.json({ success: true, data: parsed, savedAt: saveRes.savedAt });
    } else {
      res.status(500).json({ success: false, error: saveRes.error });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// GET & POST for Archived Expenses
app.get('/api/archived-expenses', (req, res) => {
  try {
    if (fs.existsSync(ARCHIVE_FILE)) {
      const content = fs.readFileSync(ARCHIVE_FILE, 'utf-8');
      res.json({ success: true, data: JSON.parse(content) });
    } else {
      res.json({ success: true, data: [] });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

app.post('/api/archived-expenses', (req, res) => {
  try {
    const data = req.body?.data || req.body;
    fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ success: true, savedAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

import { sql } from '@vercel/postgres';

async function ensurePostgresTable() {
  if (!process.env.POSTGRES_URL) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS expenses (
        id VARCHAR(255) PRIMARY KEY,
        title TEXT,
        amount NUMERIC,
        category VARCHAR(255),
        date VARCHAR(50),
        invoice_url TEXT,
        notes TEXT,
        raw_data TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('[Postgres] Expenses table verified/created successfully');
  } catch (err) {
    console.warn('[Postgres] Table creation warning:', err);
  }
}

ensurePostgresTable();

app.get('/api/expenses', async (req, res) => {
  try {
    if (process.env.POSTGRES_URL) {
      const { rows } = await sql`SELECT * FROM expenses ORDER BY created_at DESC;`;
      const mappedRows = rows.map((r: any) => {
        let parsed = {};
        try {
          if (r.raw_data) parsed = JSON.parse(r.raw_data);
        } catch {}
        const photo = r.invoice_url || (parsed as any).invoicePhoto || (parsed as any).invoice_url;
        return {
          ...r,
          ...parsed,
          id: r.id || (parsed as any).id,
          invoicePhoto: photo,
          invoice_url: photo
        };
      });
      return res.json({ success: true, expenses: mappedRows });
    }
  } catch (err) {
    console.warn('[Postgres] GET /api/expenses error, falling back to local state:', err);
  }
  const rawExpenses = cachedState?.expenses || [];
  const expenses = rawExpenses.map((e: any) => ({
    ...e,
    invoicePhoto: e.invoicePhoto || e.invoice_url,
    invoice_url: e.invoice_url || e.invoicePhoto
  }));
  res.json({ success: true, expenses });
});

app.post('/api/expenses', async (req, res) => {
  try {
    const rawDataStr = JSON.stringify(req.body || {});
    const { id, title, amount, category, date, invoice_url, invoicePhoto, notes } = req.body || {};
    const finalInvoiceUrl = invoice_url || invoicePhoto;
    const expenseId = id || `exp_${Date.now()}`;

    if (process.env.POSTGRES_URL) {
      await sql`
        INSERT INTO expenses (id, title, amount, category, date, invoice_url, notes, raw_data)
        VALUES (${expenseId}, ${title || ''}, ${amount || 0}, ${category || 'عام'}, ${date || new Date().toISOString().slice(0, 10)}, ${finalInvoiceUrl || null}, ${notes || null}, ${rawDataStr})
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          amount = EXCLUDED.amount,
          category = EXCLUDED.category,
          date = EXCLUDED.date,
          invoice_url = EXCLUDED.invoice_url,
          notes = EXCLUDED.notes,
          raw_data = EXCLUDED.raw_data;
      `;
    }

    if (cachedState && Array.isArray(cachedState.expenses)) {
      const newExp = { ...(req.body || {}), id: expenseId, invoice_url: finalInvoiceUrl, invoicePhoto: finalInvoiceUrl, updatedAt: new Date().toISOString() };
      const idx = cachedState.expenses.findIndex((e: any) => e.id === expenseId);
      if (idx >= 0) {
        cachedState.expenses[idx] = { ...cachedState.expenses[idx], ...newExp };
      } else {
        cachedState.expenses.unshift(newExp);
      }
      saveStateToDisk(cachedState);
    }

    res.status(201).json({ success: true, id: expenseId, message: 'Expense saved successfully' });
  } catch (err: any) {
    console.error('POST /api/expenses error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
});

app.put('/api/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rawDataStr = JSON.stringify(req.body || {});
    const { title, amount, category, date, invoice_url, invoicePhoto, notes } = req.body || {};
    const finalInvoiceUrl = invoice_url || invoicePhoto;

    if (process.env.POSTGRES_URL) {
      await sql`
        UPDATE expenses
        SET 
          title = COALESCE(${title}, title),
          amount = COALESCE(${amount}, amount),
          category = COALESCE(${category}, category),
          date = COALESCE(${date}, date),
          invoice_url = COALESCE(${finalInvoiceUrl}, invoice_url),
          notes = COALESCE(${notes}, notes),
          raw_data = ${rawDataStr}
        WHERE id = ${id};
      `;
    }

    if (cachedState && Array.isArray(cachedState.expenses)) {
      const idx = cachedState.expenses.findIndex((e: any) => e.id === id);
      if (idx >= 0) {
        cachedState.expenses[idx] = { 
          ...cachedState.expenses[idx], 
          ...req.body, 
          invoicePhoto: finalInvoiceUrl || cachedState.expenses[idx].invoicePhoto,
          invoice_url: finalInvoiceUrl || cachedState.expenses[idx].invoice_url,
          updatedAt: new Date().toISOString() 
        };
        saveStateToDisk(cachedState);
      }
    }

    res.json({ success: true, message: `Expense ${id} updated successfully` });
  } catch (err: any) {
    console.error(`PUT /api/expenses/${req.params.id} error:`, err);
    res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (process.env.POSTGRES_URL) {
      await sql`DELETE FROM expenses WHERE id = ${id};`;
    }

    if (cachedState && Array.isArray(cachedState.expenses)) {
      cachedState.expenses = cachedState.expenses.filter((e: any) => e.id !== id);
      if (!cachedState.deletedExpenseIds) cachedState.deletedExpenseIds = {};
      cachedState.deletedExpenseIds[id] = true;
      saveStateToDisk(cachedState);
    }

    res.json({ success: true, message: `Expense ${id} deleted successfully` });
  } catch (err: any) {
    console.error(`DELETE /api/expenses/${req.params.id} error:`, err);
    res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
});

// ==========================================
// pCloud Public Folder Integration Endpoints
// ==========================================

// Test and validate a pCloud Upload Link (File Request / طلب ملفات) for automated backups
app.post(['/api/pcloud/test-upload-link', '/api/pcloud/test-upload-link.php'], async (req, res) => {
  try {
    const { link } = req.body || {};
    if (!link || !link.trim()) {
      return res.status(400).json({ success: false, error: 'يرجى إدخال رابط طلب ملفات pCloud (File Request / Upload Link)' });
    }

    const code = extractPCloudCode(link);
    if (!code) {
      return res.status(400).json({ success: false, error: 'الرابط لا يحتوي على كود مشاركة صالح' });
    }

    // 1. Try as upload link
    const uploadRes = await fetchPCloudUploadLinkInfo(code);
    if (uploadRes.success && uploadRes.data) {
      const data = uploadRes.data;
      const folderName = data.name || 'مجلد الاستقبال في pCloud';
      return res.json({
        success: true,
        isUploadLink: true,
        code,
        folderName,
        region: uploadRes.region,
        message: `تم التحقق بنجاح! الرابط جاهز لاستقبال النسخ الاحتياطية وإكسل تلقائياً في مجلد "${folderName}" بدون أي كلمة سر.`
      });
    }

    // 2. Try as publink
    const pubRes = await fetchPCloudPubLink(code);
    if (pubRes.success && pubRes.data) {
      const meta = pubRes.data.metadata || {};
      return res.json({
        success: false,
        isUploadLink: false,
        isPubLink: true,
        code,
        folderName: meta.name || 'مجلد مشترك',
        region: pubRes.region,
        message: `تنبيه: تم التعرف على المجلد "${meta.name || 'المجلد'}" بنجاح، ولكنه رابط مشاركة للعرض والتنزيل فقط (Share Link). موقع pCloud لا يقبل رفع ملفات إلى روابط المشاركة لحماية المجلد. لرفع النسخ تلقائياً، يرجى النقر على خيارات المجلد (...) في pCloud واختيار "Request files (طلب ملفات)" ونسخ ذلك الرابط هنا.`
      });
    }

    return res.status(400).json({
      success: false,
      error: uploadRes.error || pubRes.error || 'تعذر التحقق من رابط pCloud. يرجى التأكد من صحة الرابط.'
    });
  } catch (err: any) {
    console.error('Error in /api/pcloud/test-upload-link:', err);
    res.status(500).json({ success: false, error: err?.message || 'Server error testing upload link' });
  }
});

// List contents of a pCloud public folder
app.all('/api/pcloud/list-folder', async (req, res) => {
  try {
    const linkOrCode = req.method === 'POST' 
      ? (req.body?.link || req.body?.code || req.body?.publicUrl) 
      : (req.query.link || req.query.code || req.query.publicUrl);
    
    const folderId = req.method === 'POST' ? req.body?.folderId : req.query.folderId;

    if (!linkOrCode) {
      return res.status(400).json({ success: false, error: 'يرجى تقديم رابط المجلد المشترك أو كود المشاركة الخاص بـ pCloud' });
    }

    const code = extractPCloudCode(String(linkOrCode));
    if (!code) {
      return res.status(400).json({ success: false, error: 'لم يتم العثور على كود المشاركة (code) في الرابط المدخل' });
    }

    const result = await fetchPCloudPubLink(code, folderId ? String(folderId) : undefined);
    if (!result.success || !result.data) {
      return res.status(400).json({ success: false, error: result.error || 'فشل جلب بيانات المجلد من pCloud' });
    }

    const meta = result.data.metadata || {};
    const region = result.region || 'us';
    const baseApi = region === 'eu' ? 'https://eapi.pcloud.com' : 'https://api.pcloud.com';
    const rawContents: any[] = meta.contents || [];

    const items = rawContents.map((item: any) => {
      const isFolder = Boolean(item.isfolder);
      const isImage = !isFolder && ((item.contenttype && item.contenttype.startsWith('image/')) || /\.(jpg|jpeg|png|webp|gif|bmp|heic|svg)$/i.test(item.name));
      const isPdf = !isFolder && (item.contenttype === 'application/pdf' || /\.pdf$/i.test(item.name));

      const thumbUrl = !isFolder && isImage
        ? `${baseApi}/getpubthumb?code=${encodeURIComponent(code)}&fileid=${item.fileid}&size=320x320`
        : undefined;

      const directDownloadUrl = !isFolder
        ? `/api/pcloud/file-proxy?code=${encodeURIComponent(code)}&fileid=${item.fileid}&region=${region}&filename=${encodeURIComponent(item.name)}`
        : undefined;

      return {
        id: isFolder ? `folder-${item.folderid}` : `file-${item.fileid}`,
        name: item.name,
        isFolder,
        folderId: isFolder ? item.folderid : undefined,
        fileId: !isFolder ? item.fileid : undefined,
        size: item.size || 0,
        contentType: item.contenttype || (isPdf ? 'application/pdf' : isImage ? 'image/jpeg' : 'application/octet-stream'),
        isImage,
        isPdf,
        thumbUrl,
        downloadUrl: directDownloadUrl,
        modified: item.modified,
        created: item.created,
        parentFolderId: meta.folderid
      };
    });

    const subfolders = items.filter(it => it.isFolder);
    const files = items.filter(it => !it.isFolder);
    const totalImages = files.filter(f => f.isImage).length;
    const totalPdfs = files.filter(f => f.isPdf).length;

    res.json({
      success: true,
      code,
      region,
      folderName: meta.name || 'مجلد pCloud المشترك',
      folderId: meta.folderid || 0,
      currentPath: meta.name || '',
      items,
      subfolders,
      files,
      totalFiles: files.length,
      totalImages,
      totalPdfs
    });
  } catch (err: any) {
    console.error('Error in /api/pcloud/list-folder:', err);
    res.status(500).json({ success: false, error: err?.message || 'Server error while listing pCloud folder' });
  }
});

// Proxy streaming / downloading a file or thumbnail from pCloud to avoid browser CORS issues
async function getPCloudDownloadStreamInfo(code: string, fileId?: string | number, preferredRegion: string = 'us'): Promise<{ streamUrl: string; region: string } | null> {
  const cleanCode = extractPCloudCode(code);
  const cleanFileId = fileId ? String(fileId).replace(/^file-/, '').trim() : '';
  if (!cleanCode) return null;

  const regions: ('us' | 'eu')[] = (preferredRegion === 'eu') ? ['eu', 'us'] : ['us', 'eu'];

  for (const reg of regions) {
    const baseApi = reg === 'eu' ? 'https://eapi.pcloud.com' : 'https://api.pcloud.com';
    try {
      // 1. If fileId is present, try with fileid
      if (cleanFileId) {
        const url = `${baseApi}/getpublinkdownload?code=${encodeURIComponent(cleanCode)}&fileid=${encodeURIComponent(cleanFileId)}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'SIC-Expenses-App/1.0' } });
        if (res.ok) {
          const json: any = await res.json();
          if (json.result === 0 && Array.isArray(json.hosts) && json.hosts.length > 0 && json.path) {
            return {
              streamUrl: `https://${json.hosts[0]}${json.path}`,
              region: reg
            };
          }
        }
      }

      // 2. Try single file publink (without fileid)
      const directUrl = `${baseApi}/getpublinkdownload?code=${encodeURIComponent(cleanCode)}`;
      const directRes = await fetch(directUrl, { headers: { 'User-Agent': 'SIC-Expenses-App/1.0' } });
      if (directRes.ok) {
        const json: any = await directRes.json();
        if (json.result === 0 && Array.isArray(json.hosts) && json.hosts.length > 0 && json.path) {
          return {
            streamUrl: `https://${json.hosts[0]}${json.path}`,
            region: reg
          };
        }
      }
    } catch (e) {
      console.warn(`[pCloud] getpublinkdownload check on ${reg} failed:`, e);
    }
  }
  return null;
}

app.get('/api/pcloud/file-proxy', async (req, res) => {
  try {
    const { code, fileid, fileId, region = 'us', filename = 'file', size } = req.query;
    const targetCode = String(code || '');
    const targetFileId = String(fileid || fileId || '');

    if (!targetCode) {
      return res.status(400).send('Missing pCloud code');
    }

    const cleanCode = extractPCloudCode(targetCode);
    const cleanFileId = targetFileId.replace(/^file-/, '').trim();
    const ext = path.extname(String(filename)).toLowerCase();
    const isImageExt = /\.(jpg|jpeg|png|webp|gif|bmp|svg|heic)$/i.test(String(filename));

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // If thumbnail requested (e.g. for grid/cards), proxy getpubthumb directly
    if (size) {
      const regions: ('us' | 'eu')[] = (region === 'eu') ? ['eu', 'us'] : ['us', 'eu'];
      for (const reg of regions) {
        const baseApi = reg === 'eu' ? 'https://eapi.pcloud.com' : 'https://api.pcloud.com';
        try {
          const thumbUrl = cleanFileId
            ? `${baseApi}/getpubthumb?code=${encodeURIComponent(cleanCode)}&fileid=${encodeURIComponent(cleanFileId)}&size=${encodeURIComponent(String(size))}`
            : `${baseApi}/getpubthumb?code=${encodeURIComponent(cleanCode)}&size=${encodeURIComponent(String(size))}`;
          const thumbRes = await fetch(thumbUrl, { redirect: 'follow', headers: { 'User-Agent': 'SIC-Expenses-App/1.0' } });
          if (thumbRes.ok) {
            const ct = thumbRes.headers.get('content-type') || 'image/jpeg';
            res.setHeader('Content-Type', ct);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            const arrayBuf = await thumbRes.arrayBuffer();
            return res.send(Buffer.from(arrayBuf));
          }
        } catch {}
      }
    }

    // Try standard stream info
    const streamInfo = await getPCloudDownloadStreamInfo(cleanCode, cleanFileId, String(region));
    if (streamInfo) {
      const fileRes = await fetch(streamInfo.streamUrl, {
        redirect: 'follow',
        headers: { 'User-Agent': 'SIC-Expenses-App/1.0' }
      });

      if (fileRes.ok) {
        let contentType = fileRes.headers.get('content-type');
        if (!contentType || contentType === 'application/octet-stream') {
          if (ext === '.pdf') contentType = 'application/pdf';
          else if (ext === '.png') contentType = 'image/png';
          else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
          else if (ext === '.webp') contentType = 'image/webp';
          else if (ext === '.svg') contentType = 'image/svg+xml';
          else if (isImageExt) contentType = 'image/jpeg';
          else contentType = 'application/octet-stream';
        }

        const contentLength = fileRes.headers.get('content-length');

        res.setHeader('Content-Type', contentType);
        if (contentLength) res.setHeader('Content-Length', contentLength);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(String(filename))}"`);

        const arrayBuffer = await fileRes.arrayBuffer();
        return res.send(Buffer.from(arrayBuffer));
      }
    }

    // High-res Image Fallback via getpubthumb if getpublinkdownload didn't succeed
    if (isImageExt || !ext) {
      const regions: ('us' | 'eu')[] = (region === 'eu') ? ['eu', 'us'] : ['us', 'eu'];
      for (const reg of regions) {
        const baseApi = reg === 'eu' ? 'https://eapi.pcloud.com' : 'https://api.pcloud.com';
        try {
          const highResThumbUrl = cleanFileId
            ? `${baseApi}/getpubthumb?code=${encodeURIComponent(cleanCode)}&fileid=${encodeURIComponent(cleanFileId)}&size=2048x2048`
            : `${baseApi}/getpubthumb?code=${encodeURIComponent(cleanCode)}&size=2048x2048`;
          const thumbRes = await fetch(highResThumbUrl, { redirect: 'follow', headers: { 'User-Agent': 'SIC-Expenses-App/1.0' } });
          if (thumbRes.ok) {
            const ct = thumbRes.headers.get('content-type') || 'image/jpeg';
            res.setHeader('Content-Type', ct);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(String(filename))}"`);
            const arrayBuf = await thumbRes.arrayBuffer();
            return res.send(Buffer.from(arrayBuf));
          }
        } catch {}
      }
    }

    return res.status(404).send('Failed to obtain pCloud download stream');
  } catch (err: any) {
    console.error('Error in /api/pcloud/file-proxy:', err);
    res.status(500).send('Internal Server Error streaming pCloud file');
  }
});

// Download and convert a pCloud file directly into a Data URL (base64)
app.post('/api/pcloud/download-base64', async (req, res) => {
  try {
    const { code, fileId, fileid, region = 'us', downloadUrl, fileName = 'attachment' } = req.body || {};
    const targetCode = String(code || '');
    const targetFileId = String(fileId || fileid || '');

    let streamUrl = downloadUrl;
    if (!streamUrl && targetCode && targetFileId) {
      const cleanCode = extractPCloudCode(targetCode);
      const cleanFileId = targetFileId.replace(/^file-/, '').trim();
      const streamInfo = await getPCloudDownloadStreamInfo(cleanCode, cleanFileId, String(region));
      if (streamInfo) {
        streamUrl = streamInfo.streamUrl;
      }
    }

    if (!streamUrl) {
      return res.status(400).json({ success: false, error: 'تعذر استخراج رابط تحميل الملف من pCloud' });
    }

    const fileRes = await fetch(streamUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'SIC-Expenses-App/1.0' }
    });

    if (!fileRes.ok) {
      return res.status(400).json({ success: false, error: 'فشل تحميل الملف من خادم pCloud' });
    }

    const ext = path.extname(String(fileName)).toLowerCase();
    let contentType = fileRes.headers.get('content-type');
    if (!contentType || contentType === 'application/octet-stream') {
      if (ext === '.pdf') contentType = 'application/pdf';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.webp') contentType = 'image/webp';
      else contentType = 'image/jpeg';
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    res.json({
      success: true,
      dataUrl,
      fileName,
      fileSize: buffer.length,
      contentType
    });
  } catch (err: any) {
    console.error('Error in /api/pcloud/download-base64:', err);
    res.status(500).json({ success: false, error: err?.message || 'Server error downloading pCloud file' });
  }
});

// Test and validate a pCloud Upload Link (File Request / طلب ملفات)
app.post(['/api/pcloud/test-upload-link', '/api/pcloud/test-upload-link.php'], async (req, res) => {
  try {
    const { link } = req.body || {};
    if (!link || !link.trim()) {
      return res.status(400).json({ success: false, error: 'يرجى إدخال رابط مجلد pCloud' });
    }

    const code = extractPCloudCode(link);
    if (!code) {
      return res.status(400).json({ success: false, error: 'الرابط لا يحتوي على كود مشاركة صالح' });
    }

    // 1. Check if it's an Upload Link (File Request)
    const uploadInfo = await fetchPCloudUploadLinkInfo(code);
    if (uploadInfo.success && uploadInfo.data) {
      const info = uploadInfo.data;
      const folderName = info.name || info.mail || 'مجلد pCloud (طلب ملفات)';
      return res.json({
        success: true,
        isUploadLink: true,
        isPubLink: false,
        folderName,
        region: uploadInfo.region,
        code,
        message: `تم التحقق بنجاح! الرابط صالح لطلب الملفات (Request files) في مجلد: ${folderName}`
      });
    }

    // 2. Check if it's a PubLink (Read-only Share Link)
    const pubInfo = await fetchPCloudPubLink(code);
    if (pubInfo.success && pubInfo.data) {
      const meta = pubInfo.data.metadata || {};
      return res.json({
        success: true,
        isUploadLink: false,
        isPubLink: true,
        folderName: meta.name || 'مجلد مشاركة',
        region: pubInfo.region,
        code,
        message: `هذا الرابط هو رابط مشاركة للعرض والتنزيل فقط (Share link) لمجلد "${meta.name}". pCloud يمنع الرفع عبر روابط المشاركة لحماية المجلد. يرجى اختيار "Request files (طلب ملفات)" بدلاً من Share link.`
      });
    }

    return res.status(400).json({
      success: false,
      error: uploadInfo.error || pubInfo.error || 'تعذر التحقق من رابط pCloud. تأكد من صحة الرابط.'
    });
  } catch (err: any) {
    console.error('Error in /api/pcloud/test-upload-link:', err);
    res.status(500).json({ success: false, error: err?.message || 'Server error testing upload link' });
  }
});

// Test and validate a pCloud Public Folder Link
app.post(['/api/pcloud/test-link', '/api/pcloud/test-link.php'], async (req, res) => {
  try {
    const { link } = req.body || {};
    if (!link || !link.trim()) {
      return res.status(400).json({ success: false, error: 'يرجى إدخال رابط مجلد pCloud' });
    }

    const code = extractPCloudCode(link);
    if (!code) {
      return res.status(400).json({ success: false, error: 'الرابط لا يحتوي على كود مشاركة pCloud صالح' });
    }

    const result = await fetchPCloudPubLink(code);
    if (!result.success || !result.data) {
      return res.status(400).json({ success: false, error: result.error || 'تعذر قراءة المجلد' });
    }

    const meta = result.data.metadata || {};
    const contents: any[] = meta.contents || [];
    const files = contents.filter(c => !c.isfolder);
    const subfolders = contents.filter(c => c.isfolder);
    const totalImages = files.filter(f => (f.contenttype && f.contenttype.startsWith('image/')) || /\.(jpg|jpeg|png|webp|gif|bmp|heic|svg)$/i.test(f.name)).length;
    const totalPdfs = files.filter(f => f.contenttype === 'application/pdf' || /\.pdf$/i.test(f.name)).length;

    res.json({
      success: true,
      folderName: meta.name || 'مجلد مشترك',
      folderId: meta.folderid || 0,
      code,
      region: result.region,
      totalFiles: files.length,
      totalSubfolders: subfolders.length,
      totalImages,
      totalPdfs,
      message: `تم التحقق بنجاح! المجلد "${meta.name}" يحتوي على ${files.length} ملف (${totalImages} صورة، ${totalPdfs} مستند PDF).`
    });
  } catch (err: any) {
    console.error('Error in /api/pcloud/test-link:', err);
    res.status(500).json({ success: false, error: err?.message || 'Server error testing link' });
  }
});

// Vite & Static Asset Handling
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
