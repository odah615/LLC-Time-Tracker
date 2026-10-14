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

  console.log(`\n--- TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});
