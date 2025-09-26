export type CacheEntry<T> = { ts: number; ttl: number; data: T };
const NS = 'hub-cache.v1';

export function makeKey(key: string, coachId: string, tenantId?: string) {
  return `${NS}::${tenantId || 'single'}::${coachId || 'anon'}::${key}`;
}

export function getCache<T>(fullKey: string): T | null {
  try {
    const raw = sessionStorage.getItem(fullKey);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.ts > entry.ttl) {
      sessionStorage.removeItem(fullKey);
      return null;
    }
    return entry.data;
  } catch { return null; }
}

export function setCache<T>(fullKey: string, data: T, ttlMs: number) {
  try {
    const entry: CacheEntry<T> = { ts: Date.now(), ttl: ttlMs, data };
    sessionStorage.setItem(fullKey, JSON.stringify(entry));
  } catch {}
}
export function clearPrefix(prefix: string) {
  Object.keys(sessionStorage).forEach(k => { if (k.startsWith(prefix)) sessionStorage.removeItem(k); });
}