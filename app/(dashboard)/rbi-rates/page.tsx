import MetricCard from "@/components/MetricCard";
import PageHeader from "@/components/PageHeader";
import TrendChart from "@/components/TrendChart";
import { fetchRBIRates, fetchRBIRateHistory } from "@/lib/fetchers/rbi";

export const revalidate = 3600; // refresh every hour

export default async function RBIRatesPage() {
  const [rates, history] = await Promise.all([
    fetchRBIRates(),
    Promise.resolve(fetchRBIRateHistory()),
  ]);

  const chartData = history.map((h) => ({
    date: h.date.slice(0, 7),
    repoRate: h.repoRate,
    crr: h.crr,
    slr: h.slr,
  }));

  return (
    <div>
      <PageHeader
        title="RBI Policy Rates"
        description="Monetary policy rates set by the Reserve Bank of India's Monetary Policy Committee (MPC). Reviewed every 2 months."
        lastUpdated={new Date().toISOString()}
        source="Reserve Bank of India"
      />

      {/* Current rates */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Policy Repo Rate"
          value={`${rates.repoRate}%`}
          sub={`Effective ${rates.effectiveDate}`}
          badge="Key Rate"
          badgeColor="blue"
        />
        <MetricCard
          label="SDF Rate"
          value={`${rates.sdf}%`}
          sub="Standing Deposit Facility"
          badge="Floor"
          badgeColor="gray"
        />
        <MetricCard
          label="MSF Rate"
          value={`${rates.msf}%`}
          sub="Marginal Standing Facility"
          badge="Ceiling"
          badgeColor="gray"
        />
        <MetricCard
          label="Bank Rate"
          value={`${rates.bankRate}%`}
          sub="Penal / refinance rate"
        />
        <MetricCard
          label="Cash Reserve Ratio"
          value={`${rates.crr}%`}
          sub="% of NDTL held with RBI"
          badge="CRR"
          badgeColor="yellow"
        />
        <MetricCard
          label="Statutory Liquidity Ratio"
          value={`${rates.slr}%`}
          sub="% of NDTL in approved securities"
          badge="SLR"
          badgeColor="yellow"
        />
        <MetricCard
          label="Reverse Repo Rate"
          value={`${rates.reverseRepoRate}%`}
          sub="Rate RBI pays banks on deposits"
        />
        {rates.nextMPCDate && (
          <MetricCard
            label="Next MPC Meeting"
            value={new Date(rates.nextMPCDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            sub="Scheduled date"
            badge="Upcoming"
            badgeColor="green"
          />
        )}
      </div>

      {/* Repo rate trend chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Repo Rate History</h2>
        <TrendChart
          data={chartData}
          xKey="date"
          yKey="repoRate"
          label="Repo Rate"
          unit="%"
          color="#6366f1"
          type="line"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">CRR History</h2>
          <TrendChart data={chartData} xKey="date" yKey="crr" label="CRR" unit="%" color="#f59e0b" type="line" height={200} />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">SLR History</h2>
          <TrendChart data={chartData} xKey="date" yKey="slr" label="SLR" unit="%" color="#10b981" type="line" height={200} />
        </div>
      </div>

      {/* Context box */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 text-sm text-indigo-800 space-y-2">
        <p className="font-semibold">What do these rates mean?</p>
        <p><strong>Repo Rate</strong> — The rate at which banks borrow from RBI. A cut stimulates growth (cheaper credit); a hike fights inflation.</p>
        <p><strong>CRR</strong> — % of deposits banks must keep with RBI as cash. Higher CRR = less money for lending = tighter liquidity.</p>
        <p><strong>SLR</strong> — % of deposits banks must invest in government securities. Ensures banks stay liquid and funds government borrowing.</p>
        <p><strong>SDF / MSF</strong> — The corridor within which overnight money market rates must stay. SDF is the floor, MSF is the ceiling.</p>
      </div>
    </div>
  );
}
