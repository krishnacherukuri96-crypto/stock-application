import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/watchlist — returns the user's watchlist items with Dhan security IDs
export async function GET() {
  try {
    const items = await prisma.watchlistItem.findMany({
      orderBy: { addedAt: "asc" },
    });

    // Look up Dhan security IDs for each symbol
    const instruments = await prisma.instrument.findMany({
      where: { symbol: { in: items.map(i => i.symbol) } },
    });

    const idMap = new Map(instruments.map(inst => [inst.symbol, inst]));

    const result = items.map(item => ({
      symbol:     item.symbol,
      securityId: idMap.get(item.symbol)?.securityId ?? null,
      name:       idMap.get(item.symbol)?.name ?? item.symbol,
      addedAt:    item.addedAt,
      resolved:   idMap.has(item.symbol),
    }));

    return NextResponse.json({ items: result });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

// POST /api/watchlist — add a stock by NSE symbol
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const symbol: string = (body.symbol ?? "").toUpperCase().trim();

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  // Check if instrument exists in our synced master
  const instrument = await prisma.instrument.findUnique({ where: { symbol } }).catch(() => null);

  if (!instrument) {
    // Instrument table might not be synced yet — add anyway, ID will be null
    const instrumentCount = await prisma.instrument.count().catch(() => 0);
    if (instrumentCount > 0) {
      return NextResponse.json(
        { error: `"${symbol}" not found in NSE instrument list. Check the symbol and try again.` },
        { status: 404 },
      );
    }
    // Table not synced yet — allow add with a warning
  }

  try {
    const item = await prisma.watchlistItem.upsert({
      where:  { symbol },
      update: {},
      create: { symbol },
    });
    return NextResponse.json({
      symbol:     item.symbol,
      securityId: instrument?.securityId ?? null,
      name:       instrument?.name ?? symbol,
      warning:    !instrument ? "Instrument master not synced — security ID unknown until you sync." : undefined,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE /api/watchlist?symbol=RELIANCE — remove a stock
export async function DELETE(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get("symbol") ?? "").toUpperCase().trim();

  if (!symbol) {
    return NextResponse.json({ error: "symbol query param required" }, { status: 400 });
  }

  try {
    await prisma.watchlistItem.delete({ where: { symbol } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Symbol not in watchlist" }, { status: 404 });
  }
}

