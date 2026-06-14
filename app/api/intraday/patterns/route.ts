import { NextResponse } from "next/server";
import { detectPatterns, generateSignal, type Candle, type PatternMatch, type TradeSignal } from "@/lib/candlestick";

// Returns true during NSE regular trading hours (IST = UTC+5:30)
function isNSEOpen(): boolean {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const day = ist.getUTCDay();
  if (day === 0 || day === 6) return false;
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return mins >= 9 * 60 + 15 && mins < 15 * 60 + 30;
}

const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
};

async function fetchCandles(symbol: string, interval: string): Promise<Candle[]> {
  const range = interval === "60m" ? "5d" : "1d";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;
  try {
    const res = await fetch(url, { headers: YF_HEADERS, cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return [];
    const q = result.indicators?.quote?.[0] ?? {};
    const ts: number[] = result.timestamp ?? [];
    const opens: (number | null)[] = q.open ?? [];
    const highs: (number | null)[] = q.high ?? [];
    const lows:  (number | null)[] = q.low  ?? [];
    const closes:(number | null)[] = q.close ?? [];
    const vols:  (number | null)[] = q.volume ?? [];
    const candles: Candle[] = [];
    for (let i = 0; i < ts.length; i++) {
      if (opens[i] != null && highs[i] != null && lows[i] != null && closes[i] != null)
        candles.push({ open: opens[i]!, high: highs[i]!, low: lows[i]!, close: closes[i]!, volume: vols[i] ?? 0 });
    }
    // During trading hours the last candle is still forming (incomplete).
    // Always detect patterns on the last CLOSED candle only.
    const closed = isNSEOpen() ? candles.slice(0, -1) : candles;
    return closed.slice(-20); // 20 completed candles is enough for all patterns
  } catch {
    return [];
  }
}

export interface PatternResult {
  patterns15m: PatternMatch[];
  patterns1h:  PatternMatch[];
  signal:      TradeSignal | null;
  topPattern:  (PatternMatch & { timeframe: string }) | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols    = (searchParams.get("symbols")   ?? "").split(",").filter(Boolean).slice(0, 80);
  const scores     = (searchParams.get("scores")    ?? "").split(",").map(Number);
  const volRatios  = (searchParams.get("volRatios") ?? "").split(",").map(Number);
  const aboveVWAPs = (searchParams.get("aboveVWAP") ?? "").split(",").map(v => v === "1");
  const prices     = (searchParams.get("prices")    ?? "").split(",").map(Number);

  if (symbols.length === 0) return NextResponse.json({});

  const results: Record<string, PatternResult> = {};
  const BATCH = 40;

  for (let i = 0; i < symbols.length; i += BATCH) {
    const chunk = symbols.slice(i, i + BATCH);
    await Promise.allSettled(
      chunk.map(async (sym, j) => {
        const idx = i + j;
        const fullSym = sym.includes(".") ? sym : sym + ".NS";
        const [candles15m, candles1h] = await Promise.all([
          fetchCandles(fullSym, "15m"),
          fetchCandles(fullSym, "60m"),
        ]);

        const score        = scores[idx]     ?? 0;
        const volRatio     = volRatios[idx]  ?? 1;
        const aboveVWAP    = aboveVWAPs[idx] ?? false;
        const currentPrice = prices[idx] || undefined; // live price from main scoring

        const p15m = detectPatterns(candles15m);
        const p1h  = detectPatterns(candles1h);

        // Prefer 1h signal (higher quality), fall back to 15m
        // Pass live currentPrice so entry/SL/targets are based on actual market price
        const signal =
          generateSignal(candles1h,  p1h,  score, volRatio, aboveVWAP, "1h",  currentPrice) ??
          generateSignal(candles15m, p15m, score, volRatio, aboveVWAP, "15m", currentPrice);

        // Top display pattern: strong > moderate > weak, 1h preferred
        const ranked = [
          ...p1h.map(p  => ({ ...p, timeframe: "1h" })),
          ...p15m.map(p => ({ ...p, timeframe: "15m" })),
        ].sort((a, b) => {
          const sw: Record<string, number> = { strong: 3, moderate: 2, weak: 1 };
          return sw[b.strength] - sw[a.strength];
        });
        const topPattern = ranked[0] ?? null;

        results[sym] = { patterns15m: p15m, patterns1h: p1h, signal, topPattern };
      })
    );
  }

  return NextResponse.json(results);
}
