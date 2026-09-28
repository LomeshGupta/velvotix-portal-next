import { z } from 'zod';
import { handler, audit, bcrypt } from '@/lib/api';
import { canManage } from '@/lib/roles';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const staffRoles = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'ACCOUNTS', 'SALES'] as const;
const body = z.object({ name: z.string().trim().min(1), active: z.boolean(), role: z.enum(staffRoles), password: z.string().min(8, 'Password must be at least 8 characters') }).partial();

/** Enable / disable, rename, change staff role or reset password. One read + one write. */
export const PUT = handler(['SUPER_ADMIN', 'ADMIN'], async c => {
  const b = body.parse(await c.req.json());
  const u = await c.db.get('Users', c.params.id);
  if (!u) return Response.json({ message: 'User not found.' }, { status: 404 });
  if (!canManage(c.auth.role, u.role)) return Response.json({ message: 'You cannot modify this user.' }, { status: 403 });
  if (u.id === c.auth.uid && (b.active === false || (b.role && b.role !== u.role)))
    return Response.json({ message: 'You cannot disable or change the role of your own account.' }, { status: 400 });
  if (b.role) {
    if (u.role === 'CUSTOMER') return Response.json({ message: 'Customer logins cannot be changed to a staff role.' }, { status: 400 });
    if (!canManage(c.auth.role, b.role)) return Response.json({ message: 'You cannot assign this role.' }, { status: 403 });
  }
  const patch: Record<string, string> = {};
  if (b.name !== undefined) patch.name = b.name;
  if (b.role) patch.role = b.role;
  if (b.active !== undefined) patch.active = String(b.active);
  if (b.password) patch.passwordHash = await bcrypt.hash(b.password, 10);
  const r = await c.db.update('Users', u.id, patch);
  await audit(c, b.active === undefined ? (b.password ? 'RESET_PASSWORD' : 'UPDATE') : b.active ? 'ENABLE' : 'DISABLE', 'Users', u.id);
  return { id: r.id, name: r.name, email: r.email, role: r.role, active: r.active === 'true', customerId: r.customerId };
});
