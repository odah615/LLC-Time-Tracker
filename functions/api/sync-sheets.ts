const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const DEFAULT_LIVE_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyKGMOWV0u5xcv_lOKBk6LXpbjrlgZiuqtCs3_HbqjekoJZdXpdfA_1kDjP7H0ulLsw3Q/exec";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(sanitizeOutput(data)), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function sanitizeOutput(data: any): any {
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
  const sanitized: Record<string, any> = {};
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

// Handle browser CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// POST /api/sync-sheets
export async function onRequestPost(context: any) {
  try {
    const request = context.request;
    const env = context.env || {};
    const liveAppsScriptUrl =
      env.LIVE_APPS_SCRIPT_URL ||
      (typeof process !== "undefined" ? process.env?.LIVE_APPS_SCRIPT_URL : "") ||
      DEFAULT_LIVE_APPS_SCRIPT_URL;
    const liveAppsScriptSecret =
      env.LIVE_APPS_SCRIPT_SECRET ||
      (typeof process !== "undefined" ? process.env?.LIVE_APPS_SCRIPT_SECRET : "") ||
      "";

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

    // Attach secret to payload and headers for Google Apps Script verification
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
    let googleResult: any;

    try {
      googleResult = JSON.parse(responseText);
    } catch {
      googleResult = {
        response: responseText,
      };
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
  } catch (error: any) {
    return jsonResponse(
      {
        success: false,
        error: error?.message || String(error),
      },
      500
    );
  }
}

// GET /api/sync-sheets?url=LIVE_APPS_SCRIPT_URL
export async function onRequestGet(context: any) {
  try {
    const request = context.request;
    const env = context.env || {};
    const url = new URL(request.url);
    const liveAppsScriptUrl =
      env.LIVE_APPS_SCRIPT_URL ||
      (typeof process !== "undefined" ? process.env?.LIVE_APPS_SCRIPT_URL : "") ||
      DEFAULT_LIVE_APPS_SCRIPT_URL;

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
    let googleResult: unknown;

    try {
      googleResult = JSON.parse(responseText);
    } catch {
      googleResult = {
        response: responseText,
      };
    }

    return jsonResponse(sanitizeOutput(googleResult), googleResponse.status);
  } catch (error: any) {
    return jsonResponse(
      {
        success: false,
        error: error?.message || String(error),
      },
      500
    );
  }
}