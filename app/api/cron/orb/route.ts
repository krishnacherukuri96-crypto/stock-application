import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// Called by Vercel Cron at 9:35 AM IST (4:05 UTC) Mon-Fri — after 9:30 candle closes
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const base = req.nextUrl.origin;
  try {
    const orbRes = await fetch(`${base}/api/scanner/orb`, { method: "POST", cache: "no-store" });
    const data   = await orbRes.json();
    return NextResponse.json({ ...data, calledAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
