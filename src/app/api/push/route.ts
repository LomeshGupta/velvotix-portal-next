import { z } from 'zod';
import { handler } from '@/lib/api';
import { pushEnabled, removeSub, saveSub, vapidPublicKey } from '@/lib/push';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = handler([], async () => ({ enabled: pushEnabled(), publicKey: pushEnabled() ? vapidPublicKey() : '' }));
const sub = z.object({ endpoint: z.string().url().max(600), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }).passthrough();
export const POST = handler([], async ({ auth, req }) => {
  if (!pushEnabled()) return Response.json({ message: 'Push is not configured on the server.' }, { status: 503 });
  await saveSub(auth.uid, sub.parse(await req.json()), req.headers.get('user-agent') || '');
  return { ok: true };
});
export const DELETE = handler([], async ({ auth, req }) => {
  const { endpoint } = z.object({ endpoint: z.string() }).parse(await req.json());
  await removeSub(auth.uid, endpoint);
  return { ok: true };
});
