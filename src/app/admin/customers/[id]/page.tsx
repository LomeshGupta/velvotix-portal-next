'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Box, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Paper, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from '@mui/material';
import { Button } from '@/components/ui';
import CustomerForm from '@/components/CustomerForm';
type Row = Record<string, string>;
type Sm = { added: number; used: number; remaining: number; validTill: string; expired: boolean };
const T = ({ h, rows }: { h: string[]; rows: (React.ReactNode)[][] }) => <Paper sx={{ overflowX: 'auto' }}><Table size="small"><TableHead><TableRow>{h.map(x => <TableCell key={x}>{x}</TableCell>)}</TableRow></TableHead><TableBody>{rows.map((r, i) => <TableRow key={i} hover>{r.map((c, j) => <TableCell key={j}>{c}</TableCell>)}</TableRow>)}</TableBody></Table></Paper>;
const KPI = ({ l, v, c }: { l: string; v: React.ReactNode; c?: string }) => <Card sx={{ borderTop: 4, borderColor: c || 'primary.main' }}><CardContent><Typography variant="body2" color="text.secondary">{l}</Typography><Typography variant="h4" fontWeight={800}>{v}</Typography></CardContent></Card>;
export default function CustomerDetail({ params }: { params: { id: string } }) {
  const id = params.id; const [tab, setTab] = useState(0); const [c, setC] = useState<Row | null>(null); const [invs, setInvs] = useState<Row[]>([]); const [tks, setTks] = useState<Row[]>([]);
  const [hrs, setHrs] = useState<{ summary: Sm; ledger: Row[] } | null>(null); const [edit, setEdit] = useState(false); const [add, setAdd] = useState(false); const [h, setH] = useState({ hours: '', validTill: '', note: '' }); const [err, setErr] = useState('');
  const load = useCallback(async () => {
    const [a, b, d, e] = await Promise.all([fetch(`/api/customers/${id}`), fetch(`/api/invoices?customerId=${id}`), fetch(`/api/tickets?customerId=${id}`), fetch(`/api/customers/${id}/hours`)]);
    if (a.ok) setC(await a.json()); if (b.ok) setInvs((await b.json()).rows); if (d.ok) setTks((await d.json()).rows); if (e.ok) setHrs(await e.json());
  }, [id]);
  useEffect(() => { load(); }, [load]);
  const addHours = async () => { const r = await fetch(`/api/customers/${id}/hours`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hours: Number(h.hours), validTill: h.validTill, note: h.note }) }); if (r.ok) { setAdd(false); setH({ hours: '', validTill: '', note: '' }); load(); } else setErr('Hours could not be added (admin access and a valid date are required).'); };
  if (!c) return <Box p={3}>Loading...</Box>;
  const s = hrs?.summary, out = invs.reduce((a, i) => a + Number(i.balanceDue || 0), 0);
  const fields: [string, string][] = [['Customer ID', c.id], ['Type', c.type], ['Contact person', c.contactPerson], ['Email', c.email], ['Phone', c.phone], ['Alternate phone', c.altPhone], ['GSTIN', c.gstin], ['PAN', c.pan], ['CIN', c.cin], ['Customer since', c.customerSince], ['City', c.city], ['State', c.state], ['Country', c.country], ['PIN', c.pin]];
  return (
    <Box sx={{ p: 3, display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}><Button component={Link} href="/admin/customers">Back</Button><Typography variant="h5" fontWeight={800} sx={{ flexGrow: 1 }}>{c.companyName}</Typography>
        <Chip label={c.status} color={c.status === 'Active' ? 'success' : 'default'} /><Button variant="outlined" onClick={() => setEdit(true)}>Edit</Button></Box>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2,1fr)', md: 'repeat(4,1fr)' } }}>
        <KPI l="Hours remaining" v={`${s?.remaining ?? 0} h`} c={s && s.remaining < 5 ? 'error.main' : 'primary.main'} /><KPI l="Hours valid till" v={s?.validTill || '-'} c="secondary.main" /><KPI l="Open tickets" v={tks.filter(t => !['Resolved', 'Closed'].includes(t.status)).length} /><KPI l="Outstanding (INR)" v={Math.round(out).toLocaleString('en-IN')} c="secondary.main" /></Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable">{['Overview', 'Invoices', 'Tickets', 'Support hours'].map(t => <Tab key={t} label={t} />)}</Tabs>
      {tab === 0 && <Card><CardContent sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: '1fr 1fr' }}>{fields.map(([k, v]) => <Box key={k}><Typography variant="caption" color="text.secondary">{k}</Typography><Typography>{v || '-'}</Typography></Box>)}</Box>
        <Box sx={{ display: 'grid', gap: 2 }}>{[['Billing address', c.billingAddress], ['Shipping address', c.shippingAddress], ['Notes', c.notes]].map(([k, v]) => <Box key={k}><Typography variant="caption" color="text.secondary">{k}</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{v || '-'}</Typography></Box>)}</Box></CardContent></Card>}
      {tab === 1 && <T h={['Invoice', 'Date', 'Total', 'Paid', 'Balance', 'Status']} rows={invs.map(i => [<Link key="l" href={`/admin/invoices/${i.id}`} style={{ fontWeight: 600, color: 'inherit' }}>{i.id}</Link>, i.date, i.grandTotal, i.amountPaid, i.balanceDue, <Chip key="c" size="small" label={i.status} color={i.status === 'Paid' ? 'success' : 'default'} />])} />}
      {tab === 2 && <T h={['Ticket', 'Subject', 'Priority', 'Status']} rows={tks.map(t => [<Link key="l" href={`/admin/tickets/${t.id}`} style={{ fontWeight: 600, color: 'inherit' }}>{t.id}</Link>, t.subject, t.priority, t.status])} />}
      {tab === 3 && <>
        <Card><CardContent sx={{ display: 'grid', gap: 1 }}><Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography fontWeight={700}>{s?.used ?? 0} of {s?.added ?? 0} valid hours used {s?.expired && <Chip size="small" color="error" label="Expired" />}</Typography><Button variant="contained" color="secondary" onClick={() => setAdd(true)}>Add hours</Button></Box>
          <LinearProgress variant="determinate" value={s && s.added ? Math.min(100, (s.used / s.added) * 100) : 0} sx={{ height: 10, borderRadius: 5 }} /></CardContent></Card>
        <T h={['Date', 'Type', 'Hours', 'Valid till', 'Ticket', 'Note']} rows={(hrs?.ledger || []).map(l => [l.createdAt.slice(0, 10), <Chip key="c" size="small" label={l.type === 'ADD' ? 'Added' : 'Used'} color={l.type === 'ADD' ? 'success' : 'warning'} />, l.hours, l.validTill, l.ticketId, l.note])} /></>}
      <CustomerForm open={edit} initial={c} onClose={() => setEdit(false)} onSaved={load} />
      <Dialog open={add} onClose={() => setAdd(false)} fullWidth maxWidth="xs"><DialogTitle>Add support hours</DialogTitle><DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        {err && <Alert severity="error">{err}</Alert>}<TextField type="number" label="Hours" value={h.hours} onChange={e => setH({ ...h, hours: e.target.value })} />
        <TextField type="date" label="Valid till (expiry)" InputLabelProps={{ shrink: true }} value={h.validTill} onChange={e => setH({ ...h, validTill: e.target.value })} /><TextField label="Note" value={h.note} onChange={e => setH({ ...h, note: e.target.value })} /></DialogContent>
        <DialogActions><Button onClick={() => setAdd(false)}>Cancel</Button><Button variant="contained" onClick={addHours}>Add</Button></DialogActions></Dialog>
    </Box>);
}
