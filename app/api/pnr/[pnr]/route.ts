import { NextRequest } from 'next/server';
import { getPNRStatus } from '@/lib/railradar';
import { getCached, setCached } from '@/lib/cache';
import { jsonOk, jsonFail } from '@/lib/api-response';
import { PNRStatusData } from '@/types/train';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pnr: string }> }
) {
  const { pnr: rawPnr } = await params;
  const pnr = (rawPnr || '').replace(/\D/g, '');
  if (!pnr || pnr.length !== 10) {
    return jsonFail('Please provide a valid 10-digit PNR number', 400);
  }

  const cacheKey = `pnr:${pnr}`;
  const cached = getCached<PNRStatusData>(cacheKey);
  if (cached) {
    return jsonOk(cached, true, 200, 'live');
  }

  try {
    const data = await getPNRStatus(pnr);
    if (!data) {
      return jsonFail('PNR status not found or unavailable', 404);
    }
    setCached(cacheKey, data, 300); // 5 mins cache

    return jsonOk(data, false, 200, 'live');
  } catch (err: any) {
    console.error('[api/pnr]', err);
    return jsonFail('Failed to fetch PNR status', 500);
  }
}

