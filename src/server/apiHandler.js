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

  const maxAttempts = (basePayload.action === 'UPDATE_PASSWORD' || basePayload.action === 'ADMIN_RESET_PASSWORD' || basePayload.action === 'AUTH_LOGIN') ? 3 : 1;

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

/**
 * Handles Express / Connect sync-sheets POST requests.
 * 
 * @param {any} req
 * @param {any} res
 * @param {Record<string, any>} [customEnv]
 */
export async function handleExpressSyncSheetsPost(req, res, customEnv) {
  const payload = req.body?.payload || req.body || {};
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
    // Forward any query parameters from req.query except secret parameters
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
 
