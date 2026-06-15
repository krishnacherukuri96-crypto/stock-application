import { fetchRBIRates, fetchRBIRateHistory } from "@/lib/fetchers/rbi";
import { fetchCPI, fetchIIP, fetchQuarterlyGDP, fetchAnnualGDPFY } from "@/lib/fetchers/mospi";
import { fetchGDP } from "@/lib/fetchers/worldbank";
import { fetchFiscalData } from "@/lib/fetchers/fiscal";
import MacroTabs from "./MacroTabs";

export const revalidate = 3600; // revalidate page every hour

export default async function MacroPage() {
  const [rbiRates, cpi, iip, gdpWB, fiscal] = await Promise.all([
    fetchRBIRates(),
    fetchCPI(),
    fetchIIP(),
    fetchGDP(),
    fetchFiscalData(),
  ]);

  const data = {
    rbi: {
      rates:   rbiRates,
      history: fetchRBIRateHistory(),
    },
    cpi,
    iip,
    gdp: {
      wbGrowth:  gdpWB.growth,
      annual:    fetchAnnualGDPFY(),
      quarterly: fetchQuarterlyGDP(),
    },
    fiscal: {
      local:     fiscal,
      wbDeficit: [],
    },
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-2">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">India Macro Indicators</h1>
        <p className="text-sm text-gray-500 mt-1">
          RBI rates · Inflation · GDP · Industrial Production · Fiscal Deficit — all in one place
        </p>
      </div>

      <MacroTabs data={data} />
    </div>
  );
}
