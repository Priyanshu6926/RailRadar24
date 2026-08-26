export interface StationHit {
  code: string;
  name: string;
  zone?: string;
  state?: string;
  lat?: number;
  lng?: number;
}

export interface PNRPassenger {
  serial: number;
  bookingStatus: string;
  currentStatus: string;
  coach?: string;
  berth?: string;
  berthType?: string;
}

export interface PNRStatus {
  pnr: string;
  trainNumber?: string;
  trainName?: string;
  dateOfJourney?: string;
  class?: string;
  quota?: string;
  from?: { code: string; name: string };
  to?: { code: string; name: string };
  boarding?: { code: string; name: string };
  reservationUpto?: { code: string; name: string };
  chartPrepared?: boolean;
  passengers: PNRPassenger[];
}

export interface PNRPrediction {
  pnr: string;
  confirmationProbability: number;
  predictedStatus: string;
  confidence?: string;
  remarks?: string;
}

export interface PNRRefund {
  pnr: string;
  totalFare?: number;
  cancellationCharge?: number;
  clerkage?: number;
  gst?: number;
  refundAmount?: number;
  eligible?: boolean;
  remarks?: string;
  breakdown?: { label: string; amount: number }[];
}

export interface FareBreakdown {
  trainNumber: string;
  from?: string;
  to?: string;
  class?: string;
  quota?: string;
  baseFare?: number;
  reservationCharge?: number;
  superfastCharge?: number;
  cateringCharge?: number;
  tatkalCharge?: number;
  gst?: number;
  otherCharges?: number;
  totalFare?: number;
  items?: { label: string; amount: number }[];
}

export interface SeatDay {
  date: string;
  status: string;
  availability?: number;
  waitlist?: number;
  rac?: number;
}

export interface SeatAvailability {
  trainNumber: string;
  from?: string;
  to?: string;
  class?: string;
  quota?: string;
  days: SeatDay[];
}

export interface PlannerTrain {
  number: string;
  name: string;
  from?: string;
  to?: string;
  departure?: string;
  arrival?: string;
  duration?: string;
  durationMinutes?: number;
  distanceKm?: number;
  runDays?: string[];
  classes?: string[];
  type?: string;
}

export interface PlannerResult {
  from: string;
  to: string;
  trains: PlannerTrain[];
}

export interface StationTrainRow {
  number: string;
  name: string;
  arrival?: string;
  departure?: string;
  platform?: string;
  delayMinutes?: number;
  status?: string;
  origin?: string;
  destination?: string;
  type?: 'originating' | 'terminating' | 'halting' | string;
}

export interface StationBoard {
  code: string;
  name?: string;
  zone?: string;
  trains: StationTrainRow[];
}

export interface StationLiveBoard {
  code: string;
  name?: string;
  hours?: number;
  arrivals: StationTrainRow[];
  departures: StationTrainRow[];
}

export interface TrainTimetable {
  number: string;
  name?: string;
  type?: string;
  source?: { code: string; name: string };
  destination?: { code: string; name: string };
  runDays?: string[];
  distance?: number;
  duration?: number;
}
