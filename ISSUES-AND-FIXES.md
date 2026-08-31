# RailRadar24 — Senior Code Review: Issues & Fixes

**Reviewed:** 1 September 2026 · **Commit state:** working tree at review time
**Scope:** 79 modules, 17 API route handlers, 44 components. Every line reference below was read from source, not inferred.
**Audience:** an autonomous coding agent (Antigravity) plus the repo owner.

---

## HOW TO USE THIS DOCUMENT (read this first, agent)

Work through the phases **in order**. Phases are ordered by consequence, not by effort — Phase 0 changes what a visitor to the deployed site actually sees, Phase 1 removes the things that would cost the author a job offer, and Phases 2–4 are engineering quality.

Rules for this repo:

1. **Never invent data to fill a gap.** If an upstream API fails, the correct behaviour is an explicit "unavailable" state, not a plausible-looking number. Roughly half the issues in this document exist because that rule was broken. Do not fix a missing value by making one up.
2. **One phase per commit**, with the issue IDs in the commit message (e.g. `fix(api): R-01..R-04 collapse duplicate upstream calls`).
3. **After every phase run `npx tsc --noEmit`.** It currently exits 0 — keep it that way. Do not silence type errors with `any` or `@ts-ignore`.
4. **Do not "fix" `next@16.3.3` by downgrading Next.** See R-30 for why; the correct direction is upgrading React.
5. **Do not delete the genuinely good code.** `lib/overpass.ts` (batched bounding-box queries), `interpolatePolyline` in `lib/railradar.ts`, the section-wise speed maths in `app/api/train-history`, and the MapLibre lifecycle in `MapView.tsx` are the strongest work in the repo. They need fixes, not removal.
6. Each issue has an **Accept:** line. Treat it as the definition of done.

---

## THE SHORT VERSION

If you read nothing else, read this.

**The deployed app is currently serving fabricated train data to visitors, and it takes about twelve minutes for that to become the permanent state.**

Here is the chain, and every link is verified:

- One train page view fires **five** independent API routes (`train`, `analytics`, `coach`, `train-history`, `terrain`), and each one independently calls `getLiveJourney`, which costs **2** upstream RailRadar requests. That is **10 upstream calls for one page view.**
- The client then polls every 30 seconds (`hooks/useLiveJourney.ts:24`), which is **240 upstream calls per hour** from a single open browser tab.
- Against a **50-request-per-day** quota, one tab left open exhausts the entire day in roughly twelve minutes.
- When the quota is gone, `lib/railradar.ts:516` returns `generateFallbackJourney()` — hardcoded Mumbai→Delhi data, Kota Junction, 110 km/h, 8 minutes late, 66.5% complete — **for any train number the visitor types**.
- Every route handler returns that with `success: true` and no marker distinguishing it from real data (`types/api.ts:1-7`), so the UI labels it "Live Speed" with a pulsing green dot.

So the failure mode is not an outage. It is **confident, plausible, undetectable fiction** — which is strictly worse, because nobody can tell it is happening.

Three fixes break that chain, and they are the entire content of Phase 0:

| Fix | Effect |
|---|---|
| Collapse the 5 duplicate `getLiveJourney` calls behind one cached accessor | First page view drops from **10 upstream calls to 2** |
| Slow the poll and stop refetch-on-focus | Sustained cost drops from **240/hour to ~30/hour** |
| Add a `source` field to every API response and return an error instead of fiction on 429/5xx | Failure becomes **visible** instead of fabricated |

Everything after Phase 0 matters, but nothing after Phase 0 matters as much as those three.

---

## PHASE OVERVIEW

| Phase | Theme | Issues | Why now |
|---|---|---|---|
| **0** | Deployment integrity | R-01 … R-08 | The live site currently misleads visitors and can be knocked over by one loop |
| **1** | Data honesty | R-09 … R-19 | These are what lose you an offer when an interviewer opens the repo |
| **2** | Correctness bugs | R-20 … R-32 | Real bugs: crashes, leaks, wrong maths, hydration mismatches |
| **3** | Performance | R-33 … R-37 | Wasted work on a 30-second poll loop |
| **4** | Deployment, docs, a11y | R-38 … R-47 | Reproducibility, docs that match reality, accessibility, CI |

47 issues total: 20 must-fix (P0), 17 should-fix (P1), 10 polish (P2).

---

# PHASE 0 — Deployment integrity

Do all eight of these before showing the link to anyone.

---

### R-01 · P0 · Five routes each independently fetch the same journey

**Where:** `app/api/train/[id]/route.ts`, `app/api/analytics/[id]/route.ts`, `app/api/coach/[id]/route.ts`, `app/api/train-history/[id]/route.ts`, `app/api/terrain/route.ts` — all call `getLiveJourney` (`lib/railradar.ts:509`), which itself issues two upstream requests in a `Promise.all` (`/live` + `/route`).

**What:** Opening one train page triggers five route handlers, each doing its own upstream fetch pair. Ten upstream requests for one page view, against a 50/day quota. Each route caches its *own* result, so the five caches never share the underlying journey.

**Why it matters:** This single issue consumes 20% of the daily quota per page view, and it is the root cause of the fabricated-data problem in R-03. Fixing it is the highest-leverage change in this document.

**Fix:** Introduce one cached accessor that all five routes share, so the journey is fetched at most once per TTL regardless of how many routes want it.

```ts
// lib/journey.ts  (new file)
import { getCached, setCached } from './cache';
import { getLiveJourney } from './railradar';

export async function getJourneyCached(trainId: string) {
  const key = `journey:${trainId}`;
  const hit = getCached<Awaited<ReturnType<typeof getLiveJourney>>>(key);
  if (hit) return hit;
  const fresh = await getLiveJourney(trainId);
  if (fresh) setCached(key, fresh, 60);   // one upstream pair per minute, per train
  return fresh;
}
```

Then replace every `getLiveJourney(trainId)` call inside `app/api/**/route.ts` with `getJourneyCached(trainId)`. Leave `lib/railradar.ts` itself untouched.

Additionally, split the route geometry out: the `/route` half of the pair returns the station list and polyline, which **do not change during a journey**. Cache that on its own key with a 24-hour TTL so the recurring cost is one upstream call, not two.

**Accept:** Instrument `rrFetch` with a `console.count('rr-upstream')` temporarily, load a train page cold, and confirm the count is **2**, not 10. Remove the instrumentation afterwards.

---

### R-02 · P0 · Poll interval and refetch-on-focus burn the quota

**Where:** `hooks/useLiveJourney.ts:20-26` and `providers/query-provider.tsx:12-13`

**What:** `refetchInterval: 30 * 1000` on the journey query, plus a global `refetchOnWindowFocus: true` with `staleTime: 25 * 1000`. Every tab refocus more than 10 seconds after the last fetch triggers a fresh uncached upstream call. There is also no `retry` config, so TanStack Query's default `retry: 3` applies — and `fetchLiveJourney` throws on `success: false`, which includes quota-exhausted responses, so each failure costs four more calls.

**Why it matters:** 240 upstream calls per hour from one idle tab. Fifty alt-tabs exhausts the day with no user action at all. Retrying a quota error three times is the worst possible response to a quota error.

**Fix:** Three changes.

```ts
// hooks/useLiveJourney.ts
refetchInterval: 120_000,
refetchIntervalInBackground: false,
retry: (n, e) => n < 2 && !/QUOTA_EXCEEDED|TOO_MANY_REQUESTS|404/.test((e as Error).message),
retryDelay: 2000,
```

```ts
// providers/query-provider.tsx
refetchOnWindowFocus: false,
```

Note: the background-polling half is already correct — `refetchIntervalInBackground` defaults to `false`, so the interval already pauses on a blurred tab. Setting it explicitly documents the intent.

**Accept:** Open a train page, switch tabs ten times over two minutes, and confirm the network panel shows no new `/api/train/` requests on focus.

---

### R-03 · P0 · Fabricated data is returned as `success: true` with no marker

**Where:** `types/api.ts:1-7` (the envelope), `lib/railradar.ts:516-519` (the fallback), and all 17 route handlers.

