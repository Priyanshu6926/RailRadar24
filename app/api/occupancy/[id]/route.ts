import { NextRequest } from 'next/server';
import { getJourneyCached } from '@/lib/journey';
import { getCached, setCached } from '@/lib/cache';
import { jsonOk, jsonFail } from '@/lib/api-response';

export interface ClassOccupancy {
  classCode: string;       // 1A, 2A, 3A, SL, CC, GN
  className: string;       // AC First Class, AC 2-Tier, Sleeper, General
  emoji: string;
  coachCount: number;
  seatsPerCoach: number;
  seatsTotal: number;
  seatsOccupied: number;
  fillPercent: number;     // 0-100
  wlCount: number;
  racCount: number;
  availableCount: number;
  status: 'available' | 'filling' | 'crowded' | 'full' | 'regret';
}

export interface TrainOccupancyData {
  trainNumber: string;
  trainName: string;
  overallFillPercent: number;
  totalSeats: number;
  totalOccupied: number;
  classes: ClassOccupancy[];
  journeyCompletionPct: number;
  trend: 'filling' | 'emptying' | 'stable';
  lastUpdated: string;
}

const CLASS_CONFIG: Array<{
  classCode: string;
  className: string;
  emoji: string;
  seatsPerCoach: number;
  defaultCoaches: number;
}> = [
  { classCode: '1A',  className: 'AC First Class',  emoji: '👑', seatsPerCoach: 24,  defaultCoaches: 1 },
  { classCode: '2A',  className: 'AC 2-Tier',        emoji: '🛏', seatsPerCoach: 48,  defaultCoaches: 2 },
  { classCode: '3A',  className: 'AC 3-Tier',        emoji: '🛌', seatsPerCoach: 64,  defaultCoaches: 4 },
  { classCode: 'SL',  className: 'Sleeper',          emoji: '🛏', seatsPerCoach: 72,  defaultCoaches: 8 },
  { classCode: 'CC',  className: 'Chair Car (AC)',   emoji: '💺', seatsPerCoach: 78,  defaultCoaches: 0 },
  { classCode: 'GN',  className: 'General / UR',     emoji: '🚃', seatsPerCoach: 100, defaultCoaches: 2 },
];

function deriveComposition(trainName: string): Record<string, number> {
  const n = trainName.toLowerCase();
  if (n.includes('rajdhani') || n.includes('duronto')) {
    return { '1A': 1, '2A': 3, '3A': 6 };
  }
  if (n.includes('shatabdi') || n.includes('vande bharat') || n.includes('gatimaan') || n.includes('tejas')) {
    return { 'CC': 12, '1A': 1 };
  }
  if (n.includes('garib') || n.includes('humsafar')) {
    return { '3A': 14 };
  }
  if (n.includes('passenger') || n.includes('memu') || n.includes('demu') || n.includes('local')) {
    return { 'GN': 10 };
  }
  // Default mail/express
  return { '1A': 1, '2A': 2, '3A': 4, 'SL': 8, 'GN': 2 };
}

function generateOccupancy(
  trainNumber: string,
  trainName: string,
  completionPct: number
): TrainOccupancyData {
  // Use train number as seed for consistent results within the day
  const seed = parseInt(trainNumber.replace(/\D/g, '').slice(-4) || '1234', 10);
  const pseudo = (offset: number) => ((seed * 1103515245 + offset * 12345) & 0x7fffffff) / 0x7fffffff;

  const composition = deriveComposition(trainName);
  const hour = new Date().getHours();
  // Base fill influenced by journey progress + time of day
  const baseFill = Math.min(95, 40 + completionPct * 0.5 + (hour > 10 && hour < 22 ? 15 : 0));

  const classes: ClassOccupancy[] = [];

  CLASS_CONFIG.forEach((cfg, i) => {
    const coachCount = composition[cfg.classCode] ?? cfg.defaultCoaches;
    if (coachCount === 0) return;

    const seatsTotal = coachCount * cfg.seatsPerCoach;
    // Vary fill per class with pseudo-random but realistic bias
    const variance = (pseudo(i * 7 + 1) - 0.5) * 20;
    let fill = Math.min(100, Math.max(0, baseFill + variance));

    // GN is always more crowded
    if (cfg.classCode === 'GN') fill = Math.min(100, fill + 20);
    // 1A is typically less full
    if (cfg.classCode === '1A') fill = Math.max(0, fill - 15);

    const seatsOccupied = Math.round(seatsTotal * fill / 100);
    const availableCount = Math.max(0, seatsTotal - seatsOccupied);

    // WL/RAC only applies when close to full
    const wlCount = fill > 90 ? Math.round(pseudo(i * 13 + 2) * 40) : 0;
    const racCount = fill > 80 ? Math.round(pseudo(i * 19 + 3) * 10) : 0;

    let status: ClassOccupancy['status'] = 'available';
    if (fill >= 100) status = 'regret';
    else if (fill >= 90) status = 'full';
    else if (fill >= 70) status = 'crowded';
    else if (fill >= 45) status = 'filling';

    classes.push({
      classCode: cfg.classCode,
      className: cfg.className,
      emoji: cfg.emoji,
      coachCount,
      seatsPerCoach: cfg.seatsPerCoach,
      seatsTotal,
      seatsOccupied,
      fillPercent: Math.round(fill),
      wlCount,
      racCount,
      availableCount,
      status,
    });
  });

  const totalSeats = classes.reduce((s, c) => s + c.seatsTotal, 0);
  const totalOccupied = classes.reduce((s, c) => s + c.seatsOccupied, 0);
  const overallFill = totalSeats > 0 ? Math.round((totalOccupied / totalSeats) * 100) : 0;
  const trend = completionPct < 30 ? 'filling' : completionPct > 70 ? 'emptying' : 'stable';

  return {
    trainNumber,
    trainName,
    overallFillPercent: overallFill,
    totalSeats,
    totalOccupied,
    classes,
    journeyCompletionPct: Math.round(completionPct),
    trend,
    lastUpdated: new Date().toISOString(),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: trainId } = await params;
  if (!trainId || !/^\d{4,5}$/.test(trainId.trim())) {
    return jsonFail('Valid 4 or 5 digit train number is required', 400, 'synthetic');
  }

  const cleanTrainId = trainId.trim();
  const cacheKey = `occupancy:${cleanTrainId}`;

  const cached = getCached<TrainOccupancyData>(cacheKey);
  if (cached) {
    return jsonOk(cached, true, 200, 'synthetic');
  }

  try {
    const journey = await getJourneyCached(cleanTrainId);
    let completionPct = 50;
    let trainName = `Train #${cleanTrainId}`;
    if (journey) {
      completionPct = journey.completionPercentage ?? 50;
      trainName = journey.name ?? trainName;
    }

    const data = generateOccupancy(cleanTrainId, trainName, completionPct);
    setCached(cacheKey, data, 120); // 2 min cache

    return jsonOk(data, false, 200, 'synthetic');
  } catch (err: any) {
    console.error('[api/occupancy]', err);
    return jsonFail('Failed to generate occupancy model', 500, 'synthetic');
  }
}

