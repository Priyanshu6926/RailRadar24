import { NextResponse } from 'next/server';
import { ApiResponse } from '@/types/api';

export function jsonOk<T>(data: T, cached = false, status = 200) {
  return NextResponse.json<ApiResponse<T>>(
    {
      success: true,
      data,
      cached,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

export function jsonFail(error: string, status = 500) {
  return NextResponse.json<ApiResponse<never>>(
    {
      success: false,
      error,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}
