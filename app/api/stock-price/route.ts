import { NextRequest, NextResponse } from "next/server";

// Proxy for Yahoo Finance unofficial API — fetches live NSE stock prices
// This avoids CORS issues when calling from the browser directly

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; research-dashboard/1.0)",
        Accept: "application/json",
      },
      next: { revalidate: 300 }, // cache 5 minutes
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Yahoo Finance unavailable" }, { status: 502 });
    }

    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;

    if (!meta) {
      return NextResponse.json({ error: "No data" }, { status: 404 });
    }

    return NextResponse.json({
      symbol,
      price: meta.regularMarketPrice,
      previousClose: meta.previousClose ?? meta.chartPreviousClose,
      change: meta.regularMarketPrice - (meta.previousClose ?? meta.chartPreviousClose),
      changePct:
        ((meta.regularMarketPrice - (meta.previousClose ?? meta.chartPreviousClose)) /
          (meta.previousClose ?? meta.chartPreviousClose)) *
        100,
      currency: meta.currency,
      exchangeName: meta.exchangeName,
      marketState: meta.marketState,
      timestamp: meta.regularMarketTime,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch price" }, { status: 500 });
  }
}
