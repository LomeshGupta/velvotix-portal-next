import { z } from 'zod';
import { handler, audit } from '@/lib/api';
import { PURCHASE_VIEW, PURCHASE_WRITE } from '@/lib/roles';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const r2 = (n: number) => Math.round(n * 100) / 100;
export const GET = handler(PURCHASE_VIEW, async ({ db, req }) => {
  const vid = new URL(req.url).searchParams.get('vendorId');
  const [rows, vendors] = await Promise.all([db.list('PurchaseInvoices'), db.list('Vendors')]);
  const names = new Map(vendors.map(v => [v.id, v.name]));
  const today = new Date().toISOString().slice(0, 10);
  const filtered = (vid ? rows.filter(r => r.vendorId === vid) : rows).map(r => ({ ...r, vendorName: names.get(r.vendorId) || r.vendorId,
    overdue: Number(r.balanceDue) > 0 && r.dueDate < today && r.status !== 'Cancelled' }));
  return { rows: filtered.reverse() };
});
const body = z.object({
  vendorId: z.string().min(1, 'Vendor is required'), poId: z.string().optional(), vendorInvoiceNo: z.string().trim().min(1, "Vendor's invoice number is required"),
  date: z.string().min(1), dueDate: z.string().min(1), subtotal: z.number().min(0), tax: z.number().min(0), notes: z.string().optional(),
});
export const POST = handler(PURCHASE_WRITE, async c => {
  const b = body.parse(await c.req.json());
  if (!(await c.db.get('Vendors', b.vendorId))) return Response.json({ message: 'Vendor not found.' }, { status: 404 });
  const total = r2(b.subtotal + b.tax);
  const pi = await c.db.insert('PurchaseInvoices', { vendorId: b.vendorId, poId: b.poId || '', vendorInvoiceNo: b.vendorInvoiceNo, date: b.date, dueDate: b.dueDate,
    subtotal: String(b.subtotal), tax: String(b.tax), total: String(total), amountPaid: '0', balanceDue: String(total), status: 'Unpaid', notes: b.notes || '', createdAt: new Date().toISOString() });
  await c.db.update('PurchaseInvoices', pi.id, { number: pi.id });
  await audit(c, 'CREATE', 'PurchaseInvoices', pi.id);
  return Response.json(pi, { status: 201 });
});
