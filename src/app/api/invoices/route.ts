import { z } from 'zod';
import { handler, audit } from '@/lib/api';
import { calcInvoice } from '@/lib/gst';
import { notify, FINANCE } from '@/lib/notify';
import { FINANCE_VIEW, INVOICE_WRITE } from '@/lib/roles';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const body = z.object({
  customerId: z.string(), externalDocNo: z.string().trim().min(1, 'External document no. is required'), orderDate: z.string().optional(), date: z.string(), dueDate: z.string(), placeOfSupply: z.string().min(1), billingAddress: z.string().optional(), paymentTerms: z.string().optional(), notes: z.string().optional(),
  contractId: z.string().optional(), milestonePercent: z.number().min(0.01).max(100).optional(),
  items: z.array(z.object({ description: z.string().min(1), hsnSac: z.string().optional(), qty: z.number().positive(), rate: z.number().min(0), discount: z.number().min(0).optional(), taxPercent: z.number().min(0).max(100) })).min(1),
});
export const GET = handler(FINANCE_VIEW, async ({ db, auth, req }) => {
  const sp = new URL(req.url).searchParams, st = sp.get('status'), cid = sp.get('customerId');
  let rows = await db.list('Invoices');
  if (auth.role === 'CUSTOMER') rows = rows.filter(r => r.customerId === auth.customerId && r.status !== 'Draft');
  if (st) rows = rows.filter(r => r.status === st);
  if (cid) rows = rows.filter(r => r.customerId === cid);
  return { total: rows.length, rows };
});
export const POST = handler(INVOICE_WRITE, async c => {
  const b = body.parse(await c.req.json());
  const cust = await c.db.get('Customers', b.customerId);
  if (!cust) return Response.json({ message: 'Customer not found.' }, { status: 404 });
  const company = await c.db.get('Company', 'COMPANY');
  if (!company?.cin) return Response.json({ message: 'Your company CIN is missing. Add it under Settings before raising invoices.' }, { status: 400 });
  if (cust.type === 'B2B' && !cust.cin) return Response.json({ message: `${cust.companyName} has no CIN. Add it on the customer profile before raising an invoice.` }, { status: 400 });
  let contract: Awaited<ReturnType<typeof c.db.get>> | undefined;
  if (b.contractId) {
    contract = await c.db.get('SupportContracts', b.contractId);
    if (!contract || contract.customerId !== b.customerId) return Response.json({ message: 'Selected contract was not found for this customer.' }, { status: 404 });
    if (b.milestonePercent) {
      const existing = (await c.db.list('Invoices')).filter(i => i.contractId === b.contractId && i.status !== 'Cancelled' && Number(i.milestonePercent || 0) > 0);
      const already = existing.reduce((a, i) => a + Number(i.milestonePercent || 0), 0);
      if (already + b.milestonePercent > 100.01) return Response.json({ message: `This would invoice ${(already + b.milestonePercent).toFixed(1)}% of the contract - only ${(100 - already).toFixed(1)}% remains.` }, { status: 400 });
    }
  }
  const intra = !!company?.state && company.state.toLowerCase() === b.placeOfSupply.toLowerCase();
  const t = calcInvoice(b.items, intra);
  const inv = await c.db.insert('Invoices', { customerId: b.customerId, date: b.date, dueDate: b.dueDate, placeOfSupply: b.placeOfSupply, gstin: cust.gstin,
    externalDocNo: b.externalDocNo, orderDate: b.orderDate, customerCin: cust.cin, paymentTerms: b.paymentTerms, billingAddress: b.billingAddress || cust.billingAddress,
    contractId: b.contractId || '', milestonePercent: b.milestonePercent ? String(b.milestonePercent) : '', status: 'Issued', subtotal: String(t.subtotal), discount: String(t.discount), taxable: String(t.taxable), cgst: String(t.cgst), sgst: String(t.sgst),
    igst: String(t.igst), roundOff: String(t.roundOff), grandTotal: String(t.grandTotal), amountPaid: '0', balanceDue: String(t.grandTotal), notes: b.notes });
  // number is filled by the store on insert; all line items go in with a single append call
  await c.db.insertMany('InvoiceItems', t.lines.map(l => ({ invoiceId: inv.id, description: l.description, hsnSac: l.hsnSac, qty: String(l.qty), rate: String(l.rate),
    discount: String(l.discount), taxPercent: String(l.taxPercent), taxable: String(l.taxable), cgst: String(l.cgst), sgst: String(l.sgst), igst: String(l.igst), lineTotal: String(l.lineTotal) })));
  await notify(c.db, { roles: FINANCE }, { type: 'INVOICE', title: `Invoice ${inv.id} raised`, body: `${cust.companyName}, INR ${t.grandTotal.toLocaleString('en-IN')}`, link: '/admin/invoices' }, { except: c.auth.uid });
  await notify(c.db, { customerId: b.customerId }, { type: 'INVOICE', title: `New invoice ${b.externalDocNo}`, body: `INR ${t.grandTotal.toLocaleString('en-IN')}, due ${b.dueDate}` });
  await audit(c, 'CREATE', 'Invoices', inv.id);
  return Response.json({ ...inv, intraState: intra }, { status: 201 });
});
