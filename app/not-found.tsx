import React from 'react';
import Link from 'next/link';
import { Train, Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-[75vh] flex items-center justify-center p-6">
      <div className="glass-panel max-w-lg w-full rounded-3xl p-8 sm:p-10 text-center space-y-6 shadow-glow">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-rail-blue/10 text-rail-blue">
          <Train className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-rail-blue">
            404 — Destination Not Found
          </span>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Track Ends Here</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            The train number, station code, or route you are looking for does not exist or has been rescheduled.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl bg-rail-blue px-5 py-2.5 text-sm font-bold text-white shadow-glow hover:bg-rail-blue/90 transition-all"
          >
            <Home className="h-4 w-4" />
            <span>Back to Radar</span>
          </Link>
          <Link
            href="/search"
            className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 px-5 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <Search className="h-4 w-4" />
            <span>Search Trains</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
