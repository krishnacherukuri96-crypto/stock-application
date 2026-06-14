// Fundamental data sourced from Screener.in · Yahoo Finance (live prices)
// Scoring uses a 5-layer, 10-factor model (100 pts total). See computeScore().

export interface ScoreBreakdown {
  roce: number;           // 0–15
  revenueGrowth: number;  // 0–10
  profitGrowth: number;   // 0–10
  debt: number;           // 0–10  (uses GNPA for banking)
  margins: number;        // 0–10  (includes FCF quality bonus)
  valuation: number;      // 0–15  (PEG + PE vs 10-yr avg)
  industryTailwind: number; // 0–10 (base score + order book bonus)
  management: number;     // 0–10  (pledge + holding + trend)
  institutional: number;  // 0–5
  technical: number;      // 0–5
  total: number;
}

export interface StockMetrics {
  symbol: string;
  yahooSymbol: string;
  name: string;
  sector: SectorKey;
  marketCapCr: number;

  // Layer 1 – Business Quality
  pe: number;
  pb: number;
  roe: number;
  roce: number;
  debtToEquity: number;
  revenueGrowth3yr: number;
  profitGrowth3yr: number;
  netProfitMargin: number;
  fcfPositive: boolean;       // does company generate positive FCF?
  ocfGtNetProfit: boolean;    // is OCF > Net Profit? (earnings quality check)
  gnpa?: number;              // GNPA % — used instead of D/E for banking

  // Layer 2 – Valuation
  historicalPEAvg: number;    // 10-yr median PE from Screener.in
  pegRatio: number;           // computed: pe / profitGrowth3yr

  // Layer 3 – Growth Sustainability
  industryTailwindScore: number; // 0–8 base (order book adds up to +2)
  orderBookRevRatio?: number;

  // Layer 4 – Management Quality
  promoterHolding: number;
  promoterPledgePct: number;
  promoterTrend: "increasing" | "stable" | "decreasing";

  // Layer 5 – Market Behaviour
  institutionalTrend: "increasing" | "stable" | "decreasing";
  technicalScore: number;     // 0–5

  // Computed
  score: number;
  scoreBreakdown: ScoreBreakdown;
  rank: number;

  extras?: Record<string, string | number>;
  strengths: string[];
  watchouts: string[];
  screenerUrl: string;
}

export type SectorKey =
  | "banking" | "defence" | "road_infra" | "manufacturing"
  | "it" | "pharma" | "fmcg" | "auto" | "power";

export interface Sector {
  key: SectorKey;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  description: string;
  scoringNote: string;
}

export const SECTORS: Sector[] = [
  { key: "banking",       label: "Banking & Finance",    icon: "🏦", color: "text-blue-700",   bgColor: "bg-blue-50 border-blue-200",   description: "PSU & private banks, NBFCs",                     scoringNote: "ROCE, ROE, GNPA, CASA, credit growth; D/E replaced by GNPA in scoring" },
  { key: "defence",       label: "Defence & Aerospace",  icon: "🛡️", color: "text-purple-700", bgColor: "bg-purple-50 border-purple-200", description: "Defence PSUs, private defence players",         scoringNote: "ROE, order book/revenue, revenue growth, margins" },
  { key: "road_infra",    label: "Road Infrastructure",  icon: "🛣️", color: "text-orange-700", bgColor: "bg-orange-50 border-orange-200", description: "EPC contractors, road developers, HAM projects", scoringNote: "ROCE, order book/revenue, D/E, PEG" },
  { key: "manufacturing", label: "Capital Goods & Mfg",  icon: "🏭", color: "text-green-700",  bgColor: "bg-green-50 border-green-200",  description: "Industrial, electrical, electronics mfg",        scoringNote: "ROE, ROCE, FCF quality, PEG ratio" },
  { key: "it",            label: "IT & Technology",      icon: "💻", color: "text-indigo-700", bgColor: "bg-indigo-50 border-indigo-200", description: "IT services, SaaS, digital services",           scoringNote: "ROE, revenue growth, margin, FCF" },
  { key: "pharma",        label: "Pharma & Healthcare",  icon: "💊", color: "text-red-700",    bgColor: "bg-red-50 border-red-200",      description: "Generic pharma, hospitals, diagnostics",         scoringNote: "ROE, R&D pipeline, US approval track, margins" },
  { key: "fmcg",          label: "FMCG & Consumer",      icon: "🛒", color: "text-yellow-700", bgColor: "bg-yellow-50 border-yellow-200", description: "Consumer staples, food & beverages",            scoringNote: "ROE, volume growth, brand strength, FCF" },
  { key: "auto",          label: "Auto & EV",            icon: "🚗", color: "text-slate-700",  bgColor: "bg-slate-50 border-slate-200",  description: "OEMs, auto ancillaries, EV plays",               scoringNote: "ROE, volume CAGR, EV readiness, margins" },
  { key: "power",         label: "Power & Energy",       icon: "⚡", color: "text-amber-700",  bgColor: "bg-amber-50 border-amber-200",  description: "Generation, transmission, renewable energy",     scoringNote: "ROE, capacity addition, D/E, PAT growth" },
];

// ─── 5-LAYER SCORING ALGORITHM (100 pts) ────────────────────────────────────
// Layer 1 – Business Quality  : 55 pts (ROCE 15 + RevGrowth 10 + ProfGrowth 10 + Debt 10 + Margins 10)
// Layer 2 – Valuation         : 15 pts (PEG ratio + PE vs 10-yr historical avg)
// Layer 3 – Growth Sustain    : 10 pts (industry tailwind + order book coverage)
// Layer 4 – Management        : 10 pts (pledge 4 + trend 4 + holding 2)
// Layer 5 – Market Behaviour  : 10 pts (institutional trend 5 + technical 5)

function computeScore(s: Omit<StockMetrics, "score" | "scoreBreakdown" | "rank" | "pegRatio">): ScoreBreakdown {
  // ── ROCE (15 pts) ──
  const roce =
    s.roce >= 35 ? 15 : s.roce >= 30 ? 14 : s.roce >= 25 ? 12 :
    s.roce >= 20 ? 10 : s.roce >= 15 ?  7 : s.roce >= 10 ?  4 : 2;

  // ── Revenue Growth 3yr CAGR (10 pts) ──
  const revenueGrowth =
    s.revenueGrowth3yr >= 35 ? 10 : s.revenueGrowth3yr >= 25 ?  9 :
    s.revenueGrowth3yr >= 20 ?  7 : s.revenueGrowth3yr >= 15 ?  5 :
    s.revenueGrowth3yr >= 10 ?  3 : s.revenueGrowth3yr >=  5 ?  1 : 0;

  // ── Profit Growth 3yr CAGR (10 pts) ──
  const profitGrowth =
    s.profitGrowth3yr >= 50 ? 10 : s.profitGrowth3yr >= 40 ?  9 :
    s.profitGrowth3yr >= 30 ?  7 : s.profitGrowth3yr >= 20 ?  5 :
    s.profitGrowth3yr >= 15 ?  3 : s.profitGrowth3yr >= 10 ?  1 : 0;

  // ── Debt / GNPA (10 pts) ── banking uses GNPA instead of D/E
  let debt: number;
  if (s.gnpa !== undefined) {
    // Banking: score on asset quality (GNPA)
    debt = s.gnpa <= 1.0 ? 10 : s.gnpa <= 1.5 ? 9 : s.gnpa <= 2.0 ? 7 :
           s.gnpa <= 3.0 ? 5  : s.gnpa <= 5.0 ? 2 : 0;
  } else {
    debt = s.debtToEquity === 0  ? 10 : s.debtToEquity <= 0.2 ? 9 :
           s.debtToEquity <= 0.5 ?  7 : s.debtToEquity <= 1.0 ? 5 :
           s.debtToEquity <= 2.0 ?  2 : 0;
  }

  // ── Margins + FCF quality (10 pts) ──
  const baseMargin =
    s.netProfitMargin >= 25 ? 8 : s.netProfitMargin >= 20 ? 7 :
    s.netProfitMargin >= 15 ? 6 : s.netProfitMargin >= 10 ? 5 :
    s.netProfitMargin >=  7 ? 4 : s.netProfitMargin >=  4 ? 2 :
    s.netProfitMargin >=  2 ? 1 : 0;
  const fcfBonus = s.fcfPositive && s.ocfGtNetProfit ? 2 : s.fcfPositive ? 1 : 0;
  const margins = Math.min(10, baseMargin + fcfBonus);

  const businessQuality = roce + revenueGrowth + profitGrowth + debt + margins;

  // ── Valuation (15 pts): PEG + PE vs history ──
  const peg = s.pe / Math.max(1, s.profitGrowth3yr);
  let pegScore =
    peg < 0.3  ? 15 : peg < 0.5  ? 13 : peg < 0.75 ? 11 :
    peg < 1.0  ? 9  : peg < 1.25 ? 7  : peg < 1.5  ?  5 :
    peg < 2.0  ? 3  : peg < 2.5  ? 1  : 0;

  // Adjust ±2 pts for PE vs 10-yr historical average
  if (s.historicalPEAvg > 0) {
    const peRatio = s.pe / s.historicalPEAvg;
    if (peRatio < 0.7) pegScore = Math.min(15, pegScore + 2);       // materially cheaper than history
    else if (peRatio < 0.85) pegScore = Math.min(15, pegScore + 1);
    else if (peRatio > 1.8)  pegScore = Math.max(0,  pegScore - 2); // materially more expensive
    else if (peRatio > 1.4)  pegScore = Math.max(0,  pegScore - 1);
  }
  const valuation = pegScore;

  // ── Industry Tailwind + Order Book (10 pts) ──
  let obBonus = 0;
  if (s.orderBookRevRatio !== undefined) {
    obBonus = s.orderBookRevRatio >= 5 ? 2 : s.orderBookRevRatio >= 3 ? 1 : 0;
  }
  const industryTailwind = Math.min(10, s.industryTailwindScore + obBonus);

  // ── Management Quality (10 pts) ──
  const pledgeScore  = s.promoterPledgePct === 0 ? 4 : s.promoterPledgePct <= 5 ? 2 : 0;
  const trendScore   = s.promoterTrend === "increasing" ? 4 : s.promoterTrend === "stable" ? 3 : 0;
  // holding: 0% allowed for widely-held MNCs/banks, else penalise low holding
  const holdingScore = s.promoterHolding >= 50 ? 2 : s.promoterHolding >= 25 ? 1 :
                       (s.sector === "banking" || s.promoterHolding === 0) ? 1 : 0;
  const management = Math.min(10, pledgeScore + trendScore + holdingScore);

  // ── Market Behaviour (10 pts) ──
  const institutional = s.institutionalTrend === "increasing" ? 5 : s.institutionalTrend === "stable" ? 3 : 1;
  const technical     = Math.min(5, s.technicalScore);
  const marketBehaviour = institutional + technical;

  const total = Math.min(100, Math.round(
    businessQuality + valuation + industryTailwind + management + marketBehaviour
  ));

  return { roce, revenueGrowth, profitGrowth, debt, margins, valuation, industryTailwind, management, institutional, technical, total };
}

// ─── RAW STOCK DATA ──────────────────────────────────────────────────────────
// score / scoreBreakdown / rank / pegRatio are omitted — computed below

type RawStock = Omit<StockMetrics, "score" | "scoreBreakdown" | "rank" | "pegRatio">;

