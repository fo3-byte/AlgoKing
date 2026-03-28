import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Fyers OAuth callback handler.
 * Catches auth_code from redirect and exchanges it for access token.
 */
export async function GET(req: NextRequest) {
  const authCode = req.nextUrl.searchParams.get("auth_code") || "";
  const state = req.nextUrl.searchParams.get("state") || "";

  if (!authCode) {
    // Generate login URL
    const loginUrl = `https://api-t1.fyers.in/api/v3/generate-authcode?client_id=N7XLPBFRN3-100&redirect_uri=${encodeURIComponent(req.nextUrl.origin + "/api/fyers-auth")}&response_type=code&state=fyers_login`;

    return new NextResponse(
      `<html><body style="background:#1a1a1a;color:white;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column">
        <h1 style="color:#BFFF00">Fyers Login</h1>
        <p>No auth code received. <a href="${loginUrl}" style="color:#BFFF00">Click here to login</a></p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // Exchange auth code for access token
  try {
    // Generate appIdHash
    // SHA256(app_id:secret_key) — precomputed
    const appIdHash = "e8875960d8cf5c1ac26cc0f232468f8ef35318fea4fb4d59698704e85a656650";

    const res = await fetch("https://api-t1.fyers.in/api/v3/validate-authcode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        appIdHash,
        code: authCode,
      }),
    });

    const data = await res.json();

    console.log("Fyers validate response:", JSON.stringify(data));
    if (data.access_token) {
      // Success! Show the token
      return new NextResponse(
        `<html><body style="background:#1a1a1a;color:white;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:20px">
          <h1 style="color:#BFFF00">✅ Fyers Connected!</h1>
          <p>Access token generated successfully.</p>
          <p style="color:#888;font-size:12px">Token (first 50 chars): ${data.access_token.slice(0, 50)}...</p>
          <p style="color:#BFFF00;font-size:14px">Add this to your Vercel environment variables as FYERS_ACCESS_TOKEN</p>
          <textarea style="width:600px;height:100px;background:#262626;color:#BFFF00;border:1px solid #3a3a3a;border-radius:8px;padding:12px;font-size:11px" readonly>${data.access_token}</textarea>
          <a href="/" style="color:#BFFF00;margin-top:20px">← Back to Dashboard</a>
        </body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    } else {
      return new NextResponse(
        `<html><body style="background:#1a1a1a;color:white;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column">
          <h1 style="color:red">❌ Auth Failed</h1>
          <p>${data.message || JSON.stringify(data)}</p>
          <p style="color:#666;font-size:11px">Hash: ${appIdHash}</p>
          <p style="color:#666;font-size:11px">Auth code (first 30): ${authCode.slice(0, 30)}...</p>
          <a href="/api/fyers-auth" style="color:#BFFF00">Try again</a>
        </body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }
  } catch (err) {
    return new NextResponse(
      `<html><body style="background:#1a1a1a;color:white;font-family:system-ui;text-align:center;padding:40px">
        <h1 style="color:red">Error</h1><p>${String(err)}</p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }
}
