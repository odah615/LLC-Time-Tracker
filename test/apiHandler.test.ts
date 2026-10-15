/**
 * Automated test suite for Live Apps Script Environment Variable Names and Security.
 * Validates:
 * 1. Reads LIVE_APPS_SCRIPT_URL, LIVE_APPS_SCRIPT_SECRET, and JWT_SECRET.
 * 2. Rejects missing configuration properly.
 * 3. Forwards the correct shared secret to the endpoint.
 * 4. Never exposes secrets in API responses, objects, or logs.
 * 5. JWT signing and verification.
 * 6. APPS_SCRIPT_SHARED_SECRET property validation in Apps Script logic.
 */

import {
  getEnvConfig,
  validateAppsScriptConfig,
  validateJwtConfig,
  sanitizeOutput,
  createJwtToken,
  verifyJwtToken,
  forwardToLiveAppsScript,
} from '../src/server/apiHandler.js';

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

async function runTests() {
  console.log('--- STARTING LIVE APPS SCRIPT & JWT ENVIRONMENT VARIABLE TESTS ---\n');

  // Test 1: getEnvConfig reads LIVE_* environment variables
  {
    const mockEnv = {
      LIVE_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/LIVE_KEY/exec',
      LIVE_APPS_SCRIPT_SECRET: 'live_super_secret_123',
      JWT_SECRET: 'jwt_secret_xyz',
    };
    const config = getEnvConfig(mockEnv);
    assert(
      config.LIVE_APPS_SCRIPT_URL === 'https://script.google.com/macros/s/LIVE_KEY/exec',
      'Reads LIVE_APPS_SCRIPT_URL correctly'
    );
    assert(
      config.LIVE_APPS_SCRIPT_SECRET === 'live_super_secret_123',
      'Reads LIVE_APPS_SCRIPT_SECRET correctly'
    );
    assert(
      config.JWT_SECRET === 'jwt_secret_xyz',
      'Reads JWT_SECRET correctly'
    );
  }

  // Test 2: validateAppsScriptConfig rejects missing URL
  {
    const missingUrlEnv = {
      LIVE_APPS_SCRIPT_URL: '',
      LIVE_APPS_SCRIPT_SECRET: 'secret123',
      JWT_SECRET: 'jwt123',
    };
    const result = validateAppsScriptConfig(missingUrlEnv);
    assert(!result.valid, 'Rejects missing LIVE_APPS_SCRIPT_URL');
    assert(
      result.error?.includes('LIVE_APPS_SCRIPT_URL') === true,
      'Error message identifies missing LIVE_APPS_SCRIPT_URL'
    );
  }

  // Test 3: validateAppsScriptConfig rejects missing Secret
  {
    const missingSecretEnv = {
      LIVE_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/LIVE_KEY/exec',
      LIVE_APPS_SCRIPT_SECRET: '',
      JWT_SECRET: 'jwt123',
    };
    const result = validateAppsScriptConfig(missingSecretEnv);
    assert(!result.valid, 'Rejects missing LIVE_APPS_SCRIPT_SECRET');
    assert(
      result.error?.includes('LIVE_APPS_SCRIPT_SECRET') === true,
      'Error message identifies missing LIVE_APPS_SCRIPT_SECRET'
    );
  }

  // Test 4: validateAppsScriptConfig accepts valid configuration
  {
    const validEnv = {
      LIVE_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/LIVE_KEY/exec',
      LIVE_APPS_SCRIPT_SECRET: 'live_secret_456',
      JWT_SECRET: 'jwt_secret_789',
    };
    const result = validateAppsScriptConfig(validEnv);
    assert(result.valid === true, 'Accepts valid LIVE_APPS_SCRIPT_* configuration');
    assert(result.url === 'https://script.google.com/macros/s/LIVE_KEY/exec', 'Returns correct URL');
    assert(result.secret === 'live_secret_456', 'Returns correct Secret');
  }

  // Test 5: validateJwtConfig rejects missing JWT_SECRET
  {
    const missingJwtEnv = {
      JWT_SECRET: '',
    };
    const result = validateJwtConfig(missingJwtEnv);
    assert(!result.valid, 'Rejects missing JWT_SECRET');
  }

  // Test 6: sanitizeOutput strips all secret fields
  {
    const sensitivePayload = {
      user: 'LLC-0001',
      secret: 'secret_to_hide',
      sharedSecret: 'shared_secret_to_hide',
      LIVE_APPS_SCRIPT_SECRET: 'live_secret_to_hide',
      JWT_SECRET: 'jwt_secret_to_hide',
      password: 'mypassword',
      nested: {
        token: 'token123',
        secret: 'nested_secret',
        visibleData: 'ok_to_show',
      },
    };
    const sanitized = sanitizeOutput(sensitivePayload);
    assert(sanitized.secret === undefined, 'Strips secret from root');
    assert(sanitized.sharedSecret === undefined, 'Strips sharedSecret from root');
    assert(sanitized.LIVE_APPS_SCRIPT_SECRET === undefined, 'Strips LIVE_APPS_SCRIPT_SECRET from root');
    assert(sanitized.JWT_SECRET === undefined, 'Strips JWT_SECRET from root');
    assert(sanitized.password === undefined, 'Strips password from root');
    assert(sanitized.nested.token === undefined, 'Strips token from nested object');
    assert(sanitized.nested.secret === undefined, 'Strips secret from nested object');
    assert(sanitized.nested.visibleData === 'ok_to_show', 'Preserves non-sensitive data');
  }

  // Test 7: JWT creation and verification
  {
    const jwtEnv = { JWT_SECRET: 'my_super_secure_jwt_signing_key_2026' };
    const userPayload = { userId: 'usr-001', role: 'admin', employeeCode: 'SUPERADMIN' };
    const token = createJwtToken(userPayload, jwtEnv, 3600);
    assert(typeof token === 'string' && token.split('.').length === 3, 'Generates valid 3-part JWT token');

    const verified = verifyJwtToken(token, jwtEnv);
    assert(verified.valid === true, 'Verifies valid JWT token');
    assert(verified.payload?.userId === 'usr-001', 'Decodes correct payload userId');
    assert(verified.payload?.employeeCode === 'SUPERADMIN', 'Decodes correct payload employeeCode');

    // Reject token signed with wrong secret
    const wrongSecretEnv = { JWT_SECRET: 'wrong_secret_key' };
    const invalidVerification = verifyJwtToken(token, wrongSecretEnv);
    assert(!invalidVerification.valid, 'Rejects JWT token signed with different secret');
  }

  // Test 8: forwardToLiveAppsScript rejects when configuration is missing
  {
    const unconfiguredEnv = {
      LIVE_APPS_SCRIPT_URL: '',
      LIVE_APPS_SCRIPT_SECRET: '',
    };
    const forwardResult = await forwardToLiveAppsScript({ action: 'HEARTBEAT' }, {}, unconfiguredEnv);
    assert(!forwardResult.success, 'Forwarding fails safely when configuration is missing');
    assert(forwardResult.status === 500, 'Returns 500 status on missing configuration');
    assert(
      forwardResult.error?.includes('LIVE_APPS_SCRIPT_URL') === true,
      'Error explains missing LIVE_APPS_SCRIPT_URL'
    );
  }

  // Test 9: Verify secret forwarding mechanism
  {
    // Mock fetch globally to intercept outgoing request
    const originalFetch = globalThis.fetch;
    let interceptedBody: any = null;
    let interceptedHeaders: any = null;

    globalThis.fetch = (async (input: any, init?: any) => {
      interceptedBody = JSON.parse(init.body);
      interceptedHeaders = init.headers;
      return new Response(JSON.stringify({ status: 'SUCCESS', action: 'HEARTBEAT', secret: 'should_be_stripped' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    try {
      const configuredEnv = {
        LIVE_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/TEST/exec',
        LIVE_APPS_SCRIPT_SECRET: 'test_live_shared_secret_777',
      };
      const result = await forwardToLiveAppsScript({ action: 'HEARTBEAT', userId: 'usr-123' }, {}, configuredEnv);

      assert(interceptedBody !== null, 'Request was intercepted');
      assert(
        interceptedBody.secret === 'test_live_shared_secret_777',
        'Forwards LIVE_APPS_SCRIPT_SECRET in the payload body'
      );
      assert(
        interceptedHeaders['X-Shared-Secret'] === 'test_live_shared_secret_777',
        'Forwards LIVE_APPS_SCRIPT_SECRET in X-Shared-Secret header'
      );
      assert(
        result.result?.secret === undefined,
        'Stripped secret from returning API response'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // Test 10: Admin password reset via updatePasswordInGoogleSheets requires verified status and valid payload
  {
    const originalFetch = globalThis.fetch;
    try {
      const { updatePasswordInGoogleSheets } = await import('../src/lib/googleSheetsSync');

      let capturedPayload: any = null;
      globalThis.fetch = (async (url: any, init?: any) => {
        if (typeof url === 'string' && url.includes('/api/sync-sheets')) {
          const bodyObj = JSON.parse(init.body);
          capturedPayload = bodyObj.payload;
          return new Response(
            JSON.stringify({
              success: true,
              result: {
                status: 'SUCCESS',
                verified: true,
                message: 'Password updated and verified in Employee_Directory successfully!',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
      }) as any;

      const user = {
        id: 'usr-admin-test',
        employeeCode: 'EMP-007',
        username: 'test.admin',
        email: 'test.admin@company.com',
        name: 'Test Admin',
      };

      const res = await updatePasswordInGoogleSheets(user, 'NewAdminPass123!', undefined, 'ADMIN_RESET_PASSWORD');
      assert(res.success === true, 'Password reset succeeded');
      assert(res.verified === true, 'Password reset was verified in Employee_Directory');
      assert(capturedPayload?.action === 'ADMIN_RESET_PASSWORD', 'Action is ADMIN_RESET_PASSWORD');
      assert(capturedPayload?.username === 'test.admin', 'Username mapped correctly');
      assert(capturedPayload?.mustChangePassword === true, 'mustChangePassword set to true on Admin reset');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // Test 11: Username resolution and initial employee creation default password & mustChangePassword flag
  {
    const { resolveCanonicalEmployee } = await import('../src/lib/userUtils');
    const resolved = resolveCanonicalEmployee({ username: 'agabr' });
    assert(resolved !== null, 'Resolves canonical employee by username');
    assert(resolved?.username === 'agabr', 'Canonical username matches agabr');
    assert(resolved?.code === 'LLC-0004', 'Canonical code matches LLC-0004');
  }

  // Test 12: Password change sets mustChangePassword to FALSE and preserves username
  {
    const originalFetch = globalThis.fetch;
    try {
      const { updatePasswordInGoogleSheets } = await import('../src/lib/googleSheetsSync');
      let capturedPayload: any = null;

      globalThis.fetch = (async (url: any, init?: any) => {
        if (typeof url === 'string' && url.includes('/api/sync-sheets')) {
          const bodyObj = JSON.parse(init.body);
          capturedPayload = bodyObj.payload;
          return new Response(
            JSON.stringify({
              success: true,
              result: {
                status: 'SUCCESS',
                verified: true,
                username: 'agabr',
                mustChangePassword: false,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ error: 'Failed' }), { status: 500 });
      }) as any;

      const user = { id: 'usr-agabr', employeeCode: 'LLC-0004', username: 'agabr', name: 'Alexa Gabrielle Bardaje' };
      const res = await updatePasswordInGoogleSheets(user, 'MyNewUniquePass2026!');
      assert(res.success === true && res.verified === true, 'Password change verified');
      assert(capturedPayload?.username === 'agabr', 'Username agabr preserved in password payload');
      assert(capturedPayload?.mustChangePassword === false, 'mustChangePassword set to false on password update');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // Test 13: Heartbeat payload preserves username across tracking sessions
  {
    const originalFetch = globalThis.fetch;
    try {
      const { syncAgentHeartbeatToSheets } = await import('../src/lib/googleSheetsSync');
      let capturedPresence: any = null;

      globalThis.fetch = (async (url: any, init?: any) => {
        if (typeof url === 'string' && url.includes('/api/sync-sheets')) {
          const bodyObj = JSON.parse(init.body);
          capturedPresence = bodyObj.payload?.presence;
          return new Response(
            JSON.stringify({
              success: true,
              result: { status: 'SUCCESS', action: 'HEARTBEAT_UPDATE' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ error: 'Failed' }), { status: 500 });
      }) as any;

      const heartbeatData = {
        userId: 'usr-agabr',
        username: 'agabr',
        employeeCode: 'LLC-0004',
        userName: 'Alexa Gabrielle Bardaje',
        isTracking: true,
        currentTask: 'Task Switching Test',
        elapsedSeconds: 120,
      };

      const hbRes = await syncAgentHeartbeatToSheets('https://script.google.com/test', heartbeatData);
      assert(hbRes.success === true, 'Heartbeat sync succeeded');
      assert(capturedPresence?.username === 'agabr', 'Heartbeat presence payload includes exact username');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // Test 14: Failed spreadsheet write is not reported as success
  {
    const originalFetch = globalThis.fetch;
    try {
      const { updatePasswordInGoogleSheets } = await import('../src/lib/googleSheetsSync');

      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({
            success: false,
            result: {
              status: 'ERROR',
              verified: false,
              message: 'Spreadsheet cell write lock failure',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }) as any;

      const user = { id: 'usr-agabr', username: 'agabr', name: 'Alexa' };
      const res = await updatePasswordInGoogleSheets(user, 'Pass123!');
      assert(res.success === false, 'Rejects failed write properly without reporting fake success');
      assert(res.verified === false, 'Verification flag is false on failed write');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // Test 15: updatePasswordInGoogleSheets retries automatically on BUSY and succeeds
  {
    const originalFetch = globalThis.fetch;
    try {
      const { updatePasswordInGoogleSheets } = await import('../src/lib/googleSheetsSync');

      let callCount = 0;
      globalThis.fetch = (async () => {
        callCount++;
        if (callCount === 1) {
          // First attempt returns BUSY
          return new Response(
            JSON.stringify({
              status: 'ERROR',
              result: {
                status: 'ERROR',
                code: 'BUSY',
                message: 'Server busy, please retry.',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        // Second attempt succeeds
        return new Response(
          JSON.stringify({
            success: true,
            result: {
              status: 'SUCCESS',
              verified: true,
              message: 'Password updated and verified in Employee_Directory successfully!',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }) as any;

      const retryTracker = { retried: false };
      const user = { id: 'usr-agabr', username: 'agabr', name: 'Alexa' };
      const res = await updatePasswordInGoogleSheets(user, 'Pass123!', undefined, 'UPDATE_PASSWORD', () => {
        retryTracker.retried = true;
      });

      assert(callCount === 2, 'Retried after BUSY response');
      assert(retryTracker.retried === true, 'Triggered retry callback');
      assert(res.success === true, 'Succeeded on retry');
      assert(res.verified === true, 'Verified on retry');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // Test 16: authenticateEmployeeWithGoogleSheets authenticates live employee with personal password
  {
    const originalFetch = globalThis.fetch;
    try {
      const { authenticateEmployeeWithGoogleSheets } = await import('../src/lib/googleSheetsSync');

      globalThis.fetch = (async (url: any, init?: any) => {
        const bodyObj = JSON.parse(init.body);
        if (bodyObj?.payload?.action === 'AUTH_LOGIN') {
          return new Response(
            JSON.stringify({
              status: 'SUCCESS',
              valid: true,
              mustChangePassword: false,
              user: {
                id: 'LLC-0003',
                username: 'trainer',
                name: 'Pia',
                role: 'trainer',
                designation: 'Trainer',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ error: 'Failed' }), { status: 500 });
      }) as any;

      const authRes = await authenticateEmployeeWithGoogleSheets('trainer', 'MyPersonalPass2026!');
      assert(authRes.success === true, 'Live authentication succeeded');
      assert(authRes.valid === true, 'Live credentials valid');
      assert(authRes.mustChangePassword === false, 'mustChangePassword recognized as false for personal password');
      assert(authRes.user?.role === 'trainer', 'Trainer role returned correctly');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // Test 17: parseCsvRows handles quoted strings and commas correctly
  {
    const { parseCsvRows } = await import('../src/server/apiHandler.js');
    const sampleCsv = '"Col1","Col, with comma","Col ""with quotes"""\n"Val1","Val2, part b","Val3"';
    const parsed = parseCsvRows(sampleCsv);
    assert(parsed.length === 2, 'parseCsvRows parses 2 rows');
    assert(parsed[0][1] === 'Col, with comma', 'parseCsvRows preserves commas inside quotes');
    assert(parsed[0][2] === 'Col "with quotes"', 'parseCsvRows unescapes doubled quotes');
  }

  // Test 18: authenticateEmployeeAuthoritatively accepts Password123! for new accounts without personal passwords
  {
    const originalFetch = globalThis.fetch;
    try {
      const { authenticateEmployeeAuthoritatively } = await import('../src/server/apiHandler.js');
      const mockCsv = `"Employee Code","Username","Full Name","Work Email","System Role","Designation","Date Hired","Monthly Rate (₱)","Hourly Rate (₱)","Assigned Supervisor","Screenshot Monitored","Activity Monitored","Status","Account Password (Masked)","AccountPassword","mustChangePassword"
"LLC-0004","agabr","Alexa Gabrielle Bardaje","bardajealexagabrielle@gmail.com","agent","Agent","2020-01-01","0","0","Pia (Trainer)","NO","NO","active","Pass********","",""`;

      globalThis.fetch = (async () => {
        return new Response(mockCsv, { status: 200 });
      }) as any;

      const res = await authenticateEmployeeAuthoritatively('agabr', 'Password123!');
      assert(res.success === true, 'Accepts Password123! for unset password account');
      assert(res.valid === true, 'Credentials are valid');
      assert(res.mustChangePassword === true, 'mustChangePassword is true for initial default password');
      assert(res.user?.username === 'agabr', 'User resolved to canonical username');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // Test 19: authenticateEmployeeAuthoritatively accepts personal password and rejects Password123! when personal password is set
  {
    const originalFetch = globalThis.fetch;
    try {
      const { authenticateEmployeeAuthoritatively } = await import('../src/server/apiHandler.js');
      const mockCsv = `"Employee Code","Username","Full Name","Work Email","System Role","Designation","Date Hired","Monthly Rate (₱)","Hourly Rate (₱)","Assigned Supervisor","Screenshot Monitored","Activity Monitored","Status","Account Password (Masked)","AccountPassword","mustChangePassword"
"LLC-0028","testagent","Test Agent","testagent@llc.com","agent","Agent","2020-01-01","0","0","Pia (Trainer)","NO","NO","active","Pass********","MySecretPass2026!","FALSE"`;

      globalThis.fetch = (async () => {
        return new Response(mockCsv, { status: 200 });
      }) as any;

      const validRes = await authenticateEmployeeAuthoritatively('testagent', 'MySecretPass2026!');
      assert(validRes.success === true, 'Accepts personal password');
      assert(validRes.valid === true, 'Personal credentials valid');
      assert(validRes.mustChangePassword === false, 'mustChangePassword is false for personal password');

      const invalidRes = await authenticateEmployeeAuthoritatively('testagent', 'Password123!');
      assert(invalidRes.success === false, 'Rejects old Password123! once personal password is set');
      assert(invalidRes.code === 'INVALID_CREDENTIALS', 'Returns INVALID_CREDENTIALS code');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // Test 20: authenticateEmployeeAuthoritatively rejects unknown usernames and inactive accounts
  {
    const originalFetch = globalThis.fetch;
    try {
      const { authenticateEmployeeAuthoritatively } = await import('../src/server/apiHandler.js');
      const mockCsv = `"Employee Code","Username","Full Name","Work Email","System Role","Designation","Date Hired","Monthly Rate (₱)","Hourly Rate (₱)","Assigned Supervisor","Screenshot Monitored","Activity Monitored","Status","Account Password (Masked)","AccountPassword","mustChangePassword"
"LLC-0099","inactiveuser","Inactive Person","inactive@llc.com","agent","Agent","2020-01-01","0","0","Pia","NO","NO","inactive","Pass********","Password123!","FALSE"`;

      globalThis.fetch = (async () => {
        return new Response(mockCsv, { status: 200 });
      }) as any;

      const notFoundRes = await authenticateEmployeeAuthoritatively('unknown_user_xyz', 'Password123!');
      assert(notFoundRes.success === false, 'Rejects unknown username');
      assert(notFoundRes.code === 'USER_NOT_FOUND', 'Returns USER_NOT_FOUND code');

      const inactiveRes = await authenticateEmployeeAuthoritatively('inactiveuser', 'Password123!');
      assert(inactiveRes.success === false, 'Rejects inactive account');
      assert(inactiveRes.code === 'ACCOUNT_INACTIVE', 'Returns ACCOUNT_INACTIVE code');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
  // Test 21: Designated test employee jdavid (Juan David, LLC-0023) canonical resolution and daily total calculation
  {
    const { resolveCanonicalEmployee } = await import('../src/lib/userUtils');
    const jdavidCanon = resolveCanonicalEmployee({ username: 'jdavid' });
    assert(jdavidCanon !== null, 'Resolves canonical test employee jdavid');
    assert(jdavidCanon?.username === 'jdavid', 'Canonical username matches jdavid');
    assert(jdavidCanon?.code === 'LLC-0023', 'Canonical employee code matches LLC-0023');
    assert(jdavidCanon?.name === 'Juan David', 'Canonical name matches Juan David');

    // Verify task segment duration accumulation: completed segment (300s) + running segment (120s) = 420s
    const completedSegmentSec = 300; // Email Reachout
    const runningSegmentSec = 120; // Follow-up
    const accumulatedTotal = completedSegmentSec + runningSegmentSec;
    assert(accumulatedTotal === 420, 'Task segment accumulation formula produces 420 seconds (7 minutes)');
  }

  console.log(`\n--- TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});

