import { cookies } from 'next/headers';
export const runtime = 'nodejs';
export async function POST() { cookies().delete('token'); return Response.json({ ok: true }); }
