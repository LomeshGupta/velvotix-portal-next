import { handler, STAFF } from '@/lib/api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const count = (rows: Record<string, string>[], k: string) => Object.entries(rows.reduce<Record<string, number>>((a, r) => ((a[r[k]] = (a[r[k]] || 0) + 1), a), {})).map(([name, value]) => ({ name, value }));
export const GET = handler(STAFF, async ({ db }) => {
  const [cu, co, tk, inv, pay] = await Promise.all(['Customers', 'SupportContracts', 'Tickets', 'Invoices', 'Payments'].map(s => db.list(s)));
  const open = tk.filter(t => !['Resolved', 'Closed'].includes(t.status));
  const live = inv.filter(i => !['Draft', 'Cancelled'].includes(i.status));
  const byMonth: Record<string, number> = {}, growth: Record<string, number> = {};
  pay.forEach(p => { const m = p.date.slice(0, 7); byMonth[m] = (byMonth[m] || 0) + Number(p.amount); });
  cu.forEach(c => { const m = (c.customerSince || '').slice(0, 7); if (m) growth[m] = (growth[m] || 0) + 1; });
  const series = (o: Record<string, number>, k: string) => Object.keys(o).sort().slice(-6).map(m => ({ month: m, [k]: Math.round(o[m]) }));
  return {
    kpis: { customers: cu.length, activeContracts: co.filter(c => c.status === 'Active').length, openTickets: open.length, criticalTickets: open.filter(t => t.priority === 'Critical').length,
      pendingInvoices: live.filter(i => Number(i.balanceDue) > 0).length, outstanding: Math.round(live.reduce((a, i) => a + Number(i.balanceDue), 0)),
      monthRevenue: Math.round(byMonth[new Date().toISOString().slice(0, 7)] || 0) },
    revenue: series(byMonth, 'revenue'), growth: series(growth, 'customers'), ticketsByStatus: count(tk, 'status'), ticketsByPriority: count(tk, 'priority'), invoiceStatus: count(inv, 'status'),
  };
});