**What:** `ApiResponse<T>` carries only `success | data | error | timestamp | cached`. There is no field distinguishing real upstream data from a hardcoded fixture. On any non-404 upstream failure — including HTTP 429 quota-exceeded — `getLiveJourney` returns `generateFallbackJourney(trainNumber)`, hardcoded Mumbai→Delhi data served for *any* train number, with `success: true`. `app/api/occupancy/[id]/route.ts:187` even returns `success: true` from inside its `catch` block.

**Why it matters:** This is the keystone issue. Every overstated label elsewhere in the app — "Live Speed", "Real-time PRS availability", "Official Indian Railways fare" — is only possible because the client has no way to know the data is synthetic. Fix this and the rest of Phase 1 becomes mechanical.

**Fix:** Two parts, in this order.

First, make provenance a required part of the contract:

```ts
// types/api.ts
export type DataSource = 'live' | 'fallback' | 'synthetic';

export interface ApiResponse<T> {
  success: boolean;
  source: DataSource;        // required — not optional
  data?: T;
  error?: string;
  timestamp: string;
  cached?: boolean;
}
```

Making it required is deliberate: `tsc` will now walk you to all 17 return sites. Set `'live'` only when the upstream call genuinely succeeded.

Second, stop manufacturing a journey on failure. In `lib/railradar.ts:516-519`, return `null` on 429 and 5xx and let the route return `success: false`. Keep `generateFallbackJourney` for local development only:

```ts
if (process.env.NODE_ENV === 'development') return generateFallbackJourney(trainNumber);
return null;
```

**Accept:** Temporarily set `RAILRADAR_API_KEY` to an invalid value, load a train page, and confirm the UI shows an explicit "live data unavailable" state — not a Mumbai→Delhi journey for a train that does not run that route.

---

### R-04 · P0 · Unbounded cache Map is a one-line remote DoS

**Where:** `lib/cache.ts:7` and `:19-24`

**What:** A module-level `Map` with no size cap, no LRU, and no periodic sweep. The only `delete` is lazy, inside `getCached`, and only for the key being read — an expired entry whose key is never requested again lives for the process lifetime. `setCached` only inserts.

**Why it matters:** Cache keys embed unvalidated user input. `app/api/search/route.ts:11` builds `` `search:${query.toLowerCase().trim()}` `` with no length or cardinality limit, and `app/api/stations/[code]/live/route.ts:23` includes an unbounded `hours` param. So `GET /api/search?query=<random>` in a loop grows the Map until the Render instance runs out of memory. Unauthenticated, one line of `curl`, no rate limit in the way.

**Fix:** Cap the map and evict oldest-first on insert. FIFO is sufficient here; LRU is not worth the complexity for a single instance.

```ts
const MAX_ENTRIES = 500;

export function setCached<T>(key: string, value: T, ttlSeconds: number): void {
  if (memoryCache.size >= MAX_ENTRIES) {
    const oldest = memoryCache.keys().next().value;
    if (oldest !== undefined) memoryCache.delete(oldest);
  }
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}
```

Also bound the search key itself — truncate the query to 40 characters before using it as a key.

**Accept:** Loop 2,000 distinct `/api/search?query=` values and confirm via a temporary `console.log(memoryCache.size)` that the map plateaus at 500.

---

### R-05 · P0 · No rate limiting on any of the 17 public routes

**Where:** No `middleware.ts` exists. Zero matches repo-wide for `ratelimit`, `rate-limit`, or `throttle`.

**What:** Every `/api/*` route is public, unauthenticated and unthrottled, while proxying a third-party API with a 50/day quota and holding your bearer token.

**Why it matters:** Anyone who opens the network tab sees `/api/train/12951`. Looping it with distinct train numbers defeats the per-train cache and burns the quota in seconds. Combined with R-03, the app then serves fabricated data to every subsequent visitor, indefinitely, with no alert to you.

**Fix:** An in-process IP token bucket is the right scope for a single Render instance — do not reach for Redis.

```ts
// middleware.ts  (new file, repo root)
import { NextRequest, NextResponse } from 'next/server';

const WINDOW_MS = 60_000, LIMIT = 30;
const buckets = new Map<string, { count: number; resetAt: number }>();

export function middleware(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now > b.resetAt) buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  else if (++b.count > LIMIT)
    return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });
  if (buckets.size > 5_000) buckets.clear();          // crude but bounded
  return NextResponse.next();
}

export const config = { matcher: ['/api/:path*'] };
```

**Accept:** Fire 40 requests in under a minute from one client; requests 31 onward return HTTP 429.

---

### R-06 · P0 · SSRF via the `Host` header in the occupancy route

**Where:** `app/api/occupancy/[id]/route.ts:164-167`

**What:** The handler fetches its own API over HTTP using `` `${request.nextUrl.origin}/api/train/${trainId}` ``. `origin` is derived from the client-controlled `Host` header, and `trainId` is interpolated unencoded.

**Why it matters:** A forged `Host` header makes your server issue an outbound request to a host the attacker chooses. Render does not filter `Host` for you. It is also needlessly slow — a full network round-trip to reach a function already in the same process.

**Fix:** Do not self-fetch. Import the accessor from R-01 and call it in-process, the way four other routes already do:

```ts
import { getJourneyCached } from '@/lib/journey';
const journey = await getJourneyCached(trainId);
```

**Accept:** `grep -rn "nextUrl.origin" app/` returns nothing.

---

### R-07 · P0 · Path and query params reach upstream URLs unvalidated

**Where:** `lib/railradar.ts:510` and the same pattern at `:341`, `:568`, `:659`, `:690`, `:723`, `:822`, `:916`, `:1049`, `:1148`. Also `app/api/stations/[code]/live/route.ts:14` (`hours`) and `app/api/weather/route.ts:8-9` (`lat`/`lng`).

**What:** Params are interpolated into upstream URLs with no format validation or encoding — e.g. `` `${RR_BASE}/trains/${trainNumber}/live` ``. Next.js URL-decodes dynamic params, so `%2e%2e%2f` arrives as `../` and `fetch` normalises it away, letting a caller reach arbitrary upstream paths **with your bearer token attached**. `hours` is an unbounded `parseInt` (so `hours=999999` and `hours=NaN` both pass) and is also a cache key component, amplifying R-04. `lat`/`lng` use `parseFloat` behind only a falsy check, so `Infinity` passes.

**Why it matters:** Your API key gets spent on requests you did not author, against endpoints you did not intend to call.

**Fix:** Guard at the route boundary, before any upstream call. The three PNR routes already do this correctly at `app/api/pnr/[pnr]/route.ts:12-18` — copy that pattern.

```ts
if (!/^\d{4,5}$/.test(trainId)) return jsonFail('Invalid train number', 400);
if (!/^[A-Z]{2,8}$/.test(code.toUpperCase())) return jsonFail('Invalid station code', 400);
const hours = Math.min(24, Math.max(1, Number(searchParams.get('hours')) || 4));
if (!Number.isFinite(lat) || Math.abs(lat) > 90) return jsonFail('Invalid latitude', 400);
```

Also validate the Overpass bbox inputs at `lib/overpass.ts:27-28`, where `lat`/`lng` are interpolated into the Overpass QL query body. This one is second-order — the coordinates come from upstream JSON typed `any` at `lib/railradar.ts:525`, so TypeScript's `number` annotation is erased at runtime and a non-numeric value would flow into the query string. Return `''` from `buildStationQuery` if either coordinate fails `Number.isFinite` or is out of range; this also fixes the `NaN` bbox case.

**Accept:** `curl` `/api/train/..%2f..%2fadmin` and confirm a 400, not an upstream call.

---

### R-08 · P0 · Fifteen handlers leak raw upstream error messages to the browser

**Where:** `app/api/train/[id]/route.ts:59`, `terrain/route.ts:75`, `weather/route.ts:43`, `analytics/[id]/route.ts:76`, `coach/[id]/route.ts:131`, `train-history/[id]/route.ts:206`, `seats/route.ts:45`, `fare/route.ts:43`, `planner/route.ts:42`, `search/stations/route.ts:20`, `stations/[code]/route.ts:43`, `stations/[code]/live/route.ts:46`, and the three `pnr/[pnr]/*` routes at `:43`.

**What:** Every catch block returns `err.message` verbatim to the client.

