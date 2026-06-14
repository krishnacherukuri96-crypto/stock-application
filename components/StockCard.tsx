"use client";

import { useState, useEffect } from "react";
import type { StockMetrics } from "@/lib/fetchers/stocks";
import StockDetailModal from "./StockDetailModal";

interface Props {
  stock: StockMetrics;
  rank: number;
  syncId?: number;
}

interface LivePrice {
  price?: number;
  change?: number;
  changePct?: number;
  loading?: boolean;
  error?: boolean;
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 85 ? "bg-green-500" : score >= 70 ? "bg-blue-500" : score >= 55 ? "bg-yellow-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-6">{score}</span>
    </div>
  );
}

export default function StockCard({ stock, rank, syncId }: Props) {
  const [livePrice, setLivePrice] = useState<LivePrice>({ loading: true });
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLivePrice({ loading: true });
    const fetchPrice = async () => {
      try {
        const res = await fetch(`/api/stock-price?symbol=${stock.yahooSymbol}`, { cache: "no-store" });
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        if (!cancelled) setLivePrice(data);
      } catch {
        if (!cancelled) setLivePrice({ error: true });
      }
    };
    fetchPrice();
    return () => { cancelled = true; };
  // syncId is intentionally included — changing it triggers a fresh fetch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stock.yahooSymbol, syncId]);

  const rankColor =
    rank === 1 ? "bg-yellow-400 text-yellow-900" :
    rank === 2 ? "bg-gray-300 text-gray-700" :
    rank === 3 ? "bg-amber-600 text-amber-100" :
    "bg-blue-50 text-blue-600";

  const changeColor =
    !livePrice.change || livePrice.change === 0 ? "text-gray-500" :
    livePrice.change > 0 ? "text-green-600" : "text-red-600";

  return (
    <>
      <div
        className="bg-white border border-gray-100 rounded-xl p-4 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer group"
        onClick={() => setShowModal(true)}
      >
        <div className="flex items-start justify-between mb-3">
          {/* Rank + name */}
          <div className="flex items-start gap-3">
            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 ${rankColor}`}>
              {rank}
            </span>
            <div>
              <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                {stock.name}
              </div>
              <div className="text-xs text-gray-400 font-mono">{stock.symbol}</div>
            </div>
          </div>

          {/* Live price */}
          <div className="text-right flex-shrink-0 ml-2">
            {livePrice.loading ? (
              <div className="text-xs text-gray-300 animate-pulse">Loading…</div>
            ) : livePrice.error ? (
              <div className="text-xs text-gray-300">—</div>
            ) : (
              <>
                <div className="text-sm font-bold text-gray-900">
                  ₹{livePrice.price?.toFixed(0)}
                </div>
                <div className={`text-xs ${changeColor}`}>
                  {livePrice.change && livePrice.change > 0 ? "+" : ""}
                  {livePrice.changePct?.toFixed(2)}%
                </div>
              </>
            )}
          </div>
        </div>

        {/* Score bar */}
        <div className="mb-3">
          <ScoreBar score={stock.score} />
        </div>

        {/* Key metrics row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center bg-gray-50 rounded-lg py-1.5">
            <div className="text-xs text-gray-400">ROE</div>
            <div className="text-sm font-semibold text-gray-800">{stock.roe}%</div>
          </div>
          <div className="text-center bg-gray-50 rounded-lg py-1.5">
            <div className="text-xs text-gray-400">P/E</div>
            <div className="text-sm font-semibold text-gray-800">{stock.pe}x</div>
          </div>
          <div className="text-center bg-gray-50 rounded-lg py-1.5">
            <div className="text-xs text-gray-400">D/E</div>
            <div className="text-sm font-semibold text-gray-800">{stock.debtToEquity}x</div>
          </div>
        </div>

        {/* Top reason */}
        <div className="flex items-start gap-1.5">
          <span className="text-green-500 text-xs flex-shrink-0 mt-0.5">✓</span>
          <p className="text-xs text-gray-500 line-clamp-2">{stock.strengths[0]}</p>
        </div>

        <div className="mt-3 text-xs text-blue-500 group-hover:text-blue-700 text-right font-medium">
          View analysis →
        </div>
      </div>

      {showModal && (
        <StockDetailModal
          stock={stock}
          livePrice={livePrice}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
