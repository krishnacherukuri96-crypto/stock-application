import { NextRequest } from "next/server";
import { getDhanToken } from "@/lib/dhan";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300; // 5 min; client auto-reconnects after

function todayIST(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

// ── Binary packet parser ─────────────────────────────────────────────────────
// Dhan v2 market feed binary format (big-endian):
//  [0]    uint8   feed_response_type  (2=Ticker, 4=Quote, 6=PrevClose, 8=OI)
//  [1-2]  uint16  message_length
//  [3-4]  uint16  exchange_segment
//  [5-8]  uint32  security_id
//  [9-12] float32 LTP
//  -- Quote (type 4) continues: --
//  [13-16] float32 avg_trade_price (VWAP)
//  [17-20] uint32  volume
//  [21-24] uint32  total_sell_qty
//  [25-28] uint32  total_buy_qty
//  [29-32] float32 open
//  [33-36] float32 high
//  [37-40] float32 low
//  [41-44] float32 prev_close
function parseDhanPacket(buf: Buffer): { securityId: number; ltp: number; volume: number; vwap: number; open: number; high: number; low: number; prevClose: number } | null {
  try {
    if (buf.length < 13) return null;
    const type = buf.readUInt8(0);

    // Ticker packet — only LTP
    if (type === 2 && buf.length >= 13) {
      return {
        securityId: buf.readUInt32BE(5),
        ltp:        buf.readFloatBE(9),
        volume: 0, vwap: 0, open: 0, high: 0, low: 0, prevClose: 0,
      };
    }

    // Quote packet — full OHLCV + VWAP
    if (type === 4 && buf.length >= 45) {
      return {
        securityId: buf.readUInt32BE(5),
        ltp:        buf.readFloatBE(9),
        vwap:       buf.readFloatBE(13),
        volume:     buf.readUInt32BE(17),
        open:       buf.readFloatBE(29),
        high:       buf.readFloatBE(33),
        low:        buf.readFloatBE(37),
        prevClose:  buf.readFloatBE(41),
      };
    }
    return null;
  } catch {
    return null;
  }
}

// GET /api/scanner/stream — SSE endpoint
// Server maintains Dhan WebSocket, pushes parsed price ticks to browser via SSE
export async function GET(req: NextRequest) {
  const debug = req.nextUrl.searchParams.get("debug") === "1";

  const creds = await getDhanToken();
  if (!creds) {
    return new Response("data: " + JSON.stringify({ error: "Dhan not connected" }) + "\n\n", {
      status: 503,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const date = todayIST();

  const [metrics, universe] = await Promise.all([
    prisma.dailyMetrics.findMany({
      where: { date },
      orderBy: { preScore: "desc" },
      take: 100,
      select: { symbol: true },
    }),
    prisma.scannerUniverse.findMany({
      select: { symbol: true, securityId: true },
    }),
  ]);

  if (metrics.length === 0) {
    return new Response(
      "data: " + JSON.stringify({ event: "premarket_needed" }) + "\n\n",
      { headers: { "Content-Type": "text/event-stream" } },
    );
  }

  const symSet   = new Set(metrics.map(m => m.symbol));
  const secIdMap = new Map(
    universe
      .filter(u => symSet.has(u.symbol))
      .map(u => [u.securityId, u.symbol]),
  );
  const securityIds = Array.from(secIdMap.keys());

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try { controller.enqueue(encoder.encode("data: " + JSON.stringify(obj) + "\n\n")); }
        catch { /* client disconnected */ }
      };

      // Heartbeat every 25s keeps SSE alive through proxies
      const heartbeat = setInterval(() => send({ event: "ping" }), 25_000);

      let closed = false;

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { WebSocket: NodeWS } = require("ws") as typeof import("ws");

      const ws = new NodeWS("wss://api-feed.dhan.co", {
        headers: {
          "access-token": creds.token,
          "client-id":    creds.clientId,
        },
      });

      ws.on("open", () => {
        send({ event: "connected" });
        ws.send(JSON.stringify({
          RequestCode:     15, // Subscribe Quote
          InstrumentCount: securityIds.length,
          InstrumentList:  securityIds.map(id => ({
            ExchangeSegment: "NSE_EQ",
            SecurityId:      String(id),
          })),
        }));
      });

      ws.on("message", (data: Buffer) => {
        if (closed) return;
        if (debug) {
          // Raw hex dump for format verification
          send({ event: "raw", len: data.length, hex: data.slice(0, 52).toString("hex") });
          return;
        }
        const parsed = parseDhanPacket(data);
        if (!parsed) return;
        const symbol = secIdMap.get(parsed.securityId);
        if (!symbol) return;
        // Sanity-check: discard clearly wrong prices (NaN, 0, or extreme values)
        if (!isFinite(parsed.ltp) || parsed.ltp <= 0 || parsed.ltp > 1_000_000) return;
        send({ symbol, ...parsed });
      });

      ws.on("close", (code: number) => {
        closed = true;
        clearInterval(heartbeat);
        send({ event: "disconnected", code });
        try { controller.close(); } catch { /* already closed */ }
      });

      ws.on("error", (err: Error) => {
        send({ event: "error", message: err.message });
        ws.close();
      });

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
        try { ws.close(1000, "client disconnect"); } catch { /* ok */ }
        try { controller.close(); } catch { /* ok */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no", // disable Nginx buffering
    },
  });
}
