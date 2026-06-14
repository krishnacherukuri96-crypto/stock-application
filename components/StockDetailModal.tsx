"use client";

import { useEffect, useState, useCallback } from "react";
import type { StockMetrics } from "@/lib/fetchers/stocks";
import type { LiveFundamentals } from "@/app/api/stock-fundamentals/route";
import MetricExplainer from "./MetricExplainer";
import {
  explainPE, explainPEG, explainROE, explainROCE,
  explainGNPA, explainDebtEquity, explainRevenueGrowth,
  explainProfitGrowth, explainMargins, explainPromoterHolding,
  explainCASA, explainNIM, explainOrderBook,
} from "@/lib/explainers";

interface LivePrice {
  price?: number;
  change?: number;
  changePct?: number;
  loading?: boolean;
  error?: boolean;
}

type SyncStatus = "idle" | "syncing" | "done" | "error";

interface Props {
  stock: StockMetrics;
  livePrice: LivePrice;
  onClose: () => void;
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-2">
      <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ScoreBar({ label, score, max, color }: { label: string; score: number; max: number; color: string }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between mb-0.5">
        <span className="text-xs text-gray-600">{label}</span>
        <span className="text-xs font-semibold text-gray-800">{score}/{max}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${(score / max) * 100}%` }} />
      </div>
    </div>
  );
}

function DataBadge({ live }: { live: boolean }) {
  return live
    ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700 ml-1">LIVE</span>
    : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 ml-1">CURATED</span>;
}

function overallVerdict(score: number, stock: StockMetrics) {
  const label = score >= 75 ? "STRONG CANDIDATE" : score >= 60 ? "WATCHLIST MATERIAL" : score >= 45 ? "SELECTIVE ONLY" : "AVOID FOR NOW";
  const color = score >= 75 ? "bg-green-600" : score >= 60 ? "bg-blue-600" : score >= 45 ? "bg-yellow-500" : "bg-red-500";
  const peg = stock.pegRatio;
  const bd = stock.scoreBreakdown;
  const qualStr = bd.roce + bd.revenueGrowth + bd.profitGrowth + bd.debt + bd.margins >= 35 ? "strong fundamentals" : "moderate fundamentals";
  const valStr  = bd.valuation >= 12 ? "attractively valued" : bd.valuation >= 8 ? "fairly valued" : "expensive relative to growth";
  const mgmtStr = bd.management >= 8 ? "solid management alignment" : bd.management >= 6 ? "acceptable management" : "management concerns";
  return {
    label, color,
    summary: `Scores ${score}/100 — ${qualStr}, ${valStr} (PEG ${peg.toFixed(2)}), ${mgmtStr}.`,
  };
}

function formatAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function StockDetailModal({ stock, livePrice, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"analysis" | "score" | "whyrank">("analysis");
  const [live, setLive] = useState<LiveFundamentals | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");

  const fetchFundamentals = useCallback(async (force = false) => {
    setSyncStatus("syncing");
    try {
      const res = await fetch(`/api/stock-fundamentals?symbol=${stock.yahooSymbol}${force ? "&force=true" : ""}`);
      if (!res.ok) throw new Error("failed");
      const data: LiveFundamentals = await res.json();
      setLive(data);
      setSyncStatus("done");
    } catch {
      setSyncStatus("error");
    }
  }, [stock.yahooSymbol]);

  useEffect(() => {
    fetchFundamentals();
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fetchFundamentals, onClose]);

  // Merge: live data overrides curated where available
  const pe             = live?.pe             ?? stock.pe;
  const pb             = live?.pb             ?? stock.pb;
  const roe            = live?.roe            ?? stock.roe;
  const margin         = live?.netProfitMargin ?? stock.netProfitMargin;
  const marketCapCr    = live?.marketCapCr    ?? stock.marketCapCr;

  // Re-compute PEG from live PE if available
  const peg = pe / Math.max(1, stock.profitGrowth3yr);

  const isBanking = stock.sector === "banking";
  const extras = stock.extras ?? {};
  const casaVal = typeof extras["casa"] === "string" ? parseFloat(extras["casa"]) : undefined;
  const nimVal  = typeof extras["nim"]  === "string" ? parseFloat(extras["nim"])  : undefined;
  const obRatio = stock.orderBookRevRatio;

  const bd      = stock.scoreBreakdown;
  const verdict = overallVerdict(stock.score, stock);
  const priceColor = !livePrice.change ? "text-gray-500" : livePrice.change >= 0 ? "text-green-600" : "text-red-600";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{stock.symbol}</span>
              <span className="text-xs text-gray-400">NSE</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${verdict.color}`}>
                #{stock.rank} · {verdict.label}
              </span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">{stock.name}</h2>

