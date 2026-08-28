'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  ArrowLeftRight,
  Train,
  Clock,
  Calendar,
  IndianRupee,
  Sparkles,
  Search,
  Filter,
  Check,
  UtensilsCrossed,
} from 'lucide-react';
import { StationSearch } from '@/components/search/StationSearch';
import { TrainsBetweenData, PlannerTrain, StationSearchResult } from '@/types/train';
import { cn } from '@/utils/cn';

interface JourneyPlannerViewProps {
  initialData?: TrainsBetweenData | null;
}

const POPULAR_ROUTES = [
  { from: { code: 'NDLS', name: 'New Delhi' }, to: { code: 'MMCT', name: 'Mumbai Central' } },
  { from: { code: 'NDLS', name: 'New Delhi' }, to: { code: 'HWH', name: 'Howrah Junction' } },
  { from: { code: 'NDLS', name: 'New Delhi' }, to: { code: 'BSB', name: 'Varanasi Junction' } },
  { from: { code: 'MAS', name: 'Chennai Central' }, to: { code: 'SBC', name: 'KSR Bengaluru City' } },
];

function getSafeStationName(st: any, fallback: string = ''): string {
  if (!st) return fallback;
  if (typeof st === 'string') return st;
  if (typeof st.name === 'string') return st.name;
  if (typeof st.cityName === 'string') return st.cityName;
  if (typeof st.code === 'string') return st.code;
  return fallback;
}

function getSafeStationCode(st: any, fallback: string = ''): string {
  if (!st) return fallback;
  if (typeof st === 'string') return st;
  if (typeof st.code === 'string') return st.code;
  if (typeof st.stationCode === 'string') return st.stationCode;
  return fallback;
}

function getSafeTimeString(val: any, fallback: string = '--:--'): string {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val.departure === 'string') return val.departure;
  if (typeof val.arrival === 'string') return val.arrival;
  if (typeof val.departureTime === 'string') return val.departureTime;
  if (typeof val.arrivalTime === 'string') return val.arrivalTime;
  return fallback;
}

