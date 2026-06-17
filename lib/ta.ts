// ── Technical Analysis utilities ─────────────────────────────────────────────

// Exponential Moving Average (seed with SMA for first `period` bars)
export function calcEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  if (prices.length < period) return prices[prices.length - 1];
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

// RSI-14 using Wilder's smoothing
export function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  const slice = closes.slice(-(period + 1));
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i < slice.length; i++) {
    const diff = slice[i] - slice[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += -diff;
  }
  avgGain /= period;
  avgLoss /= period;
  if (avgLoss === 0) return 100;
  return parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(2));
}

// ATR-14 using Wilder's smoothing
export function calcATR(
  candles: { high: number; low: number; close: number }[],
  period = 14,
): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const { high, low } = candles[i];
    const prevClose = candles[i - 1].close;
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  if (trs.length === 0) return 0;
  if (trs.length < period) return trs.reduce((a, b) => a + b, 0) / trs.length;
  // Seed with simple average
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return parseFloat(atr.toFixed(2));
}

// RVOL: today's volume vs what we'd expect at this time of day (linear)
export function calcRVOL(currentVolume: number, avgDailyVol: number): number {
  if (avgDailyVol <= 0 || currentVolume <= 0) return 0;
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  const minsIntoDay = Math.max(1, ist.getUTCHours() * 60 + ist.getUTCMinutes() - 555);
  const fraction = Math.min(1, minsIntoDay / 375); // 375 min = full session
  const expectedVol = avgDailyVol * fraction;
  return parseFloat((currentVolume / expectedVol).toFixed(2));
}

// ── Pre-market score (0–100) ──────────────────────────────────────────────────
// Run on yesterday's close data. Measures trend structure + momentum + proximity
// to breakout level + liquidity. Higher = better setup for today's session.
export function calcPreScore(p: {
  close:    number;
  ema20:    number;
  ema50:    number | null;
  ema200:   number | null;
  rsi14:    number;
  avgVol20: number;
  high20d:  number;
}): number {
  let score = 0;

  // ── EMA trend quality (25 pts) ────────────────────────────────────────────
  // Awarded progressively: each layer adds points independent of others
  if (p.close > p.ema20) score += 8;
  if (p.ema50 !== null && p.ema20 > p.ema50) score += 8;
  if (
    p.ema200 !== null &&
    p.close > p.ema200 &&
    (p.ema50 === null || p.ema50 > p.ema200)
  ) score += 9;

  // ── RSI momentum zone (20 pts) ───────────────────────────────────────────
  if      (p.rsi14 >= 55 && p.rsi14 <= 70) score += 20; // sweet spot
  else if (p.rsi14 >= 50 && p.rsi14 <  55) score += 10; // building
  else if (p.rsi14 >  70 && p.rsi14 <= 78) score += 7;  // overbought but still running

  // ── Near 20-day high breakout level (25 pts) ─────────────────────────────
  const pctBelow = p.high20d > 0 ? ((p.high20d - p.close) / p.high20d) * 100 : 100;
  if      (pctBelow <= 0.5) score += 25; // at breakout
  else if (pctBelow <= 2)   score += 18; // very close
  else if (pctBelow <= 4)   score += 10; // approaching
  else if (pctBelow <= 7)   score += 4;  // on radar

  // ── Liquidity (15 pts) ───────────────────────────────────────────────────
  if      (p.avgVol20 >= 2_000_000) score += 15;
  else if (p.avgVol20 >= 500_000)   score += 10;
  else if (p.avgVol20 >= 100_000)   score += 5;

  return Math.min(100, Math.round(score));
}

// ── Market regime ─────────────────────────────────────────────────────────────
export type MarketRegime = "trend_up" | "trend_down" | "choppy" | "unknown";

export function detectRegime(nifty: {
  ltp:   number;
  vwap:  number;
  open:  number;
} | null): MarketRegime {
  if (!nifty || nifty.ltp <= 0 || nifty.open <= 0) return "unknown";
  const aboveVwap = nifty.ltp > nifty.vwap;
  const aboveOpen = nifty.ltp > nifty.open * 1.001; // 0.1% buffer to avoid noise
  const belowOpen = nifty.ltp < nifty.open * 0.999;
  if (aboveVwap && aboveOpen) return "trend_up";
  if (!aboveVwap && belowOpen) return "trend_down";
  return "choppy";
}

