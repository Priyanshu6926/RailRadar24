'use client';

import React from 'react';
import { MapPin, Clock, Users, ArrowRight, Share2, Train } from 'lucide-react';
import { LiveJourney } from '@/types/train';
import { cn } from '@/utils/cn';

interface PlatformFinderProps {
  journey: LiveJourney;
}

// ── Weighted crowd scoring ───────────────────────────────────────────────────
interface CrowdResult {
  label: 'Very Low' | 'Low' | 'Moderate' | 'High' | 'Very High';
  score: number;
  color: string;
  bg: string;
  border: string;
  barColor: string;
  desc: string;
  tip: string;
}

function computeCrowdScore(journey: LiveJourney): CrowdResult {
  let score = 0;

  // 1. Hour-of-day (0-35 pts)
  const hour = new Date().getHours();
  const isPeak = (hour >= 6 && hour <= 10) || (hour >= 17 && hour <= 21);
  const isMidnight = hour >= 23 || hour <= 4;
  if (isPeak) score += 35;
  else if (isMidnight) score += 5;
  else score += 18;

  // 2. Day-of-week (0-10 pts)
  const dow = new Date().getDay();
  if (dow === 0 || dow === 5) score += 10; // Sun, Fri
  else if (dow === 1 || dow === 6) score += 5; // Mon, Sat

  // 3. Train type modifier
  const trainNameLower = journey.name.toLowerCase();
  const isReservedAC =
    trainNameLower.includes('rajdhani') ||
    trainNameLower.includes('shatabdi') ||
    trainNameLower.includes('duronto') ||
    trainNameLower.includes('vande bharat') ||
    trainNameLower.includes('gatimaan') ||
    trainNameLower.includes('tejas');
  const isGeneral =
    trainNameLower.includes('passenger') ||
    trainNameLower.includes('local') ||
    trainNameLower.includes('memu') ||
    trainNameLower.includes('demu');
  if (isReservedAC) score -= 15;
  else if (isGeneral) score += 20;
  else score += 8;

  // 4. Delay modifier
  if (journey.delayMinutes > 60) score += 15;
  else if (journey.delayMinutes > 30) score += 10;
  else if (journey.delayMinutes > 10) score += 5;
  else if (journey.delayMinutes < 0) score -= 5;

  // 5. Halt duration
  const haltMin = journey.nextStation?.haltMinutes || 0;
  if (haltMin >= 10) score += 10;
  else if (haltMin >= 5) score += 6;
  else if (haltMin >= 2) score += 3;

  score = Math.min(100, Math.max(0, score));

  if (score < 20) return {
    label: 'Very Low', score,
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    barColor: 'from-emerald-400 to-emerald-500',
    desc: isReservedAC ? 'Reserved AC train — pre-assigned seats' : 'Very quiet, easy boarding',
    tip: 'Arrive just before departure',
  };
  if (score < 40) return {
    label: 'Low', score,
    color: 'text-teal-700 dark:text-teal-300',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/20',
    barColor: 'from-teal-400 to-emerald-500',
    desc: 'Light crowd — comfortable boarding expected',
    tip: 'No rush, board normally',
  };
  if (score < 60) return {
    label: 'Moderate', score,
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    barColor: 'from-amber-400 to-amber-500',
    desc: 'Typical crowd — allow extra boarding time',
    tip: 'Arrive 5 min early on platform',
  };
  if (score < 80) return {
    label: 'High', score,
    color: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    barColor: 'from-orange-400 to-rose-500',
    desc: 'Peak-hour rush — platform likely crowded',
    tip: 'Reach platform 10-15 min early',
  };
  return {
    label: 'Very High', score,
    color: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    barColor: 'from-rose-500 to-red-600',
    desc: 'Severe crowding — expect platform rush',
    tip: 'Reach platform 20+ min early, stay alert',
  };
}

function getClassLabel(journey: LiveJourney): string | null {
  const name = journey.name.toLowerCase();
  if (name.includes('rajdhani') || name.includes('duronto')) return 'AC Only (1A · 2A · 3A)';
  if (name.includes('shatabdi') || name.includes('vande bharat') || name.includes('gatimaan')) return 'Chair Car AC (CC · EC)';
  if (name.includes('garib') || name.includes('humsafar')) return 'All 3A AC';
  if (name.includes('passenger') || name.includes('memu') || name.includes('demu') || name.includes('local')) return 'Unreserved (GN · SL)';
  return 'Mixed (SL · 3A · 2A · GN)';
}

