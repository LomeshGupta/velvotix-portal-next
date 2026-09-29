import Redis from 'ioredis';

/**
 * Tiny key-value layer used for (1) caching Google Sheets reads, (2) notifications, (3) push subscriptions.
 *  - REDIS_URL set   -> shared Redis (all server instances see the same data, writes invalidate everywhere)
 *  - REDIS_URL unset -> in-process memory (fine for one instance / local development)
 * A Redis outage never breaks a request: a circuit breaker switches to memory for 10 seconds and retries.
 */
export interface KV {
  get(k: string): Promise<string | null>;
  set(k: string, v: string, ttl?: number): Promise<void>;
  del(...k: string[]): Promise<void>;
  incr(k: string): Promise<number>;
  lpushCap(k: string, v: string, cap: number, ttl: number): Promise<void>;
  lrange(k: string, s: number, e: number): Promise<string[]>;
  sadd(k: string, ttl: number, ...v: string[]): Promise<void>;
  smembers(k: string): Promise<string[]>;
  hset(k: string, f: string, v: string, ttl: number): Promise<void>;
  hgetall(k: string): Promise<Record<string, string>>;
  hdel(k: string, ...f: string[]): Promise<void>;
}

/* ---------------------------------------------------------------- memory */
type Item = { v: any; exp: number };
class MemKV implements KV {
  private m = new Map<string, Item>();
  private live(k: string): Item | undefined {
    const i = this.m.get(k);
    if (i && i.exp && i.exp < Date.now()) { this.m.delete(k); return undefined; }
    return i;
  }
  private put(k: string, v: unknown, ttl?: number) {
    if (this.m.size > 5000) for (const [key, it] of this.m) if (it.exp && it.exp < Date.now()) this.m.delete(key);
    this.m.set(k, { v, exp: ttl ? Date.now() + ttl * 1000 : 0 });
  }
  async get(k: string) { const i = this.live(k); return i ? String(i.v) : null; }
  async set(k: string, v: string, ttl?: number) { this.put(k, v, ttl); }
  async del(...k: string[]) { k.forEach(x => this.m.delete(x)); }
  async incr(k: string) { const n = Number((this.live(k)?.v as string) ?? 0) + 1; this.put(k, String(n)); return n; }
  async lpushCap(k: string, v: string, cap: number, ttl: number) { const l = ((this.live(k)?.v as string[]) ?? []).slice(); l.unshift(v); this.put(k, l.slice(0, cap), ttl); }
  async lrange(k: string, s: number, e: number) { const l = (this.live(k)?.v as string[]) ?? []; return l.slice(s, e < 0 ? undefined : e + 1); }
  async sadd(k: string, ttl: number, ...v: string[]) { const s = new Set((this.live(k)?.v as string[]) ?? []); v.forEach(x => s.add(x)); this.put(k, [...s], ttl); }
  async smembers(k: string) { return [...((this.live(k)?.v as string[]) ?? [])]; }
  async hset(k: string, f: string, v: string, ttl: number) { const h = { ...((this.live(k)?.v as Record<string, string>) ?? {}), [f]: v }; this.put(k, h, ttl); }
  async hgetall(k: string) { return { ...((this.live(k)?.v as Record<string, string>) ?? {}) }; }
  async hdel(k: string, ...f: string[]) { const i = this.live(k); if (!i) return; const h = { ...(i.v as Record<string, string>) }; f.forEach(x => delete h[x]); this.m.set(k, { v: h, exp: i.exp }); }
}

