import { handler } from '@/lib/api';
import { FINANCE_VIEW } from '@/lib/roles';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const r2 = (n: number) => Math.round(n * 100) / 100;
/**
 * One request for the whole Invoices & Ledger screen.
 *   GET /api/ledger                    -> all customers
 *   GET /api/ledger?customerId=CUST-1  -> one customer
 * Returns customers, invoices (with customer name), ledger entries (running balance per customer) and per-customer totals.
 */
export const GET = handler(FINANCE_VIEW, async ({ db, req }) => {
  const cid = new URL(req.url).searchParams.get('customerId') || '';
  const [cu, inv, pay] = await Promise.all([db.list('Customers'), db.list('Invoices'), db.list('Payments')]);
  const name = new Map(cu.map(c => [c.id, c.companyName]));
  const invoices = inv.filter(i => !cid || i.customerId === cid).reverse().map(i => ({ ...i, customerName: name.get(i.customerId) || i.customerId }));
  const live = new Map(inv.filter(i => !['Draft', 'Cancelled'].includes(i.status)).map(i => [i.id, i]));
  const raw = [
    ...[...live.values()].filter(i => !cid || i.customerId === cid).map(i => ({ date: i.date, customerId: i.customerId, ref: i.id, extRef: i.externalDocNo || '', type: 'Invoice', debit: Number(i.grandTotal), credit: 0 })),
    ...pay.filter(p => (!cid || p.customerId === cid) && live.has(p.invoiceId)).map(p => ({ date: p.date, customerId: p.customerId, ref: p.invoiceId, extRef: p.reference || '', type: `Payment (${p.mode})`, debit: 0, credit: Number(p.amount) })),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.type === 'Invoice' ? -1 : 1));
  const run: Record<string, number> = {}, totals: Record<string, { billed: number; received: number }> = {};
  const entries = raw.map(e => {
    run[e.customerId] = r2((run[e.customerId] || 0) + e.debit - e.credit);
    const t = (totals[e.customerId] ||= { billed: 0, received: 0 }); t.billed = r2(t.billed + e.debit); t.received = r2(t.received + e.credit);
    return { ...e, customerName: name.get(e.customerId) || e.customerId, balance: run[e.customerId] };
  });
  const summary = Object.entries(totals).map(([id, t]) => ({ customerId: id, customerName: name.get(id) || id, ...t, outstanding: r2(t.billed - t.received) }))
    .sort((a, b) => b.outstanding - a.outstanding);
  return {
    customers: cu.map(c => ({ id: c.id, companyName: c.companyName, state: c.state, billingAddress: c.billingAddress })),
    invoices, entries, summary,
    totals: { billed: r2(summary.reduce((a, x) => a + x.billed, 0)), received: r2(summary.reduce((a, x) => a + x.received, 0)), outstanding: r2(summary.reduce((a, x) => a + x.outstanding, 0)) },
  };
});
