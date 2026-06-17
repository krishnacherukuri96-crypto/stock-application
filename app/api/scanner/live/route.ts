import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDhanToken } from "@/lib/dhan";
import { calcRVOL, calcLiveScore, classifySignal, detectRegime, type MarketRegime } from "@/lib/ta";
import { getSector, SECTOR_LABELS } from "@/lib/sectors";

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

// Nifty 50 security ID in Dhan (IDX_I exchange segment)
const NIFTY50_ID = 13;

// GET /api/scanner/live
export async function GET(req: NextRequest) {
  try {
    return await handleLive(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      error: msg, stocks: [],
      counts: { breakout: 0, buy_setup: 0, watch: 0, avoid: 0, rvolSpike: 0 },
      total: 0, marketOpen: false, marketRegime: "unknown",
    }, { status: 500 });
  }
}

async function handleLive(req: NextRequest) {
  const debug = req.nextUrl.searchParams.get("debug") === "true";
  const topN  = Math.min(150, parseInt(req.nextUrl.searchParams.get("top") ?? "100"));
  const date  = todayIST();

  const creds = await getDhanToken();
  if (!creds) {
    return NextResponse.json({
      error: "Dhan not connected. Connect your Dhan account in Settings.",
      stocks: [], counts: { breakout: 0, buy_setup: 0, watch: 0, avoid: 0, rvolSpike: 0 },
      total: 0, marketOpen: isMarketOpen(), marketRegime: "unknown",
    }, { status: 503 });
  }

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
      marketRegime: "unknown",
    });
  }

  const universe = await prisma.scannerUniverse.findMany({
    where:  { symbol: { in: metrics.map(m => m.symbol) } },
    select: { symbol: true, securityId: true, name: true, sector: true },
  });
  const uniMap = new Map(universe.map(u => [u.symbol, u]));

  const secIds = metrics
    .map(m => uniMap.get(m.symbol)?.securityId)
    .filter((id): id is number => id !== undefined);

  if (secIds.length === 0) {
    return NextResponse.json({ stocks: [], status: "no_security_ids", marketOpen: isMarketOpen(), marketRegime: "unknown" });
  }

  const { token, clientId } = creds;

  // Single quote call: stock quotes + Nifty 50 index
  const res = await fetch("https://api.dhan.co/v2/marketfeed/quote", {
    method: "POST",
    headers: {
      "access-token": token,
      "client-id":    clientId,
      "Content-Type": "application/json",
      "Accept":       "application/json",
    },
    body:  JSON.stringify({ NSE_EQ: secIds, IDX_I: [NIFTY50_ID] }),
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

  // ── Nifty 50 regime ────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const niftyRaw: any = json?.data?.IDX_I?.[String(NIFTY50_ID)] ?? null;
  const niftyLTP  = niftyRaw ? pick(niftyRaw, "last_price")    : 0;
  const niftyVWAP = niftyRaw ? pick(niftyRaw, "average_price") : 0;
  const niftyOpen = niftyRaw ? pick(niftyRaw?.ohlc, "open")    : 0;
  const niftyPrevClose = niftyRaw?.ohlc?.close > 0 ? niftyRaw.ohlc.close : 0;

  const niftyPctChange = niftyLTP > 0 && niftyPrevClose > 0
    ? parseFloat(((niftyLTP - niftyPrevClose) / niftyPrevClose * 100).toFixed(2))
    : null;

  const marketRegime: MarketRegime = detectRegime(
    niftyLTP > 0 ? { ltp: niftyLTP, vwap: niftyVWAP, open: niftyOpen } : null,
  );

  // ── Per-stock metrics ──────────────────────────────────────────────────────
  const stocksRaw = metrics.map(m => {
    const info = uniMap.get(m.symbol);
    if (!info) return null;

    const d = raw[String(info.securityId)];
    if (!d) return null;

    const ltp    = pick(d,      "last_price");
    const volume = pick(d,      "volume");
    const vwap   = pick(d,      "average_price");
    const open   = pick(d.ohlc, "open");
    const high   = pick(d.ohlc, "high");
    const low    = pick(d.ohlc, "low");

    if (ltp === 0) return null;

    const prevClose = d.ohlc?.close > 0 ? d.ohlc.close : m.close;
    const pctChange = prevClose > 0 ? parseFloat(((ltp - prevClose) / prevClose * 100).toFixed(2)) : 0;
    const rvol      = calcRVOL(volume, m.avgVol20);
    const aboveVwap = vwap > 0 ? ltp > vwap : ltp > (open + high + low + ltp) / 4;

    // Use 0.2% buffer for ORB breakout to avoid false ticks
    const ORB_BUFFER = 1.002;
    const orbBroken = m.orbHigh !== null ? ltp > m.orbHigh * ORB_BUFFER : null;
    const orbBelow  = m.orbLow  !== null ? ltp < m.orbLow               : null;

    const aboveEma20  = ltp > m.ema20;
    const aboveEma50  = m.ema50  !== null ? ltp > m.ema50  : null;
    const aboveEma200 = m.ema200 !== null ? ltp > m.ema200 : null;

    // EMA stack for scoring (trend direction)
    const ema50Stack    = m.ema50  !== null ? m.ema20 > m.ema50  : null;
    const ema200Bullish = m.ema200 !== null
      ? (ltp > m.ema200 && (m.ema50 === null || m.ema50 > m.ema200))
      : null;

    // Sector from DB (set by premarket job) or static map fallback
    const sector = info.sector ?? getSector(m.symbol);

    const pctFromBreakout = m.high20d > 0
      ? parseFloat(((m.high20d - ltp) / m.high20d * 100).toFixed(2))
      : null;

    return {
      symbol: m.symbol, name: info.name, sector,
      ltp, open, high, low, volume, pctChange,
      rvol,
      // Use != null (not !==) so both null and undefined are treated as absent
      rsi14:           parseFloat((m.rsi14   ?? 50).toFixed(1)),
      ema20:           parseFloat((m.ema20   ?? 0).toFixed(2)),
      ema50:           m.ema50  != null ? parseFloat(m.ema50.toFixed(2))   : null,
      ema200:          m.ema200 != null ? parseFloat(m.ema200.toFixed(2))  : null,
      atr14:           m.atr14  != null ? parseFloat(m.atr14.toFixed(2))   : null,
      aboveEma20, aboveEma50, aboveEma200,
      aboveVwap,
      orbHigh:         m.orbHigh,
      orbLow:          m.orbLow,
      orbBroken,
      orbBelow,
      high20d:         parseFloat((m.high20d ?? 0).toFixed(2)),
      pctFromBreakout,
      preScore:        m.preScore,
      _pctChange:      pctChange,
      _sector:         sector,
      _ema50Stack:     ema50Stack,
      _ema200Bullish:  ema200Bullish,
    };
  }).filter((s): s is NonNullable<typeof s> => s !== null);

  // ── Sector averages (compute from stocks we already have) ─────────────────
  const sectorSums = new Map<string, { sum: number; count: number }>();
  for (const s of stocksRaw) {
    const cur = sectorSums.get(s._sector) ?? { sum: 0, count: 0 };
    sectorSums.set(s._sector, { sum: cur.sum + s._pctChange, count: cur.count + 1 });
  }
  const sectorAvg = new Map<string, number>();
  Array.from(sectorSums.entries()).forEach(([sec, { sum, count }]) => {
    sectorAvg.set(sec, parseFloat((sum / count).toFixed(2)));
  });

  // ── Final scoring pass ────────────────────────────────────────────────────
  const stocks = stocksRaw.map(s => {
    const sectorReturn   = s._sector !== "OTHERS" ? (sectorAvg.get(s._sector) ?? null) : null;
    const relativeStrength = sectorReturn !== null
      ? parseFloat((s._pctChange - sectorReturn).toFixed(2))
      : null;
    const sectorVsNifty = sectorReturn !== null && niftyPctChange !== null
      ? parseFloat((sectorReturn - niftyPctChange).toFixed(2))
      : null;

    const liveScore = calcLiveScore({
      ema20Bullish:     s.aboveEma20,
      ema50Stack:       s._ema50Stack,
      ema200Bullish:    s._ema200Bullish,
      rvol:             s.rvol,
      orbBroken:        s.orbBroken,
      aboveVwap:        s.aboveVwap,
      pctChange:        s._pctChange,
      relativeStrength,
      sectorVsNifty,
      marketRegime,
    });

    const signal = classifySignal(
      liveScore, s.rvol, s._pctChange,
      s.aboveEma20, s.aboveEma50, s.orbBroken, marketRegime,
    );

    // ATR-based stop loss suggestion: 0.5 ATR below LTP
    const suggestedSL = s.atr14 !== null
      ? parseFloat((s.ltp - 0.5 * s.atr14).toFixed(2))
      : null;

    return {
      symbol:          s.symbol,
      name:            s.name,
      sector:          s.sector,
      sectorLabel:     SECTOR_LABELS[s._sector as keyof typeof SECTOR_LABELS] ?? s._sector,
      ltp:             s.ltp,
      open:            s.open,
      high:            s.high,
      low:             s.low,
      volume:          s.volume,
      pctChange:       s.pctChange,
      rvol:            s.rvol,
      rsi14:           s.rsi14,
      ema20:           s.ema20,
      ema50:           s.ema50,
      ema200:          s.ema200,
      atr14:           s.atr14,
      suggestedSL,
      aboveEma20:      s.aboveEma20,
      aboveEma50:      s.aboveEma50,
      aboveEma200:     s.aboveEma200,
      aboveVwap:       s.aboveVwap,
      orbHigh:         s.orbHigh,
      orbLow:          s.orbLow,
      orbBroken:       s.orbBroken,
      orbBelow:        s.orbBelow,
      high20d:         s.high20d,
      pctFromBreakout: s.pctFromBreakout,
      relativeStrength,
      sectorPctChange: sectorReturn,
      sectorVsNifty,
      preScore:        s.preScore,
      liveScore,
      signal,
    };
  }).sort((a, b) => b.liveScore - a.liveScore);

  // ── Sector leaderboard ────────────────────────────────────────────────────
  const sectorRanking = Array.from(sectorAvg.entries() as Iterable<[string, number]>)
    .filter(([sec]) => sec !== "OTHERS")
    .map(([sec, avg]) => ({
      sector: sec,
      label:  SECTOR_LABELS[sec as keyof typeof SECTOR_LABELS] ?? sec,
      avgPctChange: avg,
      vsNifty: niftyPctChange !== null ? parseFloat((avg - niftyPctChange).toFixed(2)) : null,
      count: sectorSums.get(sec)?.count ?? 0,
    }))
    .sort((a, b) => b.avgPctChange - a.avgPctChange);

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
    marketRegime,
    niftyPctChange,
    sectorRanking,
  });
}
