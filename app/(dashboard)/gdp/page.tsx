import MetricCard from "@/components/MetricCard";
import PageHeader from "@/components/PageHeader";
import TrendChart from "@/components/TrendChart";
import { fetchQuarterlyGDP, fetchAnnualGDPFY } from "@/lib/fetchers/mospi";
import { fetchGDP } from "@/lib/fetchers/worldbank";

export const revalidate = 86400;

export default async function GDPPage() {
  const [quarterly, annualFY, wb] = await Promise.all([
    Promise.resolve(fetchQuarterlyGDP()),
    Promise.resolve(fetchAnnualGDPFY()),
    fetchGDP(),
  ]);

  const latestQuarter = quarterly[quarterly.length - 1];
  const prevQuarter = quarterly[quarterly.length - 2];
  const latestAnnual = annualFY[annualFY.length - 1];
  const prevAnnual = annualFY[annualFY.length - 2];
  const latestNominal = wb.nominal[wb.nominal.length - 1];

  const quarterlyChartData = quarterly.map((d) => ({
    quarter: d.quarter.replace(" FY", "\nFY"),
    growth: d.growth,
    type: d.type,
  }));

  const annualChartData = annualFY.map((d) => ({
    fy: d.fy,
    growth: d.growth,
  }));

  const typeLabel: Record<string, string> = {
    actual: "Actual",
    first_estimate: "1st Est.",
    advance: "Advance Est.",
  };

  return (
    <div>
      <PageHeader
        title="GDP — Gross Domestic Product"
        description="India's quarterly and annual GDP growth from MOSPI National Accounts. Most recent quarter shown is the latest MOSPI estimate."
        lastUpdated={new Date().toISOString()}
        source="MOSPI National Accounts Statistics · World Bank (nominal USD)"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Latest Quarter (YoY)"
          value={`${latestQuarter.growth}%`}
          sub={`${latestQuarter.quarter} · ${typeLabel[latestQuarter.type]}`}
          change={latestQuarter.growth - prevQuarter.growth}
          badge={typeLabel[latestQuarter.type]}
          badgeColor={latestQuarter.type === "actual" ? "green" : "yellow"}
        />
        <MetricCard
          label="FY Annual Growth"
          value={`${latestAnnual.growth}%`}
          sub={`FY ${latestAnnual.fy} · Advance Est.`}
          change={latestAnnual.growth - prevAnnual.growth}
          badge="Full Year"
          badgeColor="blue"
        />
        <MetricCard
          label="Prev Quarter (YoY)"
          value={`${prevQuarter.growth}%`}
          sub={prevQuarter.quarter}
        />
        <MetricCard
          label="Nominal GDP (World Bank)"
          value={latestNominal?.value ? `$${(latestNominal.value / 1e12).toFixed(2)}T` : "—"}
          sub={latestNominal ? `CY ${latestNominal.year}` : ""}
        />
      </div>

      {/* Quarterly chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Quarterly GDP Growth (YoY %)</h2>
            <p className="text-xs text-gray-400 mt-0.5">Source: MOSPI National Accounts · Q4 FY2024-25 onwards are estimates</p>
          </div>
          <div className="flex gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>Actual</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span>Estimate</span>
          </div>
        </div>
        <TrendChart
          data={quarterlyChartData}
          xKey="quarter"
          yKey="growth"
          label="GDP Growth"
          unit="%"
          color="#10b981"
          type="bar"
          referenceValue={0}
        />
      </div>

      {/* Annual FY chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-1">Annual GDP Growth — by Indian FY (%)</h2>
        <p className="text-xs text-gray-400 mb-4">FY2025-26 is First Advance Estimate (Jan 2026). Source: MOSPI</p>
        <TrendChart
          data={annualChartData}
          xKey="fy"
          yKey="growth"
          label="GDP Growth"
          unit="%"
          color="#6366f1"
          type="area"
          referenceValue={0}
        />
      </div>

      {/* Data lag notice */}
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-800 mb-6 flex gap-3">
        <span className="text-lg">ℹ️</span>
        <div>
          <p className="font-semibold">About GDP data freshness</p>
          <p className="mt-0.5">MOSPI releases quarterly estimates with a ~2 month lag (e.g. Q3 Oct–Dec released in Feb). Advance Estimates for the full year come in January. World Bank annual data lags by ~6 months and uses calendar year, not Indian FY.</p>
        </div>
      </div>

      <div className="bg-green-50 border border-green-100 rounded-2xl p-5 text-sm text-green-800 space-y-2">
        <p className="font-semibold">Interpreting GDP Data</p>
        <p><strong>Real GDP Growth</strong> — Inflation-adjusted. India targets 7–8% for sustained development. Below 5% signals stress.</p>
        <p><strong>Advance vs Actual</strong> — MOSPI releases advance estimates in Jan (before FY ends), then revises with final actuals by Sep of next FY.</p>
        <p><strong>GVA breakdown</strong> — Agriculture (~15%), Industry (~28%), Services (~57%). Services is the growth engine; watch agriculture during drought years.</p>
        <p><strong>GDP Deflator</strong> — When deflator &gt; CPI, it signals production-side inflation (good for revenue growth, watch margins).</p>
      </div>
    </div>
  );
}