const RAW: RawStock[] = [

  // ── BANKING ─────────────────────────────────────────────────────────────
  {
    symbol: "AXISBANK", yahooSymbol: "AXISBANK.NS", name: "Axis Bank", sector: "banking",
    marketCapCr: 370000, pe: 14.8, pb: 2.1, roe: 13.8, roce: 12.4,
    debtToEquity: 7.6, gnpa: 1.5, revenueGrowth3yr: 19.5, profitGrowth3yr: 45.2,
    netProfitMargin: 18.4, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 20, industryTailwindScore: 7, orderBookRevRatio: undefined,
    promoterHolding: 8.2, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 3,
    extras: { nim: "3.9%", gnpa: "1.5%", casa: "44%", creditGrowth: "15%" },
    strengths: ["Highest profit CAGR (45%) — Citibank integration driving gains", "Best CASA at 44% — lowest cost of funds", "NIM recovering to 3.9%", "Cheapest vs ICICI/Kotak at 14.8x P/E with similar growth", "PEG 0.33 — very cheap relative to earnings growth"],
    watchouts: ["Integration costs still flowing through P&L", "ROE at 13.8% has room to improve vs ICICI"],
    screenerUrl: "https://www.screener.in/company/AXISBANK/",
  },
  {
    symbol: "SBIN", yahooSymbol: "SBIN.NS", name: "State Bank of India", sector: "banking",
    marketCapCr: 720000, pe: 12.4, pb: 1.8, roe: 14.2, roce: 10.5,
    debtToEquity: 8.2, gnpa: 2.3, revenueGrowth3yr: 14.8, profitGrowth3yr: 32.1,
    netProfitMargin: 15.2, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 14, industryTailwindScore: 7, orderBookRevRatio: undefined,
    promoterHolding: 57.5, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 4,
    extras: { nim: "3.1%", gnpa: "2.3%", casa: "42%", creditGrowth: "14%" },
    strengths: ["PEG 0.39 — highest earnings growth for its P/E among PSBs", "PAT CAGR 32% — fastest profit growth in PSB universe", "Government backing: zero systemic risk", "Huge CASA of 42% on ₹50 lakh crore deposit base", "P/E 12.4x near historical avg — fairly valued"],
    watchouts: ["GNPA 2.3% elevated vs private peers", "Government borrowing pressures NIM"],
    screenerUrl: "https://www.screener.in/company/SBIN/",
  },
  {
    symbol: "ICICIBANK", yahooSymbol: "ICICIBANK.NS", name: "ICICI Bank", sector: "banking",
    marketCapCr: 920000, pe: 19.2, pb: 3.1, roe: 18.2, roce: 14.8,
    debtToEquity: 7.2, gnpa: 2.0, revenueGrowth3yr: 20.1, profitGrowth3yr: 28.4,
    netProfitMargin: 24.1, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 22, industryTailwindScore: 7, orderBookRevRatio: undefined,
    promoterHolding: 0, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 4,
    extras: { nim: "4.3%", gnpa: "2.0%", casa: "41%", creditGrowth: "16%" },
    strengths: ["Best-in-class NIM of 4.3% — well above sector avg", "GNPA improved from 5.4% (FY20) to 2.0% — clean book", "Digital banking leader: iMobile Pay has 15M+ users", "ROE 18.2% — highest among large private banks", "P/E 19.2 slightly below 22x historical average — still reasonable"],
    watchouts: ["Slowing fee income growth in recent quarters", "Rural expansion adds geographic risk"],
    screenerUrl: "https://www.screener.in/company/ICICIBANK/",
  },
  {
    symbol: "BANKBARODA", yahooSymbol: "BANKBARODA.NS", name: "Bank of Baroda", sector: "banking",
    marketCapCr: 115000, pe: 7.2, pb: 1.1, roe: 16.4, roce: 11.2,
    debtToEquity: 8.8, gnpa: 2.9, revenueGrowth3yr: 22.3, profitGrowth3yr: 48.2,
    netProfitMargin: 13.8, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 8, industryTailwindScore: 7, orderBookRevRatio: undefined,
    promoterHolding: 63.5, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 4,
    extras: { nim: "3.2%", gnpa: "2.9%", casa: "40%", creditGrowth: "13%" },
    strengths: ["PEG 0.15 — cheapest of all 40 stocks relative to earnings growth", "PAT CAGR 48% — massive turnaround post NPA cleanup", "P/E 7.2x near historical average: cheap in absolute and relative terms", "ROE 16.4% — highest among PSU banks", "Strong international business: 25% of assets overseas"],
    watchouts: ["GNPA 2.9% — highest in this banking list", "Government ownership limits strategic flexibility"],
    screenerUrl: "https://www.screener.in/company/BANKBARODA/",
  },
  {
    symbol: "FEDERALBNK", yahooSymbol: "FEDERALBNK.NS", name: "Federal Bank", sector: "banking",
    marketCapCr: 52000, pe: 12.8, pb: 1.6, roe: 14.1, roce: 10.2,
    debtToEquity: 7.0, gnpa: 2.2, revenueGrowth3yr: 21.4, profitGrowth3yr: 29.3,
    netProfitMargin: 18.2, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 15, industryTailwindScore: 7, orderBookRevRatio: undefined,
    promoterHolding: 0, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 3,
    extras: { nim: "3.2%", gnpa: "2.2%", casa: "35%", creditGrowth: "18%" },
    strengths: ["Fastest credit growth 18% — highest in mid-sized private banks", "PEG 0.44 — cheap relative to profit growth", "PAT CAGR 29% — strong profitability improvement", "Kerala NRI franchise: low-cost FCNR deposits"],
    watchouts: ["Concentration in Kerala/Gulf NRI corridors", "CASA 35% below large bank peers"],
    screenerUrl: "https://www.screener.in/company/FEDERALBNK/",
  },
  {
    symbol: "CHOLAFIN", yahooSymbol: "CHOLAFIN.NS", name: "Cholamandalam Finance", sector: "banking",
    marketCapCr: 112000, pe: 28.4, pb: 4.8, roe: 19.2, roce: 13.5,
    debtToEquity: 5.2, gnpa: 1.8, revenueGrowth3yr: 32.4, profitGrowth3yr: 31.8,
    netProfitMargin: 19.6, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 30, industryTailwindScore: 7, orderBookRevRatio: undefined,
    promoterHolding: 51.3, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 4,
    extras: { nim: "7.8%", gnpa: "1.8%", aum: "₹1.7 lakh crore", focus: "Vehicle + Home loans" },
    strengths: ["ROE 19.2% — best among vehicle finance NBFCs", "AUM CAGR 32% — fastest growing large NBFC", "Murugappa group: conservative governance, zero pledge", "Strong tier-2/3 markets penetration"],
    watchouts: ["Vehicle finance cyclicality if auto sector slows", "Higher D/E than pure banks"],
    screenerUrl: "https://www.screener.in/company/CHOLAFIN/",
  },
  {
    symbol: "BAJFINANCE", yahooSymbol: "BAJFINANCE.NS", name: "Bajaj Finance", sector: "banking",
    marketCapCr: 510000, pe: 32.4, pb: 6.2, roe: 22.1, roce: 14.2,
    debtToEquity: 3.8, gnpa: 1.1, revenueGrowth3yr: 28.4, profitGrowth3yr: 26.8,
    netProfitMargin: 22.3, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 42, industryTailwindScore: 7, orderBookRevRatio: undefined,
    promoterHolding: 54.8, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { nim: "11.2%", gnpa: "1.1%", aum: "₹3.9 lakh crore", custBase: "90M+" },
    strengths: ["Lowest GNPA for an NBFC at 1.1%", "Highest ROE in NBFC universe at 22.1%", "P/E 32x vs 10-yr avg 42x — cheapest relative to its own history", "90M+ customer base — best cross-sell in India"],
    watchouts: ["PEG 1.21 — not cheap on growth-adjusted basis", "Competition from Jio Finance, PhonePe"],
    screenerUrl: "https://www.screener.in/company/BAJFINANCE/",
  },
  {
    symbol: "HDFCBANK", yahooSymbol: "HDFCBANK.NS", name: "HDFC Bank", sector: "banking",
    marketCapCr: 1380000, pe: 21.5, pb: 2.8, roe: 16.8, roce: 12.1,
    debtToEquity: 7.5, gnpa: 1.3, revenueGrowth3yr: 17.2, profitGrowth3yr: 19.3,
    netProfitMargin: 22.8, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 25, industryTailwindScore: 7, orderBookRevRatio: undefined,
    promoterHolding: 0, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { nim: "3.5%", gnpa: "1.3%", casa: "38%", creditGrowth: "11%" },
    strengths: ["Lowest GNPA among large banks at 1.3%", "Consistent 20%+ PAT growth track record", "P/E 21.5 below 10-yr avg of 25 — cheap vs its own history", "Best liability franchise: 38% CASA at scale"],
    watchouts: ["Post-HDFC merger LDR elevated; NIM compression risk", "Credit growth slowed to 11% — below sector"],
    screenerUrl: "https://www.screener.in/company/HDFCBANK/",
  },
  {
    symbol: "KOTAKBANK", yahooSymbol: "KOTAKBANK.NS", name: "Kotak Mahindra Bank", sector: "banking",
    marketCapCr: 420000, pe: 24.1, pb: 3.5, roe: 14.8, roce: 11.4,
    debtToEquity: 6.8, gnpa: 1.5, revenueGrowth3yr: 18.3, profitGrowth3yr: 22.1,
    netProfitMargin: 24.5, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 28, industryTailwindScore: 7, orderBookRevRatio: undefined,
    promoterHolding: 25.9, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { nim: "4.8%", gnpa: "1.5%", casa: "43%", creditGrowth: "14%" },
    strengths: ["Best NIM at 4.8% — superior pricing power", "Best CASA 43% — lowest cost of funds", "Conservative underwriting: GNPA 1.5%", "P/E 24 below 28x historical avg"],
    watchouts: ["PEG 1.09 — fairly priced, not cheap", "Succession post-Uday Kotak remains an investor concern"],
    screenerUrl: "https://www.screener.in/company/KOTAKBANK/",
  },
  {
    symbol: "INDUSINDBK", yahooSymbol: "INDUSINDBK.NS", name: "IndusInd Bank", sector: "banking",
    marketCapCr: 77000, pe: 11.2, pb: 1.3, roe: 13.4, roce: 9.8,
    debtToEquity: 7.1, gnpa: 2.1, revenueGrowth3yr: 15.2, profitGrowth3yr: 8.4,
    netProfitMargin: 17.8, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 20, industryTailwindScore: 6, orderBookRevRatio: undefined,
    promoterHolding: 16.4, promoterPledgePct: 0, promoterTrend: "decreasing",
    institutionalTrend: "decreasing", technicalScore: 2,
    extras: { nim: "4.0%", gnpa: "2.1%", casa: "38%", creditGrowth: "10%" },
    strengths: ["Deep value: P/B 1.3x vs historical 2.5x", "Strong microfinance + vehicle franchise", "NIM 4.0% in line with private sector leaders"],
    watchouts: ["PEG 1.33 — fair at best given low 8% profit growth", "MFI stress; promoter pledge concerns; institutional trend negative", "P/E 11x looks cheap but vs historical 20x, growth has collapsed"],
    screenerUrl: "https://www.screener.in/company/INDUSINDBK/",
  },

  // ── DEFENCE ─────────────────────────────────────────────────────────────
  {
    symbol: "HAL", yahooSymbol: "HAL.NS", name: "Hindustan Aeronautics", sector: "defence",
    marketCapCr: 290000, pe: 34.2, pb: 10.1, roe: 28.4, roce: 34.2,
    debtToEquity: 0.0, revenueGrowth3yr: 17.8, profitGrowth3yr: 22.4,
    netProfitMargin: 22.1, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 35, industryTailwindScore: 9, orderBookRevRatio: 5.5,
    promoterHolding: 71.6, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 4,
    extras: { orderBook: "₹1.3 lakh crore", obRevRatio: "5.5x", products: "Tejas, ALH, Su-30 MRO" },
    strengths: ["Order book 5.5x revenue — 5+ yr visibility + order book bonus in score", "Zero debt — only large defence co with no borrowings", "ROCE 34.2% + ROE 28.4% — exceptional capital efficiency", "P/E 34 near 10-yr avg 35x — fairly valued not overpriced", "Budget 2026-27 defence capex +24% — direct beneficiary"],
    watchouts: ["Execution delays on Tejas Mk2", "Dependent on government order cycles"],
    screenerUrl: "https://www.screener.in/company/HAL/",
  },
  {
    symbol: "SOLARINDS", yahooSymbol: "SOLARINDS.NS", name: "Solar Industries", sector: "defence",
    marketCapCr: 92000, pe: 78.4, pb: 18.2, roe: 32.1, roce: 38.4,
    debtToEquity: 0.3, revenueGrowth3yr: 38.2, profitGrowth3yr: 42.8,
    netProfitMargin: 14.2, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 55, industryTailwindScore: 9, orderBookRevRatio: 3.0,
    promoterHolding: 73.4, promoterPledgePct: 0, promoterTrend: "increasing",
    institutionalTrend: "increasing", technicalScore: 4,
    extras: { orderBook: "₹12,000 cr", products: "Ammunition, Nagastra drone, propellants" },
    strengths: ["Highest ROE (32%) + ROCE (38%) in defence universe", "Revenue CAGR 38%, Profit CAGR 42.8%", "Nagastra-1: India's first armed drone, significant export potential", "Propellant + ammo monopoly for Indian Army", "73.4% promoter holding, zero pledge — founder-driven"],
    watchouts: ["PEG 1.83 and P/E 78 well above 10-yr avg 55 — expensive vs history", "High base; any execution miss = large % impact"],
    screenerUrl: "https://www.screener.in/company/SOLARINDS/",
  },
  {
    symbol: "DATAPATTNS", yahooSymbol: "DATAPATTNS.NS", name: "Data Patterns", sector: "defence",
    marketCapCr: 15200, pe: 55.8, pb: 10.4, roe: 24.2, roce: 28.1,
    debtToEquity: 0.0, revenueGrowth3yr: 38.4, profitGrowth3yr: 44.1,
    netProfitMargin: 22.8, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 60, industryTailwindScore: 9, orderBookRevRatio: 2.8,
    promoterHolding: 51.4, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 3,
    extras: { orderBook: "₹1,400 cr", products: "Defence electronics, avionics, radar" },
    strengths: ["Fastest growing listed defence electronics: 38% revenue CAGR", "Zero debt + 22.8% net margins — rare combination", "Avionics for Tejas, radar systems — critical programmes", "P/E 55.8 below 10-yr avg 60x — cheap vs its own history", "PEG 1.27 — reasonable for quality of business"],
    watchouts: ["Small cap ₹15,200 Cr — liquidity risk for large positions", "Customer concentration: ~80% defence"],
    screenerUrl: "https://www.screener.in/company/DATAPATTNS/",
  },
  {
    symbol: "BEL", yahooSymbol: "BEL.NS", name: "Bharat Electronics", sector: "defence",
    marketCapCr: 210000, pe: 48.2, pb: 11.2, roe: 24.8, roce: 30.5,
    debtToEquity: 0.0, revenueGrowth3yr: 19.4, profitGrowth3yr: 25.1,
    netProfitMargin: 15.4, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 32, industryTailwindScore: 9, orderBookRevRatio: 3.0,
    promoterHolding: 51.1, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 3,
    extras: { orderBook: "₹68,000 cr", products: "Radar, EW, Night vision, BMS" },
    strengths: ["Order book ₹68,000 Cr — 3x revenue coverage", "Zero debt + high dividend yield (2.5%)", "EW & C4I monopoly in India", "ROCE 30.5% exceptional for a government-owned company"],
    watchouts: ["P/E 48x well above 10-yr avg 32x — expensive vs own history", "PEG 1.92 — paying up for quality; margin of safety thin"],
    screenerUrl: "https://www.screener.in/company/BEL/",
  },
  {
    symbol: "BHARATFORG", yahooSymbol: "BHARATFORG.NS", name: "Bharat Forge", sector: "defence",
    marketCapCr: 64000, pe: 42.1, pb: 6.8, roe: 18.2, roce: 15.4,
    debtToEquity: 0.8, revenueGrowth3yr: 18.4, profitGrowth3yr: 35.2,
    netProfitMargin: 8.4, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 40, industryTailwindScore: 8, orderBookRevRatio: 1.5,
    promoterHolding: 45.1, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { defenceRevPct: "18% of revenues", products: "Artillery, ATAGS gun, armoured vehicles" },
    strengths: ["PEG 1.20 — fair value for diversified defence+auto play", "ATAGS artillery: India's first fully indigenous artillery system", "Defence margins ~40% vs 8% auto — profitable mix shift", "P/E 42 near 10-yr avg 40x — fairly valued"],
    watchouts: ["Auto (60%+ revenue) faces EV disruption", "D/E 0.8x elevated vs zero-debt defence peers"],
    screenerUrl: "https://www.screener.in/company/BHARATFORG/",
  },
  {
    symbol: "COCHINSHIP", yahooSymbol: "COCHINSHIP.NS", name: "Cochin Shipyard", sector: "defence",
    marketCapCr: 20800, pe: 28.4, pb: 5.2, roe: 19.8, roce: 22.4,
    debtToEquity: 0.2, revenueGrowth3yr: 28.4, profitGrowth3yr: 38.2,
    netProfitMargin: 12.1, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 20, industryTailwindScore: 8, orderBookRevRatio: 3.0,
    promoterHolding: 72.9, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 3,
    extras: { orderBook: "₹5,000 cr", products: "INS Vikrant, warships, LNG vessels" },
    strengths: ["PEG 0.74 — cheap relative to earnings growth", "Built INS Vikrant — India's first indigenous aircraft carrier", "Order book 3x revenues; zero pledge; 72.9% government holding", "ROCE 22.4% + ROE 19.8% — strong for a shipyard"],
    watchouts: ["P/E 28 above 10-yr avg 20x — slightly expensive vs history", "Small float (27%) — price volatile"],
    screenerUrl: "https://www.screener.in/company/COCHINSHIP/",
  },
  {
    symbol: "GRSE", yahooSymbol: "GRSE.NS", name: "Garden Reach Shipbuilders", sector: "defence",
    marketCapCr: 12400, pe: 38.2, pb: 8.1, roe: 22.4, roce: 25.1,
    debtToEquity: 0.1, revenueGrowth3yr: 24.8, profitGrowth3yr: 32.4,
    netProfitMargin: 9.8, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 25, industryTailwindScore: 8, orderBookRevRatio: 3.5,
    promoterHolding: 74.5, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { orderBook: "₹4,800 cr", products: "Navy frigates, corvettes, fast patrol vessels" },
    strengths: ["PEG 1.18 — reasonable for defence shipbuilder quality", "ROCE 25.1% + ROE 22.4% — strong capital efficiency", "Very low D/E at 0.1x; 74.5% government holding"],
    watchouts: ["P/E 38 above 10-yr avg 25x — expensive vs history", "Revenue depends on Navy capex cycle"],
    screenerUrl: "https://www.screener.in/company/GRSE/",
  },
  {
    symbol: "BEML", yahooSymbol: "BEML.NS", name: "BEML Ltd", sector: "defence",
    marketCapCr: 14800, pe: 48.4, pb: 4.8, roe: 10.8, roce: 12.4,
    debtToEquity: 0.5, revenueGrowth3yr: 14.8, profitGrowth3yr: 18.4,
    netProfitMargin: 5.8, fcfPositive: false, ocfGtNetProfit: false,
    historicalPEAvg: 45, industryTailwindScore: 7, orderBookRevRatio: 1.5,
    promoterHolding: 54.0, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 2,
    extras: { products: "Metro coaches, armoured vehicles, mining equipment" },
    strengths: ["Monopoly on metro rail coaches — DMRC, BMRCL, Pune Metro", "Mine Protected Vehicles for Army — 100% indigenised", "Government divestment candidate — potential re-rating trigger"],
    watchouts: ["ROE 10.8% poor vs defence peers; FCF negative", "PEG 2.63 — expensive relative to earnings growth", "Three businesses (defence + mining + metro) create complexity"],
    screenerUrl: "https://www.screener.in/company/BEML/",
  },
  {
    symbol: "MTARTECH", yahooSymbol: "MTARTECH.NS", name: "MTAR Technologies", sector: "defence",
    marketCapCr: 4200, pe: 62.4, pb: 8.4, roe: 15.2, roce: 18.4,
    debtToEquity: 0.1, revenueGrowth3yr: 28.4, profitGrowth3yr: 22.1,
    netProfitMargin: 12.4, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 65, industryTailwindScore: 8, orderBookRevRatio: 2.0,
    promoterHolding: 54.2, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { products: "Rocket engines, fuel cells, nuclear components" },
    strengths: ["Critical sub-systems for ISRO (PSLV, GSLV), DRDO", "Export to Rafael (Israel), GE (USA)", "P/E 62 below 10-yr avg 65x — slightly cheap vs history", "Clean energy pivot: electrolysers for green hydrogen"],
    watchouts: ["PEG 2.82 — expensive on growth-adjusted basis", "Revenue concentration in few large programmes"],
    screenerUrl: "https://www.screener.in/company/MTARTECH/",
  },
  {
    symbol: "PARAS", yahooSymbol: "PARASGLASS.NS", name: "Paras Defence & Space", sector: "defence",
    marketCapCr: 3100, pe: 72.4, pb: 9.8, roe: 14.8, roce: 16.4,
    debtToEquity: 0.4, revenueGrowth3yr: 32.4, profitGrowth3yr: 28.4,
    netProfitMargin: 14.2, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 80, industryTailwindScore: 8, orderBookRevRatio: 1.5,
    promoterHolding: 59.0, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "decreasing", technicalScore: 2,
    extras: { products: "Optics, EMP shields, space imaging" },
    strengths: ["Only listed company making electro-optics + EMP protection in India", "P/E 72 below 10-yr avg 80x — rare opportunity", "Space sector optionality: ISRO/NSIL component supplier"],
    watchouts: ["PEG 2.55 — expensive on earnings growth basis", "₹3,100 Cr — illiquid; institutional trend declining"],
    screenerUrl: "https://www.screener.in/company/PARASGLASS/",
  },

  // ── ROAD INFRA ───────────────────────────────────────────────────────────
  {
    symbol: "HGINFRA", yahooSymbol: "HGINFRA.NS", name: "HG Infra Engineering", sector: "road_infra",
    marketCapCr: 5200, pe: 14.8, pb: 3.1, roe: 24.8, roce: 22.1,
    debtToEquity: 0.6, revenueGrowth3yr: 22.4, profitGrowth3yr: 32.8,
    netProfitMargin: 10.8, fcfPositive: false, ocfGtNetProfit: false,
    historicalPEAvg: 14, industryTailwindScore: 8, orderBookRevRatio: 4.8,
    promoterHolding: 64.2, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 4,
    extras: { orderBook: "₹12,400 cr", obRevRatio: "4.8x", focus: "Rajasthan highways + tunnels" },
    strengths: ["PEG 0.45 — one of cheapest in road infra universe", "Order book 4.8x revenue = order book bonus in score", "Highest ROCE in road infra space at 22.1%", "Moved into tunnelling — higher margin, less competition", "P/E near 10-yr avg: fair historical valuation"],
    watchouts: ["FCF negative — EPC construction WC cycle", "Geographic concentration in Rajasthan"],
    screenerUrl: "https://www.screener.in/company/HGINFRA/",
  },
  {
    symbol: "KNR", yahooSymbol: "KNRCON.NS", name: "KNR Constructions", sector: "road_infra",
    marketCapCr: 9800, pe: 15.4, pb: 2.8, roe: 22.4, roce: 19.8,
    debtToEquity: 0.4, revenueGrowth3yr: 18.4, profitGrowth3yr: 28.4,
    netProfitMargin: 11.4, fcfPositive: false, ocfGtNetProfit: false,
    historicalPEAvg: 16, industryTailwindScore: 8, orderBookRevRatio: 3.8,
    promoterHolding: 52.8, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 3,
    extras: { orderBook: "₹11,500 cr", obRevRatio: "3.8x", focus: "South India highways + irrigation" },
    strengths: ["Best ROE (22.4%) + ROCE (19.8%) in road EPC — strong capital efficiency", "PEG 0.54 — cheap relative to profit growth", "D/E 0.4x — conservative vs peers at 1.5-3x", "Order book 3.8x revenue — good visibility"],
    watchouts: ["FCF negative — construction WC cycle", "Concentrated in South India"],
    screenerUrl: "https://www.screener.in/company/KNR/",
  },
  {
    symbol: "NCC", yahooSymbol: "NCC.NS", name: "NCC Ltd", sector: "road_infra",
    marketCapCr: 8400, pe: 14.2, pb: 1.8, roe: 16.4, roce: 14.2,
    debtToEquity: 0.6, revenueGrowth3yr: 15.8, profitGrowth3yr: 35.4,
    netProfitMargin: 5.8, fcfPositive: false, ocfGtNetProfit: false,
    historicalPEAvg: 14, industryTailwindScore: 8, orderBookRevRatio: 6.0,
    promoterHolding: 20.0, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { orderBook: "₹52,000 cr", focus: "Roads, buildings, water" },
    strengths: ["PEG 0.40 — excellent value vs 35% profit growth", "Order book 6x revenues — earns order book bonus in score", "Diversified EPC — roads, buildings, water reduces concentration risk", "P/E 14x near 10-yr avg — not expensive"],
    watchouts: ["Low promoter holding (20%) — weak skin in the game", "Net margin 5.8% thin; FCF negative due to WC"],
    screenerUrl: "https://www.screener.in/company/NCC/",
  },
  {
    symbol: "WELSPUNIND", yahooSymbol: "WELSPUNIND.NS", name: "Welspun Enterprises", sector: "road_infra",
    marketCapCr: 3800, pe: 12.4, pb: 1.4, roe: 12.8, roce: 11.4,
    debtToEquity: 0.9, revenueGrowth3yr: 28.4, profitGrowth3yr: 42.4,
    netProfitMargin: 6.8, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 12, industryTailwindScore: 8, orderBookRevRatio: 4.0,
    promoterHolding: 52.8, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 2,
    extras: { orderBook: "₹7,200 cr", focus: "HAM roads + water" },
    strengths: ["PEG 0.29 — second cheapest in road infra on growth-adjusted basis", "Revenue CAGR 28%, Profit CAGR 42% at P/E 12x — compelling value", "HAM portfolio gives hybrid annuity income; FCF positive"],
    watchouts: ["D/E 0.9x needs monitoring as HAM investments ramp", "Small cap ₹3,800 Cr — thin liquidity"],
    screenerUrl: "https://www.screener.in/company/WELSPUNIND/",
  },
  {
    symbol: "GRINFRA", yahooSymbol: "GRINFRA.NS", name: "GR Infraprojects", sector: "road_infra",
    marketCapCr: 10400, pe: 16.2, pb: 2.9, roe: 20.4, roce: 18.2,
    debtToEquity: 0.5, revenueGrowth3yr: 20.8, profitGrowth3yr: 24.4,
    netProfitMargin: 10.2, fcfPositive: false, ocfGtNetProfit: false,
    historicalPEAvg: 18, industryTailwindScore: 8, orderBookRevRatio: 5.0,
    promoterHolding: 71.8, promoterPledgePct: 0, promoterTrend: "increasing",
    institutionalTrend: "increasing", technicalScore: 3,
    extras: { orderBook: "₹18,200 cr", focus: "National highways, bridges" },
    strengths: ["PEG 0.66 — cheap relative to profit growth", "Order book 5x revenues — earns +2 order book bonus in score", "71.8% promoter holding + increasing trend — strong alignment", "P/E 16 below 10-yr avg 18 — historically reasonable"],
    watchouts: ["FCF negative — construction WC", "Entry into railways adds execution risk"],
    screenerUrl: "https://www.screener.in/company/GRINFRA/",
  },
  {
    symbol: "PNCINFRA", yahooSymbol: "PNCINFRA.NS", name: "PNC Infratech", sector: "road_infra",
    marketCapCr: 7800, pe: 13.8, pb: 2.2, roe: 18.4, roce: 15.8,
    debtToEquity: 0.8, revenueGrowth3yr: 16.8, profitGrowth3yr: 21.2,
    netProfitMargin: 9.4, fcfPositive: false, ocfGtNetProfit: false,
    historicalPEAvg: 14, industryTailwindScore: 8, orderBookRevRatio: 4.5,
    promoterHolding: 62.4, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { orderBook: "₹15,200 cr", focus: "UP, MP highways + water projects" },
    strengths: ["PEG 0.65 — cheap relative to profit growth", "Established North India road EPC: 25+ years execution", "Order book 4.5x revenues — multi-year revenue locked in", "P/E 13.8x near 10-yr avg 14x — fairly valued"],
    watchouts: ["D/E 0.8x — more leveraged than KNR/HG Infra", "Water projects have slower payment cycles"],
    screenerUrl: "https://www.screener.in/company/PNCINFRA/",
  },
  {
    symbol: "ASHOKA", yahooSymbol: "ASHOKA.NS", name: "Ashoka Buildcon", sector: "road_infra",
    marketCapCr: 6400, pe: 18.4, pb: 2.4, roe: 15.8, roce: 13.2,
    debtToEquity: 1.8, revenueGrowth3yr: 19.2, profitGrowth3yr: 22.4,
    netProfitMargin: 7.8, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 18, industryTailwindScore: 7, orderBookRevRatio: 3.0,
    promoterHolding: 58.2, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 2,
    extras: { orderBook: "₹10,400 cr", focus: "BOT + HAM road projects" },
    strengths: ["PEG 0.82 — cheap relative to earnings growth", "BOT asset monetisation generating annuity income", "FCF positive from operational toll roads", "58% promoter holding with zero pledge"],
    watchouts: ["D/E 1.8x — high leverage on BOT assets", "P/E 18 at top of 10-yr range"],
    screenerUrl: "https://www.screener.in/company/ASHOKA/",
  },
  {
    symbol: "IRB", yahooSymbol: "IRB.NS", name: "IRB Infrastructure Developers", sector: "road_infra",
    marketCapCr: 31200, pe: 32.8, pb: 4.1, roe: 12.4, roce: 8.4,
    debtToEquity: 2.8, revenueGrowth3yr: 24.8, profitGrowth3yr: 15.4,
    netProfitMargin: 14.8, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 28, industryTailwindScore: 7, orderBookRevRatio: 2.0,
    promoterHolding: 54.8, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 4,
    extras: { tollRevenue: "₹2,800 cr/yr", concessions: "22 operational toll roads" },
    strengths: ["India's largest toll road operator — ₹2,800 Cr annual toll revenue", "Annuity model: steady cash flows regardless of economy", "ADIA investment — sovereign institutional validation", "FCF strongly positive from toll operations"],
    watchouts: ["PEG 2.13 — expensive relative to earnings growth", "D/E 2.8x — leveraged; P/E 32 above 10-yr avg 28x"],
    screenerUrl: "https://www.screener.in/company/IRB/",
  },
  {
    symbol: "RVNL", yahooSymbol: "RVNL.NS", name: "Rail Vikas Nigam", sector: "road_infra",
    marketCapCr: 41800, pe: 38.4, pb: 8.2, roe: 21.8, roce: 18.4,
    debtToEquity: 0.2, revenueGrowth3yr: 22.4, profitGrowth3yr: 28.4,
    netProfitMargin: 5.4, fcfPositive: false, ocfGtNetProfit: false,
    historicalPEAvg: 30, industryTailwindScore: 8, orderBookRevRatio: 10.0,
    promoterHolding: 72.8, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 3,
    extras: { orderBook: "₹82,000 cr", focus: "Railway electrification, new lines" },
    strengths: ["Order book ₹82,000 Cr (10x revenue) — earns max +2 order book bonus in score", "ROE 21.8% + ROCE 18.4% — strong for a government EPC", "Zero debt at company level", "Railway budget allocation +15% YoY — direct beneficiary"],
    watchouts: ["PEG 1.35 — fair but not cheap at 38x P/E (above 10-yr avg 30x)", "Net margin 5.4% thin; FCF negative"],
    screenerUrl: "https://www.screener.in/company/RVNL/",
  },
  {
    symbol: "NBCC", yahooSymbol: "NBCC.NS", name: "NBCC (India)", sector: "road_infra",
    marketCapCr: 18400, pe: 42.4, pb: 7.8, roe: 19.2, roce: 22.4,
    debtToEquity: 0.0, revenueGrowth3yr: 18.4, profitGrowth3yr: 22.8,
    netProfitMargin: 2.8, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 40, industryTailwindScore: 7, orderBookRevRatio: 8.0,
    promoterHolding: 61.9, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 4,
    extras: { orderBook: "₹62,000 cr", focus: "Government buildings, redevelopment" },
    strengths: ["Order book 8x revenues — earns +2 order book bonus in score", "Zero debt — no financial risk", "ROCE 22.4% exceptional for asset-light government contractor", "PM AWAS mandate drives massive order pipeline"],
    watchouts: ["PEG 1.86 — expensive relative to growth; P/E 42 near 10-yr avg", "Net margin 2.8% — very thin for this valuation"],
    screenerUrl: "https://www.screener.in/company/NBCC/",
  },

  // ── MANUFACTURING ─────────────────────────────────────────────────────────
  {
    symbol: "ABB", yahooSymbol: "ABB.NS", name: "ABB India", sector: "manufacturing",
    marketCapCr: 81000, pe: 74.2, pb: 18.4, roe: 28.4, roce: 32.1,
    debtToEquity: 0.0, revenueGrowth3yr: 21.4, profitGrowth3yr: 48.2,
    netProfitMargin: 11.8, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 50, industryTailwindScore: 8, orderBookRevRatio: 2.0,
    promoterHolding: 74.9, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { products: "Motors, drives, transformers, robots", orderBook: "₹8,400 cr" },
    strengths: ["ROCE 32.1% — best in capital goods sector", "Zero debt + cash-rich balance sheet", "PEG 1.54 — fair for ROCE 32% quality", "Data centre boom: industrial automation demand rising sharply", "74.9% ABB Global holding — technology access"],
    watchouts: ["P/E 74x well above 10-yr avg 50x — expensive vs own history (-2 pts in score)", "PEG 1.54 — not cheap; any miss = sharp correction"],
    screenerUrl: "https://www.screener.in/company/ABB/",
  },
  {
    symbol: "CUMMINSIND", yahooSymbol: "CUMMINSIND.NS", name: "Cummins India", sector: "manufacturing",
    marketCapCr: 58000, pe: 48.4, pb: 12.4, roe: 30.4, roce: 36.2,
    debtToEquity: 0.0, revenueGrowth3yr: 22.4, profitGrowth3yr: 32.4,
    netProfitMargin: 16.8, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 40, industryTailwindScore: 8, orderBookRevRatio: undefined,
    promoterHolding: 51.0, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { products: "Diesel + gas gensets, power systems, exports" },
    strengths: ["Highest ROE+ROCE combination: 30% ROE, 36% ROCE in mfg sector", "16.8% net margin — best in class for manufacturing", "Zero debt + consistent 80%+ dividend payout", "Data centre boom: genset demand growing 45% YoY", "FCF strongly positive: OCF consistently > Net Profit"],
    watchouts: ["PEG 1.49 — fair; P/E 48 above 10-yr avg 40x — slightly expensive", "Export revenue (45%) exposed to USD/INR and global capex cycles"],
    screenerUrl: "https://www.screener.in/company/CUMMINSIND/",
  },
  {
    symbol: "SIEMENS", yahooSymbol: "SIEMENS.NS", name: "Siemens India", sector: "manufacturing",
    marketCapCr: 148000, pe: 68.4, pb: 14.2, roe: 22.1, roce: 25.8,
    debtToEquity: 0.0, revenueGrowth3yr: 19.8, profitGrowth3yr: 38.4,
    netProfitMargin: 9.8, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 55, industryTailwindScore: 8, orderBookRevRatio: 3.0,
    promoterHolding: 75.0, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { products: "Power transformers, rail electrification, smart grid", orderBook: "₹16,200 cr" },
    strengths: ["Largest order book (₹16,200 Cr) in capital goods", "Grid modernisation + data centre power — new growth vectors", "PEG 1.78 — reasonable for Siemens quality", "75% Siemens AG holding — technology pipeline from Germany"],
    watchouts: ["P/E 68 above 10-yr avg 55x — expensive vs history", "Energy division demerger pending — uncertainty"],
    screenerUrl: "https://www.screener.in/company/SIEMENS/",
  },
  {
    symbol: "DIXON", yahooSymbol: "DIXON.NS", name: "Dixon Technologies", sector: "manufacturing",
    marketCapCr: 48000, pe: 92.4, pb: 22.4, roe: 28.4, roce: 32.4,
    debtToEquity: 0.2, revenueGrowth3yr: 62.4, profitGrowth3yr: 58.4,
    netProfitMargin: 3.4, fcfPositive: false, ocfGtNetProfit: false,
    historicalPEAvg: 75, industryTailwindScore: 9, orderBookRevRatio: undefined,
    promoterHolding: 34.2, promoterPledgePct: 0, promoterTrend: "increasing",
    institutionalTrend: "increasing", technicalScore: 4,
    extras: { products: "Mobiles, TVs, washing machines, LED, laptops — contract mfg", clients: "Samsung, Motorola, Google, HP" },
    strengths: ["Revenue CAGR 62% + Profit CAGR 58% — fastest growing listed manufacturer", "PEG 1.58 — reasonable given 58% profit growth", "PLI beneficiary: Samsung, Google, Motorola manufacturing mandates", "China+1 wave: Motorola shifted India manufacturing to Dixon", "Promoter trend: increasing — founder confidence"],
    watchouts: ["P/E 92 above 10-yr avg 75x — expensive vs own history", "Net margin 3.4% wafer thin; FCF negative (WC heavy)"],
    screenerUrl: "https://www.screener.in/company/DIXON/",
  },
  {
    symbol: "HAVELLS", yahooSymbol: "HAVELLS.NS", name: "Havells India", sector: "manufacturing",
    marketCapCr: 104000, pe: 68.8, pb: 14.8, roe: 24.2, roce: 28.4,
    debtToEquity: 0.0, revenueGrowth3yr: 18.4, profitGrowth3yr: 22.8,
    netProfitMargin: 8.4, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 55, industryTailwindScore: 8, orderBookRevRatio: undefined,
    promoterHolding: 59.4, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { products: "Cables, switchgear, fans, AC, appliances, Lloyd brand" },
    strengths: ["Strongest brand in electrical goods — premium pricing power", "Zero debt + 59% promoter holding, zero pledge", "Real estate boom drives cables/switchgear demand", "ROCE 28.4% strong for a consumer electricals company"],
    watchouts: ["PEG 3.02 — expensive on growth-adjusted basis; most expensive in mfg list", "P/E 68 well above 10-yr avg 55x; Lloyd drag on overall margins"],
    screenerUrl: "https://www.screener.in/company/HAVELLS/",
  },
  {
    symbol: "THERMAX", yahooSymbol: "THERMAX.NS", name: "Thermax Ltd", sector: "manufacturing",
    marketCapCr: 42000, pe: 62.4, pb: 8.4, roe: 16.8, roce: 18.4,
    debtToEquity: 0.1, revenueGrowth3yr: 18.8, profitGrowth3yr: 48.4,
    netProfitMargin: 6.8, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 50, industryTailwindScore: 8, orderBookRevRatio: 2.0,
    promoterHolding: 61.5, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { products: "Boilers, heat exchangers, waste heat recovery, green energy" },
    strengths: ["PEG 1.29 — reasonable for industrial energy transition quality", "PAT CAGR 48% — strong profitability recovery", "Industrial energy transition play: green hydrogen + waste heat", "61.5% Aga family holding, zero pledge — conservative founder governance"],
    watchouts: ["P/E 62 above 10-yr avg 50x — expensive vs history", "Net margin 6.8% thin; 40% international revenue adds FX risk"],
    screenerUrl: "https://www.screener.in/company/THERMAX/",
  },
  {
    symbol: "KAYNES", yahooSymbol: "KAYNES.NS", name: "Kaynes Technology", sector: "manufacturing",
    marketCapCr: 22400, pe: 88.4, pb: 14.2, roe: 18.4, roce: 21.4,
    debtToEquity: 0.4, revenueGrowth3yr: 48.4, profitGrowth3yr: 62.4,
    netProfitMargin: 8.4, fcfPositive: false, ocfGtNetProfit: false,
    historicalPEAvg: 70, industryTailwindScore: 9, orderBookRevRatio: undefined,
    promoterHolding: 59.2, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 3,
    extras: { products: "PCBs, EMS for defence, aerospace, industrials", clients: "ISRO, DRDO, L&T" },
    strengths: ["Revenue CAGR 48% + Profit CAGR 62% — fastest growing EMS company", "PEG 1.42 — fair for quality of business and growth rate", "Defence + ISRO programmes: stable long-term contracts", "PLI for electronics + semiconductor assembly tailwind"],
    watchouts: ["P/E 88 above 10-yr avg 70x — expensive vs history", "FCF negative — growing WC; small cap liquidity risk"],
    screenerUrl: "https://www.screener.in/company/KAYNES/",
  },
  {
    symbol: "VOLTAS", yahooSymbol: "VOLTAS.NS", name: "Voltas Ltd", sector: "manufacturing",
    marketCapCr: 36000, pe: 72.4, pb: 8.4, roe: 12.8, roce: 14.2,
    debtToEquity: 0.1, revenueGrowth3yr: 16.4, profitGrowth3yr: 42.4,
    netProfitMargin: 5.2, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 55, industryTailwindScore: 8, orderBookRevRatio: undefined,
    promoterHolding: 30.3, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { products: "Room AC, commercial refrigeration, MEP projects", marketShare: "~20% room AC" },
    strengths: ["#1 room AC brand in India: 20% market share", "Climate change driving AC penetration from 8% toward 40%", "FCF positive; Tata group backing"],
    watchouts: ["PEG 1.71 — fair but not cheap; P/E 72 vs 10-yr avg 55x — expensive", "Net margin 5.2% thin; ROE 12.8% lowest in manufacturing list"],
    screenerUrl: "https://www.screener.in/company/VOLTAS/",
  },
  {
    symbol: "BHEL", yahooSymbol: "BHEL.NS", name: "BHEL", sector: "manufacturing",
    marketCapCr: 58400, pe: 82.4, pb: 3.8, roe: 5.4, roce: 6.8,
    debtToEquity: 0.5, revenueGrowth3yr: 12.4, profitGrowth3yr: 148.4,
    netProfitMargin: 1.8, fcfPositive: false, ocfGtNetProfit: false,
    historicalPEAvg: 45, industryTailwindScore: 7, orderBookRevRatio: 10.0,
    promoterHolding: 63.2, promoterPledgePct: 0, promoterTrend: "decreasing",
    institutionalTrend: "increasing", technicalScore: 3,
    extras: { orderBook: "₹1.6 lakh crore", focus: "Power plant equipment, green energy" },
    strengths: ["Order book ₹1.6 lakh crore (10x revenue) — earns max +2 order book bonus", "PEG 0.55 — deceptively cheap IF turnaround sustains", "Only domestic maker of ultra-supercritical turbines in India", "PAT CAGR 148% from very low base"],
    watchouts: ["P/E 82 well above 10-yr avg 45x — very expensive vs history (-2 pts)", "ROE 5.4% + ROCE 6.8% — extremely poor; FCF negative; promoter trend declining"],
    screenerUrl: "https://www.screener.in/company/BHEL/",
  },
  {
    symbol: "AMBER", yahooSymbol: "AMBER.NS", name: "Amber Enterprises", sector: "manufacturing",
    marketCapCr: 15200, pe: 48.4, pb: 6.4, roe: 15.4, roce: 16.8,
    debtToEquity: 0.8, revenueGrowth3yr: 28.4, profitGrowth3yr: 42.4,
    netProfitMargin: 3.2, fcfPositive: false, ocfGtNetProfit: false,
    historicalPEAvg: 42, industryTailwindScore: 8, orderBookRevRatio: undefined,
    promoterHolding: 40.2, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 2,
    extras: { products: "AC OEM for Voltas, Daikin, Hitachi, Panasonic", share: "25%+ of India AC production" },
    strengths: ["25%+ share of India's room AC manufacturing — OEM king", "PLI for white goods + growing AC penetration = secular tailwind", "PEG 1.14 — reasonably priced for 42% profit growth"],
    watchouts: ["D/E 0.8x elevated; FCF negative; margin 3.2% thin", "Customer concentration: top 3 AC brands = 60%+ revenue"],
    screenerUrl: "https://www.screener.in/company/AMBER/",
  },

  // ── IT & TECHNOLOGY ──────────────────────────────────────────────────────────
  {
    symbol: "TCS", yahooSymbol: "TCS.NS", name: "TCS", sector: "it",
    marketCapCr: 1450000, pe: 26.2, pb: 15.4, roe: 51.2, roce: 64.8,
    debtToEquity: 0.0, revenueGrowth3yr: 13.2, profitGrowth3yr: 12.8,
    netProfitMargin: 26.1, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 25, industryTailwindScore: 7,
    promoterHolding: 71.8, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { employees: "600,000+", topClient: "North America 40%+ revenue" },
    strengths: ["Best-in-class ROE 51% + ROCE 64% — most capital efficient IT company", "Zero debt + strongest FCF in Indian IT", "P/E 26x near 10-yr avg 25x — rare fair valuation for TCS", "AI re-bundling wave: TCS positioned as system integrator"],
    watchouts: ["Revenue growth slowing to 13% vs 20%+ peak cycle", "BFSI vertical (32% revenue) under pressure from US bank stress"],
    screenerUrl: "https://www.screener.in/company/TCS/",
  },
  {
    symbol: "INFY", yahooSymbol: "INFY.NS", name: "Infosys", sector: "it",
    marketCapCr: 780000, pe: 23.8, pb: 9.2, roe: 35.2, roce: 44.8,
    debtToEquity: 0.0, revenueGrowth3yr: 12.4, profitGrowth3yr: 11.8,
    netProfitMargin: 17.2, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 22, industryTailwindScore: 7,
    promoterHolding: 14.8, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { geography: "62% revenue from Americas", buyback: "₹30,000+ Cr returned in 3 years" },
    strengths: ["P/E 23.8 near 10-yr avg 22x — close to fair value", "ROE 35% + ROCE 44% — class-leading capital efficiency", "Large deal wins recovering: $4.7B TCV recent quarters"],
    watchouts: ["PEG 2.02 — expensive relative to 12% growth", "Promoter holding only 14.8% — fully institutional"],
    screenerUrl: "https://www.screener.in/company/INFY/",
  },
  {
    symbol: "HCLTECH", yahooSymbol: "HCLTECH.NS", name: "HCL Technologies", sector: "it",
    marketCapCr: 520000, pe: 22.4, pb: 7.8, roe: 24.2, roce: 28.4,
    debtToEquity: 0.0, revenueGrowth3yr: 18.4, profitGrowth3yr: 16.8,
    netProfitMargin: 14.2, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 20, industryTailwindScore: 7,
    promoterHolding: 60.8, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { platform: "HCL Software: 25% revenue — high-margin recurring", geography: "55% Americas" },
    strengths: ["Fastest revenue CAGR (18%) among tier-1 IT — gaining share in engineering services", "HCL Software: recurring platform revenue unlike pure services", "PEG 1.33 — cheapest among tier-1 IT on growth-adjusted basis", "60.8% Shiv Nadar family holding"],
    watchouts: ["P/E 22 slightly above 10-yr avg 20x", "IBM legacy IP integration still being digested"],
    screenerUrl: "https://www.screener.in/company/HCLTECH/",
  },
  {
    symbol: "PERSISTENT", yahooSymbol: "PERSISTENT.NS", name: "Persistent Systems", sector: "it",
    marketCapCr: 82000, pe: 58.4, pb: 16.2, roe: 28.4, roce: 36.2,
    debtToEquity: 0.0, revenueGrowth3yr: 42.8, profitGrowth3yr: 48.4,
    netProfitMargin: 14.8, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 42, industryTailwindScore: 8,
    promoterHolding: 31.2, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 4,
    extras: { focus: "BFSI + Hi-tech, AI-native engagements", employees: "22,000+" },
    strengths: ["Fastest revenue CAGR (42%) in listed mid-cap IT", "PEG 1.21 — reasonable given 48% profit growth", "Deepest AI/agentic capabilities among mid-cap IT companies", "ROE 28% + ROCE 36% — compounding at high capital returns"],
    watchouts: ["P/E 58 above 10-yr avg 42x — premium to history", "Low promoter holding 31% vs founder-led peers"],
    screenerUrl: "https://www.screener.in/company/PERSISTENT/",
  },
  {
    symbol: "LTIM", yahooSymbol: "LTIM.NS", name: "LTIMindtree", sector: "it",
    marketCapCr: 150000, pe: 34.2, pb: 9.4, roe: 28.2, roce: 35.8,
    debtToEquity: 0.0, revenueGrowth3yr: 21.4, profitGrowth3yr: 18.8,
    netProfitMargin: 14.2, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 28, industryTailwindScore: 7,
    promoterHolding: 68.4, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 3,
    extras: { focus: "BFSI, Hi-tech, CPG", group: "L&T Group synergy with infra + manufacturing clients" },
    strengths: ["Revenue CAGR 21% — faster than TCS/Infosys with better valuation than Persistent", "ROE 28% + ROCE 35% — strong capital efficiency", "68.4% promoter holding with zero pledge"],
    watchouts: ["P/E 34 above 10-yr avg 28x — some premium", "PEG 1.82 — fair but not cheap on growth basis"],
    screenerUrl: "https://www.screener.in/company/LTIM/",
  },
  {
    symbol: "COFORGE", yahooSymbol: "COFORGE.NS", name: "Coforge", sector: "it",
    marketCapCr: 42000, pe: 42.4, pb: 10.4, roe: 24.2, roce: 28.8,
    debtToEquity: 0.2, revenueGrowth3yr: 28.4, profitGrowth3yr: 28.8,
    netProfitMargin: 9.4, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 34, industryTailwindScore: 7,
    promoterHolding: 28.4, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 3,
    extras: { focus: "BFS, Insurance, Travel — deep vertical specialisation" },
    strengths: ["Revenue CAGR 28% — mid-cap outperformer vs tier-1 slowdown", "PEG 1.47 — reasonable for 28% growth", "Insurance vertical: top-5 IT vendor globally for insurance tech"],
    watchouts: ["P/E 42 above 10-yr avg 34x — premium to history", "Low promoter holding 28%; NIM 9.4% thin"],
    screenerUrl: "https://www.screener.in/company/COFORGE/",
  },
  {
    symbol: "WIPRO", yahooSymbol: "WIPRO.NS", name: "Wipro", sector: "it",
    marketCapCr: 280000, pe: 20.8, pb: 4.1, roe: 17.8, roce: 22.4,
    debtToEquity: 0.0, revenueGrowth3yr: 6.8, profitGrowth3yr: 8.2,
    netProfitMargin: 13.8, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 18, industryTailwindScore: 6,
    promoterHolding: 72.9, promoterPledgePct: 0, promoterTrend: "decreasing",
    institutionalTrend: "stable", technicalScore: 2,
    extras: { geography: "60% Americas", note: "Capco acquisition for BFSI consulting" },
    strengths: ["72.9% Premji family holding (decreasing for philanthropy)", "Capco strengthens BFSI consulting capabilities", "Cheapest tier-1 IT at P/E 20x"],
    watchouts: ["Slowest growth among tier-1: 6.8% rev CAGR", "PEG 2.54 — not cheap given weak growth; promoter trend decreasing"],
    screenerUrl: "https://www.screener.in/company/WIPRO/",
  },
  {
    symbol: "TECHM", yahooSymbol: "TECHM.NS", name: "Tech Mahindra", sector: "it",
    marketCapCr: 115000, pe: 30.4, pb: 4.8, roe: 16.4, roce: 18.8,
    debtToEquity: 0.0, revenueGrowth3yr: 8.2, profitGrowth3yr: 12.4,
    netProfitMargin: 7.8, fcfPositive: true, ocfGtNetProfit: false,
    historicalPEAvg: 20, industryTailwindScore: 7,
    promoterHolding: 35.8, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { focus: "Telecom + manufacturing + BFS", status: "Restructuring under new CEO Mohit Joshi" },
    strengths: ["Telecom vertical recovering: 5G network services demand rising", "PAT margin recovery from 4% to 8% — turnaround in progress", "Mahindra Group cross-sell to manufacturing clients"],
    watchouts: ["PEG 2.45 — expensive relative to 12% growth; P/E 30 vs 10-yr avg 20x", "Lowest NIM in tier-1 at 7.8%; still in restructuring"],
    screenerUrl: "https://www.screener.in/company/TECHM/",
  },

  // ── PHARMA & HEALTHCARE ───────────────────────────────────────────────────────
  {
    symbol: "SUNPHARMA", yahooSymbol: "SUNPHARMA.NS", name: "Sun Pharma", sector: "pharma",
    marketCapCr: 420000, pe: 34.2, pb: 5.8, roe: 18.4, roce: 21.8,
    debtToEquity: 0.1, revenueGrowth3yr: 18.2, profitGrowth3yr: 28.4,
    netProfitMargin: 22.4, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 28, industryTailwindScore: 8,
    promoterHolding: 54.5, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 4,
    extras: { usSpecialty: "Ilumya, Winlevi, Cequa — growing 30%+", geography: "US 35% + India 32%" },
    strengths: ["India's largest pharma: US specialty growing 30%+", "Profit CAGR 28% on revenue CAGR 18% — margin expansion", "NIM 22.4% — best profitability in large-cap pharma", "54.5% promoter holding"],
    watchouts: ["P/E 34 above 10-yr avg 28x — expensive vs own history", "US FDA warning letters have historically caused sharp deratings"],
    screenerUrl: "https://www.screener.in/company/SUNPHARMA/",
  },
  {
    symbol: "DRREDDY", yahooSymbol: "DRREDDY.NS", name: "Dr Reddy's", sector: "pharma",
    marketCapCr: 98000, pe: 22.4, pb: 4.2, roe: 21.8, roce: 26.4,
    debtToEquity: 0.1, revenueGrowth3yr: 16.4, profitGrowth3yr: 22.8,
    netProfitMargin: 18.4, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 18, industryTailwindScore: 8,
    promoterHolding: 26.8, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 3,
    extras: { pipeline: "50+ ANDAs pending US FDA approval", upcoming: "Semaglutide (GLP-1) biosimilar in pipeline" },
    strengths: ["PEG 0.98 — cheapest large pharma on growth-adjusted basis", "ROE 21.8% + ROCE 26.4% — strong capital efficiency", "Semaglutide (GLP-1) biosimilar pipeline — potential blockbuster"],
    watchouts: ["US generics pricing erosion is structural headwind", "P/E 22 above 10-yr avg 18x — some premium"],
    screenerUrl: "https://www.screener.in/company/DRREDDY/",
  },
  {
    symbol: "CIPLA", yahooSymbol: "CIPLA.NS", name: "Cipla", sector: "pharma",
    marketCapCr: 120000, pe: 26.8, pb: 4.4, roe: 17.2, roce: 21.4,
    debtToEquity: 0.1, revenueGrowth3yr: 14.4, profitGrowth3yr: 28.2,
    netProfitMargin: 16.2, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 22, industryTailwindScore: 8,
    promoterHolding: 33.4, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 3,
    extras: { specialty: "Respiratory + oncology injectables", geography: "US 25% + Africa 12%" },
    strengths: ["Profit CAGR 28% — strong margin expansion from US specialty + India branded", "PEG 0.95 — near 1x, attractively priced", "Africa: profitable growing market vs crowded India/US"],
    watchouts: ["P/E 26 above 10-yr avg 22x — slight premium", "US FDA inspections pending at Goa and Kurkumbh plants"],
    screenerUrl: "https://www.screener.in/company/CIPLA/",
  },
  {
    symbol: "DIVISLAB", yahooSymbol: "DIVISLAB.NS", name: "Divi's Laboratories", sector: "pharma",
    marketCapCr: 138000, pe: 58.4, pb: 9.2, roe: 19.8, roce: 24.4,
    debtToEquity: 0.0, revenueGrowth3yr: 8.4, profitGrowth3yr: 32.4,
    netProfitMargin: 30.2, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 48, industryTailwindScore: 8,
    promoterHolding: 51.9, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { model: "API + CRAMS — no brand risk", clients: "Pfizer, Novartis, Roche as anchor clients" },
    strengths: ["Best net margin in pharma at 30% — CRAMS model protects pricing", "Zero debt + 51.9% promoter holding with zero pledge", "China+1 API sourcing shift: global pharma diversifying away from China"],
    watchouts: ["PEG 1.80 — expensive relative to growth; P/E 58 above 10-yr avg 48x", "Revenue growth only 8.4% — CRAMS ramp slower than expected"],
    screenerUrl: "https://www.screener.in/company/DIVISLAB/",
  },
  {
    symbol: "LUPIN", yahooSymbol: "LUPIN.NS", name: "Lupin", sector: "pharma",
    marketCapCr: 92000, pe: 30.4, pb: 4.8, roe: 16.4, roce: 19.8,
    debtToEquity: 0.1, revenueGrowth3yr: 12.4, profitGrowth3yr: 52.4,
    netProfitMargin: 14.2, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 22, industryTailwindScore: 8,
    promoterHolding: 47.0, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 3,
    extras: { pipeline: "40+ US ANDA approvals pending", specialty: "Spiriva, Albuterol — US inhaler portfolio" },
    strengths: ["Profit CAGR 52% — strong recovery; margins normalising", "US respiratory: inhalers and complex generics face less price erosion", "47% promoter holding, zero pledge"],
    watchouts: ["High base effect inflates profit CAGR — verify normalised run-rate", "P/E 30 above 10-yr avg 22x — expensive vs history"],
    screenerUrl: "https://www.screener.in/company/LUPIN/",
  },
  {
    symbol: "TORNTPHARM", yahooSymbol: "TORNTPHARM.NS", name: "Torrent Pharma", sector: "pharma",
    marketCapCr: 82000, pe: 36.4, pb: 8.8, roe: 30.4, roce: 28.8,
    debtToEquity: 0.8, revenueGrowth3yr: 16.4, profitGrowth3yr: 24.2,
    netProfitMargin: 20.4, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 30, industryTailwindScore: 8,
    promoterHolding: 71.2, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { geography: "India 60% + Germany 20% + Brazil 10%", brands: "Shelcal, Nikoran — chronic cardiac/neuro" },
    strengths: ["ROE 30.4% — highest in pharma after turnaround", "German regulated market: stable European revenues", "71.2% promoter holding, zero pledge"],
    watchouts: ["D/E 0.8x elevated vs zero-debt pharma peers", "PEG 1.50 — fair but not cheap; P/E 36 above 10-yr avg 30x"],
    screenerUrl: "https://www.screener.in/company/TORNTPHARM/",
  },
  {
    symbol: "ABBOTINDIA", yahooSymbol: "ABBOTINDIA.NS", name: "Abbott India", sector: "pharma",
    marketCapCr: 52000, pe: 48.4, pb: 14.2, roe: 32.4, roce: 40.2,
    debtToEquity: 0.0, revenueGrowth3yr: 12.4, profitGrowth3yr: 18.4,
    netProfitMargin: 18.8, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 42, industryTailwindScore: 7,
    promoterHolding: 74.9, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { brands: "Thyronorm (#1 thyroid), Duphaston (#1 women's health), Cremaffin, Vertin" },
    strengths: ["ROE 32% + ROCE 40% — highest returns from zero-debt model", "Thyronorm & Duphaston: category leaders with strong pricing power", "74.9% Abbott USA holding — MNC governance + technology pipeline"],
    watchouts: ["PEG 2.63 — expensive relative to 18% growth", "India-only exposure limits global growth optionality"],
    screenerUrl: "https://www.screener.in/company/ABBOTINDIA/",
  },
  {
    symbol: "ALKEM", yahooSymbol: "ALKEM.NS", name: "Alkem Laboratories", sector: "pharma",
    marketCapCr: 42000, pe: 24.2, pb: 3.8, roe: 17.8, roce: 22.4,
    debtToEquity: 0.1, revenueGrowth3yr: 10.4, profitGrowth3yr: 22.8,
    netProfitMargin: 14.4, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 22, industryTailwindScore: 7,
    promoterHolding: 57.2, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { brands: "Pan-D, Taxim-O, Clavam — India top-50 brands", geography: "India 75% + US 15%" },
    strengths: ["PEG 1.06 — near 1x, attractively priced for Indian branded business", "57.2% promoter holding, zero pledge", "Anti-infectives + GI brands: high prescription depth"],
    watchouts: ["Revenue growth 10.4% modest vs peers", "P/E 24 slightly above 10-yr avg 22x"],
    screenerUrl: "https://www.screener.in/company/ALKEM/",
  },

  // ── FMCG & CONSUMER ──────────────────────────────────────────────────────────
  {
    symbol: "HINDUNILVR", yahooSymbol: "HINDUNILVR.NS", name: "Hindustan Unilever", sector: "fmcg",
    marketCapCr: 620000, pe: 52.4, pb: 12.4, roe: 22.4, roce: 38.4,
    debtToEquity: 0.0, revenueGrowth3yr: 7.4, profitGrowth3yr: 8.2,
    netProfitMargin: 18.4, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 55, industryTailwindScore: 7,
    promoterHolding: 61.9, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { brands: "Lux, Surf Excel, Dove, Horlicks — 50+ power brands", distribution: "8M+ retail touch points" },
    strengths: ["P/E 52 below 10-yr avg 55x — HUL rarely this cheap vs own history", "ROCE 38% — best-in-class for an FMCG company", "8 million retail outlets: widest distribution moat in India"],
    watchouts: ["PEG 6.39 — very expensive relative to 8% growth", "Rural recovery slow; volume growth sluggish at 2-4%"],
    screenerUrl: "https://www.screener.in/company/HINDUNILVR/",
  },
  {
    symbol: "ITC", yahooSymbol: "ITC.NS", name: "ITC Ltd", sector: "fmcg",
    marketCapCr: 580000, pe: 26.4, pb: 7.4, roe: 30.2, roce: 38.8,
    debtToEquity: 0.0, revenueGrowth3yr: 11.8, profitGrowth3yr: 17.8,
    netProfitMargin: 35.2, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 22, industryTailwindScore: 8,
    promoterHolding: 0, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 4,
    extras: { segments: "Cigarettes 55% + FMCG 30% + Hotels + Agri + Paperboards", note: "ITC Hotels IPO spinoff upcoming" },
    strengths: ["Best NIM in FMCG at 35% — cigarette monopoly generates exceptional cash", "ROE 30% + ROCE 38% — highest returns in FMCG sector", "PEG 1.48 — cheapest large FMCG on growth-adjusted basis", "FMCG brands growing: Sunfeast, Bingo, Savlon each ₹1,000+ Cr"],
    watchouts: ["P/E 26 above 10-yr avg 22x — moderately expensive vs history", "Cigarette volume risk from regulatory/health trends long-term"],
    screenerUrl: "https://www.screener.in/company/ITC/",
  },
  {
    symbol: "NESTLEIND", yahooSymbol: "NESTLEIND.NS", name: "Nestlé India", sector: "fmcg",
    marketCapCr: 215000, pe: 72.4, pb: 82.4, roe: 84.2, roce: 112.4,
    debtToEquity: 0.0, revenueGrowth3yr: 12.4, profitGrowth3yr: 14.8,
    netProfitMargin: 18.2, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 70, industryTailwindScore: 7,
    promoterHolding: 62.8, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { brands: "Maggi, KitKat, Nescafé, Munch, Milkmaid — category-defining brands" },
    strengths: ["ROE 84% + ROCE 112% — unmatched efficiency from asset-light brand model", "P/E 72 near 10-yr avg 70x — rare fair value for Nestlé", "62.8% Nestlé Switzerland holding — global R&D pipeline"],
    watchouts: ["PEG 4.88 — very expensive relative to 15% growth", "Small innovation pipeline vs HUL/ITC breadth"],
    screenerUrl: "https://www.screener.in/company/NESTLEIND/",
  },
  {
    symbol: "MARICO", yahooSymbol: "MARICO.NS", name: "Marico", sector: "fmcg",
    marketCapCr: 68000, pe: 52.4, pb: 18.2, roe: 38.4, roce: 46.2,
    debtToEquity: 0.0, revenueGrowth3yr: 7.8, profitGrowth3yr: 11.8,
    netProfitMargin: 18.8, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 48, industryTailwindScore: 7,
    promoterHolding: 59.0, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { brands: "Parachute (50% coconut oil share), Saffola, Nihar, Livon" },
    strengths: ["ROE 38% + ROCE 46% — best capital efficiency in FMCG mid-caps", "Parachute: pricing power leader — 50% share in coconut oil", "59% Mariwala family holding, zero pledge"],
    watchouts: ["PEG 4.44 — expensive relative to 12% growth; P/E 52 above 10-yr avg 48x", "Copra price volatility directly compresses gross margins"],
    screenerUrl: "https://www.screener.in/company/MARICO/",
  },
  {
    symbol: "BRITANNIA", yahooSymbol: "BRITANNIA.NS", name: "Britannia Industries", sector: "fmcg",
    marketCapCr: 122000, pe: 52.4, pb: 32.4, roe: 62.4, roce: 78.2,
    debtToEquity: 0.2, revenueGrowth3yr: 7.8, profitGrowth3yr: 14.8,
    netProfitMargin: 12.4, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 45, industryTailwindScore: 7,
    promoterHolding: 50.6, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { brands: "Good Day, Tiger, NutriChoice, 50-50 — India's #1 biscuit brand" },
    strengths: ["ROE 62% + ROCE 78% — among the highest in all of FMCG", "Wadia group: real estate assets provide balance sheet cushion", "P/E 52 above historical 45 but ROE/ROCE quality justifies premium"],
    watchouts: ["PEG 3.54 — expensive relative to 15% growth", "Wheat/sugar cost volatility compresses margins"],
    screenerUrl: "https://www.screener.in/company/BRITANNIA/",
  },
  {
    symbol: "GODREJCP", yahooSymbol: "GODREJCP.NS", name: "Godrej Consumer Products", sector: "fmcg",
    marketCapCr: 110000, pe: 46.4, pb: 8.8, roe: 21.8, roce: 24.4,
    debtToEquity: 0.3, revenueGrowth3yr: 13.4, profitGrowth3yr: 17.8,
    netProfitMargin: 17.8, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 40, industryTailwindScore: 8,
    promoterHolding: 63.0, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 3,
    extras: { brands: "Hit, Good Knight, Cinthol, Godrej No.1", geography: "Africa + Indonesia + LatAm = 45% revenue" },
    strengths: ["Emerging market FMCG: Africa 20% + Indonesia 15% growing 20%+", "Good Knight: 65%+ market share in home insecticides — monopoly position", "PEG 2.61 — lower than HUL/Dabur despite emerging market optionality"],
    watchouts: ["P/E 46 above 10-yr avg 40x — some premium", "Currency risk from 45% international revenue"],
    screenerUrl: "https://www.screener.in/company/GODREJCP/",
  },
  {
    symbol: "COLPAL", yahooSymbol: "COLPAL.NS", name: "Colgate-Palmolive India", sector: "fmcg",
    marketCapCr: 65000, pe: 48.4, pb: 24.4, roe: 74.8, roce: 98.4,
    debtToEquity: 0.0, revenueGrowth3yr: 8.4, profitGrowth3yr: 17.8,
    netProfitMargin: 22.4, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 42, industryTailwindScore: 7,
    promoterHolding: 51.0, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { brands: "Colgate Max Fresh, Strong Teeth, Palmolive", share: "52% India toothpaste market share" },
    strengths: ["ROE 74% + ROCE 98% — most asset-efficient FMCG in India", "52% toothpaste market share — unassailable distribution moat", "NIM 22.4% — premium to all FMCG peers except ITC"],
    watchouts: ["PEG 2.72 — expensive relative to 18% growth", "Innovation limited to oral care — category concentration risk"],
    screenerUrl: "https://www.screener.in/company/COLPAL/",
  },
  {
    symbol: "DABUR", yahooSymbol: "DABUR.NS", name: "Dabur India", sector: "fmcg",
    marketCapCr: 90000, pe: 48.4, pb: 12.4, roe: 22.4, roce: 28.2,
    debtToEquity: 0.0, revenueGrowth3yr: 7.8, profitGrowth3yr: 9.4,
    netProfitMargin: 16.4, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 45, industryTailwindScore: 7,
    promoterHolding: 67.9, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { brands: "Chyawanprash (76% share), Honey (50% share), Real juice, Vatika, Hajmola" },
    strengths: ["Ayurvedic moat: Chyawanprash 76% share + Honey 50% share — no direct challenger", "67.9% Burman family holding, zero pledge", "International: 27% revenue from Middle East/Africa growing 18%"],
    watchouts: ["PEG 5.15 — most expensive FMCG on growth basis; P/E 48 above 10-yr avg 45x", "Urban FMCG slowdown affecting premium portfolio disproportionately"],
    screenerUrl: "https://www.screener.in/company/DABUR/",
  },

  // ── AUTO & EV ────────────────────────────────────────────────────────────────
  {
    symbol: "MARUTI", yahooSymbol: "MARUTI.NS", name: "Maruti Suzuki", sector: "auto",
    marketCapCr: 420000, pe: 24.4, pb: 4.8, roe: 14.2, roce: 18.4,
    debtToEquity: 0.0, revenueGrowth3yr: 22.4, profitGrowth3yr: 42.4,
    netProfitMargin: 7.8, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 22, industryTailwindScore: 8,
    promoterHolding: 56.4, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { volume: "2.3 million cars/yr", share: "41% passenger vehicle market", cng: "30%+ of sales in CNG" },
    strengths: ["41% PV market share — widest distribution, 3,000+ dealerships", "PEG 0.58 — cheapest large-cap auto on growth-adjusted basis", "Zero debt + ₹45,000 Cr cash on balance sheet", "CNG leadership: cost-effective alternate fuel play"],
    watchouts: ["P/E 24 slightly above 10-yr avg 22x", "EV positioning late vs Tata Motors/M&M"],
    screenerUrl: "https://www.screener.in/company/MARUTI/",
  },
  {
    symbol: "M&M", yahooSymbol: "M&M.NS", name: "Mahindra & Mahindra", sector: "auto",
    marketCapCr: 380000, pe: 22.4, pb: 5.8, roe: 17.8, roce: 21.4,
    debtToEquity: 0.1, revenueGrowth3yr: 22.4, profitGrowth3yr: 38.4,
    netProfitMargin: 7.8, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 18, industryTailwindScore: 9,
    promoterHolding: 18.9, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 4,
    extras: { ev: "BE 6e + XEV 9e sold out — ₹25,000 Cr EV capex by FY27", uvShare: "22% UV market share" },
    strengths: ["EV first-mover: BE 6e + XEV 9e strongest booking pipeline outside Tata", "UV dominance: Scorpio N, Thar, XUV 700 all on waitlist", "PEG 0.58 — cheapest large-cap auto on growth basis"],
    watchouts: ["P/E 22 above 10-yr avg 18x — EV premium baked in", "Low promoter holding 18.9% — fully institutional"],
    screenerUrl: "https://www.screener.in/company/M&M/",
  },
  {
    symbol: "TATAMOTORS", yahooSymbol: "TATAMOTORS.NS", name: "Tata Motors", sector: "auto",
    marketCapCr: 340000, pe: 8.4, pb: 2.8, roe: 22.4, roce: 18.4,
    debtToEquity: 1.2, revenueGrowth3yr: 24.4, profitGrowth3yr: 75.0,
    netProfitMargin: 6.4, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 12, industryTailwindScore: 8,
    promoterHolding: 43.0, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { brands: "Jaguar Land Rover (75%+ revenue) + Tata EV leader (Nexon, Punch)", evShare: "65%+ India BEV market" },
    strengths: ["JLR profitability peak: operating margin 15%+ vs 2-3% during loss years", "India EV leader: 65%+ BEV market share with Nexon EV + Punch EV", "P/E 8.4x below 10-yr avg 12x — cheapest large auto vs own history"],
    watchouts: ["D/E 1.2x from JLR debt absorption", "Luxury auto demand cycle risk from UK/EU slowdown"],
    screenerUrl: "https://www.screener.in/company/TATAMOTORS/",
  },
  {
    symbol: "BAJAJ-AUTO", yahooSymbol: "BAJAJ-AUTO.NS", name: "Bajaj Auto", sector: "auto",
    marketCapCr: 245000, pe: 28.4, pb: 8.8, roe: 28.2, roce: 32.4,
    debtToEquity: 0.0, revenueGrowth3yr: 18.4, profitGrowth3yr: 22.4,
    netProfitMargin: 18.4, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 24, industryTailwindScore: 8,
    promoterHolding: 54.3, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { brands: "Pulsar, Dominar, Chetak EV, KTM stake 48%", export: "50%+ of two-wheeler exports from India" },
    strengths: ["ROE 28% + ROCE 32% — best capital efficiency in two-wheelers", "18.4% NIM — highest in auto sector (beats most IT companies)", "KTM 48% stake: European premium motorcycle at negligible cost", "Zero debt + ₹20,000+ Cr cash"],
    watchouts: ["PEG 1.27 — fair; P/E 28 above 10-yr avg 24x", "Chetak EV losing share to Ola/Ather"],
    screenerUrl: "https://www.screener.in/company/BAJAJ-AUTO/",
  },
  {
    symbol: "EICHERMOT", yahooSymbol: "EICHERMOT.NS", name: "Eicher Motors", sector: "auto",
    marketCapCr: 148000, pe: 30.4, pb: 8.4, roe: 28.4, roce: 32.8,
    debtToEquity: 0.0, revenueGrowth3yr: 18.4, profitGrowth3yr: 22.4,
    netProfitMargin: 24.2, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 26, industryTailwindScore: 8,
    promoterHolding: 49.3, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { brands: "Royal Enfield — 90%+ share in 350-750cc", jv: "VECV commercial vehicles JV with Volvo" },
    strengths: ["Royal Enfield: 90%+ market share in 350-750cc — near-zero competition", "Best NIM in auto: 24.2% — premium pricing power from brand monopoly", "Zero debt + ₹12,000 Cr cash — capacity for global RE expansion"],
    watchouts: ["P/E 30 above 10-yr avg 26x — moderate premium", "Competition from Triumph/Honda 600cc entering India"],
    screenerUrl: "https://www.screener.in/company/EICHERMOT/",
  },
  {
    symbol: "TVSMOTOR", yahooSymbol: "TVSMOTOR.NS", name: "TVS Motor Company", sector: "auto",
    marketCapCr: 182000, pe: 52.4, pb: 16.4, roe: 32.4, roce: 38.4,
    debtToEquity: 0.5, revenueGrowth3yr: 24.4, profitGrowth3yr: 42.4,
    netProfitMargin: 6.8, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 36, industryTailwindScore: 8,
    promoterHolding: 57.4, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 4,
    extras: { brands: "Apache, Jupiter, iQube EV — premium 2W + EV", evPosition: "#2 EV scooter brand by sales" },
    strengths: ["Fastest growing large two-wheeler: Rev CAGR 24%, PAT CAGR 42%", "ROE 32% + ROCE 38% — best among 2W OEMs", "iQube EV: early mover, #2 in premium electric scooters"],
    watchouts: ["PEG 1.24 — fair; P/E 52 well above 10-yr avg 36x — expensive vs history", "D/E 0.5x from BMW Motorrad JV capex"],
    screenerUrl: "https://www.screener.in/company/TVSMOTOR/",
  },
  {
    symbol: "HEROMOTOCO", yahooSymbol: "HEROMOTOCO.NS", name: "Hero MotoCorp", sector: "auto",
    marketCapCr: 82000, pe: 20.4, pb: 5.8, roe: 28.4, roce: 34.2,
    debtToEquity: 0.0, revenueGrowth3yr: 11.8, profitGrowth3yr: 17.8,
    netProfitMargin: 11.8, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 18, industryTailwindScore: 7,
    promoterHolding: 34.6, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { volume: "6+ million units/yr", share: "35% two-wheeler market", note: "Splendor — India's best-selling vehicle" },
    strengths: ["ROE 28% + ROCE 34% — best capital efficiency in mass-market 2W", "PEG 1.15 — near 1x fair value", "Zero debt; strong rural recovery driving commuter segment"],
    watchouts: ["P/E 20 slightly above 10-yr avg 18x", "EV transition slow — Vida losing to Ola/TVS"],
    screenerUrl: "https://www.screener.in/company/HEROMOTOCO/",
  },
  {
    symbol: "MOTHERSUMI", yahooSymbol: "MOTHERSUMI.NS", name: "Samvardhana Motherson", sector: "auto",
    marketCapCr: 92000, pe: 34.4, pb: 5.4, roe: 14.8, roce: 11.8,
    debtToEquity: 1.5, revenueGrowth3yr: 28.4, profitGrowth3yr: 58.4,
    netProfitMargin: 3.4, fcfPositive: true, ocfGtNetProfit: false,
    historicalPEAvg: 28, industryTailwindScore: 8,
    promoterHolding: 58.8, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { clients: "BMW, Mercedes, VW, Stellantis — 35+ global OEMs", geography: "60% revenue outside India" },
    strengths: ["Global scale: 35+ OEM clients, ₹1 lakh crore+ revenue", "Profit CAGR 58% — EV module + acquisition integration gains", "58.8% promoter holding — focused M&A execution"],
    watchouts: ["D/E 1.5x from multiple acquisitions — integration risk", "NIM 3.4% wafer thin; quality lower than OEM peers"],
    screenerUrl: "https://www.screener.in/company/MOTHERSUMI/",
  },

  // ── POWER & ENERGY ────────────────────────────────────────────────────────────
  {
    symbol: "NTPC", yahooSymbol: "NTPC.NS", name: "NTPC Ltd", sector: "power",
    marketCapCr: 352000, pe: 18.4, pb: 2.4, roe: 14.2, roce: 10.4,
    debtToEquity: 1.6, revenueGrowth3yr: 14.4, profitGrowth3yr: 12.4,
    netProfitMargin: 14.4, fcfPositive: false, ocfGtNetProfit: true,
    historicalPEAvg: 14, industryTailwindScore: 9,
    promoterHolding: 51.1, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 4,
    extras: { capacity: "75 GW operational + 25 GW under construction", renewable: "60 GW renewable target by FY32" },
    strengths: ["India's largest utility: 75 GW capacity", "60 GW renewable target — direct beneficiary of PM Surya Ghar + grid expansion", "Guaranteed regulated returns — low earnings risk"],
    watchouts: ["P/E 18 above 10-yr avg 14x — premium vs own history", "D/E 1.6x from capex cycle; FCF negative"],
    screenerUrl: "https://www.screener.in/company/NTPC/",
  },
  {
    symbol: "POWERGRID", yahooSymbol: "POWERGRID.NS", name: "Power Grid Corp.", sector: "power",
    marketCapCr: 282000, pe: 20.4, pb: 3.4, roe: 22.4, roce: 12.4,
    debtToEquity: 1.8, revenueGrowth3yr: 8.4, profitGrowth3yr: 10.4,
    netProfitMargin: 38.4, fcfPositive: false, ocfGtNetProfit: true,
    historicalPEAvg: 16, industryTailwindScore: 8,
    promoterHolding: 51.3, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { network: "175,000+ circuit km HV transmission", dividendYield: "5%+ consistent" },
    strengths: ["NIM 38.4% — best in power sector from regulated transmission model", "ROE 22.4% exceptional for a regulated utility", "5%+ dividend yield — income + growth combination"],
    watchouts: ["P/E 20 above 10-yr avg 16x — expensive vs own history", "Revenue growth 8% capped by regulated model"],
    screenerUrl: "https://www.screener.in/company/POWERGRID/",
  },
  {
    symbol: "ADANIPOWER", yahooSymbol: "ADANIPOWER.NS", name: "Adani Power", sector: "power",
    marketCapCr: 248000, pe: 14.8, pb: 3.2, roe: 42.4, roce: 18.4,
    debtToEquity: 2.8, revenueGrowth3yr: 32.4, profitGrowth3yr: 68.4,
    netProfitMargin: 24.2, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 12, industryTailwindScore: 9,
    promoterHolding: 74.9, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { capacity: "17 GW thermal — largest private thermal utility", ppa: "Long-term PPAs with state discoms" },
    strengths: ["ROE 42.4% — highest in power from operational leverage on large fleet", "Revenue CAGR 32% + PAT CAGR 68% — fastest growing large power utility", "Long-term PPA coverage: revenue predictable 15+ years"],
    watchouts: ["D/E 2.8x — highly leveraged; Adani Group concentration risk", "Thermal power long-term coal availability + regulation risk"],
    screenerUrl: "https://www.screener.in/company/ADANIPOWER/",
  },
  {
    symbol: "TATAPOWER", yahooSymbol: "TATAPOWER.NS", name: "Tata Power", sector: "power",
    marketCapCr: 152000, pe: 34.4, pb: 4.8, roe: 14.2, roce: 8.4,
    debtToEquity: 2.2, revenueGrowth3yr: 22.4, profitGrowth3yr: 28.4,
    netProfitMargin: 6.8, fcfPositive: false, ocfGtNetProfit: false,
    historicalPEAvg: 28, industryTailwindScore: 9,
    promoterHolding: 46.9, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 4,
    extras: { renewable: "10 GW renewable target; solar EPC + rooftop", ev: "4,000+ EV chargers — India's largest network" },
    strengths: ["Renewables transition leader: 3.5 GW + 6.5 GW pipeline", "EV charging network: 4,000+ chargers — sticky infrastructure moat", "Revenue CAGR 22% across utility-scale + solar EPC + rooftop combined"],
    watchouts: ["PEG 1.21 — fair; P/E 34 above 10-yr avg 28x; D/E 2.2x from capex", "FCF negative — heavy investment phase; NIM 6.8% thin"],
    screenerUrl: "https://www.screener.in/company/TATAPOWER/",
  },
  {
    symbol: "JSWENERGY", yahooSymbol: "JSWENERGY.NS", name: "JSW Energy", sector: "power",
    marketCapCr: 92000, pe: 28.4, pb: 3.4, roe: 14.2, roce: 12.4,
    debtToEquity: 1.8, revenueGrowth3yr: 18.4, profitGrowth3yr: 22.4,
    netProfitMargin: 22.4, fcfPositive: false, ocfGtNetProfit: true,
    historicalPEAvg: 22, industryTailwindScore: 9,
    promoterHolding: 69.0, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 3,
    extras: { capacity: "9 GW + 7 GW under construction = 16 GW target", storage: "Battery + pumped hydro ambition" },
    strengths: ["10 GW renewable ambition backed by JSW Group balance sheet", "NIM 22.4% — strong profitability for a growing utility", "69% JSW family holding, zero pledge"],
    watchouts: ["PEG 1.27 — fair; P/E 28 above 10-yr avg 22x", "D/E 1.8x from capex-heavy renewable buildout"],
    screenerUrl: "https://www.screener.in/company/JSWENERGY/",
  },
  {
    symbol: "TORNTPOWER", yahooSymbol: "TORNTPOWER.NS", name: "Torrent Power", sector: "power",
    marketCapCr: 52000, pe: 22.4, pb: 3.8, roe: 18.2, roce: 14.4,
    debtToEquity: 1.2, revenueGrowth3yr: 18.4, profitGrowth3yr: 28.4,
    netProfitMargin: 12.4, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 18, industryTailwindScore: 8,
    promoterHolding: 65.0, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { model: "Distribution license + own generation = integrated utility", geography: "Gujarat discom + renewables" },
    strengths: ["Integrated utility: license area distribution + generation = price + volume control", "ROE 18.2% — highest among listed discoms", "PEG 0.79 — cheapest utility on growth-adjusted basis", "65% Torrent Group holding, zero pledge"],
    watchouts: ["P/E 22 above 10-yr avg 18x — moderate premium", "Geographic concentration in Gujarat"],
    screenerUrl: "https://www.screener.in/company/TORNTPOWER/",
  },
  {
    symbol: "NHPC", yahooSymbol: "NHPC.NS", name: "NHPC Ltd", sector: "power",
    marketCapCr: 88000, pe: 18.4, pb: 2.4, roe: 12.4, roce: 8.4,
    debtToEquity: 0.8, revenueGrowth3yr: 8.4, profitGrowth3yr: 8.2,
    netProfitMargin: 38.4, fcfPositive: true, ocfGtNetProfit: true,
    historicalPEAvg: 14, industryTailwindScore: 8,
    promoterHolding: 70.9, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "stable", technicalScore: 3,
    extras: { capacity: "7,071 MW hydro + 1,600 MW under construction", dividendYield: "4%+ consistent" },
    strengths: ["NIM 38.4% — highest in power (hydro = near-zero fuel cost)", "FCF strongly positive — operational hydro is a cash cow", "4%+ dividend yield; D/E 0.8x — most conservative in power"],
    watchouts: ["PEG 2.24 — expensive relative to 8% growth; P/E 18 above 10-yr avg 14x", "Low growth — new hydro projects limited by geography + approvals"],
    screenerUrl: "https://www.screener.in/company/NHPC/",
  },
  {
    symbol: "SJVN", yahooSymbol: "SJVN.NS", name: "SJVN Ltd", sector: "power",
    marketCapCr: 58000, pe: 22.4, pb: 3.4, roe: 12.2, roce: 8.4,
    debtToEquity: 1.2, revenueGrowth3yr: 12.4, profitGrowth3yr: 14.4,
    netProfitMargin: 38.8, fcfPositive: false, ocfGtNetProfit: true,
    historicalPEAvg: 18, industryTailwindScore: 9,
    promoterHolding: 74.9, promoterPledgePct: 0, promoterTrend: "stable",
    institutionalTrend: "increasing", technicalScore: 3,
    extras: { capacity: "2,016 MW operational + 25 GW order book pipeline", model: "Solar + wind + hydro diversification" },
    strengths: ["25 GW order book vs 2 GW current — 10+ year growth visibility", "NIM 38.8% from operational hydro assets", "74.9% government holding — low collection risk from state utilities"],
    watchouts: ["P/E 22 above 10-yr avg 18x — premium; D/E 1.2x from capex", "Execution risk: converting 25 GW pipeline to commissioned capacity"],
    screenerUrl: "https://www.screener.in/company/SJVN/",
  },
];

