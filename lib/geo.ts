/**
 * Geographic calculation utilities for RailRadar24.
 * Uses exact Great Circle Haversine formulas instead of degree-space Pythagoras.
 */

const EARTH_RADIUS_KM = 6371.0088;

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/**
 * Calculates great-circle distance between two [lng, lat] coordinate pairs in kilometers.
 */
export function haversineKm(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number]
): number {
  if (!Number.isFinite(lng1) || !Number.isFinite(lat1) || !Number.isFinite(lng2) || !Number.isFinite(lat2)) {
    return 0;
  }

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  return EARTH_RADIUS_KM * c;
}

/**
 * Calculates forward initial bearing in degrees (0..360) between two [lng, lat] coordinates.
 */
export function calculateBearing(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number]
): number {
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);
  const dLng = toRad(lng2 - lng1);

  const y = Math.sin(dLng) * Math.cos(rLat2);
  const x =
    Math.cos(rLat1) * Math.sin(rLat2) -
    Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLng);

  const b = toDeg(Math.atan2(y, x));
  return (b + 360) % 360;
}

export interface InterpolatedPoint {
  point: [number, number];
  heading: number;
}

/**
 * Interpolates along a route polyline by percentage completion using Haversine segment lengths.
 * Returns null if geometry is empty, rather than defaulting to Delhi.
 */
export function interpolatePolylineAlongRoute(
  coords: [number, number][],
  pct: number
): InterpolatedPoint | null {
  if (!coords || coords.length === 0) return null;
  if (!Number.isFinite(pct)) return null;

  if (coords.length === 1 || pct <= 0) {
    return {
      point: coords[0],
      heading: coords.length > 1 ? calculateBearing(coords[0], coords[1]) : 0,
    };
  }

  if (pct >= 100) {
    const last = coords[coords.length - 1];
    const prev = coords[coords.length - 2] || last;
    return {
      point: last,
      heading: coords.length > 1 ? calculateBearing(prev, last) : 0,
    };
  }

  // Calculate cumulative haversine distances
  const cumulativeDist: number[] = [0];
  let totalKm = 0;

  for (let i = 1; i < coords.length; i++) {
    const d = haversineKm(coords[i - 1], coords[i]);
    totalKm += d;
    cumulativeDist.push(totalKm);
  }

  if (totalKm <= 0) {
    return { point: coords[0], heading: 0 };
  }

  const targetKm = (Math.max(0, Math.min(100, pct)) / 100) * totalKm;

  for (let i = 1; i < coords.length; i++) {
    if (cumulativeDist[i] >= targetKm) {
      const segStartKm = cumulativeDist[i - 1];
      const segLenKm = cumulativeDist[i] - segStartKm;
      const t = segLenKm > 0 ? (targetKm - segStartKm) / segLenKm : 0;

      const [lng1, lat1] = coords[i - 1];
      const [lng2, lat2] = coords[i];

      const lng = lng1 + t * (lng2 - lng1);
      const lat = lat1 + t * (lat2 - lat1);
      const heading = calculateBearing(coords[i - 1], coords[i]);

      return {
        point: [lng, lat],
        heading: Math.round(heading),
      };
    }
  }

  const lastPoint = coords[coords.length - 1];
  const prevPoint = coords[coords.length - 2] || lastPoint;
  return {
    point: lastPoint,
    heading: calculateBearing(prevPoint, lastPoint),
  };
}
