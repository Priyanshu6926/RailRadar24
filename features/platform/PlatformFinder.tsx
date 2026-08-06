'use client';

import React from 'react';
import { MapPin, Clock, Users, ArrowRight, Share2 } from 'lucide-react';
import { LiveJourney } from '@/types/train';
import { cn } from '@/utils/cn';

interface PlatformFinderProps {
  journey: LiveJourney;
}

function crowdLevel(journey: LiveJourney): { label: string; color: string; dot: string; desc: string } {
  const hour = new Date().getHours();
  const isPeak = (hour >= 6 && hour <= 10) || (hour >= 17 && hour <= 21);
  const isRajdhani = journey.name.toLowerCase().includes('rajdhani') || journey.name.toLowerCase().includes('shatabdi') || journey.name.toLowerCase().includes('duronto');

  if (isRajdhani) {
    return { label: 'Low', color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', desc: 'Reserved AC train — seats pre-assigned' };
  }
  if (isPeak) {
    return { label: 'High', color: 'text-rose-600 dark:text-rose-400', dot: 'bg-rose-500', desc: 'Peak hours — expect busy platforms' };
  }
  return { label: 'Moderate', color: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500', desc: 'Normal crowd expected' };
}

export function PlatformFinder({ journey }: PlatformFinderProps) {
  const nextHalt = journey.nextStation || journey.currentStation;
  const crowd = crowdLevel(journey);

  const handleShare = () => {
    const msg = `🚂 ${journey.name} (#${journey.number})\n📍 Next halt: ${nextHalt?.name} (PF ${nextHalt?.platform || '?'})\n⏰ ETA: ${nextHalt?.scheduledArrival}\n${journey.delayMinutes > 0 ? `⚠️ Running ${journey.delayMinutes}m late` : '✅ On time'}`;
    if (navigator.share) {
      navigator.share({ title: `RailRadar24 — Platform Info`, text: msg });
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
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Scheduled Arr.</p>
            <p className="font-mono text-lg font-bold text-slate-900 dark:text-white">{nextHalt.scheduledArrival}</p>
            {journey.delayMinutes > 0 && (
              <p className="text-[11px] text-rose-500 font-semibold">Est. {nextHalt.actualArrival || '—'} (+{journey.delayMinutes}m)</p>
            )}
          </div>
          <div className="rounded-xl bg-white/50 dark:bg-slate-900/50 p-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Halt Duration</p>
            <p className="font-mono text-lg font-bold text-slate-900 dark:text-white">
              {haltMinutes > 0 ? `${haltMinutes} min` : '< 1 min'}
            </p>
            <p className="text-[11px] text-slate-400">Stop time</p>
          </div>
        </div>
      </div>

      {/* Crowd Indicator */}
      <div className={cn(
        'flex items-center gap-3 rounded-2xl p-4 border',
        crowd.label === 'High'
          ? 'bg-rose-500/5 border-rose-500/20'
          : crowd.label === 'Low'
          ? 'bg-emerald-500/5 border-emerald-500/20'
          : 'bg-amber-500/5 border-amber-500/20'
      )}>
        <Users className={cn('h-5 w-5 flex-shrink-0', crowd.color)} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full', crowd.dot)} />
            <p className={cn('text-sm font-bold', crowd.color)}>Platform Crowd: {crowd.label}</p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{crowd.desc}</p>
        </div>
      </div>

      {/* Distance Remaining */}
      {nextHalt.distanceKm > 0 && journey.distanceCoveredKm < nextHalt.distanceKm && (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <ArrowRight className="h-4 w-4 text-rail-blue" />
          <span>
            <strong className="text-slate-800 dark:text-slate-200 font-bold">
              {nextHalt.distanceKm - journey.distanceCoveredKm} km
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
