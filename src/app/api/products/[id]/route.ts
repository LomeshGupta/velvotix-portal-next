import { z } from 'zod';
import { handler, audit } from '@/lib/api';
import { ADMINS } from '@/lib/roles';
import { PRODUCT_CATEGORIES } from '@/lib/industries';
export const runtime = 'nodejs';
const body = z.object({
  name: z.string().trim().min(1).max(80), description: z.string().trim().max(300), category: z.enum(PRODUCT_CATEGORIES),
  rate: z.number().min(0), hsnSac: z.string().trim().max(20), gstPercent: z.number().min(0).max(100), active: z.boolean(),
}).partial();
/** Edit price/details or enable-disable a product / service. Admins only, same as create. */
export const PUT = handler(ADMINS, async c => {
  const b = body.parse(await c.req.json());
  const cur = await c.db.get('Products', c.params.id);
  if (!cur) return Response.json({ message: 'Product not found.' }, { status: 404 });
  if (b.name && (await c.db.list('Products')).some(p => p.id !== cur.id && p.name.trim().toLowerCase() === b.name!.toLowerCase()))
    return Response.json({ message: 'A product / service with this name already exists.' }, { status: 409 });
  const patch: Record<string, string> = {};
  if (b.name !== undefined) patch.name = b.name;
  if (b.description !== undefined) patch.description = b.description;
  if (b.category !== undefined) patch.category = b.category;
  if (b.rate !== undefined) patch.rate = String(b.rate);
  if (b.hsnSac !== undefined) patch.hsnSac = b.hsnSac;
  if (b.gstPercent !== undefined) patch.gstPercent = String(b.gstPercent);
  if (b.active !== undefined) patch.active = String(b.active);
  const r = await c.db.update('Products', cur.id, patch);
  await audit(c, 'UPDATE', 'Products', cur.id);
  return { id: r.id, name: r.name, description: r.description, category: r.category, rate: Number(r.rate || 0), hsnSac: r.hsnSac || '', gstPercent: Number(r.gstPercent || 18), active: r.active !== 'false' };
});
