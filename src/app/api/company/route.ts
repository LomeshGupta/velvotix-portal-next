import { z } from 'zod';
import { handler, audit } from '@/lib/api';
import { SCHEMA } from '@/lib/schema';
import { cinField } from '@/lib/cin';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const DEFAULTS = { id: 'COMPANY', name: 'Velvotix Solutions' };
export const GET = handler([], async ({ db }) => (await db.get('Company', 'COMPANY')) ?? DEFAULTS);
const body = z.object(Object.fromEntries(SCHEMA.Company.filter(k => k !== 'id').map(k => [k, k === 'cin' ? cinField.optional() : z.string().optional()])));
export const PUT = handler(['SUPER_ADMIN', 'ADMIN'], async c => {
  const b = body.parse(await c.req.json());
  const cur = await c.db.get('Company', 'COMPANY');
  const r = cur ? await c.db.update('Company', 'COMPANY', b) : await c.db.insert('Company', { ...DEFAULTS, ...b, id: 'COMPANY' });
  await audit(c, 'UPDATE', 'Company', 'COMPANY');
  return r;
});
