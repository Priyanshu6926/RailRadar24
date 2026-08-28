'use client';

import React, { useState } from 'react';
import { CheckCircle2, Circle, Radio, ChevronDown, ChevronUp } from 'lucide-react';
import { Station } from '@/types/train';
import { formatDelay } from '@/utils/format';
import { cn } from '@/utils/cn';

interface TimelineProps {
  stations: Station[];
  currentStationCode?: string;
  className?: string;
}

/** Group halt stations; collect passing-through stations between them */
function buildTimelineGroups(stations: Station[]) {
  const groups: { halt: Station; passThrough: Station[] }[] = [];
  let pendingPass: Station[] = [];

  for (const st of stations) {
    const isHalt = st.isHalt !== false && (st.isHalt === true || !!st.platform || st.haltMinutes !== undefined);
    if (isHalt) {
      groups.push({ halt: st, passThrough: pendingPass });
      pendingPass = [];
    } else {
      pendingPass.push(st);
    }
  }

  // If last stations are non-halt (shouldn't happen but guard it)
  if (pendingPass.length > 0 && groups.length > 0) {
    groups[groups.length - 1].passThrough.push(...pendingPass);
  }

  return groups;
}

function PassThroughDropdown({ stations }: { stations: Station[] }) {
  const [open, setOpen] = useState(false);

  if (stations.length === 0) return null;

  return (
    <div className="ml-0 pl-2">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors py-1"
      >
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800 max-w-[40px]" />
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        <span>{stations.length} passing station{stations.length > 1 ? 's' : ''}</span>
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800 max-w-[40px]" />
      </button>

      {open && (
        <div className="space-y-0 py-1 border-l-2 border-dashed border-slate-200 dark:border-slate-800 ml-3 pl-3">
          {stations.map((st, i) => (
            <div key={`${st.code}-${i}`} className="flex items-center justify-between py-1 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-700 flex-shrink-0" />
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {st.name}
                  <span className="ml-1 text-slate-400 dark:text-slate-600">({st.code})</span>
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-600 flex-shrink-0">
                {st.scheduledArrival}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Timeline({ stations, currentStationCode, className }: TimelineProps) {
  const groups = buildTimelineGroups(stations);
  const haltCount = groups.length;
  const nonHaltCount = stations.length - haltCount;

  return (
    <div className={cn('glass-panel rounded-3xl p-6 shadow-glass', className)}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          Station Route Timeline
        </h3>
      </div>
      <div className="flex items-center gap-2 mb-5">
        <span className="rounded-full bg-rail-blue/10 px-2 py-0.5 text-[10px] font-bold text-rail-blue">
          {haltCount} halts
        </span>
        {nonHaltCount > 0 && (
          <span className="rounded-full bg-slate-200/60 dark:bg-slate-800/60 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            {nonHaltCount} passing
          </span>
        )}
      </div>

      <div className="relative pl-6 before:absolute before:bottom-3 before:left-3 before:top-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
        <div className="space-y-4">
          {groups.map(({ halt: st, passThrough }, groupIdx) => {
            const isPassed = st.status === 'passed';
            const isCurrent = st.status === 'current' || st.code === currentStationCode;
            const isUpcoming = st.status === 'upcoming';
            const delayInfo = formatDelay(st.delayMinutes);

            return (
              <React.Fragment key={`${st.code}-${groupIdx}`}>
                {/* ─── Halt Station Entry ─── */}
                <div className="relative flex items-start justify-between gap-4">
                  {/* Timeline Dot */}
                  <div className="absolute -left-6 top-0.5 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full bg-background">
                    {isPassed && (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 fill-emerald-500/20" />
                    )}
                    {isCurrent && (
                      <div className="relative flex items-center justify-center">
                        <Radio className="h-5 w-5 text-rail-blue animate-pulse" />
                        <span className="absolute h-8 w-8 rounded-full bg-rail-blue/20 animate-ping" />
                      </div>
                    )}
                    {isUpcoming && (
                      <Circle className="h-4 w-4 text-slate-300 dark:text-slate-700" />
                    )}
                  </div>

                  {/* Station Info */}
                  <div className="flex-1 pl-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4
                        className={cn(
                          'font-bold',
                          isCurrent
                            ? 'text-rail-blue text-base'
                            : isPassed
                            ? 'text-slate-800 dark:text-slate-200 text-sm'
                            : 'text-slate-500 dark:text-slate-400 text-sm'
                        )}
                      >
                        {st.name}
                        <span className="ml-1 font-mono font-normal text-[10px] text-slate-400">
                          ({st.code})
                        </span>
                      </h4>

                      {isCurrent && (
                        <span className="rounded-md bg-rail-blue/10 px-2 py-0.5 font-mono text-[10px] font-bold text-rail-blue">
                          LIVE
                        </span>
                      )}

                      {st.platform && (
                        <span className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                          PF {st.platform}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <span>{st.distanceKm} km</span>
                      {st.haltMinutes && <span>Halt: {st.haltMinutes}m</span>}
                    </div>
                  </div>

                  {/* Schedule vs Actual */}
                  <div className="text-right font-mono text-xs flex-shrink-0">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {st.actualArrival || st.scheduledArrival}
                    </div>
                    {st.delayMinutes > 0 ? (
                      <div className={cn('text-[11px] font-bold', delayInfo.color)}>
                        +{st.delayMinutes}m
                      </div>
                    ) : (
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        On time
                      </div>
                    )}
                  </div>
                </div>

                {/* ─── Passing-Through Stations Dropdown ─── */}
                {passThrough.length > 0 && groupIdx < groups.length - 1 && (
                  <PassThroughDropdown stations={passThrough} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
