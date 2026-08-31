import { NextRequest } from 'next/server';
import { getJourneyCached } from '@/lib/journey';
import { getElevationProfile, ElevationPoint } from '@/lib/elevation';
import { getCached, setCached } from '@/lib/cache';
import { jsonOk, jsonFail } from '@/lib/api-response';

export interface AnalyticsResponse {
  trainId: string;
  totalDistanceKm: number;
  distanceCoveredKm: number;
  remainingDistanceKm: number;
  completionPercentage: number;
  highestElevationM: number | null;
  elevationProfile: ElevationPoint[];
  delayHistory: { stationCode: string; stationName: string; delayMinutes: number }[];
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
  const cacheKey = `analytics:${cleanTrainId}`;

  const cached = getCached<AnalyticsResponse>(cacheKey);
  if (cached) {
    return jsonOk(cached, true, 200, 'live');
  }

  try {
    const journey = await getJourneyCached(cleanTrainId);
    if (!journey) {
      return jsonFail('Journey not found', 404);
    }

    const routeCoords = (journey.routeGeometry || journey.stations.map((s) => [s.lng, s.lat])) as [number, number][];
    const elevationProfile = await getElevationProfile(routeCoords, journey.totalDistanceKm);

    const highestElevationM = elevationProfile.length
      ? Math.max(...elevationProfile.map((e) => e.elevationM))
      : null;

    const delayHistory = journey.stations.map((s) => ({
      stationCode: s.code,
      stationName: s.name,
      delayMinutes: s.delayMinutes,
    }));

    const result: AnalyticsResponse = {
      trainId: cleanTrainId,
      totalDistanceKm: journey.totalDistanceKm,
      distanceCoveredKm: journey.distanceCoveredKm,
      remainingDistanceKm: journey.remainingDistanceKm,
      completionPercentage: journey.completionPercentage,
      highestElevationM,
      elevationProfile,
      delayHistory,
    };

    setCached(cacheKey, result, 300); // 5 min cache

    return jsonOk(result, false, 200, 'live');
  } catch (err: any) {
    console.error('[api/analytics]', err);
    return jsonFail('Failed to compute analytics', 500);
  }
}

