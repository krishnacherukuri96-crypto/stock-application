// Dynamic metric explanation engine.
// Every function takes actual numbers → returns plain-English insight.
// No hardcoded strings — the text changes based on the stock's data.

export type Rating = "excellent" | "good" | "fair" | "weak" | "danger";

export interface BenchmarkRow {
  range: string;
  label: string;
  isActive: boolean;
}

export interface Explanation {
  metric: string;
  value: string;
  rating: Rating;
  badgeText: string;     // e.g. "🟢 CHEAP"
  summary: string;       // one line shown even when collapsed
  whatItMeans: string;   // plain English definition
  analogy: string;       // simple real-world analogy
  benchmark: BenchmarkRow[];
  impact: string;        // why this matters for your investment decision
}

function badge(r: Rating, label: string): string {
  const dot = r === "excellent" || r === "good" ? "🟢" : r === "fair" ? "🟡" : "🔴";
  return `${dot} ${label}`;
}

// ─── P/E RATIO ───────────────────────────────────────────────────────────────
export function explainPE(pe: number, historicalAvg: number): Explanation {
  const ratio = historicalAvg > 0 ? pe / historicalAvg : 1;
  const pct = Math.round(Math.abs((ratio - 1) * 100));
  const cheaper = ratio < 1;

  let rating: Rating;
  let bl: string;
  if      (ratio < 0.7)  { rating = "excellent"; bl = "VERY CHEAP"; }
  else if (ratio < 0.85) { rating = "good";      bl = "CHEAP"; }
  else if (ratio <= 1.15){ rating = "fair";       bl = "FAIR VALUE"; }
  else if (ratio <= 1.5) { rating = "weak";       bl = "EXPENSIVE"; }
  else                   { rating = "danger";     bl = "VERY EXPENSIVE"; }

  const summary = historicalAvg > 0
    ? `${pct}% ${cheaper ? "below" : "above"} its 10-year average of ${historicalAvg}x — ${cheaper ? "cheaper than usual" : "pricier than usual"}`
    : `Investors pay ₹${pe} for every ₹1 this company earns annually`;

  return {
    metric: "P/E Ratio", value: `${pe}x`, rating, badgeText: badge(rating, bl), summary,
    whatItMeans: `The P/E ratio tells you how much the market is paying for each rupee of annual profit. A P/E of ${pe}x means investors are willing to pay ₹${pe} for every ₹1 this company earns. The key question is: is that cheap or expensive? The best way to answer that is to compare to what investors normally pay for this specific stock over its history (${historicalAvg}x over 10 years).`,
    analogy: `Imagine a small shop earns ₹1 lakh profit per year. Someone offers to buy it for ₹${pe} lakh. That's a P/E of ${pe}. Is that fair? You'd want to know: "Has this shop usually sold for ₹${historicalAvg} lakh in the past?" If yes, buying at ₹${pe} lakh is ${cheaper ? "a bargain." : "paying a premium."}`,
    benchmark: [
      { range: "Below 0.7× historical avg", label: "Very Cheap — rare, historically strong entry", isActive: ratio < 0.7 },
      { range: "0.7× – 0.85×",              label: "Cheap — buying at a meaningful discount",    isActive: ratio >= 0.7 && ratio < 0.85 },
      { range: "0.85× – 1.15×",             label: "Fair Value — paying what you normally do",   isActive: ratio >= 0.85 && ratio <= 1.15 },
      { range: "1.15× – 1.5×",              label: "Expensive — paying a premium over history",  isActive: ratio > 1.15 && ratio <= 1.5 },
      { range: "Above 1.5×",                label: "Very Expensive — good news already priced in", isActive: ratio > 1.5 },
    ],
    impact: cheaper
      ? `You're buying at ${pct}% below what investors have historically paid. This gives you a double opportunity: profit from earnings growth AND from the stock re-rating back to its normal ${historicalAvg}x valuation. This "margin of safety" also reduces downside risk.`
      : ratio > 1.4
      ? `Trading ${pct}% above its historical norm. Even if the company delivers strong results, the stock may not move much — the good news is already "priced in." There's little margin of safety. Look for a pullback before buying.`
      : `At fair historical valuation. Stock should broadly track earnings growth from here — no significant tailwind or headwind from valuation.`,
  };
}

