"use client";

import { useState, useCallback } from "react";
import StockCard from "@/components/StockCard";
import { SECTORS, getSectorStocks, type SectorKey } from "@/lib/fetchers/stocks";
import type { NewsItem } from "@/app/api/stock-news/route";

export default function StockSelectionPage() {
  const [activeSector, setActiveSector] = useState<SectorKey>("banking");
  const [syncId, setSyncId] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsError, setNewsError] = useState(false);

  const stocks = getSectorStocks(activeSector);
  const sector = SECTORS.find((s) => s.key === activeSector)!;

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setNewsError(false);

    // Bump syncId — every StockCard depends on this and will re-fetch its price
    setSyncId((n) => n + 1);

    // Fetch news for the top 5 stocks in the visible sector
    const topSymbols = stocks.slice(0, 5).map((s) => s.yahooSymbol).join(",");
    try {
      const res = await fetch(
        `/api/stock-news?symbols=${encodeURIComponent(topSymbols)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("news fetch failed");
      const data = await res.json();
      setNews(data.news ?? []);
    } catch {
      setNewsError(true);
      setNews([]);
    }

    setLastSynced(new Date());
    setSyncing(false);
  }, [stocks]);

  // When sector changes, clear stale news (prices re-fetch automatically via syncId=0 on mount)
  function handleSectorChange(key: SectorKey) {
    setActiveSector(key);
    setNews([]);
    setNewsError(false);
    setLastSynced(null);
  }

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Selection</h1>
          <p className="mt-1 text-sm text-gray-500">
            Top stocks per sector ranked by fundamental quality — ROE, ROCE, revenue growth, D/E, and margins.
            Click any stock for the full rationale.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Source: Screener.in · Yahoo Finance (live prices) · Company annual reports
          </p>
        </div>

        {/* Sync button */}
        <div className="flex-shrink-0 ml-6 text-right">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-all shadow"
          >
            <span className={syncing ? "animate-spin inline-block" : ""}>🔄</span>
            {syncing ? "Syncing…" : "Sync Now"}
          </button>
          {lastSynced && !syncing && (
            <p className="text-xs text-gray-400 mt-1.5">
              ✓ Updated {lastSynced.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
          {!lastSynced && !syncing && (
            <p className="text-xs text-gray-400 mt-1.5">Prices load on open · Sync for refresh</p>
          )}
        </div>
      </div>

      {/* ── Sector selector ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-8 mt-4">
        {SECTORS.map((s) => {
          const stockCount = getSectorStocks(s.key).length;
          const isActive = s.key === activeSector;
          return (
            <button
              key={s.key}
              onClick={() => handleSectorChange(s.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                isActive
                  ? "bg-blue-600 text-white border-blue-600 shadow-md"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
              {stockCount === 0 && (
                <span className="text-xs opacity-60">(soon)</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Active sector header ─────────────────────────────────────────────── */}
      <div className={`rounded-2xl border p-5 mb-6 ${sector.bgColor}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{sector.icon}</span>
              <h2 className={`text-lg font-bold ${sector.color}`}>{sector.label}</h2>
            </div>
            <p className="text-sm text-gray-600">{sector.description}</p>
            <p className="text-xs text-gray-500 mt-1">
              <strong>How ranked:</strong> {sector.scoringNote}
            </p>
          </div>
          <div className="text-right flex-shrink-0 ml-4">
            <div className="text-2xl font-bold text-gray-700">{stocks.length}</div>
            <div className="text-xs text-gray-500">stocks</div>
          </div>
        </div>
      </div>

      {/* ── Stock grid ──────────────────────────────────────────────────────── */}
      {stocks.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border border-gray-100">
          <div className="text-4xl mb-3">{sector.icon}</div>
          <p className="text-gray-500 font-medium">{sector.label} stocks coming soon</p>
          <p className="text-sm text-gray-400 mt-1">
            Data for this sector is being curated and verified
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {stocks.map((stock) => (
            <StockCard key={stock.symbol} stock={stock} rank={stock.rank} syncId={syncId} />
          ))}
        </div>
      )}

      {/* ── Recent News ─────────────────────────────────────────────────────── */}
      {news.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Recent News — {sector.label}</h3>
            <span className="text-xs text-gray-400">{news.length} articles</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {news.map((item) => (
              <a
                key={item.id}
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className="bg-white rounded-xl border px-4 py-3 hover:border-blue-300 hover:bg-blue-50/20 transition-all group"
              >
                <p className="text-sm font-medium text-gray-800 group-hover:text-blue-700 leading-snug line-clamp-2">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-blue-500 font-medium">{item.source}</span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-400">
                    {new Date(item.publishedAt).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {newsError && lastSynced && (
        <div className="mt-6 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
          News feed temporarily unavailable. Prices above are still refreshed.
        </div>
      )}

      {/* ── Prompt to sync ──────────────────────────────────────────────────── */}
      {stocks.length > 0 && !lastSynced && (
        <div className="mt-6 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-xs text-indigo-700 flex items-center justify-between">
          <span>Hit <strong>Sync Now</strong> to refresh all prices and pull the latest {sector.label} news.</span>
          <button
            onClick={handleSync}
            className="ml-4 px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
          >
            Sync Now
          </button>
        </div>
      )}

      {/* ── Disclaimer ──────────────────────────────────────────────────────── */}
      <div className="mt-8 bg-yellow-50 border border-yellow-100 rounded-2xl p-4 text-xs text-yellow-800">
        <strong>Disclaimer:</strong> This is a personal research tool. Fundamental data is sourced from
        Screener.in and company annual reports. Live prices are fetched from Yahoo Finance. Rankings are based on
        a multi-factor fundamental model — not buy/sell recommendations. Always verify with latest filings and
        consult a SEBI-registered advisor before investing.
      </div>
    </div>
  );
}
