import React from 'react';
import { Loader2, Train } from 'lucide-react';

export default function TrainLoading() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <Train className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <div className="h-6 w-48 rounded-lg bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-32 rounded-lg bg-slate-200/60 dark:bg-slate-800/60" />
          </div>
        </div>
      </div>

      {/* Content grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel rounded-3xl h-80 bg-slate-100 dark:bg-slate-900/60 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-rail-blue" />
            <span className="text-xs font-semibold">Connecting to live train feed…</span>
          </div>
        </div>
        <div className="space-y-6">
          <div className="glass-panel rounded-3xl h-80 bg-slate-100 dark:bg-slate-900/60" />
        </div>
      </div>
    </div>
  );
}