**Why it matters:** Node's `undici` fetch errors embed the full failing URL — `https://api.railradar.in/v1/...` — plus DNS and TLS internals, exposing your upstream topology and integration details to anyone who can trigger an error. Which, given R-07, is anyone.

**Fix:** `lib/api-response.ts` was written for exactly this and is imported by **zero files** — `jsonOk` at `:4` and `jsonFail` at `:16` are dead code. Start using them. Log detail server-side, return a fixed string to the client:

```ts
} catch (err) {
  console.error('[api/train]', err);
  return jsonFail('Could not load train data', 500);
}
```

**Accept:** `grep -rn "err.message\|error.message" app/api/` returns nothing, and `grep -rn "jsonFail" app/api/ | wc -l` returns at least 15.

---

# PHASE 1 — Data honesty

**Read this framing before making any change in this phase.**

Roughly a third of what the app displays is invented, and it is displayed with more confidence than real data usually earns. This is the part of the repo that can cost the author a job offer, because an interviewer who opens `lib/opentopography.ts` finds a sine wave sitting behind a claimed integration with a real scientific data source. That reads as fabrication, and it discredits the genuinely strong work elsewhere in the repo.

There is no single right answer for all of it, so treat these three categories differently:

**Delete or hard-label as simulated:** occupancy, seat availability, PNR confirmation probability, fare breakdown. These claim to be authoritative railway reservation data. No free API exists for any of them, so they cannot be made real. Keep the UI work — it is good — but rename the tab, add a visible banner, and set `source: 'synthetic'`.

**Fix properly:** the elevation profile. This one is worth real effort, because free point-elevation APIs exist that need no key, so a genuine integration is about twenty lines of work. That converts the single most damaging item in the repo into a legitimate one. Do this rather than labelling it.

**Relabel as a heuristic:** the crowd score. A heuristic based on time of day and train class is perfectly defensible *if it says so*. The problem is not the heuristic, it is presenting it as a percentage next to a live-radio icon — and having two different heuristics that disagree.

---

### R-09 · P0 · Occupancy figures come from a seeded LCG

**Where:** `app/api/occupancy/[id]/route.ts:71-72` — `const pseudo = (offset) => ((seed * 1103515245 + offset * 12345) & 0x7fffffff) / 0x7fffffff;` seeded from the train number, plus a time-of-day ladder at `:77`. Per-coach variance is synthesized separately at `features/occupancy/TrainOccupancy.tsx:135` with `Math.sin(i * 17 + cls.classCode.charCodeAt(0)) * 0.15`.

**What:** `fillPercent` (`:88`), `wlCount` (`:99`), `racCount` (`:100`) and `seatsOccupied` (`:95`) are all derived from the LCG.

**Why it matters:** `TrainOccupancy.tsx:257` labels the output "Passengers on board" with an exact count like "1,284 / 1,632", and `:121` renders "WL 37". These are invented reservation figures presented as fact, and the coach-level heatmap at `:144` gives per-coach tooltips like "B3 — 87% full", which implies a data granularity that does not exist anywhere in Indian Railways' public surface.

**Fix:** Set `source: 'synthetic'` on the response, rename the tab to "Occupancy (Simulated)", and render a dismissible banner at the top of `TrainOccupancy.tsx`: "Simulated demand model — not real PRS data." Remove the exact passenger counts at `:257` and the per-coach percentages at `:159`; keep only the coarse class-level bands, which is the most a heuristic can honestly support. Also fix `:187`, which returns `success: true` from a `catch` block.

**Accept:** No screen in the app shows a precise passenger count or WL number without an adjacent "Simulated" label.

---

### R-10 · P0 · Seat availability uses unseeded `Math.random()`

**Where:** `lib/railradar.ts:861` — `const seats = Math.floor(Math.random() * 80) + 10;` for days 5–14. Days 1–4 are hardcoded ladders at `:846-858` with `chance: 75 - idx * 10` and `chance: 95`.

**What:** The 14-day availability forecast is random. The same request returns different numbers on every call.

**Why it matters:** `features/seats/SeatAvailability.tsx:64` states "Real-time PRS seat availability & waitlist confirmation probabilities". Unseeded randomness behind the words "real-time PRS" is the single most indefensible line in the repo — it fails a five-second reload test.

**Fix:** Delete the fallback block at `:834-871` entirely and let the route return `success: false`. The component already has an unavailable state at `SeatAvailability.tsx:115-118` — use it. Then remove the phrase "Real-time PRS" from `:64`.

**Accept:** Reload the seats tab three times; the numbers are identical, or the panel says data is unavailable.

---

### R-11 · P0 · Elevation profile is a sine wave credited to OpenTopography

**Where:** `lib/opentopography.ts:17` (the broken request), `:45-49` (the synthetic curve), `features/analytics/ElevationProfile.tsx:37` and `features/analytics/AnalyticsDashboard.tsx:65` (the attribution).

**What:** The request is built as `` `https://portal.opentopography.org/API/globaldem?demtype=SRTMGL1&locations=${...}&outputFormat=JSON&API_Key=${...}` ``. `/API/globaldem` is a **bounding-box raster** endpoint — it takes `south`/`north`/`west`/`east` and returns GeoTIFF or AAIGrid. It has no `locations` parameter and no JSON point-elevation mode, so it can never return the `data.elevations` array that `:24` requires. The key *is* populated, so the branch is entered on every request, fails, and falls through every time. The result is `Math.sin((idx / stepCount) * Math.PI) * 480` plus `Math.sin(idx * 1.5) * 25` of noise — an identical 45 m → ~525 m → 45 m bell curve **for every train on every route in India**.

**Why it matters:** `ElevationProfile.tsx:37` titles the chart "OpenTopography Elevation Profile" and `AnalyticsDashboard.tsx:65` says "Computing… elevation profile from OpenTopography". A fabricated curve is credited to a real scientific data source, and it is trivially falsifiable — compare any two routes and they are the same shape.

**Fix:** Make it real. Use a point-query elevation API that actually accepts coordinates and needs no key:

```ts
// lib/elevation.ts
const locs = coords.map(([lng, lat]) => `${lat},${lng}`).join('|');
const res = await fetch(`https://api.opentopodata.org/v1/srtm30m?locations=${locs}`, {
  signal: AbortSignal.timeout(10_000),
});
const json = await res.json();          // { results: [{ elevation, location }] }
return json.results.map((r: any) => r.elevation as number);
```

Batch to 100 coordinates per request (their documented limit), cache for 24 hours since terrain does not change, and downsample the polyline before querying. If the call fails, return an empty profile and hide the chart — do **not** substitute a curve.

If you choose not to do this, then delete the dead `if` block at `:13-35`, rename the chart to "Estimated Elevation Profile (modelled)", and remove the OpenTopography attribution from both `ElevationProfile.tsx:37` and `AnalyticsDashboard.tsx:65`. Attributing synthetic data to a named real source is the specific thing that must stop.

**Accept:** Two different routes produce visibly different elevation profiles, or the chart is gone.

---

### R-12 · P0 · "Highest point" is floored at 520 m

**Where:** `app/api/analytics/[id]/route.ts:47` — `Math.max(...elevationProfile.map((e) => e.elevationM), 520)`

**What:** The `520` seed means no route can ever report a peak below 520 m.

**Why it matters:** `AnalyticsDashboard.tsx:81` presents this as the metric "Highest Point". A Mumbai–Surat coastal run, real peak around 15 m, is reported as 520 m.

**Fix:** Drop the seed and guard the empty case, which otherwise yields `-Infinity`:

```ts
const highestElevationM = elevationProfile.length
  ? Math.max(...elevationProfile.map((e) => e.elevationM))
  : null;
