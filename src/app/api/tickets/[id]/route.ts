import { z } from 'zod';
import { handler, audit } from '@/lib/api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = handler([], async ({ db, auth, params }) => {
  const t = await db.get('Tickets', params.id);
  if (!t || (auth.role === 'CUSTOMER' && t.customerId !== auth.customerId)) return Response.json({ message: 'Ticket not found.' }, { status: 404 });
  const [msgs, acts] = await Promise.all([db.list('TicketMessages'), db.list('TicketActivities')]);
  const isCust = auth.role === 'CUSTOMER';
  return { ticket: t,
    messages: msgs.filter(m => m.ticketId === t.id && !(isCust && m.isInternal === 'true')), // internal notes never reach customers
    activities: acts.filter(a => a.ticketId === t.id) };
});
const upd = z.object({ status: z.enum(['Open', 'Assigned', 'In Progress', 'Waiting for Customer', 'Resolved', 'Closed']).optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(), assignedTo: z.string().optional() });
export const PUT = handler(['SUPER_ADMIN', 'ADMIN', 'SUPPORT'], async c => {
  const b = upd.parse(await c.req.json());
  const old = await c.db.get('Tickets', c.params.id);
  if (!old) return Response.json({ message: 'Ticket not found.' }, { status: 404 });
  const now = new Date().toISOString();
  const patch: Record<string, string> = { updatedAt: now };
  const log = (type: string, detail: string) => c.db.insert('TicketActivities', { ticketId: old.id, type, detail, userId: c.auth.uid, createdAt: now });
  if (b.status && b.status !== old.status) { patch.status = b.status; if (b.status === 'Resolved') patch.resolvedAt = now; if (b.status === 'Closed') patch.closedAt = now; await log('Status changed', `${old.status} -> ${b.status}`); }
  if (b.priority && b.priority !== old.priority) { patch.priority = b.priority; await log('Priority changed', `${old.priority} -> ${b.priority}`); }
  if (b.assignedTo !== undefined && b.assignedTo !== old.assignedTo) { patch.assignedTo = b.assignedTo; if (old.status === 'Open' && !b.status) patch.status = 'Assigned'; await log('Assigned', b.assignedTo); }
  const r = await c.db.update('Tickets', old.id, patch);
  await audit(c, 'UPDATE', 'Tickets', old.id);
  return r;
});
