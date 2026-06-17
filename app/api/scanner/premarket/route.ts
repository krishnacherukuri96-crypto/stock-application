import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDhanToken } from "@/lib/dhan";
import { calcEMA, calcRSI, calcATR, calcPreScore } from "@/lib/ta";
import { getSector } from "@/lib/sectors";

export const maxDuration = 60;

function todayIST(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

function dateNDaysAgo(n: number): string {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

interface Candle { close: number; high: number; low: number; volume: number }

async function fetchDailyCandles(
  securityId: number,
  token: string,
  clientId: string,
): Promise<Candle[] | null> {
  try {
    const res = await fetch("https://api.dhan.co/v2/charts/historical", {
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
        fromDate:        dateNDaysAgo(300), // ~210 trading days — enough for EMA200
        toDate:          dateNDaysAgo(1),
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data.close) || data.close.length < 5) return null;
    return data.close.map((c: number, i: number) => ({
      close:  c,
      high:   Array.isArray(data.high)   ? (data.high[i]   ?? c) : c,
      low:    Array.isArray(data.low)    ? (data.low[i]    ?? c) : c,
      volume: Array.isArray(data.volume) ? (data.volume[i] ?? 0) : 0,
    }));
  } catch {
    return null;
  }
}

async function scoreStock(
  symbol: string,
  securityId: number,
  token: string,
  clientId: string,
  date: string,
): Promise<{
  symbol: string; date: string; close: number;
  ema20: number; ema50: number | null; ema200: number | null;
  rsi14: number; avgVol20: number; high20d: number;
  atr14: number | null; preScore: number;
} | null> {
  const candles = await fetchDailyCandles(securityId, token, clientId);
  if (!candles || candles.length < 10) return null;

  const closes  = candles.map(c => c.close);
  const highs   = candles.map(c => c.high);
  const volumes = candles.map(c => c.volume);

  const lastClose = closes[closes.length - 1];
  const ema20     = calcEMA(closes, 20);
  const ema50     = closes.length >= 50  ? calcEMA(closes, 50)  : null;
  const ema200    = closes.length >= 200 ? calcEMA(closes, 200) : null;
  const rsi14     = calcRSI(closes, 14);
  const atr14     = candles.length >= 15 ? calcATR(candles, 14) : null;

  const last20vols = volumes.slice(-20);
  const avgVol20   = last20vols.reduce((a, b) => a + b, 0) / last20vols.length;
  const high20d    = Math.max(...highs.slice(-20));

  const score = calcPreScore({
    close: lastClose, ema20, ema50, ema200, rsi14, avgVol20, high20d,
  });

  return {
    symbol, date,
    close: lastClose, ema20, ema50: ema50 ?? null, ema200: ema200 ?? null,
    rsi14, avgVol20, high20d, atr14: atr14 ?? null, preScore: score,
  };
}

// POST /api/scanner/premarket
export async function POST() {
  try {
    return await runPremarket();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

async function runPremarket() {
  const creds = await getDhanToken();
  if (!creds) return NextResponse.json({ error: "Dhan not connected" }, { status: 503 });

  const date = todayIST();

  const alreadyDone = await prisma.dailyMetrics.count({ where: { date } });
  if (alreadyDone > 0) {
    return NextResponse.json({ alreadyDone: true, count: alreadyDone, date });
  }

  const universe = await prisma.scannerUniverse.findMany({
    select: { symbol: true, securityId: true },
  });

  if (universe.length === 0) {
    return NextResponse.json(
      { error: "Scanner universe is empty. Run 'Build Universe' first." },
      { status: 400 },
    );
  }

  const { token, clientId } = creds;
  const BATCH = 8;
  const DELAY = 150;

  let processed = 0;
  let failed    = 0;

  for (let i = 0; i < universe.length; i += BATCH) {
    const batch = universe.slice(i, i + BATCH);

    const results = await Promise.all(
      batch.map(s => scoreStock(s.symbol, s.securityId, token, clientId, date)),
    );

    const valid = results.filter((r): r is NonNullable<typeof r> => r !== null);
    failed += batch.length - valid.length;

    if (valid.length > 0) {
      await Promise.all(
        valid.map(m =>
          prisma.dailyMetrics.upsert({
            where:  { symbol_date: { symbol: m.symbol, date: m.date } },
            update: m,
            create: m,
          }),
        ),
      );

      // Keep sector column on ScannerUniverse up-to-date from static map
      await Promise.all(
        valid.map(m => {
          const sector = getSector(m.symbol);
          if (sector !== "OTHERS") {
            return prisma.scannerUniverse.updateMany({
              where: { symbol: m.symbol },
              data:  { sector },
            });
          }
        }).filter(Boolean),
      );
    }

    processed += valid.length;

    if (i + BATCH < universe.length) {
      await new Promise(r => setTimeout(r, DELAY));
    }
  }

  const topPicks = await prisma.dailyMetrics.findMany({
    where:   { date, preScore: { gte: 60 } },
    orderBy: { preScore: "desc" },
    take:    10,
    select:  { symbol: true, preScore: true, rsi14: true },
  });

  return NextResponse.json({
    success:    true,
    date,
    total:      universe.length,
    processed,
    failed,
    highSetups: topPicks.length,
    topPicks,
  });
}

// GET /api/scanner/premarket — status + top picks for today
export async function GET() {
  try {
    const date  = todayIST();
    const count = await prisma.dailyMetrics.count({ where: { date } });
    const topPicks = await prisma.dailyMetrics.findMany({
      where:   { date },
      orderBy: { preScore: "desc" },
      take:    10,
      select:  { symbol: true, preScore: true, rsi14: true, ema20: true },
    });
    return NextResponse.json({ date, count, topPicks });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e), count: 0, topPicks: [] }, { status: 500 });
  }
}
