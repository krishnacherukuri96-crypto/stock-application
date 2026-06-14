// Union Budget 2026-27 (presented February 1, 2026 by FM Nirmala Sitharaman)
// Sources: indiabudget.gov.in, PRS India Budget Analysis 2026-27, PIB press release PRID=2221458
// All figures in ₹ lakh crore (1 lakh crore = 1 trillion INR)

export interface BudgetSummary {
  fy: string;
  presentedOn: string;
  totalExpenditure: number;
  revenueExpenditure: number;
  capitalExpenditure: number;
  totalReceipts: number;
  netTaxRevenueCentre: number;
  nonDebtReceipts: number;
  grossBorrowings: number;
  netBorrowings: number;
  fiscalDeficit: number;
  fiscalDeficitPct: number;
  revenueDeficitPct: number;
  gdpEstimate: number;
}

export interface BudgetAllocation {
  ministry: string;
  amount: number;
  pct: number;
  color: string;
  capex?: number;
  category: "interest" | "defence" | "infrastructure" | "social" | "subsidy" | "other";
}

export interface RevenueSource {
  source: string;
  amount: number;
  pct: number;
  color: string;
  type: "tax" | "non-tax" | "borrowing";
}

export interface RupeeBreakdown {
  label: string;
  paisa: number;
  color: string;
  side: "receipt" | "expenditure";
}

export const BUDGET_SUMMARY: BudgetSummary = {
  fy: "2026-27",
  presentedOn: "February 1, 2026",
  totalExpenditure: 53.47,           // ₹53,47,315 crore — PIB 2026-27
  revenueExpenditure: 41.25,         // derived
  capitalExpenditure: 12.22,         // ₹12,21,821 crore — up 11.5% YoY
  totalReceipts: 53.47,
  netTaxRevenueCentre: 28.67,        // ₹28,66,922 crore — PRS analysis
  nonDebtReceipts: 36.52,            // ₹36,51,547 crore — PRS analysis
  grossBorrowings: 17.20,            // ₹17.2 lakh crore gross market borrowings
  netBorrowings: 11.70,              // ₹11.7 lakh crore net market borrowings
  fiscalDeficit: 16.96,              // ₹16,95,768 crore
  fiscalDeficitPct: 4.3,             // % of GDP — down from 4.4% in RE 2025-26
  revenueDeficitPct: 1.3,            // estimated
  gdpEstimate: 394.4,                // derived from fiscal deficit: 16.96 / 0.043
};

export const EXPENDITURE_ALLOCATIONS: BudgetAllocation[] = [
  {
    ministry: "Interest Payments",
    amount: 10.69,
    pct: 20.0,
    color: "#ef4444",
    category: "interest",
  },
  {
    ministry: "Defence",
    amount: 7.85,                    // ₹7,84,678 crore — DD News / PIB (record high)
    pct: 14.7,
    color: "#8b5cf6",
    capex: 2.19,                     // ₹2.19 lakh crore capex — up 24% YoY
    category: "defence",
  },
  {
    ministry: "Road Transport & Highways",
    amount: 3.10,
    pct: 5.8,
    color: "#f97316",
    capex: 2.82,
    category: "infrastructure",
  },
  {
    ministry: "Railways",
    amount: 2.78,
    pct: 5.2,
    color: "#3b82f6",
    capex: 2.74,
    category: "infrastructure",
  },
  {
    ministry: "Subsidies (Food, Fertilizer, Fuel)",
    amount: 4.55,                    // ₹4,54,773 crore — PRS
    pct: 8.5,
    color: "#f59e0b",
    category: "subsidy",
  },
  {
    ministry: "Rural Development",
    amount: 2.73,
    pct: 5.1,
    color: "#22c55e",
    category: "social",
  },
  {
    ministry: "Home Affairs",
    amount: 2.55,
    pct: 4.8,
    color: "#64748b",
    category: "other",
  },
  {
    ministry: "Agriculture & Farmers Welfare",
    amount: 1.63,
    pct: 3.0,
    color: "#84cc16",
    category: "social",
  },
  {
    ministry: "Education",
    amount: 1.39,                    // includes ₹25,000 cr for NEP implementation
    pct: 2.6,
    color: "#06b6d4",
    category: "social",
  },
  {
    ministry: "Health & Family Welfare",
    amount: 1.05,
    pct: 2.0,
    color: "#ec4899",
    category: "social",
  },
  {
    ministry: "Energy",
    amount: 1.09,
    pct: 2.0,
    color: "#eab308",
    category: "infrastructure",
  },
  {
    ministry: "Urban Development",
    amount: 0.86,
    pct: 1.6,
    color: "#14b8a6",
    category: "infrastructure",
  },
  {
    ministry: "Others",
    amount: 13.20,
    pct: 24.7,
    color: "#d1d5db",
    category: "other",
  },
];

