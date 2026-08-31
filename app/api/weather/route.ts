import { NextRequest } from 'next/server';
import { getWeatherForLocation, WeatherData } from '@/lib/openweather';
import { getCached, setCached } from '@/lib/cache';
import { jsonOk, jsonFail } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');
  const name = searchParams.get('name') || '';
  const code = searchParams.get('code') || '';

  if (!latStr || !lngStr) {
    return jsonFail('lat and lng parameters are required', 400);
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (!Number.isFinite(lat) || Math.abs(lat) > 90) {
    return jsonFail('Invalid latitude', 400);
  }
  if (!Number.isFinite(lng) || Math.abs(lng) > 180) {
    return jsonFail('Invalid longitude', 400);
  }

  const cacheKey = `weather:${lat.toFixed(2)}:${lng.toFixed(2)}`;
  const cached = getCached<WeatherData>(cacheKey);
  if (cached) {
    return jsonOk(cached, true, 200, 'live');
  }

  try {
    const weather = await getWeatherForLocation(lat, lng, name, code);
    setCached(cacheKey, weather, 900); // 15 min cache

    return jsonOk(weather, false, 200, 'live');
  } catch (err: any) {
    console.error('[api/weather]', err);
    return jsonFail('Weather request failed', 500);
  }
}