            {/* Live price */}
            {livePrice.loading ? (
              <p className="text-sm text-gray-400 mt-1 animate-pulse">Fetching price…</p>
            ) : livePrice.price ? (
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-gray-900">₹{livePrice.price.toFixed(2)}</span>
                <span className={`text-sm font-medium ${priceColor}`}>
                  {(livePrice.change ?? 0) >= 0 ? "+" : ""}
                  {livePrice.change?.toFixed(2)} ({livePrice.changePct?.toFixed(2)}%)
                </span>
              </div>
            ) : (
              <p className="text-xs text-gray-400 mt-1">Live price unavailable</p>
            )}

            {/* Sync status strip */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {syncStatus === "syncing" && (
                <span className="text-xs text-blue-600 animate-pulse">⟳ Syncing fundamentals from Yahoo Finance…</span>
              )}
              {syncStatus === "done" && live && (
                <span className="text-xs text-green-700">
                  ✓ Synced {live.cached ? "(cached" : "(fresh"}, {formatAgo(live.fetchedAt)})
                </span>
              )}
              {syncStatus === "error" && (
                <span className="text-xs text-red-500">⚠ Sync failed — showing curated data</span>
              )}
              {(syncStatus === "done" || syncStatus === "error") && (
                <button
                  onClick={() => fetchFundamentals(true)}
                  className="text-xs text-blue-500 hover:text-blue-700 underline"
                >
                  Force refresh
                </button>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none ml-4 flex-shrink-0 mt-1">×</button>
        </div>

        {/* ── OVERALL VERDICT ─────────────────────────────────────────── */}
        <div className={`mx-5 mt-4 flex-shrink-0 rounded-xl p-4 border ${
          stock.score >= 75 ? "bg-green-50 border-green-200" :
          stock.score >= 60 ? "bg-blue-50 border-blue-200"  :
          stock.score >= 45 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"
        }`}>
          <div className="flex items-center gap-3 mb-1.5">
            <span className={`px-3 py-1 rounded-full text-white text-xs font-bold ${verdict.color}`}>{verdict.label}</span>
            <span className="text-sm font-bold text-gray-900">{stock.score}/100</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{verdict.summary}</p>
        </div>

        {/* ── TABS ────────────────────────────────────────────────────── */}
        <div className="flex mx-5 mt-4 gap-1 flex-shrink-0">
          {([
            { id: "analysis", label: "📊 Metric Analysis" },
            { id: "score",    label: "🔢 Score Breakdown" },
            { id: "whyrank",  label: "✓ Why This Rank" },
          ] as const).map(({ id, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>{label}</button>
          ))}
        </div>

        {/* ── SCROLLABLE BODY ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">

          {/* Legend */}
          {activeTab === "analysis" && (
            <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
              <span>Data source:</span>
              <span><DataBadge live={true} /> Pulled live from Yahoo Finance · auto-cached 24h</span>
              <span><DataBadge live={false} /> Manually verified from Screener.in / quarterly filings</span>
            </div>
          )}

          {/* ── TAB 1: METRIC ANALYSIS ── */}
          {activeTab === "analysis" && (
            <div className="space-y-3">

              <SectionHeader title="Layer 1 — Valuation" sub="Is this stock cheap or expensive right now?" />

              {/* PE with live badge */}
              <div className="relative">
                <div className="absolute -top-1 right-0 z-10"><DataBadge live={!!live?.pe} /></div>
                <MetricExplainer ex={explainPE(pe, stock.historicalPEAvg)} />
              </div>

              {/* PEG — uses live PE if available */}
              <div className="relative">
                <div className="absolute -top-1 right-0 z-10"><DataBadge live={!!live?.pe} /></div>
                <MetricExplainer ex={explainPEG(parseFloat(peg.toFixed(2)), pe, stock.profitGrowth3yr)} />
              </div>

              <SectionHeader title="Layer 2 — Business Quality" sub="Is this a fundamentally strong business?" />

              <div className="relative">
                <div className="absolute -top-1 right-0 z-10"><DataBadge live={!!live?.roe} /></div>
                <MetricExplainer ex={explainROE(roe)} />
              </div>

              <div className="relative">
                <div className="absolute -top-1 right-0 z-10"><DataBadge live={false} /></div>
                <MetricExplainer ex={explainROCE(stock.roce)} />
              </div>

              {isBanking ? (
                <div className="relative">
                  <div className="absolute -top-1 right-0 z-10"><DataBadge live={false} /></div>
                  <MetricExplainer ex={explainGNPA(stock.gnpa ?? 0)} />
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute -top-1 right-0 z-10"><DataBadge live={false} /></div>
                  <MetricExplainer ex={explainDebtEquity(stock.debtToEquity)} />
                </div>
              )}

              <div className="relative">
                <div className="absolute -top-1 right-0 z-10"><DataBadge live={!!live?.netProfitMargin} /></div>
                <MetricExplainer ex={explainMargins(margin, stock.fcfPositive, stock.ocfGtNetProfit)} />
              </div>

              <SectionHeader title="Layer 3 — Growth" sub="Is the company growing fast enough?" />
              <div className="relative">
                <div className="absolute -top-1 right-0 z-10"><DataBadge live={false} /></div>
                <MetricExplainer ex={explainRevenueGrowth(stock.revenueGrowth3yr)} />
              </div>
              <div className="relative">
                <div className="absolute -top-1 right-0 z-10"><DataBadge live={false} /></div>
                <MetricExplainer ex={explainProfitGrowth(stock.profitGrowth3yr)} />
              </div>

              {/* Recent quarter growth from Yahoo */}
              {(live?.revenueGrowthQtr != null || live?.earningsGrowthQtr != null) && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
                  <p className="text-xs font-semibold text-blue-700 mb-2">🔄 Most Recent Quarter (Live from Yahoo Finance)</p>
                  <div className="grid grid-cols-2 gap-3">
                    {live?.revenueGrowthQtr != null && (
                      <div className="bg-white rounded-lg p-2.5 text-center">
                        <p className="text-xs text-gray-500">Revenue Growth (YoY)</p>
                        <p className={`text-lg font-bold ${live.revenueGrowthQtr >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {live.revenueGrowthQtr >= 0 ? "+" : ""}{live.revenueGrowthQtr.toFixed(1)}%
                        </p>
                      </div>
                    )}
                    {live?.earningsGrowthQtr != null && (
                      <div className="bg-white rounded-lg p-2.5 text-center">
                        <p className="text-xs text-gray-500">Earnings Growth (YoY)</p>
                        <p className={`text-lg font-bold ${live.earningsGrowthQtr >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {live.earningsGrowthQtr >= 0 ? "+" : ""}{live.earningsGrowthQtr.toFixed(1)}%
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    This is the latest available quarterly result — different from the 3-year CAGR above which uses curated annual data.
                  </p>
                </div>
              )}

              {/* Banking-specific */}
              {isBanking && casaVal !== undefined && (
                <>
                  <SectionHeader title="Banking-Specific Metrics" sub="Critical for bank profitability" />
                  <div className="relative">
                    <div className="absolute -top-1 right-0 z-10"><DataBadge live={false} /></div>
                    <MetricExplainer ex={explainCASA(casaVal)} />
                  </div>
                  {nimVal !== undefined && (
                    <div className="relative">
                      <div className="absolute -top-1 right-0 z-10"><DataBadge live={false} /></div>
                      <MetricExplainer ex={explainNIM(nimVal)} />
                    </div>
                  )}
                </>
              )}

              {/* Order book */}
              {obRatio !== undefined && (
                <>
                  <SectionHeader title="Growth Visibility — Order Book" sub="Revenue already locked in" />
                  <div className="relative">
                    <div className="absolute -top-1 right-0 z-10"><DataBadge live={false} /></div>
                    <MetricExplainer ex={explainOrderBook(obRatio)} />
                  </div>
                </>
              )}

              <SectionHeader title="Layer 4 — Management" sub="Are the people running this trustworthy?" />
              <div className="relative">
                <div className="absolute -top-1 right-0 z-10"><DataBadge live={false} /></div>
                <MetricExplainer ex={explainPromoterHolding(stock.promoterHolding, stock.promoterPledgePct, stock.promoterTrend, stock.sector)} />
              </div>

              {/* Curated note */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
                <p className="font-semibold text-gray-700 mb-1">What is synced vs curated?</p>
                <p><span className="font-medium text-green-700">LIVE</span> — PE, P/B, ROE, Net Margin, Market Cap, Recent Quarter Growth are pulled directly from Yahoo Finance and cached for 24 hours in our database. They update automatically.</p>
                <p className="mt-1"><span className="font-medium text-gray-600">CURATED</span> — ROCE, GNPA, CASA, NIM, Order Book, Promoter holding, 3-yr CAGR, FCF, Historical PE avg are sourced from Screener.in and quarterly company filings. These are manually verified and updated after each quarterly result.</p>
              </div>

              {/* Strengths & watchouts */}
              <div className="grid grid-cols-1 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-green-800 mb-2">✅ What makes this attractive</p>
                  <ul className="space-y-1">
                    {stock.strengths.slice(0, 3).map((s, i) => (
                      <li key={i} className="text-xs text-green-700 flex items-start gap-1.5">
                        <span className="mt-0.5 flex-shrink-0">✓</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-yellow-800 mb-2">⚠ Watch out for</p>
                  <ul className="space-y-1">
                    {stock.watchouts.map((w, i) => (
                      <li key={i} className="text-xs text-yellow-700 flex items-start gap-1.5">
                        <span className="mt-0.5 flex-shrink-0">⚠</span>{w}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: SCORE BREAKDOWN ── */}
          {activeTab === "score" && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-gray-800">Total Score</span>
                  <span className={`text-lg font-black px-3 py-1 rounded-full text-white ${verdict.color}`}>{stock.score}/100</span>
                </div>

                <div className="bg-white rounded-lg p-3 mb-3 border border-blue-100">
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    Layer 1: Business Quality ({bd.roce + bd.revenueGrowth + bd.profitGrowth + bd.debt + bd.margins}/55)
                  </p>
                  <ScoreBar label="ROCE" score={bd.roce} max={15} color="bg-blue-500" />
                  <ScoreBar label="Revenue Growth (3yr CAGR)" score={bd.revenueGrowth} max={10} color="bg-blue-400" />
                  <ScoreBar label="Profit Growth (3yr CAGR)" score={bd.profitGrowth} max={10} color="bg-blue-400" />
                  <ScoreBar label={isBanking ? "Asset Quality (GNPA)" : "Debt / Equity"} score={bd.debt} max={10} color="bg-blue-400" />
                  <ScoreBar label="Margins + FCF Quality" score={bd.margins} max={10} color="bg-blue-400" />
                </div>

                <div className="bg-white rounded-lg p-3 mb-3 border border-purple-100">
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    Layer 2: Valuation — PEG + PE vs 10-yr History ({bd.valuation}/15)
                  </p>
                  <ScoreBar label="PEG ratio + PE vs historical avg" score={bd.valuation} max={15} color="bg-purple-500" />
                  <p className="text-xs text-gray-500 mt-1">
                    PEG = {parseFloat(peg.toFixed(2))} · Current PE {pe}x vs 10yr avg {stock.historicalPEAvg}x
                    {live?.pe ? " (PE is live from Yahoo Finance)" : " (PE from curated data)"}
                  </p>
                </div>

                <div className="bg-white rounded-lg p-3 mb-3 border border-green-100">
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    Layer 3: Growth Sustainability — Industry + Order Book ({bd.industryTailwind}/10)
                  </p>
                  <ScoreBar label="Industry tailwind + order book coverage" score={bd.industryTailwind} max={10} color="bg-green-500" />
                  {obRatio !== undefined && (
                    <p className="text-xs text-gray-500 mt-1">
                      Order book / Revenue: {obRatio}× → {obRatio >= 5 ? "+2 bonus pts" : obRatio >= 3 ? "+1 bonus pt" : "no bonus"}
                    </p>
                  )}
                </div>

                <div className="bg-white rounded-lg p-3 mb-3 border border-orange-100">
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    Layer 4: Management Quality ({bd.management}/10)
                  </p>
                  <ScoreBar label="Pledge (0% = full marks) + trend + holding" score={bd.management} max={10} color="bg-orange-500" />
                  <p className="text-xs text-gray-500 mt-1">
                    Pledge: {stock.promoterPledgePct}% · Trend: {stock.promoterTrend} · Holding: {stock.promoterHolding}%
                  </p>
                </div>

                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    Layer 5: Market Behaviour ({bd.institutional + bd.technical}/10)
                  </p>
                  <ScoreBar label="Institutional ownership trend" score={bd.institutional} max={5} color="bg-gray-500" />
                  <ScoreBar label="Technical (price vs 200 DMA)" score={bd.technical} max={5} color="bg-gray-400" />
                  <p className="text-xs text-gray-500 mt-1">Institutional trend: {stock.institutionalTrend}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-600 space-y-1.5">
                <p className="font-semibold text-gray-700">How the 5-Layer Score Works</p>
                <p>Business Quality (55 pts): ROCE 15 + Revenue Growth 10 + Profit Growth 10 + Debt/GNPA 10 + Margins+FCF 10</p>
                <p>Valuation (15 pts): Scored on PEG ratio AND PE vs own 10-year historical average — so a slow grower with low P/E is not rewarded, and a fast grower at fair P/E is not penalised.</p>
                <p>Growth Sustainability (10 pts): Industry tailwind score + up to +2 pts for high order book coverage.</p>
                <p>Management (10 pts): Pledge 4 pts + trend 4 pts + holding 2 pts. Zero pledge = full 4 pts.</p>
                <p>Market Behaviour (10 pts): Institutional trend 5 pts + technical trend 5 pts.</p>
              </div>
            </div>
          )}

          {/* ── TAB 3: WHY THIS RANK ── */}
          {activeTab === "whyrank" && (
            <div className="space-y-4">
              <SectionHeader title={`Why #${stock.rank} in Sector (${stock.score}/100)`} sub="Based on 5-layer fundamental analysis" />
              <div className="space-y-2">
                {stock.strengths.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 bg-green-50 border border-green-100 rounded-lg p-3">
                    <span className="text-green-600 flex-shrink-0">✓</span>
                    <p className="text-sm text-gray-700">{s}</p>
                  </div>
                ))}
              </div>

              <SectionHeader title="Watch-outs" sub="Risks to understand before deciding" />
              <div className="space-y-2">
                {stock.watchouts.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 bg-yellow-50 border border-yellow-100 rounded-lg p-3">
                    <span className="text-yellow-600 flex-shrink-0">⚠</span>
                    <p className="text-sm text-gray-700">{w}</p>
                  </div>
                ))}
              </div>

              {/* Quick snapshot with live/curated distinction */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-600 mb-3">Quick Snapshot</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {([
                    ["P/E", `${pe}x`, !!live?.pe],
                    ["10-yr avg PE", `${stock.historicalPEAvg}x`, false],
                    ["PEG", parseFloat(peg.toFixed(2)).toString(), !!live?.pe],
                    ["Market Cap", `₹${((marketCapCr ?? 0) / 100).toFixed(0)}k Cr`, !!live?.marketCapCr],
                    ["ROE", `${roe}%`, !!live?.roe],
                    ["ROCE", `${stock.roce}%`, false],
                    isBanking ? ["GNPA", `${stock.gnpa}%`, false] : ["D/E", `${stock.debtToEquity}x`, false],
                    ["Rev Growth 3yr", `${stock.revenueGrowth3yr}%`, false],
                    ["Profit Growth 3yr", `${stock.profitGrowth3yr}%`, false],
                    ["Net Margin", `${margin}%`, !!live?.netProfitMargin],
                    ["FCF", stock.fcfPositive ? "Positive" : "Negative", false],
                    ["Pledge", `${stock.promoterPledgePct}%`, false],
                  ] as [string, string, boolean][]).map(([k, v, isLive]) => (
                    <div key={k} className="flex justify-between items-center bg-white rounded p-2 border border-gray-100">
                      <span className="text-gray-500">{k}</span>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-gray-900">{v}</span>
                        <DataBadge live={isLive} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <a href={stock.screenerUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
                View Full Financials on Screener.in →
              </a>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center pb-2">
            Not investment advice · Live data: Yahoo Finance · Curated: Screener.in + filings
          </p>
        </div>
      </div>
    </div>
  );
}
