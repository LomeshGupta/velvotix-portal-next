import { z } from 'zod';
import { handler } from '@/lib/api';
import { notify, STAFF_LEADS } from '@/lib/notify';
import { SUPPORT_VIEW } from '@/lib/roles';
export const runtime = 'nodejs';
const body = z.object({ message: z.string().min(1).max(5000), isInternal: z.boolean().optional() });
export const POST = handler([...SUPPORT_VIEW, 'CUSTOMER'], async c => {
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
    const preview = b.message.length > 90 ? `${b.message.slice(0, 90)}...` : b.message;
    if (cust) await notify(c.db, t.assignedTo ? { users: [t.assignedTo] } : { roles: STAFF_LEADS }, { type: 'TICKET_REPLY', title: `Customer replied on ${t.id}`, body: preview, link: `/admin/tickets/${t.id}` }, { except: c.auth.uid });
    else await notify(c.db, { customerId: t.customerId }, { type: 'TICKET_REPLY', title: `New reply on ${t.id}`, body: preview, link: `/portal/tickets/${t.id}` }, { except: c.auth.uid });
  } else await notify(c.db, { users: [t.assignedTo] }, { type: 'TICKET_NOTE', title: `Internal note on ${t.id}`, body: t.subject, link: `/admin/tickets/${t.id}` }, { except: c.auth.uid });
  await c.db.update('Tickets', t.id, { updatedAt: now, ...(cust && t.status === 'Waiting for Customer' ? { status: 'In Progress' } : {}) });
  return Response.json(m, { status: 201 });
});
