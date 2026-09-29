import { kv } from '@/lib/cache';
import { pushEnabled } from '@/lib/push';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Public, no secrets: shows whether Redis and Web Push are active. */
export async function GET() { return Response.json({ status: 'ok', cache: await kv.mode(), push: pushEnabled() }); }
