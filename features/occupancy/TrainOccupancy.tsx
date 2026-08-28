'use client';

import React, { useEffect, useState } from 'react';
import { Users, TrendingUp, TrendingDown, Minus, Loader2, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { TrainOccupancyData, ClassOccupancy } from '@/app/api/occupancy/[id]/route';
import { cn } from '@/utils/cn';

interface TrainOccupancyProps {
  trainId: string;
  trainName?: string;
}

// ── Overall Gauge Ring ───────────────────────────────────────────────────────
function OccupancyRing({ pct }: { pct: number }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const fill = circ * (Math.min(pct, 100) / 100);
  const color =
    pct < 50 ? '#10b981'
    : pct < 75 ? '#f59e0b'
    : pct < 90 ? '#f97316'
    : '#ef4444';

  return (
    <div className="relative flex items-center justify-center">
      <svg width="108" height="108" viewBox="0 0 108 108" className="-rotate-90">
        <circle cx="54" cy="54" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-200 dark:text-slate-800" />
        <motion.circle
          cx="54" cy="54" r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${fill} ${circ}`}
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={{ strokeDasharray: `${fill} ${circ}` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold font-mono" style={{ color }}>{pct}%</span>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Full</span>
      </div>
    </div>
  );
}

// ── Status badge colours ─────────────────────────────────────────────────────
const STATUS_STYLE: Record<ClassOccupancy['status'], { bg: string; text: string; label: string }> = {
  available: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', label: 'Available' },
  filling:   { bg: 'bg-sky-500/10',     text: 'text-sky-600 dark:text-sky-400',         label: 'Filling' },
  crowded:   { bg: 'bg-amber-500/10',   text: 'text-amber-600 dark:text-amber-400',     label: 'Crowded' },
  full:      { bg: 'bg-orange-500/10',  text: 'text-orange-600 dark:text-orange-400',   label: 'Nearly Full' },
  regret:    { bg: 'bg-rose-500/10',    text: 'text-rose-600 dark:text-rose-400',       label: 'No Vacancy' },
};

function fillBarColor(pct: number): string {
  if (pct < 50) return 'from-emerald-400 to-emerald-500';
  if (pct < 75) return 'from-sky-400 to-sky-500';
  if (pct < 90) return 'from-amber-400 to-amber-500';
  return 'from-rose-500 to-red-500';
}

// ── Class Card ───────────────────────────────────────────────────────────────
function ClassCard({ cls, index }: { cls: ClassOccupancy; index: number }) {
  const st = STATUS_STYLE[cls.status];
  const barColor = fillBarColor(cls.fillPercent);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      className="glass-panel rounded-2xl p-4 space-y-3 border border-slate-100 dark:border-slate-800"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{cls.emoji}</span>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{cls.className}</p>
            <p className="text-[11px] font-mono text-slate-400">{cls.classCode} · {cls.coachCount} coach{cls.coachCount !== 1 ? 'es' : ''}</p>
          </div>
        </div>
        <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', st.bg, st.text)}>
          {st.label}
        </span>
      </div>

      {/* Fill bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-slate-500">{cls.seatsOccupied} / {cls.seatsTotal} seats</span>
          <span className={cn('font-bold', st.text)}>{cls.fillPercent}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-200/60 dark:bg-slate-800/60 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(cls.fillPercent, 100)}%` }}
            transition={{ duration: 0.8, delay: index * 0.06, ease: 'easeOut' }}
            className={cn('h-full rounded-full bg-gradient-to-r', barColor)}
          />
        </div>
      </div>

      {/* WL / RAC / Available badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {cls.availableCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            ✓ {cls.availableCount} avail.
          </span>
        )}
        {cls.racCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full">
            RAC {cls.racCount}
          </span>
        )}
        {cls.wlCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
            WL {cls.wlCount}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ── Coach Heatmap ────────────────────────────────────────────────────────────
function CoachHeatmap({ classes }: { classes: ClassOccupancy[] }) {
  const coaches: { code: string; fill: number; emoji: string }[] = [];
  classes.forEach((cls) => {
    // Vary each coach's fill slightly around class average
    for (let i = 0; i < cls.coachCount; i++) {
      const variance = (Math.sin(i * 17 + cls.classCode.charCodeAt(0)) * 0.15);
      const fill = Math.min(100, Math.max(0, cls.fillPercent + variance * 100));
      coaches.push({ code: `${cls.classCode}${i + 1}`, fill, emoji: cls.emoji });
    }
  });

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
        Coach-level Heatmap
      </p>
      <div className="flex flex-wrap gap-1.5">
        {coaches.map((c, i) => {
          const bg =
            c.fill < 50 ? 'bg-emerald-500'
            : c.fill < 75 ? 'bg-sky-500'
            : c.fill < 90 ? 'bg-amber-500'
            : 'bg-rose-500';
          return (
            <motion.div
              key={`${c.code}-${i}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.02 }}
              title={`${c.code} — ${Math.round(c.fill)}% full`}
              className={cn('flex flex-col items-center justify-center rounded-lg p-1.5 min-w-[44px] border border-white/10', bg + '/20')}
            >
              <span className="text-sm leading-none">{c.emoji}</span>
              <span className="text-[8px] font-bold font-mono mt-0.5 text-slate-700 dark:text-slate-300">{c.code}</span>
              <div className="h-1 w-full rounded-full bg-slate-200/40 dark:bg-slate-800/40 overflow-hidden mt-1">
                <div className={cn('h-full rounded-full', bg)} style={{ width: `${c.fill}%` }} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export function TrainOccupancy({ trainId, trainName }: TrainOccupancyProps) {
  const [data, setData] = useState<TrainOccupancyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`/api/occupancy/${trainId}`);
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

  if (loading) {
    return (
      <div className="glass-panel rounded-3xl p-6 shadow-glass space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-rail-blue" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Train Occupancy</h3>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-rail-blue" />
          <span>Loading occupancy data…</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-panel rounded-3xl p-6 shadow-glass">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Info className="h-4 w-4" />
          <span>Occupancy data unavailable.</span>
        </div>
      </div>
    );
  }

  const TrendIcon = data.trend === 'filling' ? TrendingUp
    : data.trend === 'emptying' ? TrendingDown
    : Minus;
  const trendColor = data.trend === 'filling' ? 'text-rose-500' : data.trend === 'emptying' ? 'text-emerald-500' : 'text-slate-400';
  const trendLabel = data.trend === 'filling' ? 'Filling up' : data.trend === 'emptying' ? 'Thinning out' : 'Stable load';

  return (
    <div className="glass-panel rounded-3xl p-6 shadow-glass space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-rail-blue" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Train Occupancy</h3>
        </div>
        <div className={cn('flex items-center gap-1 text-xs font-bold', trendColor)}>
          <TrendIcon className="h-3.5 w-3.5" />
          <span>{trendLabel}</span>
        </div>
      </div>

      {/* Overall gauge + summary */}
      <div className="flex items-center gap-6">
        <OccupancyRing pct={data.overallFillPercent} />
        <div className="space-y-2">
          <div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
              {data.totalOccupied.toLocaleString()}
              <span className="text-base font-medium text-slate-500"> / {data.totalSeats.toLocaleString()}</span>
            </p>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Passengers on board</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
            <span className="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {data.classes.length} classes active
            </span>
            <span className="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {data.journeyCompletionPct}% journey done
            </span>
          </div>
        </div>
      </div>

      {/* Class-wise breakdown */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
          Class-wise Breakdown
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.classes.map((cls, i) => (
            <ClassCard key={cls.classCode} cls={cls} index={i} />
          ))}
        </div>
      </div>

      {/* Coach heatmap */}
      {data.classes.reduce((s, c) => s + c.coachCount, 0) <= 30 && (
        <CoachHeatmap classes={data.classes} />
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] font-semibold text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
        {[
          { color: 'bg-emerald-500', label: '< 50% — Available' },
          { color: 'bg-sky-500',     label: '50-74% — Filling' },
          { color: 'bg-amber-500',   label: '75-89% — Crowded' },
          { color: 'bg-rose-500',    label: '≥ 90% — Full' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1">
            <span className={cn('h-2 w-2 rounded-full flex-shrink-0', color)} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
