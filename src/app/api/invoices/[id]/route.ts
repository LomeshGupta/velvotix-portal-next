import { handler, audit, STAFF } from '@/lib/api';
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
  await audit(c, `DELETE (${inv.externalDocNo || 'no ext doc'}, ${inv.grandTotal})`, 'Invoices', inv.id);
  return { deleted: inv.id };
});
