import { NextRequest } from 'next/server';
import { getStationLiveBoard } from '@/lib/railradar';
import { getCached, setCached } from '@/lib/cache';
import { jsonOk, jsonFail } from '@/lib/api-response';
import { StationBoardData } from '@/types/train';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> | { code: string } }
) {
  const resolvedParams = await Promise.resolve(params);
  const code = (resolvedParams?.code || '').trim().toUpperCase();
  const { searchParams } = new URL(request.url);
  const rawHours = searchParams.get('hours');
  const hours = Math.min(24, Math.max(1, Number(rawHours) || 4));

  if (!code || !/^[A-Z]{2,8}$/.test(code)) {
    return jsonFail('Valid station code (2-8 letters) is required', 400);
  }

  const cacheKey = `station:live:${code}:${hours}`;
  const cached = getCached<StationBoardData>(cacheKey);
  if (cached) {
    return jsonOk(cached, true, 200, 'live');
  }

  try {
    const data = await getStationLiveBoard(code, hours);
    if (!data) {
      return jsonFail('Live station departures unavailable', 404);
    }
    setCached(cacheKey, data, 60); // 1 min cache for live board

    return jsonOk(data, false, 200, 'live');
  } catch (err: any) {
    console.error('[api/stations/code/live]', err);
    return jsonFail('Failed to fetch live station departures', 500);
  }
}

