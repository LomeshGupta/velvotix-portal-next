import { cookies } from 'next/headers';
export const runtime = 'nodejs';
export async function POST() { (await cookies()).delete('token'); return Response.json({ ok: true }); }
