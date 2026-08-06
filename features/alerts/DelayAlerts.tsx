'use client';

import React, { useState, useEffect } from 'react';
import { Bell, BellOff, AlertTriangle, CheckCircle } from 'lucide-react';
import { LiveJourney } from '@/types/train';
import { cn } from '@/utils/cn';

interface DelayAlertsProps {
  journey: LiveJourney;
}

const STORAGE_KEY = 'rr24_delay_alerts';
const DELAY_THRESHOLD = 10; // minutes change to trigger alert

function getSubscribed(trainId: string): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const map: Record<string, boolean> = stored ? JSON.parse(stored) : {};
    return map[trainId] ?? false;
  } catch { return false; }
}

function setSubscribed(trainId: string, val: boolean) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const map: Record<string, boolean> = stored ? JSON.parse(stored) : {};
    map[trainId] = val;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

function getPrevDelay(trainId: string): number {
  try {
    const stored = localStorage.getItem(`rr24_prev_delay_${trainId}`);
    return stored ? parseInt(stored) : -1;
  } catch { return -1; }
}

function setPrevDelay(trainId: string, delay: number) {
  try {
    localStorage.setItem(`rr24_prev_delay_${trainId}`, String(delay));
  } catch {}
}

export function DelayAlerts({ journey }: DelayAlertsProps) {
  const [subscribed, setSubscribedState] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [lastAlert, setLastAlert] = useState<string | null>(null);

  useEffect(() => {
    setSubscribedState(getSubscribed(journey.trainId));
    if ('Notification' in window) {
      setPermissionState(Notification.permission);
    }
  }, [journey.trainId]);

  // Check for delay changes on every journey update
  useEffect(() => {
    if (!subscribed) return;
    const prevDelay = getPrevDelay(journey.trainId);
    const currDelay = journey.delayMinutes;

    if (prevDelay >= 0) {
      const delta = Math.abs(currDelay - prevDelay);
      if (delta >= DELAY_THRESHOLD) {
        const msg = currDelay > prevDelay
          ? `🔴 ${journey.name} delay increased to ${currDelay} minutes`
          : `🟢 ${journey.name} recovered — now ${currDelay <= 0 ? 'On Time' : `${currDelay}m late`}`;

        setLastAlert(msg);

        if (permissionState === 'granted' && 'Notification' in window) {
          new Notification('RailRadar24 — Delay Update', {
            body: msg,
            icon: '/favicon.ico',
          });
        }
      }
    }
    setPrevDelay(journey.trainId, currDelay);
  }, [journey.delayMinutes, journey.trainId, journey.name, subscribed, permissionState]);

  const handleToggle = async () => {
    if (!subscribed) {
      // Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        setPermissionState(perm);
      }
      setSubscribedState(true);
      setSubscribed(journey.trainId, true);
      setPrevDelay(journey.trainId, journey.delayMinutes);
    } else {
      setSubscribedState(false);
      setSubscribed(journey.trainId, false);
      setLastAlert(null);
    }
  };

  return (
    <div className="space-y-3">
      <button
        onClick={handleToggle}
        className={cn(
          'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all w-full justify-center',
          subscribed
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
            : 'bg-rail-blue/10 text-rail-blue border border-rail-blue/20 hover:bg-rail-blue/20'
        )}
      >
        {subscribed ? (
          <>
            <BellOff className="h-4 w-4" />
            Alerts Active — Click to Disable
          </>
        ) : (
          <>
            <Bell className="h-4 w-4" />
            Alert me on delay change (≥{DELAY_THRESHOLD}m)
          </>
        )}
      </button>

      {subscribed && permissionState === 'denied' && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          Notifications blocked. Enable in browser settings for push alerts.
        </div>
      )}

      {lastAlert && (
        <div className="flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-900 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
          <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
          {lastAlert}
        </div>
      )}
    </div>
  );
}
