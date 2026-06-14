import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchIIP } from "@/lib/fetchers/mospi";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await fetchIIP();
  return NextResponse.json({ data, updatedAt: new Date().toISOString() });
}
