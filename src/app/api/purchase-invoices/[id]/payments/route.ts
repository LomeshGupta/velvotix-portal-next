import { z } from 'zod';
import { handler, audit } from '@/lib/api';
import { PURCHASE_WRITE } from '@/lib/roles';
export const runtime = 'nodejs';
const r2 = (n: number) => Math.round(n * 100) / 100;
const body = z.object({ date: z.string().min(1), amount: z.number().positive(), mode: z.enum(['Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Card', 'Other']), reference: z.string().optional(), notes: z.string().optional() });
export const POST = handler(PURCHASE_WRITE, async c => {
  const b = body.parse(await c.req.json());
  const pi = await c.db.get('PurchaseInvoices', c.params.id);
  if (!pi) return Response.json({ message: 'Purchase invoice not found.' }, { status: 404 });
  const balance = Number(pi.balanceDue);
  if (b.amount > balance + 0.01) return Response.json({ message: 'Payment exceeds balance due.' }, { status: 400 });
  const pay = await c.db.insert('PurchasePayments', { purchaseInvoiceId: pi.id, vendorId: pi.vendorId, date: b.date, amount: String(b.amount), mode: b.mode, reference: b.reference || '', notes: b.notes || '' });
  const paid = r2(Number(pi.amountPaid) + b.amount), due = r2(Number(pi.total) - paid);
  const updated = await c.db.update('PurchaseInvoices', pi.id, { amountPaid: String(paid), balanceDue: String(due), status: due <= 0 ? 'Paid' : 'Partially Paid' });
  await audit(c, 'PAYMENT', 'PurchaseInvoices', pi.id);
  return Response.json({ payment: pay, invoice: updated }, { status: 201 });
});
