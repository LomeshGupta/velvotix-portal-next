import { z } from 'zod';
import { handler, audit } from '@/lib/api';
export const runtime = 'nodejs';
const body = z.object({ date: z.string(), amount: z.number().positive(), mode: z.enum(['Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Card', 'Other']), reference: z.string().optional(), notes: z.string().optional() });
export const POST = handler(['SUPER_ADMIN', 'ADMIN', 'ACCOUNTS'], async c => {
  const b = body.parse(await c.req.json());
  const inv = await c.db.get('Invoices', c.params.id);
  if (!inv) return Response.json({ message: 'Invoice not found.' }, { status: 404 });
  if (['Cancelled', 'Draft'].includes(inv.status)) return Response.json({ message: 'Invoice cannot accept payments.' }, { status: 400 });
  const balance = Number(inv.balanceDue);
  if (b.amount > balance + 0.001) return Response.json({ message: 'Payment exceeds balance due.' }, { status: 400 });
  const pay = await c.db.insert('Payments', { invoiceId: inv.id, customerId: inv.customerId, date: b.date, amount: String(b.amount), mode: b.mode, reference: b.reference, notes: b.notes });
  const paid = Math.round((Number(inv.amountPaid) + b.amount) * 100) / 100, due = Math.round((Number(inv.grandTotal) - paid) * 100) / 100;
  const updated = await c.db.update('Invoices', inv.id, { amountPaid: String(paid), balanceDue: String(due), status: due <= 0 ? 'Paid' : 'Partially Paid' });
  await c.db.insert('Notifications', { userId: '', type: 'PAYMENT_RECEIVED', title: `Payment received for ${inv.id}`, body: String(b.amount), read: 'false', createdAt: new Date().toISOString() });
  await audit(c, 'PAYMENT', 'Invoices', inv.id);
  return Response.json({ payment: pay, invoice: updated }, { status: 201 });
});
