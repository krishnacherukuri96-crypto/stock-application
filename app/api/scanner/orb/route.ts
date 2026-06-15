import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDhanToken } from "@/lib/dhan";

export const maxDuration = 60;

function todayIST(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

function minsIntoDay(): number {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes() - 555; // since 9:15 AM
}

// Fetch today's first 15-min candle from Dhan intraday endpoint
async function fetchORBCandle(
  securityId: number,
  token: string,
  clientId: string,
): Promise<{ orbHigh: number; orbLow: number } | null> {
  try {
    const res = await fetch("https://api.dhan.co/v2/charts/intraday", {
      method: "POST",
      headers: {
        "access-token":  token,
        "client-id":     clientId,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        securityId:      String(securityId),
        exchangeSegment: "NSE_EQ",
        instrument:      "EQUITY",
        interval:        "15", // 15-minute candles
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    // First candle covers 9:15–9:30 (the opening range)
    if (!Array.isArray(data.high) || data.high.length === 0) return null;
    return {
      orbHigh: data.high[0],
      orbLow:  data.low[0],
    };
  } catch {
    return null;
  }
}

// POST /api/scanner/orb — fetch ORB for today's top stocks (call after 9:30 AM)
export async function POST() {
  const mins = minsIntoDay();
  if (mins < 15) {
    return NextResponse.json(
      { error: "Opening range window not closed yet. Run after 9:30 AM IST." },
      { status: 400 },
    );
  }

  const creds = await getDhanToken();
  if (!creds) return NextResponse.json({ error: "Dhan not connected" }, { status: 503 });

  const date = todayIST();

  // Stocks with no ORB yet today, top 100 by preScore
  const pending = await prisma.dailyMetrics.findMany({
    where:   { date, orbHigh: null },
    orderBy: { preScore: "desc" },
    take:    100,
    select:  { symbol: true },
  });

  if (pending.length === 0) {
    return NextResponse.json({ message: "ORB already set for all stocks today", date });
  }

  const universe = await prisma.scannerUniverse.findMany({
    where:  { symbol: { in: pending.map(p => p.symbol) } },
    select: { symbol: true, securityId: true },
  });
  const idMap = new Map(universe.map(u => [u.symbol, u.securityId]));

  const { token, clientId } = creds;
  const BATCH = 5;
  let updated = 0;

  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async p => {
        const secId = idMap.get(p.symbol);
        if (!secId) return;
        const orb = await fetchORBCandle(secId, token, clientId);
        if (!orb) return;
        try {
          await prisma.dailyMetrics.update({
            where: { symbol_date: { symbol: p.symbol, date } },
            data:  { orbHigh: orb.orbHigh, orbLow: orb.orbLow },
          });
          updated++;
        } catch { /* skip */ }
      }),
    );
    if (i + BATCH < pending.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return NextResponse.json({ success: true, updated, pending: pending.length, date });
}

// GET /api/scanner/orb — ORB set status for today
export async function GET() {
  const date    = todayIST();
  const total   = await prisma.dailyMetrics.count({ where: { date } });
  const orbSet  = await prisma.dailyMetrics.count({ where: { date, orbHigh: { not: null } } });
  return NextResponse.json({ date, total, orbSet, pending: total - orbSet });
}
