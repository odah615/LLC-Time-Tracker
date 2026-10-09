// Cloudflare Pages Advanced Mode Worker
// Routes /api/sync-sheets directly to Google Apps Script proxy
// and delegates all other requests to static assets (env.ASSETS).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const GOOGLE_APPS_SCRIPT_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbyKGMOWV0u5xcv_lOKBk6LXpbjrlgZiuqtCs3_HbqjekoJZdXpdfA_1kDjP7H0ulLsw3Q/exec";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

async function handleSyncSheetsPost(request) {
  try {
    const body = await request.json();
    const webhookUrl = body?.webhookUrl || GOOGLE_APPS_SCRIPT_WEBHOOK_URL;
    const payload = body?.payload || body;

    if (
      !webhookUrl ||
      typeof webhookUrl !== "string" ||
      !webhookUrl.startsWith("https://")
    ) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid or missing Google Apps Script webhook URL",
        },
        400
      );
    }

    const googleResponse = await fetch(webhookUrl.trim(), {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
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

    const isSuccess =
      googleResponse.ok &&
      (googleResult?.status === "SUCCESS" ||
        googleResult?.success === true ||
        googleResult?.action === "HEARTBEAT_UPDATE" ||
        googleResult?.action === payload?.action);

    return jsonResponse(
      {
        success: isSuccess,
        status: googleResponse.status,
        appsScriptStatus:
          googleResult?.status ||
          (googleResult?.success ? "SUCCESS" : "UNKNOWN"),
        action: googleResult?.action || payload?.action,
        result: googleResult,
        error: !isSuccess
          ? googleResult?.message ||
            googleResult?.error ||
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

async function handleSyncSheetsGet(request) {
  try {
    const url = new URL(request.url);
    const webhookUrl = url.searchParams.get("url") || GOOGLE_APPS_SCRIPT_WEBHOOK_URL;

    if (
      !webhookUrl ||
      typeof webhookUrl !== "string" ||
      !webhookUrl.startsWith("https://")
    ) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid or missing Google Apps Script webhook URL",
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

    return jsonResponse(googleResult, googleResponse.status);
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
        return handleSyncSheetsPost(request);
      }
      if (request.method === "GET") {
        return handleSyncSheetsGet(request);
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
