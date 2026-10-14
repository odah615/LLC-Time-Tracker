/**
 * LLC Time Tracker - Ultra-Resilient Storage Manager
 * 
 * Provides IndexedDB persistence with safe, quota-protected localStorage fallbacks.
 * Prevents QuotaExceededError crashes while preserving unsynchronized records.
 */

import { TimeLog, ScreenshotLog, AuditLog, DailyAttendanceLog } from '../types';

const DB_NAME = 'trackpulse_db';
const DB_VERSION = 1;
const TIMELOGS_STORE = 'timelogs';
const SCREENSHOTS_STORE = 'screenshots';
const AUDITLOGS_STORE = 'auditlogs';
const ATTENDANCE_STORE = 'attendance';

// Maximum recent logs kept in localStorage to ensure minimal footprint (<100KB)
const MAX_LOCALSTORAGE_TIMELOGS = 40;

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Initializes or retrieves the IndexedDB connection.
 */
export function getIndexedDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(TIMELOGS_STORE)) {
        db.createObjectStore(TIMELOGS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SCREENSHOTS_STORE)) {
        db.createObjectStore(SCREENSHOTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(AUDITLOGS_STORE)) {
        db.createObjectStore(AUDITLOGS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(ATTENDANCE_STORE)) {
        db.createObjectStore(ATTENDANCE_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.warn('IndexedDB open error:', request.error);
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

/**
 * Saves a list of items to an IndexedDB store.
 */
export async function idbBulkPut<T extends { id: string }>(
  storeName: string,
  items: T[]
): Promise<boolean> {
  if (!items || items.length === 0) return true;
  try {
    const db = await getIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const item of items) {
        if (item && item.id) {
          store.put(item);
        }
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = (err) => {
        console.warn(`IndexedDB bulk put error on store ${storeName}:`, err);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn(`IndexedDB connection error during put to ${storeName}:`, err);
    return false;
  }
}

/**
 * Retrieves all records from an IndexedDB store.
 */
export async function idbGetAll<T>(storeName: string): Promise<T[]> {
  try {
    const db = await getIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => {
        console.warn(`IndexedDB getAll error on store ${storeName}:`, request.error);
        resolve([]);
      };
    });
  } catch (err) {
    console.warn(`IndexedDB connection error during getAll on ${storeName}:`, err);
    return [];
  }
}

/**
 * Safely writes a value to localStorage with QuotaExceededError protection.
 * If quota is exceeded, compacts storage and retries without throwing.
 */
export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    const isQuotaError =
      err instanceof DOMException &&
      (err.code === 22 ||
        err.code === 1014 ||
        err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED');

    if (isQuotaError) {
      console.warn(`localStorage QuotaExceededError detected while writing "${key}". Initiating emergency compaction...`);
      try {
        // Emergency compaction: prune large cached arrays from localStorage
        emergencyStorageCleanup(key);
        localStorage.setItem(key, value);
        console.log(`Successfully recovered from QuotaExceededError for key "${key}".`);
        return true;
      } catch (retryErr) {
        console.warn(`localStorage quota still exceeded after cleanup for key "${key}". Suppressing error to prevent application crash.`);
        return false;
      }
    } else {
      console.warn(`Unexpected localStorage error writing "${key}":`, err);
      return false;
    }
  }
}

/**
 * Safely reads a value from localStorage.
 */
export function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn(`Error reading localStorage key "${key}":`, err);
    return null;
  }
}

/**
 * Safely removes a value from localStorage.
 */
export function safeRemoveItem(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`Error removing localStorage key "${key}":`, err);
  }
}

/**
 * Emergency storage cleanup when localStorage is completely full.
 * Prunes large serialized historical arrays from localStorage while preserving active logs.
 */
function emergencyStorageCleanup(targetKey: string): void {
  const keysToClean = [
    'trackpulse_screenshots',
    'trackpulse_auditlogs',
    'trackpulse_presence',
    'trackpulse_idlelogs',
    'trackpulse_worldclocks',
  ];

  for (const k of keysToClean) {
    if (k !== targetKey) {
      try {
        const raw = localStorage.getItem(k);
        if (raw && raw.length > 50000) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            // Retain only top 10 items in localStorage
            localStorage.setItem(k, JSON.stringify(parsed.slice(0, 10)));
          }
        }
      } catch {}
    }
  }

  // If target key is timelogs, compact it directly
  if (targetKey === 'trackpulse_timelogs') {
    try {
      const rawLogs = localStorage.getItem('trackpulse_timelogs');
      if (rawLogs) {
        const parsed = JSON.parse(rawLogs);
        if (Array.isArray(parsed)) {
          const compacted = compactTimeLogsForLocalStorage(parsed);
          localStorage.setItem('trackpulse_timelogs', JSON.stringify(compacted));
        }
      }
    } catch {}
  }
}

/**
 * Compacts a list of time logs for localStorage storage.
 * Always retains:
 * 1. Unsynchronized time logs (where isSynced !== true)
 * 2. Active tracking time logs (where status === 'active')
 * 3. Most recent MAX_LOCALSTORAGE_TIMELOGS logs
 */
