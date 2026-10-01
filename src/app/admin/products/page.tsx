'use client';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Snackbar, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import GridView from '@mui/icons-material/GridView';
import ViewList from '@mui/icons-material/ViewList';
import { Button, CardSkeleton, EmptyRow, TableSkeleton } from '@/components/ui';
type Row = { id: string; name: string; description: string; category: string; rate: number; hsnSac: string; gstPercent: number; active: boolean };
const CATS = ['Business Central', 'Sales Application', 'POS', 'Power BI', 'Integration', 'Development', 'Support', 'Consulting', 'Other'];
const blank = { name: '', description: '', category: 'Other', rate: '0', hsnSac: '', gstPercent: '18' };
const inr = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export default function Products() {
  const [rows, setRows] = useState<Row[] | null>(null); const [view, setView] = useState<'tile' | 'list'>('tile'); const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null); const [f, setF] = useState(blank); const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const load = useCallback(async () => { const r = await fetch('/api/products'); if (r.ok) setRows((await r.json()).rows); }, []);
  useEffect(() => { load(); }, [load]);
  const openNew = () => { setEditing(null); setF(blank); setErr(''); setOpen(true); };
  const openEdit = (p: Row) => { setEditing(p); setF({ name: p.name, description: p.description, category: p.category, rate: String(p.rate), hsnSac: p.hsnSac, gstPercent: String(p.gstPercent) }); setErr(''); setOpen(true); };
  const save = async () => {
    const payload = { ...f, rate: Number(f.rate) || 0, gstPercent: Number(f.gstPercent) || 0 };
    const r = editing ? await fetch(`/api/products/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (r.ok) { setOpen(false); load(); } else setErr((await r.json()).message || 'Product could not be saved.');
  };
  const toggleActive = async (p: Row) => { const r = await fetch(`/api/products/${p.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !p.active }) }); r.ok ? load() : setMsg('Could not update status.'); };
  return (
    <Box sx={{ p: 3, display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="h5" fontWeight={700} sx={{ flexGrow: 1 }}>Products & Services</Typography>
        <ToggleButtonGroup size="small" value={view} exclusive onChange={(_, v) => v && setView(v)}>
          <ToggleButton value="tile" aria-label="tile view"><GridView fontSize="small" /></ToggleButton>
          <ToggleButton value="list" aria-label="list view"><ViewList fontSize="small" /></ToggleButton>
        </ToggleButtonGroup>
        <Button variant="contained" color="secondary" onClick={openNew}>New product / service</Button>
      </Box>
      {view === 'tile' && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(3,1fr)' } }}>
          {rows === null && Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} height={140} />)}
          {rows !== null && !rows.length && <Typography color="text.secondary">No products yet.</Typography>}
          {rows?.map(p => (
            <Card key={p.id} sx={{ opacity: p.active ? 1 : 0.6 }}><CardContent sx={{ display: 'grid', gap: 0.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <Typography fontWeight={700}>{p.name}</Typography><Chip size="small" label={p.category} /></Box>
              <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40 }}>{p.description || '-'}</Typography>
              <Typography variant="h6" color="primary" fontWeight={800}>INR {inr(p.rate)}</Typography>
              <Typography variant="caption" color="text.secondary">HSN/SAC {p.hsnSac || '-'} - GST {p.gstPercent}%</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                <Button size="small" onClick={() => openEdit(p)}>Edit</Button>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Typography variant="caption">{p.active ? 'Active' : 'Disabled'}</Typography><Switch size="small" checked={p.active} onChange={() => toggleActive(p)} /></Box>
              </Box>
            </CardContent></Card>))}
        </Box>
      )}
      {view === 'list' && (
        <Paper sx={{ overflowX: 'auto' }}><Table size="small">
          <TableHead><TableRow>{['Name', 'Category', 'Rate (INR)', 'HSN/SAC', 'GST %', 'Status', ''].map(h => <TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {rows === null && <TableSkeleton cols={7} />}
            {rows !== null && !rows.length && <EmptyRow cols={7} title="No products yet" hint="Add your first product or service." />}
            {rows?.map(p => <TableRow key={p.id} hover>
              <TableCell sx={{ fontWeight: 600 }}>{p.name}</TableCell><TableCell>{p.category}</TableCell><TableCell align="right">{inr(p.rate)}</TableCell>
              <TableCell>{p.hsnSac || '-'}</TableCell><TableCell>{p.gstPercent}%</TableCell>
              <TableCell><Chip size="small" label={p.active ? 'Active' : 'Disabled'} color={p.active ? 'success' : 'default'} /></TableCell>
              <TableCell><Button size="small" onClick={() => openEdit(p)}>Edit</Button></TableCell></TableRow>)}
          </TableBody></Table></Paper>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs"><DialogTitle>{editing ? 'Edit product / service' : 'New product / service'}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
          {err && <Alert severity="error">{err}</Alert>}
          <TextField label="Name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
          <TextField label="Description" multiline minRows={2} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
          <TextField select label="Category" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>{CATS.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}</TextField>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Rate (INR)" value={f.rate} onChange={e => setF({ ...f, rate: e.target.value })} sx={{ flex: 1 }} />
            <TextField label="GST %" value={f.gstPercent} onChange={e => setF({ ...f, gstPercent: e.target.value })} sx={{ flex: 1 }} /></Box>
          <TextField label="HSN/SAC" value={f.hsnSac} onChange={e => setF({ ...f, hsnSac: e.target.value })} />
        </DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" disabled={!f.name} onClick={save}>Save</Button></DialogActions></Dialog>
      <Snackbar open={!!msg} autoHideDuration={4000} onClose={() => setMsg('')} message={msg} />
    </Box>);
}
