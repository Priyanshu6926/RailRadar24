'use client';

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Target, ZoomIn, ZoomOut } from 'lucide-react';
import { LiveJourney, Station } from '@/types/train';
import { useJourneyStore } from '@/store/journey';
import { interpolatePolylineAlongRoute, haversineKm } from '@/lib/geo';
import { cn } from '@/utils/cn';

// MapTiler key — NEXT_PUBLIC_ prefix means it is exposed to the browser safely
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY || '';

interface MapViewProps {
  journey: LiveJourney;
  className?: string;
}

function getStationDotClass(status: Station['status']): string {
  return `rounded-full border-2 border-white shadow-sm cursor-pointer transition-transform hover:scale-150 ${
    status === 'current'
      ? 'h-4 w-4 bg-sky-500 ring-4 ring-sky-500/30'
      : status === 'passed'
      ? 'h-2.5 w-2.5 bg-emerald-500'
      : 'h-2.5 w-2.5 bg-slate-400'
  }`;
}

export default function MapView({ journey, className }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const stationMarkersMapRef = useRef<Map<string, { marker: maplibregl.Marker; el: HTMLElement }>>(new Map());
  const isUserInteractingRef = useRef<boolean>(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [styleLoaded, setStyleLoaded] = useState(false);

  const followTrainMode = useJourneyStore((state) => state.followTrainMode);
  const setFollowTrainMode = useJourneyStore((state) => state.setFollowTrainMode);

  const coords = journey.routeGeometry || [];

  // Determine current train coordinates
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
      stationMarkersMapRef.current.forEach(({ marker }) => marker.remove());
      stationMarkersMapRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Route Polyline & Markers on Journey change (R-33)
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

    // ─ Train Marker (R-26, R-32) ─
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

    // ─ Station Markers Reuse (R-33) ─
    const currentCodes = new Set<string>();

    journey.stations.forEach((st) => {
      if (!st.lat || !st.lng || !st.code) return;
      currentCodes.add(st.code);

      const existing = stationMarkersMapRef.current.get(st.code);
      const popupHtml = `
        <div class="p-2 font-sans">
          <div class="font-bold text-xs">${st.name} (${st.code})</div>
          <div class="text-[11px] text-gray-500 mt-0.5">${st.distanceKm} km from origin</div>
          <div class="text-[11px] font-semibold mt-0.5 ${st.delayMinutes > 0 ? 'text-amber-600' : 'text-emerald-600'}">
            ${st.delayMinutes > 0 ? `+${st.delayMinutes}m delay` : 'On time'}
          </div>
          ${st.platform ? `<div class="text-[11px] text-gray-500">Platform ${st.platform}</div>` : ''}
        </div>`;

      if (existing) {
        // Update existing marker DOM class and popup without destroying
        if (existing.el.firstElementChild) {
          existing.el.firstElementChild.className = getStationDotClass(st.status);
        }
        existing.marker.getPopup()?.setHTML(popupHtml);
      } else {
        const el = document.createElement('div');
        el.innerHTML = `<div class="${getStationDotClass(st.status)}"></div>`;

        const popup = new maplibregl.Popup({ offset: 10, closeButton: false }).setHTML(popupHtml);
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([st.lng, st.lat])
          .setPopup(popup)
          .addTo(map);

        stationMarkersMapRef.current.set(st.code, { marker, el });
      }
    });

    // Remove any markers no longer in the station list
    stationMarkersMapRef.current.forEach(({ marker }, code) => {
      if (!currentCodes.has(code)) {
        marker.remove();
        stationMarkersMapRef.current.delete(code);
      }
    });
  }, [journey.number, journey.completionPercentage, journey.stations, journey.speedKmh, journey.delayMinutes, mapLoaded, styleLoaded]);

  // Separate Camera follow effect (R-34)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !styleLoaded || !followTrainMode) return;
    if (trainLng !== undefined && trainLat !== undefined && Number.isFinite(trainLng) && Number.isFinite(trainLat)) {
      map.easeTo({ center: [trainLng, trainLat], duration: 800 });
    }
  }, [followTrainMode, trainLng, trainLat, mapLoaded, styleLoaded]);

  // ─── Controls ──────────────────────────────────────────────────────────────
  const recenter = () => {
    setFollowTrainMode(true);
    if (trainLng !== undefined && trainLat !== undefined && Number.isFinite(trainLng) && Number.isFinite(trainLat)) {
      mapRef.current?.easeTo({
        center: [trainLng, trainLat],
        zoom: 9,
        duration: 800,
      });
    }
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