// ─── PEG RATIO ───────────────────────────────────────────────────────────────
export function explainPEG(peg: number, pe: number, profitGrowth: number): Explanation {
  let rating: Rating;
  let bl: string;
  if      (peg < 0.5)  { rating = "excellent"; bl = "VERY ATTRACTIVE"; }
  else if (peg < 1.0)  { rating = "good";      bl = "ATTRACTIVE"; }
  else if (peg < 1.5)  { rating = "fair";       bl = "FAIR"; }
  else if (peg < 2.0)  { rating = "weak";       bl = "EXPENSIVE"; }
  else                 { rating = "danger";     bl = "VERY EXPENSIVE"; }

  return {
    metric: "PEG Ratio", value: peg.toFixed(2), rating, badgeText: badge(rating, bl),
    summary: `P/E ${pe}x ÷ Profit Growth ${profitGrowth}% = PEG ${peg.toFixed(2)} — ${peg < 1 ? "paying less than ₹1 per 1% of growth" : peg < 1.5 ? "paying fairly for growth" : "paying too much for growth"}`,
    whatItMeans: `P/E alone can mislead. A company growing at ${profitGrowth}% deserves a higher P/E than one growing at 5%. PEG fixes this by dividing P/E by the profit growth rate. A PEG of ${peg.toFixed(2)} means you're paying ₹${pe} of valuation for ${profitGrowth}% of annual growth.`,
    analogy: `Two shops both cost ₹${pe} lakh (same P/E). Shop A grows profits at ${profitGrowth}%/yr. Shop B grows at 5%/yr. Shop A is actually much cheaper because you're getting far more growth for the same price. PEG captures this — Shop A's PEG is ${peg.toFixed(2)}, Shop B's is ${(pe / 5).toFixed(1)}. Lower PEG = better deal.`,
    benchmark: [
      { range: "Below 0.5",  label: "Very Attractive — high growth for very low price (rare)", isActive: peg < 0.5 },
      { range: "0.5 – 1.0",  label: "Attractive — Growth at Reasonable Price (GARP zone)",    isActive: peg >= 0.5 && peg < 1.0 },
      { range: "1.0 – 1.5",  label: "Fair — paying normal price for growth",                   isActive: peg >= 1.0 && peg < 1.5 },
      { range: "1.5 – 2.0",  label: "Expensive — growth must sustain to justify",              isActive: peg >= 1.5 && peg < 2.0 },
      { range: "Above 2.0",  label: "Very Expensive — growth must accelerate, not just sustain", isActive: peg >= 2.0 },
    ],
    impact: peg < 1
      ? `PEG below 1 is the classic "Growth at Reasonable Price" signal — coined by legendary investor Peter Lynch. You're paying less than ₹1 of valuation for every 1% of growth you receive. Historically, stocks with PEG < 1 tend to outperform.`
      : peg < 1.5
      ? `Fair zone. You're paying a reasonable but not cheap price for the growth on offer. Not a screaming buy, but not expensive either. Growth delivery will drive returns.`
      : `PEG above 1.5 — you're paying a significant premium for growth. The company must not only maintain current growth but ideally accelerate it. Any growth disappointment will be punished hard.`,
  };
}

// ─── ROE ─────────────────────────────────────────────────────────────────────
export function explainROE(roe: number): Explanation {
  let rating: Rating;
  let bl: string;
  if      (roe >= 25) { rating = "excellent"; bl = "EXCELLENT"; }
  else if (roe >= 18) { rating = "good";      bl = "STRONG"; }
  else if (roe >= 12) { rating = "fair";      bl = "GOOD"; }
  else if (roe >= 8)  { rating = "weak";      bl = "BELOW AVERAGE"; }
  else                { rating = "danger";    bl = "WEAK"; }

  return {
    metric: "Return on Equity (ROE)", value: `${roe}%`, rating, badgeText: badge(rating, bl),
    summary: `Generates ₹${roe} of annual profit for every ₹100 of shareholder capital invested`,
    whatItMeans: `ROE measures how efficiently management uses the money shareholders have invested (equity). An ROE of ${roe}% means: for every ₹100 shareholders have invested in this business, the company generates ₹${roe} of profit every year. It answers: "Is management making good use of my money?"`,
    analogy: `You invest ₹1 lakh in a friend's business. After one year, they return ₹${roe.toFixed(0)} thousand as profit — a ${roe}% ROE. Now compare: Bank FD gives you ~7%. If a company can consistently deliver ${roe}% ROE, it is ${roe > 15 ? "destroying the returns of most alternatives." : roe > 7 ? "beating most alternatives." : "barely beating a bank FD."}`,
    benchmark: [
      { range: "< 8%",    label: "Weak — barely better than a bank deposit",    isActive: roe < 8 },
      { range: "8% – 12%", label: "Below Average — decent but not impressive",  isActive: roe >= 8 && roe < 12 },
      { range: "12% – 18%", label: "Good — solid, above-average capital use",   isActive: roe >= 12 && roe < 18 },
      { range: "18% – 25%", label: "Strong — highly efficient, wealth-creating", isActive: roe >= 18 && roe < 25 },
      { range: "> 25%",   label: "Excellent — best-in-class, like HUL, Nestlé", isActive: roe >= 25 },
    ],
    impact: roe >= 20
      ? `High ROE means management is compounding shareholder wealth efficiently. Companies sustaining 20%+ ROE for many years tend to be the best long-term investments — they can reinvest profits at high rates without needing external capital.`
      : roe >= 12
      ? `Good ROE — above average capital efficiency. Keep an eye on the trend: is ROE improving or declining? An improving trend is more valuable than a static high number.`
      : `Below-average ROE. Dig deeper: is it because margins are thin, asset turnover is slow, or leverage is low? Low ROE at reasonable valuation can still work if it's on an improving trajectory.`,
  };
}

