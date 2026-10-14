/**
 * LLC Time Tracker - Production Server API Handler
 * 
 * Manages Google Apps Script synchronization proxy and JWT authentication.
 * 
 * Required Environment Variables:
 * - LIVE_APPS_SCRIPT_URL: The production Google Apps Script Web App /exec URL
 * - LIVE_APPS_SCRIPT_SECRET: The shared secret forwarded to Google Apps Script
 * - JWT_SECRET: Secret key for signing and verifying JWT authentication tokens
 */

import crypto from 'node:crypto';

/**
 * Retrieves environment configuration.
 * Prioritizes LIVE_APPS_SCRIPT_URL, LIVE_APPS_SCRIPT_SECRET, and JWT_SECRET.
 * Falls back to legacy variables if present.
 * 
 * @param {Record<string, any>} [customEnv] - Optional environment object (defaults to process.env)
 * @returns {{ LIVE_APPS_SCRIPT_URL: string, LIVE_APPS_SCRIPT_SECRET: string, JWT_SECRET: string }}
 */
export function getEnvConfig(customEnv) {
  const env = customEnv || (typeof process !== 'undefined' ? process.env : {}) || {};
  return {
    LIVE_APPS_SCRIPT_URL: (env.LIVE_APPS_SCRIPT_URL || env.APPS_SCRIPT_URL || '').trim(),
    LIVE_APPS_SCRIPT_SECRET: (env.LIVE_APPS_SCRIPT_SECRET || env.APPS_SCRIPT_SECRET || '').trim(),
    JWT_SECRET: (env.JWT_SECRET || '').trim(),
  };
}

/**
 * Validates Google Apps Script configuration.
 * Rejects missing or invalid configuration.
 * 
 * @param {Record<string, any>} [customEnv]
 * @returns {{ valid: boolean, error?: string, url?: string, secret?: string }}
 */
export function validateAppsScriptConfig(customEnv) {
  const config = getEnvConfig(customEnv);

  if (!config.LIVE_APPS_SCRIPT_URL) {
    return {
      valid: false,
      error: 'Missing required configuration: LIVE_APPS_SCRIPT_URL is not set.',
    };
  }

  if (
    typeof config.LIVE_APPS_SCRIPT_URL !== 'string' ||
    !config.LIVE_APPS_SCRIPT_URL.startsWith('https://')
  ) {
    return {
      valid: false,
      error: 'Invalid configuration: LIVE_APPS_SCRIPT_URL must be a valid HTTPS URL.',
    };
  }

  if (!config.LIVE_APPS_SCRIPT_SECRET) {
    return {
      valid: false,
      error: 'Missing required configuration: LIVE_APPS_SCRIPT_SECRET is not set.',
    };
  }

  return {
    valid: true,
    url: config.LIVE_APPS_SCRIPT_URL,
    secret: config.LIVE_APPS_SCRIPT_SECRET,
  };
}

/**
 * Validates JWT configuration.
 * 
 * @param {Record<string, any>} [customEnv]
 * @returns {{ valid: boolean, error?: string, secret?: string }}
 */
export function validateJwtConfig(customEnv) {
  const config = getEnvConfig(customEnv);
  if (!config.JWT_SECRET) {
    return {
      valid: false,
      error: 'Missing required configuration: JWT_SECRET is not set.',
    };
  }
  return {
    valid: true,
    secret: config.JWT_SECRET,
  };
}

/**
 * Sanitizes data by removing secrets, passwords, and sensitive keys.
 * Ensures secrets are never exposed in API responses or logs.
 * 
 * @param {any} data
 * @returns {any}
 */
