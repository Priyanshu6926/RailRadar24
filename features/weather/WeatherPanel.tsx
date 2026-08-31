'use client';

import React, { useEffect, useState } from 'react';
import { CloudSun } from 'lucide-react';
import { LiveJourney } from '@/types/train';
import { WeatherCard } from './WeatherCard';
import { WeatherData } from '@/lib/openweather';

interface WeatherPanelProps {
  journey: LiveJourney;
}

export function WeatherPanel({ journey }: WeatherPanelProps) {
  const [weatherData, setWeatherData] = useState<{
    current?: WeatherData;
    next?: WeatherData;
    dest?: WeatherData;
  }>({});
  const [loading, setLoading] = useState(true);

  const currentCode = journey.currentStation?.code || journey.previousStation?.code || journey.stations[0]?.code;
  const nextCode = journey.nextStation?.code;
  const destCode = journey.stations[journey.stations.length - 1]?.code;

  useEffect(() => {
    const ac = new AbortController();

    async function loadWeather() {
      setLoading(true);
      try {
        const currSt = journey.currentStation || journey.previousStation || (journey.stations && journey.stations.length > 0 ? journey.stations[0] : undefined);
        const destSt = journey.stations && journey.stations.length > 0 ? journey.stations[journey.stations.length - 1] : undefined;
        const nextSt = journey.nextStation || destSt;

        if (!currSt?.lat || !destSt?.lat) {
          setLoading(false);
          return;
        }

        const [currRes, nextRes, destRes] = await Promise.all([
          fetch(`/api/weather?lat=${currSt.lat}&lng=${currSt.lng}&name=${encodeURIComponent(currSt.name || currSt.code)}&code=${currSt.code}`, { signal: ac.signal }),
          nextSt?.lat ? fetch(`/api/weather?lat=${nextSt.lat}&lng=${nextSt.lng}&name=${encodeURIComponent(nextSt.name || nextSt.code)}&code=${nextSt.code}`, { signal: ac.signal }) : Promise.resolve(null),
          fetch(`/api/weather?lat=${destSt.lat}&lng=${destSt.lng}&name=${encodeURIComponent(destSt.name || destSt.code)}&code=${destSt.code}`, { signal: ac.signal }),
        ]);

        const currJson = await currRes.json();
        const nextJson = nextRes ? await nextRes.json() : null;
        const destJson = await destRes.json();

        setWeatherData({
          current: currJson.data,
          next: nextJson?.data,
          dest: destJson.data,
        });
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          console.warn('Weather panel loading failed', e);
        }
      } finally {
        if (!ac.signal.aborted) {
          setLoading(false);
        }
      }
    }
    loadWeather();

    return () => ac.abort();
  }, [currentCode, nextCode, destCode]);

  if (loading) {
    return (
      <div className="glass-panel rounded-3xl p-6 text-center text-xs text-slate-400">
        Loading weather details...
      </div>
    );
  }

  if (!weatherData.current && !weatherData.dest) {
    return (
      <div className="glass-panel rounded-3xl p-6 text-center text-xs text-slate-400">
        Weather information unavailable for this route.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 font-bold text-lg text-slate-900 dark:text-white">
        <CloudSun className="h-5 w-5 text-amber-500" />
        <span>Smart Travel Companion Weather</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {weatherData.current && (
          <WeatherCard label="Current Station Weather" weather={weatherData.current} />
        )}
        {weatherData.next && (
          <WeatherCard label="Next Station Weather" weather={weatherData.next} />
        )}
        {weatherData.dest && (
          <WeatherCard label="Destination Weather" weather={weatherData.dest} />
        )}
      </div>
    </div>
  );
}
