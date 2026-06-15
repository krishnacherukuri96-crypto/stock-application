import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDhanToken } from "@/lib/dhan";

export async function GET() {
  try {
    // getDhanToken() auto-seeds the DB from DHAN_ACCESS_TOKEN env var if no DB entry exists
    const creds = await getDhanToken();

    if (!creds) {
      return NextResponse.json({
        connected: false,
        reason: "No token found. Add DHAN_ACCESS_TOKEN to Vercel env vars.",
      });
    }

    // Read DB entry for display info (expiry, updatedAt)
    let stored = null;
    try {
      stored = await prisma.dhanToken.findUnique({ where: { id: "singleton" } });
    } catch { /* DhanToken table may not exist yet */ }

    if (!stored) {
      // Token came from env var directly (DB table missing or empty)
      return NextResponse.json({
        connected: true,
        clientId:  creds.clientId,
        source:    "env_var",
        hoursLeft: 24,
        isExpired: false,
      });
    }

    const msLeft    = stored.expiresAt.getTime() - Date.now();
    const hoursLeft = Math.max(0, Math.floor(msLeft / 3600000));
    const isExpired = msLeft <= 0;

    return NextResponse.json({
      connected: !isExpired,
      clientId:  stored.clientId,
      expiresAt: stored.expiresAt.toISOString(),
      hoursLeft,
      isExpired,
      updatedAt: stored.updatedAt.toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ connected: false, reason: String(e) });
  }
}

export async function DELETE() {
  try {
    await prisma.dhanToken.delete({ where: { id: "singleton" } });
  } catch { /* already deleted or table missing */ }
  return NextResponse.json({ ok: true });
}
