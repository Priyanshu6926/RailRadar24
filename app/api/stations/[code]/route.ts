import { NextRequest } from 'next/server';
import { getStationBoard } from '@/lib/railradar';
import { getCached, setCached } from '@/lib/cache';
import { jsonOk, jsonFail } from '@/lib/api-response';
import { StationBoardData } from '@/types/train';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> | { code: string } }
) {
  const resolvedParams = await Promise.resolve(params);
  const code = (resolvedParams?.code || '').trim().toUpperCase();
  if (!code || !/^[A-Z]{2,8}$/.test(code)) {
    return jsonFail('Valid station code (2-8 letters) is required', 400);
  }

  const cacheKey = `station:board:${code}`;
  const cached = getCached<StationBoardData>(cacheKey);
  if (cached) {
    return jsonOk(cached, true, 200, 'live');
  }

  try {
    const data = await getStationBoard(code);
    if (!data) {
      return jsonFail('Station timetable board unavailable', 404);
    }
    setCached(cacheKey, data, 180); // 3 mins cache

    return jsonOk(data, false, 200, 'live');
  } catch (err: any) {
    console.error('[api/stations/code]', err);
    return jsonFail('Failed to fetch station timetable board', 500);
  }
}

