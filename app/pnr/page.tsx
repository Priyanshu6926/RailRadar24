'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Ticket, Search, Loader2, Sparkles, AlertCircle, ShieldCheck, Zap } from 'lucide-react';
import { PNRResultView } from '@/features/pnr/PNRResultView';
import { PNRStatusData, PNRPredictionData, PNRRefundData } from '@/types/train';

function PNRContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pnrParam = searchParams.get('pnr') || '';

  const [pnrInput, setPnrInput] = useState(pnrParam);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pnrData, setPnrData] = useState<PNRStatusData | null>(null);
  const [predictionData, setPredictionData] = useState<PNRPredictionData | null>(null);
  const [refundData, setRefundData] = useState<PNRRefundData | null>(null);

  const fetchPNR = async (pnrToFetch: string) => {
    const clean = pnrToFetch.replace(/\D/g, '');
    if (clean.length !== 10) {
      setError('Please enter a valid 10-digit Indian Railways PNR number.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const [resStatus, resPred, resRef] = await Promise.all([
        fetch(`/api/pnr/${clean}`),
        fetch(`/api/pnr/${clean}/prediction`),
        fetch(`/api/pnr/${clean}/refund`),
      ]);

      const jsonStatus = await resStatus.json();
      const jsonPred = await resPred.json();
      const jsonRef = await resRef.json();

      if (jsonStatus.success && jsonStatus.data) {
        setPnrData(jsonStatus.data);
      } else {
        setError(jsonStatus.error || 'Failed to find PNR record.');
      }

      if (jsonPred.success) setPredictionData(jsonPred.data);
      if (jsonRef.success) setRefundData(jsonRef.data);
    } catch (err: any) {
      setError(err.message || 'Network error fetching PNR');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pnrParam) {
      fetchPNR(pnrParam);
    }
  }, [pnrParam]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pnrInput.trim()) return;
    router.push(`/pnr?pnr=${pnrInput.trim()}`);
    fetchPNR(pnrInput.trim());
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-2">
      {/* ─── Hero / Search Section ────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-sky-500/10 via-background to-background p-8 md:p-12 text-center border border-sky-500/20 shadow-glass">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-2xl"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-xs font-semibold text-rail-blue mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI-Powered Confirmation Probability · Instant PNR Lookup</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            10-Digit <span className="text-rail-blue">PNR Status</span> & Prediction
          </h1>

          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Check live berth allocation, coach position, and ML confirmation chances for Indian Railways tickets.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 max-w-lg mx-auto">
            <div className="glass-panel flex items-center gap-2 rounded-2xl p-2 shadow-glass border border-slate-200 dark:border-slate-800">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-rail-blue/10 text-rail-blue">
                <Ticket className="h-5 w-5" />
              </div>
              <input
                type="text"
                maxLength={10}
                value={pnrInput}
                onChange={(e) => setPnrInput(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 10-digit PNR (e.g. 2849102847)"
                className="w-full bg-transparent px-2 font-mono text-base font-bold text-slate-900 dark:text-white placeholder-slate-400 outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-rail-blue px-5 py-3 text-xs font-bold text-white shadow-glow hover:bg-sky-600 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span>Check</span>
              </button>
            </div>

            {/* Sample PNR Chips */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">Try Sample PNRs:</span>
              {['2849102847', '4521098371', '6712903845'].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => {
                    setPnrInput(sample);
                    router.push(`/pnr?pnr=${sample}`);
                    fetchPNR(sample);
                  }}
                  className="rounded-lg bg-slate-200/70 dark:bg-slate-800/70 px-2.5 py-1 font-mono font-bold text-slate-700 dark:text-slate-300 hover:bg-rail-blue hover:text-white transition-colors"
                >
                  {sample}
                </button>
              ))}
            </div>
          </form>
        </motion.div>
      </section>

      {/* ─── Error Alert ───────────────────────────────────────────────────── */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-3"
        >
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      {/* ─── Loading Skeleton ──────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-48 rounded-3xl bg-slate-200 dark:bg-slate-800" />
          <div className="h-24 rounded-3xl bg-slate-200 dark:bg-slate-800" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-32 rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-32 rounded-2xl bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      )}

      {/* ─── Result View ───────────────────────────────────────────────────── */}
      {!loading && pnrData && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <PNRResultView data={pnrData} prediction={predictionData} refund={refundData} />
        </motion.div>
      )}

      {/* ─── Information Cards ─────────────────────────────────────────────── */}
      {!pnrData && !loading && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
          {[
            {
              icon: <Sparkles className="h-6 w-6" />,
              title: 'ML Confirmation Forecast',
              desc: 'High-accuracy confirmation probabilities computed using 10+ years of IRCTC seasonal trends.',
            },
            {
              icon: <Zap className="h-6 w-6" />,
              title: 'Sub-second IRCTC Sync',
              desc: 'Instant real-time sync with PRS passenger reservation system for berth & coach charting.',
            },
            {
              icon: <ShieldCheck className="h-6 w-6" />,
              title: 'Refund Breakdown',
              desc: 'Automatic deduction calculations (clerkage vs cancellation charges) under official railway rules.',
            },
          ].map((item, idx) => (
            <div key={idx} className="glass-panel rounded-3xl p-6 space-y-2.5">
              <div className="h-10 w-10 rounded-2xl bg-rail-blue/10 text-rail-blue flex items-center justify-center">
                {item.icon}
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">{item.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export default function PNRPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-rail-blue" />
        </div>
      }
    >
      <PNRContent />
    </Suspense>
  );
}
