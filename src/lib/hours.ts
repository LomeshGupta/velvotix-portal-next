import type { Row } from './schema';
const r2 = (n: number) => Math.round(n * 100) / 100;
const sum = (rows: Row[]) => r2(rows.reduce((a, r) => a + Number(r.hours || 0), 0));
/** Remaining = hours granted that are still valid minus hours consumed (approved usage). */
export function hoursSummary(ledger: Row[], today = new Date().toISOString().slice(0, 10)) {
  const grants = ledger.filter(l => l.type === 'ADD'), active = grants.filter(g => !g.validTill || g.validTill >= today);
  const added = sum(active), used = sum(ledger.filter(l => l.type === 'USE'));
  const validTill = active.map(g => g.validTill).filter(Boolean).sort().pop() || '';
  return { added, used, remaining: Math.max(0, r2(added - used)), validTill, expired: grants.length > 0 && active.length === 0 };
}
