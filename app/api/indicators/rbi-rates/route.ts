import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchRBIRates, fetchRBIRateHistory } from "@/lib/fetchers/rbi";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [current, history] = await Promise.all([
    fetchRBIRates(),
    fetchRBIRateHistory(),
  ]);

  return NextResponse.json({ current, history, updatedAt: new Date().toISOString() });
}
