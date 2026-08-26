import { NextRequest, NextResponse } from 'next/server';
import { getSeatAvailability } from '@/lib/railradar';
import { getCached, setCached } from '@/lib/cache';
import { ApiResponse } from '@/types/api';
import { SeatAvailabilityData } from '@/types/train';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trainNumber = searchParams.get('trainNumber');
  const from = searchParams.get('from') || 'MMCT';
  const to = searchParams.get('to') || 'NDLS';
  const classCode = searchParams.get('class') || '3A';
  const quota = searchParams.get('quota') || 'GN';

  if (!trainNumber) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'trainNumber is required', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }

  const cacheKey = `seats:${trainNumber}:${from}:${to}:${classCode}:${quota}`;
  const cached = getCached<SeatAvailabilityData>(cacheKey);
  if (cached) {
    return NextResponse.json<ApiResponse<SeatAvailabilityData>>({
      success: true,
      data: cached,
      cached: true,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const data = await getSeatAvailability(trainNumber, from, to, classCode, quota);
    setCached(cacheKey, data, 600); // 10 mins cache

    return NextResponse.json<ApiResponse<SeatAvailabilityData>>({
      success: true,
      data,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: err.message || 'Failed to fetch seat availability', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
