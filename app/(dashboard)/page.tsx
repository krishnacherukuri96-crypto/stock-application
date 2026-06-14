import Link from "next/link";
import { fetchRBIRates } from "@/lib/fetchers/rbi";
import { fetchCPI, fetchIIP, fetchQuarterlyGDP, fetchAnnualGDPFY } from "@/lib/fetchers/mospi";
import { fetchFiscalData } from "@/lib/fetchers/fiscal";

async function getData() {
  const [rbi, cpi, iip, fiscal] = await Promise.allSettled([
    fetchRBIRates(),
    fetchCPI(),
    fetchIIP(),
    fetchFiscalData(),
  ]);

  const quarterlyGDP = fetchQuarterlyGDP();
  const annualGDP = fetchAnnualGDPFY();

  return {
    rbi: rbi.status === "fulfilled" ? rbi.value : null,
    cpi: cpi.status === "fulfilled" ? cpi.value : null,
    iip: iip.status === "fulfilled" ? iip.value : null,
    fiscal: fiscal.status === "fulfilled" ? fiscal.value : null,
    latestQuarterGDP: quarterlyGDP[quarterlyGDP.length - 1],
    latestAnnualGDP: annualGDP[annualGDP.length - 1],
  };
}

const cards = [
  { href: "/rbi-rates", label: "RBI Policy Rates", icon: "🏦", color: "bg-indigo-50 border-indigo-100" },
  { href: "/inflation", label: "Inflation (CPI)", icon: "📈", color: "bg-orange-50 border-orange-100" },
  { href: "/gdp", label: "GDP Growth", icon: "📊", color: "bg-green-50 border-green-100" },
  { href: "/iip", label: "Industrial Production (IIP)", icon: "🏭", color: "bg-blue-50 border-blue-100" },
  { href: "/fiscal-deficit", label: "Fiscal Deficit", icon: "💰", color: "bg-red-50 border-red-100" },
  { href: "/budget", label: "Union Budget 2026-27", icon: "📋", color: "bg-purple-50 border-purple-100" },
  { href: "/stock-selection", label: "Stock Selection", icon: "🔎", color: "bg-slate-50 border-slate-100" },
];

export default async function OverviewPage() {
  const { rbi, cpi, iip, fiscal, latestQuarterGDP, latestAnnualGDP } = await getData();

  const latestCPI = cpi ? cpi[cpi.length - 1] : null;
  const latestIIP = iip ? iip[iip.length - 1] : null;
  const latestFiscal = fiscal ? fiscal[fiscal.length - 1] : null;

  const metrics = [
    {
      label: "Repo Rate",
      value: rbi ? `${rbi.repoRate}%` : "—",
      sub: `CRR: ${rbi?.crr ?? "—"}% · SLR: ${rbi?.slr ?? "—"}%`,
      color: "text-indigo-600",
      href: "/rbi-rates",
    },
    {
      label: "CPI Inflation (Latest)",
      value: latestCPI ? `${latestCPI.yoy.toFixed(2)}%` : "—",
      sub: latestCPI ? `Month: ${latestCPI.month}` : "",
      color: latestCPI && latestCPI.yoy > 6 ? "text-red-600" : "text-green-600",
      href: "/inflation",
    },
    {
      label: "GDP Growth (Latest Quarter)",
      value: latestQuarterGDP ? `${latestQuarterGDP.growth}%` : "—",
      sub: latestQuarterGDP
        ? `${latestQuarterGDP.quarter} · FY${latestAnnualGDP?.fy}: ${latestAnnualGDP?.growth}%`
        : "",
      color: "text-green-600",
      href: "/gdp",
    },
    {
      label: "IIP Growth (Latest)",
      value: latestIIP ? `${latestIIP.yoy.toFixed(1)}%` : "—",
      sub: latestIIP ? `Month: ${latestIIP.month}` : "",
      color: latestIIP && latestIIP.yoy > 0 ? "text-blue-600" : "text-red-600",
      href: "/iip",
    },
    {
      label: "Fiscal Deficit (% GDP)",
      value: latestFiscal ? `${latestFiscal.deficitGDPPct}%` : "—",
      sub: latestFiscal ? `FY ${latestFiscal.year} (${latestFiscal.type})` : "",
      color: "text-red-600",
      href: "/fiscal-deficit",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">India Macro Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          Key economic indicators at a glance — click any card to explore in detail
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-10">
        {metrics.map((m) => (
          <Link key={m.href} href={m.href}>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{m.label}</p>
              <p className={`text-3xl font-bold mt-2 ${m.color}`}>{m.value}</p>
              {m.sub && <p className="text-xs text-gray-400 mt-1">{m.sub}</p>}
            </div>
          </Link>
        ))}
      </div>

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Explore by Indicator
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ href, label, icon, color }) => (
          <Link key={href} href={href}>
            <div className={`rounded-2xl border p-6 ${color} hover:shadow-md transition-shadow cursor-pointer`}>
              <span className="text-3xl">{icon}</span>
              <p className="mt-3 font-semibold text-gray-800">{label}</p>
              <p className="text-xs text-gray-500 mt-1">View charts, trends &amp; context →</p>
            </div>
          </Link>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-10">
        Data sources: RBI, MOSPI, World Bank. GDP quarterly from MOSPI National Accounts. CPI/IIP updated monthly.
      </p>
    </div>
  );
}
