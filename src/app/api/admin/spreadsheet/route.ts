import { handler } from '@/lib/api';
export const runtime = 'nodejs';
export const GET = handler(['SUPER_ADMIN', 'ADMIN'], async ({ db }) => db.init());