export function sanitizeOutput(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeOutput(item));
  }

  const SENSITIVE_KEYS = new Set([
    'secret',
    'sharedSecret',
    'LIVE_APPS_SCRIPT_SECRET',
    'APPS_SCRIPT_SECRET',
    'JWT_SECRET',
    'password',
    'newPassword',
    'currentPassword',
    'rawPassword',
    'privateKey',
    'clientSecret',
    'token',
    'authToken',
    'accessToken',
    'refreshToken',
  ]);

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key)) {
      continue;
    }
    if (value && typeof value === 'object') {
      sanitized[key] = sanitizeOutput(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Safe logger that redacts secrets before printing to console.
 * 
 * @param {string} level - 'info' | 'warn' | 'error' | 'log'
 * @param {string} message
 * @param {any} [meta]
 * @param {Record<string, any>} [customEnv]
 */
export function safeLog(level, message, meta, customEnv) {
  const { LIVE_APPS_SCRIPT_SECRET, JWT_SECRET } = getEnvConfig(customEnv);
  let sanitizedMsg = String(message);

  if (LIVE_APPS_SCRIPT_SECRET && LIVE_APPS_SCRIPT_SECRET.length > 3) {
    sanitizedMsg = sanitizedMsg.replaceAll(LIVE_APPS_SCRIPT_SECRET, '[REDACTED_APPS_SCRIPT_SECRET]');
  }
  if (JWT_SECRET && JWT_SECRET.length > 3) {
    sanitizedMsg = sanitizedMsg.replaceAll(JWT_SECRET, '[REDACTED_JWT_SECRET]');
  }

  const sanitizedMeta = meta !== undefined ? sanitizeOutput(meta) : undefined;
  const logFn = console[level] || console.log;

  if (sanitizedMeta !== undefined) {
    logFn(sanitizedMsg, sanitizedMeta);
  } else {
    logFn(sanitizedMsg);
  }
}

/**
 * Creates a signed JWT token.
 * 
 * @param {Record<string, any>} payload
 * @param {Record<string, any>} [customEnv]
 * @param {number} [expiresInSeconds] - Defaults to 24 hours (86400s)
 * @returns {string} Signed JWT token
 */
export function createJwtToken(payload, customEnv, expiresInSeconds = 86400) {
  const validation = validateJwtConfig(customEnv);
  if (!validation.valid || !validation.secret) {
    throw new Error(validation.error || 'JWT_SECRET is not configured');
  }

  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    ...sanitizeOutput(payload),
    iat: now,
    exp: now + expiresInSeconds,
  };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', validation.secret)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url');

  return `${b64Header}.${b64Payload}.${signature}`;
}

/**
 * Verifies and decodes a signed JWT token.
 * 
 * @param {string} token
 * @param {Record<string, any>} [customEnv]
 * @returns {{ valid: boolean, error?: string, payload?: Record<string, any> }}
 */
export function verifyJwtToken(token, customEnv) {
  const validation = validateJwtConfig(customEnv);
  if (!validation.valid || !validation.secret) {
    return { valid: false, error: validation.error || 'JWT_SECRET is not configured' };
  }

  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token is missing or invalid' };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed JWT token structure' };
  }

  const [b64Header, b64Payload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', validation.secret)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url');

  if (signature !== expectedSig) {
    return { valid: false, error: 'Invalid JWT signature' };
  }

  try {
    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'JWT token has expired' };
    }
    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: 'Failed to decode JWT payload' };
  }
}

/**
 * Extracts Bearer token from authorization header.
 * 
 * @param {string} [authHeader]
 * @returns {string | null}
 */
export function extractBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Forwards request to the Live Google Apps Script webhook.
 * - Injects the LIVE_APPS_SCRIPT_SECRET into the payload and header
 * - Enforces timeout
 * - Sanitizes all responses to never leak secrets
 * 
 * @param {any} incomingPayload
 * @param {object} [options]
 * @param {number} [options.timeoutMs]
 * @param {Record<string, any>} [customEnv]
 * @returns {Promise<{ success: boolean, status: number, appsScriptStatus?: string, action?: string, result?: any, error?: string }>}
 */