// ─── ROCE ────────────────────────────────────────────────────────────────────
export function explainROCE(roce: number): Explanation {
  let rating: Rating;
  let bl: string;
  if      (roce >= 30) { rating = "excellent"; bl = "EXCEPTIONAL"; }
  else if (roce >= 20) { rating = "good";      bl = "STRONG"; }
  else if (roce >= 15) { rating = "fair";      bl = "GOOD"; }
  else if (roce >= 10) { rating = "weak";      bl = "AVERAGE"; }
  else                 { rating = "danger";    bl = "WEAK"; }

  return {
    metric: "Return on Capital Employed (ROCE)", value: `${roce}%`, rating, badgeText: badge(rating, bl),
    summary: `Earns ₹${roce} profit for every ₹100 of total capital deployed (debt + equity)`,
    whatItMeans: `ROCE is the purest measure of business profitability — it can't be manipulated by taking on debt (unlike ROE). It measures profit as a percentage of ALL capital used in the business. A ROCE of ${roce}% means the business earns ₹${roce} for every ₹100 of total capital (your equity + borrowed money). ROCE should always be higher than the cost of borrowing — if a company borrows at 9% and earns 12% ROCE, it creates value. If ROCE < interest rate, it destroys value.`,
    analogy: `You invest ₹60 lakh and borrow ₹40 lakh to buy a property (total ₹100 lakh). The property earns ₹${roce} lakh rent per year. ROCE = ${roce}%. If your loan interest is 9%, you're earning ₹${roce - 9 > 0 ? `₹${roce - 9} more than you're paying — great!` : `less than your interest cost — bad!`}`,
    benchmark: [
      { range: "< 10%",    label: "Weak — barely covers cost of capital",          isActive: roce < 10 },
      { range: "10% – 15%", label: "Average — adequate for low-risk industries",   isActive: roce >= 10 && roce < 15 },
      { range: "15% – 20%", label: "Good — above-average capital efficiency",      isActive: roce >= 15 && roce < 20 },
      { range: "20% – 30%", label: "Strong — excellent, world above cost of capital", isActive: roce >= 20 && roce < 30 },
      { range: "> 30%",   label: "Exceptional — rare; high-moat businesses only",  isActive: roce >= 30 },
    ],
    impact: roce >= 25
      ? `World-class ROCE. This business creates significant value above its cost of capital. High ROCE businesses can self-fund growth without needing to raise external equity or take on heavy debt — this is the definition of a compounding machine.`
      : roce >= 15
      ? `Good ROCE — clearly creates value above cost of capital. Business is economically healthy. As it scales, margins and ROCE should improve further.`
      : `ROCE close to or below 10% is worrying. It suggests returns barely compensate for the risk of investing capital here. Ask: is this a structural issue or a temporary trough?`,
  };
}

// ─── GNPA (Banking) ──────────────────────────────────────────────────────────
export function explainGNPA(gnpa: number): Explanation {
  let rating: Rating;
  let bl: string;
  if      (gnpa <= 1.0) { rating = "excellent"; bl = "EXCELLENT"; }
  else if (gnpa <= 1.5) { rating = "good";      bl = "STRONG"; }
  else if (gnpa <= 2.5) { rating = "fair";      bl = "ACCEPTABLE"; }
  else if (gnpa <= 4.0) { rating = "weak";      bl = "WEAK"; }
  else                  { rating = "danger";    bl = "DANGEROUS"; }

  return {
    metric: "Gross NPA (GNPA)", value: `${gnpa}%`, rating, badgeText: badge(rating, bl),
    summary: `₹${gnpa} out of every ₹100 lent has turned bad (borrower stopped repaying for 90+ days)`,
    whatItMeans: `GNPA (Gross Non-Performing Assets) is the percentage of loans where the borrower has stopped making payments for more than 90 days. A GNPA of ${gnpa}% means: out of every ₹100 lent by this bank, ₹${gnpa} may never be repaid. Banks must set aside money ("provisions") against these bad loans, which directly reduces profits.`,
    analogy: `Imagine you lend ₹100 to 100 different people. If ${Math.round(gnpa)} people stop paying you back, your GNPA is ${gnpa}%. Banks with lower GNPA are safer — their loan books are healthier, they need less provisioning, and profits are higher quality.`,
    benchmark: [
      { range: "< 1%",    label: "Excellent — among the best globally",      isActive: gnpa < 1 },
      { range: "1% – 1.5%", label: "Strong — healthy loan book, low risk",  isActive: gnpa >= 1 && gnpa < 1.5 },
      { range: "1.5% – 2.5%", label: "Acceptable — manageable bad loans",  isActive: gnpa >= 1.5 && gnpa < 2.5 },
      { range: "2.5% – 4%", label: "Weak — significant credit quality concerns", isActive: gnpa >= 2.5 && gnpa < 4 },
      { range: "> 4%",    label: "Dangerous — high provisioning → profit risk", isActive: gnpa >= 4 },
    ],
    impact: gnpa <= 1.5
      ? `Clean loan book is a major advantage. Low GNPA means the bank needs fewer provisions, which flows directly to higher profits. It also signals disciplined lending — the management team won't sacrifice quality for growth.`
      : gnpa <= 2.5
      ? `Manageable GNPA. Watch the trend direction: is it improving or worsening? A bank with 2.5% GNPA trending downward is often better than one at 1.5% trending upward.`
      : `High GNPA is a serious concern. High provisioning will compress profits significantly. Before investing, check if management has a clear NPA resolution plan and the trend is improving.`,
  };
}

