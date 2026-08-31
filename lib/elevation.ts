import { getCached, setCached } from './cache';

export interface ElevationPoint {
  distanceKm: number;
  elevationM: number;
  stationName?: string;
}

/**
 * Fetch real SRTM elevation profile for route coordinates using OpenTopoData API.
 * Free point-elevation API, batching up to 100 points per request.
 * Cached for 24h as terrain elevation does not change.
 */
export async function getElevationProfile(
  points: [number, number][],
  totalDistanceKm: number
): Promise<ElevationPoint[]> {
  if (!points || points.length === 0) return [];

  // Downsample to at most 60 coordinates for the profile
  const maxCoords = 60;
  const step = Math.max(1, Math.ceil(points.length / maxCoords));
  const sampled = points.filter((_, i) => i % step === 0);

  const cacheKey = `elev:${sampled[0]?.[0]?.toFixed(2)}:${sampled[0]?.[1]?.toFixed(2)}:${sampled[sampled.length - 1]?.[0]?.toFixed(2)}:${sampled[sampled.length - 1]?.[1]?.toFixed(2)}:${sampled.length}`;
  const cached = getCached<ElevationPoint[]>(cacheKey);
  if (cached) return cached;

  try {
    const locs = sampled.map(([lng, lat]) => `${lat},${lng}`).join('|');
    const res = await fetch(`https://api.opentopodata.org/v1/srtm30m?locations=${locs}`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.results)) {
        const elevations = json.results.map((r: any) =>
          typeof r.elevation === 'number' ? Math.round(r.elevation) : 0
        );

        const stepDist = totalDistanceKm / (elevations.length - 1 || 1);
        const profile: ElevationPoint[] = elevations.map((elevationM: number, idx: number) => ({
          distanceKm: Math.round(idx * stepDist),
          elevationM: Math.max(0, elevationM),
        }));

        setCached(cacheKey, profile, 86400); // 24 hours
        return profile;
      }
    }
  } catch (err) {
    console.warn('[elevation] OpenTopoData SRTM query failed:', err);
  }

  return [];
}
