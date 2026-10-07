const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const GOOGLE_APPS_SCRIPT_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbyKGMOWV0u5xcv_lOKBk6LXpbjrlgZiuqtCs3_HbqjekoJZdXpdfA_1kDjP7H0ulLsw3Q/exec";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
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

    console.log("Forwarding Google Sheets request to:", webhookUrl);

    const googleResponse = await fetch(webhookUrl.trim(), {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
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

    console.log(
      "Google Apps Script response:",
      googleResponse.status,
      googleResult
    );

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
  } catch (error: any) {
    console.error("Cloudflare sync proxy error:", error);

    return jsonResponse(
      {
        success: false,
        error: error?.message || String(error),
      },
      500
    );
  }
}

// GET /api/sync-sheets?url=GOOGLE_APPS_SCRIPT_URL
export async function onRequestGet(context: any) {
  try {
    const webhookUrl = GOOGLE_APPS_SCRIPT_WEBHOOK_URL;

    const googleResponse = await fetch(webhookUrl, {
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

    return jsonResponse(googleResult, googleResponse.status);
  } catch (error: any) {
    console.error("Cloudflare Google Sheets GET proxy error:", error);

    return jsonResponse(
      {
        success: false,
        error: error?.message || String(error),
      },
      500
    );
  }
}