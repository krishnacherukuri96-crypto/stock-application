"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { calcRVOL, calcLiveScore, classifySignal } from "@/lib/ta";

// ── Types ─────────────────────────────────────────────────────────────────────

type SignalType = "breakout" | "buy_setup" | "watch" | "avoid" | "wait";
type MarketRegime = "trend_up" | "trend_down" | "choppy" | "unknown";

interface ScannerStock {
  symbol:           string;
  name:             string;
  sector:           string;
  sectorLabel:      string;
  ltp:              number;
  open:             number;
  high:             number;
  low:              number;
  volume:           number;
  pctChange:        number;
  rvol:             number;
  rsi14:            number;
  ema20:            number;
  ema50:            number | null;
  ema200:           number | null;
  atr14:            number | null;
  suggestedSL:      number | null;
  aboveEma20:       boolean;
  aboveEma50:       boolean | null;
  aboveEma200:      boolean | null;
  aboveVwap:        boolean;
  orbBroken:        boolean | null;
  orbBelow:         boolean | null;
  orbHigh:          number | null;
  orbLow:           number | null;
  high20d:          number;
  pctFromBreakout:  number | null;
  relativeStrength: number | null;
  sectorPctChange:  number | null;
  sectorVsNifty:    number | null;
  preScore:         number;
  liveScore:        number;
  signal:           SignalType;
}

interface SectorEntry {
  sector:       string;
  label:        string;
  avgPctChange: number;
  vsNifty:      number | null;
  count:        number;
}

interface ScannerCounts {
  breakout:  number;
  buy_setup: number;
  watch:     number;
  avoid:     number;
  rvolSpike: number;
}

interface ScannerResponse {
  stocks:         ScannerStock[];
  counts:         ScannerCounts;
  total:          number;
  fetchedAt:      string;
  marketOpen:     boolean;
  date:           string;
  orbReady:       boolean;
  marketRegime:   MarketRegime;
  niftyPctChange: number | null;
  sectorRanking:  SectorEntry[];
  status?:        string;
  message?:       string;
  error?:         string;
}

// ── Trade tracking types ──────────────────────────────────────────────────────

interface ActiveTrade {
  id:         string;   // symbol + entryTime ms
  symbol:     string;
  name:       string;
  entryPrice: number;
  qty:        number;
  stopLoss:   number;
  target:     number;
  entryTime:  string;   // ISO
  date:       string;   // YYYY-MM-DD IST — auto-close next day
}

type ExitReason =
  | "stop_hit"
  | "target_hit"
  | "signal_avoid"
  | "vwap_break"
  | "volume_dry"
  | "orb_failed"
  | "hold";

interface TradeAlert {
  reason:  ExitReason;
  urgent:  boolean;
  message: string;
  pnl:     number;
  pnlPct:  number;
}

function todayISTStr(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

function getTradeAlert(trade: ActiveTrade, stock: ScannerStock | undefined): TradeAlert {
  const pnl    = stock ? (stock.ltp - trade.entryPrice) * trade.qty : 0;
  const pnlPct = stock ? ((stock.ltp - trade.entryPrice) / trade.entryPrice) * 100 : 0;

  if (!stock) {
    return { reason: "hold", urgent: false, message: "Waiting for data…", pnl, pnlPct };
  }

  const ltp  = stock.ltp;
  const risk = trade.entryPrice - trade.stopLoss;

  // 1. Stop loss hit
  if (ltp <= trade.stopLoss) {
    return { reason: "stop_hit", urgent: true, message: "🔴 STOP LOSS HIT — EXIT NOW", pnl, pnlPct };
  }

  // 2. Target hit
  if (ltp >= trade.target) {
    return { reason: "target_hit", urgent: true, message: "🟢 TARGET HIT — BOOK PROFIT NOW", pnl, pnlPct };
  }

  // 3. Signal flipped to avoid
  if (stock.signal === "avoid") {
    return { reason: "signal_avoid", urgent: true, message: "🔴 Signal reversed — EXIT NOW", pnl, pnlPct };
  }

  // 4. ORB failed (price went back below ORB — breakout was fake)
  if (stock.orbBelow === true) {
    return { reason: "orb_failed", urgent: true, message: "🔴 ORB breakout failed — EXIT NOW", pnl, pnlPct };
  }

  // 5. Dropped below VWAP while in loss
  if (!stock.aboveVwap && pnlPct < 0) {
    return { reason: "vwap_break", urgent: false, message: "🟡 Below VWAP with loss — tighten stop", pnl, pnlPct };
  }

  // 6. Volume drying up with profit — protect gains
  if (stock.rvol < 1.2 && pnlPct > 0) {
    return { reason: "volume_dry", urgent: false, message: "🟡 Volume fading — consider booking partial profit", pnl, pnlPct };
  }

  // 7. Moved past 1R in profit — trail the stop
  if (pnl > risk * trade.qty && pnlPct > 0) {
    return { reason: "hold", urgent: false, message: `✅ Up +${fmt(pnlPct, 1)}% — Trail stop to entry (risk-free)`, pnl, pnlPct };
  }

  return { reason: "hold", urgent: false, message: `Hold — momentum intact (${fmt(pnlPct, 1)}%)`, pnl, pnlPct };
}

// ── localStorage helpers ──────────────────────────────────────────────────────

const STORAGE_KEY = "scanner_active_trades";

function loadTrades(): ActiveTrade[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const trades: ActiveTrade[] = JSON.parse(raw);
    // Auto-close trades from previous days
    const today = todayISTStr();
    return trades.filter(t => t.date === today);
  } catch { return []; }
}

function saveTrades(trades: ActiveTrade[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

// ── Constants ─────────────────────────────────────────────────────────────────

type FilterKey = "all" | "breakout" | "buy_setup" | "watch";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",       label: "All"           },
  { key: "breakout",  label: "🔥 Breakout"   },
  { key: "buy_setup", label: "✅ Buy Setup"  },
  { key: "watch",     label: "👀 Watch"      },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, d = 2): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return n.toFixed(d);
}

function fmtCurrency(n: number): string {
  return `${n >= 0 ? "+" : ""}₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── UI Components ─────────────────────────────────────────────────────────────

function SignalBadge({ signal }: { signal: SignalType }) {
  const cfg: Record<SignalType, { label: string; cls: string }> = {
    breakout:  { label: "🔥 Breakout",  cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    buy_setup: { label: "✅ Buy Setup", cls: "bg-blue-100 text-blue-800 border-blue-200"          },
    watch:     { label: "👀 Watch",     cls: "bg-amber-100 text-amber-700 border-amber-200"       },
    avoid:     { label: "🚫 Avoid",     cls: "bg-red-100 text-red-700 border-red-200"             },
    wait:      { label: "— Wait",       cls: "bg-gray-100 text-gray-500 border-gray-200"          },
  };
  const { label, cls } = cfg[signal];
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 75 ? "bg-emerald-600 text-white"
    : score >= 60 ? "bg-blue-500 text-white"
    : score >= 45 ? "bg-amber-400 text-white"
    : "bg-gray-200 text-gray-600";
  return (
    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold ${cls}`}>
      {score}
    </span>
  );
}

