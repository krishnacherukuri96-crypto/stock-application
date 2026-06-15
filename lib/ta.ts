// ── Technical Analysis utilities ─────────────────────────────────────────────

// Exponential Moving Average (seed with SMA for first `period` bars)
export function calcEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  if (prices.length < period) return prices[prices.length - 1];
  const k = 2 / (period + 1);
  // Seed: simple average of first `period` values
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

// RSI-14 using Wilder's smoothing (last `period` price changes)
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

// RVOL: today's volume vs what we'd expect at this time of day
// avgDailyVol = 20-day average full-day volume
export function calcRVOL(currentVolume: number, avgDailyVol: number): number {
  if (avgDailyVol <= 0 || currentVolume <= 0) return 0;
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  const minsIntoDay = Math.max(1, ist.getUTCHours() * 60 + ist.getUTCMinutes() - 555); // since 9:15
  const fraction = Math.min(1, minsIntoDay / 375); // 375 min = full session
  const expectedVol = avgDailyVol * fraction;
  return parseFloat((currentVolume / expectedVol).toFixed(2));
}

// Pre-market score (0–100): how well does this stock look for today's session?
// Run on yesterday's close data. Higher = better technical setup.
export function calcPreScore(p: {
  close:    number;
  ema20:    number;
  ema50:    number | null;
  rsi14:    number;
  avgVol20: number;
  high20d:  number;
}): number {
  let score = 0;

  // ── EMA trend stack (30 pts) ──────────────────────────────────────────────
  if (p.ema50 !== null && p.close > p.ema20 && p.ema20 > p.ema50) score += 30; // full bull stack
  else if (p.close > p.ema20) score += 15;                                       // above 20 only

  // ── RSI momentum zone (25 pts) ───────────────────────────────────────────
  if      (p.rsi14 >= 55 && p.rsi14 <= 70) score += 25; // sweet spot
  else if (p.rsi14 >= 50 && p.rsi14 <  55) score += 12; // building
  else if (p.rsi14 >  70 && p.rsi14 <= 78) score += 8;  // overbought but still running

  // ── Near 20-day high (30 pts) ────────────────────────────────────────────
  const pctBelow = p.high20d > 0 ? ((p.high20d - p.close) / p.high20d) * 100 : 100;
  if      (pctBelow <= 0.5) score += 30; // AT breakout level
  else if (pctBelow <= 2)   score += 22; // very close
  else if (pctBelow <= 4)   score += 12; // approaching
  else if (pctBelow <= 7)   score += 5;  // on radar

  // ── Liquidity (15 pts) ───────────────────────────────────────────────────
  if      (p.avgVol20 >= 2_000_000) score += 15;
  else if (p.avgVol20 >= 500_000)   score += 10;
  else if (p.avgVol20 >= 100_000)   score += 5;

  return Math.min(100, Math.round(score));
}

// Live composite score (0–100): combines pre-score with real-time signals
export function calcLiveScore(p: {
  preScore:        number;
  rvol:            number;
  orbBroken:       boolean | null; // null = ORB not set yet (< 9:30)
  aboveVwap:       boolean;
  pctChange:       number;
}): number {
  // Pre-market setup counts for 50% of the live score
  let score = p.preScore * 0.5;

  // ── RVOL (30 pts) ────────────────────────────────────────────────────────
  if      (p.rvol >= 4)   score += 30;
  else if (p.rvol >= 3)   score += 24;
  else if (p.rvol >= 2)   score += 16;
  else if (p.rvol >= 1.5) score += 8;

  // ── ORB breakout (12 pts) ────────────────────────────────────────────────
  if      (p.orbBroken === true)  score += 12;
  else if (p.orbBroken === null)  score += 4; // pre-9:30, no penalty

  // ── VWAP position (8 pts) ────────────────────────────────────────────────
  if (p.aboveVwap) score += 8;

  // ── Penalty: already ran too much (chasing risk) ──────────────────────
  if      (p.pctChange > 6) score -= 15;
  else if (p.pctChange > 4) score -= 8;

  return Math.min(100, Math.max(0, Math.round(score)));
}

export type SignalType = "breakout" | "buy_setup" | "watch" | "avoid" | "wait";

export function classifySignal(liveScore: number, rvol: number, pctChange: number): SignalType {
  if (liveScore >= 75 && rvol >= 2 && pctChange > 0) return "breakout";
  if (liveScore >= 62 && pctChange > 0)              return "buy_setup";
  if (liveScore >= 45)                               return "watch";
  if (pctChange < -1.5)                              return "avoid";
  return "wait";
}
