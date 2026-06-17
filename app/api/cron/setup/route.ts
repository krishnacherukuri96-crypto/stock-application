import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// Called by Vercel Cron at 9:00 AM IST (3:30 UTC) Mon-Fri
// Runs Build Universe → Pre-Market Scan sequentially
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const base = req.nextUrl.origin;
  const results: Record<string, unknown> = { startedAt: new Date().toISOString() };

  try {
    const uniRes  = await fetch(`${base}/api/scanner/universe`,  { method: "POST", cache: "no-store" });
    results.universe = await uniRes.json();
  } catch (e) {
    results.universe = { error: String(e) };
  }

  try {
    const preRes  = await fetch(`${base}/api/scanner/premarket`, { method: "POST", cache: "no-store" });
    results.premarket = await preRes.json();
  } catch (e) {
    results.premarket = { error: String(e) };
  }

  results.finishedAt = new Date().toISOString();
  return NextResponse.json(results);
}
