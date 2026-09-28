import { z } from 'zod';
import { handler, audit, bcrypt, STAFF } from '@/lib/api';
import { ROLES, ADMINS, canManage } from '@/lib/roles';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/**
 * GET /api/users            -> active staff (id, name, role) for assignee dropdowns (unchanged behaviour)
 * GET /api/users?manage=1   -> every user incl. customer logins, with customer name (admins only), one request
 */
export const GET = handler(STAFF, async ({ db, auth, req }) => {
  const users = await db.list('Users');
  if (new URL(req.url).searchParams.get('manage') !== '1')
    return users.filter(u => u.role !== 'CUSTOMER' && u.active === 'true').map(u => ({ id: u.id, name: u.name, role: u.role }));
  if (!ADMINS.includes(auth.role)) return Response.json({ message: 'Not permitted.' }, { status: 403 });
  const cust = new Map((await db.list('Customers')).map(c => [c.id, c.companyName]));
  return {
    rows: users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active === 'true', customerId: u.customerId, customerName: cust.get(u.customerId) || '', createdAt: u.createdAt })),
  };
});

const body = z.object({
  name: z.string().trim().min(1), email: z.string().trim().email(), password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(ROLES), customerId: z.string().optional(),
});
export const POST = handler(ADMINS, async c => {
  const b = body.parse(await c.req.json());
  if (!canManage(c.auth.role, b.role)) return Response.json({ message: 'You cannot create a user with this role.' }, { status: 403 });
  if (b.role === 'CUSTOMER' && (!b.customerId || !(await c.db.get('Customers', b.customerId))))
    return Response.json({ message: 'Select the customer this login belongs to.' }, { status: 400 });
  if ((await c.db.list('Users')).some(u => u.email.toLowerCase() === b.email.toLowerCase()))
    return Response.json({ message: 'A user with this email already exists.' }, { status: 409 });
  const u = await c.db.insert('Users', { name: b.name, email: b.email, passwordHash: await bcrypt.hash(b.password, 10), role: b.role,
    customerId: b.role === 'CUSTOMER' ? b.customerId : '', active: 'true', createdAt: new Date().toISOString() });
  await audit(c, 'CREATE', 'Users', u.id);
  return Response.json({ id: u.id, name: u.name, email: u.email, role: u.role, active: true, customerId: u.customerId }, { status: 201 });
});
