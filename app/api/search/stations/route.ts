import { NextRequest, NextResponse } from 'next/server';
import { searchStations } from '@/lib/railradar';
import { ApiResponse } from '@/types/api';
import { StationSearchResult } from '@/types/train';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';

  try {
    const stations = await searchStations(q);
    return NextResponse.json<ApiResponse<StationSearchResult[]>>({
      success: true,
      data: stations,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: err.message || 'Station search failed', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
