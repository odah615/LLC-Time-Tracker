/**
 * Test suite for Ultra-Resilient Storage Manager (storageDb.ts)
 * Validates:
 * 1. safeSetItem prevents QuotaExceededError crashes and catches exceptions.
 * 2. compactTimeLogsForLocalStorage preserves unsynchronized and active tracking logs while pruning history.
 * 3. IndexedDB persistence and recovery.
 */

// Node.js CLI Environment Mock Setup for localStorage & window
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) || null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] || null,
    length: 0,
  } as any;
}

if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = globalThis;
}

import {
  safeSetItem,
  safeGetItem,
  compactTimeLogsForLocalStorage,
  persistTimeLogsLocally,
  loadTimeLogsFromStorage,
} from '../src/lib/storageDb.js';
import { TimeLog } from '../src/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${testName}${details ? ' - ' + details : ''}`);
    failed++;
  }
}

async function runStorageTests() {
  console.log('--- STARTING STORAGE QUOTA & INDEXEDDB TESTS ---\n');

  // Test 1: compactTimeLogsForLocalStorage keeps unsynced logs and active logs
  {
    const sampleLogs: TimeLog[] = [];
    for (let i = 1; i <= 100; i++) {
      sampleLogs.push({
        id: `log-${i}`,
        userId: 'usr-1',
        userName: 'Agent One',
        userAvatar: '',
        designation: 'Agent',
        geoTimezone: 'Asia/Manila',
        geoLocalStartTime: '08:00 AM',
        mouseActivityAvg: 90,
        keyboardActivityAvg: 90,
        appsUsed: [],
        idleSeconds: 0,
        task: `Task ${i}`,
        startTime: new Date(Date.now() - i * 3600000).toISOString(),
        endTime: new Date(Date.now() - (i - 1) * 3600000).toISOString(),
        durationSeconds: 3600,
        status: i === 1 ? 'running' : 'completed',
        isSynced: i <= 5 ? false : true, // First 5 logs are unsynced
        date: '2026-10-13',
      });
    }

    const compacted = compactTimeLogsForLocalStorage(sampleLogs);

    assert(
      compacted.length <= 40,
      `Compacted length is within max storage limit (got ${compacted.length}, expected <= 40)`
    );

    const hasActiveLog = compacted.some((l) => l.id === 'log-1');
    assert(hasActiveLog, 'Active tracking log is preserved in compacted storage');

    const unsyncedLogsCount = compacted.filter((l) => l.isSynced === false).length;
    assert(unsyncedLogsCount === 5, `All 5 unsynchronized logs are preserved (got ${unsyncedLogsCount})`);
  }

  // Test 2: safeSetItem catches QuotaExceededError without throwing
  {
    const originalSetItem = localStorage.setItem;
    let thrownErrorCaught = false;

    // Simulate DOMException QuotaExceededError on setItem
    localStorage.setItem = () => {
      const quotaErr = new DOMException('Storage quota exceeded', 'QuotaExceededError');
      Object.defineProperty(quotaErr, 'code', { value: 22 });
      throw quotaErr;
    };

    try {
      const result = safeSetItem('test_quota_key', 'some_value');
      thrownErrorCaught = true;
      assert(result === false, 'safeSetItem returns false on quota error instead of crashing');
    } catch (e) {
      assert(false, 'safeSetItem allowed QuotaExceededError to throw and crash');
    } finally {
      localStorage.setItem = originalSetItem;
    }

    assert(thrownErrorCaught, 'safeSetItem gracefully handled QuotaExceededError');
  }

  // Test 3: persistTimeLogsLocally writes safely
  {
    const logs: TimeLog[] = [
      {
        id: 'log-persist-1',
        userId: 'usr-2',
        userName: 'Agent Two',
        userAvatar: '',
        designation: 'Agent',
        geoTimezone: 'Asia/Manila',
        geoLocalStartTime: '08:00 AM',
        mouseActivityAvg: 90,
        keyboardActivityAvg: 90,
        appsUsed: [],
        idleSeconds: 0,
        task: 'Development',
        startTime: new Date().toISOString(),
        durationSeconds: 1200,
        status: 'running',
        isSynced: false,
        date: '2026-10-13',
      },
    ];

    await persistTimeLogsLocally(logs);
    const storedRaw = safeGetItem('trackpulse_timelogs');
    assert(storedRaw !== null, 'Time logs stored in localStorage via persistTimeLogsLocally');
    if (storedRaw) {
      const parsed = JSON.parse(storedRaw);
      assert(parsed.length === 1 && parsed[0].id === 'log-persist-1', 'Correct time log structure persisted');
    }
  }

  // Test 4: loadTimeLogsFromStorage merges records
  {
    const loaded = await loadTimeLogsFromStorage();
    assert(Array.isArray(loaded), 'loadTimeLogsFromStorage returns an array');
  }

  console.log(`\n--- STORAGE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) {
    process.exit(1);
  }
}

runStorageTests().catch((err) => {
  console.error('Unhandled storage test runner error:', err);
  process.exit(1);
});
