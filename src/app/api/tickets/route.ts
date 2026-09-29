import { z } from 'zod';
import { handler, audit } from '@/lib/api';
import { notify, STAFF_LEADS } from '@/lib/notify';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const body = z.object({ customerId: z.string().optional(), subject: z.string().min(1), description: z.string().min(1),
  category: z.enum(['Technical Support', 'Business Central', 'ERP', 'Application', 'Integration', 'Billing', 'General', 'Other']),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']), contractId: z.string().optional() });
export const GET = handler([], async ({ db, auth, req }) => {
  const sp = new URL(req.url).searchParams;
  let rows = await db.list('Tickets');
  if (auth.role === 'CUSTOMER') rows = rows.filter(r => r.customerId === auth.customerId);
  for (const k of ['status', 'priority', 'assignedTo', 'customerId'] as const) { const v = sp.get(k); if (v) rows = rows.filter(r => r[k] === v); }
  return { total: rows.length, rows: rows.reverse() };
});
export const POST = handler([], async c => {
  const b = body.parse(await c.req.json());
  const customerId = c.auth.role === 'CUSTOMER' ? c.auth.customerId : b.customerId;
  if (!customerId) return Response.json({ message: 'Customer is required.' }, { status: 400 });
  const now = new Date().toISOString();
  const t = await c.db.insert('Tickets', { ...b, customerId, status: 'Open', createdAt: now, updatedAt: now });
  await c.db.insert('TicketActivities', { ticketId: t.id, type: 'Ticket created', detail: b.subject, userId: c.auth.uid, createdAt: now });
  const cust = await c.db.get('Customers', customerId);
  if (c.auth.role === 'CUSTOMER') await notify(c.db, { roles: STAFF_LEADS }, { type: 'TICKET_CREATED', title: `New ticket ${t.id}`, body: `${cust?.companyName || 'Customer'}: ${b.subject}`, link: `/admin/tickets/${t.id}` }, { except: c.auth.uid });
  else await notify(c.db, { customerId }, { type: 'TICKET_CREATED', title: `Ticket ${t.id} raised for you`, body: b.subject, link: `/portal/tickets/${t.id}` }, { except: c.auth.uid });
  await audit(c, 'CREATE', 'Tickets', t.id);
  return Response.json(t, { status: 201 });
});
