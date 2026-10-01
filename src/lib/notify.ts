import * as server from 'next/server';
import { randomUUID } from 'crypto';
import { kv } from './cache';
import { pushToUser } from './push';
import type { Store } from './store';

export type Notif = { id: string; type: string; title: string; body: string; link: string; at: string; read: boolean };
export type Audience = { users?: (string | undefined)[]; roles?: readonly string[]; customerId?: string };
const CAP = 50, TTL = 60 * 60 * 24 * 30;
export const STAFF_LEADS = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] as const;
export const FINANCE = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTS'] as const;

/** Run work after the response is sent (Next `after`), falling back to fire-and-forget on older versions. */
function afterResponse(fn: () => Promise<void>) {
  const run = () => fn().catch(e => console.error('[after]', e));
  const a = (server as unknown as { after?: (f: () => Promise<void>) => void }).after;
  if (a) { try { a(run); return; } catch { /* outside a request scope */ } }
  void run();
}

/**
 * Create a notification for everyone in the audience (active users only, never the actor).
 * Stored in Redis per user (last 50, 30 days), plus Web Push to their devices. Never throws: a notification problem must not fail the business action.
 */
export async function notify(db: Store, aud: Audience, n: { type: string; title: string; body?: string; link?: string }, opts: { except?: string } = {}): Promise<void> {
  try {
    const want = new Set<string>();
    for (const u of await db.list('Users')) {
      if (u.active !== 'true') continue;
      if (aud.users?.includes(u.id) || aud.roles?.includes(u.role) || (aud.customerId && u.role === 'CUSTOMER' && u.customerId === aud.customerId)) want.add(u.id);
    }
    if (opts.except) want.delete(opts.except);
    if (!want.size) return;
    const item = { type: n.type, title: n.title, body: n.body || '', link: n.link || '', at: new Date().toISOString() };
    await Promise.all([...want].map(async uid => {
      await kv.lpushCap(`n:${uid}`, JSON.stringify({ ...item, id: randomUUID() }), CAP, TTL);
      await kv.incr(`nv:${uid}`);
    }));
    // Await the push send attempt. This makes the admin test endpoint and
    // normal business notifications observable/reliable on serverless hosts
    // where fire-and-forget work can be terminated with the request. Push
    // failures are still isolated from the business operation.
    await Promise.allSettled([...want].map(uid =>
      pushToUser(uid, { title: item.title, body: item.body, url: item.link || '/', tag: item.link || item.type })
    ));
  } catch (e) { console.error('[notify] failed', e); }
}

export type NotifState = { v: number; changed?: false; unread?: number; items?: Notif[] };
/** Cheap when nothing changed: with `sinceV` equal to the current version only one Redis read happens and no list is returned. */
export async function getState(uid: string, sinceV?: number): Promise<NotifState> {
  const v = Number((await kv.get(`nv:${uid}`)) ?? 0);
  if (sinceV !== undefined && sinceV === v) return { v, changed: false };
  const [raw, readIds, readAll] = await Promise.all([kv.lrange(`n:${uid}`, 0, CAP - 1), kv.smembers(`nr:${uid}`), kv.get(`na:${uid}`)]);
  const seen = new Set(readIds), upTo = Number(readAll ?? 0);
  const items: Notif[] = [];
  for (const r of raw) { try { const x = JSON.parse(r) as Omit<Notif, 'read'>; items.push({ ...x, read: seen.has(x.id) || Date.parse(x.at) <= upTo }); } catch { /* skip corrupt entry */ } }
  return { v, unread: items.filter(i => !i.read).length, items };
}
export async function markRead(uid: string, ids: string[]) { if (ids.length) { await kv.sadd(`nr:${uid}`, TTL, ...ids.slice(0, CAP)); await kv.incr(`nv:${uid}`); } }
export async function markAllRead(uid: string) { await kv.set(`na:${uid}`, String(Date.now()), TTL); await kv.del(`nr:${uid}`); await kv.incr(`nv:${uid}`); }
