import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchInflationWorldBank } from "@/lib/fetchers/worldbank";
import { fetchCPI } from "@/lib/fetchers/mospi";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [annual, monthly] = await Promise.all([
    fetchInflationWorldBank(),
    fetchCPI(),
  ]);

  return NextResponse.json({ annual, monthly, updatedAt: new Date().toISOString() });
}