export const REVENUE_SOURCES: RevenueSource[] = [
  {
    source: "Borrowings & Other Liabilities",
    amount: 16.96,
    pct: 31.7,
    color: "#fca5a5",
    type: "borrowing",
  },
  {
    source: "Income Tax",
    amount: 11.23,                   // 21% of total
    pct: 21.0,
    color: "#6366f1",
    type: "tax",
  },
  {
    source: "Corporate Tax",
    amount: 9.62,                    // 18% of total
    pct: 18.0,
    color: "#8b5cf6",
    type: "tax",
  },
  {
    source: "GST (Centre's share)",
    amount: 8.02,                    // 15% of total
    pct: 15.0,
    color: "#a78bfa",
    type: "tax",
  },
  {
    source: "Non-Tax Revenue",
    amount: 5.35,                    // 10% of total
    pct: 10.0,
    color: "#93c5fd",
    type: "non-tax",
  },
  {
    source: "Union Excise Duties",
    amount: 3.21,                    // 6% of total
    pct: 6.0,
    color: "#c4b5fd",
    type: "tax",
  },
  {
    source: "Customs",
    amount: 2.14,                    // 4% of total
    pct: 4.0,
    color: "#7dd3fc",
    type: "tax",
  },
];

// Official rupee breakdown (paise per ₹1) — from Budget Highlights document
export const RUPEE_RECEIPT: RupeeBreakdown[] = [
  { label: "Borrowings & Liabilities", paisa: 32, color: "#fca5a5", side: "receipt" },
  { label: "Income Tax", paisa: 21, color: "#6366f1", side: "receipt" },
  { label: "Corporate Tax", paisa: 18, color: "#8b5cf6", side: "receipt" },
  { label: "GST (Centre's share)", paisa: 15, color: "#a78bfa", side: "receipt" },
  { label: "Non-Tax Revenue", paisa: 6, color: "#93c5fd", side: "receipt" },
  { label: "Union Excise Duties", paisa: 4, color: "#c4b5fd", side: "receipt" },
  { label: "Customs", paisa: 2, color: "#7dd3fc", side: "receipt" },
  { label: "Non-Debt Capital", paisa: 2, color: "#bae6fd", side: "receipt" },
];

export const RUPEE_EXPENDITURE: RupeeBreakdown[] = [
  { label: "Interest Payments", paisa: 20, color: "#ef4444", side: "expenditure" },
  { label: "States' Share & Devolution", paisa: 21, color: "#f97316", side: "expenditure" },
  { label: "Defence", paisa: 15, color: "#8b5cf6", side: "expenditure" },
  { label: "Subsidies", paisa: 8, color: "#f59e0b", side: "expenditure" },
  { label: "Roads & Railways", paisa: 11, color: "#3b82f6", side: "expenditure" },
  { label: "Rural & Agriculture", paisa: 8, color: "#22c55e", side: "expenditure" },
  { label: "Education & Health", paisa: 5, color: "#ec4899", side: "expenditure" },
  { label: "Others", paisa: 12, color: "#d1d5db", side: "expenditure" },
];

// Capex trend — 5-year build-up
export const CAPEX_TREND = [
  { fy: "2020-21", capex: 4.39, pctGDP: 2.15 },
  { fy: "2021-22", capex: 5.54, pctGDP: 2.52 },
  { fy: "2022-23", capex: 7.50, pctGDP: 2.90 },
  { fy: "2023-24", capex: 9.48, pctGDP: 3.18 },
  { fy: "2024-25", capex: 10.18, pctGDP: 3.12 },  // RE
  { fy: "2025-26", capex: 11.21, pctGDP: 3.15 },  // RE
  { fy: "2026-27", capex: 12.22, pctGDP: 3.10 },  // BE
];
