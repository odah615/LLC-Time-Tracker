const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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

    const webhookUrl = body?.webhookUrl;
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

    let googleResult: unknown;

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

    return jsonResponse({
      success: googleResponse.ok,
      status: googleResponse.status,
      result: googleResult,
    });
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
    const request = context.request;
    const requestUrl = new URL(request.url);

    const webhookUrl = requestUrl.searchParams.get("url");

    if (
      !webhookUrl ||
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