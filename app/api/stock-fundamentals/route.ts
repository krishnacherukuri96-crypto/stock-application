import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// What Yahoo Finance quoteSummary gives us for Indian NSE stocks
export interface LiveFundamentals {
  symbol: string;
  pe: number | null;
  pb: number | null;
  roe: number | null;             // %
  netProfitMargin: number | null; // %
  marketCapCr: number | null;
  revenueGrowthQtr: number | null; // recent quarter YoY %
  earningsGrowthQtr: number | null;
  fetchedAt: string;
  cached: boolean;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  const force  = req.nextUrl.searchParams.get("force") === "true";
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  const cacheKey = `stock_fundamentals_${symbol}`;

  // ── 1. Serve from cache if fresh ──────────────────────────────────────────
  if (!force) {
    try {
      const cached = await prisma.indicatorCache.findUnique({ where: { key: cacheKey } });
      if (cached && new Date() < cached.expiresAt) {
        return NextResponse.json({ ...(cached.data as object), cached: true });
      }
    } catch {
      // DB unavailable — fall through to live fetch
    }
  }

  // ── 2. Fetch from Yahoo Finance quoteSummary ──────────────────────────────
  try {
    const modules = "defaultKeyStatistics,financialData,summaryDetail";
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; research-dashboard/1.0)",
        Accept: "application/json",
      },
      // no Next.js cache — we handle caching ourselves via DB
    });

    if (!res.ok) throw new Error(`Yahoo returned ${res.status}`);

    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0];
    if (!result) throw new Error("No result in Yahoo response");

    const ks = result.defaultKeyStatistics ?? {};
    const fd = result.financialData ?? {};
    const sd = result.summaryDetail ?? {};

    const roeRaw = fd.returnOnEquity?.raw ?? ks.returnOnEquity?.raw ?? null;

    const data: LiveFundamentals = {
      symbol,
      pe:                 sd.trailingPE?.raw ?? ks.trailingPE?.raw ?? null,
      pb:                 ks.priceToBook?.raw ?? null,
      roe:                roeRaw != null ? parseFloat((roeRaw * 100).toFixed(2)) : null,
      netProfitMargin:    fd.profitMargins?.raw != null ? parseFloat((fd.profitMargins.raw * 100).toFixed(2)) : null,
      marketCapCr:        sd.marketCap?.raw != null ? Math.round(sd.marketCap.raw / 10_000_000) : null,
      revenueGrowthQtr:   fd.revenueGrowth?.raw != null ? parseFloat((fd.revenueGrowth.raw * 100).toFixed(2)) : null,
      earningsGrowthQtr:  fd.earningsGrowth?.raw != null ? parseFloat((fd.earningsGrowth.raw * 100).toFixed(2)) : null,
      fetchedAt: new Date().toISOString(),
      cached: false,
    };

    // ── 3. Write to DB cache ─────────────────────────────────────────────────
    try {
      const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
      await prisma.indicatorCache.upsert({
        where:  { key: cacheKey },
        update: { data: data as never, fetchedAt: new Date(), expiresAt },
        create: { key: cacheKey, data: data as never, expiresAt },
      });
    } catch {
      // Non-critical — return data even if caching fails
    }

    return NextResponse.json(data);
  } catch (err) {
    // Return last cached value (even if stale) rather than a hard error
    try {
      const stale = await prisma.indicatorCache.findUnique({ where: { key: cacheKey } });
      if (stale) return NextResponse.json({ ...(stale.data as object), cached: true, stale: true });
    } catch { /* ignore */ }

    return NextResponse.json({ error: String(err), symbol }, { status: 502 });
  }
}
