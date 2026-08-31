import { NextRequest } from 'next/server';
import { getJourneyCached } from '@/lib/journey';
import { jsonOk, jsonFail } from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: trainId } = await params;
  if (!trainId || !/^\d{4,5}$/.test(trainId.trim())) {
    return jsonFail('Valid 4 or 5 digit train number is required', 400);
  }

  try {
    const journey = await getJourneyCached(trainId.trim());
    if (!journey) {
      return jsonFail('Live journey not found for train', 404);
    }

    return jsonOk(journey, false, 200, 'live');
  } catch (err: any) {
    console.error('[api/train]', err);
    return jsonFail('Could not load train data', 500);
  }
}

