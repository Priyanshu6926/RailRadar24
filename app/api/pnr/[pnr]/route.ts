import { NextRequest, NextResponse } from 'next/server';
import { getPNRStatus } from '@/lib/railradar';
import { getCached, setCached } from '@/lib/cache';
import { ApiResponse } from '@/types/api';
import { PNRStatusData } from '@/types/train';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pnr: string }> }
) {
  const { pnr: rawPnr } = await params;
  const pnr = (rawPnr || '').replace(/\D/g, '');
  if (!pnr || pnr.length !== 10) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Please provide a valid 10-digit PNR number', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }

  const cacheKey = `pnr:${pnr}`;
  const cached = getCached<PNRStatusData>(cacheKey);
  if (cached) {
    return NextResponse.json<ApiResponse<PNRStatusData>>({
      success: true,
      data: cached,
      cached: true,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const data = await getPNRStatus(pnr);
    setCached(cacheKey, data, 120); // 2 mins cache

    return NextResponse.json<ApiResponse<PNRStatusData>>({
      success: true,
      data,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: err.message || 'Failed to fetch PNR status', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
