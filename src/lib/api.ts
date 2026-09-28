import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createStore, DemoStore, Store } from './store';
import { calcInvoice } from './gst';

export type Auth = { uid: string; role: string; customerId: string };
export const SECRET = () => { const s = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-only-insecure-secret' : ''); if (!s) throw new Error('JWT_SECRET is required'); return s; };
export const STAFF = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'ACCOUNTS', 'SALES'];
export const STAFF_WRITE = ['SUPER_ADMIN', 'ADMIN', 'SALES'];

async function seed(s: Store) {
  if ((await s.list('Users')).length) return;
  const base = { active: 'true', createdAt: new Date().toISOString(), isSeed: 'SEED-DEV-DATA' };
  const h = (p: string) => bcrypt.hash(p, 10);
  await s.insert('Users', { ...base, name: 'Seed Admin', email: 'admin@velvotix.local', passwordHash: await h('Admin@12345'), role: 'SUPER_ADMIN' });
  await s.insert('Users', { ...base, name: 'Seed Support', email: 'support@velvotix.local', passwordHash: await h('Support@12345'), role: 'SUPPORT' });
  const c = await s.insert('Customers', { companyName: 'Seed Customer Pvt Ltd (DEV)', type: 'B2B', email: 'client@example.com', status: 'Active', state: 'Haryana', country: 'India' });
  await s.insert('Users', { ...base, name: 'Seed Client', email: 'client@example.com', passwordHash: await h('Client@12345'), role: 'CUSTOMER', customerId: c.id });
}

/** Dummy data for DEMO mode only. */
async function seedDemo(s: Store) {
  const now = new Date().toISOString(), day = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  await s.insert('Company', { id: 'COMPANY', name: 'Velvotix Solutions', legalName: 'Velvotix Solutions Pvt Ltd (DEMO)', state: 'Haryana', country: 'India', invoicePrefix: 'INV' });
  const c1 = (await s.list('Customers'))[0];
  const c2 = await s.insert('Customers', { companyName: 'Demo Traders LLP (DEV)', type: 'B2B', email: 'demo2@example.com', state: 'Maharashtra', gstin: 'DEMO27AAAAA0000A1Z5', status: 'Active', customerSince: day(-200) });
  for (const [c, n] of [[c1, 'CN-DEMO-1'], [c2, 'CN-DEMO-2']] as const)
    await s.insert('SupportContracts', { customerId: c.id, contractNumber: n, type: 'AMC', startDate: day(-300), endDate: day(n === 'CN-DEMO-1' ? 20 : 200), amount: '100000', tax: '18000', total: '118000', supportHours: '100', usedHours: '20', remainingHours: '80', status: 'Active' });
  const tk = async (c: { id: string }, subject: string, priority: string, status: string) => {
    const t = await s.insert('Tickets', { customerId: c.id, subject, description: subject + ' - demo ticket', category: 'Business Central', priority, status, createdAt: now, updatedAt: now });
    await s.update('Tickets', t.id, { number: t.id });
    await s.insert('TicketActivities', { ticketId: t.id, type: 'Ticket created', detail: subject, createdAt: now });
    return t;
  };
  const t1 = await tk(c1, 'Posting error in Sales Invoice', 'High', 'Open');
  await tk(c1, 'Need new report layout', 'Low', 'In Progress');
  await tk(c2, 'Integration sync failing', 'Critical', 'Assigned');
  await s.insert('TicketMessages', { ticketId: t1.id, senderType: 'CUSTOMER', message: 'Getting an error when posting.', messageType: 'REPLY', isInternal: 'false', createdAt: now });
  await s.insert('TicketMessages', { ticketId: t1.id, senderType: 'STAFF', message: 'Internal: check dimension setup.', messageType: 'NOTE', isInternal: 'true', createdAt: now });
  const sup = (await s.list('Users')).find(u => u.email === 'support@velvotix.local')!;
  await s.update('Tickets', t1.id, { assignedTo: sup.id, status: 'Assigned' });
  for (const c of [c1, c2]) {
    await s.insert('HoursLedger', { customerId: c.id, type: 'ADD', hours: '40', validTill: day(90), note: 'Annual support pack (DEMO)', createdBy: 'seed', createdAt: now });
    await s.insert('HoursLedger', { customerId: c.id, type: 'USE', hours: '6.5', note: 'Earlier work (DEMO)', createdBy: 'seed', createdAt: now });
  }
  await s.insert('HourRequests', { customerId: c1.id, ticketId: t1.id, requestedBy: sup.id, hours: '3', reason: 'Investigation and fix of posting error', status: 'Pending', createdAt: now });
  const inv = async (c: { id: string; gstin: string }, place: string, rate: number, paid: number, dt: string) => {
    const t = calcInvoice([{ description: 'Support services', hsnSac: '998313', qty: 1, rate, taxPercent: 18 }], place.toLowerCase() === 'haryana');
    const i = await s.insert('Invoices', { customerId: c.id, date: dt, dueDate: dt, placeOfSupply: place, gstin: c.gstin, status: paid >= t.grandTotal ? 'Paid' : paid ? 'Partially Paid' : 'Issued',
      subtotal: String(t.subtotal), discount: '0', taxable: String(t.taxable), cgst: String(t.cgst), sgst: String(t.sgst), igst: String(t.igst), roundOff: String(t.roundOff),
      grandTotal: String(t.grandTotal), amountPaid: String(paid), balanceDue: String(t.grandTotal - paid) });
    await s.update('Invoices', i.id, { number: i.id });
    for (const l of t.lines) await s.insert('InvoiceItems', { invoiceId: i.id, description: l.description, hsnSac: l.hsnSac, qty: '1', rate: String(l.rate), discount: '0', taxPercent: '18', taxable: String(l.taxable), cgst: String(l.cgst), sgst: String(l.sgst), igst: String(l.igst), lineTotal: String(l.lineTotal) });
    if (paid) await s.insert('Payments', { invoiceId: i.id, customerId: c.id, date: dt, amount: String(paid), mode: 'Bank Transfer', reference: 'DEMO-REF' });
  };
  await inv(c1, 'Haryana', 50000, 59000, day(-60));
  await inv(c1, 'Haryana', 30000, 10000, day(-20));
  await inv(c2, 'Maharashtra', 80000, 0, day(-5));
}
const g = globalThis as unknown as { __db?: Promise<Store> };
/** Lazy, once-per-process init: creates spreadsheet/tabs (idempotent) then seeds if empty. */
export const db = () => (g.__db ??= (async () => { const s = createStore(); await s.init(); await seed(s); if (s instanceof DemoStore) await seedDemo(s); return s; })().catch(e => { g.__db = undefined; throw e; }));

