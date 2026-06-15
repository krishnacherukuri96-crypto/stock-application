import { NextRequest, NextResponse } from "next/server";
import { getDhanToken } from "@/lib/dhan";

// Nifty 50 stocks with Dhan Security IDs (NSE_EQ segment)
// Verify / update IDs from: https://images.dhan.co/api-data/api-scrip-master.csv
const WATCHLIST = [
  { symbol: "RELIANCE",    name: "Reliance Industries",   id: 2885  },
  { symbol: "TCS",         name: "TCS",                   id: 11536 },
  { symbol: "HDFCBANK",    name: "HDFC Bank",             id: 1333  },
  { symbol: "INFY",        name: "Infosys",               id: 1594  },
  { symbol: "ICICIBANK",   name: "ICICI Bank",            id: 4963  },
  { symbol: "HINDUNILVR",  name: "Hindustan Unilever",    id: 1394  },
  { symbol: "ITC",         name: "ITC",                   id: 1660  },
  { symbol: "SBIN",        name: "State Bank of India",   id: 3045  },
  { symbol: "BHARTIARTL",  name: "Bharti Airtel",         id: 10604 },
  { symbol: "BAJFINANCE",  name: "Bajaj Finance",         id: 317   },
  { symbol: "KOTAKBANK",   name: "Kotak Mahindra Bank",   id: 1922  },
  { symbol: "LT",          name: "Larsen & Toubro",       id: 11483 },
  { symbol: "HCLTECH",     name: "HCL Technologies",      id: 1232  },
  { symbol: "MARUTI",      name: "Maruti Suzuki",         id: 10999 },
  { symbol: "TITAN",       name: "Titan Company",         id: 3506  },
  { symbol: "AXISBANK",    name: "Axis Bank",             id: 5900  },
  { symbol: "ASIANPAINT",  name: "Asian Paints",          id: 236   },
  { symbol: "WIPRO",       name: "Wipro",                 id: 3787  },
  { symbol: "NTPC",        name: "NTPC",                  id: 11630 },
  { symbol: "ONGC",        name: "ONGC",                  id: 11262 },
  { symbol: "SUNPHARMA",   name: "Sun Pharma",            id: 3351  },
  { symbol: "TATAMOTORS",  name: "Tata Motors",           id: 3456  },
  { symbol: "JSWSTEEL",    name: "JSW Steel",             id: 11723 },
  { symbol: "TATASTEEL",   name: "Tata Steel",            id: 3499  },
  { symbol: "BAJAJ-AUTO",  name: "Bajaj Auto",            id: 16669 },
  { symbol: "DRREDDY",     name: "Dr. Reddy's Labs",      id: 881   },
  { symbol: "CIPLA",       name: "Cipla",                 id: 694   },
  { symbol: "HEROMOTOCO",  name: "Hero MotoCorp",         id: 1348  },
  { symbol: "COALINDIA",   name: "Coal India",            id: 20374 },
  { symbol: "INDUSINDBK",  name: "IndusInd Bank",         id: 5258  },
  { symbol: "HINDALCO",    name: "Hindalco Industries",   id: 1363  },
  { symbol: "BPCL",        name: "BPCL",                  id: 526   },
  { symbol: "MM",          name: "Mahindra & Mahindra",   id: 2031  },
  { symbol: "ADANIENT",    name: "Adani Enterprises",     id: 25    },
  { symbol: "ADANIPORTS",  name: "Adani Ports",           id: 15083 },
  { symbol: "ULTRACEMCO",  name: "UltraTech Cement",      id: 11532 },
  { symbol: "TECHM",       name: "Tech Mahindra",         id: 13538 },
  { symbol: "GRASIM",      name: "Grasim Industries",     id: 1208  },
  { symbol: "DIVISLAB",    name: "Divi's Laboratories",   id: 10940 },
  { symbol: "BRITANNIA",   name: "Britannia Industries",  id: 547   },
];

export type MomentumStatus = "running" | "fading" | "reversing" | "flat" | "falling";

export interface MomentumStock {
  symbol: string;
  name: string;
  ltp: number;
  open: number;
  prevClose: number;
  high: number;
  low: number;
  volume: number;
  pctChange: number;     // % from prev close
  openGap: number;       // % gap: open vs prev close
  fromOpen: number;      // % move from today's open to now
  highProximity: number; // 0–1 (1 = at day high, 0 = at day low)
  momentumScore: number; // composite score for sorting
  status: MomentumStatus;
}

