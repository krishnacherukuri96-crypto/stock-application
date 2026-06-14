import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchFiscalData } from "@/lib/fetchers/fiscal";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await fetchFiscalData();
  return NextResponse.json({ data, updatedAt: new Date().toISOString() });
}
