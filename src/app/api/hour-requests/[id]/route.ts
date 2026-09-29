import { z } from 'zod';
import { handler, audit } from '@/lib/api';
import { hoursSummary } from '@/lib/hours';
import { notify } from '@/lib/notify';
export const runtime = 'nodejs';
const body = z.object({ decision: z.enum(['Approved', 'Rejected']) });
/** Approval by an admin OR the customer who owns the ticket. Approval deducts from the balance. */
export const PUT = handler([], async c => {
  const { decision } = body.parse(await c.req.json());
  const r = await c.db.get('HourRequests', c.params.id);
  if (!r) return Response.json({ message: 'Request not found.' }, { status: 404 });
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(c.auth.role), isOwner = c.auth.role === 'CUSTOMER' && c.auth.customerId === r.customerId;
  if (!isAdmin && !isOwner) return Response.json({ message: 'Not permitted.' }, { status: 403 });
  if (r.status !== 'Pending') return Response.json({ message: 'Request already decided.' }, { status: 400 });
  const now = new Date().toISOString();
  if (decision === 'Approved') {
    const sm = hoursSummary((await c.db.list('HoursLedger')).filter(l => l.customerId === r.customerId));
    if (Number(r.hours) > sm.remaining) return Response.json({ message: `Insufficient hours (${sm.remaining} remaining). Add hours first.` }, { status: 400 });
    await c.db.insert('HoursLedger', { customerId: r.customerId, type: 'USE', hours: r.hours, ticketId: r.ticketId, requestId: r.id, note: r.reason, createdBy: c.auth.uid, createdAt: now });
  }
  const upd = await c.db.update('HourRequests', r.id, { status: decision, decidedBy: c.auth.uid, decidedAt: now });
  await c.db.insert('TicketActivities', { ticketId: r.ticketId, type: `Hours ${decision.toLowerCase()}`, detail: `${r.hours}h`, userId: c.auth.uid, createdAt: now });
  const n = { type: `HOURS_${decision.toUpperCase()}`, title: `${r.hours}h ${decision.toLowerCase()} on ${r.ticketId}`, body: r.reason, link: `/admin/tickets/${r.ticketId}` };
  await notify(c.db, { users: [r.requestedBy], roles: ['SUPER_ADMIN', 'ADMIN'] }, n, { except: c.auth.uid });
  await audit(c, decision.toUpperCase(), 'HourRequests', r.id);
  return upd;
});
