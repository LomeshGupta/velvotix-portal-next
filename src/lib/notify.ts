import { randomUUID } from 'crypto';
import { pushToUser } from './push';
import type { Store } from './store';

export type Notif = { id: string; type: string; title: string; body: string; link: string; at: string; read: boolean };
export type Audience = { users?: (string | undefined)[]; roles?: readonly string[]; customerId?: string };
const CAP = 50;
export const STAFF_LEADS = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] as const;
export const FINANCE = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTS'] as const;

/**
 * Persistent notification history is stored in the existing Google Sheets database.
 * Web Push is a delivery channel; the sheet remains the source of truth for history/unread state.
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

    const now = new Date().toISOString();
    const rows = [...want].map(uid => ({
      id: randomUUID(), userId: uid, type: n.type, title: n.title,
      body: n.body || '', link: n.link || '/', read: 'false', createdAt: now,
    }));
    await db.insertMany('Notifications', rows);

    // Keep the sheet bounded per user. This is intentionally best-effort so notification
    // delivery can never break the underlying business transaction.
    try {
      const all = await db.list('Notifications');
      for (const uid of want) {
        const old = all.filter(r => r.userId === uid).sort((a,b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
        for (const row of old.slice(CAP)) await db.remove('Notifications', row.id);
      }
    } catch (e) { console.warn('[notify] history cleanup failed', e); }

    await Promise.allSettled([...want].map(uid => pushToUser(uid, {
      title: n.title,
      body: n.body || '',
      url: n.link || '/',
      tag: n.link || n.type,
    })));
  } catch (e) {
    console.error('[notify] failed', e);
  }
}

export type NotifState = { v: number; changed?: false; unread?: number; items?: Notif[] };
export async function getState(db: Store, uid: string, sinceV?: number): Promise<NotifState> {
  const rows = (await db.list('Notifications'))
    .filter(r => r.userId === uid)
    .sort((a,b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))
    .slice(0, CAP);
  const v = rows.length ? Date.parse(rows[0].createdAt || '') || 0 : 0;
  if (sinceV !== undefined && sinceV === v) return { v, changed: false };
  return {
    v,
    unread: rows.filter(r => r.read !== 'true').length,
    items: rows.map(r => ({ id:r.id, type:r.type, title:r.title, body:r.body, link:r.link || '/', at:r.createdAt, read:r.read === 'true' })),
  };
}
export async function markRead(db: Store, uid: string, ids: string[]) {
  const rows = await db.list('Notifications');
  await Promise.all(rows.filter(r => r.userId === uid && ids.includes(r.id)).map(r => db.update('Notifications', r.id, { read:'true' })));
}
export async function markAllRead(db: Store, uid: string) {
  const rows = await db.list('Notifications');
  await Promise.all(rows.filter(r => r.userId === uid && r.read !== 'true').map(r => db.update('Notifications', r.id, { read:'true' })));
}
