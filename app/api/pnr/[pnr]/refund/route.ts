import { NextRequest } from 'next/server';
import { getPNRRefund } from '@/lib/railradar';
import { getCached, setCached } from '@/lib/cache';
import { jsonOk, jsonFail } from '@/lib/api-response';
import { PNRRefundData } from '@/types/train';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pnr: string }> }
) {
  const { pnr: rawPnr } = await params;
  const pnr = (rawPnr || '').replace(/\D/g, '');
  if (!pnr || pnr.length !== 10) {
    return jsonFail('Please provide a valid 10-digit PNR number', 400);
  }

  const cacheKey = `pnr:refund:${pnr}`;
  const cached = getCached<PNRRefundData>(cacheKey);
  if (cached) {
    return jsonOk(cached, true, 200, 'live');
  }

  try {
    const data = await getPNRRefund(pnr);
    if (!data) {
      return jsonFail('PNR refund details unavailable', 404);
    }
    setCached(cacheKey, data, 300); // 5 mins cache

    return jsonOk(data, false, 200, 'live');
  } catch (err: any) {
    console.error('[api/pnr/refund]', err);
    return jsonFail('Failed to fetch PNR refund info', 500);
  }
}

