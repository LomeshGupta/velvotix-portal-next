import { z } from 'zod';
import { handler, audit, STAFF, STAFF_WRITE } from '@/lib/api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const body = z.object({ customerId: z.string(), contractNumber: z.string().min(1), type: z.string(), startDate: z.string(), endDate: z.string(), billingFrequency: z.string().optional(),
  amount: z.number().min(0), tax: z.number().min(0), supportHours: z.number().min(0), sla: z.string().optional(), prioritySupport: z.boolean().optional(), notes: z.string().optional() });
const status = (end: string, warnDays: number) => { const d = (new Date(end).getTime() - Date.now()) / 864e5; return d < 0 ? 'Expired' : d <= warnDays ? 'Expiring' : 'Active'; };
export const GET = handler(STAFF, async ({ db, auth }) => {
  const warn = Number((await db.list('Settings')).find(s => s.key === 'contractWarnDays')?.value || 30);
  let rows = await db.list('SupportContracts');
  if (auth.role === 'CUSTOMER') rows = rows.filter(r => r.customerId === auth.customerId);
  return { total: rows.length, rows: rows.map(r => (['Draft', 'Cancelled'].includes(r.status) ? r : { ...r, status: status(r.endDate, warn) })) };
});
export const POST = handler(STAFF_WRITE, async c => {
  const b = body.parse(await c.req.json());
  const r = await c.db.insert('SupportContracts', { ...b, amount: String(b.amount), tax: String(b.tax), total: String(b.amount + b.tax), supportHours: String(b.supportHours),
    usedHours: '0', remainingHours: String(b.supportHours), prioritySupport: String(!!b.prioritySupport), status: 'Active', renewalDate: b.endDate });
  await audit(c, 'CREATE', 'SupportContracts', r.id);
  return Response.json(r, { status: 201 });
});
