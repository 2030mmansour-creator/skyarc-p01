/**
 * SkyArc Multi-Tenant Workspace & Branch Isolation Service
 * 
 * Provides automated, domain-aware, and configurable workspace scoping so that
 * separate deployments (e.g. https://skyarc-p01.vercel.app and https://khema-masrya-2.vercel.app)
 * or separate branches connected to the same Firebase project operate in complete data isolation.
 */

export type WorkspaceSource = 'custom' | 'env' | 'hostname' | 'default';

export interface WorkspaceInfo {
  id: string;
  name: string;
  source: WorkspaceSource;
  rawHostname: string;
}

const STORAGE_KEY_CUSTOM_WORKSPACE = 'skyarc_custom_workspace_id';
const listeners = new Set<(info: WorkspaceInfo) => void>();

/**
 * Sanitizes a workspace string into a safe Firestore document/collection key.
 * Allows Arabic/Latin alphanumeric, underscores, and hyphens.
 */
export function sanitizeWorkspaceId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  // Replace invalid characters or spaces with underscore
  return trimmed
    .replace(/[\/\.\#\$\[\]\s]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

/**
 * Derives the active Workspace ID using a deterministic 4-tier priority cascade:
 * 1. Manual User Override (saved in localStorage)
 * 2. Build-time / Runtime Environment Variable (VITE_APP_WORKSPACE_ID)
 * 3. Automatic Vercel / Cloud Domain Hostname Extraction (e.g. khema-masrya-2.vercel.app -> khema-masrya-2)
 * 4. Fallback Default ('default')
 */
export function getWorkspaceInfo(): WorkspaceInfo {
  let hostname = '';
  if (typeof window !== 'undefined' && window.location?.hostname) {
    hostname = window.location.hostname.toLowerCase();
  }

  // 1. Manual user override in LocalStorage
  try {
    if (typeof localStorage !== 'undefined') {
      const custom = localStorage.getItem(STORAGE_KEY_CUSTOM_WORKSPACE);
      if (custom && custom.trim()) {
        const sanitized = sanitizeWorkspaceId(custom);
        if (sanitized) {
          return {
            id: sanitized,
            name: custom.trim(),
            source: 'custom',
            rawHostname: hostname
          };
        }
      }
    }
  } catch {}

  // 2. Explicit environment variable configured on Vercel/Vite
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_APP_WORKSPACE_ID) {
      const envVal = String((import.meta as any).env.VITE_APP_WORKSPACE_ID).trim();
      const sanitized = sanitizeWorkspaceId(envVal);
      if (sanitized) {
        return {
          id: sanitized,
          name: envVal,
          source: 'env',
          rawHostname: hostname
        };
      }
    }
  } catch {}

  // 3. Automated Hostname Subdomain Extraction for Vercel / Netlify / Custom subdomains
  if (hostname) {
    // Check if hosted on Vercel (*.vercel.app)
    if (hostname.endsWith('.vercel.app')) {
      const sub = hostname.replace('.vercel.app', '');
      const sanitized = sanitizeWorkspaceId(sub);
      if (sanitized && sanitized !== 'localhost') {
        return {
          id: sanitized,
          name: sub,
          source: 'hostname',
          rawHostname: hostname
        };
      }
    }

    // Check other common cloud hosting domains or subdomains (e.g. sub.example.com)
    if (!hostname.includes('localhost') && !hostname.includes('127.0.0.1') && !hostname.includes('run.app')) {
      const parts = hostname.split('.');
      if (parts.length > 2) {
        const sub = parts[0];
        const sanitized = sanitizeWorkspaceId(sub);
        if (sanitized && sanitized !== 'www') {
          return {
            id: sanitized,
            name: sub,
            source: 'hostname',
            rawHostname: hostname
          };
        }
      }
    }
  }

  // 4. Default fallback
  return {
    id: 'default',
    name: 'مساحة العمل الافتراضية (Default)',
    source: 'default',
    rawHostname: hostname
  };
}

/**
 * Returns the current active Workspace ID string
 */
export function getWorkspaceId(): string {
  return getWorkspaceInfo().id;
}

/**
 * Sets or clears the manual workspace override in localStorage
 */
export function setCustomWorkspaceId(newId: string | null): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (newId && newId.trim()) {
        const sanitized = sanitizeWorkspaceId(newId);
        localStorage.setItem(STORAGE_KEY_CUSTOM_WORKSPACE, sanitized);
      } else {
        localStorage.removeItem(STORAGE_KEY_CUSTOM_WORKSPACE);
      }
    }
  } catch {}

  notifyWorkspaceListeners();
}

/**
 * Subscribes to workspace ID changes
 */
export function subscribeToWorkspace(listener: (info: WorkspaceInfo) => void): () => void {
  listeners.add(listener);
  listener(getWorkspaceInfo());
  return () => {
    listeners.delete(listener);
  };
}

function notifyWorkspaceListeners(): void {
  const current = getWorkspaceInfo();
  listeners.forEach(cb => {
    try {
      cb(current);
    } catch {}
  });
}
