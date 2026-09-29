import webpush from 'web-push';
import { createHash } from 'crypto';
import { kv } from './cache';

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

/** Store a device subscription for a user. A browser belongs to ONE user: if it was registered to someone else, that link is removed. */
export async function saveSub(uid: string, sub: PushSub, ua: string) {
  const prev = await kv.get(owner(sub.endpoint));
  if (prev && prev !== uid) await kv.hdel(hkey(prev), sub.endpoint);
  await kv.hset(hkey(uid), sub.endpoint, JSON.stringify({ sub, ua: ua.slice(0, 120), at: Date.now() }), TTL);
  await kv.set(owner(sub.endpoint), uid, TTL);
  const all = await kv.hgetall(hkey(uid)); // keep the newest few devices only
  const extra = Object.entries(all).map(([e, v]) => [e, (JSON.parse(v) as { at: number }).at] as const).sort((a, b) => b[1] - a[1]).slice(MAX_DEVICES).map(x => x[0]);
  if (extra.length) await kv.hdel(hkey(uid), ...extra);
}
export async function removeSub(uid: string, endpoint: string) { await kv.hdel(hkey(uid), endpoint); await kv.del(owner(endpoint)); }

/** Deliver to every device of a user. Expired/invalid subscriptions (404/410) are deleted automatically. */
export async function pushToUser(uid: string, payload: PushPayload): Promise<void> {
  if (!pushEnabled()) return;
  const subs = await kv.hgetall(hkey(uid));
  await Promise.allSettled(Object.entries(subs).map(async ([endpoint, raw]) => {
    try {
      await webpush.sendNotification((JSON.parse(raw) as { sub: PushSub }).sub, JSON.stringify(payload), { TTL: 60 * 60 * 24, urgency: 'normal', timeout: 5000 });
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await removeSub(uid, endpoint);
      else console.warn(`[push] send failed (${code ?? (e as Error).message})`);
    }
  }));
}
