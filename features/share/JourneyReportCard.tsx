'use client';

import React, { useRef, useState } from 'react';
import { Download, Share2, Loader2, Award } from 'lucide-react';
import { LiveJourney } from '@/types/train';
import { cn } from '@/utils/cn';

interface JourneyReportCardProps {
  journey: LiveJourney;
}

export function JourneyReportCard({ journey }: JourneyReportCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [open, setOpen] = useState(false);

  const delayText = journey.delayMinutes > 0
    ? `${journey.delayMinutes} min late`
    : 'On Time ✅';

  const statusEmoji = journey.status === 'running' ? '🟢'
    : journey.status === 'completed' ? '🏁'
    : journey.status === 'cancelled' ? '🚫'
    : '⏳';

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setGenerating(true);
    try {
      // Use browser's native canvas API to capture the card as PNG
      // This works without any external dependency
      const el = cardRef.current;
      const { width, height } = el.getBoundingClientRect();
      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(2, 2);
        // Draw background gradient
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(0.6, '#1e293b');
        grad.addColorStop(1, '#0e3a5c');
        ctx.fillStyle = grad;
        ctx.roundRect(0, 0, width, height, 16);
        ctx.fill();

        // Title
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillText('RAILRADAR24', 20, 28);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Inter, sans-serif';
        ctx.fillText(journey.name, 20, 52);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px monospace';
        ctx.fillText(`#${journey.number}`, 20, 70);

        // Route
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillText(`${journey.origin.code} → ${journey.destination.code}`, 20, 100);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px Inter, sans-serif';
        ctx.fillText(`${journey.totalDistanceKm} km route`, 20, 116);

        // Progress bar
        const barY = 136;
        ctx.fillStyle = '#1e293b';
        ctx.roundRect(20, barY, width - 40, 8, 4);
        ctx.fill();
        ctx.fillStyle = '#0ea5e9';
        ctx.roundRect(20, barY, (width - 40) * (journey.completionPercentage / 100), 8, 4);
        ctx.fill();
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`${Math.round(journey.completionPercentage)}%`, width - 40, barY - 4);

        // Stats
        const statsY = 165;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillText(`${journey.distanceCoveredKm} km`, 20, statsY);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText('Covered', 20, statsY + 14);

        const delayX = width / 2 - 20;
        ctx.fillStyle = journey.delayMinutes > 0 ? '#f87171' : '#34d399';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillText(journey.delayMinutes > 0 ? `+${journey.delayMinutes}m late` : 'On Time', delayX, statsY);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText('Status', delayX, statsY + 14);

        const siteDomain = (process.env.NEXT_PUBLIC_SITE_URL || 'railradar24.onrender.com').replace(/^https?:\/\//, '');

        // Footer
        ctx.fillStyle = '#475569';
        ctx.font = '9px Inter, sans-serif';
        ctx.fillText(siteDomain, 20, height - 10);
        ctx.fillText(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), width - 80, height - 10);
      }

      const link = document.createElement('a');
      link.download = `RailRadar24_${journey.number}_${journey.name.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      handleShare();
    } finally {
      setGenerating(false);
    }

  };

  const handleShare = () => {
    const text = `${statusEmoji} ${journey.name} (#${journey.number})\n🛤 ${journey.origin.name} → ${journey.destination.name}\n📍 ${Math.round(journey.completionPercentage)}% complete (${journey.distanceCoveredKm}/${journey.totalDistanceKm} km)\n⏱ ${delayText}\n\nTracked on RailRadar24`;
    if (navigator.share) {
      navigator.share({ title: `RailRadar24 Journey Report`, text });
    } else {
      navigator.clipboard?.writeText(text);
    }
  };

  return (
    <div className="space-y-3">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rail-blue to-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-glow hover:opacity-90 transition-opacity w-full justify-center"
      >
        <Award className="h-4 w-4" />
        {open ? 'Close' : 'Generate Journey Report Card'}
      </button>

      {open && (
        <div className="space-y-3">
          {/* Card preview */}
          <div
            ref={cardRef}
            className="rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-rail-blue/30 p-6 shadow-xl border border-white/10"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400 mb-0.5">RailRadar24</p>
                <h2 className="text-xl font-extrabold text-white leading-tight">{journey.name}</h2>
                <p className="text-sm font-mono text-slate-300">#{journey.number}</p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rail-blue/30 border border-rail-blue/40">
                <span className="text-2xl">{statusEmoji}</span>
              </div>
            </div>

            {/* Route */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 text-center">
                <p className="text-xs text-slate-400">From</p>
                <p className="text-base font-extrabold text-white">{journey.origin.code}</p>
                <p className="text-[11px] text-slate-300 truncate">{journey.origin.name}</p>
              </div>
              <div className="flex-shrink-0 flex flex-col items-center gap-1">
                <div className="h-px w-12 bg-gradient-to-r from-transparent via-sky-400 to-transparent" />
                <span className="text-[10px] text-sky-400 font-bold">→ {journey.totalDistanceKm} km</span>
                <div className="h-px w-12 bg-gradient-to-r from-transparent via-sky-400 to-transparent" />
              </div>
              <div className="flex-1 text-center">
                <p className="text-xs text-slate-400">To</p>
                <p className="text-base font-extrabold text-white">{journey.destination.code}</p>
                <p className="text-[11px] text-slate-300 truncate">{journey.destination.name}</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Journey Progress</span>
                <span className="font-bold text-sky-400">{Math.round(journey.completionPercentage)}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rail-blue to-sky-400"
                  style={{ width: `${journey.completionPercentage}%` }}
                />
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Covered', value: `${journey.distanceCoveredKm} km` },
                { label: 'Remaining', value: `${journey.remainingDistanceKm} km` },
                { label: 'Status', value: delayText },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-white/5 border border-white/10 p-2.5 text-center">
                  <p className="text-[9px] uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
                  <p className={cn(
                    'text-xs font-extrabold',
                    label === 'Status' && journey.delayMinutes > 0 ? 'text-rose-400' : 'text-white'
                  )}>{value}</p>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <p className="text-[10px] text-slate-500">
                {(process.env.NEXT_PUBLIC_SITE_URL || 'railradar24.onrender.com').replace(/^https?:\/\//, '')}
              </p>
              <p className="text-[10px] text-slate-500">
                {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              disabled={generating}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rail-blue px-4 py-2.5 text-sm font-semibold text-white shadow-glow hover:bg-sky-600 transition-colors disabled:opacity-60"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {generating ? 'Generating…' : 'Download PNG'}
            </button>
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