// ─── DEBT / EQUITY ───────────────────────────────────────────────────────────
export function explainDebtEquity(de: number): Explanation {
  let rating: Rating;
  let bl: string;
  if      (de === 0)    { rating = "excellent"; bl = "DEBT FREE"; }
  else if (de <= 0.3)   { rating = "excellent"; bl = "VERY LOW DEBT"; }
  else if (de <= 0.5)   { rating = "good";      bl = "LOW DEBT"; }
  else if (de <= 1.0)   { rating = "fair";      bl = "MODERATE DEBT"; }
  else if (de <= 2.0)   { rating = "weak";      bl = "HIGH DEBT"; }
  else                  { rating = "danger";    bl = "DANGEROUS DEBT"; }

  return {
    metric: "Debt / Equity Ratio", value: de === 0 ? "0× (Debt Free)" : `${de}×`, rating, badgeText: badge(rating, bl),
    summary: de === 0 ? "Zero debt — entirely funded by profits and equity, maximum financial safety" : `For every ₹1 of shareholder equity, the company carries ₹${de} of debt`,
    whatItMeans: `Debt/Equity ratio compares borrowed money to shareholders' own money. ${de === 0 ? "At 0, this company has zero debt — it funds all its operations and growth from its own profits and equity capital." : `At ${de}x, for every ₹1 of shareholder equity, the company borrows ₹${de}. This debt must be repaid with interest regardless of business performance.`}`,
    analogy: de === 0
      ? `Like owning your home outright with no mortgage. No monthly payment, no bank pressure, complete financial freedom.`
      : `Imagine buying a ₹100 home. You put down ₹${Math.round(100 / (1 + de))} of your own money and take a ₹${Math.round(de * 100 / (1 + de))} loan — D/E of ${de.toFixed(1)}x. ${de <= 0.5 ? "Very manageable — like a small mortgage." : de <= 1.0 ? "Moderate — the company can manage but it's a real burden." : "Heavy — in a recession, debt repayment could become very difficult."}`,
    benchmark: [
      { range: "0×",        label: "Debt Free — maximum safety & flexibility",    isActive: de === 0 },
      { range: "0 – 0.3×",  label: "Very Low — negligible financial risk",        isActive: de > 0 && de <= 0.3 },
      { range: "0.3× – 0.5×", label: "Low — manageable, profits cover easily",   isActive: de > 0.3 && de <= 0.5 },
      { range: "0.5× – 1.0×", label: "Moderate — monitor interest coverage",     isActive: de > 0.5 && de <= 1.0 },
      { range: "> 1.0×",    label: "High — real risk during economic downturns",  isActive: de > 1.0 },
    ],
    impact: de === 0
      ? `Debt-free companies have enormous advantages: zero interest cost, no bankruptcy risk, can invest aggressively during downturns when competitors are struggling, and maximum flexibility to pay dividends or buy back shares.`
      : de <= 0.5
      ? `Low debt — interest payments are small and easily covered by profits. Company maintains strategic flexibility. Monitor if debt starts rising as business expands.`
      : `High debt amplifies returns in good times but creates severe risk in bad times. Always check if annual profits comfortably exceed annual interest payments (interest coverage > 3× is healthy).`,
  };
}