export function compactTimeLogsForLocalStorage(logs: TimeLog[]): TimeLog[] {
  if (!logs || !Array.isArray(logs)) return [];
  if (logs.length <= MAX_LOCALSTORAGE_TIMELOGS) return logs;

  const map = new Map<string, TimeLog>();

  // Always keep unsynced logs and active tracking logs
  for (const log of logs) {
    if (!log) continue;
    const isUnsynced = log.isSynced === false || (log as any).syncedToSheet === false;
    const isActive = log.status === 'running' || log.status === 'paused';
    if (isUnsynced || isActive) {
      map.set(log.id, log);
    }
  }

  // Fill remainder up to MAX_LOCALSTORAGE_TIMELOGS with most recent logs
  const sorted = [...logs].sort((a, b) => {
    const timeA = new Date(a.startTime || a.date || 0).getTime();
    const timeB = new Date(b.startTime || b.date || 0).getTime();
    return timeB - timeA;
  });

  for (const log of sorted) {
    if (map.size >= MAX_LOCALSTORAGE_TIMELOGS) break;
    if (log && log.id) {
      map.set(log.id, log);
    }
  }

  return Array.from(map.values());
}

/**
 * Persists time logs safely to both IndexedDB (full history) and localStorage (compacted).
 */
export async function persistTimeLogsLocally(logs: TimeLog[]): Promise<void> {
  if (!logs || !Array.isArray(logs)) return;

  // 1. Asynchronously persist complete history to IndexedDB
  idbBulkPut(TIMELOGS_STORE, logs).catch((err) => {
    console.warn('Failed to bulk store time logs to IndexedDB:', err);
  });

  // 2. Persist compacted subset to localStorage safely
  const compacted = compactTimeLogsForLocalStorage(logs);
  safeSetItem('trackpulse_timelogs', JSON.stringify(compacted));
}

/**
 * Hydrates time logs from both IndexedDB and localStorage on application startup.
 * Migrates old localStorage records into IndexedDB seamlessly.
 */
export async function loadTimeLogsFromStorage(): Promise<TimeLog[]> {
  const map = new Map<string, TimeLog>();

  // 1. Read from IndexedDB (full history)
  try {
    const idbLogs = await idbGetAll<TimeLog>(TIMELOGS_STORE);
    for (const log of idbLogs) {
      if (log && log.id) {
        map.set(log.id, log);
      }
    }
  } catch (err) {
    console.warn('Failed to load time logs from IndexedDB:', err);
  }

  // 2. Read from localStorage (and migrate any missing items to IndexedDB)
  try {
    const localRaw = safeGetItem('trackpulse_timelogs');
    if (localRaw) {
      const localLogs = JSON.parse(localRaw);
      if (Array.isArray(localLogs)) {
        const newLocalItems: TimeLog[] = [];
        for (const log of localLogs) {
          if (log && log.id) {
            if (!map.has(log.id)) {
              map.set(log.id, log);
              newLocalItems.push(log);
            } else {
              // Merge details if local has newer duration or status
              const existing = map.get(log.id)!;
              if ((log.durationSeconds || 0) > (existing.durationSeconds || 0)) {
                map.set(log.id, { ...existing, ...log });
              }
            }
          }
        }
        // Migrate new items from localStorage to IndexedDB
        if (newLocalItems.length > 0) {
          idbBulkPut(TIMELOGS_STORE, newLocalItems).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load time logs from localStorage:', err);
  }

  return Array.from(map.values());
}

/**
 * Persists screenshots safely to IndexedDB and localStorage.
 */
export async function persistScreenshotsLocally(screenshots: ScreenshotLog[]): Promise<void> {
  if (!screenshots || !Array.isArray(screenshots)) return;

  idbBulkPut(SCREENSHOTS_STORE, screenshots).catch(() => {});

  // Keep max 15 recent screenshots in localStorage to avoid quota issues
  const recent = screenshots.slice(0, 15);
  safeSetItem('trackpulse_screenshots', JSON.stringify(recent));
}

/**
 * Persists audit logs safely to IndexedDB and localStorage.
 */
export async function persistAuditLogsLocally(auditLogs: AuditLog[]): Promise<void> {
  if (!auditLogs || !Array.isArray(auditLogs)) return;

  idbBulkPut(AUDITLOGS_STORE, auditLogs).catch(() => {});

  const recent = auditLogs.slice(0, 50);
  safeSetItem('trackpulse_auditlogs', JSON.stringify(recent));
}

/**
 * Persists attendance logs safely to IndexedDB and localStorage.
 */
export async function persistAttendanceLocally(attendance: DailyAttendanceLog[]): Promise<void> {
  if (!attendance || !Array.isArray(attendance)) return;

  idbBulkPut(ATTENDANCE_STORE, attendance).catch(() => {});

  const recent = attendance.slice(0, 50);
  safeSetItem('trackpulse_attendance', JSON.stringify(recent));
}
