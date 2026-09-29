'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Box, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, MenuItem, Paper, Snackbar, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Button } from '@/components/ui';
type Row = Record<string, string>;
type Sm = { added: number; used: number; remaining: number; validTill: string; expired: boolean };
const CATS = ['Technical Support', 'Business Central', 'ERP', 'Application', 'Integration', 'Billing', 'General', 'Other'];
const sc = (s: string) => (s === 'Resolved' || s === 'Closed' ? 'success' : s === 'Open' ? 'warning' : 'primary');
export default function Portal() {
  const router = useRouter(); const [rows, setRows] = useState<Row[]>([]); const [sm, setSm] = useState<Sm | null>(null); const [pend, setPend] = useState<Row[]>([]); const [me, setMe] = useState<Row | null>(null);
  const [open, setOpen] = useState(false); const [msg, setMsg] = useState(''); const [f, setF] = useState({ subject: '', description: '', category: 'General', priority: 'Medium' });
  const load = useCallback(async () => {
    const m = await fetch('/api/auth/me'); if (!m.ok) return router.push('/');
    const u = await m.json(); setMe(u);
    const [t, h, r] = await Promise.all([fetch('/api/tickets'), fetch(`/api/customers/${u.customerId}/hours`), fetch('/api/hour-requests?status=Pending')]);
    if (t.ok) setRows((await t.json()).rows); if (h.ok) setSm((await h.json()).summary); if (r.ok) setPend((await r.json()).rows);
  }, [router]);
  useEffect(() => { load(); }, [load]);
  const decide = async (id: string, decision: string) => { const r = await fetch(`/api/hour-requests/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }) }); r.ok ? load() : setMsg((await r.json()).message); };
  const save = async () => { const r = await fetch('/api/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }); if (r.ok) { setOpen(false); setF({ ...f, subject: '', description: '' }); load(); } else setMsg('Support ticket could not be submitted.'); };
  const days = sm?.validTill ? Math.ceil((new Date(sm.validTill).getTime() - Date.now()) / 864e5) : null;
  const openCount = rows.filter(r => !['Resolved', 'Closed'].includes(r.status)).length;
  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Box><Typography variant="h5" fontWeight={800}>Welcome{me?.name ? `, ${me.name}` : ''}</Typography><Typography color="text.secondary">Track your support requests and hours in one place.</Typography></Box>
        <Button variant="contained" color="secondary" size="large" onClick={() => setOpen(true)}>Raise a ticket</Button></Box>
      {days !== null && days <= 30 && <Alert severity={days < 0 ? 'error' : 'warning'}>{days < 0 ? 'Your support hours have expired.' : `Your support hours expire in ${days} day(s).`} Contact Velvotix to renew.</Alert>}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr' } }}>
        <Card sx={{ background: 'linear-gradient(135deg,#1565c0,#0d47a1)', color: '#fff' }}><CardContent><Typography sx={{ opacity: 0.8 }}>Support hours remaining</Typography>
          <Typography variant="h3" fontWeight={800}>{sm?.remaining ?? 0} <span style={{ fontSize: 18 }}>hours</span></Typography>
          <LinearProgress variant="determinate" value={sm && sm.added ? Math.min(100, (sm.used / sm.added) * 100) : 0} sx={{ my: 1.5, height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,.25)', '& .MuiLinearProgress-bar': { bgcolor: '#ef6c00' } }} />
          <Typography variant="body2" sx={{ opacity: 0.85 }}>{sm?.used ?? 0} of {sm?.added ?? 0} used - {sm?.validTill ? `valid till ${sm.validTill}` : 'no active pack'}</Typography></CardContent></Card>
        <Card><CardContent><Typography color="text.secondary">Open tickets</Typography><Typography variant="h3" fontWeight={800} color="primary">{openCount}</Typography></CardContent></Card>
        <Card><CardContent><Typography color="text.secondary">Awaiting your approval</Typography><Typography variant="h3" fontWeight={800} color="secondary">{pend.length}</Typography></CardContent></Card></Box>
      {pend.length > 0 && <Card><CardContent sx={{ display: 'grid', gap: 1.5 }}><Typography fontWeight={700}>Hours approval requests</Typography>
        {pend.map(r => <Box key={r.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap', p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
          <Box><Typography fontWeight={700}>{r.hours} h on {r.ticketId}</Typography><Typography variant="body2" color="text.secondary">{r.reason} - requested by {r.requestedByName}</Typography></Box>
          <Box sx={{ display: 'flex', gap: 1 }}><Button variant="contained" onClick={() => decide(r.id, 'Approved')}>Approve</Button><Button color="error" onClick={() => decide(r.id, 'Rejected')}>Reject</Button></Box></Box>)}</CardContent></Card>}
      <Paper sx={{ overflowX: 'auto' }}><Typography fontWeight={700} sx={{ p: 2 }}>My tickets</Typography><Table size="small">
        <TableHead><TableRow>{['Ticket', 'Subject', 'Category', 'Priority', 'Status', 'Updated'].map(h => <TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead>
        <TableBody>{rows.map(r => <TableRow key={r.id} hover sx={{ cursor: 'pointer' }} onClick={() => router.push(`/portal/tickets/${r.id}`)}><TableCell>{r.id}</TableCell><TableCell>{r.subject}</TableCell><TableCell>{r.category}</TableCell><TableCell>{r.priority}</TableCell>
          <TableCell><Chip size="small" label={r.status} color={sc(r.status)} /></TableCell><TableCell>{r.updatedAt.slice(0, 10)}</TableCell></TableRow>)}</TableBody></Table></Paper>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Raise a ticket</DialogTitle><DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        <TextField label="Subject" value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} /><TextField label="Description" multiline minRows={3} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
        <TextField select label="Category" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>{CATS.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}</TextField>
        <TextField select label="Priority" value={f.priority} onChange={e => setF({ ...f, priority: e.target.value })}>{['Low', 'Medium', 'High', 'Critical'].map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}</TextField></DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" disabled={!f.subject || !f.description} onClick={save}>Submit</Button></DialogActions></Dialog>
      <Snackbar open={!!msg} autoHideDuration={4000} onClose={() => setMsg('')} message={msg} />
    </Box>);
}
