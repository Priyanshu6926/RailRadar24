'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Train,
  ArrowRight,
  Sparkles,
  Clock,
  History,
  MapPin,
  Zap,
  Search,
  Loader2,
  AlertCircle,
  X,
  Ticket,
  Route,
  Building2,
  IndianRupee,
  LayoutGrid,
  ShieldCheck,
  Cpu,
  Layers,
} from 'lucide-react';
import { useTrainSearch } from '@/hooks/useTrainSearch';
import { useSearchStore } from '@/store/search';
import { SearchResult } from '@/types/train';
import { cn } from '@/utils/cn';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

type HeroTab = 'train' | 'pnr' | 'planner' | 'stations';

export default function HomePage() {
  const router = useRouter();
  const { recentSearches, addRecentSearch, clearRecentSearches } = useSearchStore();
  const [activeHeroTab, setActiveHeroTab] = useState<HeroTab>('train');

  // Train search state
  const [inputValue, setInputValue] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const debouncedQuery = useDebounce(inputValue, 300);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: searchResults, isLoading, isError } = useTrainSearch(debouncedQuery);

  // PNR search state
  const [pnrInput, setPnrInput] = useState('');

  // Planner quick search state
  const [fromCode, setFromCode] = useState('NDLS');
  const [toCode, setToCode] = useState('MMCT');

  // Station quick search state
  const [stationInput, setStationInput] = useState('');

  // ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (train: SearchResult) => {
    addRecentSearch(train);
    setIsSearchOpen(false);
    setInputValue('');
    router.push(`/train/${train.number}`);
  };

  const handleTrainKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      const first = searchResults?.[0];
      if (first) handleSelect(first);
      else router.push(`/train/${inputValue.trim()}`);
    }
    if (e.key === 'Escape') {
      setIsSearchOpen(false);
      inputRef.current?.blur();
    }
  };

  const handlePnrSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pnrInput.trim()) return;
    router.push(`/pnr?pnr=${pnrInput.trim()}`);
  };

  const handlePlannerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push('/planner');
  };

  const handleStationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stationInput.trim()) return;
    router.push(`/stations/${stationInput.trim().toUpperCase()}`);
  };

  const showDropdown = isSearchOpen && Boolean(inputValue.trim());

  return (
    <div className="space-y-12 py-4">
      {/* ─── Hero Section ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-sky-500/10 via-background to-background p-6 sm:p-10 md:p-14 text-center border border-sky-500/20 shadow-glass">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-3xl space-y-6"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-1.5 text-xs font-semibold text-rail-blue backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Next-Gen Indian Railways Intelligence · RailRadar Engine</span>
          </div>

          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white sm:text-6xl">
            Track, Plan & Predict <br />
            <span className="text-rail-blue">Indian Railways</span> Live.
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-xl mx-auto">
            Live GPS train tracking, ML-backed PNR waitlist confirmation, 14-day seat availability, itemized fares, and airport-style station departure boards.
          </p>

          {/* ─── Hero Mode Switcher Tabs ─── */}
          <div className="inline-flex items-center gap-1 rounded-2xl bg-slate-200/70 dark:bg-slate-900/90 p-1.5 border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto max-w-full">
            {[
              { id: 'train' as HeroTab, label: 'Live Train', icon: Train },
              { id: 'pnr' as HeroTab, label: 'PNR Status', icon: Ticket },
              { id: 'planner' as HeroTab, label: 'Trains Between', icon: Route },
              { id: 'stations' as HeroTab, label: 'Station Board', icon: Building2 },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveHeroTab(id)}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 whitespace-nowrap',
                  activeHeroTab === id
                    ? 'bg-rail-blue text-white shadow-glow'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* ─── Active Tab Input Box ─── */}
          <div className="mt-4 relative max-w-xl mx-auto text-left">
            {/* 1. Live Train Search */}
            {activeHeroTab === 'train' && (
              <div>
                <div
                  className={cn(
                    'glass-panel flex items-center gap-3 rounded-2xl px-4 py-3.5 shadow-glass transition-all duration-300',
                    isSearchOpen ? 'border-rail-blue/50 shadow-glow ring-1 ring-rail-blue/20' : ''
                  )}
                >
                  {isLoading && inputValue ? (
                    <Loader2 className="h-5 w-5 flex-shrink-0 text-rail-blue animate-spin" />
                  ) : (
                    <Search className="h-5 w-5 flex-shrink-0 text-slate-400" />
                  )}

                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      setIsSearchOpen(true);
                    }}
                    onFocus={() => setIsSearchOpen(true)}
                    onKeyDown={handleTrainKeyDown}
                    placeholder="Enter train number (12951) or name (Rajdhani)..."
                    className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder-slate-400 outline-none dark:text-white dark:placeholder-slate-500"
                  />

                  {inputValue && (
                    <button
                      onClick={() => {
                        setInputValue('');
                        setIsSearchOpen(false);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}

                  <kbd className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 flex-shrink-0">
                    ⌘ K
                  </kbd>
                </div>

                {/* Dropdown */}
                <AnimatePresence>
                  {showDropdown && (
                    <motion.div
                      ref={dropdownRef}
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 right-0 top-full mt-2 z-50 max-h-[360px] overflow-y-auto rounded-2xl glass-panel p-3 shadow-glass-hover border border-slate-200 dark:border-slate-800"
                    >
                      {isError && (
                        <div className="flex items-center gap-2 py-4 text-center justify-center text-xs text-rose-500">
                          <AlertCircle className="h-4 w-4" />
                          <span>Error loading trains. Please try again.</span>
                        </div>
                      )}

                      {isLoading && !searchResults && (
                        <div className="space-y-2 py-1">
                          {[1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className="h-16 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse"
                            />
                          ))}
                        </div>
                      )}

                      {!isLoading && !isError && searchResults && searchResults.length === 0 && (
                        <div className="py-6 text-center text-xs text-slate-500">
                          No trains found. Try a train number like <strong>12951</strong> or name like <strong>Rajdhani</strong>.
                        </div>
                      )}

                      {inputValue && /^\d{4,5}$/.test(inputValue.trim()) && (
                        <button
                          onClick={() => router.push(`/train/${inputValue.trim()}`)}
                          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 mb-2 bg-rail-blue/10 text-rail-blue text-xs font-bold hover:bg-rail-blue hover:text-white transition-all"
                        >
                          <Train className="h-4 w-4" />
                          <span>Track train #{inputValue.trim()} live →</span>
                        </button>
                      )}

                      {searchResults && searchResults.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1 pb-1">
                            {inputValue ? 'Matching Trains' : 'Popular Trains'}
                          </p>
                          {searchResults.map((train) => (
                            <button
                              key={train.id}
                              onClick={() => handleSelect(train)}
                              className="w-full glass-panel group flex items-center justify-between rounded-xl p-3 transition-all duration-150 hover:bg-rail-blue/5 hover:border-rail-blue/30 text-left"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-rail-blue/10 text-rail-blue group-hover:bg-rail-blue group-hover:text-white transition-colors">
                                  <Train className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200 flex-shrink-0">
                                      {train.number}
                                    </span>
                                    <span className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                                      {train.name}
                                    </span>
                                  </div>
                                  {(train.origin.name || train.destination.name) && (
                                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
                                      <span>
                                        {train.origin.name} ({train.origin.code})
                                      </span>
                                      <ArrowRight className="h-2.5 w-2.5 flex-shrink-0" />
                                      <span>
                                        {train.destination.name} ({train.destination.code})
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0 group-hover:text-rail-blue group-hover:translate-x-0.5 transition-all" />
                            </button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Quick Chips */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
                  <span className="text-slate-400 font-medium">Popular:</span>
                  {['12951', '22436', '12301', '12621', '12001'].map((num) => (
                    <button
                      key={num}
                      onClick={() => {
                        setInputValue(num);
                        setIsSearchOpen(true);
                        inputRef.current?.focus();
                      }}
                      className="rounded-lg bg-slate-200/70 dark:bg-slate-800/70 px-2.5 py-1 font-mono font-bold text-slate-700 dark:text-slate-300 hover:bg-rail-blue hover:text-white transition-colors"
                    >
                      #{num}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 2. PNR Search */}
            {activeHeroTab === 'pnr' && (
              <form onSubmit={handlePnrSubmit}>
                <div className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-3 shadow-glass border border-slate-200 dark:border-slate-800">
                  <Ticket className="h-5 w-5 text-rail-blue flex-shrink-0" />
                  <input
                    type="text"
                    maxLength={10}
                    value={pnrInput}
                    onChange={(e) => setPnrInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 10-digit PNR (e.g. 2849102847)..."
                    className="w-full bg-transparent text-sm font-mono font-bold text-slate-900 placeholder-slate-400 outline-none dark:text-white"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-rail-blue px-5 py-2.5 text-xs font-bold text-white shadow-glow hover:bg-sky-600 transition-all flex-shrink-0"
                  >
                    Check Status
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
                  <span className="text-slate-400 font-medium">Try PNR:</span>
                  {['2849102847', '4521098371'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => router.push(`/pnr?pnr=${p}`)}
                      className="rounded-lg bg-slate-200/70 dark:bg-slate-800/70 px-2.5 py-1 font-mono font-bold text-slate-700 dark:text-slate-300 hover:bg-rail-blue hover:text-white transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </form>
            )}

            {/* 3. Planner Search */}
            {activeHeroTab === 'planner' && (
              <form onSubmit={handlePlannerSubmit} className="space-y-3">
                <div className="glass-panel flex flex-col sm:flex-row items-center gap-2 rounded-2xl p-2 shadow-glass border border-slate-200 dark:border-slate-800">
                  <div className="flex-1 w-full px-3 py-2 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-rail-blue flex-shrink-0" />
                    <input
                      type="text"
                      value={fromCode}
                      onChange={(e) => setFromCode(e.target.value.toUpperCase())}
                      placeholder="From (e.g. NDLS)"
                      className="w-full bg-transparent text-xs font-bold uppercase text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 hidden sm:block" />
                  <div className="flex-1 w-full px-3 py-2 flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-800">
                    <MapPin className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <input
                      type="text"
                      value={toCode}
                      onChange={(e) => setToCode(e.target.value.toUpperCase())}
                      placeholder="To (e.g. MMCT)"
                      className="w-full bg-transparent text-xs font-bold uppercase text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full sm:w-auto rounded-xl bg-rail-blue px-5 py-2.5 text-xs font-bold text-white shadow-glow hover:bg-sky-600 transition-all flex-shrink-0"
                  >
                    Find Trains
                  </button>
                </div>
              </form>
            )}

            {/* 4. Station Board */}
            {activeHeroTab === 'stations' && (
              <form onSubmit={handleStationSubmit}>
                <div className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-3 shadow-glass border border-slate-200 dark:border-slate-800">
                  <Building2 className="h-5 w-5 text-rail-blue flex-shrink-0" />
                  <input
                    type="text"
                    value={stationInput}
                    onChange={(e) => setStationInput(e.target.value.toUpperCase())}
                    placeholder="Enter station code (e.g. NDLS, MMCT, HWH)..."
                    className="w-full bg-transparent text-sm font-bold uppercase text-slate-900 placeholder-slate-400 outline-none dark:text-white"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-rail-blue px-5 py-2.5 text-xs font-bold text-white shadow-glow hover:bg-sky-600 transition-all flex-shrink-0"
                  >
                    View Board
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
                  <span className="text-slate-400 font-medium">Popular:</span>
                  {['NDLS', 'MMCT', 'HWH', 'MAS', 'SBC'].map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => router.push(`/stations/${code}`)}
                      className="rounded-lg bg-slate-200/70 dark:bg-slate-800/70 px-2.5 py-1 font-mono font-bold text-slate-700 dark:text-slate-300 hover:bg-rail-blue hover:text-white transition-colors"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </section>

      {/* ─── Recent Searches ───────────────────────────────────────────────── */}
      {recentSearches.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-lg text-slate-900 dark:text-white">
              <History className="h-5 w-5 text-rail-blue" />
              <span>Recent Searches</span>
            </div>
            <button
              onClick={clearRecentSearches}
              className="text-xs font-semibold text-slate-400 hover:text-rose-500 transition-colors"
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentSearches.map((train) => (
              <Link
                key={train.id}
                href={`/train/${train.number}`}
                className="glass-panel group flex items-center justify-between rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glass-hover"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rail-blue/10 text-rail-blue group-hover:bg-rail-blue group-hover:text-white transition-colors flex-shrink-0">
                    <Train className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-mono text-[11px] font-bold text-rail-blue block">
                      #{train.number}
                    </span>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                      {train.name}
                    </h4>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0 group-hover:translate-x-0.5 group-hover:text-rail-blue transition-all" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ─── Super-App Feature Grid ────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Everything Indian Railways in One Place
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Engineered with modern full-stack performance, sub-second API lookups, and responsive vector visualization.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              icon: <MapPin className="h-6 w-6" />,
              color: 'bg-sky-500/10 text-rail-blue',
              title: 'Live GPS Vector Tracking',
              desc: 'Interactive MapLibre vector maps with smooth 30s auto-refresh, train headings, and station waypoints.',
              link: '/train/12951',
              linkText: 'Track Live Map →',
            },
            {
              icon: <Sparkles className="h-6 w-6" />,
              color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
              title: 'ML PNR Predictor',
              desc: 'Machine-learning waitlist confirmation forecast with seat allocation & itemized refund calculations.',
              link: '/pnr',
              linkText: 'Check PNR →',
            },
            {
              icon: <Route className="h-6 w-6" />,
              color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
              title: 'Journey Planner',
              desc: 'Discover direct and connecting trains between 8,000+ stations with running days & pantry indicators.',
              link: '/planner',
              linkText: 'Plan Journey →',
            },
            {
              icon: <Building2 className="h-6 w-6" />,
              color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
              title: 'Airport FIDS Station Boards',
              desc: 'Live animated departure & arrival boards with real-time delays, platform numbers, and origin badges.',
              link: '/stations',
              linkText: 'View Station Boards →',
            },
            {
              icon: <IndianRupee className="h-6 w-6" />,
              color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
              title: 'Fare Calculator',
              desc: 'Complete cost breakdown per class (1A, 2A, 3A, SL) including base fare, superfast fee, and GST.',
              link: '/train/12951',
              linkText: 'Calculate Fares →',
            },
            {
              icon: <LayoutGrid className="h-6 w-6" />,
              color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
              title: '14-Day Seat Forecast',
              desc: 'Rolling 2-week calendar view of PRS seat availability with confirmation probability for waitlists.',
              link: '/train/12951',
              linkText: 'Check Seat Grid →',
            },
          ].map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08 * i }}
              className="glass-panel rounded-3xl p-6 flex flex-col justify-between border border-slate-200 dark:border-slate-800 space-y-4 hover:border-rail-blue/40 shadow-sm transition-all"
            >
              <div className="space-y-3">
                <div className={cn('h-12 w-12 rounded-2xl flex items-center justify-center', f.color)}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">{f.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {f.desc}
                </p>
              </div>

              <Link
                href={f.link}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-rail-blue hover:underline pt-2"
              >
                <span>{f.linkText}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Tech Stack Highlights (Recruiter Eye-Candy) ───────────────────── */}
      <section className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-left">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rail-blue">
              Engineering Highlights
            </span>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Built with Modern Full-Stack Web Architecture
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
              Next.js 16 App Router · TypeScript · MapLibre GL Vector Graphics · TanStack Query Caching · LRU In-Memory Cache · Framer Motion
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {['Next.js 16', 'TypeScript', 'MapLibre GL', 'TanStack Query', 'RailRadar API', 'TailwindCSS'].map((tech) => (
              <span
                key={tech}
                className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-slate-700 dark:text-slate-300"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