```

**Accept:** A coastal route reports a peak under 100 m, or reports nothing.

---

### R-13 · P0 · "Live Speed" falls back to the timetable average, or to the literal 80

**Where:** `lib/railradar.ts:294` — `liveSpeedKmh = Math.round(train?.avgSpeed || 80);`

**What:** When the per-segment computation fails, the static timetable average speed is substituted — or, if that is missing too, the number 80.

**Why it matters:** `components/journey/JourneyCard.tsx:102` labels this "Live Speed" with a pulsing "Moving" dot at `:113-114`, and `components/layout/MobileJourneySummary.tsx:61` labels it "Speed". A timetable constant is presented as a live instrument reading. This is the most likely thing an interviewer will probe, because live speed is the app's headline feature.

**Fix:** Return `speedKmh: null` when the real computation is impossible. Have `JourneyCard` render an em-dash with a "timetable avg: N km/h" caption instead of a live figure. The distinction between measured and scheduled is the whole point of the feature.

**Accept:** A train with insufficient passed-station data shows "—", not a number under a pulsing live indicator.

---

### R-14 · P0 · PNR confirmation probability is a hardcoded 88 with a fabricated sample size

**Where:** `lib/railradar.ts:680` — `confirmationProbability: 88`, and `:682` — `historicalTrend: 'Based on 450+ past journeys on this route, waitlists up to WL 25 confirm 92% of the time.'`

**What:** Both are hardcoded fixtures. There is no historical dataset anywhere in the repo.

**Why it matters:** `features/pnr/PNRResultView.tsx:140` renders this under the heading "Confirmation Prediction Engine", with a code comment at `:125` describing it as "ML Prediction". A fabricated statistic, with a fabricated sample size, under a heading claiming a model that does not exist — and a user might make a real travel decision on it.

**Fix:** Delete the fallback at `:677-684` and let the route return `success: false`. Remove the "Prediction Engine" and "ML" framing from `PNRResultView.tsx:125` and `:140`.

**Accept:** `grep -rn "450+\|confirmationProbability: 88" lib/` returns nothing.

---

### R-15 · P0 · Fare breakdown is labelled "Official Indian Railways"

**Where:** `features/fare/FareCalculator.tsx:64` (the claim) and `lib/railradar.ts:746-807` (the fixtures)

**What:** The subtitle reads "Official Indian Railways itemized fare breakdown including GST & surcharges", but on the fallback path every rupee figure is hardcoded — `baseFare: 1610`, `gst: 85`, `totalFare: 1780` — pinned to a 1,384 km distance at `:745` regardless of the actual route. `:177` itemises "Goods & Service Tax (GST 5%)" computed over an invented number.

**Why it matters:** The word "Official" asserts these figures are IRCTC-sanctioned. They are not, and fare data is the kind of thing a user acts on.

**Fix:** Change the subtitle to "Indicative fare estimate — verify on IRCTC", and hide the itemised breakdown entirely when `source !== 'live'` (which R-03 gives you).

**Accept:** The word "Official" does not appear anywhere in `features/fare/`.

---

### R-16 · P0 · Two contradicting crowd models, both presented as live

**Where:** `features/platform/PlatformFinder.tsx:27-70` (one ladder: `+35` peak hour, `+10` Sun/Fri, `-15` AC, `+20` general, `+15` delay > 60 min, clamped at 70) and `features/stations/StationLiveBoardView.tsx:22-39` (a *different* ladder: base `55`/`30`, `-20` AC, `+25` general, `+15` delay, clamped at 33).

**What:** Two independent magic-number scoring functions for the same concept, producing different answers for the same train.

**Why it matters:** `PlatformFinder.tsx:209` shows "Platform Crowd: {label}" with a precise percentage at `:211` and a progress bar at `:218`. `StationLiveBoardView.tsx:157` shows a "Crowd" column inside a board titled "Live Departure Board" next to a pulsing live-radio icon at `:99-100`, implying a live crowd feed. Two contradicting models for one concept is indefensible in review — it shows the numbers were tuned to look plausible rather than derived.

**Fix:** Extract one shared helper, `lib/crowd.ts`, exporting a single clearly-named function that returns a coarse band (`'Low' | 'Moderate' | 'High'`) and never a percentage. Delete `boardCrowdBadge` at `StationLiveBoardView.tsx:22-39` and the numeric `{crowd.score}%` at `PlatformFinder.tsx:211`. Relabel to "Estimated crowd — heuristic based on time of day and train class".

**Accept:** `grep -rn "score" features/platform/ features/stations/` shows one crowd implementation, and no percentage reaches the screen.

---

### R-17 · P0 · The "Live Data" badge appears over entirely fabricated journeys

**Where:** `app/api/train-history/[id]/route.ts:178` — `dataQuality = hasActualData ? 'live' : ...`

**What:** `hasActualData` checks whether `actualArrival`/`actualDeparture` are present. But `generateFallbackJourney` populates those fields on its fixtures (e.g. the literal `'20:14'` at `lib/railradar.ts:392`), so a 100% fabricated journey satisfies the check.

**Why it matters:** `features/analytics/HistoricalAnalytics.tsx:128` then renders the badge "Live Data" over invented section speeds and punctuality. The one control in the entire app designed to warn users instead actively reassures them. This is worth understanding as a design lesson: **inferring provenance from field presence does not work — provenance has to be carried explicitly.** That is exactly what R-03 fixes.

**Fix:** Thread the `source` flag from R-03 through to this handler and force `dataQuality = 'estimated'` whenever `source !== 'live'`. Do not infer from field presence.

**Accept:** With an invalid API key, the history tab shows "Estimated", never "Live Data".

---

### R-18 · P1 · Contradictory PNR prediction: "94% — Low Chance"

**Where:** `lib/railradar.ts:605-606`, and the mirror bug at `features/pnr/PNRResultView.tsx:33`

**What:** `predictionProbability: p.probability || 94` defaults to 94 when upstream omits the value, while the very next line evaluates `p.probability > 75 ? 'High' : p.probability > 45 ? 'Medium' : 'Low'` — and `undefined > 75` is `false`, so it lands on `'Low'`. `PNRResultView.tsx:33` independently invents `?? 85`.

**Why it matters:** Every passenger the API returns without a probability displays "94% — Low Chance", which is self-contradicting on its face, and the 94 is invented anyway.

**Fix:** Resolve once, and omit both fields when absent:

```ts
const prob = typeof p.probability === 'number' ? p.probability : undefined;
predictionProbability: prob,
predictionStatus: prob === undefined
  ? undefined
  : prob > 75 ? 'High' : prob > 45 ? 'Medium' : 'Low',
