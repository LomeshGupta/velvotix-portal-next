import { handler } from '@/lib/api';
import { FINANCE_VIEW } from '@/lib/roles';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const r2 = (n: number) => Math.round(n * 100) / 100;
export const GET = handler(FINANCE_VIEW, async ({ db, params }) => {
  const [inv, pay, customer] = await Promise.all([db.list('Invoices'), db.list('Payments'), db.get('Customers', params.id)]);
  if (!customer) return Response.json({ message: 'Customer not found.' }, { status: 404 });
  const e = [
    ...inv.filter(i => i.customerId === params.id && !['Draft', 'Cancelled'].includes(i.status)).map(i => ({ date: i.date, ref: i.id, type: 'Invoice', debit: Number(i.grandTotal), credit: 0 })),
    ...pay.filter(p => p.customerId === params.id).map(p => ({ date: p.date, ref: `${p.invoiceId} / ${p.id}`, type: `Payment (${p.mode})`, debit: 0, credit: Number(p.amount) })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  let bal = 0;
  const entries = e.map(x => ({ ...x, balance: (bal = r2(bal + x.debit - x.credit)) }));
  return { customer, entries, outstanding: bal };
});
