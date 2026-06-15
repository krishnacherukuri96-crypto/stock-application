import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDhanToken } from "@/lib/dhan";
import { calcRVOL, calcLiveScore, classifySignal } from "@/lib/ta";

function todayIST(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

function isMarketOpen(): boolean {
  const ist  = new Date(Date.now() + 5.5 * 3600 * 1000);
  const day  = ist.getUTCDay();
  if (day === 0 || day === 6) return false;
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return mins >= 555 && mins <= 930;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick(d: any, ...keys: string[]): number {
  for (const k of keys) {
    const v = d[k];
    if (v !== undefined && v !== null && isFinite(Number(v))) return Number(v);
  }
  return 0;
}

// GET /api/scanner/live — real-time scanner with RVOL + ORB + live scores
export async function GET(req: NextRequest) {
  try {
    return await handleLive(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, stocks: [], counts: { breakout: 0, buy_setup: 0, watch: 0, avoid: 0, rvolSpike: 0 }, total: 0, marketOpen: false }, { status: 500 });
  }
}

async function handleLive(req: NextRequest) {
  const debug = req.nextUrl.searchParams.get("debug") === "true";
  const topN  = Math.min(150, parseInt(req.nextUrl.searchParams.get("top") ?? "100"));
  const date  = todayIST();

  const creds = await getDhanToken();
  if (!creds) {
    return NextResponse.json({ error: "Dhan not connected. Connect your Dhan account in Settings.", stocks: [], counts: { breakout: 0, buy_setup: 0, watch: 0, avoid: 0, rvolSpike: 0 }, total: 0, marketOpen: isMarketOpen() }, { status: 503 });
  }

  // Today's pre-scored stocks
  const metrics = await prisma.dailyMetrics.findMany({
    where:   { date },
    orderBy: { preScore: "desc" },
    take:    topN,
  });

  if (metrics.length === 0) {
    return NextResponse.json({
      stocks:  [],
      status:  "premarket_needed",
      message: "Pre-market scan not yet run. Use the Setup panel to initialize today's scan.",
      marketOpen: isMarketOpen(),
    });
  }

  // Look up security IDs + names from universe
  const universe = await prisma.scannerUniverse.findMany({
    where:  { symbol: { in: metrics.map(m => m.symbol) } },
    select: { symbol: true, securityId: true, name: true },
  });
  const uniMap = new Map(universe.map(u => [u.symbol, u]));

  const secIds = metrics
    .map(m => uniMap.get(m.symbol)?.securityId)
    .filter((id): id is number => id !== undefined);

  if (secIds.length === 0) {
    return NextResponse.json({ stocks: [], status: "no_security_ids", marketOpen: isMarketOpen() });
  }

  const { token, clientId } = creds;

  const res = await fetch("https://api.dhan.co/v2/marketfeed/ohlc", {
    method: "POST",
    headers: {
      "access-token": token,
      "client-id":    clientId,
      "Content-Type": "application/json",
      "Accept":       "application/json",
    },
    body:  JSON.stringify({ NSE_EQ: secIds }),
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text();
    return NextResponse.json({ error: `Dhan API ${res.status}: ${txt}` }, { status: 502 });
  }

  const json = await res.json();
  if (debug) return NextResponse.json(json);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: Record<string, any> = json?.data?.NSE_EQ ?? {};

  const stocks = metrics
    .map(m => {
      const info = uniMap.get(m.symbol);
      if (!info) return null;

      const d = raw[String(info.securityId)];
      if (!d) return null;

      const ltp    = pick(d, "last_price", "LTP", "lastPrice", "ltp");
      const open   = pick(d, "open", "openPrice", "open_price");
      const high   = pick(d, "high", "highPrice", "high_price", "dayHigh");
      const low    = pick(d, "low",  "lowPrice",  "low_price",  "dayLow");
      const volume = pick(d, "volume", "totalTradedQuantity", "tot_tradedQty", "tradedVolume");

      if (ltp === 0) return null;

      const pctChange = m.close > 0 ? parseFloat(((ltp - m.close) / m.close * 100).toFixed(2)) : 0;
      const rvol      = calcRVOL(volume, m.avgVol20);

      // VWAP approximation from daily OHLC: (O+H+L+C)/4
      const vwapApprox = (open + high + low + ltp) / 4;
      const aboveVwap  = ltp > vwapApprox;

      // ORB: null until set by orb job
      const orbBroken = m.orbHigh !== null ? ltp > m.orbHigh : null;
      const orbBelow  = m.orbLow  !== null ? ltp < m.orbLow  : null;

      const liveScore = calcLiveScore({ preScore: m.preScore, rvol, orbBroken, aboveVwap, pctChange });
      const signal    = classifySignal(liveScore, rvol, pctChange);

      // EMA positions from pre-computed values
      const aboveEma20 = ltp > m.ema20;
      const aboveEma50 = m.ema50 !== null ? ltp > m.ema50 : null;

      // Near 20-day high breakout
      const pctFromBreakout = m.high20d > 0
        ? parseFloat(((m.high20d - ltp) / m.high20d * 100).toFixed(2))
        : null;

      return {
        symbol:          m.symbol,
        name:            info.name,
        ltp,
        open,
        high,
        low,
        volume,
        pctChange,
        rvol,
        rsi14:           parseFloat(m.rsi14.toFixed(1)),
        ema20:           parseFloat(m.ema20.toFixed(2)),
        ema50:           m.ema50 !== null ? parseFloat(m.ema50.toFixed(2)) : null,
        aboveEma20,
        aboveEma50,
        aboveVwap,
        orbHigh:         m.orbHigh,
        orbLow:          m.orbLow,
        orbBroken,
        orbBelow,
        high20d:         parseFloat(m.high20d.toFixed(2)),
        pctFromBreakout,
        preScore:        m.preScore,
        liveScore,
        signal,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.liveScore - a.liveScore);

  // Summary counts
  const counts = {
    breakout:  stocks.filter(s => s.signal === "breakout").length,
    buy_setup: stocks.filter(s => s.signal === "buy_setup").length,
    watch:     stocks.filter(s => s.signal === "watch").length,
    avoid:     stocks.filter(s => s.signal === "avoid").length,
    rvolSpike: stocks.filter(s => s.rvol >= 2).length,
  };

  return NextResponse.json({
    stocks,
    counts,
    total:      stocks.length,
    fetchedAt:  new Date().toISOString(),
    marketOpen: isMarketOpen(),
    date,
    orbReady:   metrics.some(m => m.orbHigh !== null),
  });
}
