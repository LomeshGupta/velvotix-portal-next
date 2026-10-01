import { z } from 'zod';
import { handler, audit } from '@/lib/api';
import { PURCHASE_WRITE } from '@/lib/roles';
export const runtime = 'nodejs';
const body = z.object({
  name: z.string().trim().min(1), gstin: z.string().trim(), pan: z.string().trim(), contactPerson: z.string().trim(), email: z.string().trim(), phone: z.string().trim(),
  address: z.string().trim(), city: z.string().trim(), state: z.string().trim(), country: z.string().trim(), pin: z.string().trim(), notes: z.string().trim(), status: z.enum(['Active', 'Inactive']),
}).partial();
export const PUT = handler(PURCHASE_WRITE, async c => {
  const b = body.parse(await c.req.json());
  const cur = await c.db.get('Vendors', c.params.id);
  if (!cur) return Response.json({ message: 'Vendor not found.' }, { status: 404 });
  const r = await c.db.update('Vendors', cur.id, b);
  await audit(c, 'UPDATE', 'Vendors', cur.id);
  return r;
});