// ─── REVENUE GROWTH ──────────────────────────────────────────────────────────
export function explainRevenueGrowth(cagr: number): Explanation {
  let rating: Rating;
  let bl: string;
  if      (cagr >= 30) { rating = "excellent"; bl = "EXCEPTIONAL"; }
  else if (cagr >= 20) { rating = "good";      bl = "STRONG"; }
  else if (cagr >= 12) { rating = "fair";      bl = "SOLID"; }
  else if (cagr >= 7)  { rating = "weak";      bl = "MODERATE"; }
  else                 { rating = "danger";    bl = "SLOW"; }

  const future = (100 * Math.pow(1 + cagr / 100, 3)).toFixed(0);

  return {
    metric: "Revenue Growth (3-yr CAGR)", value: `${cagr}%`, rating, badgeText: badge(rating, bl),
    summary: `Sales compounding at ${cagr}% per year — ₹100 Cr three years ago is now ₹${future} Cr`,
    whatItMeans: `Revenue CAGR (Compound Annual Growth Rate) shows how fast the company's total sales have grown over 3 years. This is the "top line" — the total money coming in before costs. If revenue was ₹100 Cr three years ago and is growing at ${cagr}% annually, it's ₹${future} Cr today.`,
    analogy: `Think of a growing restaurant chain. If it had 100 restaurants 3 years ago growing at ${cagr}%/yr, it now has ${future} restaurants worth of revenue. Revenue growth shows market demand and execution momentum.`,
    benchmark: [
      { range: "< 7%",     label: "Slow — barely beating inflation, potential stagnation", isActive: cagr < 7 },
      { range: "7% – 12%", label: "Moderate — in line with the broader economy",           isActive: cagr >= 7 && cagr < 12 },
      { range: "12% – 20%", label: "Solid — meaningfully faster than the economy",         isActive: cagr >= 12 && cagr < 20 },
      { range: "20% – 30%", label: "Strong — strong market demand and execution",          isActive: cagr >= 20 && cagr < 30 },
      { range: "> 30%",    label: "Exceptional — hypergrowth phase, verify it's sustainable", isActive: cagr >= 30 },
    ],
    impact: cagr >= 20
      ? `Strong revenue growth shows the business has real market demand and is gaining share. When combined with improving margins, revenue growth of this level often produces even faster profit growth. The question is sustainability — can this continue for 3-5 more years?`
      : cagr >= 12
      ? `Solid revenue growth — business is expanding meaningfully faster than the economy. This suggests market share gains or expanding addressable market. Good sign.`
      : `Slow revenue growth is concerning. Dig deeper: is the market itself growing slowly, or is this company losing share to competitors? Slow revenue growth caps profit growth potential.`,
  };
}

// ─── PROFIT GROWTH ───────────────────────────────────────────────────────────
export function explainProfitGrowth(cagr: number): Explanation {
  let rating: Rating;
  let bl: string;
  if      (cagr >= 50) { rating = "excellent"; bl = "EXCEPTIONAL"; }
  else if (cagr >= 30) { rating = "good";      bl = "STRONG"; }
  else if (cagr >= 15) { rating = "fair";      bl = "GOOD"; }
  else if (cagr >= 8)  { rating = "weak";      bl = "MODERATE"; }
  else                 { rating = "danger";    bl = "WEAK"; }

  const y1 = (100 * (1 + cagr / 100)).toFixed(0);
  const y2 = (100 * Math.pow(1 + cagr / 100, 2)).toFixed(0);
  const y3 = (100 * Math.pow(1 + cagr / 100, 3)).toFixed(0);

  return {
    metric: "Profit Growth (3-yr CAGR)", value: `${cagr}%`, rating, badgeText: badge(rating, bl),
    summary: `Net profits compounding at ${cagr}% per year — the engine that drives long-term stock price`,
    whatItMeans: `Profit CAGR is arguably the single most important metric for stock returns. Over the long term, stock prices follow earnings growth. A CAGR of ${cagr}% means profits are doubling every ${(72 / cagr).toFixed(1)} years.`,
    analogy: `If profits were ₹100 Cr three years ago at ${cagr}% CAGR:\n• Year 1: ₹${y1} Cr\n• Year 2: ₹${y2} Cr\n• Year 3: ₹${y3} Cr\nThis is the power of compounding — and it flows into the stock price over time.`,
    benchmark: [
      { range: "< 8%",    label: "Weak — profits barely growing",               isActive: cagr < 8 },
      { range: "8% – 15%", label: "Moderate — decent, won't excite the market", isActive: cagr >= 8 && cagr < 15 },
      { range: "15% – 30%", label: "Good — above average, market will notice",  isActive: cagr >= 15 && cagr < 30 },
      { range: "30% – 50%", label: "Strong — rapid compounding",                isActive: cagr >= 30 && cagr < 50 },
      { range: "> 50%",   label: "Exceptional — verify if operational vs one-off", isActive: cagr >= 50 },
    ],
    impact: cagr >= 40
      ? `Very high profit growth — important to check if it's from core operations (sustainable) or one-time items like asset sales or tax benefits (unsustainable). If operational, this is a powerful wealth creator. If one-off, next year could disappoint.`
      : cagr >= 20
      ? `Strong profit growth. At ${cagr}%, profits double every ${(72 / cagr).toFixed(1)} years. If valuation stays constant, your stock should return roughly this rate over the long term.`
      : `Moderate profit growth. Decent, but not exceptional. Stock returns will likely match earnings growth — fine for conservative investors, but not likely to dramatically outperform.`,
  };
}

