// Fiscal deficit data from multiple sources
// Primary: data.gov.in API (requires free API key)
// Fallback: curated annual data from Union Budget documents

export interface FiscalDataPoint {
  year: string;       // "2023-24"
  deficitCrore: number;
  deficitGDPPct: number;
  revenueCrore?: number;
  expenditureCrore?: number;
  type: "actual" | "revised" | "budget";
}

// Curated from Union Budget documents and CGA reports
const FISCAL_DATA: FiscalDataPoint[] = [
  { year: "2015-16", deficitCrore: 532791, deficitGDPPct: 3.53, type: "actual" },
  { year: "2016-17", deficitCrore: 535589, deficitGDPPct: 3.51, type: "actual" },
  { year: "2017-18", deficitCrore: 590935, deficitGDPPct: 3.46, type: "actual" },
  { year: "2018-19", deficitCrore: 645953, deficitGDPPct: 3.40, type: "actual" },
  { year: "2019-20", deficitCrore: 926233, deficitGDPPct: 4.59, type: "actual" },
  { year: "2020-21", deficitCrore: 1806038, deficitGDPPct: 9.17, type: "actual" },
  { year: "2021-22", deficitCrore: 1591189, deficitGDPPct: 6.71, type: "actual" },
  { year: "2022-23", deficitCrore: 1737600, deficitGDPPct: 6.43, type: "actual" },
  { year: "2023-24", deficitCrore: 1695127, deficitGDPPct: 5.63, type: "actual" },
  { year: "2024-25", deficitCrore: 1614000, deficitGDPPct: 4.90, type: "revised" },
  { year: "2025-26", deficitCrore: 1474000, deficitGDPPct: 4.40, type: "budget" },
];

export async function fetchFiscalData(): Promise<FiscalDataPoint[]> {
  const apiKey = process.env.DATA_GOV_IN_API_KEY;
  if (apiKey) {
    try {
      // Fiscal deficit dataset on data.gov.in
      const resourceId = "3b7d2a31-f86c-4f47-8a8f-7a6e8c8f1234"; // placeholder - update with real ID
      const url = `https://api.data.gov.in/resource/${resourceId}?api-key=${apiKey}&format=json&limit=20`;
      const res = await fetch(url, { next: { revalidate: 86400 } });
      if (res.ok) {
        const json = await res.json();
        if (json.records?.length > 0) {
          return json.records.map((r: Record<string, string>) => ({
            year: r.year || r.financial_year,
            deficitCrore: parseFloat(r.fiscal_deficit || r.deficit_crore),
            deficitGDPPct: parseFloat(r.deficit_gdp_pct || r.percentage_gdp),
            type: "actual" as const,
          }));
        }
      }
    } catch {
      // Fall through
    }
  }
  return FISCAL_DATA;
}
