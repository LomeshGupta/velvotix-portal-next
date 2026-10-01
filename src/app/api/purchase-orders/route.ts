import { z } from 'zod';
import { handler, audit } from '@/lib/api';
import { PURCHASE_VIEW, PURCHASE_WRITE } from '@/lib/roles';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const r2 = (n: number) => Math.round(n * 100) / 100;
export const GET = handler(PURCHASE_VIEW, async ({ db, req }) => {
  const vid = new URL(req.url).searchParams.get('vendorId');
  const [rows, vendors] = await Promise.all([db.list('PurchaseOrders'), db.list('Vendors')]);
  const names = new Map(vendors.map(v => [v.id, v.name]));
  const filtered = (vid ? rows.filter(r => r.vendorId === vid) : rows).map(r => ({ ...r, vendorName: names.get(r.vendorId) || r.vendorId }));
  return { rows: filtered.reverse() };
});
const body = z.object({
  vendorId: z.string().min(1, 'Vendor is required'), date: z.string().min(1), expectedDate: z.string().optional(), notes: z.string().optional(),
  items: z.array(z.object({ description: z.string().min(1), qty: z.number().positive(), rate: z.number().min(0), taxPercent: z.number().min(0).max(100) })).min(1),
});
export const POST = handler(PURCHASE_WRITE, async c => {
  const b = body.parse(await c.req.json());
  if (!(await c.db.get('Vendors', b.vendorId))) return Response.json({ message: 'Vendor not found.' }, { status: 404 });
  const subtotal = r2(b.items.reduce((a, i) => a + i.qty * i.rate, 0));
  const tax = r2(b.items.reduce((a, i) => a + (i.qty * i.rate * i.taxPercent) / 100, 0));
  const po = await c.db.insert('PurchaseOrders', { vendorId: b.vendorId, date: b.date, expectedDate: b.expectedDate || '', status: 'Open',
    subtotal: String(subtotal), tax: String(tax), total: String(r2(subtotal + tax)), notes: b.notes || '', createdAt: new Date().toISOString(), createdBy: c.auth.uid });
  await c.db.update('PurchaseOrders', po.id, { number: po.id });
  await c.db.insertMany('PurchaseOrderItems', b.items.map(i => ({ poId: po.id, description: i.description, qty: String(i.qty), rate: String(i.rate), taxPercent: String(i.taxPercent),
    amount: String(r2(i.qty * i.rate * (1 + i.taxPercent / 100))) })));
  await audit(c, 'CREATE', 'PurchaseOrders', po.id);
  return Response.json(po, { status: 201 });
});
