import MetricCard from "@/components/MetricCard";
import PageHeader from "@/components/PageHeader";
import TrendChart from "@/components/TrendChart";
import DonutChart from "@/components/DonutChart";
import RupeeFlow from "@/components/RupeeFlow";
import {
  BUDGET_SUMMARY,
  EXPENDITURE_ALLOCATIONS,
  REVENUE_SOURCES,
  RUPEE_RECEIPT,
  RUPEE_EXPENDITURE,
  CAPEX_TREND,
} from "@/lib/fetchers/budget";

export const revalidate = 86400 * 30; // Budget data static for ~1 month

export default function BudgetPage() {
  const b = BUDGET_SUMMARY;

  const expenditureDonutData = EXPENDITURE_ALLOCATIONS.map((a) => ({
    name: a.ministry,
    value: a.amount,
    color: a.color,
    pct: a.pct,
  }));

  const revenueDonutData = REVENUE_SOURCES.map((s) => ({
    name: s.source,
    value: s.amount,
    color: s.color,
    pct: s.pct,
  }));

  const capexChartData = CAPEX_TREND.map((c) => ({
    fy: c.fy,
    capex: c.capex,
    pctGDP: c.pctGDP,
  }));

  return (
    <div>
      <PageHeader
        title={`Union Budget ${b.fy}`}
        description={`India's Union Budget presented on ${b.presentedOn} by Finance Minister Nirmala Sitharaman. Total outlay ₹${b.totalExpenditure} lakh crore — up 7.7% over FY2025-26.`}
        source="indiabudget.gov.in · PRS India Budget Analysis 2026-27 · PIB"
      />

      {/* Key numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Total Budget Outlay"
          value={`₹${b.totalExpenditure} LCr`}
          sub="FY 2025-26"
          badge="Total"
          badgeColor="blue"
        />
        <MetricCard
          label="Capital Expenditure"
          value={`₹${b.capitalExpenditure} LCr`}
          sub={`${((b.capitalExpenditure / b.totalExpenditure) * 100).toFixed(1)}% of budget`}
          badge="Capex"
          badgeColor="green"
        />
        <MetricCard
          label="Fiscal Deficit"
          value={`${b.fiscalDeficitPct}% GDP`}
          sub={`₹${b.fiscalDeficit} lakh crore`}
          badge="Deficit"
          badgeColor="red"
        />
        <MetricCard
          label="Revenue Deficit"
          value={`${b.revenueDeficitPct}% GDP`}
          sub={`${b.revenueDeficitPct}% of GDP (estimated)`}
          badge="Rev Def"
          badgeColor="yellow"
        />
      </div>

      {/* Rupee flow — most intuitive view */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-1">
          The Rupee — Every ₹1 the Government Handles
        </h2>
        <p className="text-xs text-gray-400 mb-5">
          FY 2025-26 · Figures in paise (100 paise = ₹1)
        </p>
        <RupeeFlow receipts={RUPEE_RECEIPT} expenditures={RUPEE_EXPENDITURE} />
      </div>

      {/* Expenditure donut + top ministries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">
            Expenditure by Ministry (% share)
          </h2>
          <p className="text-xs text-gray-400 mb-3">Total: ₹50.65 lakh crore</p>
          <DonutChart
            data={expenditureDonutData}
            height={340}
            innerRadius={55}
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">
            Revenue Sources (% share)
          </h2>
          <p className="text-xs text-gray-400 mb-3">Borrowings = 31% — the fiscal gap</p>
          <DonutChart
            data={revenueDonutData}
            height={340}
            innerRadius={55}
          />
        </div>
      </div>

      {/* Top 5 ministry allocations as horizontal bars */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-1">Top Ministry Allocations</h2>
        <p className="text-xs text-gray-400 mb-5">₹ lakh crore · FY 2025-26</p>
        <div className="space-y-4">
          {EXPENDITURE_ALLOCATIONS.filter((a) => a.ministry !== "Others").map((a) => (
            <div key={a.ministry}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: a.color }}
                  />
                  <span className="text-sm text-gray-700">{a.ministry}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{a.pct}%</span>
                  <span className="text-sm font-semibold text-gray-900 w-16 text-right">
                    ₹{a.amount} LCr
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${a.pct}%`, backgroundColor: a.color }}
                />
              </div>
              {a.capex && (
                <p className="text-xs text-gray-400 mt-0.5 ml-4">
                  Capex portion: ₹{a.capex} LCr
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Capex trend */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-1">
          Capital Expenditure Growth (₹ lakh crore)
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Capex has grown 2.5× in 5 years — backbone of infrastructure push
        </p>
        <TrendChart
          data={capexChartData}
          xKey="fy"
          yKey="capex"
          label="Capex"
          unit=" LCr"
          color="#10b981"
          type="bar"
          height={220}
        />
      </div>

      {/* Budget at a glance table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Budget at a Glance</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Item</th>
                <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">₹ Lakh Crore</th>
                <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">% of GDP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { label: "Total Receipts (incl. borrowings)", value: b.totalReceipts, gdpPct: (b.totalReceipts / b.gdpEstimate * 100).toFixed(1) },
                { label: "Net Tax Revenue (Centre's share)", value: b.netTaxRevenueCentre, gdpPct: (b.netTaxRevenueCentre / b.gdpEstimate * 100).toFixed(1) },
                { label: "Non-Debt Receipts", value: b.nonDebtReceipts, gdpPct: (b.nonDebtReceipts / b.gdpEstimate * 100).toFixed(1) },
                { label: "Gross Market Borrowings", value: b.grossBorrowings, gdpPct: (b.grossBorrowings / b.gdpEstimate * 100).toFixed(1) },
                { label: "Total Expenditure", value: b.totalExpenditure, gdpPct: (b.totalExpenditure / b.gdpEstimate * 100).toFixed(1) },
                { label: "Revenue Expenditure", value: b.revenueExpenditure, gdpPct: (b.revenueExpenditure / b.gdpEstimate * 100).toFixed(1) },
                { label: "Capital Expenditure", value: b.capitalExpenditure, gdpPct: (b.capitalExpenditure / b.gdpEstimate * 100).toFixed(1) },
                { label: "Fiscal Deficit", value: b.fiscalDeficit, gdpPct: b.fiscalDeficitPct.toString() },
                { label: "Fiscal Deficit (₹ LCr)", value: b.fiscalDeficit, gdpPct: b.fiscalDeficitPct.toString() },
              ].map(({ label, value, gdpPct }) => (
                <tr key={label} className="hover:bg-gray-50">
                  <td className="py-2.5 text-gray-700">{label}</td>
                  <td className="py-2.5 text-right font-medium text-gray-900">{value.toFixed(2)}</td>
                  <td className="py-2.5 text-right text-gray-500">{gdpPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Key themes */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-sm text-blue-800 space-y-2">
        <p className="font-semibold">Budget 2026-27 — Key Themes for Investors</p>
        <p><strong>Fiscal consolidation continues</strong> — Deficit trimmed to 4.3% of GDP (from 4.4% RE FY26). Debt-to-GDP at 55.6%, declining trend sustains sovereign rating confidence.</p>
        <p><strong>Record infrastructure capex</strong> — Capex ₹12.22 LCr (+11.5% YoY), 6th straight year of double-digit growth. Roads ₹3.1 LCr + Railways ₹2.78 LCr. Watch: L&T, IRB Infra, RVNL, KEC.</p>
        <p><strong>Record defence budget</strong> — ₹7.85 LCr (+15.3% YoY), capex at ₹2.19 LCr (+24%). Indigenisation push: HAL, BEL, Bharat Forge, Data Patterns.</p>
        <p><strong>Manufacturing boost</strong> — ₹40,000 Cr for electronics components + new SME Growth Fund + container manufacturing scheme. Watch: Dixon, Kaynes, Amber.</p>
        <p><strong>Income tax relief</strong> — Expanded slabs under new regime boost disposable income. Positive for consumption: Maruti, Titan, Trent, DMart.</p>
        <p><strong>Subsidy discipline</strong> — Total subsidies at ₹4.55 LCr (-3.1% YoY). Fiscal room created by rationalisation, not welfare cuts.</p>
      </div>
    </div>
  );
}
