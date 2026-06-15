import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/watchlist/search?q=RELI — typeahead search in synced instrument master
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").toUpperCase().trim();

  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await prisma.instrument.findMany({
      where: {
        OR: [
          { symbol: { startsWith: q } },
          { name:   { contains: q, mode: "insensitive" } },
        ],
      },
      take:    10,
      select:  { securityId: true, symbol: true, name: true },
      orderBy: { symbol: "asc" },
    });
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
