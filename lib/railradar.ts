import {
  SearchResult,
  LiveJourney,
  Station,
  StationSearchResult,
  PNRStatusData,
  PNRPredictionData,
  PNRRefundData,
  TrainFareData,
  SeatAvailabilityData,
  TrainsBetweenData,
  PlannerTrain,
  StationBoardData,
} from '@/types/train';
import { env } from '@/config/env';
import { searchLocalTrains, TRAINS_DB, searchLocalStations, getLocalStations } from '@/lib/trains-db';

const RR_BASE = 'https://api.railradar.in/v1';

function rrHeaders() {
  return {
    Authorization: `Bearer ${env.RAILRADAR_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

function extractErrorMessage(json: any): string {
  if (!json) return 'Unknown error';
  if (json.error?.message) return `${json.error.code || 'ERROR'}: ${json.error.message}`;
  if (typeof json.error === 'string') return json.error;
  if (json.message) return json.message;
  return 'Unknown API error';
}

/**
 * Fetch wrapper with a 5-second timeout to prevent undici connect timeouts.
 */
async function rrFetch(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { ...rrHeaders(), ...(options?.headers || {}) },
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Type helpers for RailRadar raw API shapes ─────────────────────────────

interface RRStation {
  code: string;
  name: string;
  lat: number;
  lng: number;
}

interface RRTrainDetail {
  number: string;
  name: string;
  type: string;
  category: string;
  source: RRStation;
  destination: RRStation;
  runDays: string[];
  distance: number;
  duration: number;
  avgSpeed: number;
}

interface RRRouteStop {
  sequence: number;
  station?: RRStation;
  stationCode?: string;
  stationName?: string;
  isHalt: boolean;
  platform?: string;
  arrival?: string;
  departure?: string;
  scheduledArrival?: string;
  scheduledDeparture?: string;
  actualArrival?: string;
  actualDeparture?: string;
  delayArrival?: number;
  delayDeparture?: number;
  distance: number;
  status?: string;
  coachPosition?: string;
}

interface RRLiveResponse {
  trainNumber: string;
  trainName: string;
  startDate: string;
  lastUpdatedAt: string;
  status: string;
  train: RRTrainDetail;
  isLive: boolean;
  trackingMode: string;
  currentLocation?: {
    stationCode: string;
    sequence: number;
    status: string;
    isHalt: boolean;
    isActualPosition: boolean;
    lat?: number;
    lng?: number;
  };
  nextHalt?: {
    stationCode: string;
    stationName: string;
    sequence: number;
    distance: number;
  };
  delayMinutes: number;
  route: RRRouteStop[];
}

function normaliseStatus(status: string): LiveJourney['status'] {
  switch (status) {
    case 'running': return 'running';
    case 'not-started': return 'not_started';
    case 'completed': return 'completed';
    case 'cancelled': return 'cancelled';
    default: return 'running';
  }
}

function normaliseRouteStop(stop: RRRouteStop, stationMap: Map<string, RRStation>): Station {
  const stCode = stop.stationCode || stop.station?.code || '';
  const stInfo = stationMap.get(stCode) || stop.station;

  const parseTime = (val?: string): string | undefined => {
    if (!val) return undefined;
    if (val.includes('T')) {
      return new Date(val).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata',
      });
    }
    return val;
  };

  let stStatus: Station['status'] = 'upcoming';
  const raw = (stop.status || '').toLowerCase();
  if (raw === 'departed' || raw === 'passed' || raw === 'arrived') stStatus = 'passed';
  else if (raw === 'at-station') stStatus = 'current';
  else stStatus = 'upcoming';

  return {
    code: stCode,
    name: stop.stationName || stop.station?.name || stCode,
    lat: stInfo?.lat ?? 0,
    lng: stInfo?.lng ?? 0,
    scheduledArrival: parseTime(stop.scheduledArrival || stop.arrival) || '--:--',
    scheduledDeparture: parseTime(stop.scheduledDeparture || stop.departure) || '--:--',
    actualArrival: parseTime(stop.actualArrival) || undefined,
    actualDeparture: parseTime(stop.actualDeparture) || undefined,
    delayMinutes: stop.delayArrival ?? stop.delayDeparture ?? 0,
    distanceKm: Math.round(stop.distance || 0),
    status: stStatus,
    platform: stop.platform,
    isHalt: stop.isHalt,
  };
}

function interpolatePolyline(coords: [number, number][], pct: number): [number, number] {
  if (!coords || coords.length === 0) return [77.2194, 28.643];
  if (coords.length === 1 || pct <= 0) return coords[0];
  if (pct >= 100) return coords[coords.length - 1];

  const distances: number[] = [0];
  let totalDist = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    const dx = lng2 - lng1;
    const dy = lat2 - lat1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    totalDist += dist;
    distances.push(totalDist);
  }

  if (totalDist === 0) return coords[0];

  const targetDist = (pct / 100) * totalDist;
  for (let i = 1; i < coords.length; i++) {
    if (distances[i] >= targetDist) {
      const segStartDist = distances[i - 1];
      const segLen = distances[i] - segStartDist;
      const t = segLen > 0 ? (targetDist - segStartDist) / segLen : 0;
      const [lng1, lat1] = coords[i - 1];
      const [lng2, lat2] = coords[i];
      return [lng1 + t * (lng2 - lng1), lat1 + t * (lat2 - lat1)];
    }
  }
  return coords[coords.length - 1];
}

function normaliseLiveResponse(raw: RRLiveResponse, routeGeo?: [number, number][]): LiveJourney {
  const train = raw.train;

  const stationMap = new Map<string, RRStation>();
  if (train?.source) stationMap.set(train.source.code, train.source);
  if (train?.destination) stationMap.set(train.destination.code, train.destination);

  const relevantStops = (raw.route || []).filter((s) => s.stationCode || s.station?.code);
  const totalDistanceKm = train?.distance || Math.round(relevantStops[relevantStops.length - 1]?.distance || 0);

  const stations = relevantStops.map((s) => {
    const st = normaliseRouteStop(s, stationMap);
    if ((!st.lat || !st.lng) && routeGeo && routeGeo.length >= 2 && totalDistanceKm > 0) {
      const pct = Math.min(100, Math.max(0, (st.distanceKm / totalDistanceKm) * 100));
      const [lng, lat] = interpolatePolyline(routeGeo, pct);
      st.lat = lat;
      st.lng = lng;
    }
    return st;
  });

  const currentStation = stations.find((s) => s.status === 'current');
  const previousStation = [...stations].reverse().find((s) => s.status === 'passed');
  const nextStation = stations.find((s) => s.status === 'upcoming');

  const coveredKm = currentStation?.distanceKm || previousStation?.distanceKm || 0;
  const remainingKm = Math.max(0, totalDistanceKm - coveredKm);
  const completion = totalDistanceKm > 0 ? Math.min(100, (coveredKm / totalDistanceKm) * 100) : 0;

  let trainLat = raw.currentLocation?.lat;
  let trainLng = raw.currentLocation?.lng;

  if (!trainLat || !trainLng) {
    const posStation = currentStation || previousStation;
    if (posStation && posStation.lat && posStation.lng) {
      trainLat = posStation.lat;
      trainLng = posStation.lng;
    } else if (routeGeo && routeGeo.length >= 2) {
      const [lng, lat] = interpolatePolyline(routeGeo, completion);
      trainLng = lng;
      trainLat = lat;
    } else {
      trainLat = train?.source?.lat || 28.643;
      trainLng = train?.source?.lng || 77.2194;
    }
  }

  // ── Dynamic live-speed computation ────────────────────────────────────────
  // Strategy: derive speed from the actual distance / time window between the
  // last two "passed" stations rather than the static timetable avgSpeed.
  const isMovingNow = raw.status === 'running' && !currentStation;
  let liveSpeedKmh: number | null = 0;

  if (isMovingNow) {
    const passedStops = [...relevantStops].filter((s) => {
      const rawSt = (s.status || '').toLowerCase();
      return rawSt === 'departed' || rawSt === 'passed' || rawSt === 'arrived';
    });

    let computedSpeed: number | null = null;

    if (passedStops.length >= 2) {
      const s1 = passedStops[passedStops.length - 2];
      const s2 = passedStops[passedStops.length - 1];
      const d1 = s1.distance ?? 0;
      const d2 = s2.distance ?? 0;
      const distDeltaKm = d2 - d1;

      const parseTimeToHours = (t?: string): number | null => {
        if (!t || t === '--:--') return null;
        if (t.includes('T')) {
          const d = new Date(t);
          if (!isNaN(d.getTime())) {
            return d.getTime() / (1000 * 60 * 60);
          }
        }
        const parts = t.split(':');
        if (parts.length < 2) return null;
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
        return h + m / 60;
      };

      // R-29: Require both endpoints from the same source clock
      let t1: number | null = null;
      let t2: number | null = null;

      if (s1.actualDeparture && s2.actualArrival) {
        t1 = parseTimeToHours(s1.actualDeparture);
        t2 = parseTimeToHours(s2.actualArrival);
      } else if (s1.scheduledDeparture && s2.scheduledArrival) {
        t1 = parseTimeToHours(s1.scheduledDeparture);
        t2 = parseTimeToHours(s2.scheduledArrival);
      }

      if (t1 !== null && t2 !== null && distDeltaKm > 0) {
        let timeDeltaHrs = t2 - t1;
        if (timeDeltaHrs <= 0) timeDeltaHrs += 24; // midnight crossing
        if (timeDeltaHrs > 0 && timeDeltaHrs < 12) {
          const computed = Math.round(distDeltaKm / timeDeltaHrs);
          // R-28: Reject impossible speeds (>180 km/h) rather than clamping
          if (computed > 0 && computed <= 180) {
            computedSpeed = computed;
          } else {
            console.warn(`[railradar] Implausible computed speed rejected: ${computed} km/h`);
          }
        }
      }
    }

    liveSpeedKmh = computedSpeed;
  }

  const currentLocation: LiveJourney['currentLocation'] = {
    lat: trainLat,
    lng: trainLng,
    heading: 45,
    speedKmh: liveSpeedKmh,
    isMoving: isMovingNow,
  };

  const nextHaltStation = nextStation;
  const etaStr = nextHaltStation?.scheduledArrival
    ? `${nextHaltStation.name} at ${nextHaltStation.scheduledArrival}`
    : 'Calculating...';

  const rawCoachPosition = raw.route?.find((s) => s.coachPosition)?.coachPosition || '';

  return {
    trainId: raw.trainNumber,
    number: raw.trainNumber,
    name: raw.trainName,
    origin: { code: train?.source?.code || '', name: train?.source?.name || '' },
    destination: { code: train?.destination?.code || '', name: train?.destination?.name || '' },
    currentLocation,
    status: normaliseStatus(raw.status),
    delayMinutes: raw.delayMinutes || 0,
    speedKmh: currentLocation.speedKmh,
    avgSpeed: train?.avgSpeed ? Math.round(train.avgSpeed) : 80,
    distanceCoveredKm: coveredKm,
    remainingDistanceKm: remainingKm,
    totalDistanceKm,
    completionPercentage: Math.round(completion * 10) / 10,
    lastUpdated: raw.lastUpdatedAt || new Date().toISOString(),
    ETA: etaStr,
    previousStation,
    currentStation,
    nextStation,
    stations,
    routeGeometry: routeGeo,
    _rawCoachPosition: rawCoachPosition,
  } as any;
}

export async function fetchRouteGeometry(trainNumber: string): Promise<[number, number][] | undefined> {
  try {
    const res = await rrFetch(`${RR_BASE}/trains/${trainNumber}/route`, {
      next: { revalidate: 86400 },
    } as any);
    if (!res.ok) return undefined;
    const json = await res.json();
    if (!json.success) return undefined;
    const coords: [number, number][] | undefined = json?.data?.geojson?.geometry?.coordinates;
    if (coords && coords.length > 200) {
      const step = Math.ceil(coords.length / 200);
      return coords.filter((_, i) => i % step === 0);
    }
    return coords;
  } catch {
    return undefined;
  }
}

// ─── Fallback Generators ──────────────────────────────────────────────────

function generateFallbackJourney(trainNumber: string): LiveJourney {
  const train = TRAINS_DB.find((t) => t.number === trainNumber) || {
    number: trainNumber,
    name: `Superfast Express #${trainNumber}`,
    from: 'Mumbai Central',
    fromCode: 'MMCT',
    to: 'New Delhi',
    toCode: 'NDLS',
  };

  const stations: Station[] = [
    {
      code: train.fromCode,
      name: train.from,
      lat: 18.9696,
      lng: 72.8193,
      scheduledArrival: '17:00',
      scheduledDeparture: '17:00',
      actualArrival: '17:00',
      actualDeparture: '17:00',
      delayMinutes: 0,
      distanceKm: 0,
      status: 'passed',
      platform: '1',
      isHalt: true,
    },
    {
      code: 'ST',
      name: 'Surat',
      lat: 21.2049,
      lng: 72.8406,
      scheduledArrival: '20:10',
      scheduledDeparture: '20:15',
      actualArrival: '20:14',
      actualDeparture: '20:19',
      delayMinutes: 4,
      distanceKm: 263,
      status: 'passed',
      platform: '2',
      isHalt: true,
    },
    {
      code: 'KOTA',
      name: 'Kota Junction',
      lat: 25.2138,
      lng: 75.8648,
      scheduledArrival: '03:15',
      scheduledDeparture: '03:25',
      actualArrival: '03:23',
      actualDeparture: '03:33',
      delayMinutes: 8,
      distanceKm: 920,
      status: 'current',
      platform: '1',
      isHalt: true,
    },
    {
      code: train.toCode,
      name: train.to,
      lat: 28.643,
      lng: 77.2194,
      scheduledArrival: '08:32',
      scheduledDeparture: '08:32',
      delayMinutes: 8,
      distanceKm: 1384,
      status: 'upcoming',
      platform: '3',
      isHalt: true,
    },
  ];

  return {
    trainId: train.number,
    number: train.number,
    name: train.name,
    origin: { code: train.fromCode, name: train.from },
    destination: { code: train.toCode, name: train.to },
    currentLocation: {
      lat: 25.2138,
      lng: 75.8648,
      heading: 45,
      speedKmh: 110,
      isMoving: true,
    },
    status: 'running',
    delayMinutes: 8,
    speedKmh: 110,
    distanceCoveredKm: 920,
    remainingDistanceKm: 464,
    totalDistanceKm: 1384,
    completionPercentage: 66.5,
    lastUpdated: new Date().toISOString(),
    ETA: 'Kota Junction at 03:15',
    previousStation: stations[1],
    currentStation: stations[2],
    nextStation: stations[3],
    stations,
    routeGeometry: [
      [72.8193, 18.9696],
      [72.8406, 21.2049],
      [75.8648, 25.2138],
      [77.2194, 28.643],
    ],
  };
}

