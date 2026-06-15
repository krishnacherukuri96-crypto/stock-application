// Step 3: Dhan redirects here with ?tokenId — exchange it for an access token
import { NextRequest, NextResponse } from "next/server";
import { consumeDhanConsent } from "@/lib/dhan";

export async function GET(req: NextRequest) {
  const base    = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const tokenId = req.nextUrl.searchParams.get("tokenId");

  if (!tokenId) {
    return NextResponse.redirect(new URL("/settings?error=No+tokenId+received+from+Dhan", base));
  }

  try {
    await consumeDhanConsent(tokenId);

    const response = NextResponse.redirect(new URL("/settings?success=true", base));
    response.cookies.delete("dhan_pending_client_id");
    return response;
  } catch (err) {
    const url = new URL("/settings", base);
    url.searchParams.set("error", String(err));
    return NextResponse.redirect(url.toString());
  }
}
