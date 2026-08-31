'use client';

import React from 'react';
import { MapPin, Clock, Users, ArrowRight, Share2, Train } from 'lucide-react';
import { LiveJourney } from '@/types/train';
import { getEstimatedCrowd } from '@/lib/crowd';
import { cn } from '@/utils/cn';

interface PlatformFinderProps {
  journey: LiveJourney;
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
  const crowd = getEstimatedCrowd(journey.name, journey.delayMinutes);
  const classLabel = getClassLabel(journey);

  const handleShare = () => {
    const msg = `🚂 ${journey.name} (#${journey.number})\n📍 Next halt: ${nextHalt?.name} (PF ${nextHalt?.platform || '?'})\n⏰ ETA: ${nextHalt?.scheduledArrival}\n${journey.delayMinutes > 0 ? `⚠️ Running ${journey.delayMinutes}m late` : '✅ On time'}\n👥 Estimated Platform Crowd: ${crowd.label}`;
    if (navigator.share) {
      navigator.share({ title: `RailRadar24 — Platform Info`, text: msg });
    } else {
      navigator.clipboard?.writeText(msg);
    }
  };

  if (!nextHalt) return null;

  return (
    <div className="glass-panel rounded-3xl p-6 shadow-glass space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rail-blue/10 text-rail-blue">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
              Next Halt & Platform
            </h3>
            <p className="text-xs text-slate-400">Upcoming station stop details</p>
          </div>
        </div>

        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Share platform info"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span>Share</span>
        </button>
      </div>

      {/* Main Platform Card */}
      <div className="rounded-2xl bg-gradient-to-br from-rail-blue/10 via-sky-500/5 to-transparent border border-rail-blue/20 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rail-blue">
              Next Station Stop
            </span>
            <h4 className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              {nextHalt.name}
            </h4>
            <p className="text-xs font-mono font-semibold text-slate-400">{nextHalt.code}</p>
          </div>

          {/* Platform Badge */}
          <div className="flex flex-col items-center justify-center rounded-2xl bg-rail-blue text-white px-4 py-3 shadow-glow flex-shrink-0 min-w-[72px]">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Platform</span>
            <span className="font-mono text-2xl font-black leading-none mt-0.5">
              {nextHalt.platform || '—'}
            </span>
            {!nextHalt.platform && (
              <span className="text-[9px] opacity-70 mt-0.5">TBD</span>
            )}
          </div>
        </div>

        {/* Arrival + Delay row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-rail-blue/10 text-xs">
          <div className="space-y-0.5">
            <span className="text-slate-400 font-medium">Scheduled Arrival</span>
            <p className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              {nextHalt.scheduledArrival || '—'}
            </p>
          </div>

          {nextHalt.haltMinutes !== undefined && nextHalt.haltMinutes > 0 && (
            <div className="space-y-0.5">
              <span className="text-slate-400 font-medium">Halt Duration</span>
              <p className="font-mono font-bold text-slate-900 dark:text-white">
                {nextHalt.haltMinutes} min{nextHalt.haltMinutes > 1 ? 's' : ''}
              </p>
            </div>
          )}

          <div className="space-y-0.5">
            <span className="text-slate-400 font-medium">Current Delay</span>
            <p className={cn(
              'font-mono font-bold',
              journey.delayMinutes > 15 ? 'text-rose-500' : journey.delayMinutes > 0 ? 'text-amber-500' : 'text-emerald-500'
            )}>
              {journey.delayMinutes > 0 ? `+${journey.delayMinutes} min` : 'On Time'}
            </p>
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
      <div className="rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-500 flex-shrink-0" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              Estimated Crowd: <span className={crowd.textColor}>{crowd.label}</span>
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <span className={cn('h-2 w-2 rounded-full', crowd.dotColor)} />
            {crowd.band}
          </span>
        </div>

        <p className="text-[10px] text-slate-400 italic">
          Estimated crowd — heuristic based on time of day, train class and running delay.
        </p>
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
    </div>
  );
}

