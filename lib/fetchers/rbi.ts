// Fetches current RBI policy rates by scraping RBI's public pages
// Falls back to a curated static snapshot if scraping fails

export interface RBIRates {
  repoRate: number;
  reverseRepoRate: number;
  sdf: number;       // Standing Deposit Facility
  msf: number;       // Marginal Standing Facility
  bankRate: number;
  crr: number;       // Cash Reserve Ratio
  slr: number;       // Statutory Liquidity Ratio
  effectiveDate: string;
  nextMPCDate?: string;
}

export interface RBIRateHistory {
  date: string;
  repoRate: number;
  crr: number;
  slr: number;
}

// Curated snapshot updated after each MPC meeting — fallback if scraping fails
const FALLBACK_RATES: RBIRates = {
  repoRate: 5.25,
  reverseRepoRate: 3.35,
  sdf: 5.00,
  msf: 5.50,
  bankRate: 5.50,
  crr: 3.00,
  slr: 18.00,
  effectiveDate: "2026-04-08",      // last change (cut); Jun 5 held unchanged
  nextMPCDate: "2026-08-05",        // next MPC (estimated ~Aug 2026)
};

// Historical repo rate changes (curated from RBI records)
const REPO_RATE_HISTORY: RBIRateHistory[] = [
  { date: "2022-05-04", repoRate: 4.40, crr: 4.50, slr: 18.00 },
  { date: "2022-06-08", repoRate: 4.90, crr: 4.50, slr: 18.00 },
  { date: "2022-08-05", repoRate: 5.40, crr: 4.50, slr: 18.00 },
  { date: "2022-09-30", repoRate: 5.90, crr: 4.50, slr: 18.00 },
  { date: "2022-12-07", repoRate: 6.25, crr: 4.50, slr: 18.00 },
  { date: "2023-02-08", repoRate: 6.50, crr: 4.50, slr: 18.00 },
  { date: "2023-04-06", repoRate: 6.50, crr: 4.50, slr: 18.00 },
  { date: "2023-06-08", repoRate: 6.50, crr: 4.50, slr: 18.00 },
  { date: "2023-08-10", repoRate: 6.50, crr: 4.50, slr: 18.00 },
  { date: "2023-10-06", repoRate: 6.50, crr: 4.50, slr: 18.00 },
  { date: "2023-12-08", repoRate: 6.50, crr: 4.50, slr: 18.00 },
  { date: "2024-02-08", repoRate: 6.50, crr: 4.50, slr: 18.00 },
  { date: "2024-04-05", repoRate: 6.50, crr: 4.50, slr: 18.00 },
  { date: "2024-06-07", repoRate: 6.50, crr: 4.50, slr: 18.00 },
  { date: "2024-08-08", repoRate: 6.50, crr: 4.50, slr: 18.00 },
  { date: "2024-10-09", repoRate: 6.50, crr: 4.00, slr: 18.00 },
  { date: "2024-12-06", repoRate: 6.50, crr: 4.00, slr: 18.00 },
  { date: "2025-02-07", repoRate: 6.25, crr: 4.00, slr: 18.00 },
  { date: "2025-04-09", repoRate: 6.00, crr: 4.00, slr: 18.00 },
  { date: "2025-06-06", repoRate: 5.75, crr: 4.00, slr: 18.00 },
  { date: "2025-08-06", repoRate: 5.50, crr: 4.00, slr: 18.00 },
  { date: "2025-10-08", repoRate: 5.50, crr: 3.50, slr: 18.00 },
  { date: "2025-12-05", repoRate: 5.50, crr: 3.00, slr: 18.00 },
  { date: "2026-02-07", repoRate: 5.50, crr: 3.00, slr: 18.00 },
  { date: "2026-04-08", repoRate: 5.25, crr: 3.00, slr: 18.00 }, // Cut: 5.50→5.25
  { date: "2026-06-05", repoRate: 5.25, crr: 3.00, slr: 18.00 }, // Hold (Upstox confirmed)
];

export async function fetchRBIRates(): Promise<RBIRates> {
  try {
    // Try scraping RBI's key rates page
    const res = await fetch(
      "https://www.rbi.org.in/scripts/bs_viewcontent.aspx?Id=4",
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) throw new Error("RBI page not reachable");

    const html = await res.text();
    const repoMatch = html.match(/Policy Repo Rate[^%]*?([\d.]+)%/i);
    const crrMatch = html.match(/Cash Reserve Ratio[^%]*?([\d.]+)%/i);
    const slrMatch = html.match(/Statutory Liquidity Ratio[^%]*?([\d.]+)%/i);

    if (repoMatch && crrMatch && slrMatch) {
      return {
        ...FALLBACK_RATES,
        repoRate: parseFloat(repoMatch[1]),
        crr: parseFloat(crrMatch[1]),
        slr: parseFloat(slrMatch[1]),
      };
    }
  } catch {
    // Fall through to fallback
  }
  return FALLBACK_RATES;
}

export function fetchRBIRateHistory(): RBIRateHistory[] {
  return REPO_RATE_HISTORY;
}
