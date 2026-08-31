'use client';

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Target, ZoomIn, ZoomOut } from 'lucide-react';
import { LiveJourney } from '@/types/train';
import { useJourneyStore } from '@/store/journey';
import { interpolatePolylineAlongRoute, haversineKm } from '@/lib/geo';
import { cn } from '@/utils/cn';

// MapTiler key — NEXT_PUBLIC_ prefix means it is exposed to the browser safely
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY || '';

interface MapViewProps {
  journey: LiveJourney;
  className?: string;
}

export default function MapView({ journey, className }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const stationMarkersRef = useRef<maplibregl.Marker[]>([]);
  const isUserInteractingRef = useRef<boolean>(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [styleLoaded, setStyleLoaded] = useState(false);

  const followTrainMode = useJourneyStore((state) => state.followTrainMode);
  const setFollowTrainMode = useJourneyStore((state) => state.setFollowTrainMode);

  const coords = journey.routeGeometry || [];

  // Initialize MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const styleUrl = MAPTILER_KEY
      ? `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`
      : 'https://demotiles.maplibre.org/style.json';

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleUrl,
      center: coords.length > 0 ? coords[0] : [78.9629, 20.5937],
      zoom: 5,
      pitch: 0,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: false }), 'bottom-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    map.on('load', () => {
      mapRef.current = map;
      setMapLoaded(true);
      setStyleLoaded(true);
    });

    map.on('dragstart', () => { isUserInteractingRef.current = true; setFollowTrainMode(false); });
    map.on('zoomstart', () => { isUserInteractingRef.current = true; });

    return () => {
      markerRef.current?.remove();
      stationMarkersRef.current.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Route Polyline & Markers on Journey change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !styleLoaded) return;

    // ─ Route Geometry Layer ─
    if (coords.length > 1) {
      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: coords,
            },
            properties: {},
          },
        ],
      };

      if (map.getSource('train-route')) {
        (map.getSource('train-route') as maplibregl.GeoJSONSource).setData(geojson);
      } else {
        map.addSource('train-route', { type: 'geojson', data: geojson });
        map.addLayer({
          id: 'train-route-casing',
          type: 'line',
          source: 'train-route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#0284c7',
            'line-width': 6,
            'line-opacity': 0.3,
          },
        });
        map.addLayer({
          id: 'train-route-line',
          type: 'line',
          source: 'train-route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#38bdf8',
            'line-width': 3,
            'line-opacity': 0.9,
          },
        });
      }
    }

    // ─ Train Marker ─
    let trainLng = journey.currentLocation?.lng;
    let trainLat = journey.currentLocation?.lat;

    const isAtOrigin = coords.length > 0 && trainLng === coords[0]?.[0] && trainLat === coords[0]?.[1];
    if ((!trainLng || !trainLat || (isAtOrigin && journey.completionPercentage > 2)) && coords.length > 0) {
      const interpolated = interpolatePolylineAlongRoute(coords, journey.completionPercentage);
      if (interpolated) {
        trainLng = interpolated.point[0];
        trainLat = interpolated.point[1];
      }
    }

    // Only render train marker if valid coordinates exist (R-32)
    if (trainLng !== undefined && trainLat !== undefined && Number.isFinite(trainLng) && Number.isFinite(trainLat)) {
      const popupHtml = `
        <div class="p-2 font-sans">
          <div class="font-bold text-xs">${journey.name}</div>
          <div class="text-[11px] text-gray-500">#${journey.number}</div>
          <div class="text-[11px] font-semibold text-sky-600 mt-0.5">
            ${journey.speedKmh !== null ? `${journey.speedKmh} km/h` : 'Speed: —'} · Delay: ${journey.delayMinutes > 0 ? '+' + journey.delayMinutes + 'm' : 'On time'}
          </div>
        </div>`;

      if (!markerRef.current) {
        const el = document.createElement('div');
        el.innerHTML = `
          <div class="relative flex items-center justify-center w-10 h-10">
            <div class="absolute inset-0 rounded-full bg-sky-500/30 animate-ping"></div>
            <div class="relative flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 text-white border-2 border-white shadow-lg text-lg">
              🚄
            </div>
          </div>`;

        const popup = new maplibregl.Popup({ offset: 16, closeButton: false }).setHTML(popupHtml);

        markerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([trainLng, trainLat])
          .setPopup(popup)
          .addTo(map);
      } else {
        markerRef.current.setLngLat([trainLng, trainLat]);
        markerRef.current.getPopup()?.setHTML(popupHtml);
      }
    }

    // ─ Station Markers ─
    stationMarkersRef.current.forEach((m) => m.remove());
    stationMarkersRef.current = [];

    journey.stations.forEach((st) => {
      if (!st.lat || !st.lng) return;
      const el = document.createElement('div');
      const isPassed = st.status === 'passed';
      const isCurrent = st.status === 'current';

      el.innerHTML = `<div class="rounded-full border-2 border-white shadow-sm cursor-pointer transition-transform hover:scale-150 ${
        isCurrent ? 'h-4 w-4 bg-sky-500 ring-4 ring-sky-500/30' : isPassed ? 'h-2.5 w-2.5 bg-emerald-500' : 'h-2.5 w-2.5 bg-slate-400'
      }"></div>`;

      const popup = new maplibregl.Popup({ offset: 10, closeButton: false }).setHTML(`
        <div class="p-2 font-sans">
          <div class="font-bold text-xs">${st.name} (${st.code})</div>
          <div class="text-[11px] text-gray-500 mt-0.5">${st.distanceKm} km from origin</div>
          <div class="text-[11px] font-semibold mt-0.5 ${st.delayMinutes > 0 ? 'text-amber-600' : 'text-emerald-600'}">
            ${st.delayMinutes > 0 ? `+${st.delayMinutes}m delay` : 'On time'}
          </div>
          ${st.platform ? `<div class="text-[11px] text-gray-500">Platform ${st.platform}</div>` : ''}
        </div>`);

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([st.lng, st.lat])
        .setPopup(popup)
        .addTo(map);
      stationMarkersRef.current.push(marker);
    });

    // ─ Camera ─
    if (followTrainMode) {
      map.easeTo({ center: [trainLng, trainLat], duration: 800 });
    }
  }, [journey, mapLoaded, followTrainMode, setFollowTrainMode]);

  // ─── Controls ──────────────────────────────────────────────────────────────
  const recenter = () => {
    setFollowTrainMode(true);
    mapRef.current?.easeTo({
      center: [journey.currentLocation?.lng ?? 77.22, journey.currentLocation?.lat ?? 28.64],
      zoom: 9,
      duration: 800,
    });
  };

  return (
    <div className={cn('relative overflow-hidden rounded-3xl shadow-glass', className)}>
      <div ref={mapContainerRef} className="h-full w-full min-h-[420px]" />

      {/* Floating Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        {[
          { icon: ZoomIn, action: () => mapRef.current?.zoomIn(), title: 'Zoom In' },
          { icon: ZoomOut, action: () => mapRef.current?.zoomOut(), title: 'Zoom Out' },
          { icon: Target, action: recenter, title: 'Center on Train', isActive: followTrainMode },
        ].map(({ icon: Icon, action, title, isActive }) => (
          <button
            key={title}
            onClick={action}
            title={title}
            className={cn(
              'glass-panel flex h-10 w-10 items-center justify-center rounded-xl shadow-md transition-all hover:scale-105',
              isActive ? 'bg-rail-blue text-white shadow-glow border-rail-blue' : 'text-slate-700 dark:text-slate-200'
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>

      {/* Follow Mode Badge */}
      <div className="absolute bottom-4 left-4 z-10">
        <button
          onClick={() => setFollowTrainMode(!followTrainMode)}
          className={cn(
            'glass-panel flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-md transition-all',
            followTrainMode ? 'text-rail-blue border-rail-blue/30' : 'text-slate-500'
          )}
        >
          <span className={cn('h-2 w-2 rounded-full', followTrainMode ? 'bg-rail-blue animate-ping' : 'bg-slate-400')} />
          {followTrainMode ? 'Following Train' : 'Camera Free'}
        </button>
      </div>
    </div>
  );
}
