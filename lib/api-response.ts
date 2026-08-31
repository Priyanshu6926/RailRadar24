import { NextResponse } from 'next/server';
import { ApiResponse, DataSource } from '@/types/api';

export function jsonOk<T>(data: T, cached = false, status = 200, source: DataSource = 'live') {
  return NextResponse.json<ApiResponse<T>>(
    {
      success: true,
      source,
      data,
      cached,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

export function jsonFail(error: string, status = 500, source: DataSource = 'live') {
  return NextResponse.json<ApiResponse<never>>(
    {
      success: false,
      source,
      error,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

