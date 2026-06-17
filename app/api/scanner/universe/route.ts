import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSector } from "@/lib/sectors";

export const maxDuration = 60;

const NSE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer":    "https://www.nseindia.com/",
  "Accept":     "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

function toDDMMYYYY(d: Date): string {
  return (
    String(d.getUTCDate()).padStart(2, "0") +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCFullYear())
  );
}

// Returns the DDMMYYYY date string + CSV text of the most recent available bhav copy.
// Scans back up to 10 calendar days so public holidays are handled automatically.
async function fetchLatestBhavCopy(): Promise<{ dateStr: string; text: string }> {
  const now = new Date(Date.now() + 5.5 * 3600 * 1000); // shift to IST as UTC offset trick

  // Bhav copy is published after ~6 PM IST; if before that, start from yesterday
  if (now.getUTCHours() < 18) now.setUTCDate(now.getUTCDate() - 1);

  for (let back = 0; back < 10; back++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - back);

    // Skip weekends (Sun = 0, Sat = 6)
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;

    const dateStr = toDDMMYYYY(d);
    const url = `https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_${dateStr}.csv`;

    try {
      const res = await fetch(url, { headers: NSE_HEADERS, cache: "no-store" });
      if (!res.ok) continue; // 404 = holiday or not yet published; try earlier date
      const text = await res.text();
      if (text.trim().split("\n").length > 10) return { dateStr, text }; // valid file
    } catch {
      continue;
    }
  }

  throw new Error(
    "No NSE bhav copy found for the last 10 calendar days. NSE archives may be down.",
  );
}

function parseBhavCopy(text: string): { symbol: string; tradedValue: number }[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toUpperCase());

  const symIdx      = header.findIndex(h => h === "SYMBOL");
  const serIdx      = header.findIndex(h => h === "SERIES");
  // TURNOVER_LACS  = rupee turnover in lakhs (current NSE bhav copy format)
  // TOT_TRD_VAL / TRDVAL = rupee turnover in absolute rupees (older formats)
  const lacsIdx     = header.findIndex(h => h === "TURNOVER_LACS");
  const absValIdx   = header.findIndex(h => h.includes("TRDVAL") || h === "TOT_TRD_VAL");
  // Fallback: qty × close
  const qtyIdx      = header.findIndex(h => h === "TTL_TRD_QNTY" || h.includes("TRDQTY") || h === "TOT_TRD_QTY" || h === "TOTTRDQTY");
  const closeIdx    = header.findIndex(h => h === "CLOSE_PRICE" || h === "CLOSE");

  if (symIdx === -1) return [];

  const results: { symbol: string; tradedValue: number }[] = [];

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));

    const series = serIdx >= 0 ? cols[serIdx] : "EQ";
    if (series !== "EQ" && series !== "BE") continue;

    const symbol = cols[symIdx];
    if (!symbol) continue;

    let tradedValue = 0;
    if (lacsIdx >= 0) {
      // TURNOVER_LACS is in lakhs — multiply by 1,00,000 to get rupees
      tradedValue = (parseFloat(cols[lacsIdx]) || 0) * 100_000;
    } else if (absValIdx >= 0) {
      tradedValue = parseFloat(cols[absValIdx]) || 0;
    } else if (qtyIdx >= 0 && closeIdx >= 0) {
      tradedValue = (parseFloat(cols[qtyIdx]) || 0) * (parseFloat(cols[closeIdx]) || 0);
    }

    results.push({ symbol, tradedValue });
  }

  return results;
}

export async function POST() {
  try {
    return await buildUniverse();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

async function buildUniverse() {
  // Fetch real NSE bhav copy — no fallback, no patched data
  const { dateStr, text } = await fetchLatestBhavCopy();

  const rows = parseBhavCopy(text);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: `Bhav copy for ${dateStr} downloaded but parsed 0 EQ rows — format may have changed`, dateStr },
      { status: 502 },
    );
  }

  // Keep only liquid stocks: traded ≥ ₹5 Cr in a day (filters out illiquid penny stocks)
  const MIN_VALUE = 50_000_000;
  const liquidRows = rows
    .filter(r => r.tradedValue >= MIN_VALUE)
    .sort((a, b) => b.tradedValue - a.tradedValue);

  const liquidSymbols = liquidRows.map(r => r.symbol);

  // Map to Dhan security IDs
  const instruments = await prisma.instrument.findMany({
    where:  { symbol: { in: liquidSymbols } },
    select: { symbol: true, securityId: true, name: true },
  });
  const instrMap = new Map(instruments.map(i => [i.symbol, i]));
  const mapped = liquidSymbols
    .map(sym => instrMap.get(sym))
    .filter((i): i is NonNullable<typeof i> => i !== undefined);

  if (mapped.length === 0) {
    return NextResponse.json(
      {
        error: "Bhav copy fetched but 0 stocks matched instrument library. Run Settings → Sync Instruments first.",
        dateStr,
        liquidCount: liquidSymbols.length,
        instrumentsInDb: instruments.length,
      },
      { status: 502 },
    );
  }

  // Upsert into ScannerUniverse (individual upserts to avoid pgBouncer batch limits)
  const CHUNK = 100;
  for (let i = 0; i < mapped.length; i += CHUNK) {
    const chunk = mapped.slice(i, i + CHUNK);
    await Promise.all(
      chunk.map(s => {
        const sector = getSector(s.symbol);
        return prisma.scannerUniverse.upsert({
          where:  { symbol: s.symbol },
          update: { securityId: s.securityId, name: s.name, sector },
          create: { symbol: s.symbol, securityId: s.securityId, name: s.name, sector },
        });
      }),
    );
  }

  // Remove stocks that are no longer liquid
  const mappedSet = new Set(mapped.map(m => m.symbol));
  const existing  = await prisma.scannerUniverse.findMany({ select: { symbol: true } });
  const toRemove  = existing.map(e => e.symbol).filter(s => !mappedSet.has(s));
  if (toRemove.length > 0) {
    await prisma.scannerUniverse.deleteMany({ where: { symbol: { in: toRemove } } });
  }

  return NextResponse.json({
    success:   true,
    bhavDate:  dateStr,
    totalRows: rows.length,
    liquid:    liquidSymbols.length,
    mapped:    mapped.length,
    unmapped:  liquidSymbols.length - mapped.length,
    removed:   toRemove.length,
  });
}

export async function GET() {
  try {
    const count  = await prisma.scannerUniverse.count();
    const sample = await prisma.scannerUniverse.findMany({
      take:    5,
      orderBy: { symbol: "asc" },
      select:  { symbol: true, name: true },
    });
    return NextResponse.json({ count, sample });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e), count: 0, sample: [] }, { status: 500 });
  }
}
