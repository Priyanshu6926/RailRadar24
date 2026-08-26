'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Building2, Search, ArrowRight, Sparkles, MapPin } from 'lucide-react';
import { StationSearch } from '@/components/search/StationSearch';

const POPULAR_STATIONS = [
  { code: 'NDLS', name: 'New Delhi', state: 'Delhi' },
  { code: 'MMCT', name: 'Mumbai Central', state: 'Maharashtra' },
  { code: 'HWH', name: 'Howrah Junction', state: 'West Bengal' },
  { code: 'MAS', name: 'Chennai Central', state: 'Tamil Nadu' },
  { code: 'SBC', name: 'KSR Bengaluru City', state: 'Karnataka' },
  { code: 'PNBE', name: 'Patna Junction', state: 'Bihar' },
  { code: 'LKO', name: 'Lucknow NR', state: 'Uttar Pradesh' },
  { code: 'ADI', name: 'Ahmedabad Junction', state: 'Gujarat' },
  { code: 'HYB', name: 'Hyderabad Deccan', state: 'Telangana' },
  { code: 'PUNE', name: 'Pune Junction', state: 'Maharashtra' },
  { code: 'GHY', name: 'Guwahati', state: 'Assam' },
  { code: 'TVC', name: 'Thiruvananthapuram Central', state: 'Kerala' },
];

export default function StationsDirectoryPage() {
  const router = useRouter();
  const [selectedStation, setSelectedStation] = useState<string>('');

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-2">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-sky-500/10 via-background to-background p-8 md:p-12 text-center border border-sky-500/20 shadow-glass">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-2xl"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-xs font-semibold text-rail-blue mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Real-time Live Departure & Arrival Boards</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            Station Live <span className="text-rail-blue">Boards</span>
          </h1>

          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            View live digital departures and arrivals boards across 8,000+ Indian Railways stations with real-time delays and platform numbers.
          </p>

          <div className="mt-8 max-w-md mx-auto">
            <StationSearch
              placeholder="Search station (e.g. New Delhi, NDLS)..."
              value={selectedStation}
              onChange={(st) => router.push(`/stations/${st.code}`)}
            />
          </div>
        </motion.div>
      </section>

      {/* Major Hubs Grid */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-rail-blue" />
          <h2 className="font-extrabold text-lg text-slate-900 dark:text-white">
            Major Railway Hubs & Terminals
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {POPULAR_STATIONS.map((st) => (
            <Link
              key={st.code}
              href={`/stations/${st.code}`}
              className="glass-panel group flex items-center justify-between rounded-2xl p-4 border border-slate-200 dark:border-slate-800 hover:border-rail-blue/40 shadow-sm transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-rail-blue/10 text-rail-blue group-hover:bg-rail-blue group-hover:text-white transition-colors">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <span className="font-mono text-[11px] font-bold text-rail-blue block">
                    {st.code}
                  </span>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                    {st.name}
                  </h4>
                  <span className="text-[11px] text-slate-400">{st.state}</span>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-rail-blue group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
