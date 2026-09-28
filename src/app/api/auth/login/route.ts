import { z } from 'zod';
import { cookies } from 'next/headers';
import { handler, bcrypt, jwt, SECRET, Auth } from '@/lib/api';
export const runtime = 'nodejs';
export const POST = handler(null, async ({ db, req }) => {
  const b = z.object({ email: z.string().email(), password: z.string().min(1), portal: z.enum(['admin', 'customer']) }).parse(await req.json());
  const u = (await db.list('Users')).find(x => x.email.toLowerCase() === b.email.toLowerCase());
  if (!u || u.active !== 'true' || (b.portal === 'customer') !== (u.role === 'CUSTOMER') || !(await bcrypt.compare(b.password, u.passwordHash)))
    return Response.json({ message: 'Invalid email or password.' }, { status: 401 });
  const p: Auth = { uid: u.id, role: u.role, customerId: u.customerId };
  (await cookies()).set('token', jwt.sign(p, SECRET(), { expiresIn: '8h' }), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 8 * 3600 });
  return { id: u.id, name: u.name, role: u.role, customerId: u.customerId };
});
