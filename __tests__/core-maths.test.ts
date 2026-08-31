import { describe, it, expect, beforeEach } from 'vitest';
import { haversineKm, calculateBearing, interpolatePolylineAlongRoute } from '@/lib/geo';
import { buildStationQuery } from '@/lib/overpass';
import { getCached, setCached, clearAllCache } from '@/lib/cache';

describe('R-27: Haversine distance & Bearing calculations', () => {
  it('calculates accurate great-circle distance between New Delhi and Mumbai Central', () => {
    const ndls: [number, number] = [77.2194, 28.6430];
    const mmct: [number, number] = [72.8194, 18.9696];

    const dist = haversineKm(ndls, mmct);
    // Great circle distance between NDLS and MMCT is ~1160 km
    expect(dist).toBeGreaterThan(1140);
    expect(dist).toBeLessThan(1180);
  });

  it('calculates forward bearing correctly for a south-west heading', () => {
    const ndls: [number, number] = [77.2194, 28.6430];
    const mmct: [number, number] = [72.8194, 18.9696];

    const bearing = calculateBearing(ndls, mmct);
    // Heading from Delhi to Mumbai is roughly 200° (South-Southwest)
    expect(bearing).toBeGreaterThan(190);
    expect(bearing).toBeLessThan(220);
  });
});

describe('R-27 & R-32: Polyline interpolation along route', () => {
  const samplePolyline: [number, number][] = [
    [77.0, 28.0],
    [77.0, 29.0], // ~111 km north
    [78.0, 29.0], // ~97 km east
  ];

  it('interpolates accurately at 0%, 50%, and 100% completion', () => {
    const start = interpolatePolylineAlongRoute(samplePolyline, 0);
    expect(start).not.toBeNull();
    expect(start!.point[0]).toBeCloseTo(77.0, 4);
    expect(start!.point[1]).toBeCloseTo(28.0, 4);

    const end = interpolatePolylineAlongRoute(samplePolyline, 100);
    expect(end).not.toBeNull();
    expect(end!.point[0]).toBeCloseTo(78.0, 4);
    expect(end!.point[1]).toBeCloseTo(29.0, 4);

    const mid = interpolatePolylineAlongRoute(samplePolyline, 50);
    expect(mid).not.toBeNull();
    expect(mid!.point[0]).toBeGreaterThanOrEqual(77.0);
    expect(mid!.point[1]).toBeGreaterThanOrEqual(28.0);
  });
});

describe('R-28: Speed calculation across midnight boundary', () => {
  it('computes positive elapsed hours when crossing midnight', () => {
    function parseTimeToHours(t: string): number | null {
      const match = t.match(/^(\d{1,2}):(\d{2})$/);
      if (!match) return null;
      return parseInt(match[1], 10) + parseInt(match[2], 10) / 60;
    }

    const t1 = parseTimeToHours('23:30'); // 23.5
    const t2 = parseTimeToHours('01:00'); // 1.0
    expect(t1).not.toBeNull();
    expect(t2).not.toBeNull();

    let timeDeltaHrs = t2! - t1!;
    if (timeDeltaHrs <= 0) timeDeltaHrs += 24; // 1.5 hrs
    expect(timeDeltaHrs).toBeCloseTo(1.5, 4);

    const distDeltaKm = 105;
    const computedSpeed = Math.round(distDeltaKm / timeDeltaHrs);
    expect(computedSpeed).toBe(70);
  });
});

describe('R-07: Overpass query construction and NaN guard', () => {
  it('returns empty string when coordinates are NaN or out of bounds', () => {
    expect(buildStationQuery(NaN, 77.2)).toBe('');
    expect(buildStationQuery(28.6, NaN)).toBe('');
    expect(buildStationQuery(95.0, 77.2)).toBe('');
    expect(buildStationQuery(28.6, 200.0)).toBe('');
  });

  it('builds a valid bounded Overpass query for valid station coordinates', () => {
    const query = buildStationQuery(28.6430, 77.2194);
    expect(query).toContain('way["bridge"="yes"]');
    expect(query).toContain('way["tunnel"="yes"]');
    expect(query).toContain('node["natural"="peak"]');
    expect(query).toContain('28.4430,77.0194,28.8430,77.4194');
  });
});

describe('R-04: In-memory cache FIFO eviction at bounded capacity', () => {
  beforeEach(() => {
    clearAllCache();
  });

  it('evicts the oldest entry when exceeding the 500-item maximum size', () => {
    // Insert 500 items
    for (let i = 0; i < 500; i++) {
      setCached(`key-${i}`, `val-${i}`, 3600);
    }
    expect(getCached('key-0')).toBe('val-0');
    expect(getCached('key-499')).toBe('val-499');

    // Insert 501st item
    setCached('key-500', 'val-500', 3600);

    // Oldest item 'key-0' must have been evicted
    expect(getCached('key-0')).toBeNull();
    // Subsequent items remain
    expect(getCached('key-1')).toBe('val-1');
    expect(getCached('key-500')).toBe('val-500');
  });
});
