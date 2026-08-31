import { NextRequest } from 'next/server';
import { getJourneyCached } from '@/lib/journey';
import { getTerrainFeatures, TerrainFeature } from '@/lib/overpass';
import { getCached, setCached } from '@/lib/cache';
import { jsonOk, jsonFail } from '@/lib/api-response';
import { haversineKm } from '@/lib/geo';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trainId = searchParams.get('trainId');

  if (!trainId || !/^\d{4,5}$/.test(trainId.trim())) {
    return jsonFail('Valid 4 or 5 digit trainId is required', 400);
  }

  const cleanTrainId = trainId.trim();
  const cacheKey = `terrain:${cleanTrainId}`;

  const cached = getCached<TerrainFeature[]>(cacheKey);
  if (cached) {
    return jsonOk(cached, true, 200, 'live');
  }

  try {
    const journey = await getJourneyCached(cleanTrainId);
    if (!journey) {
      return jsonOk([], false, 200, 'live');
    }

    // Pass station coordinates (lat/lng + name) to the per-station Overpass querier
    const stationCoords = journey.stations
      .filter((s) => s.lat && s.lng)
      .map((s) => ({
        lat: s.lat,
        lng: s.lng,
        name: s.name,
        distanceKm: s.distanceKm,
      }));

    const features = await getTerrainFeatures(stationCoords);

    // Compute accurate distance from origin for each feature using Haversine
    const origin = journey.stations[0];
    if (origin?.lat && origin?.lng) {
      features.forEach((f) => {
        f.distanceKm = Math.round(haversineKm([origin.lng, origin.lat], [f.lng, f.lat]));
      });
    }

    // Sort by distance from origin
    features.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

    setCached(cacheKey, features, 86400); // 24h cache

    return jsonOk(features, false, 200, 'live');
  } catch (err: any) {
    console.error('[api/terrain]', err);
    return jsonFail('Terrain fetch failed', 500);
  }
}

