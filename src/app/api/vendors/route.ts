import { z } from 'zod';
import { handler, audit } from '@/lib/api';
import { PURCHASE_VIEW, PURCHASE_WRITE } from '@/lib/roles';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = handler(PURCHASE_VIEW, async ({ db, req }) => {
  const q = (new URL(req.url).searchParams.get('search') || '').toLowerCase();
  let rows = await db.list('Vendors');
  if (q) rows = rows.filter(v => `${v.id} ${v.name} ${v.email} ${v.gstin}`.toLowerCase().includes(q));
  return { rows };
});
const body = z.object({
  name: z.string().trim().min(1, 'Name is required'), gstin: z.string().trim().optional(), pan: z.string().trim().optional(), contactPerson: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal('')), phone: z.string().trim().optional(), address: z.string().trim().optional(), city: z.string().trim().optional(),
  state: z.string().trim().optional(), country: z.string().trim().optional(), pin: z.string().trim().optional(), notes: z.string().trim().optional(),
});
export const POST = handler(PURCHASE_WRITE, async c => {
  const b = body.parse(await c.req.json());
  if ((await c.db.list('Vendors')).some(v => v.name.trim().toLowerCase() === b.name.toLowerCase())) return Response.json({ message: 'A vendor with this name already exists.' }, { status: 409 });
  const v = await c.db.insert('Vendors', { ...b, status: 'Active', createdAt: new Date().toISOString() });
  await audit(c, 'CREATE', 'Vendors', v.id);
  return Response.json(v, { status: 201 });
});
