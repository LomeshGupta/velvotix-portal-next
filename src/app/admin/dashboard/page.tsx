'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Box, Card, CardContent, Chip, LinearProgress, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
type P = { name: string; value: number };
type Finance = {
  contractsTotal: number; invoiced: number; paid: number; outstanding: number; remainingContractValue: number; overdueAmount: number; overdueCount: number;
  aging: { current: number; d1_30: number; d31_60: number; d61_90: number; d90plus: number };
  fyRevenue: { fy: string; revenue: number }[]; gst: { month: string; cgst: number; sgst: number; igst: number }[]; gstTotals: { cgst: number; sgst: number; igst: number };
  upcomingInvoices: { contractId: string; contractNumber: string; customerName: string; endDate: string; remainingPercent: number; remainingAmount: number }[];
};
type D = { kpis: Record<string, number>; revenue: object[]; growth: object[]; ticketsByStatus: P[]; ticketsByPriority: P[]; invoiceStatus: P[]; finance: Finance };
const inr = (n: number) => Math.round(n || 0).toLocaleString('en-IN');
const COLORS = ['#1565c0', '#ef6c00', '#2e7d32', '#6a1b9a', '#c62828', '#00838f'];
const LABELS: [string, string][] = [['customers', 'Customers'], ['activeContracts', 'Active contracts'], ['openTickets', 'Open tickets'], ['criticalTickets', 'Critical tickets'], ['pendingInvoices', 'Pending invoices'], ['outstanding', 'Outstanding (INR)'], ['monthRevenue', 'Revenue this month (INR)']];
const Box2 = ({ title, children }: { title: string; children: React.ReactElement }) => <Card><CardContent><Typography fontWeight={600} mb={1}>{title}</Typography><Box sx={{ height: 260 }}><ResponsiveContainer>{children}</ResponsiveContainer></Box></CardContent></Card>;
const Pie2 = ({ data }: { data: P[] }) => <PieChart><Pie data={data} dataKey="value" nameKey="name" outerRadius={90} label>{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart>;
export default function AdminDashboard() {
  const r = useRouter(); const [d, setD] = useState<D | null>(null);
  useEffect(() => { fetch('/api/dashboard/admin').then(async x => (x.ok ? setD(await x.json()) : r.push('/admin/login'))); }, [r]);
  if (!d) return <Box p={3}>Loading...</Box>;
  return (
    <Box sx={{ p: 3, display: 'grid', gap: 3 }}>
      <Typography variant="h5" fontWeight={700}>Dashboard</Typography>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2,1fr)', lg: 'repeat(4,1fr)' } }}>
        {LABELS.map(([k, l], i) => <Card key={k} sx={{ borderTop: 4, borderColor: i % 2 ? 'secondary.main' : 'primary.main' }}><CardContent><Typography color="text.secondary" variant="body2">{l}</Typography><Typography variant="h4" fontWeight={700}>{d.kpis[k].toLocaleString('en-IN')}</Typography></CardContent></Card>)}
      </Box>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        <Box2 title="Revenue received by month"><BarChart data={d.revenue}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Bar dataKey="revenue" fill="#1565c0" radius={[6, 6, 0, 0]} /></BarChart></Box2>
        <Box2 title="Customer growth"><LineChart data={d.growth}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Line dataKey="customers" stroke="#ef6c00" strokeWidth={3} /></LineChart></Box2>
        <Box2 title="Tickets by status"><Pie2 data={d.ticketsByStatus} /></Box2>
        <Box2 title="Tickets by priority"><Pie2 data={d.ticketsByPriority} /></Box2>
        <Box2 title="Invoice status"><Pie2 data={d.invoiceStatus} /></Box2>
      </Box>

      {/* ---- Financial / contract dashboard ---- */}
      <Typography variant="h5" fontWeight={700} sx={{ mt: 1 }}>Financial overview</Typography>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2,1fr)', lg: 'repeat(3,1fr)' } }}>
        {[['Contract value', d.finance.contractsTotal], ['Invoiced against contracts', d.finance.invoiced], ['Paid', d.finance.paid], ['Outstanding', d.finance.outstanding],
          ['Remaining contract value', d.finance.remainingContractValue], ['Overdue amount', d.finance.overdueAmount]].map(([l, v], i) => (
          <Card key={l as string} sx={{ borderTop: 4, borderColor: i % 2 ? 'secondary.main' : 'primary.main' }}><CardContent>
            <Typography color="text.secondary" variant="body2">{l}</Typography><Typography variant="h5" fontWeight={700}>INR {inr(v as number)}</Typography>
            {l === 'Overdue amount' && d.finance.overdueCount > 0 && <Chip size="small" color="error" label={`${d.finance.overdueCount} invoice(s)`} sx={{ mt: 0.5 }} />}
          </CardContent></Card>))}
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        <Card><CardContent>
          <Typography fontWeight={600} mb={1}>Receivables aging</Typography>
          {([['Not yet due', d.finance.aging.current, 'primary.main'], ['1-30 days', d.finance.aging.d1_30, 'warning.main'], ['31-60 days', d.finance.aging.d31_60, 'warning.dark'],
            ['61-90 days', d.finance.aging.d61_90, 'error.main'], ['90+ days', d.finance.aging.d90plus, 'error.dark']] as [string, number, string][]).map(([label, amt, color]) => {
            const total = Object.values(d.finance.aging).reduce((a, b) => a + b, 0) || 1;
            return <Box key={label} sx={{ mb: 1 }}><Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2">{label}</Typography><Typography variant="body2" fontWeight={600}>INR {inr(amt)}</Typography></Box>
              <LinearProgress variant="determinate" value={(amt / total) * 100} sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: color } }} /></Box>;
          })}
        </CardContent></Card>

        <Card><CardContent>
          <Typography fontWeight={600} mb={1}>GST collected (last 6 months)</Typography>
          <Box sx={{ display: 'flex', gap: 3, mb: 1.5 }}>
            {[['CGST', d.finance.gstTotals.cgst], ['SGST', d.finance.gstTotals.sgst], ['IGST', d.finance.gstTotals.igst]].map(([l, v]) => <Box key={l as string}>
              <Typography variant="caption" color="text.secondary">{l}</Typography><Typography fontWeight={700}>INR {inr(v as number)}</Typography></Box>)}
          </Box>
          <Box sx={{ height: 180 }}><ResponsiveContainer><BarChart data={d.finance.gst}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip />
            <Bar dataKey="cgst" stackId="g" fill="#1565c0" /><Bar dataKey="sgst" stackId="g" fill="#42a5f5" /><Bar dataKey="igst" stackId="g" fill="#ef6c00" /></BarChart></ResponsiveContainer></Box>
        </CardContent></Card>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        <Box2 title="Revenue by financial year"><BarChart data={d.finance.fyRevenue}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="fy" /><YAxis /><Tooltip /><Bar dataKey="revenue" fill="#2e7d32" radius={[6, 6, 0, 0]} /></BarChart></Box2>
        <Card><CardContent>
          <Typography fontWeight={600} mb={1}>Upcoming forecasted invoices (milestone contracts)</Typography>
          <Paper variant="outlined" sx={{ overflowX: 'auto' }}><Table size="small">
            <TableHead><TableRow>{['Contract', 'Customer', 'Remaining', 'Est. amount (INR)', 'Contract ends'].map(h => <TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {!d.finance.upcomingInvoices.length && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>No milestone contracts with a remaining balance.</TableCell></TableRow>}
              {d.finance.upcomingInvoices.map(u => <TableRow key={u.contractId} hover>
                <TableCell>{u.contractNumber}</TableCell><TableCell>{u.customerName}</TableCell><TableCell>{u.remainingPercent}%</TableCell>
                <TableCell align="right">{inr(u.remainingAmount)}</TableCell><TableCell>{u.endDate}</TableCell></TableRow>)}
            </TableBody></Table></Paper>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>Based on each contract's milestone invoicing so far. Implementation/phase-completion invoices are raised manually and are not forecast here.</Typography>
        </CardContent></Card>
      </Box>
    </Box>);
}
