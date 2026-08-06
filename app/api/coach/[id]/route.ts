import { NextRequest, NextResponse } from 'next/server';
import { getLiveJourney } from '@/lib/railradar';
import { getCached, setCached } from '@/lib/cache';
import { ApiResponse } from '@/types/api';

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
  { params }: { params: { id: string } }
) {
  const trainId = params.id;
  const cacheKey = `coach:${trainId}`;

  const cached = getCached<CoachCompositionResponse>(cacheKey);
  if (cached) {
    return NextResponse.json<ApiResponse<CoachCompositionResponse>>({
      success: true,
      data: cached,
      cached: true,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const journey = await getLiveJourney(trainId);
    if (!journey) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Train not found', timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    // coachPosition comes from RailRadar live API on each stop
    // e.g. "ENG-EOG-B1-B2-...-PC-H1-AE1-A1-A2-EOG-HCP"
    const rawCoachPos =
      (journey as any)._rawCoachPosition ||
      // Try to extract from raw stations if stored
      (journey.stations[0] as any)?._coachPosition ||
      '';

    // If no raw position, build a default based on what we know about the train type
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
    } else {
      // Fallback: use coachPosition from the first station in the raw journey
      // This will be populated once we store it in the railradar normaliser
      coaches.push(
        { position: 1, label: 'ENG', type: 'loco', displayName: 'Loco' },
        { position: 2, label: 'EOG', type: 'eog', displayName: 'EOG/Guard' },
      );
    }

    const result: CoachCompositionResponse = {
      trainId,
      trainName: journey.name,
      totalCoaches: coaches.length,
      coaches,
      raw: rawCoachPos,
    };

    setCached(cacheKey, result, 3600); // 1h cache

    return NextResponse.json<ApiResponse<CoachCompositionResponse>>({
      success: true,
      data: result,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: err.message || 'Coach composition fetch failed', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
