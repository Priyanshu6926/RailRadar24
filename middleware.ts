import { NextRequest, NextResponse } from 'next/server';

const WINDOW_MS = 60_000;
const LIMIT = 30;
const buckets = new Map<string, { count: number; resetAt: number }>();

export function middleware(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now > b.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else if (++b.count > LIMIT) {
    return NextResponse.json(
      {
        success: false,
        source: 'live',
        error: 'Rate limit exceeded. Please try again in a minute.',
        timestamp: new Date().toISOString(),
      },
      { status: 429 }
    );
  }
  if (buckets.size > 5_000) {
    buckets.clear();
  }
  return NextResponse.next();
}

export const config = { matcher: ['/api/:path*'] };
