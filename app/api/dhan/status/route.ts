import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const token = await prisma.dhanToken.findUnique({ where: { id: "singleton" } });
    if (!token) return NextResponse.json({ connected: false });

    const msLeft     = token.expiresAt.getTime() - Date.now();
    const hoursLeft  = Math.max(0, Math.floor(msLeft / 3600000));
    const isExpired  = msLeft <= 0;

    return NextResponse.json({
      connected:  true,
      clientId:   token.clientId,
      expiresAt:  token.expiresAt.toISOString(),
      hoursLeft,
      isExpired,
      updatedAt:  token.updatedAt.toISOString(),
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

export async function DELETE() {
  try {
    await prisma.dhanToken.delete({ where: { id: "singleton" } });
  } catch { /* already deleted */ }
  return NextResponse.json({ ok: true });
}
