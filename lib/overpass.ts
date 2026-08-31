export interface TerrainFeature {
  type: 'bridge' | 'tunnel' | 'river' | 'mountain' | 'tourist' | 'city';
  name: string;
  lat: number;
  lng: number;
  distanceKm?: number;
}

function mapOsmType(tags: Record<string, string>): TerrainFeature['type'] {
  if (tags.bridge === 'yes') return 'bridge';
  if (tags.tunnel === 'yes') return 'tunnel';
  if (tags.waterway === 'river') return 'river';
  if (tags.natural === 'peak') return 'mountain';
  if (tags.tourism === 'attraction' || tags.tourism === 'viewpoint') return 'tourist';
  if (tags.place === 'city' || tags.place === 'town') return 'city';
  return 'tourist';
}

function parseName(tags: Record<string, string>): string {
  return tags['name:en'] || tags.name || tags.description || '';
}

/**
 * Build an Overpass QL query for a SINGLE station corridor (±pad degrees).
 * Keeps response small enough to avoid 406 payload errors on long routes.
 */
function buildStationQuery(lat: number, lng: number, pad = 0.2): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return '';
  }
  const bbox = `${lat - pad},${lng - pad},${lat + pad},${lng + pad}`;
  return `
  way["bridge"="yes"](${bbox});
  way["tunnel"="yes"](${bbox});
  relation["waterway"="river"](${bbox});
  way["waterway"="river"](${bbox});
  node["natural"="peak"](${bbox});
  node["tourism"="attraction"](${bbox});
  node["tourism"="viewpoint"](${bbox});
  node["place"="city"](${bbox});
  node["place"="town"](${bbox});`;
}

/**
 * Fetch terrain POIs for an array of station coordinates using Overpass API.
 * Queries are batched (up to 6 stations per request) to stay within Overpass limits.
 * Falls back gracefully if Overpass is unavailable.
 */
export async function getTerrainFeatures(
  stationCoords: { lat: number; lng: number; name: string; distanceKm?: number }[]
): Promise<TerrainFeature[]> {
  if (!stationCoords || stationCoords.length === 0) return [];

  // Sample up to 12 stations evenly to keep queries manageable
  const maxStations = 12;
  const step = Math.max(1, Math.ceil(stationCoords.length / maxStations));
  const sampled = stationCoords.filter((_, i) => i % step === 0).slice(0, maxStations);

  const seen = new Set<string>();
  const features: TerrainFeature[] = [];

  // Process in batches of 4 stations per Overpass request
  const batchSize = 4;
  for (let b = 0; b < sampled.length; b += batchSize) {
    const batch = sampled.slice(b, b + batchSize);
    const unionBody = batch.map((s) => buildStationQuery(s.lat, s.lng)).join('\n');
    const query = `[out:json][timeout:20];\n(\n${unionBody}\n);\nout center tags 60;`;

    let attempt = 0;
    let res: Response | null = null;

    while (attempt < 3) {
      try {
        res = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'RailRadar24/0.1 (github.com/Priyanshu6926)',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(20_000),
        });

        if (res.status === 429 || res.status === 504) {
          attempt++;
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 1500 * attempt));
            continue;
          }
        }
        break;
      } catch (err) {
        attempt++;
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        } else {
          console.warn(`[overpass] Batch ${b / batchSize} failed after retries:`, err);
        }
      }
    }

    if (!res || !res.ok) {
      console.warn(`[overpass] Batch ${b / batchSize} returned ${res?.status ?? 'timeout'}, skipping batch`);
      continue;
    }

    try {
      const json = await res.json();
      const elements: any[] = json?.elements || [];

      for (const el of elements) {
        const tags = el.tags || {};
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        if (!lat || !lng) continue;

        const name = parseName(tags);
        if (!name) continue; // skip unnamed features
        const type = mapOsmType(tags);
        const key = `${type}:${name.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        features.push({ type, name, lat, lng });
        if (features.length >= 40) break;
      }
    } catch (e) {
      console.warn(`Overpass batch ${b / batchSize} fetch failed:`, e);
    }

    if (features.length >= 40) break;
    // Small delay between batches to be respectful to Overpass
    if (b + batchSize < sampled.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return features;
}
