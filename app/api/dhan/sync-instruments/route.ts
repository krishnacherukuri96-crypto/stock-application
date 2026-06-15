import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Allow up to 60s on Vercel Pro; hobby plan is capped at 10s but we try anyway
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

    const text = await res.text();
    const lines = text.split("\n");
    if (lines.length < 2) {
      return NextResponse.json({ error: "CSV appears empty" }, { status: 502 });
    }

    // Parse header — Dhan uses quoted column names
    const header = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));

    // Find column indices (try multiple possible names for robustness)
    const col = (names: string[]) => {
      for (const n of names) {
        const i = header.indexOf(n);
        if (i !== -1) return i;
      }
      return -1;
    };

    const exchIdx   = col(["SEM_EXM_EXCH_ID", "EXCH_ID", "SEM_SEGMENT"]);
    const idIdx     = col(["SEM_SMST_SECURITY_ID", "SEM_SECURITY_ID", "SECURITY_ID"]);
    const symIdx    = col(["SEM_TRADING_SYMBOL", "TRADING_SYMBOL", "SEM_CUSTOM_SYMBOL"]);
    const nameIdx   = col(["SM_SYMBOL_NAME", "SEM_INSTRUMENT_NAME", "SEM_NAME", "SYMBOL_NAME"]);

    if (idIdx === -1 || symIdx === -1) {
      return NextResponse.json(
        { error: "Could not locate required columns in CSV", header },
        { status: 502 },
      );
    }

    // Parse NSE_EQ rows only
    const instruments: { securityId: number; symbol: string; name: string }[] = [];
    const now = new Date();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));

      const exch = exchIdx >= 0 ? cols[exchIdx] : "";
      if (exch && exch !== "NSE_EQ") continue;

      const securityId = parseInt(cols[idIdx]);
      const symbol     = cols[symIdx] ?? "";
      const name       = nameIdx >= 0 ? (cols[nameIdx] ?? symbol) : symbol;

      if (!securityId || !symbol || isNaN(securityId)) continue;

      // Only letters/digits/hyphens in symbol — skip futures/options entries
      if (!/^[A-Z0-9&.\-]+$/.test(symbol)) continue;

      instruments.push({ securityId, symbol, name: name || symbol });
    }

    if (instruments.length === 0) {
      // exchIdx was -1 and we got nothing — retry without exchange filter
      // (means the CSV format changed; return header for debugging)
      return NextResponse.json({
        error: "No NSE_EQ instruments found — CSV format may have changed",
        header,
        totalLines: lines.length,
      }, { status: 502 });
    }

    // Batch upsert in chunks of 200 to stay within DB limits
    const CHUNK = 200;
    let upserted = 0;

    for (let i = 0; i < instruments.length; i += CHUNK) {
      const chunk = instruments.slice(i, i + CHUNK);
      await prisma.$transaction(
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

    return NextResponse.json({
      success: true,
      count: upserted,
      syncedAt: now.toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET returns sync status (last sync time + count)
export async function GET() {
  try {
    const count = await prisma.instrument.count();
    const latest = await prisma.instrument.findFirst({
      orderBy: { syncedAt: "desc" },
      select:  { syncedAt: true },
    });
    return NextResponse.json({ count, lastSynced: latest?.syncedAt ?? null });
  } catch {
    return NextResponse.json({ count: 0, lastSynced: null });
  }
}
