# 🚆 RailRadar24 — Live Indian Railways Intelligence Platform

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![MapLibre GL](https://img.shields.io/badge/MapLibre_GL-4.5-red?style=for-the-badge&logo=mapbox)](https://maplibre.org/)
[![RailRadar API](https://img.shields.io/badge/RailRadar_API-v1-0284c7?style=for-the-badge)](https://railradar.in/docs)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

**RailRadar24** is a modern, real-time Indian Railways tracking platform built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, and **MapLibre GL**. It converts live API feeds into actionable travel intelligence — including vector map tracking, section speed analytics, live coach rake composition, platform crowd predictions, and delay alerts.

---

## ⚡ Technical Highlights (For Recruiters & Engineers)

* **Spatial API Optimization:** Implemented batched OpenStreetMap Overpass QL corridor queries ($\pm 0.2^\circ$ per station) to eliminate 406 payload limit errors across 1,400+ km train routes.
* **Geospatial Polyline Interpolation:** Real-time train position calculation along vector polyline geometries with live speed, heading, and distance-covered tracking.
* **Sectional Speed & Delay Loss Algorithm:** Computes sectional average speeds (km/h) and sectional delay gain/loss metrics between consecutive halt stations.
* **Zero-Dependency Canvas Engine:** Built a native HTML5 Canvas card renderer for shareable journey cards without bloated external image generation libraries.
* **Smart UI Architecture:** Responsive glassmorphic layout, dynamic tab routing, TanStack Query v5 state management, and server-side in-memory caching.

---

## ✨ Core Features

| Feature | Description |
|---|---|
| 🛰️ **Live Map Tracking** | Interactive MapLibre GL vector map with dynamic train markers & route polylines. |
| 🚉 **Smart Route Timeline** | Displays official halt stations while collapsing 200+ passing stations into expandable accordions. |
| 📊 **Section Speed Analytics** | Punctuality score ring (0–100%), section speeds (km/h), and delay loss/gain heatmaps. |
| 🚃 **Coach Composition** | Visual rake diagram rendering coach orders (Loco, EOG, SL, 3A, 2A, 1A, PC, HCP) from live API data. |
| 📍 **Platform & Crowd Finder** | Next station platform numbers, stop duration, and peak-hour crowd level predictions. |
| ⛰️ **Terrain & Elevation** | Discovers rivers, bridges, peaks, and cities along the route with OpenTopography SRTM profiles. |
| 🔔 **Delay Alert Push** | Browser push notification system alerting users on $\ge 10$-minute delay changes. |
| 🎴 **Journey Report Card** | Designed shareable status cards with direct PNG download and Web Share integration. |

---

## 💡 Key Takeaways (For Students & Developers)

If you are exploring this codebase to learn, here are the key concepts implemented:
1. **Next.js 14 App Router Architecture:** Server Components, Client Components (`'use client'`), and API Route Handlers (`app/api/`).
2. **External API Aggregation:** Interacting with multiple REST APIs (RailRadar, OpenWeather, OpenTopography, Overpass QL) through server-side proxy routes.
3. **MapLibre GL Integration:** Custom map styling, vector tiles, polyline rendering, and reactive marker updates.
4. **Zustand & Persistent State:** Managing application state (favorites, recent searches) synced with `localStorage`.

---

## 🛠️ Tech Stack

```
Frontend:  Next.js 14 (App Router) • React 18 • TypeScript • Tailwind CSS • Framer Motion
Mapping:   MapLibre GL JS • MapTiler Vector Tiles
State:     TanStack React Query v5 • Zustand
APIs:      RailRadar API • OpenStreetMap Overpass API • OpenTopography API • OpenWeatherMap API
```

---

## 📁 Project Structure

```
RailRadar24/
├── app/
│   ├── api/                    # Server-side API proxy routes (train, analytics, coach, terrain, weather)
│   ├── train/[id]/page.tsx     # Main train tracking detail page (5 tab modules)
│   └── page.tsx                # Homepage search & train lookup
├── components/                 # Reusable UI components (Navbar, Timeline, JourneyCard)
├── features/                   # Domain features (maps, analytics, coach, platform, terrain, alerts, share)
├── lib/                        # API wrappers, cache management, Overpass QL querier
├── store/                      # Zustand state stores (favorites, search, journey)
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

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Hosting & Deployment

* **Vercel (Recommended):** Import `Priyanshu6926/RailRadar24` on Vercel, add Environment Variables, and click **Deploy**.
* **Render (Web Service):** Connect repository, set Build Command to `npm install && npm run build`, Start Command to `npm start`, add Environment Variables, and deploy.

---

## 🔑 Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `RAILRADAR_API_KEY` | **Yes** | Server-side key for RailRadar live tracking API |
| `NEXT_PUBLIC_MAPTILER_API_KEY` | **Yes** | Public key for MapTiler vector map layer |
| `OPENWEATHER_API_KEY` | **Yes** | Server-side key for station weather forecasts |
| `OPENTOPOGRAPHY_API_KEY` | Optional | Key for SRTM elevation profile data |

---

## 👨‍💻 Author

Built with ❤️ by **[Priyanshu](https://github.com/Priyanshu6926)**

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
