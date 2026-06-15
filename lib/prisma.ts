import { PrismaClient } from "@prisma/client";

// Supabase Transaction Pooler (port 6543) uses PgBouncer in transaction mode,
// which doesn't support prepared statements. pgbouncer=true disables them in Prisma.
function withPgBouncer(url: string) {
  if (!url || url.includes("pgbouncer=true")) return url;
  if (url.includes(":6543/")) {
    return url.includes("?") ? `${url}&pgbouncer=true` : `${url}?pgbouncer=true`;
  }
  return url;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  directPrisma: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: { db: { url: withPgBouncer(process.env.DATABASE_URL ?? "") } },
  });

// Direct connection (bypasses PgBouncer) — use for DDL and migration-style queries.
export const directPrisma =
  globalForPrisma.directPrisma ||
  new PrismaClient({
    log: ["error"],
    datasources: {
      db: { url: process.env.DIRECT_URL || withPgBouncer(process.env.DATABASE_URL ?? "") },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.directPrisma = directPrisma;
}
