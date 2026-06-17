import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDhanToken } from "@/lib/dhan";
import { calcRVOL } from "@/lib/ta";

function todayIST(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { symbol: string } },
) {
  try {
    const symbol = params.symbol.toUpperCase();
    const date   = todayIST();

    const uni = await prisma.scannerUniverse.findUnique({
      where:  { symbol },
      select: { securityId: true, name: true },
    });
    if (!uni) {
      return NextResponse.json({ error: `${symbol} not in scanner universe` }, { status: 404 });
    }

    const metrics = await prisma.dailyMetrics.findUnique({
      where: { symbol_date: { symbol, date } },
    });

    const creds = await getDhanToken();
    if (!creds) return NextResponse.json({ error: "Dhan not connected" }, { status: 503 });

    const { token, clientId } = creds;

    // Fetch today's 15-min intraday candles
    const [candleRes, quoteRes] = await Promise.all([
      fetch("https://api.dhan.co/v2/charts/intraday", {
        method: "POST",
        headers: { "access-token": token, "client-id": clientId, "Content-Type": "application/json" },
        body: JSON.stringify({
          securityId:      String(uni.securityId),
          exchangeSegment: "NSE_EQ",
          instrument:      "EQUITY",
          interval:        "15",
          fromDate:        date,
          toDate:          date,
        }),
        cache: "no-store",
      }),
      fetch("https://api.dhan.co/v2/marketfeed/quote", {
        method: "POST",
        headers: { "access-token": token, "client-id": clientId, "Content-Type": "application/json" },
        body:  JSON.stringify({ NSE_EQ: [uni.securityId] }),
        cache: "no-store",
      }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let candles: any[] = [];
    if (candleRes.ok) {
      const d = await candleRes.json();
      if (Array.isArray(d.open)) {
        candles = d.open.map((o: number, i: number) => ({
          // Convert Unix seconds → IST time string (HH:MM)
          time:   d.timestamp?.[i]
            ? new Date(d.timestamp[i] * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false })
            : `C${i + 1}`,
          ts:     d.timestamp?.[i] ?? 0,
          open:   o,
          high:   d.high[i],
          low:    d.low[i],
          close:  d.close[i],
          volume: d.volume?.[i] ?? 0,
        }));
      }
    }

    let quote = null;
    if (quoteRes.ok) {
      const qd = await quoteRes.json();
      quote = qd?.data?.NSE_EQ?.[String(uni.securityId)] ?? null;
    }

    const ltp       = quote?.last_price    ?? 0;
    const volume    = quote?.volume        ?? 0;
    const vwap      = quote?.average_price ?? 0;
    const prevClose = (quote?.ohlc?.close > 0 ? quote.ohlc.close : metrics?.close) ?? 0;
    const pctChange = prevClose > 0 ? parseFloat(((ltp - prevClose) / prevClose * 100).toFixed(2)) : 0;
    const rvol      = metrics ? calcRVOL(volume, metrics.avgVol20) : 0;

    return NextResponse.json({
      symbol,
      name:       uni.name,
      securityId: uni.securityId,
      date,
      candles,
      ltp,
      volume,
      vwap,
      pctChange,
      prevClose,
      rvol,
      orbHigh:   metrics?.orbHigh  ?? null,
      orbLow:    metrics?.orbLow   ?? null,
      preScore:  metrics?.preScore ?? null,
      ema20:     metrics?.ema20    ?? null,
      ema50:     metrics?.ema50    ?? null,
      rsi14:     metrics?.rsi14    ?? null,
      avgVol20:  metrics?.avgVol20 ?? null,
      close:     metrics?.close    ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
