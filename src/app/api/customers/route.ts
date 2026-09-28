import { z } from 'zod';
import { handler, audit, STAFF, STAFF_WRITE } from '@/lib/api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const customerSchema = z.object({
  companyName: z.string().min(1), type: z.enum(['B2B', 'B2C']).default('B2B'), gstin: z.string().optional(), pan: z.string().optional(),
  contactPerson: z.string().optional(), email: z.string().email(), phone: z.string().optional(), altPhone: z.string().optional(),
  billingAddress: z.string().optional(), shippingAddress: z.string().optional(), city: z.string().optional(), state: z.string().optional(),
  country: z.string().optional(), pin: z.string().optional(), status: z.enum(['Active', 'Inactive']).default('Active'), notes: z.string().optional(),
});
export const GET = handler(STAFF, async ({ db, auth, req }) => {
  const sp = new URL(req.url).searchParams;
  let rows = await db.list('Customers');
  if (auth.role === 'CUSTOMER') rows = rows.filter(r => r.id === auth.customerId);
  const t = (sp.get('search') || '').toLowerCase();
  if (t) rows = rows.filter(r => `${r.id} ${r.companyName} ${r.email} ${r.gstin}`.toLowerCase().includes(t));
  const p = Math.max(1, +(sp.get('page') || 1)), n = Math.min(100, +(sp.get('pageSize') || 20));
  return { total: rows.length, rows: rows.slice((p - 1) * n, p * n) };
});
export const POST = handler(STAFF_WRITE, async c => {
  const r = await c.db.insert('Customers', { ...customerSchema.parse(await c.req.json()), customerSince: new Date().toISOString().slice(0, 10) });
  await audit(c, 'CREATE', 'Customers', r.id);
  return Response.json(r, { status: 201 });
});
