import { NextRequest } from 'next/server';
import { getSeatAvailability } from '@/lib/railradar';
import { getCached, setCached } from '@/lib/cache';
import { jsonOk, jsonFail } from '@/lib/api-response';
import { SeatAvailabilityData } from '@/types/train';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trainNumber = searchParams.get('trainNumber');
  const from = (searchParams.get('from') || 'MMCT').toUpperCase().trim();
  const to = (searchParams.get('to') || 'NDLS').toUpperCase().trim();
  const classCode = (searchParams.get('class') || '3A').toUpperCase().trim();
  const quota = (searchParams.get('quota') || 'GN').toUpperCase().trim();

  if (!trainNumber || !/^\d{4,5}$/.test(trainNumber.trim())) {
    return jsonFail('Valid 4 or 5 digit trainNumber is required', 400);
  }

  const cleanTrainNumber = trainNumber.trim();
  const cacheKey = `seats:${cleanTrainNumber}:${from}:${to}:${classCode}:${quota}`;
  const cached = getCached<SeatAvailabilityData>(cacheKey);
  if (cached) {
    return jsonOk(cached, true, 200, 'live');
  }

  try {
    const data = await getSeatAvailability(cleanTrainNumber, from, to, classCode, quota);
    if (!data) {
      return jsonFail('Seat availability data unavailable', 404);
    }
    setCached(cacheKey, data, 600); // 10 mins cache

    return jsonOk(data, false, 200, 'live');
  } catch (err: any) {
    console.error('[api/seats]', err);
    return jsonFail('Failed to fetch seat availability', 500);
  }
}

