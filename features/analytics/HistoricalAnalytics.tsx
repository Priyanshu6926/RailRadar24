'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp, Zap, Clock, Award, Loader2, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { TrainRunningAnalytics, SectionStats } from '@/app/api/train-history/[id]/route';
import { cn } from '@/utils/cn';

interface HistoricalAnalyticsProps {
  trainId: string;
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  const r = 28;
  const circ = 2 * Math.PI * r;
  const fill = circ * (score / 100);
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
      <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-200 dark:text-slate-800" />
      <circle
        cx="36" cy="36" r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={`${fill} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

function SectionBar({ section, maxDelay, index }: { section: SectionStats; maxDelay: number; index: number }) {
  const delayAbs = Math.abs(section.delayGainMinutes);
  const widthPct = maxDelay > 0 ? Math.round((delayAbs / maxDelay) * 100) : 0;
  const isGain = section.delayGainMinutes > 0;
  const isRecov = section.delayGainMinutes < 0;
  const barColor = isGain ? 'bg-rose-500' : isRecov ? 'bg-emerald-500' : 'bg-slate-400';
  const fromShort = section.fromName.split(' ')[0];
  const toShort = section.toName.split(' ')[0];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="grid grid-cols-[1fr_2fr_auto] items-center gap-3"
    >
      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate text-right">
        {fromShort} → {toShort}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-3.5 rounded-full bg-slate-100 dark:bg-slate-900 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(widthPct, section.delayGainMinutes !== 0 ? 4 : 0)}%` }}
            transition={{ duration: 0.5, delay: index * 0.04 }}
            className={cn('h-full rounded-full', barColor)}
          />
        </div>
        <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 w-12 text-right">
          {section.avgSpeedKmh > 0 ? `${section.avgSpeedKmh}km/h` : '—'}
        </span>
      </div>
      <span className={cn(
        'text-[11px] font-bold w-14 text-right font-mono',
        isGain ? 'text-rose-500' : isRecov ? 'text-emerald-500' : 'text-slate-400'
      )}>
        {section.delayGainMinutes > 0 ? `+${section.delayGainMinutes}m` :
          section.delayGainMinutes < 0 ? `${section.delayGainMinutes}m` : '±0'}
      </span>
    </motion.div>
  );
}

export function HistoricalAnalytics({ trainId }: HistoricalAnalyticsProps) {
  const [data, setData] = useState<TrainRunningAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [view, setView] = useState<'sections' | 'stations'>('sections');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`/api/train-history/${trainId}`);
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
          <TrendingUp className="h-5 w-5 text-rail-blue" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Running Analytics</h3>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-rail-blue" />
          <span>Computing section speed & delay analytics…</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-panel rounded-3xl p-6 shadow-glass">
        <p className="text-sm text-slate-400">Running analytics unavailable.</p>
      </div>
    );
  }

  const maxDelay = Math.max(...data.sections.map((s) => Math.abs(s.delayGainMinutes)), 1);
  const qualityColor = data.dataQuality === 'live' ? 'text-emerald-500' : data.dataQuality === 'partial' ? 'text-amber-500' : 'text-slate-400';
  const qualityLabel = data.dataQuality === 'live' ? 'Live Data' : data.dataQuality === 'partial' ? 'Partial Data' : 'Estimated';

  return (
    <div className="glass-panel rounded-3xl p-6 shadow-glass space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-rail-blue" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Running Analytics</h3>
        </div>
        <span className={cn('text-[10px] font-bold uppercase tracking-wider', qualityColor)}>
          ● {qualityLabel}
        </span>
      </div>

      {/* Scorecard Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Punctuality Ring */}
        <div className="glass-panel rounded-2xl p-4 flex flex-col items-center gap-1">
          <div className="relative">
            <ScoreRing score={data.overallPunctualityScore} />
            <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-slate-900 dark:text-white rotate-90-fix">
              {data.overallPunctualityScore}%
            </span>
          </div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Punctuality</p>
        </div>

        <div className="glass-panel rounded-2xl p-4 space-y-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rail-blue/10">
            <Zap className="h-4 w-4 text-rail-blue" />
          </div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Avg Speed</p>
          <p className="font-mono text-xl font-extrabold text-slate-900 dark:text-white">
            {data.avgSpeedKmh}<span className="text-sm font-medium text-slate-500"> km/h</span>
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-4 space-y-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10">
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Current Delay</p>
          <p className={cn('font-mono text-xl font-extrabold', data.overallDelayMinutes > 0 ? 'text-rose-500' : 'text-emerald-500')}>
            {data.overallDelayMinutes > 0 ? `+${data.overallDelayMinutes}m` : 'On Time'}
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-4 space-y-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10">
            <Award className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Max Speed</p>
          <p className="font-mono text-xl font-extrabold text-slate-900 dark:text-white">
            {data.maxSectionSpeed}<span className="text-sm font-medium text-slate-500"> km/h</span>
          </p>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-1 glass-panel rounded-xl p-1 w-fit">
        {(['sections', 'stations'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              view === v
                ? 'bg-rail-blue text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            {v === 'sections' ? '📊 By Section' : '🚉 By Station'}
          </button>
        ))}
      </div>

      {/* Section View */}
      {view === 'sections' && (
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_2fr_auto] text-[10px] font-bold uppercase tracking-wider text-slate-400 gap-3 px-0">
            <span className="text-right">Section</span>
            <span>Delay Change &amp; Speed</span>
            <span className="w-14 text-right">Δ Delay</span>
          </div>
          {data.sections.map((section, i) => (
            <SectionBar key={section.fromCode + section.toCode} section={section} maxDelay={maxDelay} index={i} />
          ))}
          <div className="flex items-center gap-4 text-[10px] text-slate-400 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Delay gained</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Time recovered</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" /> On schedule</span>
          </div>
        </div>
      )}

      {/* Station View */}
      {view === 'stations' && (
        <div className="space-y-2">
          {data.perStation.map((st, i) => (
            <motion.div
              key={st.code}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 dark:border-slate-900 last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                {st.delayMinutes === 0 ? (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                ) : st.delayMinutes > 30 ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                )}
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{st.name}</span>
                <span className="text-[10px] font-mono text-slate-400">({st.code})</span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-[11px] font-mono text-slate-500">{st.scheduledArrival}</span>
                <span className={cn(
                  'text-[11px] font-bold font-mono w-14 text-right',
                  st.delayMinutes === 0 ? 'text-emerald-500' : st.delayMinutes > 30 ? 'text-rose-500' : 'text-amber-500'
                )}>
                  {st.delayMinutes === 0 ? 'On time' : `+${st.delayMinutes}m`}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