// ─── MARGINS + FCF ───────────────────────────────────────────────────────────
export function explainMargins(margin: number, fcfPositive: boolean, ocfGtNetProfit: boolean): Explanation {
  let rating: Rating;
  let bl: string;
  if      (margin >= 20 && fcfPositive && ocfGtNetProfit) { rating = "excellent"; bl = "EXCELLENT + STRONG FCF"; }
  else if (margin >= 15 && fcfPositive)                    { rating = "good";      bl = "STRONG"; }
  else if (margin >= 10)                                   { rating = "good";      bl = "GOOD"; }
  else if (margin >=  5)                                   { rating = "fair";      bl = "MODERATE"; }
  else if (margin >=  2)                                   { rating = "weak";      bl = "THIN"; }
  else                                                     { rating = "danger";    bl = "VERY THIN"; }

  const fcfTag = fcfPositive && ocfGtNetProfit
    ? "✔ FCF Positive + OCF > Net Profit = Highest quality earnings"
    : fcfPositive
    ? "✔ FCF Positive (profits backed by real cash)"
    : "⚠ FCF Negative (working capital heavy — monitor cash burn)";

  return {
    metric: "Net Profit Margin + FCF Quality", value: `${margin}%`, rating, badgeText: badge(rating, bl),
    summary: `₹${margin} kept as profit from every ₹100 of revenue · ${fcfTag}`,
    whatItMeans: `Net profit margin is what fraction of revenue becomes profit after all costs — salaries, raw materials, taxes, interest. A margin of ${margin}% means: for every ₹100 of sales, the company keeps ₹${margin} as profit.\n\nFree Cash Flow (FCF) tells you if those profits are real. Some companies show profits on paper but don't actually have cash because of slow collections or heavy inventory. ${fcfPositive && ocfGtNetProfit ? "This company's Operating Cash Flow exceeds Net Profit — meaning profits are backed by actual cash coming in, which is the gold standard of earnings quality." : fcfPositive ? "FCF is positive — cash is being generated." : "FCF is currently negative — watch whether cash conversion improves as the business matures."}`,
    analogy: `Imagine a restaurant earns ₹100 in sales. After food costs, rent, salaries, and taxes, it keeps ₹${margin}. That's the margin. But — does that ₹${margin} sit in the cash register? ${fcfPositive ? "Yes, for this company. Profits are real." : "Not always — sometimes customers owe money or inventory piles up."}`,
    benchmark: [
      { range: "< 3%",    label: "Very Thin — one bad quarter wipes profits",      isActive: margin < 3 },
      { range: "3% – 7%", label: "Thin — typical for EPC, contract manufacturing", isActive: margin >= 3 && margin < 7 },
      { range: "7% – 12%", label: "Moderate — reasonable pricing power",           isActive: margin >= 7 && margin < 12 },
      { range: "12% – 20%", label: "Good — strong competitive position",           isActive: margin >= 12 && margin < 20 },
      { range: "> 20%",   label: "Excellent — monopoly-like pricing power",         isActive: margin >= 20 },
    ],
    impact: margin >= 15 && fcfPositive
      ? `High margin + positive FCF is the hallmark of a durable business with pricing power. It means the company can't easily be undercut by competitors, and profits are real cash — not accounting fiction.`
      : margin >= 10
      ? `Good margin — above-average pricing power. ${fcfPositive ? "FCF-positive: profits are real." : "Monitor FCF to ensure profits convert to cash over time."}`
      : `Thin margins make the business vulnerable to raw material cost spikes, competition, or revenue shortfalls. A 20% cost increase on a 5% margin business wipes out all profit. Look for margin improvement trends before investing.`,
  };
}