type Ctx = { db: Store; auth: Auth; req: Request; params: Record<string, string> };
/** roles=null: public; []: any signed-in user; [..]: listed roles only. */
export const handler = (roles: string[] | null, fn: (c: Ctx) => Promise<unknown>) =>
  async (req: Request, ctx: { params: Record<string, string> }) => {
    try {
      let auth: Auth | undefined;
      if (roles) {
        try { auth = jwt.verify(cookies().get('token')?.value || '', SECRET()) as Auth; }
        catch { return NextResponse.json({ message: 'Please sign in.' }, { status: 401 }); }
        if (roles.length && !roles.includes(auth.role)) return NextResponse.json({ message: 'Not permitted.' }, { status: 403 });
      }
      const out = await fn({ db: await db(), auth: auth as Auth, req, params: ctx?.params ?? {} });
      return out instanceof Response ? out : NextResponse.json(out);
    } catch (e: any) {
      if (e instanceof ZodError) return NextResponse.json({ message: 'Validation failed.', issues: e.issues }, { status: 400 });
      console.error(e);
      return NextResponse.json({ message: e?.status === 404 ? 'Not found.' : 'Google Sheets service is temporarily unavailable.', detail: process.env.NODE_ENV !== 'production' ? String(e?.message) : undefined }, { status: e?.status || 500 });
    }
  };
export const audit = (c: Ctx, action: string, entity: string, entityId: string) =>
  c.db.insert('AuditLog', { userId: c.auth.uid, action, entity, entityId, createdAt: new Date().toISOString() }).catch(() => {});
export { bcrypt, jwt };
