import { NextRequest, NextResponse } from 'next/server';
import { getTrainsBetween } from '@/lib/railradar';
import { getCached, setCached } from '@/lib/cache';
import { ApiResponse } from '@/types/api';
import { TrainsBetweenData } from '@/types/train';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Both "from" and "to" station codes are required', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }

  const cacheKey = `planner:${from.toUpperCase()}:${to.toUpperCase()}`;
  const cached = getCached<TrainsBetweenData>(cacheKey);
  if (cached) {
    return NextResponse.json<ApiResponse<TrainsBetweenData>>({
      success: true,
      data: cached,
      cached: true,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const data = await getTrainsBetween(from, to);
    setCached(cacheKey, data, 3600); // 1 hour cache

    return NextResponse.json<ApiResponse<TrainsBetweenData>>({
      success: true,
      data,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: err.message || 'Failed to find trains between stations', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
