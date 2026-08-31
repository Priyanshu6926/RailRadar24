// Simple in-memory cache with bounded size and expiration
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const MAX_ENTRIES = 500;
const memoryCache = new Map<string, CacheEntry<any>>();

export function getCached<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

export function setCached<T>(key: string, value: T, ttlSeconds: number): void {
  if (memoryCache.size >= MAX_ENTRIES) {
    const oldest = memoryCache.keys().next().value;
    if (oldest !== undefined) memoryCache.delete(oldest);
  }
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export function clearAllCache(): void {
  memoryCache.clear();
}
