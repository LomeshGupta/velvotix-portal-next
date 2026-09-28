import { handler, STAFF } from '@/lib/api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = handler(STAFF, async ({ db }) => (await db.list('Users')).filter(u => u.role !== 'CUSTOMER' && u.active === 'true').map(u => ({ id: u.id, name: u.name, role: u.role })));
