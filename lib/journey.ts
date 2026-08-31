import { getCached, setCached } from './cache';
import { getLiveJourney, fetchRouteGeometry } from './railradar';
import { LiveJourney } from '@/types/train';

export async function getJourneyCached(trainId: string): Promise<LiveJourney | null> {
  const key = `journey:${trainId}`;
  const hit = getCached<LiveJourney>(key);
  if (hit) return hit;

  // Split route geometry out: cache on its own key with a 24-hour TTL
  const geoKey = `route-geo:${trainId}`;
  let geo = getCached<[number, number][]>(geoKey);
  if (!geo) {
    const fetchedGeo = await fetchRouteGeometry(trainId);
    if (fetchedGeo) {
      geo = fetchedGeo;
      setCached(geoKey, fetchedGeo, 86400);
    }
  }

  const fresh = await getLiveJourney(trainId);
  if (fresh) {
    if (geo && (!fresh.routeGeometry || fresh.routeGeometry.length === 0)) {
      fresh.routeGeometry = geo;
    }
    setCached(key, fresh, 60); // one upstream pair per minute, per train
  }
  return fresh;
}
