"use client";

import { useState } from "react";
import TrendChart from "@/components/TrendChart";
import MetricCard from "@/components/MetricCard";
import type { RBIRates, RBIRateHistory } from "@/lib/fetchers/rbi";
import type { CPIDataPoint, IIPDataPoint, GDPQuarterlyPoint } from "@/lib/fetchers/mospi";
import type { WBDataPoint } from "@/lib/fetchers/worldbank";
import type { FiscalDataPoint } from "@/lib/fetchers/fiscal";

interface MacroData {
  rbi: { rates: RBIRates; history: RBIRateHistory[] };
  cpi: CPIDataPoint[];
  iip: IIPDataPoint[];
  gdp: {
    wbGrowth: WBDataPoint[];
    annual: { fy: string; growth: number }[];
    quarterly: GDPQuarterlyPoint[];
  };
  fiscal: {
    local: FiscalDataPoint[];
    wbDeficit: WBDataPoint[];
  };
}

const TABS = [
  { id: "rbi",     label: "RBI Rates",      icon: "🏦" },
  { id: "cpi",     label: "Inflation (CPI)", icon: "📈" },
  { id: "gdp",     label: "GDP",             icon: "📊" },
  { id: "iip",     label: "IIP",             icon: "🏭" },
  { id: "fiscal",  label: "Fiscal Deficit",  icon: "💰" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function fmt(v: number | null | undefined, decimals = 2): string {
  if (v == null) return "—";
  return v.toFixed(decimals);
}

// ── RBI TAB ──────────────────────────────────────────────────────────────────
function RBITab({ data }: { data: MacroData["rbi"] }) {
  const { rates, history } = data;
  const chartData = history.map((h) => ({ date: h.date.slice(0, 7), repo: h.repoRate }));
  const trend = history.length >= 2
    ? history[history.length - 1].repoRate - history[history.length - 2].repoRate
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Repo Rate"
          value={`${fmt(rates.repoRate)}%`}
          sub={`Effective ${rates.effectiveDate}`}
          change={trend}
          badge={trend < 0 ? "Cut" : trend > 0 ? "Hike" : "Hold"}
          badgeColor={trend < 0 ? "green" : trend > 0 ? "red" : "blue"}
        />
        <MetricCard label="Reverse Repo" value={`${fmt(rates.reverseRepoRate)}%`} sub="Floor rate" />
        <MetricCard label="CRR" value={`${fmt(rates.crr)}%`} sub="Cash Reserve Ratio" />
        <MetricCard label="SLR" value={`${fmt(rates.slr)}%`} sub="Statutory Liquidity Ratio" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Repo Rate History (2022–2026)</h3>
          {rates.nextMPCDate && (
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
              Next MPC: {rates.nextMPCDate}
            </span>
          )}
        </div>
        <TrendChart
          data={chartData}
          xKey="date"
          yKey="repo"
          label="Repo Rate"
          type="area"
          color="#6366f1"
          unit="%"
          height={240}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <MetricCard label="SDF (Floor)" value={`${fmt(rates.sdf)}%`} sub="Standing Deposit Facility" />
        <MetricCard label="MSF / Bank Rate" value={`${fmt(rates.msf)}%`} sub="Marginal Standing Facility" />
      </div>

      <p className="text-xs text-gray-400">
        Source: RBI MPC decisions (live scrape + curated fallback). Data updated after each MPC meeting.
      </p>
    </div>
  );
}

// ── INFLATION TAB ─────────────────────────────────────────────────────────────
function InflationTab({ data }: { data: MacroData["cpi"] }) {
  const latest = data[data.length - 1];
  const prev   = data[data.length - 2];
  const avg12  = data.slice(-12).reduce((s, d) => s + d.yoy, 0) / Math.min(12, data.length);
  const chartData = data.map((d) => ({ month: d.month.slice(0, 7), cpi: d.yoy }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Latest CPI (YoY)"
          value={`${fmt(latest?.yoy)}%`}
          sub={latest?.month ?? ""}
          change={prev ? latest.yoy - prev.yoy : undefined}
          badge={latest?.yoy < 4 ? "Below Target" : "Above Target"}
          badgeColor={latest?.yoy < 4 ? "green" : "red"}
        />
        <MetricCard label="12-Month Avg" value={`${fmt(avg12)}%`} sub="Rolling average" />
        <MetricCard
          label="RBI Target"
          value="4.0%"
          sub="±2% tolerance band"
          badge={latest?.yoy < 4 ? "In Band" : "Above Band"}
          badgeColor={latest?.yoy < 4 ? "green" : "yellow"}
        />
        <MetricCard
          label="vs Target"
          value={`${fmt(latest?.yoy - 4)}%`}
          sub="Deviation from 4%"
          badge={latest?.yoy < 4 ? "Under" : "Over"}
          badgeColor={latest?.yoy < 4 ? "green" : "red"}
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Monthly CPI Inflation (YoY %)</h3>
          <span className="text-xs text-gray-400">Source: MOSPI official press releases</span>
        </div>
        <TrendChart
          data={chartData}
          xKey="month"
          yKey="cpi"
          label="CPI YoY"
          type="bar"
          color="#f59e0b"
          unit="%"
          referenceValue={4}
          referenceLabel="4% target"
          height={240}
        />
      </div>

      <p className="text-xs text-gray-400">
        Source: MOSPI press releases via PIB. Monthly data updated ~12th of following month.
        Historic low of 0.25% reached Oct 2025.
      </p>
    </div>
  );
}

// ── GDP TAB ───────────────────────────────────────────────────────────────────
function GDPTab({ data }: { data: MacroData["gdp"] }) {
  const latestAnnual = data.annual[data.annual.length - 1];
  const latestQ      = data.quarterly[data.quarterly.length - 1];
  const wbLatest     = data.wbGrowth.filter((d) => d.value != null).at(-1);

  const annualChart = data.annual.map((d) => ({ fy: d.fy.slice(-5), growth: d.growth }));
  const qChart      = data.quarterly.map((d) => ({ q: d.quarter.replace(" FY", "\n"), growth: d.growth }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="FY25-26 Forecast"
          value={`${fmt(latestAnnual?.growth)}%`}
          sub="First Advance Estimate"
          badge="FY26"
          badgeColor="blue"
        />
        <MetricCard
          label={`${latestQ?.quarter ?? "Latest Quarter"}`}
          value={`${fmt(latestQ?.growth)}%`}
          sub={latestQ?.type ?? ""}
          badge={latestQ?.type === "advance" ? "Advance" : "Official"}
          badgeColor={latestQ?.type === "advance" ? "yellow" : "green"}
        />
        <MetricCard
          label="World Bank (Latest)"
          value={wbLatest ? `${fmt(wbLatest.value)}%` : "—"}
          sub={wbLatest ? `FY${wbLatest.year}` : "Loading"}
          badge="WB API"
          badgeColor="blue"
        />
        <MetricCard
          label="FY24 (Actual)"
          value="8.2%"
          sub="Fastest in G20"
          badge="Confirmed"
          badgeColor="green"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Annual GDP Growth (FY)</h3>
          <TrendChart
            data={annualChart}
            xKey="fy"
            yKey="growth"
            label="GDP Growth"
            type="bar"
            color="#10b981"
            unit="%"
            referenceValue={0}
            height={220}
          />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Quarterly GDP Growth</h3>
          <TrendChart
            data={qChart}
            xKey="q"
            yKey="growth"
            label="QoQ Growth"
            type="bar"
            color="#6366f1"
            unit="%"
            height={220}
          />
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Annual data: MOSPI National Accounts + World Bank API (auto-updates). Quarterly: MOSPI press releases.
        World Bank lags ~1 year for confirmed figures.
      </p>
    </div>
  );
}

// ── IIP TAB ───────────────────────────────────────────────────────────────────
function IIPTab({ data }: { data: MacroData["iip"] }) {
  const latest = data[data.length - 1];
  const prev   = data[data.length - 2];
  const avg3   = data.slice(-3).reduce((s, d) => s + d.yoy, 0) / 3;
  const chartData = data.map((d) => ({ month: d.month.slice(0, 7), iip: d.yoy }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Latest IIP (YoY)"
          value={`${fmt(latest?.yoy)}%`}
          sub={latest?.month ?? ""}
          change={prev ? latest.yoy - prev.yoy : undefined}
          badge={latest?.yoy > 0 ? "Expansion" : "Contraction"}
          badgeColor={latest?.yoy > 0 ? "green" : "red"}
        />
        <MetricCard label="3-Month Avg" value={`${fmt(avg3)}%`} sub="Rolling 3-month" />
        <MetricCard
          label="FY26 Full Year"
          value="4.1%"
          sub="Annual average"
          badge="Confirmed"
          badgeColor="green"
        />
        <MetricCard
          label="Dec 2025 Peak"
          value="7.8%"
          sub="Highest in FY26"
          badge="PIB Official"
          badgeColor="blue"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Monthly IIP Growth (YoY %)</h3>
          <span className="text-xs text-gray-400">Source: MOSPI / PIB press releases</span>
        </div>
        <TrendChart
          data={chartData}
          xKey="month"
          yKey="iip"
          label="IIP YoY"
          type="bar"
          color="#8b5cf6"
          unit="%"
          referenceValue={0}
          referenceLabel="0%"
          height={240}
        />
      </div>

      <p className="text-xs text-gray-400">
        Index of Industrial Production. Source: PIB official press releases. Data released with ~6-week lag.
        &ldquo;estimated&rdquo; months are interpolated from surrounding official data.
      </p>
    </div>
  );
}

// ── FISCAL TAB ────────────────────────────────────────────────────────────────
function FiscalTab({ data }: { data: MacroData["fiscal"] }) {
  const latest     = data.local[data.local.length - 1];
  const prev       = data.local[data.local.length - 2];
  const chartData  = data.local.map((d) => ({ year: d.year, pct: d.deficitGDPPct }));
  const covidYear  = data.local.find((d) => d.year === "2020-21");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label={`Deficit ${latest?.year}`}
          value={`${fmt(latest?.deficitGDPPct)}% GDP`}
          sub={`₹${(latest?.deficitCrore / 100000).toFixed(1)}L Cr`}
          badge={latest?.type === "budget" ? "BE" : latest?.type === "revised" ? "RE" : "Actual"}
          badgeColor={latest?.type === "budget" ? "yellow" : latest?.type === "revised" ? "blue" : "green"}
        />
        <MetricCard
          label={`Deficit ${prev?.year}`}
          value={`${fmt(prev?.deficitGDPPct)}% GDP`}
          sub={`₹${(prev?.deficitCrore / 100000).toFixed(1)}L Cr`}
          badge={prev?.type === "revised" ? "RE" : "Actual"}
          badgeColor={prev?.type === "revised" ? "blue" : "green"}
        />
        <MetricCard label="FRBM Target" value="4.5% GDP" sub="Medium-term goal" badge="Target" badgeColor="blue" />
        <MetricCard
          label="COVID Peak"
          value={`${fmt(covidYear?.deficitGDPPct)}% GDP`}
          sub="FY2020-21 stimulus"
          badge="Historical"
          badgeColor="gray"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Fiscal Deficit as % of GDP</h3>
          <span className="text-xs text-gray-400">Source: Union Budget / CGA reports</span>
        </div>
        <TrendChart
          data={chartData}
          xKey="year"
          yKey="pct"
          label="Deficit % GDP"
          type="bar"
          color="#ef4444"
          unit="%"
          referenceValue={4.5}
          referenceLabel="FRBM target"
          height={240}
        />
      </div>

      <p className="text-xs text-gray-400">
        Source: Union Budget documents (BE/RE) and CGA actuals. FY26 = Budget Estimate 4.40%.
        FRBM medium-term target is 4.5% for FY26 and below thereafter.
      </p>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function MacroTabs({ data }: { data: MacroData }) {
  const [active, setActive] = useState<TabId>("rbi");

  const { rbi, cpi, gdp, iip, fiscal } = data;
  const latestCPI     = cpi[cpi.length - 1];
  const latestIIP     = iip[iip.length - 1];
  const latestAnnual  = gdp.annual[gdp.annual.length - 1];
  const latestFiscal  = fiscal.local[fiscal.local.length - 1];

  return (
    <div className="space-y-6">
      {/* Summary strip — clickable cards that also switch the active tab */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(
          [
            { label: "Repo Rate",      value: `${rbi.rates.repoRate}%`,              tab: "rbi"    as TabId, activeClass: "border-indigo-400 bg-indigo-50",  textClass: "text-indigo-700"  },
            { label: "CPI (Apr '26)",  value: `${latestCPI?.yoy?.toFixed(2) ?? "—"}%`, tab: "cpi"  as TabId, activeClass: "border-amber-400 bg-amber-50",    textClass: "text-amber-700"   },
            { label: "GDP Growth",     value: `${latestAnnual?.growth ?? "—"}%`,      tab: "gdp"   as TabId, activeClass: "border-emerald-400 bg-emerald-50", textClass: "text-emerald-700" },
            { label: "IIP (Mar '26)",  value: `${latestIIP?.yoy?.toFixed(1) ?? "—"}%`, tab: "iip" as TabId, activeClass: "border-violet-400 bg-violet-50",   textClass: "text-violet-700"  },
            { label: "Fiscal Deficit", value: `${latestFiscal?.deficitGDPPct ?? "—"}% GDP`, tab: "fiscal" as TabId, activeClass: "border-rose-400 bg-rose-50", textClass: "text-rose-700" },
          ] as const
        ).map(({ label, value, tab, activeClass, textClass }) => {
          const isActive = active === tab;
          return (
            <button
              key={tab}
              onClick={() => setActive(tab)}
              className={`text-left p-3.5 rounded-xl border-2 transition-all ${
                isActive ? activeClass : "border-gray-100 bg-white hover:border-gray-200"
              }`}
            >
              <p className="text-xs text-gray-500 font-medium">{label}</p>
              <p className={`text-xl font-bold mt-0.5 ${isActive ? textClass : "text-gray-900"}`}>
                {value}
              </p>
            </button>
          );
        })}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              active === tab.id
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {active === "rbi"    && <RBITab      data={rbi} />}
        {active === "cpi"    && <InflationTab data={cpi} />}
        {active === "gdp"    && <GDPTab       data={gdp} />}
        {active === "iip"    && <IIPTab       data={iip} />}
        {active === "fiscal" && <FiscalTab    data={fiscal} />}
      </div>
    </div>
  );
}
