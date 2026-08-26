import { NextRequest, NextResponse } from 'next/server';
import { getPNRRefund } from '@/lib/railradar';
import { getCached, setCached } from '@/lib/cache';
import { ApiResponse } from '@/types/api';
import { PNRRefundData } from '@/types/train';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pnr: string }> | { pnr: string } }
) {
  const resolvedParams = await Promise.resolve(params);
  const pnr = (resolvedParams?.pnr || '').replace(/\D/g, '');
  if (!pnr || pnr.length !== 10) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Please provide a valid 10-digit PNR number', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }

  const cacheKey = `pnr:refund:${pnr}`;
  const cached = getCached<PNRRefundData>(cacheKey);
  if (cached) {
    return NextResponse.json<ApiResponse<PNRRefundData>>({
      success: true,
      data: cached,
      cached: true,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const data = await getPNRRefund(pnr);
    setCached(cacheKey, data, 300); // 5 mins cache

    return NextResponse.json<ApiResponse<PNRRefundData>>({
      success: true,
      data,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: err.message || 'Failed to fetch PNR refund info', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
