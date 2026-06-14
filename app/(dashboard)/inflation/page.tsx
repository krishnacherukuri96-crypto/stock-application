import MetricCard from "@/components/MetricCard";
import PageHeader from "@/components/PageHeader";
import TrendChart from "@/components/TrendChart";
import { fetchInflationWorldBank } from "@/lib/fetchers/worldbank";
import { fetchCPI } from "@/lib/fetchers/mospi";

export const revalidate = 86400;

export default async function InflationPage() {
  const [annual, monthly] = await Promise.all([
    fetchInflationWorldBank(),
    fetchCPI(),
  ]);

  const latest = monthly[monthly.length - 1];
  const prev = monthly[monthly.length - 2];
  const monthChange = latest && prev ? latest.yoy - prev.yoy : undefined;

  const annualLatest = annual.cpi[annual.cpi.length - 1];

  const monthlyChartData = monthly.map((d) => ({
    month: d.month,
    yoy: d.yoy,
    index: d.value,
  }));

  const annualChartData = annual.cpi.map((d) => ({
    year: d.year,
    cpi: d.value,
  }));

  return (
    <div>
      <PageHeader
        title="Inflation"
        description="Consumer Price Index (CPI) measures retail inflation across food, fuel, housing and services in India."
        lastUpdated={new Date().toISOString()}
        source="MOSPI (Monthly CPI) · World Bank (Annual trend)"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="CPI YoY (Latest)"
          value={latest ? `${latest.yoy.toFixed(2)}%` : "—"}
          sub={latest?.month}
          change={monthChange}
          badge={latest && latest.yoy <= 4 ? "In target" : latest && latest.yoy <= 6 ? "Tolerable" : "Above band"}
          badgeColor={latest && latest.yoy <= 4 ? "green" : latest && latest.yoy <= 6 ? "yellow" : "red"}
        />
        <MetricCard
          label="RBI CPI Target"
          value="4%"
          sub="Tolerance band: 2%–6%"
          badge="Mandate"
          badgeColor="blue"
        />
        <MetricCard
          label="Annual CPI (World Bank)"
          value={annualLatest ? `${annualLatest.value?.toFixed(2)}%` : "—"}
          sub={annualLatest ? `FY ${annualLatest.year}` : ""}
        />
        <MetricCard
          label="Prev Month"
          value={prev ? `${prev.yoy.toFixed(2)}%` : "—"}
          sub={prev?.month}
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Monthly CPI Inflation (YoY %)</h2>
        <TrendChart
          data={monthlyChartData}
          xKey="month"
          yKey="yoy"
          label="CPI YoY"
          unit="%"
          color="#f97316"
          type="area"
          referenceValue={6}
          referenceLabel="Upper band 6%"
        />
        <p className="text-xs text-gray-400 mt-2">Red dashed line = RBI&apos;s upper tolerance band (6%)</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Annual CPI Inflation (World Bank, %)</h2>
        <TrendChart
          data={annualChartData}
          xKey="year"
          yKey="cpi"
          label="CPI Annual"
          unit="%"
          color="#f59e0b"
          type="bar"
          referenceValue={4}
          referenceLabel="RBI target 4%"
        />
      </div>

      <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 text-sm text-orange-800 space-y-2">
        <p className="font-semibold">Reading Inflation Data</p>
        <p><strong>CPI</strong> — Tracks prices paid by retail consumers. India targets 4% CPI with a 2%-6% tolerance band.</p>
        <p><strong>Food Inflation</strong> — Has outsized weight (~46%) in India&apos;s CPI basket. Monsoon and supply chains heavily influence it.</p>
        <p><strong>Core Inflation</strong> — CPI excluding food and fuel. More stable, reflects demand-side pressures that RBI policy can influence.</p>
        <p><strong>WPI</strong> — Wholesale Price Index. Leads CPI by 1–2 months; useful for predicting CPI direction.</p>
      </div>
    </div>
  );
}
