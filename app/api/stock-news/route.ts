import { NextRequest, NextResponse } from "next/server";

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string; // ISO string
}

const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; research-dashboard/1.0)",
  Accept: "application/json",
};

async function fetchYahooNews(symbol: string): Promise<NewsItem[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&newsCount=4&enableFuzzyQuery=false&region=IN&lang=en-US`;
  const res = await fetch(url, { headers: YF_HEADERS, cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (json?.news ?? []).map((item: any) => ({
    id: item.uuid ?? item.link,
    title: (item.title ?? "").trim(),
    link: item.link ?? "",
    source: item.publisher ?? "Yahoo Finance",
    publishedAt: item.providerPublishTime
      ? new Date(item.providerPublishTime * 1000).toISOString()
      : new Date().toISOString(),
  })).filter((n: NewsItem) => n.title && n.link);
}

async function fetchETNews(): Promise<NewsItem[]> {
  const res = await fetch(
    "https://economictimes.indiatimes.com/markets/stocks/rss.cms",
    { headers: { "User-Agent": "Mozilla/5.0 (compatible; research-dashboard/1.0)" }, cache: "no-store" }
  );
  if (!res.ok) return [];
  const xml = await res.text();
  const items: NewsItem[] = [];
  const rawItems = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  for (const raw of rawItems.slice(0, 12)) {
    const titleMatch = raw.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const linkMatch  = raw.match(/<link>([^<]+)<\/link>/);
    const dateMatch  = raw.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    if (titleMatch?.[1] && linkMatch?.[1]) {
      const pubDate = dateMatch?.[1]?.trim();
      items.push({
        id: linkMatch[1].trim(),
        title: titleMatch[1].trim(),
        link: linkMatch[1].trim(),
        source: "Economic Times",
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      });
    }
  }
  return items;
}

export async function GET(req: NextRequest) {
  const symbols = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbolList = symbols.split(",").filter(Boolean).slice(0, 5);

  let news: NewsItem[] = [];

  if (symbolList.length > 0) {
    try {
      const results = await Promise.all(symbolList.map(fetchYahooNews));
      news = results.flat();

      // Deduplicate
      const seen = new Set<string>();
      news = news.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });

      news.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      news = news.slice(0, 12);
    } catch {
      news = [];
    }
  }

  // Fall back to ET Markets RSS if Yahoo returned too few results
  if (news.length < 3) {
    try {
      news = await fetchETNews();
    } catch {
      // return whatever we have
    }
  }

  return NextResponse.json({ news });
}