// ─── PROMOTER HOLDING ────────────────────────────────────────────────────────
export function explainPromoterHolding(
  holding: number,
  pledgePct: number,
  trend: "increasing" | "stable" | "decreasing",
  sector: string
): Explanation {
  const isBank = sector === "banking";
  const isMNCsub = holding >= 70;

  let rating: Rating;
  let bl: string;
  if      (pledgePct > 20)                                   { rating = "danger";    bl = "HIGH PLEDGE RISK"; }
  else if (pledgePct > 5)                                    { rating = "weak";      bl = "PLEDGE CONCERN"; }
  else if (trend === "decreasing" && holding < 30 && !isBank){ rating = "weak";      bl = "WATCH: FALLING"; }
  else if (trend === "increasing" && pledgePct === 0)        { rating = "excellent"; bl = "INSIDERS BUYING"; }
  else if (holding >= 50 && pledgePct === 0)                 { rating = "good";      bl = "STRONG ALIGNMENT"; }
  else if (isBank && pledgePct === 0)                        { rating = "good";      bl = "NORMAL FOR BANKS"; }
  else if (isMNCsub && pledgePct === 0)                      { rating = "good";      bl = "MNC PARENT"; }
  else                                                       { rating = "fair";      bl = "ACCEPTABLE"; }

  const trendStr = trend === "increasing" ? "Increasing (insiders buying — strong confidence signal)"
    : trend === "decreasing" ? "Decreasing (insiders selling — understand why before investing)"
    : "Stable (no meaningful change)";

  return {
    metric: "Promoter Holding + Pledge + Trend",
    value: `${holding}%`,
    rating, badgeText: badge(rating, bl),
    summary: `${holding}% owned by founders/promoters · Pledge: ${pledgePct}% · Trend: ${trendStr}`,
    whatItMeans: `Promoter holding shows what % of the company the founders or controlling shareholders still own. ${holding}% holding means promoters have ${holding}% skin in the game — their own wealth rises and falls with the company.\n\nPromoter pledge (${pledgePct}%) means ${pledgePct > 0 ? `promoters have pledged ${pledgePct}% of their shares as collateral for loans. If the stock falls sharply, lenders may force-sell these shares — causing a spiral.` : "promoters have not pledged any shares — zero forced-selling risk."}`,
    analogy: `Imagine a restaurant founder. If they still own ${holding}% of the chain, they eat their own cooking — literally. If they've sold most shares (low holding), they may be more focused on collecting salary than building the business. And if they've pledged shares as loan security — that's like them borrowing against their home; if the stock falls, the lender sells the shares automatically.`,
    benchmark: [
      { range: "0% Pledge",   label: "Ideal — zero forced-selling risk",                        isActive: pledgePct === 0 },
      { range: "1–5% Pledge", label: "Watch — small but worth monitoring",                      isActive: pledgePct > 0 && pledgePct <= 5 },
      { range: "> 5% Pledge", label: "Yellow flag — understand what the loan is for",            isActive: pledgePct > 5 && pledgePct <= 20 },
      { range: "> 20% Pledge", label: "Red flag — high forced-selling risk if stock falls",    isActive: pledgePct > 20 },
    ],
    impact: pledgePct > 10
      ? `High pledge is dangerous. If the stock falls significantly, lenders sell the pledged shares automatically, pushing the stock lower, triggering more sales — a vicious cycle. This has destroyed many good companies (e.g., IL&FS, DHFL promoters).`
      : trend === "increasing"
      ? `Promoters buying more shares is the strongest possible insider confidence signal. They know the business best and are putting their own money in — this is bullish.`
      : trend === "decreasing"
      ? `Promoters selling shares can happen for legitimate reasons (diversification, personal needs) but worth investigating. Sustained, large selling is a red flag.`
      : isBank && holding < 15
      ? `Low promoter holding is normal for private sector banks — HDFC Bank, ICICI Bank, Axis Bank all have widely distributed ownership. What matters is institutional ownership, governance quality, and management track record.`
      : isMNCsub
      ? `Very high holding by MNC parent is a signal of quality — they've committed significant capital and are unlikely to divest. Technology access and global standards come with it.`
      : `Stable holding with zero pledge is a positive baseline — promoters are holding their position without financial pressure.`,
  };
}

// ─── CASA (Banking) ──────────────────────────────────────────────────────────
export function explainCASA(casa: number): Explanation {
  let rating: Rating;
  let bl: string;
  if      (casa >= 45) { rating = "excellent"; bl = "EXCELLENT"; }
  else if (casa >= 38) { rating = "good";      bl = "STRONG"; }
  else if (casa >= 30) { rating = "fair";      bl = "ADEQUATE"; }
  else                 { rating = "weak";      bl = "WEAK"; }

  return {
    metric: "CASA Ratio", value: `${casa}%`, rating, badgeText: badge(rating, bl),
    summary: `${casa}% of deposits are low-cost (Current + Savings accounts) — directly boosts bank profitability`,
    whatItMeans: `CASA stands for Current Account + Savings Account deposits. These deposits pay very little interest (savings: ~3-4%, current: 0%). The rest of deposits are Fixed Deposits (FDs) which pay 6-7%. So a bank with ${casa}% CASA gets ${casa}% of its money very cheaply. Higher CASA = lower cost of funds = higher profit margins (NIM).`,
    analogy: `Imagine a bank collects ₹100 from depositors. If CASA is ${casa}%:\n• ₹${casa} comes from savings/current accounts (costs bank 3%/yr)\n• ₹${100 - casa} comes from FDs (costs bank 7%/yr)\nAverage cost: ₹${(casa * 3 / 100 + (100 - casa) * 7 / 100).toFixed(1)} per ₹100.\nA bank with 30% CASA pays more — directly reducing its profit margin.`,
    benchmark: [
      { range: "< 30%",   label: "Weak — high cost of funds, thin margins",    isActive: casa < 30 },
      { range: "30% – 38%", label: "Adequate — average for mid-sized banks",   isActive: casa >= 30 && casa < 38 },
      { range: "38% – 45%", label: "Strong — below-average cost of funds",     isActive: casa >= 38 && casa < 45 },
      { range: "> 45%",   label: "Excellent — premium franchise, like Kotak",  isActive: casa >= 45 },
    ],
    impact: casa >= 40
      ? `High CASA is a strong competitive moat. Customers keep their daily banking here (salary credits, bill payments) — this is "sticky" money that doesn't move when FD rates change. This gives the bank a structural cost advantage over competitors.`
      : casa >= 30
      ? `Adequate CASA. The bank can still be profitable but needs to compete aggressively on FD rates to attract deposits, which squeezes margins.`
      : `Low CASA means the bank pays higher interest on deposits, compressing margins. It may need to take higher credit risk to maintain ROE — a dangerous combination.`,
  };
}

