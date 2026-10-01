// Session persistence: IndexedDB instead of localStorage.
//
// The whole dataset was mirrored into localStorage on every edit, but
// localStorage is synchronous and capped around 5 MB - large datasets fail to
// persist silently. This module stores the flat state object as a single
// IndexedDB record and still understands the old localStorage payload, so an
// existing session migrates on first load.

const DB_NAME = 'coding-dashboard';
const STORE_NAME = 'session';
const RECORD_KEY = 'current';

// Old localStorage key - doubles as the fallback store when IndexedDB is
// unavailable (e.g. hardened private-browsing modes).
const LEGACY_KEY = 'coding-dashboard-data';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('could not open IndexedDB'));
    request.onblocked = () => reject(new Error('IndexedDB open was blocked'));
  }).catch((error) => {
    dbPromise = null; // do not cache the failure forever - retry next call
    throw error;
  });
  return dbPromise;
}

function run(mode, operation) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = operation(store);
        transaction.oncomplete = () => resolve(request ? request.result : undefined);
        transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
        transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
      }),
  );
}

function readLegacy() {
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLegacy(value) {
  try {
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn('could not persist data (localStorage unavailable or full):', error);
    return false;
  }
}

function clearLegacy() {
  try {
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
}

/** Loads the stored session (or null). Migrates a legacy localStorage payload once. */
export async function loadSession() {
  const legacy = readLegacy();
  try {
    const stored = await run('readonly', (store) => store.get(RECORD_KEY));
    if (stored) {
      if (legacy && (legacy.savedAt || 0) > (stored.savedAt || 0)) {
        // A previous write fell back to localStorage - the legacy copy is newer.
        return await promoteLegacy(legacy);
      }
      if (legacy) clearLegacy(); // stale copy of an already-migrated session
      return stored;
    }
    if (legacy) return await promoteLegacy(legacy);
    return null;
  } catch {
    // IndexedDB unavailable - the legacy localStorage payload is the store.
    return legacy;
  }
}

/** Copies a localStorage session into IndexedDB, clearing it only on success. */
async function promoteLegacy(legacy) {
  try {
    await run('readwrite', (store) => store.put(legacy, RECORD_KEY));
    clearLegacy();
  } catch (error) {
    console.warn('could not migrate localStorage data to IndexedDB:', error);
  }
  return legacy;
}

/** Persists the flat session object. Returns false when nothing was written. */
export async function saveSession(value) {
  const stamped = { ...value, savedAt: Date.now() };
  try {
    await run('readwrite', (store) => store.put(stamped, RECORD_KEY));
    return true;
  } catch (error) {
    console.warn('IndexedDB write failed, falling back to localStorage:', error);
    return writeLegacy(stamped);
  }
}

/** Removes every trace of the stored session. */
export async function clearSession() {
  clearLegacy();
  try {
    await run('readwrite', (store) => store.delete(RECORD_KEY));
  } catch {
    // ignore - nothing left that matters
  }
}
