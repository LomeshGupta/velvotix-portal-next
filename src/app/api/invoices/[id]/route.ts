import { z } from 'zod';
import { handler, audit, STAFF } from '@/lib/api';
import { calcInvoice } from '@/lib/gst';
import { notify, FINANCE } from '@/lib/notify';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = handler(STAFF, async ({ db, auth, params }) => {
  const inv = await db.get('Invoices', params.id);
  if (!inv || (auth.role === 'CUSTOMER' && inv.customerId !== auth.customerId)) return Response.json({ message: 'Invoice not found.' }, { status: 404 });
  const [items, payments, company, customer] = await Promise.all([db.list('InvoiceItems'), db.list('Payments'), db.get('Company', 'COMPANY'), db.get('Customers', inv.customerId)]);
  return { invoice: inv, items: items.filter(i => i.invoiceId === inv.id), payments: payments.filter(p => p.invoiceId === inv.id), company, customer };
});

/** Delete an invoice (and its line items) only while nothing has been paid against it. Rows are removed in one batch. */
export const DELETE = handler(['SUPER_ADMIN', 'ADMIN', 'ACCOUNTS'], async c => {
  const inv = await c.db.get('Invoices', c.params.id);
  if (!inv) return Response.json({ message: 'Invoice not found.' }, { status: 404 });
  const payments = (await c.db.list('Payments')).filter(p => p.invoiceId === inv.id);
  if (Number(inv.amountPaid) > 0 || payments.length || ['Paid', 'Partially Paid'].includes(inv.status))
    return Response.json({ message: 'This invoice has payments recorded and cannot be deleted.' }, { status: 409 });
  const items = (await c.db.list('InvoiceItems')).filter(i => i.invoiceId === inv.id).map(i => i.id);
  await c.db.removeMany({ Invoices: [inv.id], InvoiceItems: items });
  await notify(c.db, { roles: FINANCE }, { type: 'INVOICE', title: `Invoice ${inv.id} deleted`, body: `${inv.externalDocNo || ''} INR ${Number(inv.grandTotal).toLocaleString('en-IN')}`, link: '/admin/invoices' }, { except: c.auth.uid });
  await audit(c, `DELETE (${inv.externalDocNo || 'no ext doc'}, ${inv.grandTotal})`, 'Invoices', inv.id);
  return { deleted: inv.id };
});

const edit = z.object({
  externalDocNo: z.string().trim().min(1, 'External document no. is required'), orderDate: z.string().optional(), date: z.string(), dueDate: z.string(),
  placeOfSupply: z.string().min(1), billingAddress: z.string().optional(), paymentTerms: z.string().optional(), notes: z.string().optional(),
  items: z.array(z.object({ description: z.string().min(1), hsnSac: z.string().optional(), qty: z.number().positive(), rate: z.number().min(0), discount: z.number().min(0).optional(), taxPercent: z.number().min(0).max(100) })).min(1),
});
/**
 * Edit an invoice while NOTHING has been paid against it. Totals and GST split are recalculated on the server.
 * Line items are replaced: new rows are added first, then the old ones removed (a failure part-way never loses data).
 */
export const PUT = handler(['SUPER_ADMIN', 'ADMIN', 'ACCOUNTS'], async c => {
  const b = edit.parse(await c.req.json());
  const inv = await c.db.get('Invoices', c.params.id);
  if (!inv) return Response.json({ message: 'Invoice not found.' }, { status: 404 });
  const [payments, allItems, cust, company] = await Promise.all([c.db.list('Payments'), c.db.list('InvoiceItems'), c.db.get('Customers', inv.customerId), c.db.get('Company', 'COMPANY')]);
  if (Number(inv.amountPaid) > 0 || payments.some(p => p.invoiceId === inv.id) || ['Paid', 'Partially Paid', 'Cancelled'].includes(inv.status))
    return Response.json({ message: 'This invoice has payments recorded (or is cancelled) and can no longer be edited.' }, { status: 409 });
  if (!cust) return Response.json({ message: 'Customer not found.' }, { status: 404 });
  if (!company?.cin) return Response.json({ message: 'Your company CIN is missing. Add it under Settings first.' }, { status: 400 });
  if (cust.type === 'B2B' && !cust.cin) return Response.json({ message: `${cust.companyName} has no CIN. Add it on the customer profile first.` }, { status: 400 });
  const intra = !!company.state && company.state.toLowerCase() === b.placeOfSupply.toLowerCase();
  const t = calcInvoice(b.items, intra);
  const oldIds = allItems.filter(i => i.invoiceId === inv.id).map(i => i.id);
  await c.db.insertMany('InvoiceItems', t.lines.map(l => ({ invoiceId: inv.id, description: l.description, hsnSac: l.hsnSac, qty: String(l.qty), rate: String(l.rate),
    discount: String(l.discount), taxPercent: String(l.taxPercent), taxable: String(l.taxable), cgst: String(l.cgst), sgst: String(l.sgst), igst: String(l.igst), lineTotal: String(l.lineTotal) })));
  if (oldIds.length) await c.db.removeMany({ InvoiceItems: oldIds });
  const updated = await c.db.update('Invoices', inv.id, { date: b.date, dueDate: b.dueDate, placeOfSupply: b.placeOfSupply, gstin: cust.gstin, customerCin: cust.cin,
    externalDocNo: b.externalDocNo, orderDate: b.orderDate ?? '', paymentTerms: b.paymentTerms ?? '', billingAddress: b.billingAddress || cust.billingAddress, notes: b.notes ?? '',
    status: 'Issued', subtotal: String(t.subtotal), discount: String(t.discount), taxable: String(t.taxable), cgst: String(t.cgst), sgst: String(t.sgst), igst: String(t.igst),
    roundOff: String(t.roundOff), grandTotal: String(t.grandTotal), amountPaid: '0', balanceDue: String(t.grandTotal) });
  const total = `INR ${t.grandTotal.toLocaleString('en-IN')}`;
  await notify(c.db, { roles: FINANCE }, { type: 'INVOICE', title: `Invoice ${inv.id} edited`, body: `${cust.companyName}, now ${total}`, link: '/admin/invoices' }, { except: c.auth.uid });
  await notify(c.db, { customerId: inv.customerId }, { type: 'INVOICE', title: `Invoice ${b.externalDocNo} revised`, body: `Updated amount ${total}, due ${b.dueDate}` });
  await audit(c, `EDIT (${inv.grandTotal} -> ${t.grandTotal})`, 'Invoices', inv.id);
  return { invoice: updated };
});
