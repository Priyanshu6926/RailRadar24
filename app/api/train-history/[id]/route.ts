import { NextRequest, NextResponse } from 'next/server';
import { getLiveJourney } from '@/lib/railradar';
import { getCached, setCached } from '@/lib/cache';
import { ApiResponse } from '@/types/api';
import { Station } from '@/types/train';

export interface SectionStats {
  fromCode: string;
  fromName: string;
  toCode: string;
  toName: string;
  distanceKm: number;
  scheduledMinutes: number;
  actualMinutes: number;
  avgSpeedKmh: number;
  delayGainMinutes: number; // positive = more delay accumulated, negative = recovered
  fromDelay: number;
  toDelay: number;
}

export interface StationDelayStats {
  code: string;
  name: string;
  scheduledArrival: string;
  actualArrival?: string;
  delayMinutes: number;
  distanceKm: number;
  status: string;
}

export interface TrainRunningAnalytics {
  trainId: string;
  trainName: string;
  totalDistanceKm: number;
  totalScheduledMinutes: number;
  overallDelayMinutes: number;
  overallPunctualityScore: number; // 0-100
  avgSpeedKmh: number;
  maxSectionSpeed: number;
  minSectionSpeed: number;
  sections: SectionStats[];
  perStation: StationDelayStats[];
  dataQuality: 'live' | 'partial' | 'estimated';
  lastUpdated: string;
}

function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr || timeStr === '--:--') return null;
  // Handle "HH:MM" or ISO strings
  const cleaned = timeStr.includes('T') 
    ? new Date(timeStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })
    : timeStr;
  const parts = cleaned.split(':');
  if (parts.length < 2) return null;
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function minutesDiff(from: string, to: string): number | null {
  const fromMin = parseTimeToMinutes(from);
  const toMin = parseTimeToMinutes(to);
  if (fromMin === null || toMin === null) return null;
  let diff = toMin - fromMin;
  // Handle midnight crossing
  if (diff < -60) diff += 24 * 60;
  return diff;
}

function punctualityScore(delayMinutes: number): number {
  if (delayMinutes <= 0) return 100;
  if (delayMinutes <= 5) return 95;
  if (delayMinutes <= 15) return 80;
  if (delayMinutes <= 30) return 65;
  if (delayMinutes <= 60) return 45;
  if (delayMinutes <= 120) return 25;
  return 10;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const resolvedParams = await Promise.resolve(params);
  const trainId = resolvedParams?.id;
  const cacheKey = `train-history:${trainId}`;

  const cached = getCached<TrainRunningAnalytics>(cacheKey);
  if (cached) {
    return NextResponse.json<ApiResponse<TrainRunningAnalytics>>({
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

    // Only use halt stations for section analytics
    const haltStations = journey.stations.filter(
      (s) => s.isHalt !== false && (s.isHalt === true || !!s.platform || s.haltMinutes !== undefined || s.code === journey.origin.code || s.code === journey.destination.code)
    );

    // Build per-section statistics
    const sections: SectionStats[] = [];

    for (let i = 0; i < haltStations.length - 1; i++) {
      const from = haltStations[i];
      const to = haltStations[i + 1];

      const distKm = Math.max(0, to.distanceKm - from.distanceKm);

      // Scheduled time for this section
      const schedDiff = minutesDiff(
        from.scheduledDeparture || from.scheduledArrival,
        to.scheduledArrival || to.scheduledDeparture
      );

      // Actual time for this section (using actual times if available)
      const actualDiff = minutesDiff(
        from.actualDeparture || from.actualArrival || from.scheduledDeparture || from.scheduledArrival,
        to.actualArrival || to.actualDeparture || to.scheduledArrival
      );

      const scheduledMinutes = schedDiff ?? (distKm > 0 ? Math.round((distKm / 60) * 60) : 0);
      const actualMinutes = actualDiff ?? scheduledMinutes;

      const avgSpeedKmh =
        distKm > 0 && actualMinutes > 0
          ? Math.round((distKm / actualMinutes) * 60)
          : 0;

      const delayGainMinutes = (to.delayMinutes || 0) - (from.delayMinutes || 0);

      sections.push({
        fromCode: from.code,
        fromName: from.name,
        toCode: to.code,
        toName: to.name,
        distanceKm: distKm,
        scheduledMinutes,
        actualMinutes,
        avgSpeedKmh,
        delayGainMinutes,
        fromDelay: from.delayMinutes || 0,
        toDelay: to.delayMinutes || 0,
      });
    }

    // Per-station stats
    const perStation: StationDelayStats[] = haltStations.map((s) => ({
      code: s.code,
      name: s.name,
      scheduledArrival: s.scheduledArrival,
      actualArrival: s.actualArrival,
      delayMinutes: s.delayMinutes || 0,
      distanceKm: s.distanceKm,
      status: s.status,
    }));

    // Overall metrics
    const validSpeeds = sections.filter((s) => s.avgSpeedKmh > 0).map((s) => s.avgSpeedKmh);
    const avgSpeedKmh = validSpeeds.length > 0
      ? Math.round(validSpeeds.reduce((a, b) => a + b, 0) / validSpeeds.length)
      : journey.speedKmh || 0;

    const totalScheduledMinutes = sections.reduce((a, s) => a + s.scheduledMinutes, 0);
    const overallDelay = journey.delayMinutes || 0;

    // Determine data quality
    const hasActualData = haltStations.some((s) => s.actualArrival || s.actualDeparture);
    const hasPassed = haltStations.some((s) => s.status === 'passed');
    const dataQuality: TrainRunningAnalytics['dataQuality'] = hasActualData ? 'live' : hasPassed ? 'partial' : 'estimated';

    const result: TrainRunningAnalytics = {
      trainId,
      trainName: journey.name,
      totalDistanceKm: journey.totalDistanceKm,
      totalScheduledMinutes,
      overallDelayMinutes: overallDelay,
      overallPunctualityScore: punctualityScore(overallDelay),
      avgSpeedKmh,
      maxSectionSpeed: validSpeeds.length > 0 ? Math.max(...validSpeeds) : 0,
      minSectionSpeed: validSpeeds.length > 0 ? Math.min(...validSpeeds) : 0,
      sections,
      perStation,
      dataQuality,
      lastUpdated: journey.lastUpdated,
    };

    setCached(cacheKey, result, 600); // 10 min cache

    return NextResponse.json<ApiResponse<TrainRunningAnalytics>>({
      success: true,
      data: result,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: err.message || 'Failed to compute running analytics', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
