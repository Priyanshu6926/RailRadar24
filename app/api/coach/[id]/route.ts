import { NextRequest } from 'next/server';
import { getJourneyCached } from '@/lib/journey';
import { getCached, setCached } from '@/lib/cache';
import { jsonOk, jsonFail } from '@/lib/api-response';

export interface Coach {
  position: number;
  label: string;
  type: 'loco' | 'eog' | 'sl' | '3a' | '2a' | '1a' | 'gen' | 'pantry' | 'hcp' | 'other';
  displayName: string;
}

export interface CoachCompositionResponse {
  trainId: string;
  trainName: string;
  totalCoaches: number;
  coaches: Coach[];
  raw: string;
}

const COACH_TYPE_MAP: Record<string, Coach['type']> = {
  ENG: 'loco',
  EOG: 'eog',
  SLR: 'eog',
  GEN: 'gen',
  GS: 'gen',
  PC: 'pantry',
  HCP: 'hcp',
  HA: 'hcp',
};

const COACH_DISPLAY: Record<Coach['type'], string> = {
  loco: 'Loco',
  eog: 'EOG/Guard',
  sl: 'Sleeper',
  '3a': 'AC 3-Tier',
  '2a': 'AC 2-Tier',
  '1a': 'AC First',
  gen: 'General',
  pantry: 'Pantry',
  hcp: 'HCP',
  other: 'Coach',
};

function classifyCoach(label: string): Coach['type'] {
  const upper = label.toUpperCase();
  if (COACH_TYPE_MAP[upper]) return COACH_TYPE_MAP[upper];
  if (upper.startsWith('A') && !upper.startsWith('AE')) return '1a';
  if (upper.startsWith('AE') || upper.startsWith('H1') || upper.startsWith('HA')) return '2a';
  if (upper.startsWith('B')) return '3a';
  if (upper.startsWith('S')) return 'sl';
  if (upper.startsWith('D') || upper.startsWith('GEN') || upper.startsWith('GS')) return 'gen';
  return 'other';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: trainId } = await params;
  if (!trainId || !/^\d{4,5}$/.test(trainId.trim())) {
    return jsonFail('Valid 4 or 5 digit train number is required', 400);
  }

  const cleanTrainId = trainId.trim();
  const cacheKey = `coach:${cleanTrainId}`;

  const cached = getCached<CoachCompositionResponse>(cacheKey);
  if (cached) {
    return jsonOk(cached, true, 200, 'live');
  }

  try {
    const journey = await getJourneyCached(cleanTrainId);
    if (!journey) {
      return jsonFail('Train not found', 404);
    }

    const rawCoachPos =
      (journey as any)._rawCoachPosition ||
      (journey.stations[0] as any)?._coachPosition ||
      '';

    const coaches: Coach[] = [];

    if (rawCoachPos) {
      const labels = rawCoachPos.split('-').filter(Boolean);
      labels.forEach((label: string, idx: number) => {
        const type = classifyCoach(label);
        coaches.push({
          position: idx + 1,
          label,
          type,
          displayName: COACH_DISPLAY[type],
        });
      });
    }

    if (coaches.length < 4) {
      return jsonFail('Coach composition unavailable for this train', 404);
    }

    const result: CoachCompositionResponse = {
      trainId: cleanTrainId,
      trainName: journey.name,
      totalCoaches: coaches.length,
      coaches,
      raw: rawCoachPos,
    };

    setCached(cacheKey, result, 3600); // 1h cache

    return jsonOk(result, false, 200, 'live');
  } catch (err: any) {
    console.error('[api/coach]', err);
    return jsonFail('Coach composition fetch failed', 500);
  }
}

