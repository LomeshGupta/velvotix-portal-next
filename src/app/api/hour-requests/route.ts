import { z } from 'zod';
import { handler, audit, STAFF } from '@/lib/api';
import { hoursSummary } from '@/lib/hours';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = handler([], async ({ db, auth, req }) => {
  const sp = new URL(req.url).searchParams;
  let rows = await db.list('HourRequests');
  if (auth.role === 'CUSTOMER') rows = rows.filter(r => r.customerId === auth.customerId);
  for (const k of ['ticketId', 'status', 'customerId'] as const) { const v = sp.get(k); if (v) rows = rows.filter(r => r[k] === v); }
  const users = await db.list('Users');
  const out: Record<string, unknown> = { me: { id: auth.uid, role: auth.role }, rows: rows.reverse().map(r => ({ ...r, requestedByName: users.find(u => u.id === r.requestedBy)?.name || r.requestedBy })) };
  // Ticket screen needs the balance too: return it here so the panel makes ONE call instead of three (me + requests + hours).
  const tid = sp.get('ticketId');
  if (tid) {
    const t = await db.get('Tickets', tid);
    if (t && (auth.role !== 'CUSTOMER' || t.customerId === auth.customerId))
      out.summary = hoursSummary((await db.list('HoursLedger')).filter(l => l.customerId === t.customerId));
  }
  return out;
});
const body = z.object({ ticketId: z.string(), hours: z.number().positive().max(500), reason: z.string().min(3) });
/** Only the assigned user (or an admin) may raise a request for a ticket. */
export const POST = handler(STAFF, async c => {
  const b = body.parse(await c.req.json());
  const t = await c.db.get('Tickets', b.ticketId);
  if (!t) return Response.json({ message: 'Ticket not found.' }, { status: 404 });
  if (t.assignedTo !== c.auth.uid && !['SUPER_ADMIN', 'ADMIN'].includes(c.auth.role)) return Response.json({ message: 'Only the assigned user can request hours.' }, { status: 403 });
  const now = new Date().toISOString();
  const r = await c.db.insert('HourRequests', { customerId: t.customerId, ticketId: t.id, requestedBy: c.auth.uid, hours: String(b.hours), reason: b.reason, status: 'Pending', createdAt: now });
  await c.db.insert('TicketActivities', { ticketId: t.id, type: 'Hours requested', detail: `${b.hours}h`, userId: c.auth.uid, createdAt: now });
  await c.db.insert('Notifications', { userId: '', type: 'HOURS_REQUEST', title: `Hours requested on ${t.id}`, body: b.reason, read: 'false', createdAt: now });
  await audit(c, 'REQUEST_HOURS', 'HourRequests', r.id);
  return Response.json(r, { status: 201 });
});
