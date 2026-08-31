'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Ticket,
  Train,
  Calendar,
  MapPin,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { PNRStatusData, PNRPredictionData, PNRRefundData } from '@/types/train';
import { cn } from '@/utils/cn';

interface PNRResultViewProps {
  data: PNRStatusData;
  prediction?: PNRPredictionData | null;
  refund?: PNRRefundData | null;
}

export function PNRResultView({ data, prediction, refund }: PNRResultViewProps) {
  const [showRefund, setShowRefund] = useState(false);

  const prob = prediction?.confirmationProbability ?? 85;
  const isHigh = prob >= 75;
  const isMedium = prob >= 45 && prob < 75;

  return (
    <div className="space-y-6">
      {/* ─── Ticket Header Card ────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white via-slate-50/50 to-sky-500/5 dark:from-slate-900 dark:via-slate-900/80 dark:to-sky-950/20 p-6 md:p-8 shadow-glass">
        {/* Top bar with PNR & Charting status */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/60 dark:border-slate-800/60 pb-5">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              10-Digit PNR Number
            </span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {data.pnr}
              </span>
              <span className="rounded-lg bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-rail-blue">
                Class: {data.class} · {data.quota} Quota
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {data.chartPrepared ? (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Chart Prepared</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-3.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                <Clock className="h-3.5 w-3.5" />
                <span>Chart Not Prepared</span>
              </div>
            )}

            <Link
              href={`/train/${data.trainNumber}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rail-blue px-3.5 py-2 text-xs font-bold text-white shadow-glow hover:bg-sky-600 transition-all"
            >
              <Train className="h-3.5 w-3.5" />
              <span>Track Live</span>
            </Link>
          </div>
        </div>

        {/* Train Details & Route */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Train Details</span>
            <div className="mt-1">
              <span className="font-mono text-xs font-bold text-rail-blue bg-rail-blue/10 px-2 py-0.5 rounded-md">
                #{data.trainNumber}
              </span>
              <h3 className="font-bold text-slate-900 dark:text-white text-base mt-1">{data.trainName}</h3>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span>Journey Date: {data.journeyDate}</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 flex flex-col justify-center">
            <div className="flex items-center justify-between gap-4">
              <div className="text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">From / Boarding</span>
                <h4 className="font-extrabold text-slate-900 dark:text-white text-lg">{data.fromStation.code}</h4>
                <p className="text-xs text-slate-500 truncate">{data.fromStation.name}</p>
              </div>

              <div className="flex-1 flex flex-col items-center px-4">
                <div className="w-full flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-rail-blue" />
                  <div className="h-0.5 flex-1 bg-gradient-to-r from-rail-blue via-sky-400 to-emerald-500" />
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 mt-1">
                  Expected Platform: {data.expectedPlatform || '1'}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">To / Destination</span>
                <h4 className="font-extrabold text-slate-900 dark:text-white text-lg">{data.toStation.code}</h4>
                <p className="text-xs text-slate-500 truncate">{data.toStation.name}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Confirmation Probability Section ──────────────────────────── */}
      {prediction && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-sky-500/30 bg-gradient-to-r from-sky-500/10 via-background to-emerald-500/10 p-6 shadow-glass"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rail-blue text-white shadow-glow flex-shrink-0">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 dark:text-white text-base">
                    Confirmation Probability
                  </h4>
                  {prediction.status && (
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-[10px] font-bold border',
                        isHigh
                          ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                          : isMedium
                          ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                          : 'bg-slate-500/15 text-slate-600 border-slate-500/30'
                      )}
                    >
                      {prediction.status} Chance
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {prediction.historicalTrend || prediction.message}
                </p>
              </div>
            </div>

            {/* Gauge */}
            {prob !== undefined && (
              <div className="flex items-center gap-4 self-end sm:self-center bg-white/70 dark:bg-slate-900/70 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Probability
                  </span>
                  <span
                    className={cn(
                      'text-2xl font-extrabold',
                      isHigh ? 'text-emerald-500' : isMedium ? 'text-amber-500' : 'text-rose-500'
                    )}
                  >
                    {prob}%
                  </span>
                </div>
                <div className="h-10 w-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex flex-col justify-end">
                  <div
                    className={cn(
                      'w-full transition-all duration-500 rounded-full',
                      isHigh ? 'bg-emerald-500' : isMedium ? 'bg-amber-500' : 'bg-rose-500'
                    )}
                    style={{ height: `${prob}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ─── Passenger List ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-rail-blue" />
          <h3 className="font-bold text-slate-900 dark:text-white text-base">Passenger Status</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.passengers.map((p) => {
            const isConfirmed = p.currentStatus.toUpperCase().includes('CNF');
            const isRAC = p.currentStatus.toUpperCase().includes('RAC');

            return (
              <div
                key={p.passengerNumber}
                className="glass-panel rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm hover:border-rail-blue/40 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">Passenger #{p.passengerNumber}</span>
                  <span
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-xs font-extrabold',
                      isConfirmed
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : isRAC
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                    )}
                  >
                    {p.currentStatus}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Booking</span>
                    <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                      {p.bookingStatus}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Coach</span>
                    <span className="text-xs font-extrabold text-rail-blue">{p.coach || '--'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Berth</span>
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                      {p.berth ? `${p.berth} (${p.berthType || 'MB'})` : '--'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Refund & Cancellation Estimator ───────────────────────────────── */}
      {refund && (
        <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div
            className="flex items-center justify-between cursor-pointer select-none"
            onClick={() => setShowRefund(!showRefund)}
          >
            <div className="flex items-center gap-2.5">
              <RotateCcw className="h-4 w-4 text-emerald-600" />
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                Cancellation & Refund Estimator
              </span>
            </div>
            <button className="text-xs font-bold text-rail-blue hover:underline">
              {showRefund ? 'Hide details' : 'View breakdown →'}
            </button>
          </div>

          {showRefund && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-100 dark:bg-slate-800/60 p-3 rounded-xl">
                  <span className="text-slate-400 block">Total Fare</span>
                  <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                    ₹{refund.ticketFare}
                  </span>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800/60 p-3 rounded-xl">
                  <span className="text-slate-400 block">Clerkage Charge</span>
                  <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                    ₹{refund.clerkageCharge}
                  </span>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800/60 p-3 rounded-xl">
                  <span className="text-slate-400 block">Cancellation Fee</span>
                  <span className="font-extrabold text-sm text-rose-500">
                    -₹{refund.cancellationCharge}
                  </span>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold block">Refund Amount</span>
                  <span className="font-extrabold text-base text-emerald-600 dark:text-emerald-400">
                    ₹{refund.refundableAmount}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                Rule Applied: {refund.ruleApplied}
              </p>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
