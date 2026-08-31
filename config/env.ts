export const env = {
  // RailRadar — server-side only
  RAILRADAR_API_KEY: process.env.RAILRADAR_API_KEY || '',
  RAILRADAR_BASE_URL: 'https://api.railradar.in/v1',

  // MapTiler — public (safe to expose)
  MAPTILER_API_KEY: process.env.NEXT_PUBLIC_MAPTILER_API_KEY || '',

  // OpenWeather — server-side only
  OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY || '',

  // OpenTopography / OpenTopoData — server-side only
  OPENTOPOGRAPHY_API_KEY: process.env.OPENTOPOGRAPHY_API_KEY || '',

  // Site URL
  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://railradar24.onrender.com',
};

// Client-safe config — only include NEXT_PUBLIC_ variables here
export const clientEnv = {
  MAPTILER_API_KEY: process.env.NEXT_PUBLIC_MAPTILER_API_KEY || '',
  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://railradar24.onrender.com',
};
