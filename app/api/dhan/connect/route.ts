// Step 1 + 2: Generate Dhan consent session → redirect user to Dhan login page
import { NextRequest, NextResponse } from "next/server";
import { generateDhanConsent } from "@/lib/dhan";

export async function GET(req: NextRequest) {
  const base     = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const clientId = req.nextUrl.searchParams.get("clientId")?.trim();

  if (!clientId) {
    return NextResponse.redirect(new URL("/settings?error=Enter+your+Dhan+Client+ID+first", base));
  }

  try {
    const consentAppId = await generateDhanConsent(clientId);
    const loginUrl     = `https://auth.dhan.co/login/consentApp-login?consentAppId=${consentAppId}`;

    // Stash clientId in a short-lived cookie so the callback can read it
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set("dhan_pending_client_id", clientId, {
      httpOnly: true,
      secure:   true,
      maxAge:   300, // 5 min
      path:     "/",
    });
    return response;
  } catch (err) {
    const url = new URL("/settings", base);
    url.searchParams.set("error", String(err));
    return NextResponse.redirect(url.toString());
  }
}
