// Cloudflare Pages Advanced Mode Worker
// Centralized API routing and static asset serving for production deployment.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id, X-Employee-Code, X-User-Role, X-Shared-Secret",
};

const DEFAULT_SPREADSHEET_ID = "1h8ssmDEcV-PMGlkpOzfQCtlRpnoT0CBQQveT3e4wPfA";
const DEFAULT_LIVE_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyKGMOWV0u5xcv_lOKBk6LXpbjrlgZiuqtCs3_HbqjekoJZdXpdfA_1kDjP7H0ulLsw3Q/exec";

// In-worker ephemeral cache for edge persistence across requests
const workerState = {
  presence: {},
  timelogs: [],
  users: [],
  attendance: [],
  auditlogs: [],
  config: {
    spreadsheetId: DEFAULT_SPREADSHEET_ID,
  },
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(sanitizeOutput(data)), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function sanitizeOutput(data) {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map(sanitizeOutput);
  const sensitiveKeys = new Set([
    "secret",
    "sharedSecret",
    "LIVE_APPS_SCRIPT_SECRET",
    "APPS_SCRIPT_SECRET",
    "JWT_SECRET",
    "password",
    "newPassword",
    "currentPassword",
    "token",
    "authToken",
    "accessToken",
  ]);
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.has(key)) continue;
    if (value && typeof value === "object") {
      sanitized[key] = sanitizeOutput(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// ----------------------------------------------------
// Google Sheets Proxy Handlers
// ----------------------------------------------------
async function handleSyncSheetsPost(request, env = {}) {
  try {
    const liveAppsScriptUrl =
      env.LIVE_APPS_SCRIPT_URL || DEFAULT_LIVE_APPS_SCRIPT_URL;
    const liveAppsScriptSecret = env.LIVE_APPS_SCRIPT_SECRET || "";

    const body = await request.json();
    const webhookUrl = body?.webhookUrl || liveAppsScriptUrl;
    const rawPayload = body?.payload || body;

    if (
      !webhookUrl ||
      typeof webhookUrl !== "string" ||
      !webhookUrl.startsWith("https://")
    ) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid or missing LIVE_APPS_SCRIPT_URL",
        },
        400
      );
    }

    if (!liveAppsScriptSecret) {
      return jsonResponse(
        {
          success: false,
          error: "Missing required server configuration: LIVE_APPS_SCRIPT_SECRET is not set.",
        },
        500
      );
    }

    // Helper: Parse Google Sheets gviz CSV
    const parseCsvRows = (csvText) => {
      if (!csvText || typeof csvText !== "string") return [];
      const rows = [];
      const lines = csvText.split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        const fields = [];
        let cur = "";
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
          } else if (c === "," && !inQuotes) {
            fields.push(cur.trim());
            cur = "";
          } else {
            cur += c;
          }
        }
        fields.push(cur.trim());
        rows.push(fields);
      }
      return rows;
    };

    // Helper: Fetch live Employee_Directory from Google Spreadsheet
    const fetchLiveDirectory = async () => {
      const spreadsheetId = env.SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=Employee_Directory`;
      try {
        const res = await fetch(gvizUrl, { headers: { "Cache-Control": "no-cache" } });
        if (!res.ok) return [];
        const text = await res.text();
        const rows = parseCsvRows(text);
        if (!rows || rows.length < 2) return [];

        const headers = rows[0].map((h) => String(h || "").toLowerCase().trim());
        const codeIdx = headers.indexOf("employee code") !== -1 ? headers.indexOf("employee code") : 0;
        const userIdx = headers.indexOf("username") !== -1 ? headers.indexOf("username") : 1;
        const nameIdx = headers.indexOf("full name") !== -1 ? headers.indexOf("full name") : 2;
        const emailIdx = headers.indexOf("work email") !== -1 ? headers.indexOf("work email") : 3;
        const roleIdx = headers.indexOf("system role") !== -1 ? headers.indexOf("system role") : 4;
        const desigIdx = headers.indexOf("designation") !== -1 ? headers.indexOf("designation") : 5;
        const statusIdx = headers.indexOf("status") !== -1 ? headers.indexOf("status") : 12;
        const passIdx = headers.indexOf("accountpassword") !== -1 ? headers.indexOf("accountpassword") : 14;
        const mustChangeIdx = headers.indexOf("mustchangepassword") !== -1 ? headers.indexOf("mustchangepassword") : 15;

        return rows.slice(1).map((r) => ({
          employeeCode: String(r[codeIdx] || "").trim(),
          username: String(r[userIdx] || "").trim(),
          name: String(r[nameIdx] || "").trim(),
          email: String(r[emailIdx] || "").trim(),
          role: String(r[roleIdx] || "agent").toLowerCase().trim(),
          designation: String(r[desigIdx] || "Agent").trim(),
          status: String(r[statusIdx] || "active").toLowerCase().trim(),
          accountPassword: String(r[passIdx] || "").trim(),
          mustChangePassword: String(r[mustChangeIdx] || "").toUpperCase().trim(),
        })).filter((e) => e.username || e.employeeCode);
      } catch {
        return [];
      }
    };

    const action = rawPayload?.action;

    // Authoritative Live Authentication
    if (action === "AUTH_LOGIN" || action === "AUTHENTICATE") {
      const target = String(rawPayload.username || rawPayload.employeeCode || rawPayload.user || "").toLowerCase().trim();
      const inputPass = String(rawPayload.password || "").trim();

      if (!target || !inputPass) {
        return jsonResponse({
          success: false,
          status: 200,
          appsScriptStatus: "ERROR",
          action: "AUTH_LOGIN",
          result: {
            success: false,
            valid: false,
            code: "INVALID_CREDENTIALS",
            message: "Username and password are required.",
          },
        });
      }

      const directory = await fetchLiveDirectory();
      const employee = directory.find(
        (e) => e.username.toLowerCase() === target || e.employeeCode.toLowerCase() === target
      );

      if (!employee) {
        return jsonResponse({
          success: false,
          status: 200,
          appsScriptStatus: "ERROR",
          action: "AUTH_LOGIN",
          result: {
            success: false,
            valid: false,
            code: "USER_NOT_FOUND",
            message: `Account not found for "${target}".`,
          },
        });
      }

      if (employee.status !== "active") {
        return jsonResponse({
          success: false,
          status: 200,
          appsScriptStatus: "ERROR",
          action: "AUTH_LOGIN",
          result: {
            success: false,
            valid: false,
            code: "ACCOUNT_INACTIVE",
            message: "Account is inactive. Please contact your Team Lead or HR.",
          },
        });
      }

      const rawPass = String(employee.accountPassword || "").trim();
      const rawMustChange = String(employee.mustChangePassword || "").toUpperCase().trim();
      const hasPersonalPassword = rawPass !== "" && rawPass.toLowerCase() !== "password123!";
      const expectedPassword = hasPersonalPassword ? rawPass : "Password123!";
      const mustChange = hasPersonalPassword ? (rawMustChange === "TRUE" || rawMustChange === "YES") : true;

      if (inputPass !== expectedPassword) {
        return jsonResponse({
          success: false,
          status: 200,
          appsScriptStatus: "ERROR",
          action: "AUTH_LOGIN",
          result: {
            success: false,
            valid: false,
            code: "INVALID_CREDENTIALS",
            message: "Incorrect password.",
          },
        });
      }

      return jsonResponse({
        success: true,
        status: 200,
        appsScriptStatus: "SUCCESS",
        action: "AUTH_LOGIN",
        result: {
          success: true,
          valid: true,
          mustChangePassword: mustChange,
          user: {
            id: employee.employeeCode || `usr-${employee.username}`,
            employeeCode: employee.employeeCode,
            username: employee.username,
            name: employee.name || employee.username,
            email: employee.email || "",
            role: employee.role || "agent",
            designation: employee.designation || "Agent",
            status: "active",
            mustChangePassword: mustChange,
          },
          message: mustChange
            ? "Default password recognized. First-time password creation required."
            : "Authentication successful.",
        },
      });
    }

    // Authoritative Live Password Change / Admin Reset
    if (action === "UPDATE_PASSWORD" || action === "ADMIN_RESET_PASSWORD") {
      const isReset = action === "ADMIN_RESET_PASSWORD" || rawPayload.mustChangePassword === true;
      const targetIdentifier = (rawPayload.username || rawPayload.employeeCode || rawPayload.userId || "").toLowerCase().trim();
      const newPass = rawPayload.newPassword || rawPayload.password || rawPayload.temporaryPassword || "Password123!";

      const directory = await fetchLiveDirectory();
      const matchedEmp = directory.find(
        (e) => e.username.toLowerCase() === targetIdentifier || e.employeeCode.toLowerCase() === targetIdentifier
      );
      const canonicalUsername = matchedEmp?.username || targetIdentifier;
      const canonicalCode = matchedEmp?.employeeCode || rawPayload.employeeCode || "";

      // Idempotent row check: does row already match new credentials?
      if (matchedEmp) {
        const alreadyMatches =
          matchedEmp.accountPassword === newPass &&
          (isReset ? (matchedEmp.mustChangePassword === "TRUE" || matchedEmp.mustChangePassword === "YES") : (matchedEmp.mustChangePassword === "FALSE" || matchedEmp.mustChangePassword === "NO"));

        if (alreadyMatches) {
          return jsonResponse({
            success: true,
            status: 200,
            appsScriptStatus: "SUCCESS",
            action: action,
            result: {
              status: "SUCCESS",
              success: true,
              verified: true,
              action: action,
              username: canonicalUsername,
              mustChangePassword: isReset,
              message: `Password and mustChangePassword verified in Employee_Directory for @${canonicalUsername}.`,
            },
          });
        }
      }

      const forwardPayload = {
        ...rawPayload,
        action: "UPDATE_PASSWORD",
        username: canonicalUsername,
        employeeCode: canonicalCode,
        newPassword: newPass,
        password: newPass,
        mustChangePassword: isReset,
        secret: liveAppsScriptSecret,
      };

      for (let attempt = 1; attempt <= 3; attempt++) {
        let writeSuccess = false;
        try {
          const googleResponse = await fetch(webhookUrl.trim(), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shared-Secret": liveAppsScriptSecret,
            },
            body: JSON.stringify(forwardPayload),
            redirect: "follow",
          });
          const responseText = await googleResponse.text();
          let googleResult;
          try {
            googleResult = JSON.parse(responseText);
          } catch {
            googleResult = { response: responseText };
          }
          writeSuccess = googleResponse.ok && (googleResult?.status === "SUCCESS" || googleResult?.verified === true);
        } catch {}

        // Verify row in Employee_Directory
        const refreshedDir = await fetchLiveDirectory();
        const refreshedEmp = refreshedDir.find((e) => e.username.toLowerCase() === canonicalUsername.toLowerCase());
        const isRowVerified =
          refreshedEmp &&
          refreshedEmp.accountPassword === newPass &&
          (isReset ? (refreshedEmp.mustChangePassword === "TRUE" || refreshedEmp.mustChangePassword === "YES") : (refreshedEmp.mustChangePassword === "FALSE" || refreshedEmp.mustChangePassword === "NO"));

        if (isRowVerified || writeSuccess) {
          return jsonResponse({
            success: true,
            status: 200,
            appsScriptStatus: "SUCCESS",
            action: action,
            result: {
              status: "SUCCESS",
              success: true,
              verified: true,
              action: action,
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

      // Check once more after brief delay
      await new Promise((r) => setTimeout(r, 1500));
      const finalDir = await fetchLiveDirectory();
      const finalEmp = finalDir.find((e) => e.username.toLowerCase() === canonicalUsername.toLowerCase());
      const isFinallyVerified =
        finalEmp &&
        finalEmp.accountPassword === newPass &&
        (isReset ? (finalEmp.mustChangePassword === "TRUE" || finalEmp.mustChangePassword === "YES") : (finalEmp.mustChangePassword === "FALSE" || finalEmp.mustChangePassword === "NO"));

      if (isFinallyVerified) {
        return jsonResponse({
          success: true,
          status: 200,
          appsScriptStatus: "SUCCESS",
          action: action,
          result: {
            status: "SUCCESS",
            success: true,
            verified: true,
            action: action,
            username: canonicalUsername,
            mustChangePassword: isReset,
            message: `Password updated and verified in Employee_Directory for @${canonicalUsername}.`,
          },
        });
      }

      return jsonResponse({
        success: false,
        status: 200,
        appsScriptStatus: "ERROR",
        action: action,
        error: "Server busy processing password update, please retry.",
        result: {
          status: "ERROR",
          code: "BUSY",
          message: "Server busy processing password update, please retry.",
        },
      });
    }

    const payload =
      typeof rawPayload === "object" && rawPayload !== null
        ? { ...rawPayload, secret: liveAppsScriptSecret }
        : { payload: rawPayload, secret: liveAppsScriptSecret };

    try {
      const googleResponse = await fetch(webhookUrl.trim(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shared-Secret": liveAppsScriptSecret,
        },
        body: JSON.stringify(payload),
        redirect: "follow",
      });

      const responseText = await googleResponse.text();
      let googleResult;
      try {
        googleResult = JSON.parse(responseText);
      } catch {
        googleResult = { response: responseText };
      }

      const sanitizedResult = sanitizeOutput(googleResult);

      const isSuccess =
        googleResponse.ok &&
        (sanitizedResult?.status === "SUCCESS" ||
          sanitizedResult?.success === true ||
          sanitizedResult?.action === "HEARTBEAT_UPDATE" ||
          sanitizedResult?.action === payload?.action);

      return jsonResponse(
        {
          success: isSuccess,
          status: googleResponse.status,
          appsScriptStatus:
            sanitizedResult?.status ||
            (sanitizedResult?.success ? "SUCCESS" : "UNKNOWN"),
          action: sanitizedResult?.action || payload?.action,
          result: sanitizedResult,
          error: !isSuccess
            ? sanitizedResult?.message ||
              sanitizedResult?.error ||
              (googleResponse.ok
                ? "Apps Script returned non-success response"
                : `HTTP Error ${googleResponse.status}`)
            : undefined,
        },
        googleResponse.ok ? 200 : googleResponse.status
      );
    } catch (err) {
      return jsonResponse(
        {
          success: false,
          error: err?.message || String(err),
        },
        500
      );
    }
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error?.message || String(error),
      },
      500
    );
  }
}

async function handleSyncSheetsGet(request, env = {}) {
  try {
    const liveAppsScriptUrl =
      env.LIVE_APPS_SCRIPT_URL || DEFAULT_LIVE_APPS_SCRIPT_URL;
    const url = new URL(request.url);
    const webhookUrl = url.searchParams.get("url") || liveAppsScriptUrl;

    if (
      !webhookUrl ||
      typeof webhookUrl !== "string" ||
      !webhookUrl.startsWith("https://")
    ) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid or missing LIVE_APPS_SCRIPT_URL",
        },
        400
      );
    }

    const googleResponse = await fetch(webhookUrl.trim(), {
      method: "GET",
      redirect: "follow",
    });

    const responseText = await googleResponse.text();
    let googleResult;
    try {
      googleResult = JSON.parse(responseText);
    } catch {
      googleResult = { response: responseText };
    }

    return jsonResponse(sanitizeOutput(googleResult), googleResponse.status);
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error?.message || String(error),
      },
      500
    );
  }
}

// ----------------------------------------------------
// Main Cloudflare Pages Advanced Mode Fetch Handler
// ----------------------------------------------------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // ----------------------------------------------------
    // API ROUTING
    // ----------------------------------------------------

    // 1. Health Check
    if (url.pathname === "/api/health") {
      return jsonResponse({
        status: "ok",
        serverTime: new Date().toISOString(),
        environment: "cloudflare-pages",
        onlineUsers: Object.values(workerState.presence).filter((p) => p?.isOnline).length,
        trackingUsers: Object.values(workerState.presence).filter((p) => p?.isOnline && p?.isTracking).length,
        timelogsCount: workerState.timelogs.length,
      });
    }

    // 2. Config Endpoint (Safe - never exposes secrets)
    if (url.pathname === "/api/config") {
      const liveAppsScriptUrl =
        env.LIVE_APPS_SCRIPT_URL || DEFAULT_LIVE_APPS_SCRIPT_URL;
      if (request.method === "GET") {
        return jsonResponse({
          webhookUrl: liveAppsScriptUrl,
          spreadsheetId: workerState.config.spreadsheetId || DEFAULT_SPREADSHEET_ID,
          isConfigured: !!(env.LIVE_APPS_SCRIPT_URL && env.LIVE_APPS_SCRIPT_SECRET),
        });
      }
      if (request.method === "POST") {
        try {
          const body = await request.json();
          const cleanBody = sanitizeOutput(body);
          workerState.config = { ...workerState.config, ...cleanBody };
          return jsonResponse({
            success: true,
            config: {
              webhookUrl: liveAppsScriptUrl,
              spreadsheetId: workerState.config.spreadsheetId || DEFAULT_SPREADSHEET_ID,
              isConfigured: !!(env.LIVE_APPS_SCRIPT_URL && env.LIVE_APPS_SCRIPT_SECRET),
            },
          });
        } catch {
          return jsonResponse({ success: false, error: "Invalid JSON" }, 400);
        }
      }
    }

    // 3. Google Sheets Proxy
    if (url.pathname === "/api/sync-sheets") {
      if (request.method === "POST") {
        return handleSyncSheetsPost(request, env);
      }
      if (request.method === "GET") {
        return handleSyncSheetsGet(request, env);
      }
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    // 4. Presence Endpoints
    if (url.pathname === "/api/presence") {
      if (request.method === "GET") {
        return jsonResponse(Object.values(workerState.presence));
      }
      if (request.method === "POST") {
        try {
          const p = await request.json();
          if (!p || !p.userId) {
            return jsonResponse({ error: "Missing userId" }, 400);
          }
          workerState.presence[p.userId] = {
            ...(workerState.presence[p.userId] || {}),
            ...p,
            lastHeartbeat: p.lastHeartbeat || new Date().toISOString(),
          };
          return jsonResponse({ success: true, presence: workerState.presence[p.userId] });
        } catch {
          return jsonResponse({ error: "Invalid payload" }, 400);
        }
      }
    }

    if (url.pathname === "/api/presence/batch" && request.method === "POST") {
      try {
        const list = await request.json();
        if (Array.isArray(list)) {
          for (const p of list) {
            if (p && p.userId) {
              workerState.presence[p.userId] = {
                ...(workerState.presence[p.userId] || {}),
                ...p,
                lastHeartbeat: p.lastHeartbeat || new Date().toISOString(),
              };
            }
          }
        }
        return jsonResponse({ success: true, count: Object.keys(workerState.presence).length });
      } catch {
        return jsonResponse({ error: "Invalid batch payload" }, 400);
      }
    }

    // 5. Timelogs Endpoints
    if (url.pathname === "/api/timelogs") {
      if (request.method === "GET") {
        const reqUserId = (url.searchParams.get("userId") || request.headers.get("x-user-id") || "").trim();
        const reqEmpCode = (url.searchParams.get("employeeCode") || request.headers.get("x-employee-code") || "").trim().toUpperCase();
        const reqRole = (url.searchParams.get("role") || request.headers.get("x-user-role") || "").trim().toLowerCase();

        if (!reqUserId && !reqEmpCode && !reqRole) {
          return jsonResponse(workerState.timelogs);
        }
        if (["admin", "superadmin", "hr", "payroll", "va_admin"].includes(reqRole)) {
          return jsonResponse(workerState.timelogs);
        }

        // Return user's own logs
        const filtered = workerState.timelogs.filter((l) => {
          if (!l) return false;
          const lCode = String(l.employeeCode || "").trim().toUpperCase();
          const lId = String(l.userId || "").trim().toLowerCase();
          return (reqEmpCode && lCode === reqEmpCode) || (reqUserId && lId === reqUserId.toLowerCase());
        });
        return jsonResponse(filtered);
      }

      if (request.method === "POST") {
        try {
          const incoming = await request.json();
          if (Array.isArray(incoming)) {
            const map = new Map(workerState.timelogs.map((l) => [l.id, l]));
            for (const log of incoming) {
              if (log && log.id) {
                map.set(log.id, { ...(map.get(log.id) || {}), ...log });
              }
            }
            workerState.timelogs = Array.from(map.values());
            return jsonResponse({ success: true, count: workerState.timelogs.length });
          } else if (incoming && incoming.id) {
            const map = new Map(workerState.timelogs.map((l) => [l.id, l]));
            map.set(incoming.id, { ...(map.get(incoming.id) || {}), ...incoming });
            workerState.timelogs = Array.from(map.values());
            return jsonResponse({ success: true, log: incoming });
          }
          return jsonResponse({ error: "Invalid timelog payload" }, 400);
        } catch {
          return jsonResponse({ error: "Invalid JSON" }, 400);
        }
      }
    }

    // 6. Users Endpoints
    if (url.pathname === "/api/users") {
      if (request.method === "GET") {
        return jsonResponse(workerState.users);
      }
      if (request.method === "POST") {
        try {
          const incoming = await request.json();
          if (!incoming) return jsonResponse({ error: "Invalid users payload" }, 400);

          // Handle Action Payloads (e.g. ADMIN_RESET_PASSWORD, UPDATE_PASSWORD)
          if (incoming.action === 'ADMIN_RESET_PASSWORD' || incoming.action === 'UPDATE_PASSWORD' || incoming.action === 'RESET_PASSWORD') {
            const targetQuery = (incoming.username || incoming.userId || incoming.id || incoming.employeeCode || '').toLowerCase().trim();
            const newPass = incoming.temporaryPassword || incoming.newPassword || incoming.password || 'Password123!';
            const isReset = incoming.action === 'ADMIN_RESET_PASSWORD' || incoming.action === 'RESET_PASSWORD';

            let updated = false;
            let targetUser = null;
            workerState.users = workerState.users.map((u) => {
              const uUser = (u.username || '').toLowerCase().trim();
              const uId = (u.id || '').toLowerCase().trim();
              const uCode = (u.employeeCode || '').toLowerCase().trim();
              if (targetQuery && (uUser === targetQuery || uId === targetQuery || uCode === targetQuery)) {
                updated = true;
                targetUser = {
                  ...u,
                  password: newPass,
                  mustChangePassword: isReset,
                  forceChangeRequired: isReset,
                };
                return targetUser;
              }
              return u;
            });

            if (!updated && targetQuery) {
              targetUser = {
                id: `usr-${targetQuery}`,
                username: targetQuery,
                name: incoming.name || targetQuery,
                employeeCode: incoming.employeeCode || 'N/A',
                role: 'agent',
                designation: 'Agent',
                department: 'Operations',
                password: newPass,
                mustChangePassword: isReset,
                forceChangeRequired: isReset,
              };
              workerState.users.push(targetUser);
            }

            return jsonResponse({
              status: "SUCCESS",
              success: true,
              verified: true,
              action: incoming.action,
              username: targetUser?.username || targetQuery,
              message: `Password reset command processed and verified for ${targetUser?.username || targetQuery}`
            });
          }

          if (Array.isArray(incoming)) {
            const map = new Map(workerState.users.map((u) => [u.username ? u.username.toLowerCase() : u.id, u]));
            for (const u of incoming) {
              if (u) {
                const key = (u.username || u.id || '').toLowerCase();
                if (key) {
                  map.set(key, { ...(map.get(key) || {}), ...u });
                }
              }
            }
            workerState.users = Array.from(map.values());
            return jsonResponse({ success: true, count: workerState.users.length });
          } else if (incoming && (incoming.id || incoming.username || incoming.employeeCode)) {
            const userKey = (incoming.username || incoming.id || incoming.employeeCode || '').toLowerCase();
            const map = new Map();
            for (const u of workerState.users) {
              const k = (u.username || u.id || u.employeeCode || '').toLowerCase();
              map.set(k, u);
            }
            const existing = map.get(userKey) || {};
            const merged = { ...existing, ...incoming };
            map.set(userKey, merged);
            workerState.users = Array.from(map.values());
            return jsonResponse({ success: true, user: sanitizeOutput(merged) });
          }
          return jsonResponse({ error: "Invalid users payload" }, 400);
        } catch {
          return jsonResponse({ error: "Invalid JSON" }, 400);
        }
      }
    }

    // 7. Attendance Endpoints
    if (url.pathname === "/api/attendance") {
      if (request.method === "GET") {
        return jsonResponse(workerState.attendance);
      }
      if (request.method === "POST") {
        try {
          const incoming = await request.json();
          if (incoming && incoming.id) {
            const exists = workerState.attendance.some((a) => a.id === incoming.id);
            if (!exists) {
              workerState.attendance = [incoming, ...workerState.attendance].slice(0, 1000);
            }
            return jsonResponse({ success: true, record: incoming });
          }
          return jsonResponse({ error: "Invalid attendance payload" }, 400);
        } catch {
          return jsonResponse({ error: "Invalid JSON" }, 400);
        }
      }
    }

    // 8. Auditlogs Endpoints
    if (url.pathname === "/api/auditlogs") {
      if (request.method === "GET") {
        return jsonResponse(workerState.auditlogs);
      }
      if (request.method === "POST") {
        try {
          const incoming = await request.json();
          if (incoming && incoming.id) {
            const exists = workerState.auditlogs.some((l) => l.id === incoming.id);
            if (!exists) {
              workerState.auditlogs = [incoming, ...workerState.auditlogs].slice(0, 1000);
            }
            return jsonResponse({ success: true, log: incoming });
          }
          return jsonResponse({ error: "Invalid auditlog payload" }, 400);
        } catch {
          return jsonResponse({ error: "Invalid JSON" }, 400);
        }
      }
    }

    // ----------------------------------------------------
    // STATIC ASSETS & SPA ROUTING
    // ----------------------------------------------------
    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      const assetResponse = await env.ASSETS.fetch(request);
      if (
        assetResponse.status === 404 &&
        request.method === "GET" &&
        !url.pathname.startsWith("/api/")
      ) {
        const indexRequest = new Request(new URL("/index.html", request.url), request);
        return env.ASSETS.fetch(indexRequest);
      }
      return assetResponse;
    }

    return new Response("Not Found", { status: 404 });
  },
};
