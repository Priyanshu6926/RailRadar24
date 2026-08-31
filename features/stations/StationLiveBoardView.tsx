'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Clock,
  Train,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Radio,
  Filter,
  Users,
} from 'lucide-react';
import { StationBoardData } from '@/types/train';
import { getEstimatedCrowd } from '@/lib/crowd';
import { cn } from '@/utils/cn';

interface StationLiveBoardProps {
  stationCode: string;
  initialData?: StationBoardData | null;
}

export function StationLiveBoardView({ stationCode, initialData }: StationLiveBoardProps) {
  const [data, setData] = useState<StationBoardData | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [filter, setFilter] = useState<'ALL' | 'ON_TIME' | 'DELAYED'>('ALL');
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  useEffect(() => {
    setLastRefreshed(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }));
  }, []);

  const fetchBoard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stations/${stationCode}/live?hours=4`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        setLastRefreshed(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }));
      }
    } catch (err) {
      console.error('Failed to load station live board', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoard();
    const interval = setInterval(fetchBoard, 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, [stationCode]);

  const trains = (data?.trains || []).filter((t) => {
    if (filter === 'ALL') return true;
    if (filter === 'ON_TIME') return t.delayMinutes === 0;
    if (filter === 'DELAYED') return t.delayMinutes > 0;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* ─── FIDS Board Header ────────────────────────────────────────────── */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-glass">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rail-blue text-white shadow-glow">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-rail-blue bg-rail-blue/10 px-2.5 py-0.5 rounded-lg">
                {stationCode}
              </span>
              <h2 className="font-extrabold text-xl text-slate-900 dark:text-white">
                {data?.stationName || `${stationCode} Junction`}
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <Radio className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
              <span>Live Departure Board · Refreshed {lastRefreshed}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Pills */}
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 text-xs font-bold">
            <button
              onClick={() => setFilter('ALL')}
              className={cn(
                'rounded-lg px-3 py-1.5 transition-all',
                filter === 'ALL' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilter('ON_TIME')}
              className={cn(
                'rounded-lg px-3 py-1.5 transition-all',
                filter === 'ON_TIME' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-sm' : 'text-slate-500'
              )}
            >
              On Time
            </button>
            <button
              onClick={() => setFilter('DELAYED')}
              className={cn(
                'rounded-lg px-3 py-1.5 transition-all',
                filter === 'DELAYED' ? 'bg-white dark:bg-slate-900 text-rose-500 shadow-sm' : 'text-slate-500'
              )}
            >
              Delayed
            </button>
          </div>

          <button
            onClick={fetchBoard}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rail-blue hover:text-white transition-colors"
            title="Refresh board"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* ─── Airport / Station Style FIDS Board Table ─────────────────────── */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-950 text-white shadow-2xl overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 px-6 py-3.5 bg-slate-900 border-b border-slate-800 text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400">
          <div className="col-span-2 sm:col-span-1">Train</div>
          <div className="col-span-3 sm:col-span-3">Train Name</div>
          <div className="col-span-3 sm:col-span-3">Destination</div>
          <div className="col-span-1 sm:col-span-1 text-center">PF</div>
          <div className="col-span-2 sm:col-span-1 text-right">Time</div>
          <div className="hidden sm:block sm:col-span-2 text-center">Crowd</div>
          <div className="col-span-1 sm:col-span-1 text-right">Status</div>
        </div>

        {/* Train Rows */}
        <div className="divide-y divide-slate-800/60 font-mono text-xs">
          {trains.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              No trains scheduled in this window.
            </div>
          ) : (
            trains.map((train, idx) => {
              const isDelayed = train.delayMinutes > 0;

              return (
                <motion.div
                  key={`${train.trainNumber}-${idx}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  className="grid grid-cols-12 items-center gap-2 px-6 py-4 hover:bg-slate-900/60 transition-colors"
                >
                  {/* Train # */}
                  <div className="col-span-2 sm:col-span-1">
                    <Link
                      href={`/train/${train.trainNumber}`}
                      className="font-bold text-sky-400 hover:underline"
                    >
                      {train.trainNumber}
                    </Link>
                  </div>

                  {/* Train Name */}
                  <div className="col-span-3 sm:col-span-3 font-sans font-bold text-slate-100 truncate">
                    {train.trainName}
                  </div>

                  {/* Destination */}
                  <div className="col-span-3 sm:col-span-3 font-sans text-slate-300 truncate">
                    {train.destination?.name || train.destination?.code || '—'} ({train.destination?.code || '—'})
                  </div>

                  {/* Platform */}
                  <div className="col-span-1 sm:col-span-1 text-center">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-amber-400/20 text-amber-300 font-bold">
                      {train.platform || '1'}
                    </span>
                  </div>

                  {/* Time */}
                  <div className="col-span-2 sm:col-span-1 text-right font-bold text-slate-200">
                    {train.scheduledDeparture || train.scheduledArrival}
                  </div>

                  {/* Crowd */}
                  {(() => { const c = getEstimatedCrowd(train.trainName, train.delayMinutes); return (
                    <div className="hidden sm:flex sm:col-span-2 items-center justify-center gap-1.5" title={c.description}>
                      <span className={cn('h-2 w-2 rounded-full flex-shrink-0', c.dotColor)} />
                      <span className={cn('text-[10px] font-bold', c.textColor)}>{c.band}</span>
                    </div>
                  ); })()}

                  {/* Status / Delay */}
                  <div className="col-span-1 sm:col-span-1 text-right">
                    {isDelayed ? (
                      <span className="inline-flex items-center gap-1 text-rose-400 font-bold text-[11px] bg-rose-500/10 px-2 py-0.5 rounded-md">
                        <AlertTriangle className="h-3 w-3" />
                        <span>+{train.delayMinutes}m</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>On Time</span>
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
