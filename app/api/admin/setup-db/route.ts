import { NextResponse } from "next/server";
import { directPrisma as prisma } from "@/lib/prisma";

// POST /api/admin/setup-db
// Creates all required tables if they don't already exist.
// Safe to run multiple times — uses CREATE TABLE IF NOT EXISTS.
export async function POST() {
  const results: Record<string, string> = {};

  const tables = [
    {
      name: "DhanToken",
      sql: `
        CREATE TABLE IF NOT EXISTS "DhanToken" (
          "id"          TEXT        PRIMARY KEY,
          "accessToken" TEXT        NOT NULL,
          "clientId"    TEXT        NOT NULL,
          "expiresAt"   TIMESTAMPTZ NOT NULL,
          "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
    },
    {
      name: "IndicatorCache",
      sql: `
        CREATE TABLE IF NOT EXISTS "IndicatorCache" (
          "id"        TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
          "key"       TEXT        NOT NULL UNIQUE,
          "data"      JSONB       NOT NULL,
          "fetchedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "expiresAt" TIMESTAMPTZ NOT NULL
        )`,
    },
    {
      name: "User",
      sql: `
        CREATE TABLE IF NOT EXISTS "User" (
          "id"        TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
          "email"     TEXT        NOT NULL UNIQUE,
          "password"  TEXT        NOT NULL,
          "name"      TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
    },
    {
      name: "Instrument",
      sql: `
        CREATE TABLE IF NOT EXISTS "Instrument" (
          "securityId" INTEGER     PRIMARY KEY,
          "symbol"     TEXT        NOT NULL UNIQUE,
          "name"       TEXT        NOT NULL,
          "syncedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS "Instrument_symbol_idx" ON "Instrument"("symbol")`,
    },
    {
      name: "WatchlistItem",
      sql: `
        CREATE TABLE IF NOT EXISTS "WatchlistItem" (
          "symbol"  TEXT        PRIMARY KEY,
          "addedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
    },
    {
      name: "ScannerUniverse",
      sql: `
        CREATE TABLE IF NOT EXISTS "ScannerUniverse" (
          "symbol"     TEXT        PRIMARY KEY,
          "securityId" INTEGER     NOT NULL UNIQUE,
          "name"       TEXT        NOT NULL,
          "sector"     TEXT,
          "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS "ScannerUniverse_securityId_idx" ON "ScannerUniverse"("securityId")`,
    },
    {
      name: "DailyMetrics",
      sql: `
        CREATE TABLE IF NOT EXISTS "DailyMetrics" (
          "symbol"   TEXT             NOT NULL,
          "date"     TEXT             NOT NULL,
          "close"    DOUBLE PRECISION NOT NULL,
          "ema20"    DOUBLE PRECISION NOT NULL,
          "ema50"    DOUBLE PRECISION,
          "rsi14"    DOUBLE PRECISION NOT NULL,
          "avgVol20" DOUBLE PRECISION NOT NULL,
          "high20d"  DOUBLE PRECISION NOT NULL,
          "preScore" INTEGER          NOT NULL,
          "orbHigh"  DOUBLE PRECISION,
          "orbLow"   DOUBLE PRECISION,
          PRIMARY KEY ("symbol", "date")
        );
        CREATE INDEX IF NOT EXISTS "DailyMetrics_date_preScore_idx" ON "DailyMetrics"("date", "preScore" DESC)`,
    },
  ];

  let failed = 0;

  for (const table of tables) {
    try {
      // Split on semicolons to run multiple statements (index creation)
      const statements = table.sql.split(";").map(s => s.trim()).filter(Boolean);
      for (const stmt of statements) {
        await prisma.$executeRawUnsafe(stmt);
      }
      results[table.name] = "ok";
    } catch (e) {
      results[table.name] = `error: ${e instanceof Error ? e.message : String(e)}`;
      failed++;
    }
  }

  return NextResponse.json({
    success: failed === 0,
    tables:  results,
    created: Object.values(results).filter(v => v === "ok").length,
    failed,
  });
}

// GET — check which tables exist
export async function GET() {
  const checks = {
    DhanToken:       false,
    Instrument:      false,
    WatchlistItem:   false,
    ScannerUniverse: false,
    DailyMetrics:    false,
  };

  await Promise.all(
    (Object.keys(checks) as (keyof typeof checks)[]).map(async (table) => {
      try {
        await prisma.$executeRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`);
        checks[table] = true;
      } catch {
        checks[table] = false;
      }
    }),
  );

  const allReady = Object.values(checks).every(Boolean);
  return NextResponse.json({ allReady, tables: checks });
}
