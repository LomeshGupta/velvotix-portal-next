'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Box, Card, CardContent, Typography } from '@mui/material';
type P = { name: string; value: number };
type D = { kpis: Record<string, number>; revenue: object[]; growth: object[]; ticketsByStatus: P[]; ticketsByPriority: P[]; invoiceStatus: P[] };
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
    </Box>);
}
