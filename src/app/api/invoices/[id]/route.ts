import { handler, STAFF } from '@/lib/api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = handler(STAFF, async ({ db, auth, params }) => {
  const inv = await db.get('Invoices', params.id);
  if (!inv || (auth.role === 'CUSTOMER' && inv.customerId !== auth.customerId)) return Response.json({ message: 'Invoice not found.' }, { status: 404 });
  const [items, payments, company, customer] = await Promise.all([db.list('InvoiceItems'), db.list('Payments'), db.get('Company', 'COMPANY'), db.get('Customers', inv.customerId)]);
  return { invoice: inv, items: items.filter(i => i.invoiceId === inv.id), payments: payments.filter(p => p.invoiceId === inv.id), company, customer };
});
