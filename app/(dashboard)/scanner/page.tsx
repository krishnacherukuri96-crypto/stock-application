"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type SignalType = "breakout" | "buy_setup" | "watch" | "avoid" | "wait";

interface ScannerStock {
  symbol:          string;
  name:            string;
  ltp:             number;
  open:            number;
  high:            number;
  low:             number;
  pctChange:       number;
  rvol:            number;
  rsi14:           number;
  aboveEma20:      boolean;
  aboveEma50:      boolean | null;
  aboveVwap:       boolean;
  orbBroken:       boolean | null;
  orbBelow:        boolean | null;
  orbHigh:         number | null;
  orbLow:          number | null;
  high20d:         number;
  pctFromBreakout: number | null;
  preScore:        number;
  liveScore:       number;
  signal:          SignalType;
}

interface ScannerCounts {
  breakout:  number;
  buy_setup: number;
  watch:     number;
  avoid:     number;
  rvolSpike: number;
}

interface ScannerResponse {
  stocks:     ScannerStock[];
  counts:     ScannerCounts;
  total:      number;
  fetchedAt:  string;
  marketOpen: boolean;
  date:       string;
  orbReady:   boolean;
  status?:    string;
  message?:   string;
  error?:     string;
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

const REFRESH_MS = 8000;
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

function EmaStack({ aboveEma20, aboveEma50 }: { aboveEma20: boolean; aboveEma50: boolean | null }) {
  if (aboveEma20 && aboveEma50)        return <span className="text-xs font-semibold text-emerald-600">▲ Bull</span>;
  if (aboveEma20 && aboveEma50 === null) return <span className="text-xs text-emerald-500">▲ 20E</span>;
  if (aboveEma20 && !aboveEma50)       return <span className="text-xs text-amber-500">~ Mix</span>;
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
  const defaultStop = stock.orbLow
    ? parseFloat(stock.orbLow.toFixed(2))
    : parseFloat((stock.ltp * 0.99).toFixed(2)); // fallback: 1% below

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
              className="w-full px-3 py-2.5 border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              className="w-full px-3 py-2.5 border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                className="w-full px-3 py-2.5 border border-red-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
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
                className="w-full px-3 py-2.5 border border-emerald-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
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
        <span className="text-xs text-gray-400">Auto-monitors every 8s · closes at market end</span>
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

// ── Setup Panel ───────────────────────────────────────────────────────────────

function SetupPanel({ onDone }: { onDone: () => void }) {
  const [universeStatus,  setUniverseStatus]  = useState<{ count: number } | null>(null);
  const [premarketStatus, setPremarketStatus] = useState<{ count: number } | null>(null);
  const [orbStatus,       setOrbStatus]       = useState<{ orbSet: number; total: number } | null>(null);
  const [running,  setRunning]  = useState<string | null>(null);
  const [results,  setResults]  = useState<Record<string, string>>({});

  async function fetchStatuses() {
    const [u, p, o] = await Promise.all([
      fetch("/api/scanner/universe").then(r => r.json()).catch(() => null),
      fetch("/api/scanner/premarket").then(r => r.json()).catch(() => null),
      fetch("/api/scanner/orb").then(r => r.json()).catch(() => null),
    ]);
    setUniverseStatus(u);
    setPremarketStatus(p);
    setOrbStatus(o);
  }

  useEffect(() => { fetchStatuses(); }, []);

  async function run(step: string, url: string) {
    setRunning(step);
    try {
      const res  = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (data.error)       setResults(r => ({ ...r, [step]: `Error: ${data.error}` }));
      else if (data.alreadyDone) setResults(r => ({ ...r, [step]: `Already done today (${data.count} stocks)` }));
      else                  setResults(r => ({ ...r, [step]: JSON.stringify(data).slice(0, 140) }));
    } catch (e) {
      setResults(r => ({ ...r, [step]: `Network error: ${e}` }));
    }
    await fetchStatuses();
    setRunning(null);
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
          <h2 className="font-semibold text-gray-900">Daily Setup Pipeline</h2>
          <p className="text-xs text-gray-500 mt-0.5">Run once each trading day to activate the scanner</p>
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
                {results[step.key] && (
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
  const [countdown, setCountdown] = useState(REFRESH_MS / 1000);
  const [filter,    setFilter]    = useState<FilterKey>("all");
  const [showSetup, setShowSetup] = useState(false);

  // Trade tracking
  const [trades,    setTrades]    = useState<ActiveTrade[]>([]);
  const [buyTarget, setBuyTarget] = useState<ScannerStock | null>(null); // which stock Buy modal is open for

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load trades from localStorage on mount
  useEffect(() => { setTrades(loadTrades()); }, []);

  const fetchData = useCallback(async () => {
    try {
      const res  = await fetch("/api/scanner/live");
      const json = await res.json() as ScannerResponse;
      if (json.error) throw new Error(json.error);
      setData(json);
      setError(null);
      if (json.status === "premarket_needed") setShowSetup(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setCountdown(REFRESH_MS / 1000);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(iv);
  }, [fetchData]);

  useEffect(() => {
    timerRef.current = setInterval(
      () => setCountdown(c => (c > 1 ? c - 1 : REFRESH_MS / 1000)),
      1000,
    );
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

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

  const stocks   = data?.stocks ?? [];
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
            {data?.fetchedAt && (
              <p className="text-xs text-gray-400 mt-1">
                {new Date(data.fetchedAt).toLocaleTimeString("en-IN")} · next in {countdown}s
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
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          Error: {error}
        </div>
      )}
      {data?.orbReady === false && !needsPremarket && !showSetup && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 flex items-center justify-between">
          <span>ORB not set — run after 9:30 AM for breakout signals.</span>
          <button onClick={async () => { await fetch("/api/scanner/orb", { method: "POST" }); fetchData(); }} className="ml-4 px-3 py-1 bg-blue-600 text-white rounded-md text-xs font-medium whitespace-nowrap">
            Set ORB Now
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

      {/* ── Signal guide ── */}
      <div className="mb-4 p-4 bg-white border rounded-xl text-xs text-gray-600 leading-relaxed flex flex-wrap gap-x-6 gap-y-1">
        <span><strong className="text-emerald-700">🔥 Breakout</strong> — ORB broken + RVOL &gt; 2x + score &gt; 75. Click Buy Now → enter price → scanner monitors it for you.</span>
        <span><strong className="text-blue-700">✅ Buy Setup</strong> — Good structure. Wait for ORB break as trigger before buying.</span>
        <span><strong className="text-amber-700">👀 Watch</strong> — On radar, not ready.</span>
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
                        <div className="font-semibold text-gray-900 leading-tight flex items-center gap-1.5">
                          {s.symbol}
                          {alreadyBought && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">IN TRADE</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 truncate max-w-[110px]">{s.name}</div>
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">₹{fmt(s.ltp)}</td>

                      <td className={`px-4 py-3 text-right font-mono font-semibold ${
                        s.pctChange >= 1.5 ? "text-emerald-600" :
                        s.pctChange >= 0   ? "text-emerald-500" :
                        s.pctChange >= -1  ? "text-red-400"     : "text-red-600"
                      }`}>
                        {s.pctChange >= 0 ? "+" : ""}{fmt(s.pctChange)}%
                      </td>

                      <td className="px-4 py-3"><RvolBar rvol={s.rvol} /></td>
                      <td className="px-4 py-3"><ORBStatus orbBroken={s.orbBroken} orbBelow={s.orbBelow} /></td>

                      <td className="px-4 py-3">
                        {s.aboveVwap
                          ? <span className="text-xs font-semibold text-emerald-600">▲ Above</span>
                          : <span className="text-xs text-red-400">▼ Below</span>}
                      </td>

                      <td className="px-4 py-3"><EmaStack aboveEma20={s.aboveEma20} aboveEma50={s.aboveEma50} /></td>

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
                        ) : (s.signal === "breakout" || s.signal === "buy_setup") ? (
                          <button
                            onClick={() => setBuyTarget(s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                              s.signal === "breakout"
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : "bg-blue-500 hover:bg-blue-600 text-white"
                            }`}
                          >
                            Buy Now
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center text-gray-400 text-sm">
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
          { label: "RVOL",      desc: "Relative Volume vs 20-day avg. > 2x = unusual activity. Volume spikes BEFORE price moves." },
          { label: "ORB",       desc: "Opening Range Breakout. 'Above' = price crossed 9:15–9:30 high. Main entry trigger." },
          { label: "EMA Stack", desc: "'Bull' = price > 20 EMA > 50 EMA. Only buy in bull stacks — trade with the trend." },
          { label: "Buy Now",   desc: "Appears only on Breakout/Buy Setup signals. Click → enter your price → scanner monitors your trade." },
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