```

**Accept:** No screen can show a percentage and a contradicting band simultaneously.

---

### R-19 · P1 · Coach composition fallback renders "2 coaches" for a 20-coach express

**Where:** `app/api/coach/[id]/route.ts:107-110`

**What:** The fallback pushes only `ENG` and `EOG`, so `features/coach/CoachComposition.tsx:104` renders "2 coaches".

**Why it matters:** Visibly wrong to anyone who has seen a train, which makes it a bad first impression on a demo.

**Fix:** Return `success: false` instead of a two-element array, and have the component show "Composition unavailable".

**Accept:** No train displays a coach count below 4.

---

# PHASE 2 — Correctness bugs

---

### R-20 · P0 · Uncancelled `requestAnimationFrame` loop

**Where:** `features/analytics/AnalyticsDashboard.tsx:19-30` — `requestAnimationFrame(tick)` self-schedules at `:27`, is kicked off at `:29`, and the effect returns nothing.

**What:** No `cancelAnimationFrame`. Four `AnimatedCounter` instances mount per dashboard and `value` changes on every poll, so a new rAF chain starts while previous ones may still be running, and chains keep calling `setDisplay` after the tab unmounts.

**Why it matters:** This is the textbook `useEffect` cleanup question, and it is the exact bug the question is about. Fix it before any interview.

**Fix:**

```ts
let raf = 0;
const tick = () => { /* ...existing body... */ if (progress < 1) raf = requestAnimationFrame(tick); };
raf = requestAnimationFrame(tick);
return () => cancelAnimationFrame(raf);
```

**Accept:** Mount and unmount the Analytics tab twenty times; React logs no "setState on unmounted" warnings and the frame profiler shows no orphaned loops.

---

### R-21 · P0 · Weather panel crashes the whole page on an empty station list

**Where:** `features/weather/WeatherPanel.tsx:25-32`

**What:** `currSt`/`nextSt`/`destSt` fall back to `journey.stations[0]` and `journey.stations[length - 1]`. If `stations` is `[]` these are `undefined`, and `currSt.lat` at `:30` throws a `TypeError`.

**Why it matters:** Combined with R-22 (no error boundary), an empty `stations` array from upstream white-screens the entire train page — not just the weather tab.

**Fix:**

```ts
if (!currSt?.lat || !destSt?.lat) { setLoading(false); return; }
```

**Accept:** Stub the journey with `stations: []` and confirm the page renders with the weather panel showing an empty state.

---

### R-22 · P0 · No error boundary, no 404 page, no loading states

**Where:** Nothing exists under `app/` matching `error.tsx`, `global-error.tsx`, `not-found.tsx`, or `loading.tsx`. Confirmed by `find` and by `.next/app-path-routes-manifest.json`, which lists Next's internal `/_global-error` and `/_not-found` fallbacks rather than yours.

**What:** Any client-side throw in production renders Next's bare "Application error: a client-side exception has occurred" with no retry path. A bad train ID gives a generic 404.

**Why it matters:** These are standard App Router files, so their absence is immediately noticeable to anyone who knows Next.js — and it converts every small bug into a white screen.

**Fix:** Add four files: `app/error.tsx` (a Client Component that renders the error and a button calling `reset()`), `app/global-error.tsx` (must render its own `<html>` and `<body>`), `app/not-found.tsx`, and `app/train/[id]/loading.tsx` with a skeleton.

**Accept:** Throw deliberately inside a feature component and confirm you get your own error UI with a working retry button.

---

### R-23 · P1 · Zustand `persist` without `skipHydration` guarantees a hydration mismatch

**Where:** `store/favorites.ts:37` and `store/search.ts:24-26` — both pass only `{ name }`.

**What:** Zustand rehydrates from `localStorage` synchronously at module evaluation. `/` and `/favorites` are both prerendered (confirmed in `.next/prerender-manifest.json`), so the server HTML has empty lists while the client store is already populated.

**Why it matters:** A guaranteed hydration mismatch on the two most-visited routes.

**Fix:** Add `skipHydration: true` to both options objects, then call `useSearchStore.persist.rehydrate()` and `useFavoritesStore.persist.rehydrate()` inside a mount `useEffect` in a small client component.

**Accept:** Load `/` with populated recent searches; the browser console shows no hydration warning.

---

### R-24 · P1 · Server renders in UTC, so crowd scoring is 5h30m off

**Where:** `features/stations/StationLiveBoardView.tsx:50` (`new Date().toLocaleTimeString('en-IN')` in a state initializer), `:23` (`new Date().getHours()` during render), and `features/platform/PlatformFinder.tsx:28`, `:36` (called from the component body at `:128`).

**What:** Locale-formatted clocks and `getHours()`/`getDay()` are evaluated during render, on both server and client.

**Why it matters:** Two failures at once. First, a hydration mismatch, because Render's server is UTC and the browser is IST. Second — and more interesting — the peak-hour and day-of-week scoring silently uses the **server's** clock, so crowd estimates for Indian trains are computed five and a half hours off. A train at 08:00 IST is scored as 02:30, i.e. off-peak.

**Fix:** For the displayed clock, initialise to `''` and set it in a mount `useEffect`. For the scoring, resolve the hour and day explicitly in IST so server and client agree:

```ts
const istHour = Number(new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false,
}).format(new Date()));
```

**Accept:** The peak-hour branch fires between 08:00–11:00 IST regardless of server timezone.

---

### R-25 · P1 · PNR lookup fires every request twice

**Where:** `app/pnr/page.tsx:68-69`

**What:** `handleSubmit` calls `router.push('/pnr?pnr=X')` at `:68` **and** `fetchPNR(...)` at `:69`. The push changes `pnrParam`, which retriggers the effect at `:59`, which calls `fetchPNR` again.

**Why it matters:** `fetchPNR` fires three parallel requests (`:35-37`), and none of the three PNR routes wrap their work in `getCached`. So every lookup costs six upstream calls instead of three — against the same 50/day quota.

**Fix:** Delete the `fetchPNR(...)` call at `:69` and let the effect be the single fetch trigger. While you are there, add `getCached`/`setCached` to the three PNR routes with a 300-second TTL.

**Accept:** Submit a PNR and confirm exactly three `/api/pnr/` requests in the network panel.

---

### R-26 · P1 · Train marker popup shows data from first render forever

**Where:** `features/maps/MapView.tsx:174-189`

**What:** The popup HTML bakes in `journey.speedKmh` and `journey.delayMinutes`, but is only built inside the `if (!markerRef.current)` branch. The `else` at `:187-189` calls `setLngLat` only.

**Why it matters:** The marker moves on every poll while its popup permanently displays the speed and delay from the very first render. The map actively presents stale data as live — the same class of problem as Phase 1, just caused by a caching bug rather than a fixture.

**Fix:** Hoist the HTML out of the `if`, and after the branch always refresh it:

```ts
markerRef.current.getPopup()?.setHTML(popupHtml);
```

**Accept:** Open the popup, wait two polls, and confirm the speed value tracks the card.

---

### R-27 · P1 · No haversine anywhere — both distance functions are wrong by up to 13%

**Where:** `app/api/terrain/route.ts:58` — `Math.round(Math.sqrt(dlat * dlat + dlng * dlng) * 111)` — and the duplicated pair at `lib/railradar.ts:183` and `features/maps/MapView.tsx:30`. Confirmed: these are the only distance calculations in the codebase, and `grep -rn "haversine\|6371"` returns zero hits outside the docs.

**What:** Degree-space Pythagoras with a flat 111 km per degree, missing the `cos(latitude)` correction on longitude.

**Why it matters:** One degree of longitude is 104.6 km at 20°N and 98.3 km at 28°N, not 111 km. The measured error on an east-west separation is **6.2% at 20°N, 9.3% at 24°N and 13.1% at 28°N**. It is near-zero for north-south routes — Mumbai→Delhi is only 1.3% off because latitude dominates — so the error is direction-dependent and worst on east-west corridors like Ahmedabad–Kolkata. In `interpolatePolyline` this over-weights east-west segments, dragging the rendered train marker off its true along-route position.

There is a second reason to fix this: haversine is a classic interview question, and once it is in the repo the author can say the word out loud.

**Fix:** One shared helper, used by all three call sites:

```ts
// lib/geo.ts
export function haversineKm([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) {
  const R = 6371.0088, tr = (d: number) => (d * Math.PI) / 180;
  const dLat = tr(lat2 - lat1), dLng = tr(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(tr(lat1)) * Math.cos(tr(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
```

Then delete the duplicated `getPolylinePoint` at `MapView.tsx:18-47` in favour of a single exported implementation. Two copies of a geometry function in two files is how they drift apart.

**Accept:** A unit test asserts Mumbai CST → New Delhi at roughly 1,150 km great-circle, within 1%.

---

### R-28 · P1 · Speed clamp hides a date-handling bug

**Where:** `lib/railradar.ts:287` — `Math.min(200, Math.max(0, computed))`, with `parseHHMM` at `:275`

**What:** `parseHHMM` discards the date, so on a multi-day run two stops more than 24 hours apart compute a time delta 24 hours too small — a real 30-hour gap becomes 6 hours, inflating speed roughly fivefold. The clamp then presents that bug as a clean, plausible "200 km/h". Related: `Math.abs` at `:266` masks out-of-order distance values instead of rejecting them, and `parseInt` at `:275` returns `NaN` for malformed input, which passes the `t1 !== null && t2 !== null` guard at `:281`.

**Why it matters:** 200 km/h exceeds any scheduled Indian Railways service — Vande Bharat runs at about 160 km/h commercially — so the clamp both conceals the bug and emits a physically impossible figure under the "Live Speed" label. Clamping is the wrong reflex here: **a value outside physical bounds is evidence of a bug, not something to round into range.**

**Fix:** Reject rather than clamp. If `computed > 180`, set `liveSpeedKmh = null` and `console.warn` it. Better still, parse the full ISO timestamps that `RRRouteStop.actualArrival` already carries instead of reducing them to `HH:MM`. Replace `Math.abs` at `:266` with an ordering check, and add `Number.isFinite` guards on the parse results.

**Accept:** A multi-day train (e.g. 12801 Purushottam Express) reports a plausible speed or none, never exactly 200.

---

### R-29 · P1 · An *actual* departure is paired with a *scheduled* arrival

**Where:** `lib/railradar.ts:278-279`

**What:** Two independent `||` chains — `parseHHMM(s1.actualDeparture || s1.scheduledDeparture || s1.departure)` and `parseHHMM(s2.actualArrival || s2.scheduledArrival || s2.arrival)` — can resolve to different sources, so the interval spans two different clocks.

**Why it matters:** A train running 40 minutes late produces a segment interval 40 minutes short, overstating computed speed by roughly the delay-to-runtime ratio. Silently, with no way for the caller to tell. This is a subtle bug and a good one to be able to explain.

**Fix:** Require both endpoints from the same source. Compute the actual interval only if `s1.actualDeparture && s2.actualArrival`; otherwise fall back to a scheduled-only pair; otherwise bail.

**Accept:** A unit test with a mixed actual/scheduled stop pair asserts the function falls through to the scheduled pair rather than mixing.

---

### R-30 · P1 · TypeScript checks React 18 while the app runs React 19 canary

**Where:** `package.json:18-20` and `:27-28`

**What:** Installed versions are exactly `next@16.3.3`, `react@18.3.1`, `react-dom@18.3.1`, `@types/react@18.3.31`. Next 16's `peerDependencies` accept `^18.2.0 || ^19.0.0`, so npm does not complain — **and Next vendors its own React.** `node_modules/next/dist/compiled/react/cjs/react.production.js` reports `19.3.0-canary`, and `node_modules/next/dist/build/create-compiler-aliases.js:288-301` aliases `react$`, `react-dom$`, `react-dom/client$` and `react-dom/static$` to that vendored copy for every App Router layer.

**Why it matters:** The App Router is **not** broken — it already runs React 19 canary, and there is a successful build in `.next/`. The actual defect is silent divergence: `tsc` validates against React **18** types while the runtime is React **19**, so React 19 behaviour changes (`useRef` requiring an argument, removal of `propTypes`/`defaultProps` on function components, ref-as-prop) are invisible to the compiler. `react-dom@18.3.1` has no `./static` export at all and is only saved by Next's alias.

**Fix:** Align the declaration with reality. **Do not downgrade Next.**

```
npm i react@^19.2.0 react-dom@^19.2.0 -E
npm i -D @types/react@^19 @types/react-dom@^19
```

Then run `npx tsc --noEmit` and fix what surfaces — that output is the point of the exercise.

**Accept:** `tsc --noEmit` exits 0 with React 19 types installed.

---

### R-31 · P1 · Overpass calls have no User-Agent, no timeout, and swallow 429s

**Where:** `lib/overpass.ts:67-71` (the request) and `:73-76` (the error path)

**What:** The POST sends no `User-Agent`, has no `AbortController` or timeout, and no retry with backoff. A non-OK response — including 429 rate-limit and 504 gateway-timeout — is `console.warn`'d and the batch is silently skipped via `continue`.

**Why it matters:** Overpass is a free community service and its fair-use policy expects an identifying User-Agent; anonymous, untimed, automated traffic from a deployed host is precisely the profile that earns an IP ban. And because a throttle is swallowed, a ban is indistinguishable from "this route genuinely has no bridges" — the terrain panel just renders empty and you never learn Overpass is refusing you. A hung connection also blocks the request until Render's own timeout, since `getTerrainFeatures` loops up to three batches.

**Fix:** Add identification and a timeout at `:69`, and handle throttling explicitly:

```ts
headers: { 'Content-Type': 'text/plain', 'User-Agent': 'RailRadar24/0.1 (github.com/Priyanshu6926)' },
signal: AbortSignal.timeout(20_000),
```

For `res.status === 429 || res.status === 504`, back off and retry that batch twice — `await new Promise(r => setTimeout(r, 2000 * attempt))` — then propagate a distinguishable error so the UI can say "terrain data unavailable" rather than showing an empty list.

**Accept:** Force a 429 with a stub and confirm the UI reports unavailability rather than an empty result.

---

### R-32 · P1 · Missing geometry silently places the train in New Delhi

**Where:** `lib/railradar.ts:172` — `if (!coords || coords.length === 0) return [77.2194, 28.643];` and the same fallback at `features/maps/MapView.tsx:19`. A `NaN` `pct` also escapes both guards at `:173-174` and falls through to `:201`, returning the destination.

**What:** Absent route geometry yields New Delhi's coordinates rather than an absent position. Separately, `heading: 45` at `:302` and `:440` is hardcoded, never computed, and never consumed by `MapView` — while `app/page.tsx:510` advertises "train headings" as a feature.

**Why it matters:** A train with no geometry renders on the map, in Delhi, indistinguishable from a real position.

**Fix:** Return `null` and have `MapView` skip rendering the marker. Add a `Number.isFinite(pct)` guard. Either compute `heading` from the bearing between the two bracketing polyline points — which you now have `haversineKm` neighbours for after R-27 — or delete the field and the claim at `app/page.tsx:510`.

**Accept:** A train with no polyline shows no marker, and no train renders at Connaught Place by accident.

---

# PHASE 3 — Performance

All five of these are wasted work repeating on a poll loop.

---

### R-33 · P2 · Every station marker is destroyed and rebuilt on every poll

**Where:** `features/maps/MapView.tsx:192-220`

**What:** `:192` calls `.remove()` on every station marker, `:193` empties the ref, then `:195-220` recreates a `div`, an `innerHTML` string, a `maplibregl.Popup` and a `maplibregl.Marker` for every station from scratch.

**Why it matters:** A long-distance train has 40–60 stations, so each poll destroys and rebuilds roughly 180 DOM nodes and 60 popup instances — even though **station coordinates never change mid-journey**. Only the status class does.

**Fix:** Key markers by station code in a `useRef<Map<string, maplibregl.Marker>>`, create each marker once, and on subsequent runs update only the status class:

```ts
el.firstElementChild!.className = statusClassFor(st.status);
```

**Accept:** With DevTools' "paint flashing" on, a poll repaints only markers whose status changed.

---

### R-34 · P2 · The map effect re-runs on every poll because `journey` is a new object

**Where:** `features/maps/MapView.tsx:226` — deps are `[journey, mapLoaded, followTrainMode, setFollowTrainMode]`

**What:** `journey` gets a fresh object identity on every poll, so the effect always re-runs. And because `followTrainMode` is in the same effect, merely toggling the camera button re-runs the entire marker teardown and rebuild from R-33.

**Fix:** Split the camera `easeTo` into its own effect keyed on `[followTrainMode, trainLng, trainLat]`, and narrow this effect's dependencies to primitives — `journey.completionPercentage` and a joined station-status string, for example.

**Accept:** Toggling follow-train mode does not rebuild station markers.

---

### R-35 · P2 · Weather panel refetches three endpoints every 30 seconds

**Where:** `features/weather/WeatherPanel.tsx:53` — dependency array is `[journey]`

**What:** Three `/api/weather` round-trips plus a full panel re-render on every poll.

**Why it matters:** Upstream quota is actually safe here — `app/api/weather/route.ts:33` caches for 900 seconds — so this is wasted client work and needless re-rendering rather than quota burn. Worth fixing, but not urgent.

**Fix:** `[journey.currentStation?.code, journey.nextStation?.code]`

**Accept:** Weather requests fire on station change, not on every poll.

---

### R-36 · P2 · Eight `fetch`-in-`useEffect` blocks with no `AbortController`

**Where:** `features/analytics/AnalyticsDashboard.tsx:43-57`, `features/weather/WeatherPanel.tsx:21-53`, `features/terrain/TerrainPanel.tsx:18-37`, `features/analytics/HistoricalAnalytics.tsx:82-101`, `features/coach/CoachComposition.tsx:68-87`, `features/occupancy/TrainOccupancy.tsx:181-200`, `features/seats/SeatAvailability.tsx:29-52`, and `components/search/StationSearch.tsx:34-52` (which clears its debounce timer but never aborts the in-flight request).

**What:** No request cancellation on unmount or on dependency change.

**Why it matters:** Rapid tab switching or fast typing lets a slow earlier response resolve *after* a newer one and overwrite it with stale data — a race condition that produces wrong data on screen, not just wasted work. Every one of these also calls `setLoading(false)` after unmount.

**Fix:** In each, the same three lines:

```ts
const ac = new AbortController();
fetch(url, { signal: ac.signal })   // ...
return () => ac.abort();
```

**Accept:** Type quickly in the station search and confirm results always match the final query.

---

### R-37 · P2 · Home page re-renders on any store mutation

**Where:** `app/page.tsx:46` — `const { recentSearches, addRecentSearch, clearRecentSearches } = useSearchStore();`

**What:** Subscribing with no selector means Zustand returns the whole state object, so this roughly 600-line component re-renders on any store change.

**Fix:** Three narrow selectors — `useSearchStore((s) => s.recentSearches)` and so on.

**Accept:** React DevTools' render highlighting shows no `HomePage` re-render when an unrelated store field changes.

---

# PHASE 4 — Deployment, docs and accessibility

---

### R-38 · P1 · Build may ship unstyled because build tools are in `devDependencies`

**Where:** `package.json:24-34`

**What:** `typescript`, `tailwindcss`, `postcss`, `autoprefixer`, `@types/react` and `@types/node` are all in `devDependencies`, and all six are required by `next build`.

**Why it matters:** Render Node services commonly run with `NODE_ENV=production` set in the service environment, which makes `npm install` omit devDependencies. The build then either fails outright or — worse — succeeds and ships a completely unstyled site. I could not verify from the repo whether your specific service sets this, so check the dashboard.

**Fix:** Either set the Render build command to `npm ci --include=dev && npm run build`, or add `NPM_CONFIG_PRODUCTION=false` as a Render environment variable. The build command is the more explicit of the two.

**Accept:** A clean Render deploy produces a styled site.

---

### R-39 · P1 · Node version unpinned, and no infrastructure as code

**Where:** No `engines` field in `package.json`, no `.nvmrc`, no `render.yaml`, no `Dockerfile` — all verified absent. The installed Next requires Node `>=20.9.0`.

**Why it matters:** Render can change its default Node image and break your build with no commit from you. And the deployment is unreproducible: build command, start command and every environment variable exist only in the dashboard, so if the service is deleted the configuration is gone.

**Fix:** Add `"engines": { "node": ">=20.9.0" }` to `package.json`, add `.nvmrc` containing `22`, and commit a `render.yaml` declaring `buildCommand`, `startCommand`, `healthCheckPath` and the environment variable **names** (never values, and set `sync: false` for secrets).

**Accept:** `render.yaml` is committed and a fresh deploy from it succeeds.

---

### R-40 · P1 · No health check endpoint

**Where:** Nothing under `app/` matching `*health*`.

**What:** With no `healthCheckPath`, Render probes `/` — a full React render that transitively depends on RailRadar.

**Why it matters:** Upstream flakiness can make Render mark a healthy instance unhealthy and restart it, which also wipes the in-memory cache and re-incurs a cold start.

**Fix:** Add `app/api/health/route.ts` returning `NextResponse.json({ ok: true })` with `export const dynamic = 'force-dynamic'`, and point `healthCheckPath` at `/api/health`.

**Accept:** `curl <render-url>/api/health` returns `{"ok":true}` without touching any upstream API.

---

### R-41 · P1 · Cold starts, and what a recruiter actually experiences

**Where:** `lib/cache.ts:7` interacting with Render's free tier.

**What:** The cache is a module-level `Map` in process memory, so it is empty on every cold start. Render's free tier spins the instance down after about 15 minutes of inactivity, and cold start takes roughly 50 seconds.

**Why it matters:** Concretely: a recruiter clicking your link pays a ~50-second cold start **and** gets a completely cold cache, which before R-01 means the train page fires all five routes at two upstream calls each — ten RailRadar requests, 20% of the daily quota, on a single first page view. This is the practical reason the demo tends to show fabricated data.

**Fix, in this order:** (1) R-03, so failure is visible rather than fabricated; (2) R-01, which cuts first-view cost from ten calls to two; (3) R-04, to bound the cache; (4) R-40, the health endpoint; (5) add `output: 'standalone'` to `next.config.mjs` — it trims the server bundle to only traced dependencies, which measurably shortens cold start and costs nothing here, since Render runs a long-lived Node process rather than serverless functions; (6) either move off the free tier or accept cold starts and say so in the README.

Be aware of what you cannot fix in code: an in-process `Map` cannot survive a restart. **This is the honest answer to "what happens to your cache on a cold start?", and it is the follow-up question this project invites most.** The real answer is Redis, and knowing that is worth more than having built it.

**Accept:** After R-01, a cold train page view costs two upstream calls, confirmed by instrumentation.

---

### R-42 · P2 · The lint script has never run

**Where:** `package.json:9` — `"lint": "next lint"`

**What:** `next lint` was **removed in Next 16**. There is no `next-lint.js` in `node_modules/next/dist/cli/` and no `lint` command registered in the CLI, so the script errors with `Invalid project directory provided, no such directory: .../lint`. There is also no `.eslintrc*` or `eslint.config.*` anywhere, so `eslint-config-next` is installed but unused.

**Why it matters:** The only quality gate in the repo has never executed. Several issues in this document would have been caught by `react-hooks/exhaustive-deps` alone.

**Fix:** Add `eslint.config.mjs` using the flat-config `next/core-web-vitals` preset and change the script to `"lint": "eslint ."`. Expect a meaningful number of warnings on first run — the hooks warnings will point at R-34, R-35 and R-36.

**Accept:** `npm run lint` runs and reports real findings.

---

### R-43 · P2 · The README contradicts the code in four places

**Where:** `README.md:33`, `:3`, `:10`, `:42`, `:52`, `:8`, `:133`, `:109-110`

**What:** Four verified mismatches. `:33` claims route discovery "with OpenTopography SRTM profiles" — the Overpass POI discovery is real, but the SRTM half is not (see R-11). `:3`, `:10`, `:42` and `:52` claim Next.js 14 / 14.2; the installed version is 16.3.3. `:8` shows an MIT badge and `:133` says "see the LICENSE file"; there is no LICENSE file. `:109-110` lists "Vercel (Recommended)" first for a project actually deployed on Render.

One claim I checked and it is **defensible**: the crowd feature at `:32`. `PlatformFinder.tsx:24-31` really does compute a weighted score from hour of day and delay. "Prediction" oversells a heuristic, but the code exists — soften the wording rather than deleting the claim.

**Why it matters:** Interviewers read the README first, then open the file that backs the most impressive claim. Right now that path leads to a sine wave. The README is actively costing you credit for the batched Overpass pipeline, the polyline interpolation and the section-speed algorithm, all of which are real and genuinely good.

**Fix:** Rewrite `:33` as "Discovers rivers, bridges, peaks and cities along the route via batched Overpass QL queries" plus, until R-11 is done, "(elevation profile is modelled, not measured)". Correct the version claims to 16. Add a real `LICENSE` file. Lead the hosting section with Render and include the live URL.

**Accept:** Every capability claimed in the README can be traced to code that implements it.

---

### R-44 · P2 · The project has three names and advertises a domain it does not own

**Where:** Folder `RailGaadi`; `package.json:2` says `"railradar24"`; `features/platform/PlatformFinder.tsx:136` says `"RailGaadi"` while everything else says RailRadar24; and `railradar24.app` is hardcoded at `features/share/JourneyReportCard.tsx:100` and `:207`.

**Why it matters:** Every shareable PNG a user generates advertises `railradar24.app`, which is not your Render URL — so shared cards point nowhere. The name inconsistency also looks careless in a repo review.

**Fix:** Pick one name and apply it everywhere including the folder. Replace the hardcoded domain with an env var, `NEXT_PUBLIC_SITE_URL`, defaulted to the Render URL.

**Accept:** `grep -rni "railgaadi\|railradar24.app" --include=*.ts --include=*.tsx .` returns nothing unexpected.

---

### R-45 · P1 · A live credential for a service the app never uses

**Where:** `.env.example:24-25` and `config/env.ts:16-17` declare `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. No code reads either — verified repo-wide.

**What:** The variables are dead. **Importantly, `.env.local` holds a non-empty, credential-bearing value for `UPSTASH_REDIS_REST_URL`** for a service the app never contacts. Good news, verified: `.env.local` is untracked, correctly ignored at `.gitignore:28-29`, and `git log --all --name-only` shows **no secrets file has ever been committed** — only `.env.example`. So nothing is leaked.

Separately, `clientEnv` at `config/env.ts:21-23` is never imported; `features/maps/MapView.tsx:11` reads `process.env.NEXT_PUBLIC_MAPTILER_API_KEY` directly instead.

**Why it matters:** An unused live credential sitting in a local env file is an unnecessary standing risk, and the declared-but-unread variables imply a Redis cache that does not exist — which is misleading to a reader and would be embarrassing if claimed in an interview.

**Fix:** Rotate or delete that Upstash credential in the Upstash console, then remove both variables from `.env.example` and `config/env.ts`. Either use `clientEnv` in `MapView.tsx` or delete it. Also restrict the MapTiler key to your Render hostname in the MapTiler dashboard — it is correctly public, since MapTiler keys are domain-restricted by design, but only if you actually set the restriction.

**Accept:** `grep -rn "UPSTASH" .` returns nothing, and the credential is revoked upstream.

---

### R-46 · P2 · No tests, no CI, no security headers

**Where:** No test file or framework anywhere, no `.github/workflows`, and `next.config.mjs` sets no `headers()`. `app/layout.tsx:41-45` has preconnects only. Confirmed clean: `.next/` and `node_modules/` are correctly untracked (92 tracked files total).

**Why it matters:** "How do you test this?" is a near-certain interview question, and the honest answer right now is "I don't". You do not need broad coverage — you need enough to answer the question and to protect the maths.

**Fix:** Install Vitest and write **five** tests, chosen because they cover the logic most likely to be asked about: `haversineKm` against a known city pair (R-27); `interpolatePolyline` at fractions 0, 0.5 and 1; the section-speed calculation across a midnight boundary (R-28); `buildStationQuery` rejecting a `NaN` coordinate (R-07); and `setCached` evicting at the cap (R-04). Then add a GitHub Actions workflow running `npx tsc --noEmit`, `npm run lint` and `npm test` on push.

Add basic security headers in `next.config.mjs`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

**Accept:** `npm test` runs five passing tests, and the Actions badge is green.

---

### R-47 · P2 · Zero accessibility affordances in the entire codebase

**Where:** Verified counts across all 44 `.tsx` files: **0** `aria-*` attributes and **0** `role=` attributes.

**What:** Two things are genuinely good and should be noted: there are no `<img>` tags at all, so no alt-text violations, and no clickable `<div>`/`<span>` — every interactive element is a real `<button>`. The gaps are: `components/search/SearchBar.tsx:24-32` (input with a placeholder but no label); `components/search/StationSearch.tsx:74` (a `<label>` with **no `htmlFor`**, paired with an input at `:86` that has no `id`, so they are not associated); and the icon-only clear buttons at `SearchBar.tsx:34-39` and `StationSearch.tsx:101-110` with neither `title` nor `aria-label`. The other five icon buttons at `components/journey/JourneyCard.tsx:54`, `features/maps/MapView.tsx:249`, `features/stations/StationLiveBoardView.tsx:137` and `features/planner/JourneyPlannerView.tsx:125` at least have `title`.

**Why it matters:** The search box is the app's entry point and is currently unusable with a screen reader. Also, until this is fixed, **do not claim "accessible" or "WCAG" anywhere** — on a resume, in the README, or in an interview.

**Fix:** Three changes, highest impact first. Add `aria-label="Search trains"` to `SearchBar.tsx:24` and `aria-label="Clear search"` to the button at `:34`. Pair `StationSearch.tsx:74` with `:86` via matching `id`/`htmlFor`, and add `aria-label="Clear station"` at `:101`. Wrap the polling live status in `JourneyCard.tsx` with `role="status" aria-live="polite"` so delay changes are announced instead of silently swapped.

**Accept:** Tab through the home page with VoiceOver or NVDA and reach a labelled search field and a labelled clear button.

---

# WHAT NOT TO CHANGE

The audit confirmed these are correct. Leave them alone, and know why they are right — each is a likely interview topic.

- **`lib/overpass.ts` batching pipeline.** Four station bounding boxes per union query, sampling to at most 12 stations, a 300 ms inter-batch throttle, Set-based deduplication, and a 40-feature cap. This is the strongest engineering in the repo. It needs the User-Agent and timeout from R-31, nothing more.
- **`dynamic(() => import('@/features/maps/MapView'), { ssr: false })`** at `app/train/[id]/page.tsx:27-34` and `app/share/[id]/page.tsx:12-15`. Correct, and `ssr: false` is legal because both files are Client Components.
- **`await params` in all eight dynamic route handlers** (e.g. `app/api/train/[id]/route.ts:11`). Correct for the Next 15+/16 Promise API.
- **No `export const dynamic`/`revalidate` needed on route handlers.** Next 15+ no longer caches GET handlers by default.
- **`AbortController` with a cleared timeout at `lib/railradar.ts:39-50`.** Correct pattern.
- **`map.remove()` on unmount at `MapView.tsx:101-104`**, and the cleanups at `app/page.tsx:37,77,92`, `StationSearch.tsx:51,62`, `StationLiveBoardView.tsx:71`.
- **`useSearchParams` wrapped in `Suspense`** at `app/pnr/page.tsx:206`.
- **Query keys are properly parameterised** (`['liveJourney', trainId]`) — no cross-train cache collisions.
- **`tsconfig.json:11` has `strict: true`** and `tsc --noEmit` exits 0. No non-null assertions anywhere in `app/`, `components/`, `features/` or `hooks/`.
- **Index-as-key usage** at `app/page.tsx:252,556` and `AnalyticsDashboard.tsx:125` is on static or wholesale-replaced lists; the one genuinely reorderable list correctly uses `key={train.id}` at `app/page.tsx:468`.

---

# SUGGESTED ORDER OF WORK

A realistic sequence if time is limited. Phase 0 is the only part that is genuinely urgent.

**One evening — makes the live demo honest and safe**
R-01, R-03, R-02, R-04, R-22. After this, the deployed app tells the truth, survives a crawler, and no longer white-screens.

**Second evening — removes the interview liabilities**
R-11 (fix elevation properly), R-10, R-13, R-14, R-17, R-09, R-15, R-16. After this there is nothing in the repo that reads as fabrication.

**Third evening — the fixes that are also interview answers**
R-27 (haversine), R-20 (rAF cleanup), R-46 (five tests), R-30 (React 19), R-40, R-41.

**Then, in any order**
Everything remaining. R-43 (README) is worth doing early despite being P2, because it is what an interviewer reads first.

---

# THE THREE QUESTIONS THIS REPO INVITES

Be able to answer these before an interview. They follow directly from the issues above, which is why fixing them is worth more than reading about them.

1. **"Your cache is a `Map` in process memory. What happens on a restart, and what would you do differently?"** — It is lost, and on Render's free tier the instance spins down after fifteen minutes, so it is cold more often than warm. The answer is an external store like Redis, keyed the same way, with the TTL tiers unchanged. See R-41.

2. **"You call four APIs. What happens when one is slow or down?"** — Point at the `AbortController` timeout at `lib/railradar.ts:39-52` and the per-batch error isolation in `lib/overpass.ts`. Then volunteer what was wrong: the app used to substitute fabricated data on failure, and you changed it to surface the failure instead. Naming a mistake you fixed is stronger than claiming there wasn't one.

3. **"Walk me through how you position the train on the map."** — Cumulative segment lengths along the route polyline, find the target fraction, linearly interpolate within the containing segment. Know that it used degree-space distance and that you replaced it with haversine, and why that mattered more on east-west routes. See R-27.

A closing note, said plainly: if parts of this codebase were scaffolded with AI assistance, that is normal and not a problem in itself. What matters is being able to explain and modify anything you put your name to. Working through this document is the fastest way to close that gap — and the most effective way to use it is to break things deliberately. Change the Overpass batch size from 4 to 40 and watch it fail. Set a cache TTL to 0 and watch the request count jump. Delete the `AbortController` and watch a route hang. Understanding built from breaking things survives interview pressure; understanding built from reading does not.

