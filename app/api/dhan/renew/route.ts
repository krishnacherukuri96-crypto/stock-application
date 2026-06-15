import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDhanToken } from "@/lib/dhan";

// Called by Vercel Cron every weekday at 8 AM IST (2:30 AM UTC).
// Force-renews the Dhan access token so it's always fresh before market open.
export async function POST(req: NextRequest) {
  // Verify request is from Vercel Cron (or authorized caller)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // Auto-seed DB from env var if no DB entry exists
    const creds = await getDhanToken();
    if (!creds) {
      return NextResponse.json({
        success: false,
        reason: "No token found. Add DHAN_ACCESS_TOKEN to Vercel env vars and redeploy.",
      });
    }

    const stored = await prisma.dhanToken.findUnique({ where: { id: "singleton" } });

    if (!stored) {
      return NextResponse.json({
        success: false,
        reason: "Token found in env var but could not be saved to database. Check that the DhanToken table exists in Supabase.",
      });
    }

    const msToExpiry = stored.expiresAt.getTime() - Date.now();
    const hoursLeft  = Math.round(msToExpiry / 3600000);

    if (msToExpiry <= 0) {
      return NextResponse.json({
        success: false,
        reason:  "Token has already expired. Log in to Dhan HQ, generate a new access token, and update DHAN_ACCESS_TOKEN in Vercel env vars.",
        expiredAt: stored.expiresAt,
      });
    }

    // Call Dhan's RenewToken endpoint
    const res = await fetch("https://api.dhan.co/v2/RenewToken", {
      method:  "POST",
      headers: {
        "access-token":  stored.accessToken,
        "client-id":     stored.clientId,
        "Content-Type":  "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({
        success: false,
        reason:  `Dhan RenewToken API returned ${res.status}: ${body}`,
        hoursLeft,
      }, { status: 502 });
    }

    const data = await res.json() as { accessToken: string; expiryTime: string };

    if (!data.accessToken) {
      return NextResponse.json({
        success: false,
        reason:  "Dhan returned no accessToken in renewal response",
        raw:     data,
      }, { status: 502 });
    }

    // Parse expiry — Dhan sends IST without timezone suffix
    const expiresAt = new Date(
      data.expiryTime.includes("+") ? data.expiryTime : data.expiryTime + "+05:30",
    );

    await prisma.dhanToken.update({
      where: { id: "singleton" },
      data:  { accessToken: data.accessToken, expiresAt, updatedAt: new Date() },
    });

    return NextResponse.json({
      success:   true,
      renewedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      clientId:  stored.clientId,
      previousHoursLeft: hoursLeft,
    });

  } catch (e) {
    return NextResponse.json({
      success: false,
      reason:  e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
}

// GET — check current token status (for monitoring / Settings page)
export async function GET() {
  try {
    const stored = await prisma.dhanToken.findUnique({ where: { id: "singleton" } });
    if (!stored) {
      return NextResponse.json({ connected: false, reason: "No token stored" });
    }
    const msLeft  = stored.expiresAt.getTime() - Date.now();
    return NextResponse.json({
      connected:  msLeft > 0,
      clientId:   stored.clientId,
      expiresAt:  stored.expiresAt,
      hoursLeft:  Math.max(0, Math.round(msLeft / 3600000)),
      isExpired:  msLeft <= 0,
      updatedAt:  stored.updatedAt,
    });
  } catch (e) {
    return NextResponse.json({ connected: false, reason: String(e) }, { status: 500 });
  }
}
