import { handler, audit, STAFF, STAFF_WRITE } from '@/lib/api';
import { z } from 'zod';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const upd = z.object({ companyName: z.string(), type: z.enum(['B2B', 'B2C']), gstin: z.string(), pan: z.string(), contactPerson: z.string(), email: z.string().email(),
  phone: z.string(), altPhone: z.string(), billingAddress: z.string(), shippingAddress: z.string(), city: z.string(), state: z.string(), country: z.string(),
  pin: z.string(), status: z.enum(['Active', 'Inactive']), notes: z.string() }).partial();
export const GET = handler(STAFF, async ({ db, auth, params }) => {
  if (auth.role === 'CUSTOMER' && auth.customerId !== params.id) return Response.json({ message: 'Not permitted.' }, { status: 403 });
  const r = await db.get('Customers', params.id);
  return r ?? Response.json({ message: 'Customer not found.' }, { status: 404 });
});
export const PUT = handler(STAFF_WRITE, async c => {
  const r = await c.db.update('Customers', c.params.id, upd.parse(await c.req.json()));
  await audit(c, 'UPDATE', 'Customers', r.id);
  return r;
});
