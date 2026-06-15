import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDhanToken, parseEnvToken } from "@/lib/dhan";

export async function GET() {
  try {
    // 1. Try to get a working token (seeds DB from env var if needed)
    const creds = await getDhanToken();

    if (!creds) {
      return NextResponse.json({
        connected: false,
        reason: "No token found. Add DHAN_ACCESS_TOKEN to Vercel env vars.",
      });
    }

    // 2. Try reading DB for precise expiry + updatedAt
    try {
      const stored = await prisma.dhanToken.findUnique({ where: { id: "singleton" } });

      if (stored) {
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
          source:    "database",
        });
      }
    } catch {
      // DB unreachable — fall through to env var parsing below
    }

    // 3. DB unavailable — parse expiry directly from the JWT in env var
    const env = parseEnvToken();
    if (env) {
      const msLeft    = env.expiresAt.getTime() - Date.now();
      const hoursLeft = Math.max(0, Math.floor(msLeft / 3600000));
      const isExpired = msLeft <= 0;

      return NextResponse.json({
        connected: !isExpired,
        clientId:  env.clientId,
        expiresAt: env.expiresAt.toISOString(),
        hoursLeft,
        isExpired,
        updatedAt: null,
        source:    "env_var",
        warning:   "Database unreachable — token read from env var. Check DATABASE_URL uses the Supabase pooler (port 6543), not the direct connection (port 5432).",
      });
    }

    return NextResponse.json({ connected: false, reason: "Token not found" });

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
