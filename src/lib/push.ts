import webpush from 'web-push';
import { createStore } from './store';

/**
 * Production Web Push backed by the application's existing Google Sheets store.
 * No Redis is required. Subscriptions are persisted in PushSubscriptions.
 */
let ready: boolean | null = null;
export function pushEnabled(): boolean {
  if (ready !== null) return ready;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const pri = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !pri) return (ready = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, pri);
  return (ready = true);
}
export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY || '';

export type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };
export type PushPayload = { title: string; body: string; url: string; tag?: string };

async function store() {
  const db = createStore();
  await db.init();
  return db;
}

/** Store/update one device. Endpoint is the stable device key. */
export async function saveSub(uid: string, sub: PushSub, ua: string) {
  const db = await store();
  const all = await db.list('PushSubscriptions');
  const existing = all.find(r => r.endpoint === sub.endpoint);
  const now = new Date().toISOString();
  const patch = {
    userId: uid,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    userAgent: ua.slice(0, 500),
    platform: /iphone|ipad|ipod/i.test(ua) ? 'iOS' : /android/i.test(ua) ? 'Android' : 'Web',
    enabled: 'true',
    updatedAt: now,
    createdAt: existing?.createdAt || now,
  };
  if (existing) await db.update('PushSubscriptions', existing.id, patch);
  else await db.insert('PushSubscriptions', patch);

  // Keep a practical per-user device limit without deleting another user's device.
  const current = (await db.list('PushSubscriptions'))
    .filter(r => r.userId === uid && r.enabled === 'true')
    .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || '') - Date.parse(a.updatedAt || a.createdAt || ''));
  if (current.length > 5) {
    for (const row of current.slice(5)) await db.remove('PushSubscriptions', row.id);
  }
}

export async function removeSub(uid: string, endpoint: string) {
  const db = await store();
  const rows = await db.list('PushSubscriptions');
  const matches = rows.filter(r => r.userId === uid && r.endpoint === endpoint);
  for (const row of matches) await db.remove('PushSubscriptions', row.id);
}

/** Deliver to every enabled device of a user. Invalid subscriptions are removed. */
export async function pushToUser(uid: string, payload: PushPayload): Promise<void> {
  if (!pushEnabled()) return;
  const db = await store();
  const rows = (await db.list('PushSubscriptions')).filter(r => r.userId === uid && r.enabled === 'true');
  if (!rows.length) return;

  await Promise.allSettled(rows.map(async row => {
    const sub: PushSub = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload), {
        TTL: 60 * 60 * 24,
        urgency: 'normal',
        timeout: 8000,
      });
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        // Browser/provider says this subscription no longer exists.
        await db.remove('PushSubscriptions', row.id);
      } else {
        console.warn(`[push] send failed (${code ?? (e as Error).message}) for ${row.id}`);
      }
    }
  }));
}
