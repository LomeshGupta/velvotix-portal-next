import { z } from 'zod';
import { handler, audit } from '@/lib/api';
import { hoursSummary } from '@/lib/hours';
import { notify } from '@/lib/notify';
import { SUPPORT_VIEW } from '@/lib/roles';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = handler([...SUPPORT_VIEW, 'CUSTOMER'], async ({ db, auth, params }) => {
  if (auth.role === 'CUSTOMER' && auth.customerId !== params.id) return Response.json({ message: 'Not permitted.' }, { status: 403 });
  const ledger = (await db.list('HoursLedger')).filter(l => l.customerId === params.id);
  return { summary: hoursSummary(ledger), ledger: ledger.reverse() };
});
const body = z.object({ hours: z.number().positive(), validTill: z.string().min(8), note: z.string().optional() });
export const POST = handler(['SUPER_ADMIN', 'ADMIN'], async c => {
  const b = body.parse(await c.req.json());
  if (!(await c.db.get('Customers', c.params.id))) return Response.json({ message: 'Customer not found.' }, { status: 404 });
  const r = await c.db.insert('HoursLedger', { customerId: c.params.id, type: 'ADD', hours: String(b.hours), validTill: b.validTill, note: b.note, createdBy: c.auth.uid, createdAt: new Date().toISOString() });
  await notify(c.db, { customerId: c.params.id }, { type: 'HOURS_ADDED', title: `${b.hours} support hours added`, body: `Valid till ${b.validTill}`, link: '/portal/tickets' }, { except: c.auth.uid });
  await audit(c, 'ADD_HOURS', 'HoursLedger', r.id);
  return Response.json(r, { status: 201 });
});
