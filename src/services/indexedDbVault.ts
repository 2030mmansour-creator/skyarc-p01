/**
 * IndexedDB Vault Service
 * Provides robust client-side storage for heavy attachments, PDFs, and image data URLs.
 * Bypasses the 5MB localStorage limit and safely stores gigabytes of project documents.
 */

const DB_NAME = 'sic_attachments_vault_v1';
const DB_VERSION = 1;
const STORE_ATTACHMENTS = 'attachments';
const STORE_PROJECT_ARCHIVES = 'project_archives';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_ATTACHMENTS)) {
        db.createObjectStore(STORE_ATTACHMENTS, { keyPath: 'expenseId' });
      }
      if (!db.objectStoreNames.contains(STORE_PROJECT_ARCHIVES)) {
        db.createObjectStore(STORE_PROJECT_ARCHIVES, { keyPath: 'projectId' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.warn('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };
  });

  return dbPromise;
}

// In-Memory Fast Cache for synchronous component rendering
const memoryCache = new Map<string, any>();
const projectArchivesMemoryCache = new Map<string, Record<string, any>>();

export const IndexedDBVault = {
  // Set attachment record in memory and IndexedDB
  async setAttachment(expenseId: string, item: any): Promise<void> {
    if (!expenseId || !item) return;
    memoryCache.set(expenseId, item);

    if (item.projectId) {
      const prjMap = projectArchivesMemoryCache.get(item.projectId) || {};
      prjMap[expenseId] = item;
      projectArchivesMemoryCache.set(item.projectId, prjMap);
    }

    try {
      const db = await getDb();
      const tx = db.transaction([STORE_ATTACHMENTS, STORE_PROJECT_ARCHIVES], 'readwrite');
      const attachStore = tx.objectStore(STORE_ATTACHMENTS);
      attachStore.put(item);

      if (item.projectId) {
        const prjStore = tx.objectStore(STORE_PROJECT_ARCHIVES);
        const currentPrj = projectArchivesMemoryCache.get(item.projectId) || {};
        prjStore.put({
          projectId: item.projectId,
          attachments: currentPrj,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn('IndexedDB setAttachment error:', e);
    }
  },

  // Batch save multiple attachments efficiently
  async batchSetAttachments(projectId: string, items: any[]): Promise<void> {
    if (!items || items.length === 0) return;

    const prjMap = projectArchivesMemoryCache.get(projectId) || {};
    items.forEach((it) => {
      memoryCache.set(it.expenseId, it);
      prjMap[it.expenseId] = it;
    });
    projectArchivesMemoryCache.set(projectId, prjMap);

    try {
      const db = await getDb();
      const tx = db.transaction([STORE_ATTACHMENTS, STORE_PROJECT_ARCHIVES], 'readwrite');
      const attachStore = tx.objectStore(STORE_ATTACHMENTS);
      items.forEach((it) => {
        attachStore.put(it);
      });

      const prjStore = tx.objectStore(STORE_PROJECT_ARCHIVES);
      prjStore.put({
        projectId,
        attachments: prjMap,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('IndexedDB batchSetAttachments error:', e);
    }
  },

  // Get attachment synchronously from memory cache (or fallback to null)
  getAttachmentSync(expenseId: string): any | null {
    return memoryCache.get(expenseId) || null;
  },

  // Get attachment asynchronously from IndexedDB
  async getAttachment(expenseId: string): Promise<any | null> {
    if (memoryCache.has(expenseId)) {
      return memoryCache.get(expenseId);
    }

    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_ATTACHMENTS, 'readonly');
        const store = tx.objectStore(STORE_ATTACHMENTS);
        const req = store.get(expenseId);
        req.onsuccess = () => {
          if (req.result) {
            memoryCache.set(expenseId, req.result);
            resolve(req.result);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },

  // Get all attachments for a project synchronously from memory cache
  getProjectAttachmentsSync(projectId: string): Record<string, any> {
    return projectArchivesMemoryCache.get(projectId) || {};
  },

  // Get all attachments for a project asynchronously from IndexedDB
  async getProjectAttachments(projectId: string): Promise<Record<string, any>> {
    if (projectArchivesMemoryCache.has(projectId)) {
      return projectArchivesMemoryCache.get(projectId)!;
    }

    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_PROJECT_ARCHIVES, 'readonly');
        const store = tx.objectStore(STORE_PROJECT_ARCHIVES);
        const req = store.get(projectId);
        req.onsuccess = () => {
          if (req.result?.attachments) {
            projectArchivesMemoryCache.set(projectId, req.result.attachments);
            resolve(req.result.attachments);
          } else {
            resolve({});
          }
        };
        req.onerror = () => resolve({});
      });
    } catch {
      return {};
    }
  },

  // Get all attachments asynchronously from IndexedDB
  async getAllAttachments(): Promise<any[]> {
    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_ATTACHMENTS, 'readonly');
        const store = tx.objectStore(STORE_ATTACHMENTS);
        const req = store.getAll();
        req.onsuccess = () => {
          resolve(Array.isArray(req.result) ? req.result : []);
        };
        req.onerror = () => resolve(Array.from(memoryCache.values()));
      });
    } catch {
      return Array.from(memoryCache.values());
    }
  },

  // Warm up memory cache from IndexedDB on startup
  async initMemoryCache(): Promise<void> {
    try {
      const db = await getDb();
      const tx = db.transaction(STORE_ATTACHMENTS, 'readonly');
      const store = tx.objectStore(STORE_ATTACHMENTS);
      const req = store.getAll();
      req.onsuccess = () => {
        if (Array.isArray(req.result)) {
          req.result.forEach((it) => {
            if (it && it.expenseId) {
              memoryCache.set(it.expenseId, it);
              if (it.projectId) {
                const prjMap = projectArchivesMemoryCache.get(it.projectId) || {};
                prjMap[it.expenseId] = it;
                projectArchivesMemoryCache.set(it.projectId, prjMap);
              }
            }
          });
        }
      };
    } catch (e) {
      console.warn('IndexedDB initMemoryCache error:', e);
    }
  }
};

// Initialize memory cache in background
if (typeof window !== 'undefined') {
  IndexedDBVault.initMemoryCache().catch(() => {});
}
