import MetricCard from "@/components/MetricCard";
import PageHeader from "@/components/PageHeader";
import TrendChart from "@/components/TrendChart";
import { fetchFiscalData } from "@/lib/fetchers/fiscal";

export const revalidate = 86400;

export default async function FiscalDeficitPage() {
  const data = await fetchFiscalData();

  const latest = data[data.length - 1];
  const prev = data[data.length - 2];
  const budgeted = data.find((d) => d.type === "budget");
  const change =
    latest && prev ? latest.deficitGDPPct - prev.deficitGDPPct : undefined;

  const chartData = data.map((d) => ({
    year: d.year,
    deficitPct: d.deficitGDPPct,
    deficitLakh: +(d.deficitCrore / 100000).toFixed(2),
  }));

  return (
    <div>
      <PageHeader
        title="Fiscal Deficit"
        description="Central government's shortfall when expenditure exceeds revenue. A key signal of government borrowing and macro stability."
        lastUpdated={new Date().toISOString()}
        source="Controller General of Accounts (CGA) · Union Budget documents"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Fiscal Deficit (% GDP)"
          value={latest ? `${latest.deficitGDPPct}%` : "—"}
          sub={latest ? `FY ${latest.year} (${latest.type})` : ""}
          change={change ? -change : undefined}
          badge={latest && latest.deficitGDPPct <= 3.5 ? "Healthy" : latest && latest.deficitGDPPct <= 5 ? "Manageable" : "Elevated"}
          badgeColor={latest && latest.deficitGDPPct <= 3.5 ? "green" : latest && latest.deficitGDPPct <= 5 ? "yellow" : "red"}
        />
        <MetricCard
          label="Deficit (₹ Lakh Crore)"
          value={latest ? `₹${(latest.deficitCrore / 100000).toFixed(2)}L Cr` : "—"}
          sub={latest ? `FY ${latest.year}` : ""}
        />
        <MetricCard
          label="Budget Estimate"
          value={budgeted ? `${budgeted.deficitGDPPct}%` : "—"}
          sub={budgeted ? `FY ${budgeted.year} (BE)` : ""}
          badge="Budget"
          badgeColor="blue"
        />
        <MetricCard
          label="Prev Year"
          value={prev ? `${prev.deficitGDPPct}%` : "—"}
          sub={prev ? `FY ${prev.year} (${prev.type})` : ""}
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Fiscal Deficit (% of GDP) — Trend</h2>
        <TrendChart
          data={chartData}
          xKey="year"
          yKey="deficitPct"
          label="Deficit % GDP"
          unit="%"
          color="#ef4444"
          type="area"
          referenceValue={3.5}
          referenceLabel="FRBM target 3.5%"
        />
        <p className="text-xs text-gray-400 mt-2">
          Red dashed line = FRBM medium-term fiscal consolidation target (3.5% of GDP)
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Fiscal Deficit (₹ Lakh Crore)</h2>
        <TrendChart
          data={chartData}
          xKey="year"
          yKey="deficitLakh"
          label="Deficit (₹ Lakh Cr)"
          unit=" LCr"
          color="#f97316"
          type="bar"
          height={200}
        />
      </div>

      <div className="bg-red-50 border border-red-100 rounded-2xl p-5 text-sm text-red-800 space-y-2">
        <p className="font-semibold">Why Fiscal Deficit Matters for Investors</p>
        <p><strong>Crowding out</strong> — High deficit = more government borrowing = higher bond yields = pressure on equity valuations (via discount rates).</p>
        <p><strong>FRBM Act</strong> — Fiscal Responsibility & Budget Management Act mandates India target 3% deficit by 2025-26. Progress is tracked each budget.</p>
        <p><strong>Capex vs Revenue deficit</strong> — Capital expenditure deficit is more productive (builds assets). Revenue deficit (salaries, subsidies) is pure debt.</p>
        <p><strong>Rating implications</strong> — Fitch, Moody&apos;s, S&P watch fiscal trajectory closely. Sustained high deficit risks a rating downgrade → rupee weakness.</p>
      </div>
    </div>
  );
}
