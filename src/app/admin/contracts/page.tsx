'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Paper, Snackbar, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Button } from '@/components/ui';
type Row = Record<string, string>;
const send = (m: string, u: string, b: unknown) => fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
const inr = (n: string) => Number(n || 0).toLocaleString('en-IN');
const TYPES = ['AMC', 'Support Pack', 'Retainer', 'Implementation', 'Other'];
const FREQ = ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly', 'One-time'];
const empty = { customerId: '', contractNumber: '', type: 'AMC', startDate: '', endDate: '', billingFrequency: 'Yearly', amount: '0', tax: '0', supportHours: '0', sla: '', prioritySupport: false, notes: '' };
const color = (s: string) => (s === 'Active' ? 'success' : s === 'Expiring' ? 'warning' : s === 'Cancelled' || s === 'Expired' ? 'error' : 'default');
export default function Contracts() {
  const [rows, setRows] = useState<Row[]>([]); const [custs, setCusts] = useState<Row[]>([]); const [cid, setCid] = useState(''); const [q, setQ] = useState('');
  const [open, setOpen] = useState(false); const [editId, setEditId] = useState(''); const [f, setF] = useState<Record<string, string | boolean>>(empty); const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const load = useCallback(async () => { const r = await fetch('/api/contracts'); if (r.ok) { const j = await r.json(); setRows(j.rows.reverse()); setCusts(j.customers || []); } else setMsg('Unable to load contracts.'); }, []);
  useEffect(() => { load(); }, [load]);
  const shown = useMemo(() => rows.filter(r => (!cid || r.customerId === cid) && (!q || `${r.contractNumber} ${r.customerName} ${r.type}`.toLowerCase().includes(q.toLowerCase()))), [rows, cid, q]);
  const openNew = () => { setEditId(''); setF({ ...empty, customerId: cid }); setErr(''); setOpen(true); };
  const openEdit = (r: Row) => { setEditId(r.id); setF({ ...r, prioritySupport: r.prioritySupport === 'true' }); setErr(''); setOpen(true); };
  const total = (Number(f.amount) || 0) + (Number(f.tax) || 0);
  const save = async () => {
    const b = { contractNumber: f.contractNumber, type: f.type, startDate: f.startDate, endDate: f.endDate, billingFrequency: f.billingFrequency || '', amount: Number(f.amount), tax: Number(f.tax),
      supportHours: Number(f.supportHours), sla: f.sla || '', prioritySupport: !!f.prioritySupport, notes: f.notes || '' };
    const res = editId ? await send('PUT', `/api/contracts/${editId}`, b) : await send('POST', '/api/contracts', { ...b, customerId: f.customerId });
    if (res.ok) { setOpen(false); setMsg(editId ? 'Contract updated.' : 'Contract created.'); load(); }
    else { const j = await res.json().catch(() => ({})); setErr(j.issues?.[0]?.message || j.message || 'Contract could not be saved.'); }
  };
  const setStatus = async (r: Row, status: 'Active' | 'Cancelled') => { const res = await send('PUT', `/api/contracts/${r.id}`, { status }); setMsg(res.ok ? `Contract ${status === 'Cancelled' ? 'cancelled' : 'reactivated'}.` : 'Update failed.'); if (res.ok) load(); };
  const txt = (k: string, l: string, extra: object = {}) => <TextField key={k} label={l} value={(f[k] as string) ?? ''} onChange={e => setF({ ...f, [k]: e.target.value })} {...extra} />;
  return (
    <Box sx={{ p: 3, maxWidth: 1300, mx: 'auto', display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="h5" fontWeight={700} sx={{ flexGrow: 1 }}>Support Contracts</Typography>
        <TextField size="small" placeholder="Search contract, customer" value={q} onChange={e => setQ(e.target.value)} />
        <TextField select size="small" label="Customer" value={cid} onChange={e => setCid(e.target.value)} sx={{ minWidth: 220 }}><MenuItem value="">All customers</MenuItem>{custs.map(c => <MenuItem key={c.id} value={c.id}>{c.companyName}</MenuItem>)}</TextField>
        <Button variant="contained" color="secondary" onClick={openNew}>New contract</Button></Box>
      <Paper sx={{ overflowX: 'auto' }}><Table size="small">
        <TableHead><TableRow>{['Contract', 'Customer', 'Type', 'Period', 'Total (INR)', 'Hours', 'Billing', 'Status', ''].map(x => <TableCell key={x}>{x}</TableCell>)}</TableRow></TableHead>
        <TableBody>{shown.map(r => <TableRow key={r.id} hover>
          <TableCell sx={{ fontWeight: 600 }}>{r.contractNumber}</TableCell><TableCell>{r.customerName}</TableCell><TableCell>{r.type}</TableCell><TableCell>{r.startDate} to {r.endDate}</TableCell>
          <TableCell align="right">{inr(r.total)}</TableCell><TableCell>{r.supportHours}</TableCell><TableCell>{r.billingFrequency || '-'}</TableCell>
          <TableCell><Chip size="small" label={r.status} color={color(r.status)} /></TableCell>
          <TableCell sx={{ whiteSpace: 'nowrap' }}><Button size="small" onClick={() => openEdit(r)}>Edit</Button>
            {r.status === 'Cancelled' ? <Button size="small" onClick={() => setStatus(r, 'Active')}>Reactivate</Button> : <Button size="small" color="error" onClick={() => setStatus(r, 'Cancelled')}>Cancel</Button>}</TableCell></TableRow>)}
          {!shown.length && <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>No contracts found.</TableCell></TableRow>}</TableBody></Table></Paper>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md"><DialogTitle>{editId ? 'Edit contract' : 'New contract'}</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>{err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField select label="Customer" disabled={!!editId} value={f.customerId as string} onChange={e => setF({ ...f, customerId: e.target.value })}>{custs.map(c => <MenuItem key={c.id} value={c.id}>{c.companyName}</MenuItem>)}</TextField>
            {txt('contractNumber', 'Contract number')}
            <TextField select label="Type" value={f.type as string} onChange={e => setF({ ...f, type: e.target.value })}>{TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</TextField>
            <TextField select label="Billing frequency" value={(f.billingFrequency as string) || ''} onChange={e => setF({ ...f, billingFrequency: e.target.value })}>{FREQ.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</TextField>
            {txt('startDate', 'Start date', { type: 'date', InputLabelProps: { shrink: true } })}{txt('endDate', 'End date', { type: 'date', InputLabelProps: { shrink: true } })}
            {txt('amount', 'Amount (before tax)', { type: 'number' })}{txt('tax', 'Tax amount', { type: 'number' })}
            {txt('supportHours', 'Support hours', { type: 'number' })}{txt('sla', 'SLA')}
            <FormControlLabel control={<Switch checked={!!f.prioritySupport} onChange={e => setF({ ...f, prioritySupport: e.target.checked })} />} label="Priority support" />
            <Typography sx={{ alignSelf: 'center' }} fontWeight={700}>Total: {inr(String(total))}</Typography>
            {txt('notes', 'Notes', { multiline: true, minRows: 2, sx: { gridColumn: '1 / -1' } })}</Box></DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" onClick={save}>Save contract</Button></DialogActions></Dialog>
      <Snackbar open={!!msg} autoHideDuration={4000} onClose={() => setMsg('')} message={msg} />
    </Box>);
}
