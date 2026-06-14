// World Bank API - free, no key needed
// Base: https://api.worldbank.org/v2/country/IN/indicator/{code}?format=json&mrv=N

const BASE = "https://api.worldbank.org/v2/country/IN/indicator";

export interface WBDataPoint {
  year: string;
  value: number | null;
}

async function fetchIndicator(
  code: string,
  years: number = 15
): Promise<WBDataPoint[]> {
  const url = `${BASE}/${code}?format=json&mrv=${years}&per_page=${years}`;
  const res = await fetch(url, { next: { revalidate: 86400 } }); // cache 24h
  if (!res.ok) throw new Error(`World Bank fetch failed: ${code}`);
  const [, data] = await res.json();
  return (data as Record<string, unknown>[])
    .filter((d) => d.value !== null)
    .map((d) => ({ year: d.date as string, value: d.value as number | null }))
    .sort((a, b) => Number(a.year) - Number(b.year));
}

export async function fetchGDP() {
  const [growth, perCapita, nominal] = await Promise.all([
    fetchIndicator("NY.GDP.MKTP.KD.ZG", 15), // GDP growth %
    fetchIndicator("NY.GDP.PCAP.KD.ZG", 15), // Per capita growth %
    fetchIndicator("NY.GDP.MKTP.CD", 15),     // Nominal GDP (USD)
  ]);
  return { growth, perCapita, nominal };
}

export async function fetchInflationWorldBank() {
  const [cpi, gdpDeflator] = await Promise.all([
    fetchIndicator("FP.CPI.TOTL.ZG", 15), // CPI inflation %
    fetchIndicator("NY.GDP.DEFL.KD.ZG", 15), // GDP deflator %
  ]);
  return { cpi, gdpDeflator };
}

export async function fetchFiscalDeficit() {
  // General government net lending/borrowing as % of GDP
  const [deficit, revenue, expense] = await Promise.all([
    fetchIndicator("GC.NLD.TOTL.GD.ZS", 15), // Net lending/borrowing % GDP
    fetchIndicator("GC.REV.TOTL.GD.ZS", 15), // Revenue % GDP
    fetchIndicator("GC.XPN.TOTL.GD.ZS", 15), // Expense % GDP
  ]);
  return { deficit, revenue, expense };
}
