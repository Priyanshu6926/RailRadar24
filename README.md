# 🚆 RailRadar24 — Live Indian Railways Intelligence Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![MapLibre GL](https://img.shields.io/badge/MapLibre_GL-4.5-red?style=for-the-badge&logo=mapbox)](https://maplibre.org/)
[![Vitest](https://img.shields.io/badge/Tested_with-Vitest-yellow?style=for-the-badge&logo=vitest)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

**RailRadar24** is a high-performance, real-time Indian Railways tracking platform built with **Next.js 16 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS**, and **MapLibre GL**. It converts live timetable and telemetry feeds into actionable travel intelligence — including vector map tracking, section speed analytics, live coach rake diagrams, station weather, and PNR confirmation forecasting.

---

## ⚡ Technical Highlights (For Engineers & Reviewers)

* **Spatial API Optimization:** Implemented batched OpenStreetMap Overpass QL corridor queries ($\pm 0.2^\circ$ per station) with retry backoffs and deduplication to eliminate payload limits across 1,400+ km train routes.
* **Geospatial Polyline & Bearing Calculation:** Real-time train position interpolation along route polylines using the WGS84 Haversine formula ($R = 6371.0088\text{ km}$), computing exact forward bearings (0–360°).
* **Sectional Speed & Delay Analytics:** Derives section average speeds (km/h) and delay gain/loss metrics between consecutive halt stations with midnight-crossing normalization.
* **SRTM 30m Real Elevation Profiles:** Integrated OpenTopoData SRTM 30m batch elevation API with 24-hour route caching to render genuine elevation profiles across railway corridors.
* **Resilient Architecture:** Server-side proxy routing with LRU/FIFO in-memory caching, client-safe Zustand hydration, `AbortController` cancellation across all polling effects, and App Router error boundaries.
* **Native Canvas Engine:** Zero-dependency HTML5 Canvas card renderer for high-resolution shareable journey status cards.

---

## ✨ Core Features

| Feature | Description |
|---|---|
| 🛰️ **Live Map Tracking** | Interactive MapLibre GL vector map with dynamic train markers, bearing headings & route polylines. |
| 🚉 **Smart Route Timeline** | Displays official halt stations with live delays while collapsing intermediate passing stations. |
| 📊 **Section Speed Analytics** | Punctuality score ring (0–100%), verified section speeds (km/h), and delay loss/gain heatmaps. |
| 🚃 **Coach Composition** | Visual rake diagram rendering coach orders (Loco, EOG, SL, 3A, 2A, 1A, PC, HCP) from live API data. |
| 📍 **Platform & Crowd Heuristics** | Platform numbers, stop durations, and time-of-day crowd density heuristics. |
| ⛰️ **Terrain & Elevation** | Discovers rivers, bridges, peaks, and tunnels via Overpass QL, paired with SRTM elevation profiles. |
| 🎫 **PNR Status & Forecast** | Waitlist confirmation probability bands, seat allocation status, and itemized refund calculations. |
| 🎴 **Journey Report Card** | Shareable status cards with direct PNG download and Web Share API integration. |

---

## 🛠️ Tech Stack

```
Frontend:    Next.js 16 (App Router) • React 19 • TypeScript • Tailwind CSS • Framer Motion
Mapping:     MapLibre GL JS • MapTiler Vector Tiles
State:       TanStack React Query v5 • Zustand (Hydration Safe)
APIs:        RailRadar API • OSM Overpass API • OpenTopoData SRTM • OpenWeatherMap API
Testing:     Vitest • ESLint 9 Flat Config • GitHub Actions CI
```

---

## 📁 Project Structure

```
RailRadar24/
├── app/
│   ├── api/                    # Server-side API proxy routes (train, analytics, coach, terrain, weather, health)
│   ├── train/[id]/page.tsx     # Main train tracking detail page
│   ├── pnr/page.tsx            # PNR status & prediction view
│   ├── planner/page.tsx        # Inter-city journey planner
│   ├── stations/page.tsx       # Live station departure/arrival board
│   └── page.tsx                # Homepage search & quick lookups
├── components/                 # Reusable UI components (Navbar, Timeline, JourneyCard, Search)
├── features/                   # Domain features (maps, analytics, coach, platform, terrain, share)
├── lib/                        # API clients, geo math (haversine, bearing), elevation, cache
├── store/                      # Zustand state stores (favorites, search, journey)
├── __tests__/                  # Unit tests for core algorithms
└── types/                      # TypeScript definitions (train, API models)
```

---

## 🚀 Quickstart

### 1. Clone & Install
```bash
git clone https://github.com/Priyanshu6926/RailRadar24.git
cd RailRadar24
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Add your API keys in `.env.local`:
```env
RAILRADAR_API_KEY=your_railradar_api_key
NEXT_PUBLIC_MAPTILER_API_KEY=your_maptiler_api_key
OPENWEATHER_API_KEY=your_openweather_api_key
OPENTOPOGRAPHY_API_KEY=your_opentopography_api_key
```

### 3. Run Development Server & Tests
```bash
# Run unit tests
npm test

# Run type check & linter
npx tsc --noEmit
npm run lint

# Start Next.js dev server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Hosting & Deployment

* **Render (Recommended):** Deploy as a Node Web Service using the provided [`render.yaml`](render.yaml) blueprint:
  * **Build Command:** `npm ci --include=dev && npm run build`
  * **Start Command:** `npm run start`
  * **Health Check Path:** `/api/health`

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
