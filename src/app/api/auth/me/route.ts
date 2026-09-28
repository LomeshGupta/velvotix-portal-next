import { handler } from '@/lib/api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = handler([], async ({ db, auth }) => { const u = await db.get('Users', auth.uid); return { id: auth.uid, name: u?.name, role: auth.role, customerId: auth.customerId }; });
