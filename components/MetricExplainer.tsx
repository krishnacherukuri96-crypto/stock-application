"use client";

import { useState } from "react";
import type { Explanation, Rating } from "@/lib/explainers";

const ratingStyles: Record<Rating, { border: string; bg: string; badge: string; bar: string }> = {
  excellent: { border: "border-green-200",  bg: "bg-green-50",  badge: "bg-green-100 text-green-800",  bar: "bg-green-500" },
  good:      { border: "border-green-200",  bg: "bg-green-50",  badge: "bg-green-100 text-green-800",  bar: "bg-green-400" },
  fair:      { border: "border-yellow-200", bg: "bg-yellow-50", badge: "bg-yellow-100 text-yellow-800", bar: "bg-yellow-400" },
  weak:      { border: "border-red-200",    bg: "bg-red-50",    badge: "bg-red-100 text-red-800",      bar: "bg-red-400" },
  danger:    { border: "border-red-300",    bg: "bg-red-50",    badge: "bg-red-200 text-red-900",      bar: "bg-red-600" },
};

export default function MetricExplainer({ ex }: { ex: Explanation }) {
  const [open, setOpen] = useState(false);
  const s = ratingStyles[ex.rating];

  return (
    <div className={`rounded-xl border ${s.border} overflow-hidden`}>
      {/* Always-visible header — click to expand */}
      <button
        className={`w-full text-left px-4 py-3 ${s.bg} flex items-start justify-between gap-3`}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{ex.metric}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.badge}`}>{ex.badgeText}</span>
            <span className="font-bold text-gray-900">{ex.value}</span>
          </div>
          <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{ex.summary}</p>
        </div>
        <span className="text-gray-400 text-sm flex-shrink-0 mt-0.5">{open ? "▲" : "▼"}</span>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 pt-3 bg-white border-t border-gray-100 space-y-4">

          {/* What it means */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">📖 What it means</p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{ex.whatItMeans}</p>
          </div>

          {/* Analogy */}
          {ex.analogy && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-600 mb-1">💡 Simple analogy</p>
              <p className="text-sm text-blue-800 leading-relaxed whitespace-pre-line">{ex.analogy}</p>
            </div>
          )}

          {/* Benchmark table */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">📊 How to read this number</p>
            <div className="space-y-1.5">
              {ex.benchmark.map((b, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
                    b.isActive
                      ? `${s.bg} ${s.border} border font-semibold`
                      : "bg-gray-50 text-gray-600"
                  }`}
                >
                  <span className={`flex-shrink-0 mt-0.5 ${b.isActive ? "text-blue-600" : "text-gray-300"}`}>
                    {b.isActive ? "●" : "○"}
                  </span>
                  <div>
                    <span className="font-medium text-gray-700">{b.range}</span>
                    <span className="text-gray-500"> — {b.label}</span>
                    {b.isActive && <span className={`ml-2 text-xs font-bold px-1.5 py-0.5 rounded ${s.badge}`}>YOU ARE HERE</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Investment impact */}
          <div className={`rounded-lg p-3 border ${s.border} ${s.bg}`}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">🎯 What this means for your decision</p>
            <p className="text-sm text-gray-700 leading-relaxed">{ex.impact}</p>
          </div>
        </div>
      )}
    </div>
  );
}
