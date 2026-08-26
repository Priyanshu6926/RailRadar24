import { NextRequest, NextResponse } from 'next/server';
import { getTrainFare } from '@/lib/railradar';
import { getCached, setCached } from '@/lib/cache';
import { ApiResponse } from '@/types/api';
import { TrainFareData } from '@/types/train';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trainNumber = searchParams.get('trainNumber');
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;

  if (!trainNumber) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'trainNumber query parameter is required', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }

  const cacheKey = `fare:${trainNumber}:${from || ''}:${to || ''}`;
  const cached = getCached<TrainFareData>(cacheKey);
  if (cached) {
    return NextResponse.json<ApiResponse<TrainFareData>>({
      success: true,
      data: cached,
      cached: true,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const data = await getTrainFare(trainNumber, from, to);
    setCached(cacheKey, data, 3600); // 1h cache

    return NextResponse.json<ApiResponse<TrainFareData>>({
      success: true,
      data,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: err.message || 'Failed to fetch train fares', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