// ─── 1. Train Search & Live Journey ─────────────────────────────────────────

export async function searchTrains(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) {
    return searchLocalTrains('').map((t) => ({
      id: t.number,
      number: t.number,
      name: t.name,
      origin: { code: t.fromCode, name: t.from },
      destination: { code: t.toCode, name: t.to },
    }));
  }

  try {
    const res = await rrFetch(`${RR_BASE}/lookup/search/trains?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data.slice(0, 15).map((item: any) => ({
          id: item.trainNumber || item.number,
          number: item.trainNumber || item.number,
          name: item.trainName || item.name,
          origin: { code: item.sourceStation || item.fromCode || '', name: item.sourceStationName || item.from || '' },
          destination: { code: item.destStation || item.toCode || '', name: item.destStationName || item.to || '' },
        }));
      }
    }
  } catch {
    // ignore
  }

  return searchLocalTrains(q).map((t) => ({
    id: t.number,
    number: t.number,
    name: t.name,
    origin: { code: t.fromCode, name: t.from },
    destination: { code: t.toCode, name: t.to },
  }));
}

export async function getLiveJourney(trainNumber: string): Promise<LiveJourney | null> {
  try {
    const [liveRes, routeGeo] = await Promise.all([
      rrFetch(`${RR_BASE}/trains/${trainNumber}/live`, { cache: 'no-store' } as any),
      fetchRouteGeometry(trainNumber),
    ]);

    const json = await liveRes.json().catch(() => null);

    if (!liveRes.ok) {
      if (liveRes.status === 404) return null;
      if (process.env.NODE_ENV === 'development') return generateFallbackJourney(trainNumber);
      return null;
    }

    if (!json?.success || !json?.data) {
      if (process.env.NODE_ENV === 'development') return generateFallbackJourney(trainNumber);
      return null;
    }

    return normaliseLiveResponse(json.data as RRLiveResponse, routeGeo);
  } catch (err: any) {
    if (process.env.NODE_ENV === 'development') return generateFallbackJourney(trainNumber);
    return null;
  }
}

// ─── 2. Station Autocomplete & Directory ───────────────────────────────────

export async function searchStations(query: string): Promise<StationSearchResult[]> {
  const q = query.trim();
  if (!q) {
    return searchLocalStations('').map((s) => ({ code: s.code, name: s.name }));
  }

  try {
    const res = await rrFetch(`${RR_BASE}/lookup/search/stations?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data.slice(0, 15).map((item: any) => ({
          code: item.code || item.stationCode,
          name: item.name || item.stationName,
          state: item.state,
          lat: item.lat,
          lng: item.lng,
        }));
      }
    }
  } catch {
    // fallback
  }

  return searchLocalStations(q).map((s) => ({
    code: s.code,
    name: s.name,
  }));
}

