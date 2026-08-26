'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Route, Sparkles } from 'lucide-react';
import { JourneyPlannerView } from '@/features/planner/JourneyPlannerView';

export default function PlannerPage() {
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
            <span>Multi-Route Train Discovery Engine</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            Trains Between <span className="text-rail-blue">Stations</span>
          </h1>

          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Find direct and connecting trains between any two Indian railway stations with live timetable, running days, and pantry availability.
          </p>
        </motion.div>
      </section>

      {/* Main Interactive Planner */}
      <JourneyPlannerView />
    </div>
  );
}