function RvolBar({ rvol }: { rvol: number }) {
  const pct   = Math.min(100, (rvol / 4) * 100);
  const color = rvol >= 3 ? "bg-emerald-500" : rvol >= 2 ? "bg-blue-500" : rvol >= 1.5 ? "bg-amber-400" : "bg-gray-300";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 bg-gray-100 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono font-semibold ${rvol >= 2 ? "text-emerald-600" : "text-gray-500"}`}>
        {fmt(rvol, 1)}x
      </span>
    </div>
  );
}

function EmaStack({
  aboveEma20, aboveEma50, aboveEma200,
}: {
  aboveEma20: boolean; aboveEma50: boolean | null; aboveEma200: boolean | null;
}) {
  const fullBull = aboveEma20 && aboveEma50 === true && aboveEma200 !== false;
  const partBull = aboveEma20 && (aboveEma50 === true || aboveEma50 === null);
  if (fullBull && aboveEma200 === true) return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-bold text-emerald-700">▲ Full Bull</span>
      <span className="text-[9px] text-emerald-500">20 · 50 · 200</span>
    </div>
  );
  if (partBull) return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-emerald-600">▲ Bull</span>
      {aboveEma200 === false && <span className="text-[9px] text-amber-500">Below 200D</span>}
      {aboveEma200 === null  && <span className="text-[9px] text-gray-400">200D N/A</span>}
    </div>
  );
  if (aboveEma20) return <span className="text-xs text-amber-500">~ Mixed</span>;
  return <span className="text-xs text-red-400">▼ Bear</span>;
}

function ORBStatus({ orbBroken, orbBelow }: { orbBroken: boolean | null; orbBelow: boolean | null }) {
  if (orbBroken === null) return <span className="text-xs text-gray-400">—</span>;
  if (orbBroken)          return <span className="text-xs font-semibold text-emerald-600">✓ Above</span>;
  if (orbBelow)           return <span className="text-xs text-red-500">↓ Below</span>;
  return <span className="text-xs text-amber-500">Inside</span>;
}

// ── Buy Modal ─────────────────────────────────────────────────────────────────

function BuyModal({
  stock,
  onConfirm,
  onClose,
}: {
  stock: ScannerStock;
  onConfirm: (trade: ActiveTrade) => void;
  onClose: () => void;
}) {
  // Priority: ATR-based SL → ORB Low → 1% below LTP
  const defaultStop = stock.suggestedSL
    ? stock.suggestedSL
    : stock.orbLow
      ? parseFloat(stock.orbLow.toFixed(2))
      : parseFloat((stock.ltp * 0.99).toFixed(2));

  const defaultRisk     = parseFloat((stock.ltp - defaultStop).toFixed(2));
  const defaultTarget   = parseFloat((stock.ltp + defaultRisk * 2).toFixed(2));

  const [entryPrice, setEntryPrice] = useState(String(stock.ltp.toFixed(2)));
  const [qty,        setQty]        = useState("1");
  const [stopLoss,   setStopLoss]   = useState(String(defaultStop));
  const [target,     setTarget]     = useState(String(defaultTarget));

  // Auto-recalculate target when entry or stop changes
  function recalc(entry: string, stop: string) {
    const e = parseFloat(entry);
    const s = parseFloat(stop);
    if (isFinite(e) && isFinite(s) && e > s) {
      setTarget(String((e + (e - s) * 2).toFixed(2)));
    }
  }

  function handleEntry(v: string) { setEntryPrice(v); recalc(v, stopLoss); }
  function handleStop(v: string)  { setStopLoss(v);   recalc(entryPrice, v); }

  const e = parseFloat(entryPrice);
  const s = parseFloat(stopLoss);
  const t = parseFloat(target);
  const q = parseInt(qty) || 1;

  const risk    = isFinite(e) && isFinite(s) ? (e - s) * q : null;
  const reward  = isFinite(e) && isFinite(t) ? (t - e) * q : null;
  const rr      = risk && reward && risk > 0 ? (reward / risk).toFixed(1) : null;
  const valid   = isFinite(e) && isFinite(s) && isFinite(t) && e > s && t > e && q > 0;

  function confirm() {
    if (!valid) return;
    const trade: ActiveTrade = {
      id:         `${stock.symbol}_${Date.now()}`,
      symbol:     stock.symbol,
      name:       stock.name,
      entryPrice: e,
      qty:        q,
      stopLoss:   s,
      target:     t,
      entryTime:  new Date().toISOString(),
      date:       todayISTStr(),
    };
    onConfirm(trade);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-emerald-50 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Buy {stock.symbol}</h2>
            <p className="text-xs text-gray-500">{stock.name}</p>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono font-bold text-gray-900">₹{fmt(stock.ltp)}</div>
            <div className={`text-xs ${stock.pctChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {stock.pctChange >= 0 ? "+" : ""}{fmt(stock.pctChange)}% today
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Entry price */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Entry Price (₹)
            </label>
            <input
              type="number"
              value={entryPrice}
              onChange={e => handleEntry(e.target.value)}
              className="w-full px-3 py-2.5 border rounded-lg font-mono text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-gray-400 mt-1">Current LTP pre-filled. Edit if you got a different fill.</p>
          </div>

          {/* Qty */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Quantity (shares)
            </label>
            <input
              type="number"
              min="1"
              value={qty}
              onChange={e => setQty(e.target.value)}
              className="w-full px-3 py-2.5 border rounded-lg font-mono text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Stop loss + Target */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-red-500 mb-1.5 uppercase tracking-wide">
                Stop Loss (₹)
              </label>
              <input
                type="number"
                value={stopLoss}
                onChange={e => handleStop(e.target.value)}
                className="w-full px-3 py-2.5 border border-red-200 rounded-lg font-mono text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              {stock.orbLow && (
                <p className="text-[11px] text-gray-400 mt-1">Auto: ORB Low = ₹{fmt(stock.orbLow)}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-emerald-600 mb-1.5 uppercase tracking-wide">
                Target (₹)
              </label>
              <input
                type="number"
                value={target}
                onChange={e => setTarget(e.target.value)}
                className="w-full px-3 py-2.5 border border-emerald-200 rounded-lg font-mono text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <p className="text-[11px] text-gray-400 mt-1">Auto: 2× risk</p>
            </div>
          </div>

          {/* R:R summary */}
          {risk !== null && reward !== null && (
            <div className={`rounded-xl p-3 text-sm grid grid-cols-3 gap-2 text-center ${valid ? "bg-gray-50 border" : "bg-red-50 border border-red-200"}`}>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Risk</div>
                <div className="font-semibold text-red-600">₹{fmt(risk, 0)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Reward</div>
                <div className="font-semibold text-emerald-600">₹{fmt(reward, 0)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">R:R</div>
                <div className={`font-bold ${rr && parseFloat(rr) >= 2 ? "text-emerald-700" : "text-amber-600"}`}>
                  1 : {rr ?? "—"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={!valid}
            className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Confirm Buy
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Active Trades Panel ───────────────────────────────────────────────────────

function ActiveTradesPanel({
  trades,
  stockMap,
  onExit,
}: {
  trades:   ActiveTrade[];
  stockMap: Map<string, ScannerStock>;
  onExit:   (id: string) => void;
}) {
  if (trades.length === 0) return null;

  const urgentCount = trades.filter(t => {
    const alert = getTradeAlert(t, stockMap.get(t.symbol));
    return alert.urgent;
  }).length;

  return (
    <div className={`mb-5 rounded-2xl border-2 overflow-hidden shadow-sm ${urgentCount > 0 ? "border-red-400" : "border-emerald-400"}`}>
      {/* Panel header */}
      <div className={`px-5 py-3 flex items-center justify-between ${urgentCount > 0 ? "bg-red-50" : "bg-emerald-50"}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${urgentCount > 0 ? "bg-red-500" : "bg-emerald-500"}`} />
          <h2 className="font-bold text-gray-900 text-sm">
            My Active Trades ({trades.length})
          </h2>
          {urgentCount > 0 && (
            <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
              {urgentCount} ACTION NEEDED
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">Live-monitored · auto-closes at market end</span>
      </div>

      {/* Trades */}
      <div className="bg-white divide-y">
        {trades.map(trade => {
          const stock = stockMap.get(trade.symbol);
          const alert = getTradeAlert(trade, stock);
          const ltp   = stock?.ltp ?? trade.entryPrice;

          const pnlPerShare = ltp - trade.entryPrice;
          const totalPnl    = pnlPerShare * trade.qty;
          const pnlPct      = (pnlPerShare / trade.entryPrice) * 100;

          // Progress bar: how close to target vs stop
          const range       = trade.target - trade.stopLoss;
          const progress    = range > 0 ? Math.max(0, Math.min(100, ((ltp - trade.stopLoss) / range) * 100)) : 50;

          return (
            <div key={trade.id} className={`px-5 py-4 ${alert.urgent ? "bg-red-50/60" : ""}`}>
              <div className="flex flex-wrap items-start gap-4">
                {/* Stock info */}
                <div className="min-w-[100px]">
                  <div className="font-bold text-gray-900">{trade.symbol}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(trade.entryTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {trade.qty} shares
                  </div>
                </div>

                {/* Price comparison */}
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="text-center">
                    <div className="text-[10px] text-gray-400 uppercase">Entry</div>
                    <div className="font-mono text-sm font-semibold text-gray-700">₹{fmt(trade.entryPrice)}</div>
                  </div>
                  <div className="text-gray-300">→</div>
                  <div className="text-center">
                    <div className="text-[10px] text-gray-400 uppercase">LTP</div>
                    <div className={`font-mono text-sm font-bold ${pnlPerShare >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      ₹{fmt(ltp)}
                    </div>
                  </div>
                  <div className={`text-center px-3 py-1.5 rounded-lg ${totalPnl >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                    <div className="text-[10px] text-gray-400 uppercase">P&amp;L</div>
                    <div className={`font-bold text-sm ${totalPnl >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {fmtCurrency(totalPnl)}
                      <span className="text-[11px] ml-1 font-normal">({pnlPct >= 0 ? "+" : ""}{fmt(pnlPct, 1)}%)</span>
                    </div>
                  </div>
                </div>

                {/* Stop / Target */}
                <div className="flex-1 min-w-[180px]">
                  <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                    <span className="text-red-500 font-medium">Stop ₹{fmt(trade.stopLoss)}</span>
                    <span className="text-emerald-600 font-medium">Target ₹{fmt(trade.target)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-700 ${
                        progress >= 70 ? "bg-emerald-500" : progress >= 40 ? "bg-blue-400" : "bg-red-400"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5 text-center">
                    {fmt(progress, 0)}% toward target
                  </div>
                </div>

                {/* Alert + Action */}
                <div className="flex flex-col items-end gap-2">
                  <div className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
                    alert.urgent
                      ? "bg-red-100 text-red-700 animate-pulse"
                      : alert.reason === "hold"
                        ? "bg-gray-100 text-gray-600"
                        : "bg-amber-100 text-amber-700"
                  }`}>
                    {alert.message}
                  </div>
                  <button
                    onClick={() => onExit(trade.id)}
                    className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    Sell / Exit
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Stock Detail Modal ────────────────────────────────────────────────────────

interface Candle {
  time: string; ts: number;
  open: number; high: number; low: number; close: number; volume: number;
}

interface StockDetail {
  symbol: string; name: string; securityId: number; date: string;
  candles: Candle[]; ltp: number; volume: number; vwap: number;
  pctChange: number; prevClose: number; rvol: number;
  orbHigh: number | null; orbLow: number | null;
  preScore: number | null; ema20: number | null; ema50: number | null;
  rsi14: number | null; avgVol20: number | null; close: number | null;
  error?: string;
}

function CandleChart({ candles, orbHigh, orbLow, vwap, ema20, ema50 }: {
  candles: Candle[]; orbHigh: number | null; orbLow: number | null;
  vwap: number | null; ema20: number | null; ema50: number | null;
}) {
  if (candles.length === 0) return (
    <div className="h-48 flex items-center justify-center text-sm text-gray-400">No intraday candles yet</div>
  );

  const W = 560, CH = 170, VH = 36;
  const PAD = { l: 50, r: 12, t: 8, b: 20 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = CH - PAD.t - PAD.b;

  const allP = candles.flatMap(c => [c.high, c.low]);
  if (orbHigh) allP.push(orbHigh);
  if (orbLow)  allP.push(orbLow);
  if (vwap)    allP.push(vwap);
  if (ema20)   allP.push(ema20);
  if (ema50)   allP.push(ema50);

  const pMin  = Math.min(...allP);
  const pMax  = Math.max(...allP);
  const pad   = (pMax - pMin) * 0.05 || 1;
  const lo    = pMin - pad;
  const hi    = pMax + pad;
  const range = hi - lo;

  const toY = (p: number) => PAD.t + chartH - ((p - lo) / range) * chartH;
  const n   = candles.length;
  const slW = chartW / n;
  const bW  = Math.max(2, slW * 0.55);
  const toX = (i: number) => PAD.l + i * slW + slW / 2;

  const maxVol = Math.max(...candles.map(c => c.volume), 1);

  // Y grid lines (4 levels)
  const gridPrices = [0, 0.25, 0.5, 0.75, 1].map(f => lo + range * f);

  return (
    <svg viewBox={`0 0 ${W} ${CH + VH + 8}`} className="w-full" style={{ fontFamily: "monospace" }}>
      {/* Grid */}
      {gridPrices.map((p, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={toY(p)} x2={W - PAD.r} y2={toY(p)} stroke="#e5e7eb" strokeWidth={0.5} />
          <text x={PAD.l - 4} y={toY(p) + 3.5} textAnchor="end" fontSize={8} fill="#9ca3af">
            {p.toFixed(p > 100 ? 0 : 1)}
          </text>
        </g>
      ))}

      {/* ORB High */}
      {orbHigh && (
        <g>
          <line x1={PAD.l} y1={toY(orbHigh)} x2={W - PAD.r} y2={toY(orbHigh)} stroke="#16a34a" strokeWidth={1.5} strokeDasharray="5,3" />
          <text x={W - PAD.r + 2} y={toY(orbHigh) + 3} fontSize={7} fill="#16a34a">ORB H</text>
        </g>
      )}
      {/* ORB Low */}
      {orbLow && (
        <g>
          <line x1={PAD.l} y1={toY(orbLow)} x2={W - PAD.r} y2={toY(orbLow)} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="5,3" />
          <text x={W - PAD.r + 2} y={toY(orbLow) + 3} fontSize={7} fill="#dc2626">ORB L</text>
        </g>
      )}
      {/* VWAP */}
      {vwap && vwap > 0 && (
        <g>
          <line x1={PAD.l} y1={toY(vwap)} x2={W - PAD.r} y2={toY(vwap)} stroke="#6366f1" strokeWidth={1.5} strokeDasharray="8,3" />
          <text x={W - PAD.r + 2} y={toY(vwap) + 3} fontSize={7} fill="#6366f1">VWAP</text>
        </g>
      )}
      {/* EMA20 */}
      {ema20 && ema20 > 0 && (
        <line x1={PAD.l} y1={toY(ema20)} x2={W - PAD.r} y2={toY(ema20)} stroke="#f59e0b" strokeWidth={1} strokeDasharray="3,2" />
      )}
      {/* EMA50 */}
      {ema50 && ema50 > 0 && (
        <line x1={PAD.l} y1={toY(ema50)} x2={W - PAD.r} y2={toY(ema50)} stroke="#8b5cf6" strokeWidth={1} strokeDasharray="3,2" />
      )}

      {/* Candles */}
      {candles.map((c, i) => {
        const x      = toX(i);
        const green  = c.close >= c.open;
        const color  = green ? "#16a34a" : "#dc2626";
        const bodyT  = toY(Math.max(c.open, c.close));
        const bodyB  = toY(Math.min(c.open, c.close));
        const bodyH  = Math.max(1, bodyB - bodyT);
        const volH   = (c.volume / maxVol) * VH;
        return (
          <g key={i}>
            {/* Wick */}
            <line x1={x} y1={toY(c.high)} x2={x} y2={toY(c.low)} stroke={color} strokeWidth={1} />
            {/* Body */}
            <rect x={x - bW / 2} y={bodyT} width={bW} height={bodyH} fill={color} rx={0.5} />
            {/* Time label every ~4 candles */}
            {i % Math.max(1, Math.floor(n / 6)) === 0 && (
              <text x={x} y={CH + 2} textAnchor="middle" fontSize={7} fill="#9ca3af">{c.time}</text>
            )}
            {/* Volume */}
            <rect x={x - bW / 2} y={CH + 8 + VH - volH} width={bW} height={volH} fill={green ? "#bbf7d0" : "#fecaca"} rx={0.5} />
          </g>
        );
      })}

      {/* Legend */}
      <g transform={`translate(${PAD.l}, ${CH + VH + 4})`}>
        <circle cx={0} cy={0} r={3} fill="#16a34a" />
        <text x={5} y={3} fontSize={7} fill="#6b7280">ORB H</text>
        <circle cx={40} cy={0} r={3} fill="#dc2626" />
        <text x={45} y={3} fontSize={7} fill="#6b7280">ORB L</text>
        <circle cx={80} cy={0} r={3} fill="#6366f1" />
        <text x={85} y={3} fontSize={7} fill="#6b7280">VWAP</text>
        <circle cx={115} cy={0} r={3} fill="#f59e0b" />
        <text x={120} y={3} fontSize={7} fill="#6b7280">EMA20</text>
        <circle cx={155} cy={0} r={3} fill="#8b5cf6" />
        <text x={160} y={3} fontSize={7} fill="#6b7280">EMA50</text>
      </g>
    </svg>
  );
}

function StockDetailModal({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/scanner/stock/${symbol}`)
      .then(r => r.json())
      .then(d => { setDetail(d); setLoading(false); })
      .catch(() => { setDetail({ error: "Failed to load" } as StockDetail); setLoading(false); });
  }, [symbol]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mt-6 overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{symbol}</h2>
            <p className="text-xs text-gray-500">{detail?.name ?? "…"}</p>
          </div>
          {detail && !loading && !detail.error && (
            <div className="text-right">
              <div className="text-xl font-mono font-bold text-gray-900">₹{detail.ltp.toFixed(2)}</div>
              <div className={`text-sm font-semibold ${detail.pctChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {detail.pctChange >= 0 ? "+" : ""}{detail.pctChange.toFixed(2)}% · prev ₹{detail.prevClose.toFixed(2)}
              </div>
            </div>
          )}
          <button onClick={onClose} className="ml-4 text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        {loading && (
          <div className="p-12 text-center text-gray-400 text-sm">Loading candles…</div>
        )}

        {!loading && detail?.error && (
          <div className="p-6 text-red-600 text-sm">{detail.error}</div>
        )}

        {!loading && detail && !detail.error && (
          <>
            {/* Key metrics */}
            <div className="grid grid-cols-4 gap-px bg-gray-100 border-b">
              {[
                { label: "Pre Score",  value: detail.preScore ?? "—"           },
                { label: "RSI-14",     value: detail.rsi14?.toFixed(1) ?? "—"  },
                { label: "RVOL",       value: `${detail.rvol.toFixed(1)}x`     },
                { label: "VWAP",       value: `₹${detail.vwap.toFixed(2)}`     },
                { label: "EMA 20",     value: detail.ema20 ? `₹${detail.ema20.toFixed(2)}` : "—" },
                { label: "EMA 50",     value: detail.ema50 ? `₹${detail.ema50.toFixed(2)}` : "—" },
                { label: "ORB High",   value: detail.orbHigh ? `₹${detail.orbHigh.toFixed(2)}` : "Not set" },
                { label: "ORB Low",    value: detail.orbLow  ? `₹${detail.orbLow.toFixed(2)}`  : "Not set" },
              ].map(m => (
                <div key={m.label} className="bg-white px-3 py-2.5">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide">{m.label}</div>
                  <div className="text-sm font-semibold text-gray-900 font-mono">{String(m.value)}</div>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="px-4 pt-3 pb-1">
              <p className="text-[10px] text-gray-400 mb-1">Today&apos;s 15-min candles · {detail.candles.length} candles</p>
              <CandleChart
                candles={detail.candles}
                orbHigh={detail.orbHigh}
                orbLow={detail.orbLow}
                vwap={detail.vwap > 0 ? detail.vwap : null}
                ema20={detail.ema20}
                ema50={detail.ema50}
              />
            </div>

            {/* Candle data table for validation */}
            <div className="px-4 pb-4">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Raw Candle Data (validate against Dhan)</p>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      {["Time", "Open", "High", "Low", "Close", "Volume", ""].map(h => (
                        <th key={h} className="px-3 py-1.5 text-left text-gray-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {detail.candles.map((c, i) => {
                      const isORB   = i === 0;
                      const green   = c.close >= c.open;
                      return (
                        <tr key={i} className={`${isORB ? "bg-amber-50" : ""}`}>
                          <td className="px-3 py-1 font-semibold text-gray-600">
                            {c.time} {isORB && <span className="text-amber-600 text-[9px] ml-1">ORB</span>}
                          </td>
                          <td className="px-3 py-1 text-gray-700">{c.open.toFixed(2)}</td>
                          <td className="px-3 py-1 text-emerald-700 font-semibold">{c.high.toFixed(2)}</td>
                          <td className="px-3 py-1 text-red-600 font-semibold">{c.low.toFixed(2)}</td>
                          <td className={`px-3 py-1 font-bold ${green ? "text-emerald-700" : "text-red-600"}`}>{c.close.toFixed(2)}</td>
                          <td className="px-3 py-1 text-gray-500">{c.volume.toLocaleString("en-IN")}</td>
                          <td className={`px-3 py-1 ${green ? "text-emerald-500" : "text-red-400"}`}>{green ? "▲" : "▼"}</td>
                        </tr>
                      );
                    })}
                    {detail.candles.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-4 text-center text-gray-400">No candles yet — market may not be open</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Setup Panel ───────────────────────────────────────────────────────────────

function isAfterORBWindow(): boolean {
  const ist  = new Date(Date.now() + 5.5 * 3600 * 1000);
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return mins >= 570; // 9:30 AM IST
}

function isMarketDay(): boolean {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  const day = ist.getUTCDay();
  return day !== 0 && day !== 6;
}

function SetupPanel({ onDone }: { onDone: () => void }) {
  const [universeStatus,  setUniverseStatus]  = useState<{ count: number } | null>(null);
  const [premarketStatus, setPremarketStatus] = useState<{ count: number } | null>(null);
  const [orbStatus,       setOrbStatus]       = useState<{ orbSet: number; total: number } | null>(null);
  const [running,  setRunning]  = useState<string | null>(null);
  const [results,  setResults]  = useState<Record<string, string>>({});
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number } | null>(null);
  const [autoMode, setAutoMode] = useState(false);
  const pollRef  = useRef<NodeJS.Timeout | null>(null);
  const autoRan  = useRef(false); // prevent double-fire

  async function fetchStatuses() {
    async function safeJson(url: string) {
      try {
        const res  = await fetch(url);
        const text = await res.text();
        return text ? JSON.parse(text) : null;
      } catch { return null; }
    }
    const [u, p, o] = await Promise.all([
      safeJson("/api/scanner/universe"),
      safeJson("/api/scanner/premarket"),
      safeJson("/api/scanner/orb"),
    ]);
    setUniverseStatus(u);
    setPremarketStatus(p);
    setOrbStatus(o);
    return { u, p, o };
  }

  // Auto-run missing steps on first load — no clicks needed
  useEffect(() => {
    if (autoRan.current || !isMarketDay()) return;
    autoRan.current = true;
    setAutoMode(true);

    (async () => {
      const { u, p, o } = await fetchStatuses();

      // Step 1: Build Universe if empty
      if ((u?.count ?? 0) === 0) {
        setRunning("universe");
        try {
          const res  = await fetch("/api/scanner/universe", { method: "POST" });
          const data = await res.json().catch(() => ({}));
          setResults(r => ({ ...r, universe: data.error ? `Error: ${data.error}` : `Built: ${data.mapped ?? 0} stocks` }));
        } catch { /* ignore */ }
        await fetchStatuses();
        setRunning(null);
      }

      // Step 2: Pre-Market Scan if not done today
      if ((p?.count ?? 0) === 0) {
        const total = universeStatus?.count ?? 0;
        setRunning("premarket");
        setScanProgress({ current: 0, total });
        // Poll progress while scanning
        const pollId = setInterval(async () => {
          try {
            const res  = await fetch("/api/scanner/premarket");
            const data = await res.json().catch(() => ({}));
            setScanProgress(prev => ({ current: data.count ?? 0, total: prev?.total ?? 0 }));
          } catch { /* ignore */ }
        }, 1500);
        try {
          const res  = await fetch("/api/scanner/premarket", { method: "POST" });
          const data = await res.json().catch(() => ({}));
          setResults(r => ({ ...r, premarket: data.alreadyDone ? `Already done (${data.count} stocks)` : data.error ? `Error: ${data.error}` : `Scanned: ${data.processed ?? 0} stocks` }));
        } catch { /* ignore */ }
        clearInterval(pollId);
        setScanProgress(null);
        await fetchStatuses();
        setRunning(null);
      }

      // Step 3: ORB if after 9:30 AM and not yet set
      if (isAfterORBWindow() && (o?.orbSet ?? 0) === 0 && (o?.total ?? 0) > 0) {
        setRunning("orb");
        try {
          const res  = await fetch("/api/scanner/orb", { method: "POST" });
          const data = await res.json().catch(() => ({}));
          setResults(r => ({ ...r, orb: data.error ? `Error: ${data.error}` : `ORB set: ${data.updated ?? 0} stocks` }));
        } catch { /* ignore */ }
        await fetchStatuses();
        setRunning(null);
      }

      setAutoMode(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchStatuses(); }, []);

  // Poll premarket GET while scan is running to show real progress
  useEffect(() => {
    if (running !== "premarket") {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    const total = universeStatus?.count ?? 0;
    setScanProgress({ current: 0, total });
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch("/api/scanner/premarket");
        const text = await res.text();
        if (!text) return;
        const data = JSON.parse(text);
        setScanProgress({ current: data.count ?? 0, total });
      } catch { /* ignore poll errors */ }
    }, 1500);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [running, universeStatus?.count]);

  async function run(step: string, url: string) {
    setRunning(step);
    if (step === "premarket") setScanProgress({ current: 0, total: universeStatus?.count ?? 0 });
    try {
      const res  = await fetch(url, { method: "POST" });
      const text = await res.text();
      if (!text) {
        setResults(r => ({ ...r, [step]: `Server error (HTTP ${res.status}) — check Vercel logs` }));
        await fetchStatuses();
        setRunning(null);
        setScanProgress(null);
        return;
      }
      let data: Record<string, unknown>;
      try { data = JSON.parse(text); }
      catch { setResults(r => ({ ...r, [step]: `Bad response (HTTP ${res.status})` })); await fetchStatuses(); setRunning(null); setScanProgress(null); return; }

      if (data.error)            setResults(r => ({ ...r, [step]: `Error: ${data.error}` }));
      else if (data.alreadyDone) setResults(r => ({ ...r, [step]: `Already done today (${data.count} stocks)` }));
      else                       setResults(r => ({ ...r, [step]: JSON.stringify(data).slice(0, 140) }));
    } catch (e) {
      setResults(r => ({ ...r, [step]: `Network error: ${e}` }));
    }
    await fetchStatuses();
    setRunning(null);
    setScanProgress(null);
  }

  const steps = [
    {
      key:   "universe",
      title: "1. Build Universe",
      desc:  "Downloads NSE bhav copy → keeps only liquid stocks (traded value > ₹5 Cr). Run once after 6 PM or next morning. Universe changes every day automatically.",
      btn:   "Build Universe",
      url:   "/api/scanner/universe",
      done:  (universeStatus?.count ?? 0) > 0,
      stat:  universeStatus ? `${universeStatus.count} stocks` : "—",
    },
    {
      key:     "premarket",
      title:   "2. Run Pre-Market Scan",
      desc:    "Fetches 40 days of Dhan daily candles per stock, computes EMA20/50, RSI, avg volume, scores 0–100. Run at 9:00–9:15 AM.",
      btn:     "Run Pre-Market Scan",
      url:     "/api/scanner/premarket",
      done:    (premarketStatus?.count ?? 0) > 0,
      stat:    premarketStatus ? `${premarketStatus.count} stocks scored` : "—",
      warning: (universeStatus?.count ?? 0) === 0 ? "Run Step 1 first" : undefined,
    },
    {
      key:     "orb",
      title:   "3. Set Opening Range (after 9:30 AM)",
      desc:    "Fetches the 9:15–9:30 candle for each stock. Sets the ORB High/Low used for breakout detection.",
      btn:     "Set ORB Now",
      url:     "/api/scanner/orb",
      done:    (orbStatus?.orbSet ?? 0) > 0,
      stat:    orbStatus ? `${orbStatus.orbSet}/${orbStatus.total} ORBs set` : "—",
      warning: (premarketStatus?.count ?? 0) === 0 ? "Run Step 2 first" : undefined,
    },
  ];

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mb-6">
      <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            Daily Setup Pipeline
            {autoMode && running && (
              <span className="text-xs font-normal text-indigo-600 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse inline-block" />
                Auto-running…
              </span>
            )}
            {!autoMode && !running && (
              <span className="text-xs font-normal text-emerald-600">Auto-runs on page load</span>
            )}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Runs automatically each trading day · Also scheduled via Vercel Cron</p>
        </div>
        {(premarketStatus?.count ?? 0) > 0 && (
          <button
            onClick={onDone}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          >
            View Live Scanner →
          </button>
        )}
      </div>

      <div className="divide-y">
        {steps.map(step => (
          <div key={step.key} className="px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step.done ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
                    {step.done ? "✓" : "○"}
                  </span>
                  <h3 className="font-medium text-gray-900 text-sm">{step.title}</h3>
                  <span className="text-xs text-gray-400">{step.stat}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed ml-7">{step.desc}</p>
                {step.warning && <p className="text-xs text-amber-600 ml-7 mt-1">⚠ {step.warning}</p>}
                {/* Live progress bar — only shown while premarket is running */}
                {step.key === "premarket" && running === "premarket" && scanProgress && scanProgress.total > 0 && (
                  <div className="ml-7 mt-2 space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Scanning stocks…</span>
                      <span className="font-mono">{scanProgress.current} / {scanProgress.total}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-1.5 bg-indigo-500 rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${Math.min(100, (scanProgress.current / scanProgress.total) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
                {results[step.key] && running !== step.key && (
                  <p className={`text-xs ml-7 mt-1.5 ${results[step.key].startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>
                    {results[step.key]}
                  </p>
                )}
              </div>
              <button
                onClick={() => run(step.key, step.url)}
                disabled={running !== null || !!step.warning}
                className="px-3 py-1.5 rounded-lg border text-sm font-medium bg-white text-gray-700 hover:bg-gray-50 border-gray-200 disabled:opacity-40 whitespace-nowrap"
              >
                {running === step.key ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin inline-block" />
                    Running…
                  </span>
                ) : step.btn}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ScannerPage() {
  const [data,      setData]      = useState<ScannerResponse | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [filter,    setFilter]    = useState<FilterKey>("all");
  const [showSetup, setShowSetup] = useState(false);

  // Trade tracking
  const [trades,      setTrades]      = useState<ActiveTrade[]>([]);
  const [buyTarget,   setBuyTarget]   = useState<ScannerStock | null>(null);
  const [detailSymbol, setDetailSymbol] = useState<string | null>(null);

  const orbFiredRef   = useRef(false);
  const sseRef        = useRef<EventSource | null>(null);
  const reconnectRef  = useRef<NodeJS.Timeout | null>(null);
  // Live price ticks from SSE — keyed by symbol
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ticksRef      = useRef<Map<string, any>>(new Map());
  const [wsStatus, setWsStatus] = useState<"connecting"|"live"|"fallback"|"closed">("connecting");

  // Load trades from localStorage on mount
  useEffect(() => { setTrades(loadTrades()); }, []);

  // ── Fetch base pre-market data once (metrics don't change during the day) ──
  const fetchData = useCallback(async () => {
    try {
      const res  = await fetch("/api/scanner/live");
      const text = await res.text();
      if (!text) throw new Error(`Empty response (HTTP ${res.status})`);
      const json = JSON.parse(text) as ScannerResponse;
      if (json.error) throw new Error(json.error);
      setData(json);
      setError(null);
      if (json.status === "premarket_needed") setShowSetup(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── SSE live feed — replaces 8s polling ────────────────────────────────────
  const marketOpen = data?.marketOpen ?? false;
  useEffect(() => {
    if (!marketOpen) { setWsStatus("closed"); return; }

    function connect() {
      setWsStatus("connecting");
      const es = new EventSource("/api/scanner/stream");
      sseRef.current = es;

      es.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.event === "connected") { setWsStatus("live"); return; }
          if (msg.event === "disconnected" || msg.event === "error") {
            setWsStatus("fallback");
            return;
          }
          if (msg.symbol && isFinite(msg.ltp) && msg.ltp > 0) {
            ticksRef.current.set(msg.symbol, msg);
          }
        } catch { /* ignore malformed */ }
      };

      es.onerror = () => {
        es.close();
        setWsStatus("fallback");
        // Reconnect after 5 seconds
        reconnectRef.current = setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      sseRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      setWsStatus("closed");
    };
  }, [marketOpen]);

  // ── Merge SSE ticks into displayed stocks every second ─────────────────────
  const [tickVersion, setTickVersion] = useState(0);
  useEffect(() => {
    if (!marketOpen) return;
    const iv = setInterval(() => {
      if (ticksRef.current.size > 0) setTickVersion(v => v + 1);
    }, 1000);
    return () => clearInterval(iv);
  }, [marketOpen]);

  // ── Fallback REST poll every 10s if SSE is down ────────────────────────────
  useEffect(() => {
    if (!marketOpen || wsStatus !== "fallback") return;
    const iv = setInterval(fetchData, 10_000);
    return () => clearInterval(iv);
  }, [marketOpen, wsStatus, fetchData]);

  // ── Auto-set ORB after 9:30 ────────────────────────────────────────────────
  useEffect(() => {
    if (!data || orbFiredRef.current) return;
    if (!data.orbReady && isAfterORBWindow() && (data.total ?? 0) > 0) {
      orbFiredRef.current = true;
      fetch("/api/scanner/orb", { method: "POST" })
        .then(() => fetchData())
        .catch(() => {});
    }
  }, [data, fetchData]);

  // ── Merge base data + live ticks ───────────────────────────────────────────
  const mergedStocks = useMemo(() => {
    if (!data) return [];
    return data.stocks.map(s => {
      const tick = ticksRef.current.get(s.symbol);
      if (!tick || !isFinite(tick.ltp) || tick.ltp <= 0) return s;

      const ltp       = tick.ltp;
      const volume    = tick.volume  > 0 ? tick.volume  : s.volume ?? 0;
      const vwap      = tick.vwap    > 0 ? tick.vwap    : 0;
      const open      = tick.open    > 0 ? tick.open    : s.open ?? 0;
      const high      = tick.high    > 0 ? tick.high    : s.high ?? 0;
      const low       = tick.low     > 0 ? tick.low     : s.low  ?? 0;
      const prevClose = tick.prevClose > 0 ? tick.prevClose : s.ltp;
      const pctChange = prevClose > 0 ? parseFloat(((ltp - prevClose) / prevClose * 100).toFixed(2)) : s.pctChange;
      const rvol      = calcRVOL(volume, 0) || s.rvol;
      const aboveVwap = vwap > 0 ? ltp > vwap : s.aboveVwap;
      const aboveEma20 = ltp > s.ema20;
      const aboveEma50 = s.ema50 !== null ? ltp > s.ema50 : null;
      const orbBroken  = s.orbHigh !== null ? ltp > s.orbHigh : null;
      const liveScore  = calcLiveScore({
        ema20Bullish:     aboveEma20,
        ema50Stack:       s.ema50 !== null ? s.ema20 > s.ema50 : null,
        ema200Bullish:    s.ema200 !== null ? ltp > s.ema200 && (s.ema50 === null || s.ema50 > s.ema200) : null,
        rvol,
        orbBroken,
        aboveVwap,
        pctChange,
        relativeStrength: s.relativeStrength,
        sectorVsNifty:    s.sectorVsNifty,
        marketRegime:     data?.marketRegime ?? "unknown",
      });
      const signal = classifySignal(liveScore, rvol, pctChange, aboveEma20, aboveEma50, orbBroken, data?.marketRegime ?? "unknown");

      return { ...s, ltp, volume, open, high, low, pctChange, rvol, aboveVwap, aboveEma20, aboveEma50, orbBroken, liveScore, signal };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, tickVersion]);

  function addTrade(trade: ActiveTrade) {
    const next = [...trades.filter(t => t.symbol !== trade.symbol), trade]; // one trade per symbol
    setTrades(next);
    saveTrades(next);
  }

  function exitTrade(id: string) {
    const next = trades.filter(t => t.id !== id);
    setTrades(next);
    saveTrades(next);
  }

  const stocks   = mergedStocks;
  const counts   = data?.counts ?? { breakout: 0, buy_setup: 0, watch: 0, avoid: 0, rvolSpike: 0 };
  const stockMap = new Map(stocks.map(s => [s.symbol, s]));
  const tradeSet = new Set(trades.map(t => t.symbol));

  const needsPremarket = data?.status === "premarket_needed";

  const filtered = filter === "all"
    ? stocks
    : stocks.filter(s => s.signal === filter);

  // Urgent exit count for page title badge
  const urgentExits = trades.filter(t => getTradeAlert(t, stockMap.get(t.symbol)).urgent).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6 max-w-[1400px] mx-auto">

      {/* ── Stock Detail Modal ── */}
      {detailSymbol && (
        <StockDetailModal symbol={detailSymbol} onClose={() => setDetailSymbol(null)} />
      )}

      {/* ── Buy Modal ── */}
      {buyTarget && (
        <BuyModal
          stock={buyTarget}
          onConfirm={addTrade}
          onClose={() => setBuyTarget(null)}
        />
      )}

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            Setup Scanner
            {urgentExits > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-sm font-bold rounded-full animate-pulse">
                {urgentExits} EXIT ALERT
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Pre-breakout · EMA + RSI + RVOL + ORB · {data?.total ?? 0} stocks · {trades.length > 0 ? `${trades.length} open trade${trades.length > 1 ? "s" : ""}` : "no open trades"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSetup(s => !s)}
            className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${showSetup ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            ⚙ Setup
          </button>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              {data?.marketOpen ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Market Open
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 border text-gray-500 text-sm">
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                  Market Closed
                </span>
              )}
              {/* Market Regime badge */}
              {data?.marketRegime && data.marketRegime !== "unknown" && (
                <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  data.marketRegime === "trend_up"   ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                  data.marketRegime === "trend_down" ? "bg-red-50 border-red-200 text-red-700" :
                                                       "bg-amber-50 border-amber-200 text-amber-700"
                }`}>
                  {data.marketRegime === "trend_up"   ? "↑ Nifty Trending" :
                   data.marketRegime === "trend_down" ? "↓ Nifty Weak" :
                                                        "↔ Choppy"}
                  {data.niftyPctChange !== null && (
                    <span className="opacity-70">({data.niftyPctChange >= 0 ? "+" : ""}{data.niftyPctChange.toFixed(2)}%)</span>
                  )}
                </span>
              )}
            </div>
            {/* Live feed status */}
            {marketOpen && (
              <div className="flex items-center gap-1.5 mt-1 justify-end">
                {wsStatus === "live" && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live feed
                  </span>
                )}
                {wsStatus === "connecting" && (
                  <span className="text-xs text-indigo-500 font-medium">Connecting…</span>
                )}
                {wsStatus === "fallback" && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Polling (10s)
                  </span>
                )}
              </div>
            )}
            {data?.fetchedAt && (
              <p className="text-xs text-gray-400 mt-0.5">
                Last sync {new Date(data.fetchedAt).toLocaleTimeString("en-IN")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Setup panel ── */}
      {showSetup && <SetupPanel onDone={() => { setShowSetup(false); fetchData(); }} />}

      {/* ── Active Trades panel ── */}
      <ActiveTradesPanel trades={trades} stockMap={stockMap} onExit={exitTrade} />

      {/* ── Alerts ── */}
      {needsPremarket && !showSetup && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center justify-between gap-4">
          <span>Pre-market scan not yet run for today.</span>
          <button onClick={() => setShowSetup(true)} className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium whitespace-nowrap">
            Open Setup →
          </button>
        </div>
      )}
      {error && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 space-y-1.5">
          <p className="font-semibold">Scanner error</p>
          <p className="font-mono text-xs break-all">{error}</p>
          {(error.includes("does not exist") || error.includes("DailyMetrics") || error.includes("ScannerUniverse") || error.includes("Instrument")) && (
            <p className="text-xs text-red-600 mt-1 pt-1 border-t border-red-200">
              ⚠ Database tables are missing. Run the SQL setup script in your Supabase SQL editor — see the setup instructions.
            </p>
          )}
          {error.includes("Dhan not connected") && (
            <p className="text-xs text-red-600 mt-1 pt-1 border-t border-red-200">
              ⚠ Add <code className="bg-red-100 px-1 rounded">DHAN_ACCESS_TOKEN</code> to Vercel env vars and redeploy.
            </p>
          )}
        </div>
      )}
      {data?.orbReady === false && !needsPremarket && !showSetup && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 flex items-center justify-between">
          {isAfterORBWindow() ? (
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse inline-block" />
              Setting opening range breakpoints… (auto-running)
            </span>
          ) : (
            <span>ORB will auto-set after 9:30 AM IST.</span>
          )}
          <button
            onClick={async () => { orbFiredRef.current = false; await fetch("/api/scanner/orb", { method: "POST" }); fetchData(); }}
            className="ml-4 px-3 py-1 bg-blue-600 text-white rounded-md text-xs font-medium whitespace-nowrap"
          >
            Set Now
          </button>
        </div>
      )}

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {[
          { label: "🔥 Breakout",   value: counts.breakout,  cls: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
          { label: "✅ Buy Setup",  value: counts.buy_setup, cls: "text-blue-700",    bg: "bg-blue-50 border-blue-200"       },
          { label: "👀 Watching",   value: counts.watch,     cls: "text-amber-700",   bg: "bg-amber-50 border-amber-200"     },
          { label: "📊 RVOL > 2x", value: counts.rvolSpike, cls: "text-indigo-700",  bg: "bg-indigo-50 border-indigo-200"   },
          { label: "💼 My Trades",  value: trades.length,    cls: urgentExits > 0 ? "text-red-600" : "text-gray-700", bg: urgentExits > 0 ? "bg-red-50 border-red-200" : "bg-white" },
        ].map(c => (
          <div key={c.label} className={`rounded-xl border p-4 shadow-sm ${c.bg}`}>
            <div className="text-xs text-gray-400 mb-1 truncate">{c.label}</div>
            <div className={`text-2xl font-bold ${c.cls}`}>{loading ? "—" : c.value}</div>
          </div>
        ))}
      </div>

      {/* ── Sector leaderboard ── */}
      {(data?.sectorRanking?.length ?? 0) > 0 && (
        <div className="mb-4 bg-white border rounded-xl px-4 py-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 font-semibold">Sector Strength vs Nifty</p>
          <div className="flex flex-wrap gap-2">
            {(data!.sectorRanking).slice(0, 10).map((s, i) => (
              <div key={s.sector} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
                i === 0 ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                s.vsNifty !== null && s.vsNifty > 0 ? "bg-blue-50 border-blue-100 text-blue-700" :
                s.vsNifty !== null && s.vsNifty < 0 ? "bg-red-50 border-red-100 text-red-600" :
                "bg-gray-50 border-gray-100 text-gray-600"
              }`}>
                <span className="font-bold text-[10px]">#{i + 1}</span>
                <span>{s.label}</span>
                <span className={`font-mono ${s.avgPctChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {s.avgPctChange >= 0 ? "+" : ""}{s.avgPctChange.toFixed(2)}%
                </span>
                {s.vsNifty !== null && (
                  <span className={`text-[10px] opacity-70 ${s.vsNifty >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    ({s.vsNifty >= 0 ? "+" : ""}{s.vsNifty.toFixed(1)} vs N)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Signal guide ── */}
      <div className="mb-4 p-4 bg-white border rounded-xl text-xs text-gray-600 leading-relaxed flex flex-wrap gap-x-6 gap-y-1">
        <span><strong className="text-emerald-700">🔥 Breakout</strong> — Full bull stack + ORB broken + RVOL ≥ 2x + score ≥ 80. Only signal with a Buy button.</span>
        <span><strong className="text-blue-700">✅ Buy Setup</strong> — Uptrend + RS positive, waiting for ORB confirm. Score 65–80.</span>
        <span><strong className="text-amber-700">👀 Watch</strong> — Score 50–65, on radar.</span>
        <span><strong className="text-gray-500">Score</strong> — 100-pt: Trend(25) + RS(20) + Sector(15) + RVOL(15) + ORB(10) + VWAP(5) + Regime(10).</span>
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f.key ? "bg-indigo-600 text-white shadow-sm" : "bg-white border text-gray-600 hover:bg-gray-50"}`}
          >
            {f.label}
            {f.key !== "all" && (
              <span className="ml-1.5 text-xs opacity-70">
                ({f.key === "breakout" ? counts.breakout : f.key === "buy_setup" ? counts.buy_setup : counts.watch})
              </span>
            )}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} stocks</span>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="bg-white rounded-2xl border p-16 text-center text-gray-400 text-sm">Loading scanner data…</div>
      ) : (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-semibold">Score</th>
                  <th className="text-left px-4 py-3 font-semibold">Stock</th>
                  <th className="text-right px-4 py-3 font-semibold">LTP</th>
                  <th className="text-right px-4 py-3 font-semibold">Chg%</th>
                  <th className="text-right px-3 py-3 font-semibold">RS</th>
                  <th className="px-4 py-3 font-semibold">RVOL</th>
                  <th className="px-4 py-3 font-semibold">ORB</th>
                  <th className="px-4 py-3 font-semibold">VWAP</th>
                  <th className="px-4 py-3 font-semibold">EMA</th>
                  <th className="text-right px-4 py-3 font-semibold">RSI</th>
                  <th className="text-right px-4 py-3 font-semibold">↑Brkout</th>
                  <th className="px-4 py-3 font-semibold">Signal</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(s => {
                  const alreadyBought = tradeSet.has(s.symbol);
                  const trade         = trades.find(t => t.symbol === s.symbol);
                  const alert         = trade ? getTradeAlert(trade, s) : null;

                  return (
                    <tr
                      key={s.symbol}
                      className={`hover:bg-gray-50 transition-colors ${
                        alreadyBought && alert?.urgent  ? "bg-red-50/80"    :
                        alreadyBought                   ? "bg-blue-50/40"   :
                        s.signal === "breakout"         ? "bg-emerald-50/60":
                        s.signal === "buy_setup"        ? "bg-blue-50/30"   :
                        s.signal === "avoid"            ? "bg-red-50/20"    : ""
                      }`}
                    >
                      <td className="px-4 py-3"><ScoreBadge score={s.liveScore} /></td>

                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDetailSymbol(s.symbol)}
                          className="text-left hover:text-indigo-600 transition-colors group"
                        >
                          <div className="font-semibold text-gray-900 leading-tight flex items-center gap-1.5 group-hover:text-indigo-600">
                            {s.symbol}
                            {alreadyBought && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">IN TRADE</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 truncate max-w-[120px]">{s.name}</div>
                          {s.sectorLabel && s.sectorLabel !== "Others" && (
                            <div className="text-[10px] text-indigo-400 font-medium mt-0.5">{s.sectorLabel}</div>
                          )}
                        </button>
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">₹{fmt(s.ltp)}</td>

                      <td className={`px-4 py-3 text-right font-mono font-semibold ${
                        s.pctChange >= 1.5 ? "text-emerald-600" :
                        s.pctChange >= 0   ? "text-emerald-500" :
                        s.pctChange >= -1  ? "text-red-400"     : "text-red-600"
                      }`}>
                        {s.pctChange >= 0 ? "+" : ""}{fmt(s.pctChange)}%
                        {s.sectorPctChange !== null && (
                          <div className="text-[9px] text-gray-400 font-normal leading-tight">
                            sec {s.sectorPctChange >= 0 ? "+" : ""}{fmt(s.sectorPctChange, 1)}%
                          </div>
                        )}
                      </td>

                      {/* RS vs sector */}
                      <td className="px-3 py-3 text-right font-mono text-xs">
                        {s.relativeStrength !== null ? (
                          <span className={`font-semibold ${
                            s.relativeStrength > 1  ? "text-emerald-700" :
                            s.relativeStrength > 0  ? "text-emerald-500" :
                            s.relativeStrength > -1 ? "text-red-400"     : "text-red-600"
                          }`}>
                            {s.relativeStrength > 0 ? "+" : ""}{fmt(s.relativeStrength, 1)}%
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>

                      <td className="px-4 py-3"><RvolBar rvol={s.rvol} /></td>
                      <td className="px-4 py-3"><ORBStatus orbBroken={s.orbBroken} orbBelow={s.orbBelow} /></td>

                      <td className="px-4 py-3">
                        {s.aboveVwap
                          ? <span className="text-xs font-semibold text-emerald-600">▲ Above</span>
                          : <span className="text-xs text-red-400">▼ Below</span>}
                      </td>

                      <td className="px-4 py-3">
                        <EmaStack aboveEma20={s.aboveEma20} aboveEma50={s.aboveEma50} aboveEma200={s.aboveEma200} />
                      </td>

                      <td className={`px-4 py-3 text-right font-mono text-xs font-semibold ${
                        s.rsi14 >= 60 && s.rsi14 <= 70 ? "text-emerald-600" :
                        s.rsi14 >= 50                  ? "text-blue-500"    :
                        s.rsi14 > 70                   ? "text-orange-500"  : "text-red-400"
                      }`}>{fmt(s.rsi14, 0)}</td>

                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {s.pctFromBreakout !== null ? (
                          <span className={s.pctFromBreakout <= 1 ? "text-emerald-600 font-semibold" : "text-gray-500"}>
                            {s.pctFromBreakout <= 0 ? "AT" : `-${fmt(s.pctFromBreakout, 1)}%`}
                          </span>
                        ) : "—"}
                      </td>

                      <td className="px-4 py-3"><SignalBadge signal={s.signal} /></td>

                      {/* ── Action column ── */}
                      <td className="px-4 py-3">
                        {alreadyBought && alert ? (
                          <div className="flex flex-col gap-1">
                            <span className={`text-[11px] font-semibold leading-tight ${alert.urgent ? "text-red-600" : "text-gray-500"}`}>
                              {alert.urgent ? "⚠ Action!" : "Monitoring"}
                            </span>
                            <button
                              onClick={() => { const t = trades.find(x => x.symbol === s.symbol); if (t) exitTrade(t.id); }}
                              className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap"
                            >
                              Sell Now
                            </button>
                          </div>
                        ) : s.signal === "breakout" ? (
                          <button
                            onClick={() => setBuyTarget(s)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Buy Now
                          </button>
                        ) : s.signal === "buy_setup" ? (
                          <span className="text-xs text-blue-500 font-medium">Wait for ORB</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan={13} className="px-4 py-12 text-center text-gray-400 text-sm">
                      {needsPremarket ? "Run the daily setup pipeline first (click ⚙ Setup above)." : "No stocks match this filter right now."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Column guide ── */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "RS",        desc: "Relative Strength vs sector. Stock% - Sector avg%. Positive = outperforming peers. Key filter." },
          { label: "RVOL",      desc: "Relative Volume vs 20-day avg. > 2x = unusual activity. Volume spikes BEFORE price moves." },
          { label: "ORB",       desc: "Opening Range Breakout. 'Above' = price crossed 9:15–9:30 high + 0.2% buffer. Main entry trigger." },
          { label: "EMA Stack", desc: "'Full Bull' = price > 20 EMA > 50 EMA > 200 EMA. Strongest trend structure." },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border p-3 text-xs">
            <div className="font-semibold text-gray-700 mb-1">{c.label}</div>
            <div className="text-gray-400 leading-relaxed">{c.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
