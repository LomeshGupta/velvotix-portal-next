import { INDUSTRIES } from './industries';
import type { Row } from './schema';
import type { Store } from './store';

/** Blank is allowed (legacy contracts); otherwise the industry must come from the central list. */
export const industryOk = (v?: string) => !v || (INDUSTRIES as readonly string[]).includes(v);

/** De-duplicates the selected ids and rejects any that are not in the product / service master. Returns the csv to store, or null if invalid. */
export async function productsCsv(db: Store, ids: string[] | undefined): Promise<string | null> {
  const want = [...new Set((ids ?? []).map(i => i.trim()).filter(Boolean))];
  if (!want.length) return '';
  const known = new Set((await db.list('Products')).map(p => p.id));
  return want.every(i => known.has(i)) ? want.join(',') : null;
}

/** Ids -> names joined by '|'. Deleted / unknown ids are skipped, blank is fine. */
export function productNames(master: Row[], csv?: string): string {
  const byId = new Map(master.map(p => [p.id, p.name]));
  return (csv || '').split(',').map(i => byId.get(i.trim())).filter(Boolean).join('|');
}
