import { z } from 'zod';
import { handler, audit, STAFF } from '@/lib/api';
import { calcInvoice } from '@/lib/gst';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const body = z.object({
  customerId: z.string(), date: z.string(), dueDate: z.string(), placeOfSupply: z.string().min(1), billingAddress: z.string().optional(), paymentTerms: z.string().optional(), notes: z.string().optional(),
  items: z.array(z.object({ description: z.string().min(1), hsnSac: z.string().optional(), qty: z.number().positive(), rate: z.number().min(0), discount: z.number().min(0).optional(), taxPercent: z.number().min(0).max(100) })).min(1),
});
export const GET = handler(STAFF, async ({ db, auth, req }) => {
  const sp = new URL(req.url).searchParams, st = sp.get('status'), cid = sp.get('customerId');
  let rows = await db.list('Invoices');
  if (auth.role === 'CUSTOMER') rows = rows.filter(r => r.customerId === auth.customerId && r.status !== 'Draft');
  if (st) rows = rows.filter(r => r.status === st);
  if (cid) rows = rows.filter(r => r.customerId === cid);
  return { total: rows.length, rows };
});
export const POST = handler(['SUPER_ADMIN', 'ADMIN', 'ACCOUNTS'], async c => {
  const b = body.parse(await c.req.json());
  const cust = await c.db.get('Customers', b.customerId);
  if (!cust) return Response.json({ message: 'Customer not found.' }, { status: 404 });
  const company = await c.db.get('Company', 'COMPANY');
  const intra = !!company?.state && company.state.toLowerCase() === b.placeOfSupply.toLowerCase();
  const t = calcInvoice(b.items, intra);
  const inv = await c.db.insert('Invoices', { customerId: b.customerId, date: b.date, dueDate: b.dueDate, placeOfSupply: b.placeOfSupply, gstin: cust.gstin,
    paymentTerms: b.paymentTerms, billingAddress: b.billingAddress || cust.billingAddress, status: 'Issued', subtotal: String(t.subtotal), discount: String(t.discount), taxable: String(t.taxable), cgst: String(t.cgst), sgst: String(t.sgst),
    igst: String(t.igst), roundOff: String(t.roundOff), grandTotal: String(t.grandTotal), amountPaid: '0', balanceDue: String(t.grandTotal), notes: b.notes });
  const saved = await c.db.update('Invoices', inv.id, { number: inv.id });
  for (const l of t.lines) await c.db.insert('InvoiceItems', { invoiceId: inv.id, description: l.description, hsnSac: l.hsnSac, qty: String(l.qty), rate: String(l.rate),
    discount: String(l.discount), taxPercent: String(l.taxPercent), taxable: String(l.taxable), cgst: String(l.cgst), sgst: String(l.sgst), igst: String(l.igst), lineTotal: String(l.lineTotal) });
  await c.db.insert('Notifications', { userId: '', type: 'INVOICE_CREATED', title: `Invoice ${inv.id} created`, body: cust.companyName, read: 'false', createdAt: new Date().toISOString() });
  await audit(c, 'CREATE', 'Invoices', inv.id);
  return Response.json({ ...saved, intraState: intra }, { status: 201 });
});