// ─── 3. PNR Status, Prediction & Refund ────────────────────────────────────

export async function getPNRStatus(pnr: string): Promise<PNRStatusData | null> {
  const cleanPnr = pnr.replace(/\D/g, '').slice(0, 10);
  try {
    const res = await rrFetch(`${RR_BASE}/pnr/${cleanPnr}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        return {
          pnr: d.pnr || cleanPnr,
          trainNumber: d.trainNumber || d.train?.number || '',
          trainName: d.trainName || d.train?.name || '',
          journeyDate: d.journeyDate || d.doj || '',
          fromStation: {
            code: d.fromStation?.code || d.source || '',
            name: d.fromStation?.name || '',
          },
          toStation: {
            code: d.toStation?.code || d.destination || '',
            name: d.toStation?.name || '',
          },
          boardingStation: {
            code: d.boardingStation?.code || d.boardingPoint || '',
            name: d.boardingStation?.name || '',
          },
          reservationUpto: {
            code: d.reservationUpto?.code || d.reservationPoint || '',
            name: d.reservationUpto?.name || '',
          },
          class: d.class || '3A',
          quota: d.quota || 'GN',
          chartPrepared: Boolean(d.chartPrepared),
          passengers: Array.isArray(d.passengers)
            ? d.passengers.map((p: any, idx: number) => {
                const prob = typeof p.probability === 'number' ? p.probability : undefined;
                return {
                  passengerNumber: idx + 1,
                  bookingStatus: p.bookingStatus || 'WL',
                  currentStatus: p.currentStatus || 'WL',
                  coach: p.coach,
                  berth: p.berth,
                  berthType: p.berthType,
                  predictionProbability: prob,
                  predictionStatus: prob === undefined
                    ? undefined
                    : prob > 75 ? 'High' : prob > 45 ? 'Medium' : 'Low',
                };
              })
            : [],
          expectedPlatform: d.expectedPlatform,
        };
      }
    }
  } catch (err) {
    console.error('[railradar:getPNRStatus]', err);
  }

  return null;
}

export async function getPNRPrediction(pnr: string): Promise<PNRPredictionData | null> {
  const cleanPnr = pnr.replace(/\D/g, '').slice(0, 10);
  try {
    const res = await rrFetch(`${RR_BASE}/pnr/${cleanPnr}/prediction`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        const prob = typeof json.data.probability === 'number'
          ? json.data.probability
          : typeof json.data.confirmationProbability === 'number'
          ? json.data.confirmationProbability
          : undefined;

        return {
          pnr: cleanPnr,
          trainNumber: json.data.trainNumber || '',
          confirmationProbability: prob,
          status: json.data.status || (prob !== undefined ? (prob > 75 ? 'High' : prob > 45 ? 'Medium' : 'Low') : 'Unknown'),
          historicalTrend: json.data.historicalTrend,
          message: json.data.message || (prob !== undefined ? `${prob}% chance of confirmation.` : 'Confirmation probability unavailable.'),
        };
      }
    }
  } catch (err) {
    console.error('[railradar:getPNRPrediction]', err);
  }

  return null;
}

export async function getPNRRefund(pnr: string): Promise<PNRRefundData | null> {
  const cleanPnr = pnr.replace(/\D/g, '').slice(0, 10);
  try {
    const res = await rrFetch(`${RR_BASE}/pnr/${cleanPnr}/refund`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return {
          pnr: cleanPnr,
          ticketFare: json.data.ticketFare,
          clerkageCharge: json.data.clerkageCharge,
          cancellationCharge: json.data.cancellationCharge,
          refundableAmount: json.data.refundableAmount,
          ruleApplied: json.data.ruleApplied || 'Standard Railway Refund Rules Apply',
        };
      }
    }
  } catch (err) {
    console.error('[railradar:getPNRRefund]', err);
  }

  return null;
}

// ─── 4. Train Fare Calculator ──────────────────────────────────────────────

export async function getTrainFare(trainNumber: string, fromStation?: string, toStation?: string): Promise<TrainFareData | null> {
  try {
    const qs = fromStation && toStation ? `?from=${fromStation}&to=${toStation}` : '';
    const res = await rrFetch(`${RR_BASE}/trains/${trainNumber}/fare${qs}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
    }
  } catch (err) {
    console.error('[railradar:getTrainFare]', err);
  }

  return null;
}

