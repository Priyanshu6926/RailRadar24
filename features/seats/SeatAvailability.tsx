'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, LayoutGrid, Sparkles, ExternalLink, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { SeatAvailabilityData, DailySeatStatus } from '@/types/train';
import { cn } from '@/utils/cn';

interface SeatAvailabilityProps {
  trainNumber: string;
  fromCode?: string;
  fromName?: string;
  toCode?: string;
  toName?: string;
}

const CLASSES = ['3A', '2A', '1A', '3E', 'SL', '2S'];

export function SeatAvailability({
  trainNumber,
  fromCode = 'MMCT',
  toCode = 'NDLS',
}: SeatAvailabilityProps) {
  const [selectedClass, setSelectedClass] = useState('3A');
  const [selectedQuota, setSelectedQuota] = useState('GN');
  const [data, setData] = useState<SeatAvailabilityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    async function fetchSeats() {
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          trainNumber,
          from: fromCode,
          to: toCode,
          class: selectedClass,
          quota: selectedQuota,
        });
        const res = await fetch(`/api/seats?${qs.toString()}`, { signal: ac.signal });
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Failed to load seat availability', err);
        }
      } finally {
        if (!ac.signal.aborted) {
          setLoading(false);
        }
      }
    }
    fetchSeats();
    return () => ac.abort();
  }, [trainNumber, fromCode, toCode, selectedClass, selectedQuota]);

  return (
    <div className="space-y-6">
      {/* Header with class & quota selectors */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/60 dark:border-slate-800/60 pb-4">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-rail-blue" />
            <span>14-Day Rolling Seat Availability Forecast</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Seat availability & waitlist confirmation forecast for the next 14 days.
          </p>
        </div>

        {/* Quota Selector */}
        <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 text-xs font-bold">
          {[
            { code: 'GN', label: 'General' },
            { code: 'TQ', label: 'Tatkal' },
            { code: 'LD', label: 'Ladies' },
          ].map((q) => (
            <button
              key={q.code}
              onClick={() => setSelectedQuota(q.code)}
              className={cn(
                'rounded-lg px-3 py-1.5 transition-all',
                selectedQuota === q.code
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500'
              )}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Class Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-400 mr-2">Select Class:</span>
        {CLASSES.map((cls) => (
          <button
            key={cls}
            onClick={() => setSelectedClass(cls)}
            className={cn(
              'rounded-xl px-4 py-2 text-xs font-mono font-extrabold transition-all',
              selectedClass === cls
                ? 'bg-rail-blue text-white shadow-glow'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            )}
          >
            {cls}
          </button>
        ))}
      </div>

      {/* 14-Day Calendar Grid */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-rail-blue" />
        </div>
      ) : !data || data.availability.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">
          Seat availability data not found for selected class.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {data.availability.map((item, idx) => {
            const isAvail = item.statusCode === 'AVAILABLE';
            const isRAC = item.statusCode === 'RAC';
            const isWL = item.statusCode === 'WL';

            return (
              <motion.div
                key={item.date}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                className={cn(
                  'rounded-2xl p-4 border flex flex-col justify-between transition-all hover:-translate-y-0.5',
                  isAvail
                    ? 'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10'
                    : isRAC
                    ? 'border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10'
                    : 'border-rose-500/30 bg-rose-500/5 dark:bg-rose-500/10'
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-slate-400">{item.day}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {item.date.slice(5)}
                    </span>
                  </div>

                  <div className="mt-2.5">
                    <span
                      className={cn(
                        'block text-xs font-mono font-extrabold truncate',
                        isAvail
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : isRAC
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                      )}
                    >
                      {item.status}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-2 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between text-[10px]">
                  {isWL && item.chance !== undefined ? (
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {item.chance}% CNF
                    </span>
                  ) : (
                    <span className="font-bold text-slate-400">₹{item.fare || 1780}</span>
                  )}

                  <a
                    href="https://www.irctc.co.in/nget/train-search"
                    target="_blank"
                    rel="noreferrer"
                    className="text-rail-blue hover:underline font-bold flex items-center gap-0.5"
                  >
                    <span>Book</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const SeatAvailabilityPanel = SeatAvailability;
