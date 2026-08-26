export interface Station {
  code: string;
  name: string;
  lat: number;
  lng: number;
  scheduledArrival: string;
  scheduledDeparture: string;
  actualArrival?: string;
  actualDeparture?: string;
  delayMinutes: number;
  distanceKm: number;
  status: 'passed' | 'current' | 'upcoming';
  platform?: string;
  haltMinutes?: number;
  isHalt?: boolean; // true = official halt, false = passing-through / waypoint
}

export interface SearchResult {
  id: string;
  number: string;
  name: string;
  origin: {
    code: string;
    name: string;
  };
  destination: {
    code: string;
    name: string;
  };
  runsOn?: string[];
  duration?: string;
  departureTime?: string;
  arrivalTime?: string;
}

export interface StationSearchResult {
  code: string;
  name: string;
  state?: string;
  lat?: number;
  lng?: number;
}

export interface LiveLocation {
  lat: number;
  lng: number;
  heading: number; // angle in degrees 0-360
  speedKmh: number;
  isMoving: boolean;
}

export interface LiveJourney {
  trainId: string;
  number: string;
  name: string;
  origin: {
    code: string;
    name: string;
  };
  destination: {
    code: string;
    name: string;
  };
  currentLocation: LiveLocation;
  status: 'running' | 'delayed' | 'on_time' | 'cancelled' | 'not_started' | 'completed';
  delayMinutes: number;
  speedKmh: number;
  distanceCoveredKm: number;
  remainingDistanceKm: number;
  totalDistanceKm: number;
  completionPercentage: number;
  lastUpdated: string; // ISO timestamp
  previousStation?: Station;
  currentStation?: Station;
  nextStation?: Station;
  ETA: string;
  stations: Station[];
  routeGeometry?: [number, number][]; // Array of [lng, lat] for MapLibre polyline
}

// ─── PNR Types ─────────────────────────────────────────────────────────────

export interface PNRPassenger {
  passengerNumber: number;
  bookingStatus: string; // e.g. "WL 45", "RAC 12", "CNF"
  currentStatus: string; // e.g. "CNF", "RAC 4", "WL 12"
  coach?: string; // e.g. "B3", "S4"
  berth?: string | number; // e.g. "45", "12"
  berthType?: string; // e.g. "LB", "MB", "UB", "SL", "SU"
  predictionProbability?: number; // 0-100%
  predictionStatus?: 'High' | 'Medium' | 'Low';
}

export interface PNRStatusData {
  pnr: string;
  trainNumber: string;
  trainName: string;
  journeyDate: string;
  fromStation: {
    code: string;
    name: string;
  };
  toStation: {
    code: string;
    name: string;
  };
  boardingStation: {
    code: string;
    name: string;
  };
  reservationUpto: {
    code: string;
    name: string;
  };
  class: string;
  quota: string;
  chartPrepared: boolean;
  passengers: PNRPassenger[];
  expectedPlatform?: string;
}

export interface PNRPredictionData {
  pnr: string;
  trainNumber: string;
  confirmationProbability: number; // 0-100 percentage
  status: 'High' | 'Medium' | 'Low';
  historicalTrend: string;
  message: string;
}

export interface PNRRefundData {
  pnr: string;
  ticketFare: number;
  clerkageCharge: number;
  cancellationCharge: number;
  refundableAmount: number;
  ruleApplied: string;
}

// ─── Fare Calculator Types ─────────────────────────────────────────────────

export interface FareClassBreakdown {
  classCode: string; // 1A, 2A, 3A, 3E, CC, SL, 2S
  className: string; // AC First Class, AC 2-Tier, Sleeper
  baseFare: number;
  reservationCharge: number;
  superfastCharge: number;
  tatkalCharge?: number;
  gst: number;
  totalFare: number;
  availableQuotas?: string[];
}

export interface TrainFareData {
  trainNumber: string;
  trainName: string;
  fromStation: string;
  toStation: string;
  distanceKm: number;
  fares: FareClassBreakdown[];
}

// ─── Seat Availability Types ───────────────────────────────────────────────

export interface DailySeatStatus {
  date: string; // YYYY-MM-DD
  day: string; // Mon, Tue...
  status: string; // "AVAILABLE-0045", "RAC 12", "WL 45", "REGRET/WL"
  statusCode: 'AVAILABLE' | 'RAC' | 'WL' | 'REGRET' | 'NOT_AVAILABLE';
  chance?: number; // Confirmation % for WL
  fare?: number;
}

export interface SeatAvailabilityData {
  trainNumber: string;
  trainName: string;
  classCode: string;
  quota: string;
  fromStation: string;
  toStation: string;
  availability: DailySeatStatus[];
}

// ─── Trains Between Stations (Planner) ────────────────────────────────────

export interface PlannerTrain {
  trainNumber: string;
  trainName: string;
  fromStation: {
    code: string;
    name: string;
    departureTime: string;
  };
  toStation: {
    code: string;
    name: string;
    arrivalTime: string;
  };
  duration: string;
  distanceKm: number;
  runningDays: string[]; // ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  classes: string[]; // ['SL', '3A', '2A', '1A']
  trainType: string; // Superfast, Express, Rajdhani, Vande Bharat
  hasPantry?: boolean;
}

export interface TrainsBetweenData {
  fromStation: { code: string; name: string };
  toStation: { code: string; name: string };
  totalTrains: number;
  trains: PlannerTrain[];
}

// ─── Station Boards (Departures / Arrivals) ────────────────────────────────

export interface StationBoardTrainItem {
  trainNumber: string;
  trainName: string;
  scheduledArrival: string;
  scheduledDeparture: string;
  actualArrival?: string;
  actualDeparture?: string;
  delayMinutes: number;
  platform?: string;
  origin: { code: string; name: string };
  destination: { code: string; name: string };
  status: 'on_time' | 'delayed' | 'arrived' | 'departed' | 'cancelled';
  trainType?: string;
}

export interface StationBoardData {
  stationCode: string;
  stationName: string;
  zone?: string;
  lastUpdated: string;
  trains: StationBoardTrainItem[];
}
