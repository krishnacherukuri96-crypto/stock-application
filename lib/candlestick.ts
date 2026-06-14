export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PatternMatch {
  name: string;
  direction: "bullish" | "bearish" | "neutral";
  strength: "strong" | "moderate" | "weak";
  description: string;
}

export interface TradeSignal {
  action: "BUY" | "SELL";
  entry: number;
  stopLoss: number;
  target1: number;
  target2: number;
  riskReward: number;
  pattern: string;
  timeframe: string;
  reason: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const body       = (c: Candle) => Math.abs(c.close - c.open);
const totalRange = (c: Candle) => c.high - c.low || 0.0001;
const upShadow   = (c: Candle) => c.high - Math.max(c.open, c.close);
const loShadow   = (c: Candle) => Math.min(c.open, c.close) - c.low;
const isBull     = (c: Candle) => c.close >= c.open;
const isBear     = (c: Candle) => c.close < c.open;
const bodyRatio  = (c: Candle) => body(c) / totalRange(c);

// ─── Single-candle patterns ───────────────────────────────────────────────────
function detectDoji(c: Candle): PatternMatch | null {
  if (bodyRatio(c) < 0.1)
    return { name: "Doji", direction: "neutral", strength: "moderate",
      description: "Indecision — market at equilibrium; wait for confirmation" };
  return null;
}

function detectHammer(c: Candle): PatternMatch | null {
  const ls = loShadow(c), b = body(c), us = upShadow(c);
  if (b > 0 && ls >= 2 * b && us <= 0.5 * b)
    return { name: "Hammer", direction: "bullish",
      strength: ls >= 3 * b ? "strong" : "moderate",
      description: "Rejection of lower prices — bulls absorbed selling pressure" };
  return null;
}

function detectShootingStar(c: Candle): PatternMatch | null {
  const us = upShadow(c), b = body(c), ls = loShadow(c);
  if (b > 0 && us >= 2 * b && ls <= 0.5 * b)
    return { name: "Shooting Star", direction: "bearish",
      strength: us >= 3 * b ? "strong" : "moderate",
      description: "Rejection of higher prices — sellers overwhelmed buyers" };
  return null;
}

function detectMarubozu(c: Candle): PatternMatch | null {
  const r = totalRange(c);
  if (isBull(c) && upShadow(c) / r < 0.05 && loShadow(c) / r < 0.05 && bodyRatio(c) > 0.9)
    return { name: "Bullish Marubozu", direction: "bullish", strength: "strong",
      description: "Full bullish candle with no wicks — strong conviction buying" };
  if (isBear(c) && upShadow(c) / r < 0.05 && loShadow(c) / r < 0.05 && bodyRatio(c) > 0.9)
    return { name: "Bearish Marubozu", direction: "bearish", strength: "strong",
      description: "Full bearish candle with no wicks — strong conviction selling" };
  return null;
}

// ─── Two-candle patterns ──────────────────────────────────────────────────────
function detectEngulfing(prev: Candle, curr: Candle): PatternMatch | null {
  if (isBear(prev) && isBull(curr) && curr.open <= prev.close && curr.close >= prev.open)
    return { name: "Bullish Engulfing", direction: "bullish",
      strength: body(curr) > body(prev) * 1.5 ? "strong" : "moderate",
      description: "Current bull candle fully engulfs prior bear — buyers took control" };
  if (isBull(prev) && isBear(curr) && curr.open >= prev.close && curr.close <= prev.open)
    return { name: "Bearish Engulfing", direction: "bearish",
      strength: body(curr) > body(prev) * 1.5 ? "strong" : "moderate",
      description: "Current bear candle fully engulfs prior bull — sellers took control" };
  return null;
}

function detectHarami(prev: Candle, curr: Candle): PatternMatch | null {
  const pH = Math.max(prev.open, prev.close), pL = Math.min(prev.open, prev.close);
  const cH = Math.max(curr.open, curr.close), cL = Math.min(curr.open, curr.close);
  if (body(prev) > body(curr) * 2 && cH < pH && cL > pL) {
    if (isBear(prev) && isBull(curr))
      return { name: "Bullish Harami", direction: "bullish", strength: "weak",
        description: "Small bull candle inside prior bear — momentum slowing, possible reversal" };
    if (isBull(prev) && isBear(curr))
      return { name: "Bearish Harami", direction: "bearish", strength: "weak",
        description: "Small bear candle inside prior bull — upside momentum fading" };
  }
  return null;
}

function detectInsideBar(prev: Candle, curr: Candle): PatternMatch | null {
  if (curr.high <= prev.high && curr.low >= prev.low)
    return { name: "Inside Bar", direction: "neutral", strength: "weak",
      description: "Consolidation inside prior range — coiling for a breakout move" };
  return null;
}

// ─── Three-candle patterns ────────────────────────────────────────────────────
function detectMorningStar(c1: Candle, c2: Candle, c3: Candle): PatternMatch | null {
  if (isBear(c1) && bodyRatio(c2) < 0.3 && isBull(c3) &&
      c3.close > (c1.open + c1.close) / 2 && body(c1) > body(c2) * 2)
    return { name: "Morning Star", direction: "bullish", strength: "strong",
      description: "3-candle reversal: large bear → small body → large bull closes above bear midpoint" };
  return null;
}

function detectEveningStar(c1: Candle, c2: Candle, c3: Candle): PatternMatch | null {
  if (isBull(c1) && bodyRatio(c2) < 0.3 && isBear(c3) &&
      c3.close < (c1.open + c1.close) / 2 && body(c1) > body(c2) * 2)
    return { name: "Evening Star", direction: "bearish", strength: "strong",
      description: "3-candle reversal: large bull → small body → large bear closes below bull midpoint" };
  return null;
}

function detectThreeWhiteSoldiers(c1: Candle, c2: Candle, c3: Candle): PatternMatch | null {
  if (
    isBull(c1) && isBull(c2) && isBull(c3) &&
    c2.open > c1.open && c2.open < c1.close &&
    c3.open > c2.open && c3.open < c2.close &&
    c3.close > c2.close && c2.close > c1.close &&
    bodyRatio(c1) > 0.5 && bodyRatio(c2) > 0.5 && bodyRatio(c3) > 0.5
  )
    return { name: "Three White Soldiers", direction: "bullish", strength: "strong",
      description: "3 consecutive rising bull candles opening within prior body — strong uptrend resuming" };
  return null;
}

function detectThreeBlackCrows(c1: Candle, c2: Candle, c3: Candle): PatternMatch | null {
  if (
    isBear(c1) && isBear(c2) && isBear(c3) &&
    c2.open < c1.open && c2.open > c1.close &&
    c3.open < c2.open && c3.open > c2.close &&
    c3.close < c2.close && c2.close < c1.close &&
    bodyRatio(c1) > 0.5 && bodyRatio(c2) > 0.5 && bodyRatio(c3) > 0.5
  )
    return { name: "Three Black Crows", direction: "bearish", strength: "strong",
      description: "3 consecutive falling bear candles — strong institutional selling" };
  return null;
}

// ─── Run all detections on candle array (uses last 3 candles) ─────────────────
export function detectPatterns(candles: Candle[]): PatternMatch[] {
  if (candles.length < 1) return [];
  const results: PatternMatch[] = [];
  const n = candles.length;
  const c0 = candles[n - 1];
  const c1 = n >= 2 ? candles[n - 2] : null;
  const c2 = n >= 3 ? candles[n - 3] : null;

  for (const fn of [detectDoji, detectHammer, detectShootingStar, detectMarubozu]) {
    const r = fn(c0); if (r) results.push(r);
  }
  if (c1) {
    for (const fn of [detectEngulfing, detectHarami, detectInsideBar]) {
      const r = fn(c1, c0); if (r) results.push(r);
    }
  }
  if (c1 && c2) {
    for (const fn of [detectMorningStar, detectEveningStar, detectThreeWhiteSoldiers, detectThreeBlackCrows]) {
      const r = fn(c2, c1, c0); if (r) results.push(r);
    }
  }
  return results;
}

// ─── Signal generation ────────────────────────────────────────────────────────
const STRENGTH_RANK: Record<PatternMatch["strength"], number> = { strong: 3, moderate: 2, weak: 1 };

const MAX_SL_PCT  = 0.007; // intraday SL capped at 0.7% from entry
const ENTRY_SLIP  = 0.001; // 0.1% buffer above/below current price for entry

export function generateSignal(
  candles: Candle[],
  patterns: PatternMatch[],
  score: number,
  volumeRatio: number,
  aboveVWAP: boolean,
  timeframe: string,
  currentPrice?: number, // live price from main scoring data
): TradeSignal | null {
  if (!patterns.length || candles.length < 1) return null;
  const last = candles[candles.length - 1];
  // Use live current price when available; fall back to last completed candle close
  const livePrice = currentPrice ?? last.close;

  const bullish = patterns
    .filter(p => p.direction === "bullish")
    .sort((a, b) => STRENGTH_RANK[b.strength] - STRENGTH_RANK[a.strength]);
  const bearish = patterns
    .filter(p => p.direction === "bearish")
    .sort((a, b) => STRENGTH_RANK[b.strength] - STRENGTH_RANK[a.strength]);

  // BUY: bullish pattern + score ≥ 70 + meaningful volume + above VWAP
  if (bullish.length > 0 && score >= 70 && volumeRatio >= 1.5 && aboveVWAP) {
    const top  = bullish[0];
    // Entry slightly above live price (0.1% slip buffer for market order)
    const entry = parseFloat((livePrice * (1 + ENTRY_SLIP)).toFixed(2));
    // SL = last candle low, but never more than 0.7% below entry (intraday cap)
    const candleSL  = last.low;
    const maxSL     = entry * (1 - MAX_SL_PCT);
    const stopLoss  = parseFloat(Math.max(candleSL, maxSL).toFixed(2));
    const risk      = parseFloat((entry - stopLoss).toFixed(2));
    if (risk <= 0) return null;
    return {
      action: "BUY",
      entry,
      stopLoss,
      target1: parseFloat((entry + risk).toFixed(2)),
      target2: parseFloat((entry + risk * 2).toFixed(2)),
      riskReward: 2,
      pattern: top.name,
      timeframe,
      reason: `${top.name} · ${timeframe} · Score ${score} · ${volumeRatio}x vol · Above VWAP`,
    };
  }

  // SELL: bearish pattern + below VWAP + meaningful volume
  if (bearish.length > 0 && !aboveVWAP && volumeRatio >= 1.5) {
    const top  = bearish[0];
    const entry = parseFloat((livePrice * (1 - ENTRY_SLIP)).toFixed(2));
    const candleSL  = last.high;
    const maxSL     = entry * (1 + MAX_SL_PCT);
    const stopLoss  = parseFloat(Math.min(candleSL, maxSL).toFixed(2));
    const risk      = parseFloat((stopLoss - entry).toFixed(2));
    if (risk <= 0) return null;
    return {
      action: "SELL",
      entry,
      stopLoss,
      target1: parseFloat((entry - risk).toFixed(2)),
      target2: parseFloat((entry - risk * 2).toFixed(2)),
      riskReward: 2,
      pattern: top.name,
      timeframe,
      reason: `${top.name} · ${timeframe} · Score ${score} · ${volumeRatio}x vol · Below VWAP`,
    };
  }

  return null;
}
