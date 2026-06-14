import MetricCard from "@/components/MetricCard";
import PageHeader from "@/components/PageHeader";
import TrendChart from "@/components/TrendChart";
import { fetchIIP } from "@/lib/fetchers/mospi";

export const revalidate = 86400;

export default async function IIPPage() {
  const data = await fetchIIP();

  const latest = data[data.length - 1];
  const prev = data[data.length - 2];
  const change = latest && prev ? latest.yoy - prev.yoy : undefined;

  const threeMonthAvg =
    data.length >= 3
      ? data
          .slice(-3)
          .reduce((s, d) => s + d.yoy, 0) / 3
      : null;

  const chartData = data.map((d) => ({
    month: d.month,
    yoy: d.yoy,
    index: d.value,
  }));

  return (
    <div>
      <PageHeader
        title="IIP — Index of Industrial Production"
        description="Measures output growth across India's manufacturing, mining, and electricity sectors. Released monthly with ~6 week lag."
        lastUpdated={new Date().toISOString()}
        source="MOSPI (Base Year: 2022-23)"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="IIP YoY Growth (Latest)"
          value={latest ? `${latest.yoy.toFixed(1)}%` : "—"}
          sub={latest?.month}
          change={change}
          badge={latest && latest.yoy > 5 ? "Strong" : latest && latest.yoy > 0 ? "Moderate" : "Weak"}
          badgeColor={latest && latest.yoy > 5 ? "green" : latest && latest.yoy > 0 ? "yellow" : "red"}
        />
        <MetricCard
          label="3-Month Average"
          value={threeMonthAvg ? `${threeMonthAvg.toFixed(1)}%` : "—"}
          sub="Rolling 3-month avg growth"
        />
        <MetricCard
          label="Prev Month"
          value={prev ? `${prev.yoy.toFixed(1)}%` : "—"}
          sub={prev?.month}
        />
        <MetricCard
          label="Index Value"
          value={latest ? `${latest.value}` : "—"}
          sub="Base: 2022-23 = 100"
          badge="IIP"
          badgeColor="blue"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">IIP Growth — Month on Month (YoY %)</h2>
        <TrendChart
          data={chartData}
          xKey="month"
          yKey="yoy"
          label="IIP YoY"
          unit="%"
          color="#3b82f6"
          type="bar"
          referenceValue={0}
        />
        <p className="text-xs text-gray-400 mt-2">
          Bars below zero = industrial contraction. Source: MOSPI
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">IIP Index Level</h2>
        <TrendChart
          data={chartData}
          xKey="month"
          yKey="index"
          label="IIP Index"
          unit=""
          color="#6366f1"
          type="area"
          height={200}
        />
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-sm text-blue-800 space-y-2">
        <p className="font-semibold">Understanding IIP</p>
        <p><strong>What it covers</strong> — Manufacturing (77.6% weight), Mining (14.4%), Electricity (8%). Released with ~6 week lag.</p>
        <p><strong>Why it matters</strong> — Leading indicator of economic momentum. Strong IIP = corporate revenue growth ahead.</p>
        <p><strong>Seasonal patterns</strong> — March typically peaks (year-end government spending). April–May dips. Festival season (Oct–Nov) sees uptick.</p>
        <p><strong>Use case</strong> — Compare IIP vs PMI Manufacturing for early signals. IIP is official; PMI is survey-based but faster.</p>
      </div>
    </div>
  );
}
