"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type MomentumStatus = "running" | "fading" | "reversing" | "flat" | "falling";

interface MomentumStock {
  symbol: string;
  name: string;
  ltp: number;
  open: number;
  prevClose: number;
  high: number;
  low: number;
  volume: number;
  pctChange: number;
  openGap: number;
  fromOpen: number;
  highProximity: number;
  momentumScore: number;
  status: MomentumStatus;
}

interface MomentumResponse {
  stocks: MomentumStock[];
  fetchedAt: string;
  marketOpen: boolean;
  total: number;
  source?: "custom" | "default";
  error?: string;
}

const REFRESH_MS = 8000;

function fmt(n: number | undefined, d = 2) {
  if (n === undefined || n === null || !isFinite(n)) return "—";
  return n.toFixed(d);
}

function pctColor(v: number) {
  if (v >= 2)    return "text-emerald-600 font-bold";
  if (v >= 0.5)  return "text-emerald-500";
  if (v >= -0.5) return "text-gray-500";
  if (v >= -2)   return "text-red-500";
  return "text-red-600 font-bold";
}

function scoreColor(v: number) {
  if (v >= 4)  return "text-emerald-600 font-bold";
  if (v >= 2)  return "text-emerald-500";
  if (v >= 0)  return "text-gray-500";
  if (v >= -2) return "text-red-400";
  return "text-red-600 font-bold";
}

