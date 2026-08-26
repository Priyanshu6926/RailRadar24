import { NextRequest, NextResponse } from 'next/server';
import { getStationLiveBoard } from '@/lib/railradar';
import { getCached, setCached } from '@/lib/cache';
import { ApiResponse } from '@/types/api';
import { StationBoardData } from '@/types/train';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> | { code: string } }
) {
  const resolvedParams = await Promise.resolve(params);
  const code = (resolvedParams?.code || '').trim().toUpperCase();
  const { searchParams } = new URL(request.url);
  const hours = parseInt(searchParams.get('hours') || '4', 10);

  if (!code) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Station code is required', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }

  const cacheKey = `station:live:${code}:${hours}`;
  const cached = getCached<StationBoardData>(cacheKey);
  if (cached) {
    return NextResponse.json<ApiResponse<StationBoardData>>({
      success: true,
      data: cached,
      cached: true,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const data = await getStationLiveBoard(code, hours);
    setCached(cacheKey, data, 60); // 1 min cache for live board

    return NextResponse.json<ApiResponse<StationBoardData>>({
      success: true,
      data,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: err.message || 'Failed to fetch live station departures', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