export function JourneyPlannerView({ initialData }: JourneyPlannerViewProps) {
  const [fromStation, setFromStation] = useState<StationSearchResult>({
    code: getSafeStationCode(initialData?.fromStation, 'NDLS'),
    name: getSafeStationName(initialData?.fromStation, 'New Delhi'),
  });
  const [toStation, setToStation] = useState<StationSearchResult>({
    code: getSafeStationCode(initialData?.toStation, 'MMCT'),
    name: getSafeStationName(initialData?.toStation, 'Mumbai Central'),
  });

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TrainsBetweenData | null>(initialData || null);
  const [selectedType, setSelectedType] = useState<string>('ALL');

  useEffect(() => {
    if (!initialData) {
      handleSearch('NDLS', 'MMCT');
    }
  }, []);

  const handleSwap = () => {
    const temp = fromStation;
    setFromStation(toStation);
    setToStation(temp);
  };

  const handleSearch = async (fromCode = fromStation.code, toCode = toStation.code) => {
    if (!fromCode || !toCode) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/planner?from=${fromCode}&to=${toCode}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch trains between stations', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTrains = (data?.trains || []).filter((t) => {
    if (selectedType === 'ALL') return true;
    if (selectedType === 'Rajdhani') return t.trainType === 'Rajdhani';
    if (selectedType === 'Vande Bharat') return t.trainType === 'Vande Bharat';
    return t.trainType.toLowerCase().includes(selectedType.toLowerCase());
  });

  return (
    <div className="space-y-8">
      {/* ─── Search Box ───────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-glass space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-2">
            <StationSearch
              label="Origin Station"
              placeholder="From station (e.g. New Delhi, NDLS)"
              value={fromStation.name ? `${fromStation.name} (${fromStation.code})` : ''}
              onChange={(st) => setFromStation(st)}
            />
          </div>

          <div className="flex justify-center md:pb-1">
            <button
              type="button"
              onClick={handleSwap}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rail-blue hover:text-white transition-all shadow-sm"
              title="Swap stations"
            >
              <ArrowLeftRight className="h-5 w-5" />
            </button>
          </div>

          <div className="md:col-span-2">
            <StationSearch
              label="Destination Station"
              placeholder="To station (e.g. Mumbai Central, MMCT)"
              value={toStation.name ? `${toStation.name} (${toStation.code})` : ''}
              onChange={(st) => setToStation(st)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          {/* Quick Popular Routes */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-bold">Popular:</span>
            {POPULAR_ROUTES.map((route, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setFromStation(route.from);
                  setToStation(route.to);
                  handleSearch(route.from.code, route.to.code);
                }}
                className="rounded-lg bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 text-slate-700 dark:text-slate-300 font-medium hover:bg-rail-blue hover:text-white transition-colors"
              >
                {route.from.code} → {route.to.code}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-rail-blue px-6 py-3 text-xs font-bold text-white shadow-glow hover:bg-sky-600 transition-all ml-auto"
          >
            <Search className="h-4 w-4" />
            <span>{loading ? 'Searching Trains...' : 'Find Trains'}</span>
          </button>
        </div>
      </div>

      {/* ─── Filter Pills ─────────────────────────────────────────────────── */}
      {data && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <Filter className="h-4 w-4" />
            <span>Filter by Type:</span>
            {['ALL', 'Rajdhani', 'Vande Bharat', 'Superfast'].map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={cn(
                  'rounded-lg px-3 py-1.5 font-bold transition-colors',
                  selectedType === t
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-200/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <span className="text-xs font-bold text-slate-400">
            Showing {filteredTrains.length} direct trains
          </span>
        </div>
      )}

      {/* ─── Trains List ──────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {filteredTrains.map((train) => (
          <motion.div
            key={train.trainNumber}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-3xl p-6 border border-slate-200 dark:border-slate-800 hover:border-rail-blue/40 shadow-sm transition-all space-y-4"
          >
            {/* Header: Train Number, Name, Type */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800/60 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="rounded-lg bg-rail-blue/10 px-2.5 py-1 font-mono text-xs font-bold text-rail-blue">
                  #{train.trainNumber}
                </span>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                  {train.trainName}
                </h3>
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                  {train.trainType}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {train.hasPantry && (
                  <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg font-bold">
                    <UtensilsCrossed className="h-3 w-3" />
                    <span>Pantry</span>
                  </div>
                )}
                <Link
                  href={`/train/${train.trainNumber}`}
                  className="flex items-center gap-1 rounded-xl bg-rail-blue/10 px-3 py-1.5 text-xs font-bold text-rail-blue hover:bg-rail-blue hover:text-white transition-all"
                >
                  <Train className="h-3.5 w-3.5" />
                  <span>Live Status →</span>
                </Link>
              </div>
            </div>

            {/* Timings & Duration Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-4 py-1">
              <div className="text-left">
                <span className="font-mono text-2xl font-extrabold text-slate-900 dark:text-white">
                  {getSafeTimeString(train.fromStation?.departureTime || (train as any).departureTime || (train as any).from?.departure)}
                </span>
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {getSafeStationName(train.fromStation, fromStation.name)} ({getSafeStationCode(train.fromStation, fromStation.code)})
                </span>
              </div>

              <div className="flex flex-col items-center justify-center text-center">
                <span className="text-[11px] font-bold text-slate-400">{typeof train.duration === 'string' ? train.duration : '15h 45m'}</span>
                <div className="w-full flex items-center gap-2 py-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-rail-blue" />
                  <div className="h-0.5 flex-1 bg-slate-300 dark:bg-slate-700" />
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <span className="text-[10px] text-slate-400">{typeof train.distanceKm === 'number' ? train.distanceKm : 0} km</span>
              </div>

              <div className="text-right">
                <span className="font-mono text-2xl font-extrabold text-slate-900 dark:text-white">
                  {getSafeTimeString(train.toStation?.arrivalTime || (train as any).arrivalTime || (train as any).to?.arrival)}
                </span>
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {getSafeStationName(train.toStation, toStation.name)} ({getSafeStationCode(train.toStation, toStation.code)})
                </span>
              </div>
            </div>

            {/* Running Days & Classes */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 mr-1">Runs:</span>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dayChar, i) => (
                  <span
                    key={i}
                    className="flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                  >
                    {dayChar}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 mr-1">Classes:</span>
                {(train.classes || []).map((cls) => (
                  <span
                    key={cls}
                    className="rounded-lg bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300"
                  >
                    {cls}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
