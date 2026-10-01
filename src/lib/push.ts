import webpush from 'web-push';
import { createHash } from 'crypto';
import Redis from 'ioredis';

/**
 * Web Push (works when the app is closed; installed PWA on Android/desktop, and iOS 16.4+ once added to the Home Screen).
 * Needs VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (generate with `npx web-push generate-vapid-keys`). Without them push is simply off
 * and the in-app bell keeps working.
 */
let ready: boolean | null = null;
export function pushEnabled(): boolean {
  if (ready !== null) return ready;
  const pub = process.env.VAPID_PUBLIC_KEY, pri = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !pri) return (ready = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, pri);
  return (ready = true);
}
export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY || '';

export type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };
export type PushPayload = { title: string; body: string; url: string; tag?: string };
const TTL = 60 * 60 * 24 * 90, MAX_DEVICES = 5;
const hkey = (uid: string) => `ps:${uid}`;
const owner = (endpoint: string) => `pe:${createHash('sha1').update(endpoint).digest('hex')}`;

/**
 * Push subscriptions MUST use shared persistent Redis on production.
 * Do not fall back to Vercel function memory: each serverless invocation/instance
 * may have a different memory store, which would make registered devices randomly disappear.
 */
let pushRedis: Redis | null = null;
let pushRedisInit = false;
function getPushRedis(): Redis {
  if (pushRedisInit && pushRedis) return pushRedis;
  pushRedisInit = true;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL is required for push notifications in production.');
  pushRedis = new Redis(url, {
    maxRetriesPerRequest: 2,
    connectTimeout: 3000,
    commandTimeout: 2500,
    retryStrategy: t => Math.min(t * 250, 3000),
  });
  pushRedis.on('error', e => console.error(`[push-redis] ${e.message}`));
  return pushRedis;
}

const prefix = (k: string) => `${process.env.REDIS_PREFIX ?? 'vx:'}${k}`;
const pk = (k: string) => prefix(k);

async function redisHealth(): Promise<Redis> {
  const r = getPushRedis();
  await r.ping();
  return r;
}

/** Store a device subscription durably in shared Redis. */
export async function saveSub(uid: string, sub: PushSub, ua: string) {
  const r = await redisHealth();
  const endpointKey = pk(owner(sub.endpoint));
  const userKey = pk(hkey(uid));
  const previous = await r.get(endpointKey);
  if (previous && previous !== uid) await r.hdel(pk(hkey(previous)), sub.endpoint);

  const value = JSON.stringify({ sub, ua: ua.slice(0, 120), at: Date.now() });
  await r.multi()
    .hset(userKey, sub.endpoint, value)
    .expire(userKey, TTL)
    .set(endpointKey, uid, 'EX', TTL)
    .exec();

  const all = await r.hgetall(userKey);
  const extra = Object.entries(all)
    .map(([e, v]) => [e, (JSON.parse(v) as { at: number }).at] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(MAX_DEVICES)
    .map(x => x[0]);
  if (extra.length) await r.hdel(userKey, ...extra);
}

export async function removeSub(uid: string, endpoint: string) {
  const r = await redisHealth();
  await r.hdel(pk(hkey(uid)), endpoint);
  await r.del(pk(owner(endpoint)));
}

/** Deliver to every device of a user. Expired/invalid subscriptions (404/410) are deleted automatically. */
export async function pushToUser(uid: string, payload: PushPayload): Promise<void> {
  if (!pushEnabled()) return;
  const r = await redisHealth();
  const subs = await r.hgetall(pk(hkey(uid)));
  await Promise.allSettled(Object.entries(subs).map(async ([endpoint, raw]) => {
    try {
      await webpush.sendNotification(
        (JSON.parse(raw) as { sub: PushSub }).sub,
        JSON.stringify(payload),
        { TTL: 60 * 60 * 24, urgency: 'normal', timeout: 8000 },
      );
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await r.hdel(pk(hkey(uid)), endpoint);
        await r.del(pk(owner(endpoint)));
      } else {
        console.warn(`[push] send failed (${code ?? (e as Error).message})`);
      }
    }
  }));
}