/* ----------------------------------------------------------------- redis */
class RedisKV implements KV {
  constructor(private r: Redis) {}
  get(k: string) { return this.r.get(k); }
  async set(k: string, v: string, ttl?: number) { if (ttl) await this.r.set(k, v, 'EX', ttl); else await this.r.set(k, v); }
  async del(...k: string[]) { if (k.length) await this.r.del(...k); }
  incr(k: string) { return this.r.incr(k); }
  async lpushCap(k: string, v: string, cap: number, ttl: number) { await this.r.multi().lpush(k, v).ltrim(k, 0, cap - 1).expire(k, ttl).exec(); }
  lrange(k: string, s: number, e: number) { return this.r.lrange(k, s, e); }
  async sadd(k: string, ttl: number, ...v: string[]) { if (v.length) await this.r.multi().sadd(k, ...v).expire(k, ttl).exec(); }
  smembers(k: string) { return this.r.smembers(k); }
  async hset(k: string, f: string, v: string, ttl: number) { await this.r.multi().hset(k, f, v).expire(k, ttl).exec(); }
  hgetall(k: string) { return this.r.hgetall(k); }
  async hdel(k: string, ...f: string[]) { if (f.length) await this.r.hdel(k, ...f); }
}

/* ------------------------------------------------------------- selection */
type G = { __kvRedis?: Redis | null; __kvMem?: MemKV; __kvDown?: number; __kvWarned?: number };
const g = globalThis as unknown as G;
const mem = (g.__kvMem ||= new MemKV());
const PREFIX = process.env.REDIS_PREFIX ?? 'vx:';

function redis(): Redis | null {
  if (g.__kvRedis !== undefined) return g.__kvRedis;
  const url = process.env.REDIS_URL;
  if (!url) return (g.__kvRedis = null);
  const r = new Redis(url, { maxRetriesPerRequest: 1, connectTimeout: 2000, commandTimeout: 1500, retryStrategy: t => Math.min(t * 200, 3000) });
  r.on('error', e => warn(`redis error: ${e.message}`));
  return (g.__kvRedis = r);
}
function warn(msg: string) {
  const now = Date.now();
  if (!g.__kvWarned || now - g.__kvWarned > 30_000) { g.__kvWarned = now; console.warn(`[cache] ${msg}`); }
}
async function use<T>(f: (k: KV) => Promise<T>): Promise<T> {
  const r = redis();
  if (r && Date.now() >= (g.__kvDown ?? 0)) {
    try { return await f(new RedisKV(r)); }
    catch (e) { g.__kvDown = Date.now() + 10_000; warn(`Redis unavailable, using memory for 10s (${(e as Error).message})`); }
  }
  return f(mem);
}

const K = (k: string) => PREFIX + k;
export const kv = {
  get: (k: string) => use(x => x.get(K(k))),
  set: (k: string, v: string, ttl?: number) => use(x => x.set(K(k), v, ttl)),
  del: (...k: string[]) => use(x => x.del(...k.map(K))),
  incr: (k: string) => use(x => x.incr(K(k))),
  lpushCap: (k: string, v: string, cap: number, ttl: number) => use(x => x.lpushCap(K(k), v, cap, ttl)),
  lrange: (k: string, s: number, e: number) => use(x => x.lrange(K(k), s, e)),
  sadd: (k: string, ttl: number, ...v: string[]) => use(x => x.sadd(K(k), ttl, ...v)),
  smembers: (k: string) => use(x => x.smembers(K(k))),
  hset: (k: string, f: string, v: string, ttl: number) => use(x => x.hset(K(k), f, v, ttl)),
  hgetall: (k: string) => use(x => x.hgetall(K(k))),
  hdel: (k: string, ...f: string[]) => use(x => x.hdel(K(k), ...f)),
  async getJSON<T>(k: string): Promise<T | null> {
    const s = await kv.get(k);
    if (!s) return null;
    try { return JSON.parse(s) as T; } catch { return null; }
  },
  setJSON: (k: string, v: unknown, ttl?: number) => kv.set(k, JSON.stringify(v), ttl),
  /** 'redis' when a Redis server is configured and answering, otherwise 'memory'. */
  async mode(): Promise<'redis' | 'memory'> {
    const r = redis();
    if (!r || Date.now() < (g.__kvDown ?? 0)) return 'memory';
    try { await r.ping(); return 'redis'; } catch { g.__kvDown = Date.now() + 10_000; return 'memory'; }
  },
};

/** Collapses concurrent identical loads (e.g. 20 requests hitting a cold cache) into one Google API call. */
const inflight = new Map<string, Promise<unknown>>();
export function singleflight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const cur = inflight.get(key) as Promise<T> | undefined;
  if (cur) return cur;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
