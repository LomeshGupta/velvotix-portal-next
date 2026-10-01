import { z } from 'zod';
import { handler } from '@/lib/api';
import { getState, markAllRead, markRead } from '@/lib/notify';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** GET /api/notifications[?v=12]  -> { v, changed:false } when nothing new, else { v, unread, items }. Never touches Google Sheets. */
export const GET = handler([], async ({ auth, req, db }) => {
  const v = new URL(req.url).searchParams.get('v');
  return getState(db, auth.uid, v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);
});
const body = z.union([z.object({ action: z.literal('read'), ids: z.array(z.string()).max(100) }), z.object({ action: z.literal('readAll') })]);
export const POST = handler([], async ({ auth, req, db }) => {
  const b = body.parse(await req.json());
  if (b.action === 'readAll') await markAllRead(db, auth.uid); else await markRead(db, auth.uid, b.ids);
  return getState(db, auth.uid);
});
