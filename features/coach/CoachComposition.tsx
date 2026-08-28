'use client';

import React, { useEffect, useState } from 'react';
import { Train, Loader2, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { CoachCompositionResponse, Coach } from '@/app/api/coach/[id]/route';
import { cn } from '@/utils/cn';

interface CoachCompositionProps {
  trainId: string;
  trainName?: string;
}

const COACH_STYLES: Record<Coach['type'], { bg: string; text: string; border: string; label: string }> = {
  loco:    { bg: 'bg-slate-900 dark:bg-slate-950', text: 'text-amber-400', border: 'border-amber-500/40', label: '🚂' },
  eog:     { bg: 'bg-slate-700 dark:bg-slate-800', text: 'text-slate-300', border: 'border-slate-500/40', label: '⚡' },
  sl:      { bg: 'bg-sky-500/15', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-500/30', label: '🛏' },
  '3a':    { bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-500/30', label: '🛌' },
  '2a':    { bg: 'bg-purple-500/15', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-500/30', label: '🛏' },
  '1a':    { bg: 'bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-500/30', label: '👑' },
  gen:     { bg: 'bg-rose-500/10', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-500/30', label: '🚃' },
  pantry:  { bg: 'bg-orange-500/15', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-500/30', label: '🍽' },
  hcp:     { bg: 'bg-teal-500/10', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-500/30', label: '♿' },
  other:   { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-300', border: 'border-slate-400/30', label: '🚋' },
};

const CLASS_LEGEND = [
  { type: 'loco' as Coach['type'], name: 'Locomotive' },
  { type: 'eog' as Coach['type'], name: 'EOG/Guard' },
  { type: '1a' as Coach['type'], name: 'AC 1st' },
  { type: '2a' as Coach['type'], name: 'AC 2-Tier' },
  { type: '3a' as Coach['type'], name: 'AC 3-Tier' },
  { type: 'sl' as Coach['type'], name: 'Sleeper' },
  { type: 'gen' as Coach['type'], name: 'General' },
  { type: 'pantry' as Coach['type'], name: 'Pantry' },
  { type: 'hcp' as Coach['type'], name: 'HCP' },
];

function CoachBox({ coach, index }: { coach: Coach; index: number }) {
  const style = COACH_STYLES[coach.type];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.015, duration: 0.2 }}
      className={cn(
        'flex-shrink-0 flex flex-col items-center justify-center rounded-xl border px-2 py-2 min-w-[52px] h-[72px] cursor-default transition-all hover:scale-105 hover:shadow-md',
        style.bg, style.border
      )}
      title={`${coach.displayName} — ${coach.label}`}
    >
      <span className="text-base leading-none">{style.label}</span>
      <span className={cn('mt-1 text-[9px] font-bold uppercase tracking-wide leading-none', style.text)}>
        {coach.label.length > 4 ? coach.label.slice(0, 4) : coach.label}
      </span>
      <span className={cn('text-[8px] font-medium leading-none mt-0.5 opacity-70', style.text)}>
        {coach.displayName.split(' ').slice(-1)[0]}
      </span>
    </motion.div>
  );
}

export function CoachComposition({ trainId, trainName }: CoachCompositionProps) {
  const [data, setData] = useState<CoachCompositionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`/api/coach/${trainId}`);
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [trainId]);

  // Count classes for summary chips
  const classCounts = data?.coaches.reduce<Record<string, number>>((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {}) || {};

  return (
    <div className="glass-panel rounded-3xl p-6 shadow-glass space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Train className="h-5 w-5 text-rail-blue" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Coach Composition</h3>
        </div>
        {data && (
          <span className="text-xs font-semibold text-slate-400">
            {data.totalCoaches} coaches
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-rail-blue" />
          <span>Loading rake composition…</span>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl bg-slate-100 dark:bg-slate-900 p-4 text-sm text-slate-500 flex items-center gap-2">
          <Info className="h-4 w-4 flex-shrink-0" />
          Coach composition data unavailable for this train.
        </div>
      )}

      {!loading && data && data.coaches.length > 0 && (
        <>
          {/* Class summary chips */}
          <div className="flex flex-wrap gap-1.5">
            {CLASS_LEGEND.filter((l) => (classCounts[l.type] || 0) > 0).map((l) => {
              const style = COACH_STYLES[l.type];
              return (
                <span
                  key={l.type}
                  className={cn(
                    'flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold',
                    style.bg, style.text, style.border
                  )}
                >
                  {style.label} {classCounts[l.type]}× {l.name}
                </span>
              );
            })}
          </div>

          {/* Scrollable rake diagram */}
          <div>
            <p className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              ← Engine end &nbsp;|&nbsp; Rake order →
            </p>
            <div
              className="flex gap-2 overflow-x-auto pb-3"
              style={{ scrollbarWidth: 'thin' }}
            >
              {data.coaches.map((coach, i) => (
                <CoachBox key={`${coach.position || i}-${coach.label}-${i}`} coach={coach} index={i} />
              ))}
            </div>
          </div>

          {data.raw && (
            <p className="text-[10px] font-mono text-slate-400 dark:text-slate-600 break-all">
              {data.raw}
            </p>
          )}
        </>
      )}
    </div>
  );
}
