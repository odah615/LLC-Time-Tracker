// Cloudflare Pages Advanced Mode Worker
// Routes /api/sync-sheets directly to Google Apps Script proxy
// and delegates all other requests to static assets (env.ASSETS).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const DEFAULT_LIVE_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyKGMOWV0u5xcv_lOKBk6LXpbjrlgZiuqtCs3_HbqjekoJZdXpdfA_1kDjP7H0ulLsw3Q/exec";

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
    "token",
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

async function handleSyncSheetsPost(request, env = {}) {
  try {
    const liveAppsScriptUrl = env.LIVE_APPS_SCRIPT_URL || DEFAULT_LIVE_APPS_SCRIPT_URL;
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

    const payload =
      typeof rawPayload === "object" && rawPayload !== null
        ? { ...rawPayload, secret: liveAppsScriptSecret }
        : { payload: rawPayload, secret: liveAppsScriptSecret };

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
    } catch (e) {
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
    const liveAppsScriptUrl = env.LIVE_APPS_SCRIPT_URL || DEFAULT_LIVE_APPS_SCRIPT_URL;
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
    } catch (e) {
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/sync-sheets") {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: corsHeaders,
        });
      }
      if (request.method === "POST") {
        return handleSyncSheetsPost(request, env);
      }
      if (request.method === "GET") {
        return handleSyncSheetsGet(request, env);
      }
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Delegate static assets and SPA routing to Pages Asset server
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status === 404 && request.method === "GET" && !url.pathname.startsWith("/api/")) {
      const indexRequest = new Request(new URL("/index.html", request.url), request);
      return env.ASSETS.fetch(indexRequest);
    }
    return assetResponse;
  },
};