// ─── 5. 14-Day Seat Availability Forecast ──────────────────────────────────

export async function getSeatAvailability(
  trainNumber: string,
  fromStation: string,
  toStation: string,
  classCode: string = '3A',
  quota: string = 'GN'
): Promise<SeatAvailabilityData | null> {
  try {
    const res = await rrFetch(
      `${RR_BASE}/trains/${trainNumber}/seats?from=${fromStation}&to=${toStation}&class=${classCode}&quota=${quota}`
    );
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
    }
  } catch (err) {
    console.error('[railradar:getSeatAvailability]', err);
  }

  return null;
}

function extractStationEndpoint(raw: any, fallbackCode: string = ''): { code: string; name: string } {
  if (!raw) {
    return { code: fallbackCode, name: fallbackCode };
  }
  if (typeof raw === 'string') {
    return { code: raw, name: raw };
  }
  if (typeof raw === 'object') {
    const code = typeof raw.code === 'string'
      ? raw.code
      : typeof raw.stationCode === 'string'
      ? raw.stationCode
      : fallbackCode;
    const name = typeof raw.name === 'string'
      ? raw.name
      : typeof raw.stationName === 'string'
      ? raw.stationName
      : typeof raw.cityName === 'string'
      ? raw.cityName
      : code || fallbackCode;
    return { code, name };
  }
  return { code: fallbackCode, name: fallbackCode };
}

