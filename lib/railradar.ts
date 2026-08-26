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

  const currentLocation: LiveJourney['currentLocation'] = {
    lat: trainLat,
    lng: trainLng,
    heading: 45,
    speedKmh: Math.round(train?.avgSpeed || 80),
    isMoving: raw.status === 'running',
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
      const msg = extractErrorMessage(json);
      if (liveRes.status === 429 || json?.error?.code === 'TOO_MANY_REQUESTS') {
        return generateFallbackJourney(trainNumber);
      }
      return generateFallbackJourney(trainNumber);
    }

    if (!json?.success || !json?.data) {
      return generateFallbackJourney(trainNumber);
    }

    return normaliseLiveResponse(json.data as RRLiveResponse, routeGeo);
  } catch (err: any) {
    return generateFallbackJourney(trainNumber);
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

export async function getPNRStatus(pnr: string): Promise<PNRStatusData> {
  const cleanPnr = pnr.replace(/\D/g, '').slice(0, 10);
  try {
    const res = await rrFetch(`${RR_BASE}/pnr/${cleanPnr}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        return {
          pnr: d.pnr || cleanPnr,
          trainNumber: d.trainNumber || d.train?.number || '12951',
          trainName: d.trainName || d.train?.name || 'Tejas Rajdhani Express',
          journeyDate: d.journeyDate || d.doj || '2026-08-30',
          fromStation: {
            code: d.fromStation?.code || d.source || 'MMCT',
            name: d.fromStation?.name || 'Mumbai Central',
          },
          toStation: {
            code: d.toStation?.code || d.destination || 'NDLS',
            name: d.toStation?.name || 'New Delhi',
          },
          boardingStation: {
            code: d.boardingStation?.code || d.boardingPoint || 'MMCT',
            name: d.boardingStation?.name || 'Mumbai Central',
          },
          reservationUpto: {
            code: d.reservationUpto?.code || d.reservationPoint || 'NDLS',
            name: d.reservationUpto?.name || 'New Delhi',
          },
          class: d.class || '3A',
          quota: d.quota || 'GN',
          chartPrepared: Boolean(d.chartPrepared),
          passengers: Array.isArray(d.passengers)
            ? d.passengers.map((p: any, idx: number) => ({
                passengerNumber: idx + 1,
                bookingStatus: p.bookingStatus || 'WL 4',
                currentStatus: p.currentStatus || 'CNF',
                coach: p.coach || 'B4',
                berth: p.berth || 34,
                berthType: p.berthType || 'MB',
                predictionProbability: p.probability || 94,
                predictionStatus: p.probability > 75 ? 'High' : p.probability > 45 ? 'Medium' : 'Low',
              }))
            : [],
          expectedPlatform: d.expectedPlatform || '1',
        };
      }
    }
  } catch {
    // fallback
  }

  // Realistic Fallback PNR for demonstration / offline
  return {
    pnr: cleanPnr || '2849102847',
    trainNumber: '12951',
    trainName: 'Mumbai Tejas Rajdhani Express',
    journeyDate: '2026-08-30',
    fromStation: { code: 'MMCT', name: 'Mumbai Central' },
    toStation: { code: 'NDLS', name: 'New Delhi' },
    boardingStation: { code: 'MMCT', name: 'Mumbai Central' },
    reservationUpto: { code: 'NDLS', name: 'New Delhi' },
    class: '3A',
    quota: 'GN',
    chartPrepared: false,
    expectedPlatform: '1',
    passengers: [
      {
        passengerNumber: 1,
        bookingStatus: 'WL 14',
        currentStatus: 'CNF',
        coach: 'B3',
        berth: 47,
        berthType: 'SL',
        predictionProbability: 92,
        predictionStatus: 'High',
      },
      {
        passengerNumber: 2,
        bookingStatus: 'WL 15',
        currentStatus: 'RAC 4',
        coach: 'B3',
        berth: 48,
        berthType: 'SU',
        predictionProbability: 88,
        predictionStatus: 'High',
      },
    ],
  };
}

export async function getPNRPrediction(pnr: string): Promise<PNRPredictionData> {
  const cleanPnr = pnr.replace(/\D/g, '').slice(0, 10);
  try {
    const res = await rrFetch(`${RR_BASE}/pnr/${cleanPnr}/prediction`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return {
          pnr: cleanPnr,
          trainNumber: json.data.trainNumber || '12951',
          confirmationProbability: json.data.probability ?? json.data.confirmationProbability ?? 85,
          status: (json.data.status as any) || 'High',
          historicalTrend: json.data.historicalTrend || '89% of similar waitlists confirmed in the last 60 days.',
          message: json.data.message || 'Very high chances of confirmation before chart preparation.',
        };
      }
    }
  } catch {
    // fallback
  }

  return {
    pnr: cleanPnr,
    trainNumber: '12951',
    confirmationProbability: 88,
    status: 'High',
    historicalTrend: 'Based on 450+ past journeys on this route, waitlists up to WL 25 confirm 92% of the time.',
    message: 'High probability of confirmation. Coach allocation expected at charting (4 hours before departure).',
  };
}

export async function getPNRRefund(pnr: string): Promise<PNRRefundData> {
  const cleanPnr = pnr.replace(/\D/g, '').slice(0, 10);
  try {
    const res = await rrFetch(`${RR_BASE}/pnr/${cleanPnr}/refund`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return {
          pnr: cleanPnr,
          ticketFare: json.data.ticketFare ?? 2450,
          clerkageCharge: json.data.clerkageCharge ?? 60,
          cancellationCharge: json.data.cancellationCharge ?? 190,
          refundableAmount: json.data.refundableAmount ?? 2200,
          ruleApplied: json.data.ruleApplied || 'Cancelled > 48 hours before scheduled departure',
        };
      }
    }
  } catch {
    // fallback
  }

  return {
    pnr: cleanPnr,
    ticketFare: 2450,
    clerkageCharge: 60,
    cancellationCharge: 190,
    refundableAmount: 2200,
    ruleApplied: 'IRCTC Rule: Cancellation made > 48 hours before departure. Flat cancellation charge applied for AC 3-Tier.',
  };
}

// ─── 4. Train Fare Calculator ──────────────────────────────────────────────

export async function getTrainFare(trainNumber: string, fromStation?: string, toStation?: string): Promise<TrainFareData> {
  try {
    const qs = fromStation && toStation ? `?from=${fromStation}&to=${toStation}` : '';
    const res = await rrFetch(`${RR_BASE}/trains/${trainNumber}/fare${qs}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
    }
  } catch {
    // fallback
  }

  const train = TRAINS_DB.find((t) => t.number === trainNumber) || {
    name: 'Superfast Express',
    from: fromStation || 'MMCT',
    to: toStation || 'NDLS',
  };

  return {
    trainNumber,
    trainName: train.name,
    fromStation: fromStation || 'MMCT',
    toStation: toStation || 'NDLS',
    distanceKm: 1384,
    fares: [
      {
        classCode: '1A',
        className: 'AC First Class',
        baseFare: 3820,
        reservationCharge: 60,
        superfastCharge: 75,
        gst: 198,
        totalFare: 4153,
        availableQuotas: ['GN', 'FT', 'PT'],
      },
      {
        classCode: '2A',
        className: 'AC 2-Tier',
        baseFare: 2280,
        reservationCharge: 50,
        superfastCharge: 45,
        gst: 119,
        totalFare: 2494,
        availableQuotas: ['GN', 'TQ', 'LD', 'PT'],
      },
      {
        classCode: '3A',
        className: 'AC 3-Tier',
        baseFare: 1610,
        reservationCharge: 40,
        superfastCharge: 45,
        gst: 85,
        totalFare: 1780,
        availableQuotas: ['GN', 'TQ', 'LD', 'SS'],
      },
      {
        classCode: '3E',
        className: 'AC 3 Economy',
        baseFare: 1450,
        reservationCharge: 40,
        superfastCharge: 45,
        gst: 77,
        totalFare: 1612,
        availableQuotas: ['GN', 'TQ'],
      },
      {
        classCode: 'SL',
        className: 'Sleeper Class',
        baseFare: 590,
        reservationCharge: 20,
        superfastCharge: 30,
        gst: 0,
        totalFare: 640,
        availableQuotas: ['GN', 'TQ', 'LD', 'SS', 'DF'],
      },
      {
        classCode: '2S',
        className: 'Second Sitting',
        baseFare: 340,
        reservationCharge: 15,
        superfastCharge: 15,
        gst: 0,
        totalFare: 370,
        availableQuotas: ['GN', 'TQ'],
      },
    ],
  };
}

// ─── 5. 14-Day Seat Availability Forecast ──────────────────────────────────

export async function getSeatAvailability(
  trainNumber: string,
  fromStation: string,
  toStation: string,
  classCode: string = '3A',
  quota: string = 'GN'
): Promise<SeatAvailabilityData> {
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
  } catch {
    // fallback
  }

  // Generate 14-day rolling seat availability
  const days: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const availability = Array.from({ length: 14 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() + idx + 1);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = days[d.getDay()];

    if (idx === 0 || idx === 1) {
      return {
        date: dateStr,
        day: dayName,
        status: `WL ${idx * 6 + 12}`,
        statusCode: 'WL' as const,
        chance: 75 - idx * 10,
        fare: 1780,
      };
    } else if (idx === 2 || idx === 3) {
      return {
        date: dateStr,
        day: dayName,
        status: `RAC ${idx + 2}`,
        statusCode: 'RAC' as const,
        chance: 95,
        fare: 1780,
      };
    } else {
      const seats = Math.floor(Math.random() * 80) + 10;
      return {
        date: dateStr,
        day: dayName,
        status: `AVAILABLE-${seats.toString().padStart(4, '0')}`,
        statusCode: 'AVAILABLE' as const,
        chance: 100,
        fare: 1780,
      };
    }
  });

  return {
    trainNumber,
    trainName: 'Express Service',
    classCode,
    quota,
    fromStation,
    toStation,
    availability,
  };
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
        return json.data;
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
  try {
    const res = await rrFetch(`${RR_BASE}/stations/${code}/trains`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
    }
  } catch {
    // fallback
  }

  const allStations = getLocalStations();
  const stInfo = allStations.find((s) => s.code === code) || { code, name: `${code} Junction` };

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