// ── Live composite score (0–100) — roadmap 100-pt framework ──────────────────
//
// Trend Quality     25 pts  — EMA20 / EMA50 stack / EMA200 position
// Relative Strength 20 pts  — stock return vs sector avg return
// Sector Strength   15 pts  — sector avg return vs Nifty return
// RVOL              15 pts  — volume surge confirmation
// ORB Quality       10 pts  — opening range breakout confirmation
// VWAP              5 pts   — price position vs intraday VWAP
// Market Regime     10 pts  — Nifty trend state
// ─────────────────────────────────────────────────────────
// Total             100 pts (hard-capped)
export function calcLiveScore(p: {
  // Trend quality inputs (daily EMA stack)
  ema20Bullish:  boolean;        // ltp > ema20
  ema50Stack:    boolean | null; // ema20 > ema50 (null when ema50 unavailable)
  ema200Bullish: boolean | null; // ltp > ema200 AND ema50 > ema200 (null when unavailable)
  // Live market inputs
  rvol:             number;
  orbBroken:        boolean | null;
  aboveVwap:        boolean;
  pctChange:        number;
  relativeStrength: number | null; // stock pctChange − sector avg pctChange
  sectorVsNifty:    number | null; // sector avg pctChange − nifty pctChange
  marketRegime:     MarketRegime;
}): number {
  let score = 0;

  // 1. Trend Quality (25 pts)
  if (p.ema20Bullish)              score += 8;
  if (p.ema50Stack === true)       score += 8;
  if (p.ema200Bullish === true)    score += 9;

  // 2. Relative Strength vs Sector (20 pts, -10 penalty if underperforming)
  if (p.relativeStrength !== null) {
    if      (p.relativeStrength > 2)   score += 20;
    else if (p.relativeStrength > 1)   score += 15;
    else if (p.relativeStrength > 0.5) score += 10;
    else if (p.relativeStrength > 0)   score += 5;
    else if (p.relativeStrength < 0)   score -= 10;
  } else {
    score += 7; // neutral when sector unknown (OTHERS)
  }

  // 3. Sector Strength vs Nifty (15 pts)
  if (p.sectorVsNifty !== null) {
    if      (p.sectorVsNifty > 1)   score += 15;
    else if (p.sectorVsNifty > 0.5) score += 10;
    else if (p.sectorVsNifty > 0)   score += 5;
    else if (p.sectorVsNifty < -1)  score -= 5;
  } else {
    score += 5; // neutral when Nifty data unavailable
  }

  // 4. RVOL (15 pts)
  if      (p.rvol >= 4)   score += 15;
  else if (p.rvol >= 3)   score += 12;
  else if (p.rvol >= 2)   score += 8;
  else if (p.rvol >= 1.5) score += 4;

  // 5. ORB Quality (10 pts)
  if      (p.orbBroken === true) score += 10;
  else if (p.orbBroken === null) score += 3;  // pre-9:30: give partial credit

  // 6. VWAP (5 pts)
  if (p.aboveVwap) score += 5;

  // 7. Market Regime (10 pts)
  if      (p.marketRegime === "trend_up")   score += 10;
  else if (p.marketRegime === "choppy")     score += 2;
  else if (p.marketRegime === "trend_down") score -= 5;
  // "unknown" = 0 pts (neutral)

  // Penalties: chasing a stock that already ran
  if      (p.pctChange > 6) score -= 15;
  else if (p.pctChange > 4) score -= 8;

  // Extra penalty: gap-and-go without volume
  if (p.pctChange > 4 && p.rvol < 3) score -= 5;

  return Math.min(100, Math.max(0, Math.round(score)));
}

export type SignalType = "breakout" | "buy_setup" | "watch" | "avoid" | "wait";

// Signal classification matches roadmap thresholds
export function classifySignal(
  liveScore:    number,
  rvol:         number,
  pctChange:    number,
  aboveEma20:   boolean,
  aboveEma50:   boolean | null,
  orbBroken:    boolean | null,
  marketRegime: MarketRegime = "unknown",
): SignalType {
  // Must be above EMA20, and above EMA50 when data is available
  const inUptrend = aboveEma20 && (aboveEma50 === null || aboveEma50 === true);
  const marketBullish = marketRegime !== "trend_down";

  // BREAKOUT BUY — all conditions confirmed
  if (
    inUptrend     &&
    liveScore >= 80 &&
    rvol >= 2     &&
    pctChange >= 0.5 &&
    orbBroken === true &&
    marketBullish
  ) return "breakout";

  // BUY SETUP — in trend, decent volume, waiting for ORB trigger
  if (
    inUptrend   &&
    liveScore >= 65 &&
    rvol >= 1.5 &&
    pctChange > 0
  ) return "buy_setup";

  if (liveScore >= 50) return "watch";
  if (pctChange < -1.5 || marketRegime === "trend_down") return "avoid";
  return "wait";
}
