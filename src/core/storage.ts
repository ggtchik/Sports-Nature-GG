/**
 * Persistance locale — §22 du cahier des charges.
 *
 * · Préférences et spots : LocalStorage (accès synchrone, simple).
 * · Cache de données volumineuses (côtes, séries) : IndexedDB.
 *
 * Toutes les clés sont préfixées et versionnées : une montée de version du modèle
 * invalide proprement les anciennes entrées.
 */

const PREFIX = 'gg-sports-nature';
const VERSION = 3;

const K = {
  settings: 'settings',
  spots: 'spots',
  session: 'session',
  costs: 'costs',
  tideKey: 'tide-api-key',
} as const;

function key(name: string): string {
  return `${PREFIX}:v${VERSION}:${name}`;
}

// ---------------------------------------------------------------------------
// LocalStorage — préférences
// ---------------------------------------------------------------------------

export function loadJson<T>(storage: Storage, name: string, fallback: T): T {
  try {
    const raw = storage.getItem(key(name));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson(storage: Storage, name: string, value: unknown): void {
  try {
    storage.setItem(key(name), JSON.stringify(value));
  } catch {
    /* quota dépassé ou mode privé : on dégrade silencieusement */
  }
}

export function removeKey(storage: Storage, name: string): void {
  try {
    storage.removeItem(key(name));
  } catch {
    /* ignore */
  }
}

export const STORAGE_KEYS = K;

/** Détection d'un stockage indisponible (navigation privée stricte). */
export function storageAvailable(storage: Storage | undefined): boolean {
  if (!storage) return false;
  try {
    const probe = `${PREFIX}:probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// IndexedDB — cache de données
// ---------------------------------------------------------------------------

const DB_NAME = `${PREFIX}-cache`;
const DB_VERSION = 1;
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export async function idbGet<T>(k: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(k);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function idbSet(k: string, value: unknown): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, k);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbDelete(k: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(k);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbClear(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
