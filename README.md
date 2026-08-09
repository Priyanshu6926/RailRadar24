# 🚆 RailRadar24 — Live Indian Railways Intelligence Platform

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![MapLibre GL](https://img.shields.io/badge/MapLibre_GL-4.5-red?style=for-the-badge&logo=mapbox)](https://maplibre.org/)
[![RailRadar API](https://img.shields.io/badge/RailRadar_API-v1-0284c7?style=for-the-badge)](https://railradar.in/docs)
[![Render](https://img.shields.io/badge/Render-Deployed-46E3B7?style=for-the-badge&logo=render)](https://render.com)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=for-the-badge&logo=vercel)](https://vercel.com)

**RailRadar24** is a next-generation real-time Indian Railways tracking platform built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, and **MapLibre GL**. It transforms raw train data into rich, actionable travel intelligence including live map tracking, section speed analytics, dynamic terrain insights, coach composition, platform guidance, and push notifications.

---

## ✨ Features Overview

### 🛰️ Live Geo-Tracking & Vector Map
* **Interactive Vector Maps:** Powered by **MapLibre GL** and **MapTiler** vector tiles with custom dark/glassmorphic map themes.
* **Smooth Interpolation:** Calculates exact train latitude/longitude along polyline route geometry between stations.
* **Live Status Badges:** Instant status indicators (Running, On Time, Delayed, Cancelled, Not Started).

### 🚉 Smart Station Route Timeline
* **Halt vs Non-Halt Split:** Shows official halt stations prominently while intermediate passing-through stations are neatly organized into collapsible dropdown accordions (*"N passing stations"*).
* **Live Station Highlight:** Pulsing radar marker highlighting the current live location of the train.
* **Platform & Delay Chips:** Per-station platform numbers and color-coded delay indicators (`+15m late`, `On time`).

### 📊 Per-Section Running Analytics
* **Punctuality Score Ring:** Dynamic 0–100% punctuality score based on schedule deviation.
* **Section Speed Breakdown (km/h):** Computes actual average speed between consecutive halt stations.
* **Delay Gain / Recovery Heatmap:** Visual bar chart highlighting sections where the train accumulated delay (red) or recovered lost time (green).
* **Speed Metrics:** Tracks average speed, maximum section speed, and overall duration metrics.

### 🚃 Real-Time Coach Composition
* **Visual Rake Diagram:** Horizontal scrollable rake visualization generated directly from RailRadar's live `coachPosition` payload.
* **Color-Coded Coach Types:** Distinct badges for Locomotive (Loco), EOG/Guard, Sleeper (SL), AC 3-Tier (3A), AC 2-Tier (2A), AC First Class (1A), Pantry Car (PC), General (GEN), and HCP.
* **Class Summary Chips:** Quick breakdown of total coach counts per class type.

### 📍 Next Platform & Crowd Intelligence
* **Expected Platform Finder:** Prominent display of the upcoming halt station, platform number, scheduled arrival time, and estimated stop duration.
* **Crowd Level Indicator:** Heuristic-based platform crowd prediction (Low / Moderate / High) derived from train category and time-of-day peak hours.

### ⛰️ Dynamic Terrain & Elevation Profiles
* **Geographic Feature Discovery:** Uses **Overpass API (OpenStreetMap)** with per-station corridor queries to discover rivers, bridges, tunnels, mountain peaks, and cities along the route.
* **SRTM Elevation Profiles:** Powered by **OpenTopography API** to render an elevation curve across the journey route.

### 🔔 Delay Alert Subscriptions
* **Browser Push Notifications:** Subscribe to a train to receive browser notifications whenever the delay changes by $\ge 10$ minutes.
* **Local Storage Persistence:** Subscriptions persist across user sessions without requiring authentication.

### 🎴 Shareable Journey Report Card
* **Designed Report Card:** Generates a visually stunning card summarizing train route, completion percentage, delay status, and distance covered.
* **PNG Download & Web Share:** Download as a high-res image directly from the browser (using native HTML Canvas) or share via Web Share API.

### 🌤️ Live Station Weather Intelligence
* Real-time temperature, weather conditions, humidity, and wind speed at key stations along the train route powered by **OpenWeatherMap API**.

---

## 🛠️ Tech Stack & Architecture

| Layer | Technology |
|---|---|
| **Framework** | Next.js 14 (App Router, Server Components & API Routes) |
| **Language** | TypeScript (Strict type checking) |
| **Styling** | Tailwind CSS, Glassmorphism, CSS Variables, Framer Motion |
| **Mapping** | MapLibre GL JS, MapTiler Vector Tiles |
| **State & Data Fetching** | TanStack React Query v5, Zustand, In-Memory Caching |
| **External APIs** | RailRadar API, OpenStreetMap Overpass QL, OpenTopography API, OpenWeatherMap API |

---

## 📁 Project Structure

```
RailRadar24/
├── app/
│   ├── api/
│   │   ├── analytics/[id]/     # Journey analytics & delay history endpoint
│   │   ├── coach/[id]/         # Coach composition parser endpoint
│   │   ├── terrain/            # Per-station Overpass POI endpoint
│   │   ├── train/[id]/         # RailRadar live status proxy endpoint
│   │   ├── train-history/[id]/ # Section speed & running analytics endpoint
│   │   └── weather/            # OpenWeather station weather endpoint
│   ├── train/[id]/page.tsx     # Main train detail page (5 tab modules)
│   ├── layout.tsx              # Root layout & PWA metadata
│   └── page.tsx                # Homepage search & train lookup
├── components/
│   ├── journey/
│   │   ├── JourneyCard.tsx     # Hero journey status card
│   │   └── Timeline.tsx        # Smart halt/non-halt station timeline
│   └── layout/
│       ├── Navbar.tsx          # Glassmorphic header with RailRadar24 branding
│       └── BottomNav.tsx       # Mobile bottom navigation bar
├── features/
│   ├── alerts/                 # Delay alert notifications module
│   ├── analytics/              # Running analytics & elevation profile modules
│   ├── coach/                  # Coach composition rake visualizer module
│   ├── maps/                   # MapLibre GL interactive map component
│   ├── platform/               # Next platform & crowd indicator module
│   ├── share/                  # Downloadable journey report card module
│   ├── terrain/                # Overpass terrain cards & panel module
│   └── weather/                # Weather panel component
├── lib/
│   ├── cache.ts                # In-memory server-side response cache
│   ├── opentopography.ts       # OpenTopography SRTM elevation fetcher
│   ├── openweather.ts          # OpenWeather API integration
│   ├── overpass.ts             # Batched per-station Overpass QL fetcher
│   └── railradar.ts            # RailRadar API wrapper & route normaliser
├── types/
│   ├── api.ts                  # API response types
│   └── train.ts                # LiveJourney, Station, Location types
└── utils/                      # Helper utilities (cn, formatters)
```

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: `v18.x` or higher
* **npm**: `v9.x` or higher

### Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Priyanshu6926/RailRadar24.git
   cd RailRadar24
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Open `.env.local` and add your API keys:
   ```env
   RAILRADAR_API_KEY=your_railradar_api_key
   NEXT_PUBLIC_MAPTILER_API_KEY=your_maptiler_api_key
   OPENWEATHER_API_KEY=your_openweather_api_key
   OPENTOPOGRAPHY_API_KEY=your_opentopography_api_key
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser to view the app.

5. **Build for Production:**
   ```bash
   npm run build
   npm start
   ```

---

## 🌐 Hosting & Deployment

### Option A: Render (Web Service)
1. Sign in to **[Render](https://dashboard.render.com)** with your GitHub account.
2. Click **New +** $\rightarrow$ **Web Service** and connect `Priyanshu6926/RailRadar24`.
3. Set the following options:
   * **Runtime:** `Node`
   * **Build Command:** `npm install && npm run build`
   * **Start Command:** `npm start`
4. Add Environment Variables (`RAILRADAR_API_KEY`, `NEXT_PUBLIC_MAPTILER_API_KEY`, `OPENWEATHER_API_KEY`, `OPENTOPOGRAPHY_API_KEY`, `NODE_VERSION=20.14.0`).
5. Click **Create Web Service**.

### Option B: Vercel
1. Import `Priyanshu6926/RailRadar24` at **[Vercel](https://vercel.com)**.
2. Configure Environment Variables in settings.
3. Click **Deploy**.

---

## 🔑 Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `RAILRADAR_API_KEY` | **Yes** | Server-side key for RailRadar API live train tracking |
| `NEXT_PUBLIC_MAPTILER_API_KEY` | **Yes** | Public key for MapTiler vector map tile layer |
| `OPENWEATHER_API_KEY` | **Yes** | Server-side key for station weather forecasts |
| `OPENTOPOGRAPHY_API_KEY` | Optional | Key for high-resolution SRTM elevation profiles |
| `UPSTASH_REDIS_REST_URL` | Optional | Upstash Redis REST URL for distributed caching |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Upstash Redis REST token |

---

## 👨‍💻 Author

Built with ❤️ by **[Priyanshu](https://github.com/Priyanshu6926)**

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
