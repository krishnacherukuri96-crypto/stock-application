import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

export async function POST() {
  try {
    const res = await fetch("https://images.dhan.co/api-data/api-scrip-master.csv", {
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch instrument master: HTTP ${res.status}` },
        { status: 502 },
      );
    }

    const text  = await res.text();
    const lines = text.split("\n");
    if (lines.length < 2) {
      return NextResponse.json({ error: "CSV appears empty" }, { status: 502 });
    }

    const header = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toUpperCase());

    const col = (...names: string[]) => {
      for (const n of names) {
        const i = header.indexOf(n.toUpperCase());
        if (i !== -1) return i;
      }
      return -1;
    };

    const exchIdx     = col("SEM_EXM_EXCH_ID", "EXCH_ID", "EXCHANGE");
    const instrIdx    = col("SEM_INSTRUMENT_NAME", "INSTRUMENT_NAME", "INSTRUMENT");
    const seriesIdx   = col("SEM_SERIES", "SERIES");
    const instrTypeIdx = col("SEM_EXCH_INSTRUMENT_TYPE");
    const idIdx       = col("SEM_SMST_SECURITY_ID", "SEM_SECURITY_ID", "SECURITY_ID");
    const symIdx      = col("SEM_TRADING_SYMBOL", "TRADING_SYMBOL", "SEM_CUSTOM_SYMBOL");
    const nameIdx     = col("SM_SYMBOL_NAME", "SEM_NAME", "SYMBOL_NAME");

    if (idIdx === -1 || symIdx === -1) {
      return NextResponse.json(
        { error: "Could not locate required columns in CSV", header: header.slice(0, 20) },
        { status: 502 },
      );
    }

    const instruments: { securityId: number; symbol: string; name: string }[] = [];
    const now = new Date();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));

      const exch      = exchIdx      >= 0 ? (cols[exchIdx]      ?? "").toUpperCase() : "";
      const instr     = instrIdx     >= 0 ? (cols[instrIdx]     ?? "").toUpperCase() : "";
      const series    = seriesIdx    >= 0 ? (cols[seriesIdx]    ?? "").toUpperCase() : "";
      const instrType = instrTypeIdx >= 0 ? (cols[instrTypeIdx] ?? "").toUpperCase() : "";

      // Exclude ETFs, index funds, sovereign gold bonds etc. — they have
      // SEM_EXCH_INSTRUMENT_TYPE = "ETF". Only keep "ES" (equity stock).
      if (instrType === "ETF") continue;

      // Only NSE cash-market equity stocks.
      // SEM_EXM_EXCH_ID = "NSE", SEM_INSTRUMENT_NAME = "EQUITY"
      // SEM_SERIES must be "EQ" (normal) or "BE" (trade-for-trade / exchange restricted).
      // Excludes: SG (govt bonds), N0/N1/... (NCDs), SM (SME), MF, GS, TB, GB, etc.
      const isNSECashEquity =
        exch === "NSE" &&
        instr === "EQUITY" &&
        (series === "EQ" || series === "BE");

      // Legacy format: SEM_EXM_EXCH_ID was "NSE_EQ" (no series column needed)
      const isLegacyFormat = exch === "NSE_EQ" && instr === "EQUITY";

      if (!isNSECashEquity && !isLegacyFormat) continue;

      const securityId = parseInt(cols[idIdx] ?? "");
      const symbol     = (cols[symIdx] ?? "").trim().toUpperCase();
      const rawName    = nameIdx >= 0 ? (cols[nameIdx] ?? "").trim() : "";
      const name       = rawName || symbol;

      if (!securityId || isNaN(securityId) || !symbol) continue;

      // Skip symbols that look like derivative contracts (contain expiry dates etc.)
      if (!/^[A-Z0-9&.\-]{1,20}$/.test(symbol)) continue;

      instruments.push({ securityId, symbol, name });
    }

    if (instruments.length === 0) {
      const sampleRows = lines.slice(1, 4).map(l =>
        l.split(",").map(c => c.trim().replace(/^"|"$/g, "")).slice(0, 10),
      );
      return NextResponse.json({
        error: "No NSE equity instruments found — CSV format may have changed",
        header: header.slice(0, 20),
        sampleRows,
        totalLines: lines.length,
      }, { status: 502 });
    }

    // Upsert in chunks. Using individual awaits (not $transaction array) to avoid
    // hitting PgBouncer limits on very large batch transactions.
    const CHUNK = 100;
    let upserted = 0;

    for (let i = 0; i < instruments.length; i += CHUNK) {
      const chunk = instruments.slice(i, i + CHUNK);
      await Promise.all(
        chunk.map(inst =>
          prisma.instrument.upsert({
            where:  { securityId: inst.securityId },
            update: { symbol: inst.symbol, name: inst.name, syncedAt: now },
            create: { ...inst, syncedAt: now },
          }),
        ),
      );
      upserted += chunk.length;
    }

    return NextResponse.json({ success: true, count: upserted, syncedAt: now.toISOString() });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const count  = await prisma.instrument.count();
    const latest = await prisma.instrument.findFirst({
      orderBy: { syncedAt: "desc" },
      select:  { syncedAt: true },
    });
    return NextResponse.json({ count, lastSynced: latest?.syncedAt ?? null });
  } catch {
    return NextResponse.json({ count: 0, lastSynced: null });
  }
}
