"use client";

import { useState, useCallback, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TradeSignal {
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

interface TopPattern {
  name: string;
  direction: "bullish" | "bearish" | "neutral";
  strength: string;
  timeframe: string;
}

interface PatternInfo {
  signal: TradeSignal | null;
  topPattern: TopPattern | null;
}

interface MarketData {
  nifty: { price: number; change: number; high: number; low: number };
  bankNifty: { price: number; change: number };
  vix: { level: number; status: string };
  score: number;
  trend: "Bullish" | "Bearish" | "Neutral";
  isOpen: boolean;
  dataPoints: number;
}

interface SectorData {
  name: string;
  change: number;
  price: number | null;
  score: number;
  hasData: boolean;
}

interface StockData {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  rs: number;
  volumeRatio: number;
  aboveVWAP: boolean;
  approxVWAP: number;
  high: number;
  low: number;
  open: number;
  score: number;
  setup: string;
}

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
}

interface BreadthData {
  advancing: number;
  declining: number;
  unchanged: number;
  aboveAvgVol: number;
  total: number;
  adRatio: number;
  signal: string;
}

interface IntradayData {
  market: MarketData;
  breadth: BreadthData;
  sectors: SectorData[];
  stocks: StockData[];
  news: NewsItem[];
  fetchedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function chgColor(v: number) {
  if (v >= 0.5) return "text-emerald-600";
  if (v <= -0.5) return "text-red-500";
  return "text-gray-500";
}

function vixColor(level: number) {
  if (level < 13) return "text-emerald-600";
  if (level < 18) return "text-amber-600";
  return "text-red-500";
}

function trendDot(trend: string) {
  if (trend === "Bullish") return "🐂";
  if (trend === "Bearish") return "🐻";
  return "🟡";
}

function trendColor(trend: string) {
  if (trend === "Bullish") return "text-emerald-700 font-bold";
  if (trend === "Bearish") return "text-red-600 font-bold";
  return "text-amber-600 font-semibold";
}

function scoreColor(s: number) {
  if (s >= 85) return "bg-emerald-100 text-emerald-800 border border-emerald-200";
  if (s >= 75) return "bg-blue-100 text-blue-800 border border-blue-200";
  if (s >= 60) return "bg-amber-100 text-amber-800 border border-amber-200";
  return "bg-gray-100 text-gray-600 border border-gray-200";
}

function setupBadge(setup: string) {
  if (setup === "A+ Long") return "bg-emerald-600 text-white";
  if (setup === "Long") return "bg-blue-600 text-white";
  if (setup === "Watch") return "bg-amber-500 text-white";
  return "bg-gray-300 text-gray-700";
}

// rs is now outperformance in percentage points (stock% − Nifty%)
// +2pp = beat Nifty by 2% today → strong → green
// -2pp = lagged Nifty by 2% → weak → red
function rsLabel(rs: number) {
  const sign = rs >= 0 ? "+" : "";
  if (rs >= 2)  return { dot: "🟢", label: `${sign}${rs}%`, color: "text-emerald-600" };
  if (rs >= 0)  return { dot: "🟡", label: `${sign}${rs}%`, color: "text-amber-600" };
  if (rs >= -2) return { dot: "🟠", label: `${sign}${rs}%`, color: "text-orange-600" };
  return { dot: "🔴", label: `${sign}${rs}%`, color: "text-red-500" };
}

// BUG FIX: high volume must be interpreted relative to stock direction.
// 3x volume on a falling stock = institutional SELLING → show red, not green.
function volLabel(ratio: number, change: number) {
  if (ratio >= 3) {
    // Large spike: check direction to distinguish buying vs selling
    return change >= 0.5
      ? { dot: "🟢", label: `${ratio}x`, tip: "Volume spike — buying" }
      : { dot: "🔴", label: `${ratio}x`, tip: "Volume spike — selling pressure" };
  }
  if (ratio >= 1.5) return { dot: "🟡", label: `${ratio}x`, tip: "Above average volume" };
  if (ratio >= 1)   return { dot: "⚪", label: `${ratio}x`, tip: "Normal volume" };
  return { dot: "🔵", label: `${ratio}x`, tip: "Below average volume" };
}

function volColor(ratio: number, change: number) {
  if (ratio >= 3) return change >= 0.5 ? "text-emerald-600" : "text-red-500";
  if (ratio >= 1.5) return "text-amber-600";
  if (ratio >= 1) return "text-gray-700";
  return "text-gray-600";
}

function fmt(n: number, dec = 2) {
  return n?.toLocaleString("en-IN", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function patternBadgeStyle(direction: string) {
  if (direction === "bullish") return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (direction === "bearish") return "bg-red-50 text-red-700 border border-red-200";
  return "bg-amber-50 text-amber-700 border border-amber-200";
}

function patternDot(direction: string) {
  if (direction === "bullish") return "🟢";
  if (direction === "bearish") return "🔴";
  return "🟡";
}

function marketScoreLabel(s: number) {
  if (s >= 17) return { text: "Aggressive Longs", color: "text-emerald-600 bg-emerald-50" };
  if (s >= 12) return { text: "Cautious Longs", color: "text-blue-600 bg-blue-50" };
  if (s >= 8) return { text: "Mixed — Wait", color: "text-amber-600 bg-amber-50" };
  return { text: "Avoid Longs", color: "text-red-600 bg-red-50" };
}

const ALL_SECTORS = [
  "All", "IT", "Banking", "Pharma", "Auto", "FMCG", "Energy", "Metal",
  "Infra", "Finance", "Consumer", "Chemicals", "Telecom", "RealEstate",
  "Healthcare", "Defence", "Agrochem", "Railways", "Aviation", "CapGoods",
  "Media", "Retail", "Tech",
];

const SECTOR_INDEX_INFO: Record<string, { symbol: string; fullName: string }> = {
  IT:         { symbol: "^CNXIT",      fullName: "Nifty IT Index" },
  Banking:    { symbol: "^NSEBANK",    fullName: "Nifty Bank Index" },
  Pharma:     { symbol: "^CNXPHARMA",  fullName: "Nifty Pharma Index" },
  Auto:       { symbol: "^CNXAUTO",    fullName: "Nifty Auto Index" },
  FMCG:       { symbol: "^CNXFMCG",   fullName: "Nifty FMCG Index" },
  Energy:     { symbol: "^CNXENERGY",  fullName: "Nifty Energy Index" },
  Metal:      { symbol: "^CNXMETAL",   fullName: "Nifty Metal Index" },
  Infra:      { symbol: "^CNXINFRA",   fullName: "Nifty Infrastructure Index" },
  Finance:    { symbol: "^CNXFINANCE", fullName: "Nifty Financial Services Index" },
  Consumer:   { symbol: "^CNXCONSUMR", fullName: "Nifty Consumer Durables Index" },
  RealEstate: { symbol: "^CNXREALTY",  fullName: "Nifty Realty Index" },
  Media:      { symbol: "^CNXMEDIA",   fullName: "Nifty Media Index" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function IntradayPage() {
  const [data, setData] = useState<IntradayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSector, setActiveSector] = useState("All");
  const [sortKey, setSortKey] = useState<keyof StockData>("score");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);
  const [patternData, setPatternData] = useState<Record<string, PatternInfo>>({});
  const [patternsLoading, setPatternsLoading] = useState(false);
  const fetchingRef = useRef(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setSelectedStock(null); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const sync = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    setPatternData({});
    try {
      const res = await fetch("/api/intraday", { cache: "no-store" });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  // Auto-fetch once on mount (page open / refresh). Manual sync after that.
  useEffect(() => {
    sync();
  }, [sync]);

  // After main data loads, fetch candlestick patterns for top-scoring stocks
  useEffect(() => {
    if (!data) return;
    const eligible = data.stocks.filter(s => s.score >= 55).slice(0, 80);
    if (eligible.length === 0) return;
    setPatternsLoading(true);
    const params = new URLSearchParams({
      symbols:   eligible.map(s => s.symbol).join(","),
      scores:    eligible.map(s => s.score).join(","),
      volRatios: eligible.map(s => s.volumeRatio).join(","),
      aboveVWAP: eligible.map(s => s.aboveVWAP ? "1" : "0").join(","),
      prices:    eligible.map(s => s.price).join(","),
    });
    fetch(`/api/intraday/patterns?${params}`, { cache: "no-store" })
      .then(r => r.json())
      .then((json: Record<string, PatternInfo>) => setPatternData(json))
      .catch(() => {})
      .finally(() => setPatternsLoading(false));
  }, [data]);

  function toggleSort(key: keyof StockData) {
    if (sortKey === key) setSortAsc((p) => !p);
    else { setSortKey(key); setSortAsc(false); }
  }

  const filteredStocks = (data?.stocks ?? [])
    .filter((s) => activeSector === "All" || s.sector === activeSector)
    .sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortAsc ? av - bv : bv - av;
    });

  const mkt = data?.market;
  const mktLabel = mkt ? marketScoreLabel(mkt.score) : null;

  return (
    <div className="space-y-6 pb-10">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Intraday Scanner</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            9-layer professional framework · ~250 NSE stocks scored 0–100
          </p>
          {data && (
            <p className="text-xs text-gray-400 mt-1">
              Last synced: {new Date(data.fetchedAt).toLocaleTimeString("en-IN")} ·{" "}
              <span className={mkt?.isOpen ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
                {mkt?.isOpen ? "Market OPEN" : "Market CLOSED"}
              </span>
              {data.market.dataPoints && (
                <span className="text-gray-400"> · {data.market.dataPoints} symbols loaded</span>
              )}
            </p>
          )}
        </div>
        <button
          onClick={sync}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-all shadow"
        >
          <span className={loading ? "animate-spin inline-block" : ""}>🔄</span>
          {loading ? "Syncing…" : data ? "Sync Live" : "Load Market Data"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error} — Yahoo Finance may be temporarily unavailable. Try again in a moment.
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {!data && !loading && !error && (
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-10 text-center">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Professional Intraday Framework</h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
            Click <strong>Load Market Data</strong> to fetch live Nifty, Bank Nifty, VIX, sector rotation,
            and score ~250 NSE stocks across 22 sectors and 7 layers — RS, volume, VWAP, sector, momentum and more.
          </p>
          <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto text-xs text-gray-500">
            {["Layer 1: Market Health", "Layer 2: Sectors", "Layer 3: Rel. Strength",
              "Layer 4: Volume", "Layer 5: VWAP", "Layer 9: News"].map((l) => (
              <div key={l} className="bg-white rounded-lg px-3 py-2 border border-indigo-100 font-medium">{l}</div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl" />)}
          </div>
          <div className="h-40 bg-gray-100 rounded-2xl" />
          <div className="h-64 bg-gray-100 rounded-2xl" />
        </div>
      )}

      {data && !loading && (
        <>
          {/* ── LAYER 1: Market Health ──────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">Layer 1</span>
              <span className="text-sm font-semibold text-gray-700">Market Health</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {/* Nifty */}
              <div className="bg-white rounded-2xl border p-4 shadow-sm">
                <div className="text-xs text-gray-400 font-medium mb-0.5">Nifty 50</div>
                <div className="text-xs text-gray-300 font-mono mb-1">^NSEI</div>
                <div className="text-2xl font-bold text-gray-900">{fmt(mkt!.nifty.price)}</div>
                <div className={`text-sm font-semibold mt-1 ${chgColor(mkt!.nifty.change)}`}>
                  {mkt!.nifty.change >= 0 ? "▲" : "▼"} {Math.abs(mkt!.nifty.change).toFixed(2)}%
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  H {fmt(mkt!.nifty.high)} · L {fmt(mkt!.nifty.low)}
                </div>
                <div className={`mt-2 text-xs ${trendColor(mkt!.trend)}`}>
                  {trendDot(mkt!.trend)} {mkt!.trend}
                </div>
              </div>

              {/* Bank Nifty */}
              <div className="bg-white rounded-2xl border p-4 shadow-sm">
                <div className="text-xs text-gray-400 font-medium mb-0.5">Bank Nifty</div>
                <div className="text-xs text-gray-300 font-mono mb-1">^NSEBANK</div>
                <div className="text-2xl font-bold text-gray-900">{fmt(mkt!.bankNifty.price)}</div>
                <div className={`text-sm font-semibold mt-1 ${chgColor(mkt!.bankNifty.change)}`}>
                  {mkt!.bankNifty.change >= 0 ? "▲" : "▼"} {Math.abs(mkt!.bankNifty.change).toFixed(2)}%
                </div>
                {(() => {
                  const t = mkt!.bankNifty.change >= 0.5 ? "Bullish" : mkt!.bankNifty.change <= -0.5 ? "Bearish" : "Neutral";
                  return (
                    <div className={`mt-2 text-xs ${trendColor(t)}`}>
                      {trendDot(t)} {t}
                    </div>
                  );
                })()}
              </div>

              {/* VIX */}
              <div className="bg-white rounded-2xl border p-4 shadow-sm">
                <div className="text-xs text-gray-400 font-medium mb-0.5">India VIX</div>
                <div className="text-xs text-gray-300 font-mono mb-1">^INDIAVIX</div>
                <div className={`text-2xl font-bold ${vixColor(mkt!.vix.level)}`}>
                  {mkt!.vix.level.toFixed(2)}
                </div>
                <div className={`text-sm font-medium mt-1 ${vixColor(mkt!.vix.level)}`}>
                  {mkt!.vix.status === "Low" ? "🟢" : mkt!.vix.status === "Moderate" ? "🟡" : "🔴"}{" "}
                  {mkt!.vix.status} Volatility
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  &lt;13 calm · 13–18 normal · &gt;18 risk
                </div>
              </div>

              {/* Market Score */}
              <div className={`rounded-2xl border p-4 shadow-sm ${mktLabel!.color}`}>
                <div className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">Market Score</div>
                <div className="text-4xl font-black">{mkt!.score}<span className="text-lg font-semibold opacity-60">/20</span></div>
                <div className="text-sm font-bold mt-2">{mktLabel!.text}</div>
                <div className="text-xs opacity-60 mt-1">
                  0–7 Avoid · 8–12 Mixed · 13–20 Longs
                </div>
              </div>
            </div>
          </section>

          {/* ── LAYER 2: Sector Rotation ────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">Layer 2</span>
              <span className="text-sm font-semibold text-gray-700">Sector Rotation</span>
              <span className="text-xs text-gray-400">— money flows through sectors first</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {data.sectors.map((s, i) => (
                <div
                  key={s.name}
                  className={`relative group bg-white rounded-xl border px-3 py-2.5 shadow-sm cursor-pointer transition-all hover:border-indigo-300 ${
                    activeSector === s.name ? "border-indigo-400 ring-1 ring-indigo-300" : ""
                  }`}
                  onClick={() => setActiveSector(activeSector === s.name ? "All" : s.name)}
                >
                  {/* Hover tooltip */}
                  {SECTOR_INDEX_INFO[s.name] && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                      <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2.5 whitespace-nowrap shadow-lg min-w-[180px]">
                        <div className="font-semibold text-white">{SECTOR_INDEX_INFO[s.name].fullName}</div>
                        <div className="text-gray-400 font-mono mt-0.5 mb-2">{SECTOR_INDEX_INFO[s.name].symbol}</div>
                        {s.hasData && s.price != null ? (
                          <div className="flex items-center justify-between gap-4 border-t border-gray-700 pt-1.5">
                            <span className="text-gray-300 font-mono">₹{fmt(s.price, 2)}</span>
                            <span className={`font-bold ${s.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {s.change >= 0 ? "▲" : "▼"} {Math.abs(s.change).toFixed(2)}%
                            </span>
                          </div>
                        ) : (
                          <div className="text-gray-500 text-xs border-t border-gray-700 pt-1.5">No data today</div>
                        )}
                      </div>
                      <div className="w-2 h-2 bg-gray-900 rotate-45 -mt-1" />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">{s.name}</span>
                    <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                  </div>
                  {s.hasData ? (
                    <>
                      <div className={`text-sm font-bold mt-1 ${chgColor(s.change)}`}>
                        {s.change >= 0 ? "+" : ""}{s.change.toFixed(2)}%
                      </div>
                      <div className="mt-1.5 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.change >= 0.5 ? "bg-emerald-400" : s.change <= -0.5 ? "bg-red-400" : "bg-amber-400"}`}
                          style={{ width: `${Math.min(100, Math.max(5, (s.score / 15) * 100))}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{s.score}/15 pts</div>
                    </>
                  ) : (
                    <div className="text-xs text-gray-400 mt-1 italic">No index data</div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── LAYERS 3–7: Stock Scanner ───────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">Layers 3–7</span>
                <span className="text-sm font-semibold text-gray-700">Stock Scanner</span>
                <span className="text-xs text-gray-400 hidden sm:inline">RS · Volume · VWAP · Momentum</span>
              </div>
              <span className="text-xs text-gray-400">{filteredStocks.length} stocks</span>
            </div>

            {/* Sector pills */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {ALL_SECTORS.map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveSector(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    activeSector === s
                      ? "bg-indigo-600 text-white"
                      : "bg-white border text-gray-500 hover:border-indigo-300 hover:text-indigo-600"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Score legend */}
            <div className="flex flex-wrap gap-2 mb-3 text-xs">
              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium">85+ A+ Setup</span>
              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">75–84 Long</span>
              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">60–74 Watch</span>
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">&lt;60 Avoid</span>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left w-8">#</th>
                    <th className="px-4 py-3 text-left">Stock</th>
                    <th className="px-3 py-3 text-left hidden sm:table-cell">Sector</th>
                    <th className="px-3 py-3 text-right cursor-pointer hover:text-gray-800" onClick={() => toggleSort("price")}>
                      Price {sortKey === "price" ? (sortAsc ? "↑" : "↓") : ""}
                    </th>
                    <th className="px-3 py-3 text-right cursor-pointer hover:text-gray-800" onClick={() => toggleSort("change")}>
                      Chg% {sortKey === "change" ? (sortAsc ? "↑" : "↓") : ""}
                    </th>
                    <th className="px-3 py-3 text-right cursor-pointer hover:text-gray-800" onClick={() => toggleSort("rs")} title="Outperformance vs Nifty (stock% − Nifty%). Green = beat Nifty today.">
                      RS vs Nifty {sortKey === "rs" ? (sortAsc ? "↑" : "↓") : ""}
                    </th>
                    <th className="px-3 py-3 text-right cursor-pointer hover:text-gray-800" onClick={() => toggleSort("volumeRatio")}>
                      Vol {sortKey === "volumeRatio" ? (sortAsc ? "↑" : "↓") : ""}
                    </th>
                    <th className="px-3 py-3 text-center hidden md:table-cell">VWAP</th>
                    <th className="px-3 py-3 text-left hidden xl:table-cell">
                      Pattern / Signal
                      {patternsLoading && <span className="ml-1 inline-block animate-spin text-indigo-400 text-xs">⟳</span>}
                    </th>
                    <th className="px-3 py-3 text-right cursor-pointer hover:text-gray-800" onClick={() => toggleSort("score")}>
                      Score {sortKey === "score" ? (sortAsc ? "↑" : "↓") : ""}
                    </th>
                    <th className="px-4 py-3 text-center">Setup</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredStocks.map((stock, i) => {
                    const rs = rsLabel(stock.rs);
                    const vol = volLabel(stock.volumeRatio, stock.change);
                    return (
                      <tr
                        key={stock.symbol}
                        onClick={() => setSelectedStock(stock)}
                        className={`cursor-pointer hover:bg-indigo-50/60 transition-colors ${stock.score >= 85 ? "bg-emerald-50/20" : ""} ${selectedStock?.symbol === stock.symbol ? "bg-indigo-50 border-l-2 border-indigo-400" : ""}`}
                      >
                        <td className="px-4 py-3 text-gray-400 font-medium text-xs">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-gray-900">{stock.symbol}</div>
                          <div className="text-xs text-gray-400">{stock.name}</div>
                        </td>
                        <td className="px-3 py-3 hidden sm:table-cell">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{stock.sector}</span>
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-medium text-gray-800">
                          ₹{fmt(stock.price)}
                        </td>
                        <td className={`px-3 py-3 text-right font-semibold ${chgColor(stock.change)}`}>
                          {stock.change >= 0 ? "+" : ""}{stock.change.toFixed(2)}%
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="text-sm">{rs.dot}</span>
                          <span className={`ml-1 text-xs font-semibold ${rs.color}`}>
                            {rs.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="text-sm">{vol.dot}</span>
                          <span className={`ml-1 text-xs font-semibold ${volColor(stock.volumeRatio, stock.change)}`}>{vol.label}</span>
                        </td>
                        <td className="px-3 py-3 text-center hidden md:table-cell">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${stock.aboveVWAP ? "bg-emerald-100 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                            {stock.aboveVWAP ? "Above" : "Below"}
                          </span>
                        </td>
                        {/* Pattern / Signal column */}
                        <td className="px-3 py-3 hidden xl:table-cell">
                          {patternsLoading && !patternData[stock.symbol] ? (
                            <span className="text-xs text-gray-300">···</span>
                          ) : (() => {
                            const pd = patternData[stock.symbol];
                            if (!pd) return <span className="text-xs text-gray-300">—</span>;

                            if (pd.signal) {
                              const isBuy = pd.signal.action === "BUY";
                              return (
                                <div className="relative group/sig">
                                  <div className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg cursor-default ${
                                    isBuy ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                                  }`}>
                                    {isBuy ? "▲ BUY" : "▼ SELL"}
                                    <span className="hidden 2xl:inline opacity-80 font-normal text-[10px]">
                                      {pd.signal.timeframe}
                                    </span>
                                  </div>
                                  {/* Hover tooltip — opens downward to avoid clipping on first rows */}
                                  <div className="absolute top-full left-0 mt-2 hidden group-hover/sig:block z-40 pointer-events-none w-56">
                                    <div className="w-2.5 h-2.5 bg-gray-900 rotate-45 ml-4 -mb-1.5" />
                                    <div className="bg-gray-900 text-white text-xs rounded-xl px-3 py-3 shadow-2xl">
                                      <div className="font-bold text-sm mb-0.5">{isBuy ? "🟢" : "🔴"} {pd.signal.pattern}</div>
                                      <div className="text-gray-400 text-[10px] mb-2">{pd.signal.timeframe} timeframe</div>
                                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                                        <span className="text-gray-400">Entry</span>
                                        <span className="font-mono text-white">₹{fmt(pd.signal.entry)}</span>
                                        <span className="text-gray-400">Stop Loss</span>
                                        <span className="font-mono text-red-400">₹{fmt(pd.signal.stopLoss)}</span>
                                        <span className="text-gray-400">Target 1</span>
                                        <span className="font-mono text-emerald-400">₹{fmt(pd.signal.target1)}</span>
                                        <span className="text-gray-400">Target 2</span>
                                        <span className="font-mono text-emerald-400">₹{fmt(pd.signal.target2)}</span>
                                        <span className="text-gray-400">R:R</span>
                                        <span className="font-mono">1:{pd.signal.riskReward}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            if (pd.topPattern) {
                              return (
                                <div className="relative group/pat">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium cursor-default ${patternBadgeStyle(pd.topPattern.direction)}`}>
                                    {patternDot(pd.topPattern.direction)} {pd.topPattern.name}
                                  </span>
                                  <div className="absolute top-full left-0 mt-2 hidden group-hover/pat:block z-40 pointer-events-none w-48">
                                    <div className="w-2.5 h-2.5 bg-gray-900 rotate-45 ml-4 -mb-1.5" />
                                    <div className="bg-gray-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl">
                                      <div className="font-semibold mb-0.5">{pd.topPattern.name}</div>
                                      <div className="text-gray-400 text-[10px] mb-1">{pd.topPattern.timeframe} · {pd.topPattern.strength}</div>
                                      <div className="text-gray-300 text-[10px]">No signal — score or volume condition not met</div>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            return <span className="text-xs text-gray-300">—</span>;
                          })()}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${scoreColor(stock.score)}`}>
                            {stock.score}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-lg ${setupBadge(stock.setup)}`}>
                            {stock.setup}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── LAYER 8: Market Breadth ────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">Layer 8</span>
              <span className="text-sm font-semibold text-gray-700">Market Breadth</span>
              <span className="text-xs text-gray-400">— are most stocks moving together or is it just a few?</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">

              {/* Card 1: Stocks Rising vs Falling */}
              <div className="bg-white rounded-2xl border p-4 shadow-sm">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Stocks Rising vs Falling</div>
                <div className="flex items-end gap-3 mb-2">
                  <div className="text-center">
                    <div className="text-3xl font-black text-emerald-600">{data.breadth.advancing}</div>
                    <div className="text-xs text-emerald-600 font-medium mt-0.5">Rising ▲</div>
                  </div>
                  <div className="text-2xl text-gray-200 font-light mb-1">/</div>
                  <div className="text-center">
                    <div className="text-3xl font-black text-red-500">{data.breadth.declining}</div>
                    <div className="text-xs text-red-500 font-medium mt-0.5">Falling ▼</div>
                  </div>
                  {data.breadth.unchanged > 0 && (
                    <div className="text-center mb-1">
                      <div className="text-xl font-bold text-gray-400">{data.breadth.unchanged}</div>
                      <div className="text-xs text-gray-400">Flat</div>
                    </div>
                  )}
                </div>
                {/* Progress bar: green = advancing share */}
                <div className="h-2 w-full bg-red-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all"
                    style={{ width: `${Math.round((data.breadth.advancing / data.breadth.total) * 100)}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1.5">
                  {Math.round((data.breadth.advancing / data.breadth.total) * 100)}% of {data.breadth.total} tracked stocks are up today
                </div>
              </div>

              {/* Card 2: What does this mean */}
              {(() => {
                const pct = data.breadth.advancing / data.breadth.total;
                const { headline, detail, color, emoji } =
                  pct >= 0.65 ? { headline: "Market Rising Broadly", detail: "Most stocks are up. A healthy rally — not just a few big names pulling the index.", color: "text-emerald-700", emoji: "🐂" }
                  : pct >= 0.45 ? { headline: "Market is Mixed", detail: "Roughly equal stocks rising and falling. No clear direction — wait for confirmation before trading.", color: "text-amber-700", emoji: "🟡" }
                  : pct >= 0.30 ? { headline: "Mostly Falling", detail: "More stocks are falling than rising. The move down is broad — not just one sector.", color: "text-orange-600", emoji: "🐻" }
                  : { headline: "Heavy Broad Selloff", detail: "Almost every sector is falling together. High-risk environment — avoid new long positions.", color: "text-red-600", emoji: "🐻" };
                return (
                  <div className="bg-white rounded-2xl border p-4 shadow-sm">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">What This Means</div>
                    <div className={`text-base font-black mb-2 ${color}`}>{emoji} {headline}</div>
                    <p className="text-sm text-gray-600 leading-relaxed">{detail}</p>
                  </div>
                );
              })()}

              {/* Card 3: Unusual Activity */}
              {(() => {
                const pct = data.breadth.aboveAvgVol / data.breadth.total;
                const { headline, detail, color } =
                  pct >= 0.5  ? { headline: "High across the board", detail: "Many stocks are seeing unusually high trading. Big money is actively moving positions.", color: "text-emerald-600" }
                  : pct >= 0.3 ? { headline: "Moderate activity", detail: "Some stocks are active but most are quiet. Selective interest from institutions.", color: "text-amber-600" }
                  : { headline: "Very quiet market", detail: "Almost no unusual trading volume. Institutions are sitting on the sidelines — low conviction.", color: "text-gray-500" };
                return (
                  <div className="bg-white rounded-2xl border p-4 shadow-sm">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Unusual Trading Activity</div>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-3xl font-black text-indigo-600">{data.breadth.aboveAvgVol}</span>
                      <span className="text-sm text-gray-400">of {data.breadth.total} stocks</span>
                    </div>
                    <div className={`text-sm font-bold mb-2 ${color}`}>{headline}</div>
                    <p className="text-xs text-gray-500 leading-relaxed">{detail}</p>
                  </div>
                );
              })()}

              {/* Card 4: Big Money Flow */}
              {(() => {
                const fiiUp   = mkt!.nifty.change >= 0.5;
                const fiiDown = mkt!.nifty.change <= -0.5;
                const diiUp   = mkt!.bankNifty.change >= 0.3;
                return (
                  <div className="bg-white rounded-2xl border p-4 shadow-sm">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Big Money Flow (Estimated)</div>
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Foreign (FII)</span>
                        <span className={`text-sm font-bold ${fiiUp ? "text-emerald-600" : fiiDown ? "text-red-500" : "text-amber-600"}`}>
                          {fiiUp ? "🐂 Buying" : fiiDown ? "🐻 Selling" : "🟡 Neutral"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Domestic (DII)</span>
                        <span className={`text-sm font-bold ${diiUp ? "text-emerald-600" : "text-amber-600"}`}>
                          {diiUp ? "🟢 Buying" : "🟡 Cautious"}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {fiiUp && diiUp
                        ? "Both FII and DII buying — strong alignment. Market likely to sustain the move."
                        : fiiDown && diiUp
                        ? "FII selling but DII buying — domestic institutions providing support. Choppy market."
                        : fiiDown && !diiUp
                        ? "Both selling — no institutional support. Avoid aggressive longs."
                        : "Mixed signals — wait for clearer direction before trading."}
                    </p>
                    <div className="mt-2 text-xs text-gray-400">Estimated from index movements · Exact numbers after 4 PM on NSE</div>
                  </div>
                );
              })()}
            </div>
          </section>

          {/* ── LAYER 5: Options Snapshot ───────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">Layer 5</span>
              <span className="text-sm font-semibold text-gray-700">Options Data</span>
            </div>
            <div className="bg-white rounded-2xl border p-4 shadow-sm">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "PCR (Put/Call Ratio)", note: "PCR > 1.2 = Bullish · < 0.8 = Bearish" },
                  { label: "Max Pain", note: "Price where max options expire worthless" },
                  { label: "Highest Call OI", note: "Key resistance level" },
                  { label: "Highest Put OI", note: "Key support level" },
                ].map(({ label, note }) => (
                  <div key={label}>
                    <div className="text-xs text-gray-400 mb-1">{label}</div>
                    <div className="text-sm font-semibold text-gray-500">Via NSE</div>
                    <div className="text-xs text-gray-400 mt-0.5">{note}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                Live PCR and OI data is available on{" "}
                <a href="https://www.nseindia.com/option-chain" target="_blank" rel="noreferrer" className="underline font-medium">
                  NSE Option Chain
                </a>{" "}
                and{" "}
                <a href="https://optionstrat.in" target="_blank" rel="noreferrer" className="underline font-medium">
                  OptionStrat India
                </a>.
              </div>
            </div>
          </section>

          {/* ── LAYER 9: News Catalyst ──────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">Layer 9</span>
              <span className="text-sm font-semibold text-gray-700">News Catalyst</span>
              <span className="text-xs text-gray-400">Economic Times Markets</span>
            </div>
            {data.news.length === 0 ? (
              <div className="bg-gray-50 border rounded-2xl p-4 text-sm text-gray-500">
                News feed unavailable — ET Markets RSS may be temporarily unreachable.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {data.news.map((item, i) => (
                  <a
                    key={i}
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-white rounded-xl border px-4 py-3 shadow-sm hover:border-indigo-300 hover:bg-indigo-50/20 transition-all group"
                  >
                    <p className="text-sm font-medium text-gray-800 group-hover:text-indigo-700 leading-snug line-clamp-2">
                      {item.title}
                    </p>
                    {item.pubDate && (
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(item.pubDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </a>
                ))}
              </div>
            )}
          </section>

          {/* ── Top Opportunities Scorecard ─────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">Final</span>
              <span className="text-sm font-semibold text-gray-700">Top Opportunities Today</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {(data.stocks.slice(0, 6)).map((stock) => (
                <div key={stock.symbol} className={`bg-white rounded-2xl border p-4 shadow-sm ${stock.score >= 85 ? "border-emerald-200 bg-emerald-50/10" : ""}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-black text-lg text-gray-900">{stock.symbol}</div>
                      <div className="text-xs text-gray-400">{stock.name} · {stock.sector}</div>
                    </div>
                    <div className={`text-2xl font-black ${scoreColor(stock.score)} px-2.5 py-1 rounded-xl`}>
                      {stock.score}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-y-1 text-xs mt-3">
                    <div className="text-gray-500">Price</div>
                    <div className="font-semibold text-gray-800 text-right">₹{fmt(stock.price)}</div>
                    <div className="text-gray-500">Change</div>
                    <div className={`font-semibold text-right ${chgColor(stock.change)}`}>{stock.change >= 0 ? "+" : ""}{stock.change.toFixed(2)}%</div>
                    <div className="text-gray-500">vs Nifty (RS)</div>
                    <div className={`font-semibold text-right ${rsLabel(stock.rs).color}`}>
                      {rsLabel(stock.rs).dot} {rsLabel(stock.rs).label} vs Nifty
                    </div>
                    <div className="text-gray-500">Volume</div>
                    <div className={`font-semibold text-right ${volColor(stock.volumeRatio, stock.change)}`}>
                      {volLabel(stock.volumeRatio, stock.change).dot} {stock.volumeRatio}x avg
                    </div>
                    <div className="text-gray-500">VWAP</div>
                    <div className={`font-semibold text-right ${stock.aboveVWAP ? "text-emerald-600" : "text-red-500"}`}>
                      {stock.aboveVWAP ? "✓ Above" : "✗ Below"} ₹{fmt(stock.approxVWAP)}
                    </div>
                    <div className="text-gray-500">Day Range</div>
                    <div className="font-semibold text-gray-700 text-right">₹{fmt(stock.low)} – ₹{fmt(stock.high)}</div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${setupBadge(stock.setup)}`}>
                      {stock.setup}
                    </span>
                    <div className="text-xs text-gray-400">
                      {stock.score >= 85 ? "Strong opportunity" : stock.score >= 75 ? "Tradeable setup" : "Monitor closely"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Disclaimer ─────────────────────────────────────────────────── */}
          <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4 text-xs text-yellow-800">
            <strong>Disclaimer:</strong> Scores are algorithmic indicators, not buy/sell recommendations.
            VWAP shown is an estimate ((H+L)/2 midpoint) — actual VWAP requires tick data.
            Options PCR and FII numbers require paid/NSE data. Always use a stop-loss.
            Consult a SEBI-registered advisor before trading.
          </div>
        </>
      )}

      {/* ── Stock Detail Panel ─────────────────────────────────────────────── */}
      {selectedStock && data && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedStock(null)} />

          {/* Panel */}
          <div className="relative z-10 bg-white w-full sm:w-[420px] h-[90vh] sm:h-full sm:max-h-screen overflow-y-auto rounded-t-2xl sm:rounded-none sm:rounded-l-2xl shadow-2xl flex flex-col">

            {/* Panel header */}
            <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-start justify-between z-10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-gray-900">{selectedStock.symbol}</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${setupBadge(selectedStock.setup)}`}>
                    {selectedStock.setup}
                  </span>
                </div>
                <div className="text-sm text-gray-500 mt-0.5">{selectedStock.name} · {selectedStock.sector}</div>
              </div>
              <button onClick={() => setSelectedStock(null)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none ml-4 mt-0.5">×</button>
            </div>

            <div className="flex-1 px-5 py-4 space-y-5">

              {/* Price block */}
              <div className="flex items-end gap-4">
                <div>
                  <div className="text-3xl font-black text-gray-900">₹{fmt(selectedStock.price)}</div>
                  <div className={`text-lg font-bold mt-0.5 ${chgColor(selectedStock.change)}`}>
                    {selectedStock.change >= 0 ? "▲" : "▼"} {Math.abs(selectedStock.change).toFixed(2)}% today
                  </div>
                </div>
                <div className={`ml-auto text-4xl font-black px-3 py-1.5 rounded-2xl ${scoreColor(selectedStock.score)}`}>
                  {selectedStock.score}
                </div>
              </div>

              {/* Day range visual */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Day Low ₹{fmt(selectedStock.low)}</span>
                  <span>Day High ₹{fmt(selectedStock.high)}</span>
                </div>
                <div className="relative h-3 bg-gray-100 rounded-full overflow-visible">
                  <div className="absolute h-full bg-gradient-to-r from-red-200 via-amber-200 to-emerald-200 rounded-full w-full" />
                  {/* Price marker */}
                  {selectedStock.high > selectedStock.low && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-indigo-600 rounded-full border-2 border-white shadow"
                      style={{ left: `${((selectedStock.price - selectedStock.low) / (selectedStock.high - selectedStock.low)) * 100}%`, transform: "translateX(-50%) translateY(-50%)" }}
                    />
                  )}
                </div>
                <div className="text-center text-xs text-indigo-600 font-semibold mt-1">
                  ₹{fmt(selectedStock.price)} — {selectedStock.high > selectedStock.low
                    ? `${Math.round(((selectedStock.price - selectedStock.low) / (selectedStock.high - selectedStock.low)) * 100)}% from day's low`
                    : "no range data"}
                </div>
              </div>

              {/* Section 1: vs Market */}
              {(() => {
                const niftyChg = data.market.nifty.change;
                const rs = selectedStock.rs;
                const { headline, detail, color } =
                  rs >= 3  ? { headline: `Strongly outperforming Nifty`, detail: `Nifty moved ${niftyChg >= 0 ? "+" : ""}${niftyChg.toFixed(2)}% but ${selectedStock.symbol} moved ${selectedStock.change >= 0 ? "+" : ""}${selectedStock.change.toFixed(2)}% — it beat the market by +${rs}%. This is a sign of strength even in the broader trend.`, color: "text-emerald-700" }
                  : rs >= 1 ? { headline: `Slightly beating Nifty`, detail: `${selectedStock.symbol} moved ${selectedStock.change >= 0 ? "+" : ""}${selectedStock.change.toFixed(2)}% vs Nifty's ${niftyChg >= 0 ? "+" : ""}${niftyChg.toFixed(2)}%. Mild outperformance of +${rs}% — decent but not a strong signal on its own.`, color: "text-blue-700" }
                  : rs >= -1 ? { headline: `Moving with the market`, detail: `${selectedStock.symbol} (${selectedStock.change >= 0 ? "+" : ""}${selectedStock.change.toFixed(2)}%) is tracking Nifty (${niftyChg >= 0 ? "+" : ""}${niftyChg.toFixed(2)}%) closely. No notable outperformance or underperformance today.`, color: "text-amber-700" }
                  : rs >= -3 ? { headline: `Lagging behind Nifty`, detail: `Nifty moved ${niftyChg >= 0 ? "+" : ""}${niftyChg.toFixed(2)}% but ${selectedStock.symbol} moved ${selectedStock.change >= 0 ? "+" : ""}${selectedStock.change.toFixed(2)}% — underperforming by ${rs}%. The stock is weaker than the broader market today.`, color: "text-orange-600" }
                  : { headline: `Significantly underperforming`, detail: `${selectedStock.symbol} fell ${selectedStock.change.toFixed(2)}% while Nifty moved ${niftyChg >= 0 ? "+" : ""}${niftyChg.toFixed(2)}% — a massive underperformance of ${rs}%. Avoid long positions; this is showing real weakness.`, color: "text-red-600" };
                return (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">vs Market (Relative Strength)</div>
                    <div className={`text-sm font-bold mb-1 ${color}`}>{rsLabel(rs).dot} {headline}</div>
                    <p className="text-xs text-gray-600 leading-relaxed">{detail}</p>
                    <div className="mt-2 flex gap-4 text-xs">
                      <span className="text-gray-500">Nifty today: <strong className={chgColor(niftyChg)}>{niftyChg >= 0 ? "+" : ""}{niftyChg.toFixed(2)}%</strong></span>
                      <span className="text-gray-500">This stock: <strong className={chgColor(selectedStock.change)}>{selectedStock.change >= 0 ? "+" : ""}{selectedStock.change.toFixed(2)}%</strong></span>
                    </div>
                  </div>
                );
              })()}

              {/* Section 2: Volume */}
              {(() => {
                const vr = selectedStock.volumeRatio;
                const up = selectedStock.change >= 0.5;
                const down = selectedStock.change <= -0.5;
                const { headline, detail, color } =
                  vr >= 3 && up   ? { headline: `Heavy buying — ${vr}x normal volume`, detail: `The stock is trading at ${vr}x its usual volume AND rising. This combination typically means institutions are actively buying. Strong signal.`, color: "text-emerald-700" }
                  : vr >= 3 && down ? { headline: `Heavy selling — ${vr}x normal volume`, detail: `The stock is trading at ${vr}x its usual volume but falling. High volume on a falling stock means institutions are selling. Avoid buying here.`, color: "text-red-600" }
                  : vr >= 1.5 ? { headline: `Above-average activity — ${vr}x`, detail: `More trades than usual are happening. Some institutional interest, but the direction (${up ? "rising" : down ? "falling" : "flat"}) tells the story. Watch if it sustains.`, color: "text-amber-700" }
                  : vr >= 1   ? { headline: `Normal volume — ${vr}x`, detail: `Trading at its normal pace. No unusual activity from big players. The move today may not have strong institutional backing yet.`, color: "text-gray-700" }
                  : { headline: `Very quiet — ${vr}x normal`, detail: `Well below normal volume. Institutions are sitting out. Any price move here is not confirmed by activity — treat it cautiously.`, color: "text-gray-500" };
                return (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Volume Activity</div>
                    <div className={`text-sm font-bold mb-1 ${color}`}>{volLabel(vr, selectedStock.change).dot} {headline}</div>
                    <p className="text-xs text-gray-600 leading-relaxed">{detail}</p>
                  </div>
                );
              })()}

              {/* Section 3: VWAP */}
              {(() => {
                const pricePct = selectedStock.high > selectedStock.low
                  ? Math.round(((selectedStock.price - selectedStock.low) / (selectedStock.high - selectedStock.low)) * 100)
                  : 50;
                const { headline, detail, color } = selectedStock.aboveVWAP
                  ? { headline: "Holding above midpoint — buyers in control", detail: `Price ₹${fmt(selectedStock.price)} is in the upper half of today's range (midpoint ₹${fmt(selectedStock.approxVWAP)}). Buyers have been winning all day. This is a bullish intraday signal — look for entries near the midpoint on dips.`, color: "text-emerald-700" }
                  : { headline: "Below midpoint — sellers in control", detail: `Price ₹${fmt(selectedStock.price)} is in the lower half of today's range (midpoint ₹${fmt(selectedStock.approxVWAP)}). Sellers have been dominant all day. Wait for price to reclaim the midpoint before considering a long entry.`, color: "text-red-600" };
                return (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Price Position (VWAP proxy)</div>
                    <div className={`text-sm font-bold mb-1 ${color}`}>{selectedStock.aboveVWAP ? "✓" : "✗"} {headline}</div>
                    <p className="text-xs text-gray-600 leading-relaxed">{detail}</p>
                    <div className="mt-2 text-xs text-gray-400">Position in today&apos;s range: {pricePct}% from the low</div>
                  </div>
                );
              })()}

              {/* Section 4: Sector context */}
              {(() => {
                const sec = data.sectors.find((s) => s.name === selectedStock.sector);
                const secRank = sec ? data.sectors.indexOf(sec) + 1 : null;
                const secChg = sec?.change ?? 0;
                const stockVsSector = parseFloat((selectedStock.change - secChg).toFixed(2));
                return (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Sector Context — {selectedStock.sector}</div>
                    {sec?.hasData ? (
                      <>
                        <div className={`text-sm font-bold mb-1 ${chgColor(secChg)}`}>
                          {selectedStock.sector} sector: {secChg >= 0 ? "+" : ""}{secChg.toFixed(2)}% · #{secRank} of 10 sectors today
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {secRank && secRank <= 3
                            ? `${selectedStock.sector} is one of the strongest sectors today. `
                            : secRank && secRank >= 8
                            ? `${selectedStock.sector} is one of the weakest sectors today. `
                            : `${selectedStock.sector} is in the middle of the pack today. `}
                          {stockVsSector >= 1
                            ? `${selectedStock.symbol} is outperforming its own sector by +${stockVsSector}% — showing individual strength within the sector.`
                            : stockVsSector <= -1
                            ? `${selectedStock.symbol} is underperforming its sector by ${stockVsSector}% — weaker than its peers.`
                            : `${selectedStock.symbol} is moving roughly in line with its sector.`}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-500">Sector index data unavailable today.</p>
                    )}
                  </div>
                );
              })()}

              {/* Open/High/Low summary */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[["Open", selectedStock.open], ["High", selectedStock.high], ["Low", selectedStock.low]].map(([label, val]) => (
                  <div key={label as string} className="bg-gray-50 rounded-xl py-2.5">
                    <div className="text-xs text-gray-400">{label}</div>
                    <div className="text-sm font-bold text-gray-800 mt-0.5">₹{fmt(val as number)}</div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