// ─── SCORE COMPUTATION + RANK ASSIGNMENT ─────────────────────────────────────

function buildStocks(raw: RawStock[]): StockMetrics[] {
  const withScores = raw.map((s) => {
    const bd = computeScore(s);
    const peg = s.pe / Math.max(1, s.profitGrowth3yr);
    return { ...s, pegRatio: parseFloat(peg.toFixed(2)), score: bd.total, scoreBreakdown: bd, rank: 0 };
  });

  // Assign ranks within each sector (sorted by score desc)
  const bySector: Record<string, typeof withScores> = {};
  for (const s of withScores) {
    if (!bySector[s.sector]) bySector[s.sector] = [];
    bySector[s.sector].push(s);
  }
  const ranked: StockMetrics[] = [];
  for (const arr of Object.values(bySector)) {
    arr.sort((a, b) => b.score - a.score);
    arr.forEach((s, i) => { s.rank = i + 1; });
    ranked.push(...arr);
  }
  return ranked;
}

const STOCKS = buildStocks(RAW);

export function getSectorStocks(sector: SectorKey): StockMetrics[] {
  return STOCKS.filter((s) => s.sector === sector).sort((a, b) => a.rank - b.rank);
}

export function getSector(key: SectorKey): Sector | undefined {
  return SECTORS.find((s) => s.key === key);
}

export function getAllSectors(): Sector[] {
  return SECTORS;
}