export function PlatformFinder({ journey }: PlatformFinderProps) {
  const nextHalt = journey.nextStation || journey.currentStation;
  const crowd = computeCrowdScore(journey);
  const classLabel = getClassLabel(journey);

  const handleShare = () => {
    const msg = `🚂 ${journey.name} (#${journey.number})\n📍 Next halt: ${nextHalt?.name} (PF ${nextHalt?.platform || '?'})\n⏰ ETA: ${nextHalt?.scheduledArrival}\n${journey.delayMinutes > 0 ? `⚠️ Running ${journey.delayMinutes}m late` : '✅ On time'}\n👥 Platform Crowd: ${crowd.label}`;
    if (navigator.share) {
      navigator.share({ title: `RailGaadi — Platform Info`, text: msg });
    } else {
      navigator.clipboard?.writeText(msg);
    }
  };

  if (!nextHalt) {
    return (
      <div className="glass-panel rounded-3xl p-6 shadow-glass">
        <p className="text-sm text-slate-400">No upcoming halt information available.</p>
      </div>
    );
  }

  const haltMinutes = nextHalt.haltMinutes || (nextHalt.isHalt ? 2 : 0);

  return (
    <div className="glass-panel rounded-3xl p-6 shadow-glass space-y-5">
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-rail-blue" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Next Platform</h3>
      </div>

      {/* Main station card */}
      <div className="rounded-2xl bg-gradient-to-br from-rail-blue/10 to-sky-500/5 border border-rail-blue/20 p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rail-blue mb-1">Next Halt</p>
            <h4 className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight">{nextHalt.name}</h4>
            <p className="text-sm font-mono text-slate-500 dark:text-slate-400">{nextHalt.code}</p>
          </div>
          {nextHalt.platform && (
            <div className="flex flex-col items-center justify-center h-16 w-16 rounded-2xl bg-rail-blue text-white shadow-glow">
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">PF</p>
              <p className="text-3xl font-extrabold leading-none">{nextHalt.platform}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/50 dark:bg-slate-900/50 p-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase flex items-center gap-1">
              <Clock className="h-3 w-3" /> Scheduled Arr.
            </p>
            <p className="font-mono text-lg font-bold text-slate-900 dark:text-white">{nextHalt.scheduledArrival}</p>
            {journey.delayMinutes > 0 && (
              <p className="text-[11px] text-rose-500 font-semibold">Est. {nextHalt.actualArrival || '—'} (+{journey.delayMinutes}m)</p>
            )}
          </div>
          <div className="rounded-xl bg-white/50 dark:bg-slate-900/50 p-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase flex items-center gap-1">
              <Clock className="h-3 w-3" /> Halt Duration
            </p>
            <p className="font-mono text-lg font-bold text-slate-900 dark:text-white">
              {haltMinutes > 0 ? `${haltMinutes} min` : '< 1 min'}
            </p>
            <p className="text-[11px] text-slate-400">Stop time</p>
          </div>
        </div>

        {classLabel && (
          <div className="flex items-center gap-2 rounded-xl bg-white/40 dark:bg-slate-900/40 px-3 py-2">
            <Train className="h-3.5 w-3.5 text-rail-blue flex-shrink-0" />
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{classLabel}</span>
          </div>
        )}
      </div>

      {/* Crowd Indicator */}
      <div className={cn('rounded-2xl p-4 border space-y-3', crowd.bg, crowd.border)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className={cn('h-4 w-4 flex-shrink-0', crowd.color)} />
            <p className={cn('text-sm font-bold', crowd.color)}>Platform Crowd: {crowd.label}</p>
          </div>
          <span className={cn('text-xs font-bold font-mono tabular-nums', crowd.color)}>{crowd.score}%</span>
        </div>

        {/* Crowd bar */}
        <div className="h-2.5 w-full rounded-full bg-slate-200/60 dark:bg-slate-800/60 overflow-hidden">
          <div
            className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', crowd.barColor)}
            style={{ width: `${crowd.score}%` }}
          />
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">{crowd.desc}</p>
        <div className={cn('flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold bg-white/40 dark:bg-slate-900/30', crowd.color)}>
          <span>💡</span>
          <span>{crowd.tip}</span>
        </div>
      </div>

      {/* Distance Remaining */}
      {nextHalt.distanceKm > 0 && journey.distanceCoveredKm < nextHalt.distanceKm && (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <ArrowRight className="h-4 w-4 text-rail-blue" />
          <span>
            <strong className="text-slate-800 dark:text-slate-200 font-bold">
              {Math.round(nextHalt.distanceKm - journey.distanceCoveredKm)} km
            </strong>
            {' '}to reach {nextHalt.name}
          </span>
        </div>
      )}

      {/* Share Button */}
      <button
        onClick={handleShare}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
      >
        <Share2 className="h-4 w-4" />
        Share Platform Info
      </button>
    </div>
  );
}