function StatusBadge({ status }: { status: MomentumStatus }) {
  const cfg: Record<MomentumStatus, { label: string; cls: string }> = {
    running:   { label: "🚀 Running",    cls: "bg-emerald-100 text-emerald-700" },
    fading:    { label: "⚠️ Fading",     cls: "bg-amber-100 text-amber-700"    },
    reversing: { label: "↩️ Reversing",  cls: "bg-orange-100 text-orange-700"  },
    falling:   { label: "📉 Falling",    cls: "bg-red-100 text-red-700"        },
    flat:      { label: "— Flat",        cls: "bg-gray-100 text-gray-500"      },
  };
  const { label, cls } = cfg[status];
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

function RangeBar({ proximity }: { proximity: number }) {
  const pct   = Math.round(Math.max(0, Math.min(1, proximity)) * 100);
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[60px]">
        <div className={`${color} h-1.5 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-400 w-7 text-right">{pct}%</span>
    </div>
  );
}

type FilterKey = "all" | "running" | "fading" | "falling";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",     label: "All Stocks" },
  { key: "running", label: "🚀 Running"  },
  { key: "fading",  label: "⚠️ Fading"   },
  { key: "falling", label: "📉 Falling"  },
];

export default function MomentumPage() {
  const [data,      setData]      = useState<MomentumResponse | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_MS / 1000);
  const [filter,    setFilter]    = useState<FilterKey>("all");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/momentum");
      const json: MomentumResponse = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setCountdown(REFRESH_MS / 1000);
    }
  }, []);

  // Auto-refresh every 8 s
  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(iv);
  }, [fetchData]);

  // Countdown tick
  useEffect(() => {
    timerRef.current = setInterval(
      () => setCountdown(c => (c > 1 ? c - 1 : REFRESH_MS / 1000)),
      1000,
    );
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const stocks = data?.stocks ?? [];

  const counts = {
    running:  stocks.filter(s => s.status === "running").length,
    fading:   stocks.filter(s => s.status === "fading" || s.status === "reversing").length,
    falling:  stocks.filter(s => s.status === "falling").length,
    gainers:  stocks.filter(s => s.pctChange > 0).length,
    losers:   stocks.filter(s => s.pctChange < 0).length,
  };

  const filtered = filter === "all"
    ? stocks
    : filter === "fading"
      ? stocks.filter(s => s.status === "fading" || s.status === "reversing")
      : stocks.filter(s => s.status === filter);

  return (
    <div className="min-h-screen bg-gray-50 p-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Intraday Momentum Scanner</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.source === "custom"
              ? `Custom watchlist (${data.total} stocks) · Live via Dhan API · refreshes every 8s`
              : "Nifty 50 defaults · Live via Dhan API · refreshes every 8s"}
          </p>
        </div>

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
          {data && (
            <p className="text-xs text-gray-400 mt-1">
              {new Date(data.fetchedAt).toLocaleTimeString("en-IN")} · next in {countdown}s
            </p>
          )}
        </div>
      </div>

      {/* ── Strategy guide ── */}
      <div className="mb-5 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800 leading-relaxed">
        <strong>How to use this:</strong>&nbsp;
        🚀 <b>Running</b> — stock is up strongly AND still near its day high → momentum intact, consider entry.&nbsp;
        ⚠️ <b>Fading</b> — stock was up but is now pulling back from the high → momentum dying, look to exit.&nbsp;
        📉 <b>Falling</b> — avoid.
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error.includes("DHAN_ACCESS_TOKEN")
            ? "Dhan credentials not set. Add DHAN_ACCESS_TOKEN and DHAN_CLIENT_ID to your Vercel environment variables and redeploy."
            : `Error: ${error}`}
        </div>
      )}

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Gainers",   value: counts.gainers,  cls: "text-emerald-600" },
          { label: "Losers",    value: counts.losers,   cls: "text-red-500"     },
          { label: "🚀 Running",  value: counts.running,  cls: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
          { label: "⚠️ Fading",   value: counts.fading,   cls: "text-amber-700",   bg: "bg-amber-50 border-amber-200"    },
          { label: "📉 Falling",  value: counts.falling,  cls: "text-red-700",     bg: "bg-red-50 border-red-200"        },
        ].map(c => (
          <div key={c.label} className={`rounded-xl border p-4 shadow-sm ${c.bg ?? "bg-white"}`}>
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{c.label}</div>
            <div className={`text-2xl font-bold ${c.cls}`}>{loading ? "—" : c.value}</div>
          </div>
        ))}
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white border text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f.label}
            {f.key !== "all" && (
              <span className="ml-1.5 text-xs opacity-70">
                ({f.key === "running" ? counts.running : f.key === "fading" ? counts.fading : counts.falling})
              </span>
            )}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400 self-center">
          {filtered.length} stock{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="bg-white rounded-2xl border p-16 text-center text-gray-400 text-sm">
          Fetching live data from Dhan…
        </div>
      ) : (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">LTP (₹)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Change %</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Gap %</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">From Open</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[140px]">Day Position</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Score</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((s, i) => (
                  <tr
                    key={s.symbol}
                    className={`hover:bg-gray-50 transition-colors ${
                      s.status === "running"
                        ? "bg-emerald-50/40"
                        : s.status === "fading" || s.status === "reversing"
                          ? "bg-amber-50/30"
                          : s.status === "falling"
                            ? "bg-red-50/20"
                            : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{i + 1}</td>

                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900 leading-tight">{s.symbol}</div>
                      <div className="text-xs text-gray-400">{s.name}</div>
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">
                      {fmt(s.ltp)}
                    </td>

                    <td className={`px-4 py-3 text-right font-mono ${pctColor(s.pctChange)}`}>
                      {s.pctChange >= 0 ? "+" : ""}{fmt(s.pctChange)}%
                    </td>

                    <td className={`px-4 py-3 text-right font-mono text-xs ${pctColor(s.openGap)}`}>
                      {s.openGap >= 0 ? "+" : ""}{fmt(s.openGap)}%
                    </td>

                    <td className={`px-4 py-3 text-right font-mono text-xs ${pctColor(s.fromOpen)}`}>
                      {s.fromOpen >= 0 ? "+" : ""}{fmt(s.fromOpen)}%
                    </td>

                    <td className="px-4 py-3">
                      <RangeBar proximity={s.highProximity} />
                      <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                        <span>L {fmt(s.low)}</span>
                        <span>H {fmt(s.high)}</span>
                      </div>
                    </td>

                    <td className={`px-4 py-3 text-right font-mono text-sm ${scoreColor(s.momentumScore)}`}>
                      {s.momentumScore > 0 ? "+" : ""}{fmt(s.momentumScore)}
                    </td>

                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-gray-400 text-sm">
                      No stocks match this filter right now.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Column legend ── */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Change %",    desc: "% move from yesterday's close. Primary direction signal." },
          { label: "Gap %",       desc: "How much the stock opened above/below yesterday's close." },
          { label: "From Open",   desc: "% move since today's open. Positive = still building momentum." },
          { label: "Day Position",desc: "Bar shows where LTP sits between today's low and high. Near 100% = near day high = momentum intact." },
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
