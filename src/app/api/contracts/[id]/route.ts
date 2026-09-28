import { z } from 'zod';
import { handler, audit, STAFF_WRITE } from '@/lib/api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const body = z.object({
  contractNumber: z.string().trim().min(1), type: z.string().trim().min(1), startDate: z.string().min(1), endDate: z.string().min(1),
  billingFrequency: z.string(), amount: z.number().min(0), tax: z.number().min(0), supportHours: z.number().min(0), sla: z.string(),
  prioritySupport: z.boolean(), notes: z.string(), status: z.enum(['Active', 'Cancelled']),
}).partial();
/** Edit a contract, or set status Cancelled / Active (Active is re-derived from the end date on read). */
export const PUT = handler(STAFF_WRITE, async c => {
  const b = body.parse(await c.req.json());
  const cur = await c.db.get('SupportContracts', c.params.id);
  if (!cur) return Response.json({ message: 'Contract not found.' }, { status: 404 });
  const m = { ...cur, ...Object.fromEntries(Object.entries(b).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : String(v)])) };
  if (new Date(m.endDate) < new Date(m.startDate)) return Response.json({ message: 'Contract end date cannot be before start date.' }, { status: 400 });
  if (b.contractNumber && (await c.db.list('SupportContracts')).some(x => x.id !== cur.id && x.contractNumber.trim().toLowerCase() === b.contractNumber!.toLowerCase()))
    return Response.json({ message: 'A contract with this contract number already exists.' }, { status: 409 });
  const total = Number(m.amount || 0) + Number(m.tax || 0);
  const r = await c.db.update('SupportContracts', cur.id, { ...m, total: String(total), remainingHours: String(Math.max(0, Number(m.supportHours || 0) - Number(m.usedHours || 0))), renewalDate: m.endDate });
  await audit(c, b.status === 'Cancelled' ? 'CANCEL' : 'UPDATE', 'SupportContracts', cur.id);
  return r;
});
