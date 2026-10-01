import { z } from 'zod';
import { handler, audit } from '@/lib/api';
import { ADMINS, SUPPORT_VIEW } from '@/lib/roles';
import { PRODUCT_CATEGORIES } from '@/lib/industries';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Product / service master used to tag contracts AND to price invoice lines. Reuses the existing Products sheet ('active' is the status). */
export const GET = handler([...SUPPORT_VIEW, 'ACCOUNTS'], async ({ db }) => ({
  rows: (await db.list('Products')).map(p => ({ id: p.id, name: p.name, description: p.description || '', category: p.category || 'Other',
    rate: Number(p.rate || 0), hsnSac: p.hsnSac || '', gstPercent: Number(p.gstPercent || 18), active: p.active !== 'false' })),
}));
const body = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80).refine(v => !v.includes('|'), 'Name cannot contain the | character'),
  description: z.string().trim().max(300).optional(), category: z.enum(PRODUCT_CATEGORIES).default('Other'),
  rate: z.number().min(0).default(0), hsnSac: z.string().trim().max(20).optional(), gstPercent: z.number().min(0).max(100).default(18),
});
export const POST = handler(ADMINS, async c => {
  const b = body.parse(await c.req.json());
  if ((await c.db.list('Products')).some(p => p.name.trim().toLowerCase() === b.name.toLowerCase())) return Response.json({ message: 'A product / service with this name already exists.' }, { status: 409 });
  const p = await c.db.insert('Products', { name: b.name, description: b.description || '', category: b.category, rate: String(b.rate), hsnSac: b.hsnSac || '', gstPercent: String(b.gstPercent), active: 'true' });
  await audit(c, 'CREATE', 'Products', p.id);
  return Response.json({ id: p.id, name: p.name, description: p.description, category: p.category, rate: b.rate, hsnSac: b.hsnSac || '', gstPercent: b.gstPercent, active: true }, { status: 201 });
});