function classify(
  ltp: number,
  open: number,
  prevClose: number,
  high: number,
  low: number,
  volume: number,
): Omit<MomentumStock, "symbol" | "name"> {
  const safe       = (x: number) => (isFinite(x) ? x : 0);
  const pctChange  = safe(prevClose > 0 ? ((ltp - prevClose) / prevClose) * 100 : 0);
  const openGap    = safe(prevClose > 0 ? ((open - prevClose) / prevClose) * 100 : 0);
  const fromOpen   = safe(open > 0 ? ((ltp - open) / open) * 100 : 0);
  const range      = high - low;
  const highProximity = safe(range > 0 ? (ltp - low) / range : 0.5);

  // Score = direction (capped ±5) + range position bonus (-2 to +2)
  // High score: gaining AND near day high → momentum intact
  // Low score: down OR far from high → momentum gone
  const dirScore     = Math.max(-5, Math.min(5, pctChange));
  const rangeScore   = (highProximity - 0.5) * 4;
  const momentumScore = parseFloat((dirScore + rangeScore).toFixed(2));

  let status: MomentumStatus;
  if (pctChange >= 1.5 && highProximity >= 0.65)      status = "running";
  else if (pctChange >= 0.3 && highProximity < 0.4)   status = "fading";
  else if (pctChange < -1 && highProximity < 0.35)    status = "falling";
  else if (pctChange < 0 && highProximity < 0.35)     status = "reversing";
  else                                                  status = "flat";

  return {
    ltp, open, prevClose, high, low, volume,
    pctChange: parseFloat(pctChange.toFixed(2)),
    openGap:   parseFloat(openGap.toFixed(2)),
    fromOpen:  parseFloat(fromOpen.toFixed(2)),
    highProximity: parseFloat(highProximity.toFixed(3)),
    momentumScore,
    status,
  };
}

function isMarketOpen(): boolean {
  const ist  = new Date(Date.now() + 5.5 * 3600 * 1000);
  const day  = ist.getUTCDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return mins >= 555 && mins <= 930; // 9:15–15:30 IST
}

// Safely extract a number from a raw Dhan field regardless of key name
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick(d: any, ...keys: string[]): number {
  for (const k of keys) {
    const v = d[k];
    if (v !== undefined && v !== null && isFinite(Number(v))) return Number(v);
  }
  return 0;
}

export async function GET(req: NextRequest) {
  const debug = req.nextUrl.searchParams.get("debug") === "true";
  const creds = await getDhanToken();

  if (!creds) {
    return NextResponse.json(
      { error: "Dhan not connected. Go to Settings → Connect Dhan Account." },
      { status: 503 },
    );
  }

  const { token, clientId } = creds;

  try {
    const res = await fetch("https://api.dhan.co/v2/marketfeed/ohlc", {
      method: "POST",
      headers: {
        "access-token":  token,
        "client-id":     clientId,
        "Content-Type":  "application/json",
        "Accept":        "application/json",
      },
      body: JSON.stringify({ NSE_EQ: WATCHLIST.map(s => s.id) }),
      cache: "no-store",
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Dhan API ${res.status}: ${txt}`);
    }

    const json = await res.json();

    // Return raw response when ?debug=true so we can inspect actual field names
    if (debug) return NextResponse.json(json);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: Record<string, any> = json?.data?.NSE_EQ ?? {};

    const stocks: MomentumStock[] = WATCHLIST
      .filter(s => raw[String(s.id)])
      .map(s => {
        const d = raw[String(s.id)];
        // Handle multiple possible field names Dhan may use
        const ltp       = pick(d, "last_price", "LTP", "lastPrice", "ltp");
        const open      = pick(d, "open", "openPrice", "open_price");
        const prevClose = pick(d, "close", "prev_close", "previousClose", "prevClose");
        const high      = pick(d, "high", "highPrice", "high_price", "dayHigh");
        const low       = pick(d, "low",  "lowPrice",  "low_price",  "dayLow");
        const volume    = pick(d, "volume", "totalTradedQuantity", "tot_tradedQty", "tradedVolume");
        return {
          symbol: s.symbol,
          name: s.name,
          ...classify(ltp, open, prevClose, high, low, volume),
        };
      })
      .sort((a, b) => b.momentumScore - a.momentumScore);

    return NextResponse.json({
      stocks,
      fetchedAt:   new Date().toISOString(),
      marketOpen:  isMarketOpen(),
      total:       stocks.length,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
