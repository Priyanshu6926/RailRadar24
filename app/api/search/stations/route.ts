import { NextRequest } from 'next/server';
import { searchStations } from '@/lib/railradar';
import { getCached, setCached } from '@/lib/cache';
import { jsonOk, jsonFail } from '@/lib/api-response';
import { StationSearchResult } from '@/types/train';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim().slice(0, 40);

  const cacheKey = `search:stations:${q.toLowerCase()}`;
  const cached = getCached<StationSearchResult[]>(cacheKey);
  if (cached) {
    return jsonOk(cached, true, 200, 'live');
  }

  try {
    const stations = await searchStations(q);
    setCached(cacheKey, stations, q ? 600 : 120);

    return jsonOk(stations, false, 200, 'live');
  } catch (err: any) {
    console.error('[api/search/stations]', err);
    return jsonFail('Station search failed', 500);
  }
}

