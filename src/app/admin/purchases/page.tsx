'use client';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Snackbar, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from '@mui/material';
import { Button, EmptyRow, TableSkeleton } from '@/components/ui';
type Row = Record<string, string | boolean>;
const send = (m: string, u: string, b?: unknown) => fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
const inr = (n: string | number) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const blankLine = { description: '', qty: 1, rate: 0, taxPercent: 18 };
const today = () => new Date().toISOString().slice(0, 10);
export default function Purchases() {
  const [tab, setTab] = useState(0); const [vendors, setVendors] = useState<Row[] | null>(null); const [pos, setPos] = useState<Row[] | null>(null); const [pis, setPis] = useState<Row[] | null>(null);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const load = useCallback(async () => {
    const [v, p, i] = await Promise.all([fetch('/api/vendors'), fetch('/api/purchase-orders'), fetch('/api/purchase-invoices')]);
    if (v.ok) setVendors((await v.json()).rows); if (p.ok) setPos((await p.json()).rows); if (i.ok) setPis((await i.json()).rows);
  }, []);
  useEffect(() => { load(); }, [load]);

  const [vOpen, setVOpen] = useState(false); const [vf, setVf] = useState({ name: '', gstin: '', email: '', phone: '', city: '', state: '' });
  const saveVendor = async () => { const r = await send('POST', '/api/vendors', vf); if (r.ok) { setVOpen(false); setVf({ name: '', gstin: '', email: '', phone: '', city: '', state: '' }); load(); } else setErr((await r.json()).message || 'Vendor could not be saved.'); };

  const [poOpen, setPoOpen] = useState(false); const [pof, setPof] = useState({ vendorId: '', date: today(), expectedDate: '', notes: '' }); const [poLines, setPoLines] = useState([{ ...blankLine }]);
  const savePo = async () => { const r = await send('POST', '/api/purchase-orders', { ...pof, items: poLines.map(l => ({ ...l, qty: +l.qty, rate: +l.rate, taxPercent: +l.taxPercent })) }); if (r.ok) { setPoOpen(false); setPoLines([{ ...blankLine }]); load(); } else setErr((await r.json()).message || 'Purchase order could not be created.'); };

  const [piOpen, setPiOpen] = useState(false); const [pif, setPif] = useState({ vendorId: '', vendorInvoiceNo: '', date: today(), dueDate: today(), subtotal: '0', tax: '0', notes: '' });
  const savePi = async () => { const r = await send('POST', '/api/purchase-invoices', { ...pif, subtotal: +pif.subtotal, tax: +pif.tax }); if (r.ok) { setPiOpen(false); load(); } else setErr((await r.json()).message || 'Purchase invoice could not be created.'); };

  const [pay, setPay] = useState<Row | null>(null); const [amt, setAmt] = useState(0); const [mode, setMode] = useState('Bank Transfer');
  const recordPay = async () => { const r = await send('POST', `/api/purchase-invoices/${pay!.id}/payments`, { date: today(), amount: amt, mode }); if (r.ok) { setPay(null); load(); } else setMsg((await r.json()).message || 'Payment failed.'); };

  const vname = (id: string) => (vendors || []).find(v => v.id === id)?.name || id;

  return (
    <Box sx={{ p: 3, display: 'grid', gap: 2 }}>
      <Typography variant="h5" fontWeight={700}>Purchases & Vendors</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}><Tab label="Vendors" /><Tab label="Purchase Orders" /><Tab label="Purchase Invoices" /></Tabs>

      {tab === 0 && <Box sx={{ display: 'grid', gap: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}><Button variant="contained" color="secondary" onClick={() => setVOpen(true)}>New vendor</Button></Box>
        <Paper sx={{ overflowX: 'auto' }}><Table size="small">
          <TableHead><TableRow>{['Vendor', 'GSTIN', 'Contact', 'City / State', 'Status'].map(h => <TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>{vendors === null && <TableSkeleton cols={5} />}{vendors !== null && !vendors.length && <EmptyRow cols={5} title="No vendors yet" />}
            {vendors?.map(v => <TableRow key={v.id as string} hover><TableCell sx={{ fontWeight: 600 }}>{v.name as string}</TableCell><TableCell>{v.gstin as string || '-'}</TableCell>
              <TableCell>{v.email as string || v.phone as string || '-'}</TableCell><TableCell>{[v.city, v.state].filter(Boolean).join(', ') || '-'}</TableCell>
              <TableCell><Chip size="small" label={v.status as string} color={v.status === 'Active' ? 'success' : 'default'} /></TableCell></TableRow>)}</TableBody></Table></Paper></Box>}

      {tab === 1 && <Box sx={{ display: 'grid', gap: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}><Button variant="contained" color="secondary" disabled={!vendors?.length} onClick={() => setPoOpen(true)}>New purchase order</Button></Box>
        <Paper sx={{ overflowX: 'auto' }}><Table size="small">
          <TableHead><TableRow>{['PO', 'Vendor', 'Date', 'Expected', 'Total', 'Status'].map(h => <TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>{pos === null && <TableSkeleton cols={6} />}{pos !== null && !pos.length && <EmptyRow cols={6} title="No purchase orders yet" />}
            {pos?.map(p => <TableRow key={p.id as string} hover><TableCell>{p.id as string}</TableCell><TableCell>{p.vendorName as string}</TableCell><TableCell>{p.date as string}</TableCell>
              <TableCell>{p.expectedDate as string || '-'}</TableCell><TableCell align="right">{inr(p.total as string)}</TableCell><TableCell><Chip size="small" label={p.status as string} /></TableCell></TableRow>)}</TableBody></Table></Paper></Box>}

      {tab === 2 && <Box sx={{ display: 'grid', gap: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}><Button variant="contained" color="secondary" disabled={!vendors?.length} onClick={() => setPiOpen(true)}>New purchase invoice</Button></Box>
        <Paper sx={{ overflowX: 'auto' }}><Table size="small">
          <TableHead><TableRow>{['Invoice', "Vendor's ref", 'Vendor', 'Due', 'Total', 'Paid', 'Balance', 'Status', ''].map(h => <TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>{pis === null && <TableSkeleton cols={9} />}{pis !== null && !pis.length && <EmptyRow cols={9} title="No purchase invoices yet" />}
            {pis?.map(p => <TableRow key={p.id as string} hover><TableCell>{p.id as string}</TableCell><TableCell>{p.vendorInvoiceNo as string}</TableCell><TableCell>{p.vendorName as string}</TableCell>
              <TableCell>{p.dueDate as string}</TableCell><TableCell align="right">{inr(p.total as string)}</TableCell><TableCell align="right">{inr(p.amountPaid as string)}</TableCell>
              <TableCell align="right">{inr(p.balanceDue as string)}</TableCell>
              <TableCell><Chip size="small" label={p.overdue ? 'Overdue' : p.status as string} color={p.overdue ? 'error' : p.status === 'Paid' ? 'success' : 'default'} /></TableCell>
              <TableCell>{Number(p.balanceDue) > 0 && <Button size="small" onClick={() => { setPay(p); setAmt(Number(p.balanceDue)); }}>Record payment</Button>}</TableCell></TableRow>)}</TableBody></Table></Paper></Box>}

      <Dialog open={vOpen} onClose={() => setVOpen(false)} fullWidth maxWidth="xs"><DialogTitle>New vendor</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>{err && <Alert severity="error">{err}</Alert>}
          <TextField label="Vendor name" value={vf.name} onChange={e => setVf({ ...vf, name: e.target.value })} />
          <TextField label="GSTIN" value={vf.gstin} onChange={e => setVf({ ...vf, gstin: e.target.value })} />
          <TextField label="Email" value={vf.email} onChange={e => setVf({ ...vf, email: e.target.value })} />
          <TextField label="Phone" value={vf.phone} onChange={e => setVf({ ...vf, phone: e.target.value })} />
          <Box sx={{ display: 'flex', gap: 2 }}><TextField label="City" value={vf.city} onChange={e => setVf({ ...vf, city: e.target.value })} sx={{ flex: 1 }} />
            <TextField label="State" value={vf.state} onChange={e => setVf({ ...vf, state: e.target.value })} sx={{ flex: 1 }} /></Box></DialogContent>
        <DialogActions><Button onClick={() => setVOpen(false)}>Cancel</Button><Button variant="contained" disabled={!vf.name} onClick={saveVendor}>Save</Button></DialogActions></Dialog>

      <Dialog open={poOpen} onClose={() => setPoOpen(false)} fullWidth maxWidth="md"><DialogTitle>New purchase order</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>{err && <Alert severity="error">{err}</Alert>}
          <TextField select label="Vendor" value={pof.vendorId} onChange={e => setPof({ ...pof, vendorId: e.target.value })}>{vendors?.map(v => <MenuItem key={v.id as string} value={v.id as string}>{v.name as string}</MenuItem>)}</TextField>
          <Box sx={{ display: 'flex', gap: 2 }}><TextField type="date" label="Date" InputLabelProps={{ shrink: true }} value={pof.date} onChange={e => setPof({ ...pof, date: e.target.value })} />
            <TextField type="date" label="Expected delivery" InputLabelProps={{ shrink: true }} value={pof.expectedDate} onChange={e => setPof({ ...pof, expectedDate: e.target.value })} /></Box>
          {poLines.map((l, i) => <Box key={i} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <TextField size="small" label="Description" value={l.description} onChange={e => setPoLines(poLines.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} sx={{ flex: 2, minWidth: 200 }} />
            <TextField size="small" label="Qty" value={l.qty} onChange={e => setPoLines(poLines.map((x, j) => j === i ? { ...x, qty: +e.target.value } : x))} sx={{ width: 80 }} />
            <TextField size="small" label="Rate" value={l.rate} onChange={e => setPoLines(poLines.map((x, j) => j === i ? { ...x, rate: +e.target.value } : x))} sx={{ width: 110 }} />
            <TextField size="small" label="GST %" value={l.taxPercent} onChange={e => setPoLines(poLines.map((x, j) => j === i ? { ...x, taxPercent: +e.target.value } : x))} sx={{ width: 90 }} /></Box>)}
          <Button size="small" onClick={() => setPoLines([...poLines, { ...blankLine }])}>Add line</Button></DialogContent>
        <DialogActions><Button onClick={() => setPoOpen(false)}>Cancel</Button><Button variant="contained" disabled={!pof.vendorId} onClick={savePo}>Create</Button></DialogActions></Dialog>

      <Dialog open={piOpen} onClose={() => setPiOpen(false)} fullWidth maxWidth="xs"><DialogTitle>New purchase invoice</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>{err && <Alert severity="error">{err}</Alert>}
          <TextField select label="Vendor" value={pif.vendorId} onChange={e => setPif({ ...pif, vendorId: e.target.value })}>{vendors?.map(v => <MenuItem key={v.id as string} value={v.id as string}>{v.name as string}</MenuItem>)}</TextField>
          <TextField label="Vendor's invoice no." value={pif.vendorInvoiceNo} onChange={e => setPif({ ...pif, vendorInvoiceNo: e.target.value })} />
          <Box sx={{ display: 'flex', gap: 2 }}><TextField type="date" label="Date" InputLabelProps={{ shrink: true }} value={pif.date} onChange={e => setPif({ ...pif, date: e.target.value })} />
            <TextField type="date" label="Due" InputLabelProps={{ shrink: true }} value={pif.dueDate} onChange={e => setPif({ ...pif, dueDate: e.target.value })} /></Box>
          <Box sx={{ display: 'flex', gap: 2 }}><TextField label="Subtotal" value={pif.subtotal} onChange={e => setPif({ ...pif, subtotal: e.target.value })} sx={{ flex: 1 }} />
            <TextField label="Tax" value={pif.tax} onChange={e => setPif({ ...pif, tax: e.target.value })} sx={{ flex: 1 }} /></Box></DialogContent>
        <DialogActions><Button onClick={() => setPiOpen(false)}>Cancel</Button><Button variant="contained" disabled={!pif.vendorId || !pif.vendorInvoiceNo} onClick={savePi}>Create</Button></DialogActions></Dialog>

      <Dialog open={!!pay} onClose={() => setPay(null)}><DialogTitle>Record payment {pay?.id as string}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
          <TextField label="Amount" value={amt} onChange={e => setAmt(+e.target.value)} />
          <TextField select label="Mode" value={mode} onChange={e => setMode(e.target.value)}>{['Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Card', 'Other'].map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}</TextField></DialogContent>
        <DialogActions><Button onClick={() => setPay(null)}>Cancel</Button><Button variant="contained" onClick={recordPay}>Save</Button></DialogActions></Dialog>
      <Snackbar open={!!msg} autoHideDuration={4000} onClose={() => setMsg('')} message={msg} />
    </Box>);
}
