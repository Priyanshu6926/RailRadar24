import { NextRequest } from 'next/server';
import { getTrainsBetween } from '@/lib/railradar';
import { getCached, setCached } from '@/lib/cache';
import { jsonOk, jsonFail } from '@/lib/api-response';
import { TrainsBetweenData } from '@/types/train';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = (searchParams.get('from') || '').trim().toUpperCase();
  const to = (searchParams.get('to') || '').trim().toUpperCase();

  if (!from || !to || !/^[A-Z]{2,8}$/.test(from) || !/^[A-Z]{2,8}$/.test(to)) {
    return jsonFail('Valid "from" and "to" station codes (2-8 letters) are required', 400);
  }

  const cacheKey = `planner:${from}:${to}`;
  const cached = getCached<TrainsBetweenData>(cacheKey);
  if (cached) {
    return jsonOk(cached, true, 200, 'live');
  }

  try {
    const data = await getTrainsBetween(from, to);
    setCached(cacheKey, data, 3600); // 1 hour cache

    return jsonOk(data, false, 200, 'live');
  } catch (err: any) {
    console.error('[api/planner]', err);
    return jsonFail('Failed to find trains between stations', 500);
  }
}

