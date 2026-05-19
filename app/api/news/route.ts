import { NextRequest, NextResponse } from 'next/server';

const cache = new Map<string, { data: any; ts: number }>();
const CACHE_MS = 5 * 60_000;

export async function GET(req: NextRequest) {
  const symbols = req.nextUrl.searchParams.get('symbols')?.split(',') || [];
  const cacheKey = `news:${symbols.join(',') || 'market'}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const key = process.env.FINNHUB_API_KEY;
    if (!key) throw new Error('FINNHUB_API_KEY not configured');

    let articles: any[] = [];

    if (symbols.length > 0) {
      // Company news per symbol
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fromStr = weekAgo.toISOString().split('T')[0];
      const toStr = today.toISOString().split('T')[0];

      const allNews = await Promise.all(
        symbols.slice(0, 5).map(async (sym) => {
          try {
            const r = await fetch(
              `https://finnhub.io/api/v1/company-news?symbol=${sym}&from=${fromStr}&to=${toStr}&token=${key}`,
              { next: { revalidate: 300 } }
            );
            if (!r.ok) return [];
            const items = await r.json();
            return items.slice(0, 5).map((n: any) => ({ ...n, tickers: [sym] }));
          } catch {
            return [];
          }
        })
      );
      articles = allNews.flat();
    } else {
      // General market news
      const r = await fetch(
        `https://finnhub.io/api/v1/news?category=general&token=${key}`,
        { next: { revalidate: 300 } }
      );
      if (r.ok) {
        articles = await r.json();
        articles = articles.slice(0, 20).map((n: any) => ({ ...n, tickers: [] }));
      }
    }

    // Normalize and sort by datetime desc
    const normalized = articles
      .map((n: any) => ({
        id: n.id || `${n.source}-${n.datetime}`,
        source: n.source,
        headline: n.headline,
        summary: n.summary,
        url: n.url,
        datetime: n.datetime * 1000,
        tickers: n.tickers || (n.related ? n.related.split(',') : []),
        sentiment: classifySentiment(n.headline),
      }))
      .sort((a, b) => b.datetime - a.datetime)
      .slice(0, 25);

    const payload = { articles: normalized, asOf: Date.now() };
    cache.set(cacheKey, { data: payload, ts: Date.now() });
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Lightweight keyword sentiment - swap for Claude classification in v2
function classifySentiment(headline: string): 'pos' | 'neg' | 'neu' {
  const h = headline.toLowerCase();
  const pos = ['beat', 'beats', 'surge', 'surges', 'rally', 'soar', 'jumps', 'gain', 'gains', 'record', 'high', 'upgrade', 'strong', 'growth', 'profit'];
  const neg = ['miss', 'misses', 'fall', 'falls', 'plunge', 'slump', 'drop', 'cut', 'cuts', 'loss', 'losses', 'downgrade', 'weak', 'concern', 'concerns', 'lawsuit', 'probe', 'investigation'];

  let score = 0;
  pos.forEach((w) => { if (h.includes(w)) score++; });
  neg.forEach((w) => { if (h.includes(w)) score--; });

  if (score > 0) return 'pos';
  if (score < 0) return 'neg';
  return 'neu';
}
