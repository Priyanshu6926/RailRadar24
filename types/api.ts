export type DataSource = 'live' | 'fallback' | 'synthetic';

export interface ApiResponse<T> {
  success: boolean;
  source: DataSource;
  data?: T;
  error?: string;
  timestamp: string;
  cached?: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

