import { NextRequest } from 'next/server';
import { searchTrains } from '@/lib/railradar';
import { searchLocalTrains } from '@/lib/trains-db';
import { getCached, setCached } from '@/lib/cache';
import { jsonOk, jsonFail } from '@/lib/api-response';
import { SearchResult } from '@/types/train';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get('query') || '';
  const query = rawQuery.trim().slice(0, 40);
  const cacheKey = `search:${query.toLowerCase()}`;

  const cached = getCached<SearchResult[]>(cacheKey);
  if (cached) {
    return jsonOk(cached, true, 200, 'live');
  }

  try {
    const results = await searchTrains(query);
    setCached(cacheKey, results, query ? 600 : 120);

    return jsonOk(results, false, 200, 'live');
  } catch (err: any) {
    console.warn('[/api/search] RailRadar search failed, falling back to local DB:', err?.message);

    // Fallback to local offline train DB if RailRadar network request fails or times out
    const localResults = searchLocalTrains(query).map((t) => ({
      id: t.number,
      number: t.number,
      name: t.name,
      origin: { code: t.fromCode, name: t.from },
      destination: { code: t.toCode, name: t.to },
    }));

    return jsonOk(localResults, false, 200, 'fallback');
  }
}