// ─── NIM (Banking) ───────────────────────────────────────────────────────────
export function explainNIM(nim: number): Explanation {
  const numNIM = typeof nim === "string" ? parseFloat(nim) : nim;

  let rating: Rating;
  let bl: string;
  if      (numNIM >= 4.5) { rating = "excellent"; bl = "EXCELLENT"; }
  else if (numNIM >= 3.5) { rating = "good";      bl = "STRONG"; }
  else if (numNIM >= 2.8) { rating = "fair";      bl = "ADEQUATE"; }
  else                    { rating = "weak";      bl = "THIN"; }

  return {
    metric: "Net Interest Margin (NIM)", value: `${numNIM}%`, rating, badgeText: badge(rating, bl),
    summary: `Earns ${numNIM}% net interest on every ₹100 deployed — the bank's core profitability measure`,
    whatItMeans: `NIM is the difference between the interest rate a bank earns on loans and the interest rate it pays on deposits, expressed as a percentage of total assets. A NIM of ${numNIM}% means: for every ₹100 the bank has deployed (in loans and investments), it earns ₹${numNIM} per year in net interest — after paying depositors.`,
    analogy: `Bank lends at 12% average, pays depositors 8% average. NIM = 4%. For every ₹100 lent, the bank keeps ₹4/year. Higher NIM = more profitable core business.`,
    benchmark: [
      { range: "< 2.5%",  label: "Thin — wholesale lenders, vulnerable to rate changes", isActive: numNIM < 2.5 },
      { range: "2.5% – 3.5%", label: "Adequate — typical large bank range",             isActive: numNIM >= 2.5 && numNIM < 3.5 },
      { range: "3.5% – 4.5%", label: "Strong — focused on retail/SME lending",          isActive: numNIM >= 3.5 && numNIM < 4.5 },
      { range: "> 4.5%",  label: "Excellent — NBFC-level margins, strong niche",         isActive: numNIM >= 4.5 },
    ],
    impact: numNIM >= 4
      ? `High NIM signals a strong niche — either consumer banking (higher yield), NBFC-like products, or deep low-cost CASA deposits. This is a structural competitive advantage that compounds well.`
      : numNIM >= 3.5
      ? `Good NIM — retail-focused with reasonable margin. Focus on maintaining this as rates change.`
      : `Thin NIM means the bank is competing on volume, not margin. Any RBI rate cut could compress NIM further, squeezing profits.`,
  };
}

// ─── ORDER BOOK COVERAGE ─────────────────────────────────────────────────────
export function explainOrderBook(ratio: number): Explanation {
  let rating: Rating;
  let bl: string;
  if      (ratio >= 5)  { rating = "excellent"; bl = "EXCEPTIONAL VISIBILITY"; }
  else if (ratio >= 3)  { rating = "good";      bl = "STRONG VISIBILITY"; }
  else if (ratio >= 2)  { rating = "fair";      bl = "GOOD VISIBILITY"; }
  else if (ratio >= 1)  { rating = "weak";      bl = "LIMITED VISIBILITY"; }
  else                  { rating = "danger";    bl = "VERY LOW"; }

  const yearsOfRevenue = ratio.toFixed(1);

  return {
    metric: "Order Book / Revenue", value: `${ratio}×`, rating, badgeText: badge(rating, bl),
    summary: `Order book covers ${yearsOfRevenue} years of current revenue — ${ratio >= 3 ? "excellent future revenue visibility" : "moderate revenue visibility"}`,
    whatItMeans: `For EPC (construction/engineering) companies, the order book is the total value of contracts signed but not yet executed. Dividing it by annual revenue gives you how many years of work is already locked in. An order book of ${ratio}× revenue means even if no new orders came in, the company has ${yearsOfRevenue} years of work guaranteed.`,
    analogy: `Imagine a construction company that earns ₹1,000 Cr/year. If its order book is ₹${(ratio * 1000).toFixed(0)} Cr, it has ${yearsOfRevenue} years of guaranteed work. This is like having ${yearsOfRevenue} years of salary in advance — extremely reassuring for future revenue.`,
    benchmark: [
      { range: "< 1×",   label: "Very Low — revenue depends on new orders urgently", isActive: ratio < 1 },
      { range: "1× – 2×", label: "Limited — some visibility, but needs constant new orders", isActive: ratio >= 1 && ratio < 2 },
      { range: "2× – 3×", label: "Good — 2+ years locked in, solid comfort",        isActive: ratio >= 2 && ratio < 3 },
      { range: "3× – 5×", label: "Strong — 3-5 years locked, excellent visibility",  isActive: ratio >= 3 && ratio < 5 },
      { range: "> 5×",   label: "Exceptional — 5+ years of revenue already secured", isActive: ratio >= 5 },
    ],
    impact: ratio >= 4
      ? `Exceptional revenue visibility. The company doesn't need any new orders for years to stay busy. This reduces earnings risk dramatically and allows management to focus on execution quality rather than deal chasing.`
      : ratio >= 2
      ? `Good order book coverage gives investors confidence in near-term revenue. Monitor order inflow rate to ensure the book is being replenished.`
      : `Low order book coverage means revenue depends heavily on winning new contracts. Any slowdown in government/private capex could cause a sharp revenue dip.`,
  };
}
