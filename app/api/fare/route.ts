import { NextRequest } from 'next/server';
import { getTrainFare } from '@/lib/railradar';
import { getCached, setCached } from '@/lib/cache';
import { jsonOk, jsonFail } from '@/lib/api-response';
import { TrainFareData } from '@/types/train';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trainNumber = searchParams.get('trainNumber');
  const from = searchParams.get('from')?.trim().toUpperCase() || undefined;
  const to = searchParams.get('to')?.trim().toUpperCase() || undefined;

  if (!trainNumber || !/^\d{4,5}$/.test(trainNumber.trim())) {
    return jsonFail('Valid 4 or 5 digit trainNumber is required', 400);
  }

  const cleanTrainNumber = trainNumber.trim();
  const cacheKey = `fare:${cleanTrainNumber}:${from || ''}:${to || ''}`;
  const cached = getCached<TrainFareData>(cacheKey);
  if (cached) {
    return jsonOk(cached, true, 200, 'live');
  }

  try {
    const data = await getTrainFare(cleanTrainNumber, from, to);
    if (!data) {
      return jsonFail('Fare data unavailable for train', 404);
    }
    setCached(cacheKey, data, 3600); // 1h cache

    return jsonOk(data, false, 200, 'live');
  } catch (err: any) {
    console.error('[api/fare]', err);
    return jsonFail('Failed to fetch train fares', 500);
  }
}

