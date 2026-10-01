import { handler } from '@/lib/api';
import { DASHBOARD_VIEW } from '@/lib/roles';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const count = (rows: Record<string, string>[], k: string) => Object.entries(rows.reduce<Record<string, number>>((a, r) => ((a[r[k]] = (a[r[k]] || 0) + 1), a), {})).map(([name, value]) => ({ name, value }));
const r2 = (n: number) => Math.round(n * 100) / 100;
/** 1 Apr - 31 Mar Indian financial year label for a yyyy-mm-dd date string. */
const fyOf = (d: string) => { const [y, m] = d.split('-').map(Number); const start = m >= 4 ? y : y - 1; return `FY${String(start).slice(2)}-${String(start + 1).slice(2)}`; };
export const GET = handler(DASHBOARD_VIEW, async ({ db }) => {
  const [cu, co, tk, inv, pay] = await Promise.all(['Customers', 'SupportContracts', 'Tickets', 'Invoices', 'Payments'].map(s => db.list(s)));
  const open = tk.filter(t => !['Resolved', 'Closed'].includes(t.status));
  const live = inv.filter(i => !['Draft', 'Cancelled'].includes(i.status));
  const byMonth: Record<string, number> = {}, growth: Record<string, number> = {};
  pay.forEach(p => { const m = p.date.slice(0, 7); byMonth[m] = (byMonth[m] || 0) + Number(p.amount); });
  cu.forEach(c => { const m = (c.customerSince || '').slice(0, 7); if (m) growth[m] = (growth[m] || 0) + 1; });
  const series = (o: Record<string, number>, k: string) => Object.keys(o).sort().slice(-6).map(m => ({ month: m, [k]: Math.round(o[m]) }));

  // ---- Financial / contract dashboard (additive) ----
  const today = new Date().toISOString().slice(0, 10);
  const liveContracts = co.filter(c => c.status !== 'Cancelled');
  const contractsTotal = r2(liveContracts.reduce((a, c) => a + Number(c.total || 0), 0));
  const invoicedAgainstContracts = r2(live.filter(i => i.contractId).reduce((a, i) => a + Number(i.grandTotal || 0), 0));
  const overdueInvoices = live.filter(i => Number(i.balanceDue) > 0 && i.dueDate && i.dueDate < today);
  const overdueAmount = r2(overdueInvoices.reduce((a, i) => a + Number(i.balanceDue), 0));
  // Simple receivable aging buckets by days past due (0 = not yet due).
  const ageBuckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
  live.filter(i => Number(i.balanceDue) > 0).forEach(i => {
    const days = Math.floor((Date.now() - new Date(i.dueDate).getTime()) / 86400000);
    const amt = Number(i.balanceDue);
    if (days <= 0) ageBuckets.current += amt; else if (days <= 30) ageBuckets.d1_30 += amt; else if (days <= 60) ageBuckets.d31_60 += amt; else if (days <= 90) ageBuckets.d61_90 += amt; else ageBuckets.d90plus += amt;
  });
  Object.keys(ageBuckets).forEach(k => (ageBuckets as Record<string, number>)[k] = r2((ageBuckets as Record<string, number>)[k]));
  // FY-wise revenue (cash received), last 4 financial years.
  const fy: Record<string, number> = {};
  pay.forEach(p => { const k = fyOf(p.date); fy[k] = r2((fy[k] || 0) + Number(p.amount)); });
  const fyRevenue = Object.keys(fy).sort().slice(-4).map(k => ({ fy: k, revenue: fy[k] }));
  // GST collected on live invoices, by month (last 6).
  const gstByMonth: Record<string, { cgst: number; sgst: number; igst: number }> = {};
  live.forEach(i => { const m = i.date.slice(0, 7); const g = (gstByMonth[m] ||= { cgst: 0, sgst: 0, igst: 0 }); g.cgst += Number(i.cgst || 0); g.sgst += Number(i.sgst || 0); g.igst += Number(i.igst || 0); });
  const gst = Object.keys(gstByMonth).sort().slice(-6).map(m => ({ month: m, cgst: r2(gstByMonth[m].cgst), sgst: r2(gstByMonth[m].sgst), igst: r2(gstByMonth[m].igst) }));
  const gstTotals = { cgst: r2(gst.reduce((a, g) => a + g.cgst, 0)), sgst: r2(gst.reduce((a, g) => a + g.sgst, 0)), igst: r2(gst.reduce((a, g) => a + g.igst, 0)) };
  // Basic forecast: contracts still carrying an un-invoiced balance (milestone remainder), nearest renewal/end date first.
  const custNames = new Map(cu.map(c => [c.id, c.companyName]));
  const invoicedPctByContract = new Map<string, number>();
  inv.forEach(i => { if (i.contractId && i.status !== 'Cancelled' && Number(i.milestonePercent || 0) > 0) invoicedPctByContract.set(i.contractId, (invoicedPctByContract.get(i.contractId) || 0) + Number(i.milestonePercent)); });
  const upcomingInvoices = liveContracts.map(c => {
    const pct = invoicedPctByContract.get(c.id) || 0; const remainingPct = Math.max(0, r2(100 - pct)); const remainingAmount = r2((Number(c.total || 0) * remainingPct) / 100);
    return { contractId: c.id, contractNumber: c.contractNumber, customerName: custNames.get(c.customerId) || c.customerId, endDate: c.endDate, remainingPercent: remainingPct, remainingAmount };
  }).filter(c => c.remainingAmount > 0).sort((a, b) => a.endDate.localeCompare(b.endDate)).slice(0, 10);

  return {
    kpis: { customers: cu.length, activeContracts: co.filter(c => c.status === 'Active').length, openTickets: open.length, criticalTickets: open.filter(t => t.priority === 'Critical').length,
      pendingInvoices: live.filter(i => Number(i.balanceDue) > 0).length, outstanding: Math.round(live.reduce((a, i) => a + Number(i.balanceDue), 0)),
      monthRevenue: Math.round(byMonth[new Date().toISOString().slice(0, 7)] || 0) },
    revenue: series(byMonth, 'revenue'), growth: series(growth, 'customers'), ticketsByStatus: count(tk, 'status'), ticketsByPriority: count(tk, 'priority'), invoiceStatus: count(inv, 'status'),
    finance: {
      contractsTotal, invoiced: invoicedAgainstContracts, paid: r2(live.reduce((a, i) => a + Number(i.amountPaid || 0), 0)), outstanding: r2(live.reduce((a, i) => a + Number(i.balanceDue || 0), 0)),
      remainingContractValue: Math.max(0, r2(contractsTotal - invoicedAgainstContracts)), overdueAmount, overdueCount: overdueInvoices.length, aging: ageBuckets, fyRevenue, gst, gstTotals, upcomingInvoices,
    },
  };
});
