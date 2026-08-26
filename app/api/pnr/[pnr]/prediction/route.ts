import { NextRequest, NextResponse } from 'next/server';
import { getPNRPrediction } from '@/lib/railradar';
import { getCached, setCached } from '@/lib/cache';
import { ApiResponse } from '@/types/api';
import { PNRPredictionData } from '@/types/train';

export async function GET(
  request: NextRequest,
  { params }: { params: { pnr: string } }
) {
  const pnr = params.pnr.replace(/\D/g, '');
  if (!pnr || pnr.length !== 10) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Please provide a valid 10-digit PNR number', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }

  const cacheKey = `pnr:pred:${pnr}`;
  const cached = getCached<PNRPredictionData>(cacheKey);
  if (cached) {
    return NextResponse.json<ApiResponse<PNRPredictionData>>({
      success: true,
      data: cached,
      cached: true,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const data = await getPNRPrediction(pnr);
    setCached(cacheKey, data, 300); // 5 mins cache

    return NextResponse.json<ApiResponse<PNRPredictionData>>({
      success: true,
      data,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: err.message || 'Failed to fetch PNR prediction', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
