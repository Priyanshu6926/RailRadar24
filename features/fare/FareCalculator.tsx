'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { IndianRupee, Tag, ShieldCheck, Info, Loader2, Sparkles } from 'lucide-react';
import { TrainFareData, FareClassBreakdown } from '@/types/train';
import { cn } from '@/utils/cn';

interface FareCalculatorProps {
  trainNumber: string;
  fromCode?: string;
  fromName?: string;
  toCode?: string;
  toName?: string;
}

export function FareCalculator({ trainNumber, fromCode, fromName, toCode, toName }: FareCalculatorProps) {
  const [data, setData] = useState<TrainFareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>('3A');
  const [selectedQuota, setSelectedQuota] = useState<string>('GN');

  useEffect(() => {
    async function fetchFares() {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ trainNumber });
        if (fromCode) qs.set('from', fromCode);
        if (toCode) qs.set('to', toCode);
        const res = await fetch(`/api/fare?${qs.toString()}`);
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
          if (json.data.fares?.length > 0) {
            setSelectedClass(json.data.fares[0].classCode);
          }
        }
      } catch (err) {
        console.error('Failed to load train fare data', err);
      } finally {
        setLoading(false);
      }
    }
    fetchFares();
  }, [trainNumber, fromCode, toCode]);

  const currentFare: FareClassBreakdown | undefined = data?.fares.find(
    (f) => f.classCode === selectedClass
  ) || data?.fares[0];

  const tatkalCharge = selectedQuota === 'TQ' && currentFare ? Math.round(currentFare.baseFare * 0.3) : 0;
  const totalAmount = currentFare ? currentFare.totalFare + tatkalCharge : 0;

  return (
    <div className="space-y-6">
      {/* Title & Quota Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/60 dark:border-slate-800/60 pb-4">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-rail-blue" />
            <span>Ticket Fare Calculator</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Official Indian Railways itemized fare breakdown including GST & surcharges.
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

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-rail-blue" />
        </div>
      ) : !data || data.fares.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">
          Fare breakdown not available for this train.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Class Selectors Horizontal Bar */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            {data.fares.map((f) => {
              const fTatkal = selectedQuota === 'TQ' ? Math.round(f.baseFare * 0.3) : 0;
              const fTotal = f.totalFare + fTatkal;
              return (
                <button
                  key={f.classCode}
                  onClick={() => setSelectedClass(f.classCode)}
                  className={cn(
                    'flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center',
                    selectedClass === f.classCode
                      ? 'border-rail-blue bg-rail-blue/10 ring-2 ring-rail-blue/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                >
                  <span className="font-mono text-sm font-extrabold text-slate-900 dark:text-white">
                    {f.classCode}
                  </span>
                  <span className="text-[10px] text-slate-500 truncate w-full">{f.className}</span>
                  <span className="font-mono text-xs font-bold text-rail-blue mt-1">₹{fTotal}</span>
                </button>
              );
            })}
          </div>

          {/* Itemized Fare Card */}
          {currentFare && (
            <motion.div
              key={currentFare.classCode + selectedQuota}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <span className="text-xs font-bold text-rail-blue">{currentFare.classCode} · {currentFare.className}</span>
                  <h4 className="text-lg font-extrabold text-slate-900 dark:text-white">Itemized Ticket Fare</h4>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 block">Total Amount</span>
                  <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                    ₹{totalAmount}
                  </span>
                </div>
              </div>

              {/* Rows */}
              <div className="space-y-2 text-xs divide-y divide-slate-200/60 dark:divide-slate-800/60">
                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-500">Base Ticket Fare</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    ₹{currentFare.baseFare}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-500">Reservation Fee</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    ₹{currentFare.reservationCharge}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-500">Superfast Surcharge</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    ₹{currentFare.superfastCharge}
                  </span>
                </div>
                {selectedQuota === 'TQ' && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-slate-500">Tatkal Premium Surcharge</span>
                    <span className="font-mono font-bold text-amber-600">
                      ₹{Math.round(currentFare.baseFare * 0.3)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-500">Goods & Service Tax (GST 5%)</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    ₹{currentFare.gst}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
