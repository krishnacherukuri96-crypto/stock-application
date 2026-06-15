import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

// Find the most recent trading day (skip weekends)
function lastTradingDay(): string {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000); // IST now
  // If before 6 PM IST today, use yesterday (bhav copy may not be out yet)
  const hour = d.getUTCHours();
  if (hour < 12) d.setDate(d.getDate() - 1); // before noon IST → go back a day
  // Skip Sunday/Saturday
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  const dd   = String(d.getDate()).padStart(2, "0");
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}${mm}${yyyy}`; // DDMMYYYY for NSE URL
}

// Parse NSE bhav copy CSV (columns vary slightly across dates)
function parseBhavCopy(text: string): { symbol: string; tradedValue: number }[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toUpperCase());

  const symIdx = header.findIndex(h => h === "SYMBOL");
  const serIdx = header.findIndex(h => h === "SERIES");
  const valIdx = header.findIndex(
    h => h.includes("TRDVAL") || h.includes("TRD_VAL") || h.includes("TOTALTRADES") || h === "TOT_TRD_VAL"
  );
  const qtyIdx = header.findIndex(
    h => h.includes("TRDQTY") || h.includes("TRD_QTY") || h === "TOT_TRD_QTY" || h === "TOTTRDQTY"
  );
  const closeIdx = header.findIndex(h => h === "CLOSE_PRICE" || h === "CLOSE" || h === "CLOSE PRICE");

  if (symIdx === -1) return [];

  const results: { symbol: string; tradedValue: number }[] = [];

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));

    const series = serIdx >= 0 ? cols[serIdx] : "EQ";
    if (series !== "EQ") continue;

    const symbol = cols[symIdx];
    if (!symbol) continue;

    // Use traded value if available, else qty × close as proxy
    let tradedValue = 0;
    if (valIdx >= 0) {
      tradedValue = parseFloat(cols[valIdx]) || 0;
    } else if (qtyIdx >= 0 && closeIdx >= 0) {
      tradedValue = (parseFloat(cols[qtyIdx]) || 0) * (parseFloat(cols[closeIdx]) || 0);
    }

    results.push({ symbol, tradedValue });
  }

  return results;
}

// POST /api/scanner/universe — rebuild today's liquid stock universe
export async function POST() {
  const dateStr = lastTradingDay();
  const url = `https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_${dateStr}.csv`;

  let text: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer":    "https://www.nseindia.com/",
        "Accept":     "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (e) {
    return NextResponse.json(
      { error: `NSE bhav copy unavailable (${e}). Try again after 6 PM on a trading day.` },
      { status: 502 },
    );
  }

  const rows = parseBhavCopy(text);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Bhav copy parsed 0 rows — format may have changed" }, { status: 502 });
  }

  // Filter: traded value > ₹5 crore (liquid enough for intraday)
  const MIN_VALUE = 50_000_000; // 5 crore
  const liquid = rows
    .filter(r => r.tradedValue >= MIN_VALUE)
    .sort((a, b) => b.tradedValue - a.tradedValue);

  const liquidSymbols = liquid.map(r => r.symbol);

  // Map to Dhan security IDs from synced Instrument table
  const instruments = await prisma.instrument.findMany({
    where:  { symbol: { in: liquidSymbols } },
    select: { symbol: true, securityId: true, name: true },
  });

  const instrMap = new Map(instruments.map(i => [i.symbol, i]));
  const mapped = liquidSymbols
    .map(sym => instrMap.get(sym))
    .filter((i): i is NonNullable<typeof i> => i !== undefined);

  // Upsert into ScannerUniverse
  const CHUNK = 100;
  for (let i = 0; i < mapped.length; i += CHUNK) {
    const chunk = mapped.slice(i, i + CHUNK);
    await prisma.$transaction(
      chunk.map(s =>
        prisma.scannerUniverse.upsert({
          where:  { symbol: s.symbol },
          update: { securityId: s.securityId, name: s.name },
          create: { symbol: s.symbol, securityId: s.securityId, name: s.name },
        }),
      ),
    );
  }

  // Remove stocks no longer liquid (clean up stale entries)
  const mappedSet = new Set(mapped.map(m => m.symbol));
  const existing  = await prisma.scannerUniverse.findMany({ select: { symbol: true } });
  const toRemove  = existing.map(e => e.symbol).filter(s => !mappedSet.has(s));
  if (toRemove.length > 0) {
    await prisma.scannerUniverse.deleteMany({ where: { symbol: { in: toRemove } } });
  }

  return NextResponse.json({
    success:    true,
    date:       dateStr,
    totalRows:  rows.length,
    liquid:     liquidSymbols.length,
    mapped:     mapped.length,
    unmapped:   liquidSymbols.length - mapped.length,
    removed:    toRemove.length,
  });
}

// GET /api/scanner/universe — status
export async function GET() {
  const count = await prisma.scannerUniverse.count();
  const sample = await prisma.scannerUniverse.findMany({
    take:    5,
    orderBy: { symbol: "asc" },
    select:  { symbol: true, name: true },
  });
  return NextResponse.json({ count, sample });
}
