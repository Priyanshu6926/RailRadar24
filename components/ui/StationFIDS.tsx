'use client';

import React from 'react';
import Link from 'next/link';
import { StationTrainRow } from '@/types/rail-features';
import { cn } from '@/utils/cn';

interface StationFIDSProps {
  title: string;
  rows: StationTrainRow[];
  mode: 'arrivals' | 'departures';
}

function delayTone(delay?: number) {
  if (delay == null) return 'text-slate-400';
  if (delay <= 0) return 'text-emerald-400';
  if (delay < 15) return 'text-amber-400';
  return 'text-rose-400';
}

export function StationFIDS({ title, rows, mode }: StationFIDSProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-800 bg-[#0b1220] shadow-glass">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-3">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">Live FIDS</p>
          <h3 className="text-lg font-extrabold text-white">{title}</h3>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-400">
          AUTO-REFRESH
        </span>
      </div>

      <div className="grid grid-cols-12 gap-2 border-b border-slate-800 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">
        <span className="col-span-2">Time</span>
        <span className="col-span-2">Train</span>
        <span className="col-span-5">{mode === 'departures' ? 'Destination' : 'Origin'}</span>
        <span className="col-span-1">PF</span>
        <span className="col-span-2 text-right">Delay</span>
      </div>

      <div className="divide-y divide-slate-800/80">
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center font-mono text-xs text-slate-500">No live trains in this window.</p>
        ) : (
          rows.slice(0, 18).map((row, i) => {
            const time = mode === 'departures' ? row.departure || row.arrival : row.arrival || row.departure;
            const endpoint = mode === 'departures' ? row.destination || row.origin : row.origin || row.destination;
            return (
              <Link
                key={`${row.number}-${i}`}
                href={`/train/${row.number}`}
                className="fids-row grid grid-cols-12 items-center gap-2 px-4 py-2.5 font-mono text-sm text-amber-100 transition-colors hover:bg-amber-400/5"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span className="col-span-2 font-bold text-amber-300">{time || '--:--'}</span>
                <span className="col-span-2 text-sky-300">{row.number}</span>
                <span className="col-span-5 truncate text-white">
                  {endpoint || row.name}
                </span>
                <span className="col-span-1 text-slate-300">{row.platform || '-'}</span>
                <span className={cn('col-span-2 text-right font-bold', delayTone(row.delayMinutes))}>
                  {row.delayMinutes == null ? '—' : row.delayMinutes <= 0 ? 'On time' : `+${row.delayMinutes}`}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
