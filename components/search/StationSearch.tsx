'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Search, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { StationSearchResult } from '@/types/train';
import { cn } from '@/utils/cn';

interface StationSearchProps {
  label?: string;
  placeholder?: string;
  value: string; // station code or formatted string
  onChange: (station: StationSearchResult) => void;
  className?: string;
}

export function StationSearch({
  label,
  placeholder = 'Search station name or code...',
  value,
  onChange,
  className,
}: StationSearchProps) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<StationSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      if (!isOpen && query === value) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/search/stations?q=${encodeURIComponent(query)}`, { signal: ac.signal });
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setResults(json.data);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Failed to search stations', err);
        }
      } finally {
        if (!ac.signal.aborted) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [query, isOpen, value]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const inputId = React.useId();

  const handleSelect = (st: StationSearchResult) => {
    setQuery(`${st.name} (${st.code})`);
    onChange(st);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {label && (
        <label htmlFor={inputId} className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
          {label}
        </label>
      )}

      <div
        className={cn(
          'flex items-center gap-2.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 px-4 py-3 border border-slate-200 dark:border-slate-800 transition-all shadow-sm',
          isOpen && 'border-rail-blue/60 ring-2 ring-rail-blue/20'
        )}
      >
        <MapPin className="h-4 w-4 text-rail-blue flex-shrink-0" />
        <input
          id={inputId}
          type="text"
          value={query}
          aria-label={label || placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none"
        />

        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(true);
            }}
            aria-label="Clear station"
            title="Clear station"
            className="rounded-full p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-2 z-50 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xl"
          >
            {results.length === 0 && !loading ? (
              <div className="py-4 text-center text-xs text-slate-500">
                No stations found for &quot;{query}&quot;
              </div>
            ) : (
              results.map((st) => (
                <button
                  key={st.code}
                  type="button"
                  onClick={() => handleSelect(st)}
                  className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-rail-blue bg-rail-blue/10 px-2 py-0.5 rounded-md">
                      {st.code}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">{st.name}</span>
                  </div>
                  {st.state && <span className="text-[11px] text-slate-400">{st.state}</span>}
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