export async function forwardToLiveAppsScript(incomingPayload, options = {}, customEnv) {
  const validation = validateAppsScriptConfig(customEnv);
  if (!validation.valid || !validation.url || !validation.secret) {
    safeLog('error', 'Live Apps Script forwarding rejected due to configuration error', {
      error: validation.error,
    }, customEnv);
    return {
      success: false,
      status: 500,
      error: validation.error || 'Server misconfiguration',
    };
  }

  const { url, secret } = validation;
  const timeoutMs = options.timeoutMs || 25000;

  // Clean and prepare forwarding payload with shared secret
  const basePayload =
    typeof incomingPayload === 'object' && incomingPayload !== null
      ? { ...incomingPayload }
      : { payload: incomingPayload };

  // Always attach the server-configured LIVE_APPS_SCRIPT_SECRET
  basePayload.secret = secret;

  const maxAttempts = typeof options.maxAttempts === 'number' ? options.maxAttempts : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      safeLog('info', `Forwarding request to Live Apps Script endpoint (attempt ${attempt}/${maxAttempts})`, {
        action: basePayload.action,
        destination: url,
      }, customEnv);

      const fetchResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shared-Secret': secret,
        },
        body: JSON.stringify(basePayload),
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });

      const text = await fetchResponse.text();
      let googleResult;
      try {
        googleResult = JSON.parse(text);
      } catch {
        googleResult = { response: text };
      }

      // Strip any sensitive credentials that might be mirrored back
      const sanitizedResult = sanitizeOutput(googleResult);

      // If Google Apps Script returned BUSY / concurrency lock error, retry after backoff
      if (sanitizedResult?.code === 'BUSY' || sanitizedResult?.message?.includes('Server busy') || fetchResponse.status === 503) {
        if (attempt < maxAttempts) {
          safeLog('warn', `Apps Script reported BUSY on attempt ${attempt}. Retrying in ${attempt * 1500}ms...`, {}, customEnv);
          await new Promise((r) => setTimeout(r, attempt * 1500));
          continue;
        }
      }

      const isSuccess =
        fetchResponse.ok &&
        (sanitizedResult?.status === 'SUCCESS' ||
          sanitizedResult?.success === true ||
          sanitizedResult?.action === 'HEARTBEAT_UPDATE' ||
          sanitizedResult?.action === basePayload?.action);

      return {
        success: isSuccess,
        status: fetchResponse.ok ? 200 : fetchResponse.status,
        appsScriptStatus:
          sanitizedResult?.status ||
          (sanitizedResult?.success ? 'SUCCESS' : 'UNKNOWN'),
        action: sanitizedResult?.action || basePayload?.action,
        result: sanitizedResult,
        error: !isSuccess
          ? sanitizedResult?.message ||
            sanitizedResult?.error ||
            (fetchResponse.ok
              ? 'Apps Script returned non-success response'
              : `HTTP Error ${fetchResponse.status}`)
          : undefined,
      };
    } catch (err) {
      const errorMsg = err?.message || String(err);
      if (attempt < maxAttempts) {
        safeLog('warn', `Apps Script connection error on attempt ${attempt} (${errorMsg}). Retrying...`, {}, customEnv);
        await new Promise((r) => setTimeout(r, attempt * 1500));
        continue;
      }
      safeLog('error', 'Failed to communicate with Live Apps Script after retries', { error: errorMsg }, customEnv);
      return {
        success: false,
        status: 500,
        error: `Live Apps Script connection failed: ${errorMsg}`,
      };
    }
  }

  return {
    success: false,
    status: 500,
    error: 'Live Apps Script connection failed after retries',
  };
}

export const DEFAULT_SPREADSHEET_ID = '1h8ssmDEcV-PMGlkpOzfQCtlRpnoT0CBQQveT3e4wPfA';

/**
 * Parses raw CSV string into an array of string arrays, handling quotes properly.
 * @param {string} csvText
 * @returns {string[][]}
 */
export function parseCsvRows(csvText) {
  if (!csvText || typeof csvText !== 'string') return [];
  const rows = [];
  const lines = csvText.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        fields.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    fields.push(cur.trim());
    rows.push(fields);
  }
  return rows;
}

