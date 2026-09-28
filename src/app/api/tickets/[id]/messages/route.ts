import { z } from 'zod';
import { handler } from '@/lib/api';
export const runtime = 'nodejs';
const body = z.object({ message: z.string().min(1).max(5000), isInternal: z.boolean().optional() });
export const POST = handler([], async c => {
  const b = body.parse(await c.req.json());
  const t = await c.db.get('Tickets', c.params.id);
  const cust = c.auth.role === 'CUSTOMER';
  if (!t || (cust && t.customerId !== c.auth.customerId)) return Response.json({ message: 'Ticket not found.' }, { status: 404 });
  const now = new Date().toISOString();
  const internal = !cust && !!b.isInternal; // customers can never post internal notes
  const m = await c.db.insert('TicketMessages', { ticketId: t.id, senderUserId: c.auth.uid, senderType: cust ? 'CUSTOMER' : 'STAFF', message: b.message,
    messageType: internal ? 'NOTE' : 'REPLY', isInternal: String(internal), createdAt: now });
  if (!internal) {
    await c.db.insert('TicketActivities', { ticketId: t.id, type: cust ? 'Customer replied' : 'Staff replied', detail: '', userId: c.auth.uid, createdAt: now });
    await c.db.insert('Notifications', { userId: '', type: 'TICKET_REPLY', title: `Reply on ${t.id}`, body: t.subject, read: 'false', createdAt: now });
  }
  await c.db.update('Tickets', t.id, { updatedAt: now, ...(cust && t.status === 'Waiting for Customer' ? { status: 'In Progress' } : {}) });
  return Response.json(m, { status: 201 });
});