// ─── 6. Trains Between Stations (Journey Planner) ──────────────────────────

export async function getTrainsBetween(fromCode: string, toCode: string): Promise<TrainsBetweenData> {
  const from = fromCode.trim().toUpperCase();
  const to = toCode.trim().toUpperCase();

  try {
    const res = await rrFetch(`${RR_BASE}/trains/between/${from}/${to}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        const rawList = Array.isArray(json.data)
          ? json.data
          : Array.isArray(json.data.trains)
          ? json.data.trains
          : [];

        if (rawList.length > 0) {
          const allStations = getLocalStations();
          const fromObj = allStations.find((s) => s.code === from) || { code: from, name: from };
          const toObj = allStations.find((s) => s.code === to) || { code: to, name: to };

          const normalisedTrains: PlannerTrain[] = rawList.map((item: any, idx: number) => {
            const fromRaw = item.from || item.fromStation || item.source || item.sourceStation || item.origin;
            const fromEp = extractStationEndpoint(fromRaw, from);
            const departureTime = typeof fromRaw === 'object' && typeof fromRaw.departure === 'string'
              ? fromRaw.departure
              : item.fromStation?.departureTime || item.departureTime || item.depTime || item.std || `${(6 + idx * 3) % 24}:30`.padStart(5, '0');

            const toRaw = item.to || item.toStation || item.destination || item.destStation || item.dest;
            const toEp = extractStationEndpoint(toRaw, to);
            const arrivalTime = typeof toRaw === 'object' && typeof toRaw.arrival === 'string'
              ? toRaw.arrival
              : item.toStation?.arrivalTime || item.arrivalTime || item.arrTime || item.sta || `${(14 + idx * 3) % 24}:45`.padStart(5, '0');

            const trainNumber = typeof item.trainNumber === 'string' ? item.trainNumber : typeof item.number === 'string' ? item.number : String(item.trainNumber || item.number || '12000');
            const trainName = typeof item.trainName === 'string' ? item.trainName : typeof item.name === 'string' ? item.name : 'Express Service';

            const runningDays = Array.isArray(item.runningDays)
              ? item.runningDays
              : Array.isArray(item.runsOn)
              ? item.runsOn
              : Array.isArray(item.runDays)
              ? item.runDays
              : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

            const classes = Array.isArray(item.classes)
              ? item.classes
              : Array.isArray(item.availableClasses)
              ? item.availableClasses
              : ['1A', '2A', '3A', 'SL'];

            const trainType = item.trainType || item.type || (trainName.includes('Rajdhani') ? 'Rajdhani' : trainName.includes('Vande') ? 'Vande Bharat' : 'Superfast');

            return {
              trainNumber,
              trainName,
              fromStation: {
                code: fromEp.code,
                name: fromEp.name,
                departureTime,
              },
              toStation: {
                code: toEp.code,
                name: toEp.name,
                arrivalTime,
              },
              duration: typeof item.duration === 'string' ? item.duration : '15h 30m',
              distanceKm: typeof item.distanceKm === 'number' ? item.distanceKm : typeof item.distance === 'number' ? item.distance : 1384,
              runningDays,
              classes,
              trainType,
              hasPantry: Boolean(item.hasPantry ?? item.pantry ?? true),
            };
          });

          const topFrom = extractStationEndpoint(json.data.fromStation || json.data.from || fromObj, from);
          const topTo = extractStationEndpoint(json.data.toStation || json.data.to || toObj, to);

          return {
            fromStation: { code: topFrom.code, name: topFrom.name },
            toStation: { code: topTo.code, name: topTo.name },
            totalTrains: normalisedTrains.length,
            trains: normalisedTrains,
          };
        }
      }
    }
  } catch {
    // fallback
  }

  // Filter local DB matching route
  const matches = TRAINS_DB.filter(
    (t) =>
      (t.fromCode.toUpperCase() === from || t.from.toUpperCase().includes(from)) &&
      (t.toCode.toUpperCase() === to || t.to.toUpperCase().includes(to))
  );

  const trains = (matches.length > 0 ? matches : TRAINS_DB.slice(0, 6)).map((t, idx) => ({
    trainNumber: t.number,
    trainName: t.name,
    fromStation: {
      code: t.fromCode,
      name: t.from,
      departureTime: `${(6 + idx * 3) % 24}:30`.padStart(5, '0'),
    },
    toStation: {
      code: t.toCode,
      name: t.to,
      arrivalTime: `${(14 + idx * 3) % 24}:45`.padStart(5, '0'),
    },
    duration: '15h 45m',
    distanceKm: 1384,
    runningDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    classes: ['1A', '2A', '3A', 'SL'],
    trainType: t.name.includes('Rajdhani') ? 'Rajdhani' : t.name.includes('Vande') ? 'Vande Bharat' : 'Superfast',
    hasPantry: true,
  }));

  const allStations = getLocalStations();
  const fromObj = allStations.find((s) => s.code === from) || { code: from, name: from };
  const toObj = allStations.find((s) => s.code === to) || { code: to, name: to };

  return {
    fromStation: fromObj,
    toStation: toObj,
    totalTrains: trains.length,
    trains,
  };
}

// ─── 7. Station Timetable Board & Live Departures ───────────────────────────

export async function getStationBoard(stationCode: string): Promise<StationBoardData> {
  const code = stationCode.trim().toUpperCase();
  const allStations = getLocalStations();
  const stInfo = allStations.find((s) => s.code === code) || { code, name: `${code} Junction` };

  try {
    const res = await rrFetch(`${RR_BASE}/stations/${code}/trains`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        const rawList = Array.isArray(json.data)
          ? json.data
          : Array.isArray(json.data.trains)
          ? json.data.trains
          : [];

        if (rawList.length > 0) {
          const normalisedTrains = rawList.map((item: any, idx: number) => {
            const originRaw = item.origin || item.fromStation || item.sourceStation || item.source || item.from;
            const originEp = extractStationEndpoint(originRaw, 'NDLS');

            const destRaw = item.destination || item.toStation || item.destStation || item.destinationStation || item.to;
            const destEp = extractStationEndpoint(destRaw, 'MMCT');

            return {
              trainNumber: typeof item.trainNumber === 'string' ? item.trainNumber : typeof item.number === 'string' ? item.number : '12000',
              trainName: typeof item.trainName === 'string' ? item.trainName : typeof item.name === 'string' ? item.name : 'Express',
              scheduledArrival: item.scheduledArrival || item.arrival || `${(8 + idx * 2) % 24}:15`.padStart(5, '0'),
              scheduledDeparture: item.scheduledDeparture || item.departure || `${(8 + idx * 2) % 24}:25`.padStart(5, '0'),
              actualArrival: item.actualArrival,
              actualDeparture: item.actualDeparture,
              delayMinutes: item.delayMinutes ?? item.delayArrival ?? item.delayDeparture ?? 0,
              platform: item.platform ? String(item.platform) : `${(idx % 6) + 1}`,
              origin: { code: originEp.code, name: originEp.name },
              destination: { code: destEp.code, name: destEp.name },
              status: (item.status || (item.delayMinutes > 0 ? 'delayed' : 'on_time')) as any,
              trainType: item.trainType || item.type || (item.trainName?.includes('Rajdhani') ? 'Rajdhani' : 'Superfast'),
            };
          });

          return {
            stationCode: code,
            stationName: json.data.stationName || stInfo.name,
            zone: json.data.zone,
            lastUpdated: json.data.lastUpdated || new Date().toISOString(),
            trains: normalisedTrains,
          };
        }
      }
    }
  } catch {
    // fallback
  }

  const trains = TRAINS_DB.filter(
    (t) => t.fromCode === code || t.toCode === code
  ).slice(0, 10).map((t, idx) => ({
    trainNumber: t.number,
    trainName: t.name,
    scheduledArrival: `${(8 + idx * 2) % 24}:15`.padStart(5, '0'),
    scheduledDeparture: `${(8 + idx * 2) % 24}:25`.padStart(5, '0'),
    delayMinutes: idx % 3 === 0 ? 12 : 0,
    platform: `${(idx % 6) + 1}`,
    origin: { code: t.fromCode, name: t.from },
    destination: { code: t.toCode, name: t.to },
    status: (idx % 3 === 0 ? 'delayed' : 'on_time') as any,
    trainType: t.name.includes('Rajdhani') ? 'Rajdhani' : 'Superfast',
  }));

  return {
    stationCode: code,
    stationName: stInfo.name,
    lastUpdated: new Date().toISOString(),
    trains: trains.length > 0 ? trains : [
      {
        trainNumber: '12952',
        trainName: 'Mumbai Tejas Rajdhani Express',
        scheduledArrival: '16:50',
        scheduledDeparture: '17:00',
        delayMinutes: 0,
        platform: '1',
        origin: { code: 'NDLS', name: 'New Delhi' },
        destination: { code: 'MMCT', name: 'Mumbai Central' },
        status: 'on_time',
        trainType: 'Rajdhani',
      },
      {
        trainNumber: '12302',
        trainName: 'Howrah Rajdhani Express',
        scheduledArrival: '16:55',
        scheduledDeparture: '17:05',
        delayMinutes: 15,
        platform: '3',
        origin: { code: 'NDLS', name: 'New Delhi' },
        destination: { code: 'HWH', name: 'Howrah' },
        status: 'delayed',
        trainType: 'Rajdhani',
      },
    ],
  };
}

export async function getStationLiveBoard(stationCode: string, hours: number = 4): Promise<StationBoardData> {
  const code = stationCode.trim().toUpperCase();
  try {
    const res = await rrFetch(`${RR_BASE}/stations/${code}/live?hours=${hours}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
    }
  } catch {
    // fallback
  }

  return getStationBoard(code);
}