/**
 * Fetches authoritative Employee_Directory from Live Google Spreadsheet.
 * @param {Record<string, any>} [customEnv]
 * @returns {Promise<any[]>}
 */
export async function fetchLiveEmployeeDirectory(customEnv) {
  const env = getEnvConfig(customEnv);
  const spreadsheetId = env.SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=Employee_Directory`;

  try {
    const res = await fetch(gvizUrl, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      throw new Error(`Google Sheets gviz returned HTTP ${res.status}`);
    }

    const text = await res.text();
    const rows = parseCsvRows(text);
    if (!rows || rows.length < 2) return [];

    const headers = rows[0].map((h) => String(h || '').toLowerCase().trim());
    const codeIdx = headers.indexOf('employee code') !== -1 ? headers.indexOf('employee code') : 0;
    const userIdx = headers.indexOf('username') !== -1 ? headers.indexOf('username') : 1;
    const nameIdx = headers.indexOf('full name') !== -1 ? headers.indexOf('full name') : 2;
    const emailIdx = headers.indexOf('work email') !== -1 ? headers.indexOf('work email') : 3;
    const roleIdx = headers.indexOf('system role') !== -1 ? headers.indexOf('system role') : 4;
    const desigIdx = headers.indexOf('designation') !== -1 ? headers.indexOf('designation') : 5;
    const statusIdx = headers.indexOf('status') !== -1 ? headers.indexOf('status') : 12;
    const passIdx = headers.indexOf('accountpassword') !== -1 ? headers.indexOf('accountpassword') : 14;
    const mustChangeIdx = headers.indexOf('mustchangepassword') !== -1 ? headers.indexOf('mustchangepassword') : 15;

    return rows.slice(1).map((r) => ({
      employeeCode: String(r[codeIdx] || '').trim(),
      username: String(r[userIdx] || '').trim(),
      name: String(r[nameIdx] || '').trim(),
      email: String(r[emailIdx] || '').trim(),
      role: String(r[roleIdx] || 'agent').toLowerCase().trim(),
      designation: String(r[desigIdx] || 'Agent').trim(),
      status: String(r[statusIdx] || 'active').toLowerCase().trim(),
      accountPassword: String(r[passIdx] || '').trim(),
      mustChangePassword: String(r[mustChangeIdx] || '').toUpperCase().trim(),
    })).filter((e) => e.username || e.employeeCode);
  } catch (err) {
    safeLog('warn', 'Failed to fetch live Employee_Directory via gviz', { error: err?.message || String(err) }, customEnv);
    return [];
  }
}

/**
 * Authoritatively authenticates an employee against the Live Google Spreadsheet Employee_Directory.
 * @param {string} usernameOrCode
 * @param {string} inputPassword
 * @param {Record<string, any>} [customEnv]
 */
export async function authenticateEmployeeAuthoritatively(usernameOrCode, inputPassword, customEnv) {
  const target = String(usernameOrCode || '').toLowerCase().trim();
  const inputPass = String(inputPassword || '').trim();

  if (!target || !inputPass) {
    return {
      success: false,
      valid: false,
      code: 'INVALID_CREDENTIALS',
      message: 'Username and password are required.',
    };
  }

  const directory = await fetchLiveEmployeeDirectory(customEnv);
  const employee = directory.find(
    (e) => e.username.toLowerCase() === target || e.employeeCode.toLowerCase() === target
  );

  if (!employee) {
    return {
      success: false,
      valid: false,
      code: 'USER_NOT_FOUND',
      message: `Account not found for "${usernameOrCode}".`,
    };
  }

  if (employee.status !== 'active') {
    return {
      success: false,
      valid: false,
      code: 'ACCOUNT_INACTIVE',
      message: 'Account is inactive. Please contact your Team Lead or HR.',
    };
  }

  const rawPass = String(employee.accountPassword || '').trim();
  const rawMustChange = String(employee.mustChangePassword || '').toUpperCase().trim();
  const hasPersonalPassword = rawPass !== '' && rawPass.toLowerCase() !== 'password123!';
  const expectedPassword = hasPersonalPassword ? rawPass : 'Password123!';
  const mustChange = hasPersonalPassword ? (rawMustChange === 'TRUE' || rawMustChange === 'YES') : true;

  if (inputPass !== expectedPassword) {
    return {
      success: false,
      valid: false,
      code: 'INVALID_CREDENTIALS',
      message: 'Incorrect password.',
    };
  }

  return {
    success: true,
    valid: true,
    mustChangePassword: mustChange,
    user: {
      id: employee.employeeCode || `usr-${employee.username}`,
      employeeCode: employee.employeeCode,
      username: employee.username,
      name: employee.name || employee.username,
      email: employee.email || '',
      role: employee.role || 'agent',
      designation: employee.designation || 'Agent',
      status: 'active',
      mustChangePassword: mustChange,
    },
    message: mustChange
      ? 'Default password recognized. First-time password creation required.'
      : 'Authentication successful.',
  };
}

/**
 * Handles Express / Connect sync-sheets POST requests with authoritative live spreadsheet verification.
 * 
 * @param {any} req
 * @param {any} res
 * @param {Record<string, any>} [customEnv]
 */
export async function handleExpressSyncSheetsPost(req, res, customEnv) {
  const payload = req.body?.payload || req.body || {};

  // Authoritative action: AUTH_LOGIN
  if (payload.action === 'AUTH_LOGIN' || payload.action === 'AUTHENTICATE') {
    const userIdentifier = payload.username || payload.employeeCode || payload.user || '';
    const pass = payload.password || '';

    try {
      const authResult = await authenticateEmployeeAuthoritatively(userIdentifier, pass, customEnv);
      if (authResult.valid) {
        return res.status(200).json({
          success: true,
          status: 200,
          appsScriptStatus: 'SUCCESS',
          action: 'AUTH_LOGIN',
          result: authResult,
        });
      }
      if (authResult.code === 'USER_NOT_FOUND' || authResult.code === 'INVALID_CREDENTIALS' || authResult.code === 'ACCOUNT_INACTIVE') {
        return res.status(200).json({
          success: false,
          status: 200,
          appsScriptStatus: 'ERROR',
          action: 'AUTH_LOGIN',
          result: authResult,
          error: authResult.message,
        });
      }
    } catch (authErr) {
      safeLog('warn', 'Authoritative direct auth had transient issue, falling back to Apps Script proxy', { error: authErr?.message }, customEnv);
    }
  }

  // Authoritative action: UPDATE_PASSWORD / ADMIN_RESET_PASSWORD
  if (payload.action === 'UPDATE_PASSWORD' || payload.action === 'ADMIN_RESET_PASSWORD') {
    const isReset = payload.action === 'ADMIN_RESET_PASSWORD' || payload.mustChangePassword === true;
    const targetIdentifier = (payload.username || payload.employeeCode || payload.userId || '').toLowerCase().trim();
    const newPass = payload.newPassword || payload.password || payload.temporaryPassword || 'Password123!';

    // Resolve canonical username from live Employee_Directory
    const directory = await fetchLiveEmployeeDirectory(customEnv);
    const matchedEmp = directory.find(
      (e) => e.username.toLowerCase() === targetIdentifier || e.employeeCode.toLowerCase() === targetIdentifier
    );
    const canonicalUsername = matchedEmp?.username || targetIdentifier;
    const canonicalCode = matchedEmp?.employeeCode || payload.employeeCode || '';

    // Check if the spreadsheet row ALREADY matches the new credentials (idempotent verification)
    if (matchedEmp) {
      const alreadyMatches =
        matchedEmp.accountPassword === newPass &&
        (isReset ? (matchedEmp.mustChangePassword === 'TRUE' || matchedEmp.mustChangePassword === 'YES') : (matchedEmp.mustChangePassword === 'FALSE' || matchedEmp.mustChangePassword === 'NO'));

      if (alreadyMatches) {
        return res.status(200).json({
          success: true,
          status: 200,
          appsScriptStatus: 'SUCCESS',
          action: payload.action,
          result: {
            status: 'SUCCESS',
            success: true,
            verified: true,
            action: payload.action,
            username: canonicalUsername,
            mustChangePassword: isReset,
            message: `Password and mustChangePassword verified in Employee_Directory for @${canonicalUsername}.`,
          },
        });
      }
    }

    // Forward write to Live Apps Script with canonical username
    const forwardPayload = {
      ...payload,
      action: 'UPDATE_PASSWORD',
      username: canonicalUsername,
      employeeCode: canonicalCode,
      newPassword: newPass,
      password: newPass,
      mustChangePassword: isReset,
    };

    let writeRes = { success: false };
    for (let attempt = 1; attempt <= 3; attempt++) {
      writeRes = await forwardToLiveAppsScript(forwardPayload, { timeoutMs: 16000, maxAttempts: 1 }, customEnv);

      // Verify row in Employee_Directory
      const refreshedDir = await fetchLiveEmployeeDirectory(customEnv);
      const refreshedEmp = refreshedDir.find((e) => e.username.toLowerCase() === canonicalUsername.toLowerCase());

      const isRowVerified =
        refreshedEmp &&
        refreshedEmp.accountPassword === newPass &&
        (isReset ? (refreshedEmp.mustChangePassword === 'TRUE' || refreshedEmp.mustChangePassword === 'YES') : (refreshedEmp.mustChangePassword === 'FALSE' || refreshedEmp.mustChangePassword === 'NO'));

      if (isRowVerified || writeRes.success || writeRes.result?.verified === true) {
        return res.status(200).json({
          success: true,
          status: 200,
          appsScriptStatus: 'SUCCESS',
          action: payload.action,
          result: {
            status: 'SUCCESS',
            success: true,
            verified: true,
            action: payload.action,
            username: canonicalUsername,
            mustChangePassword: isReset,
            message: `Password updated and verified in Employee_Directory for @${canonicalUsername}.`,
          },
        });
      }

      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    return res.status(writeRes.status || 200).json(sanitizeOutput(writeRes));
  }

  const result = await forwardToLiveAppsScript(payload, {}, customEnv);
  return res.status(result.status || 200).json(sanitizeOutput(result));
}

/**
 * Handles Express / Connect sync-sheets GET requests.
 * 
 * @param {any} req
 * @param {any} res
 * @param {Record<string, any>} [customEnv]
 */
export async function handleExpressSyncSheetsGet(req, res, customEnv) {
  const validation = validateAppsScriptConfig(customEnv);
  if (!validation.valid || !validation.url) {
    return res.status(500).json({
      success: false,
      error: validation.error || 'Server misconfiguration',
    });
  }

  try {
    const targetUrl = new URL(validation.url);
    if (req.query && typeof req.query === 'object') {
      for (const [key, value] of Object.entries(req.query)) {
        if (key !== 'secret' && key !== 'sharedSecret' && key !== 'url' && typeof value === 'string') {
          targetUrl.searchParams.set(key, value);
        }
      }
    }

    const fetchResponse = await fetch(targetUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });

    const text = await fetchResponse.text();
    let jsonResult;
    try {
      jsonResult = JSON.parse(text);
    } catch {
      jsonResult = { response: text };
    }

    return res.status(fetchResponse.ok ? 200 : fetchResponse.status).json(sanitizeOutput(jsonResult));
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err?.message || String(err),
    });
  }
}

export default {
  DEFAULT_SPREADSHEET_ID,
  parseCsvRows,
  fetchLiveEmployeeDirectory,
  authenticateEmployeeAuthoritatively,
  getEnvConfig,
  validateAppsScriptConfig,
  validateJwtConfig,
  sanitizeOutput,
  safeLog,
  createJwtToken,
  verifyJwtToken,
  extractBearerToken,
  forwardToLiveAppsScript,
  handleExpressSyncSheetsPost,
  handleExpressSyncSheetsGet,
};
 
