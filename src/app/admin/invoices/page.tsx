'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Snackbar, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
type Inv = { id: string; date: string; dueDate: string; status: string; grandTotal: string; amountPaid: string; balanceDue: string };
type Ent = { date: string; ref: string; type: string; debit: number; credit: number; balance: number };
const blank = { description: '', hsnSac: '', qty: 1, rate: 0, taxPercent: 18 };
const today = () => new Date().toISOString().slice(0, 10);
const post = (u: string, b: unknown) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
export default function Invoices() {
  const [custs, setCusts] = useState<Record<string, string>[]>([]); const [cid, setCid] = useState('');
  const [invs, setInvs] = useState<Inv[]>([]); const [ledger, setLedger] = useState<{ entries: Ent[]; outstanding: number } | null>(null);
  const [open, setOpen] = useState(false); const [h, setH] = useState({ date: today(), dueDate: today(), placeOfSupply: '', billingAddress: '' }); const [lines, setLines] = useState([{ ...blank }]);
  const [pay, setPay] = useState<Inv | null>(null); const [amt, setAmt] = useState(0); const [mode, setMode] = useState('Bank Transfer'); const [msg, setMsg] = useState('');
  useEffect(() => { fetch('/api/customers?pageSize=100').then(async r => r.ok && setCusts((await r.json()).rows)); }, []);
  const load = useCallback(async () => {
    if (!cid) { setInvs([]); setLedger(null); return; }
    const [a, b] = await Promise.all([fetch(`/api/invoices?customerId=${cid}`), fetch(`/api/customers/${cid}/ledger`)]);
    if (a.ok && b.ok) { setInvs((await a.json()).rows); setLedger(await b.json()); } else setMsg('Unable to load invoices.');
  }, [cid]);
  useEffect(() => { load(); }, [load]);
  const openForm = () => { const c = custs.find(x => x.id === cid); setH({ ...h, placeOfSupply: c?.state || '', billingAddress: c?.billingAddress || '' }); setOpen(true); };
  const create = async () => {
    const res = await post('/api/invoices', { customerId: cid, ...h, items: lines.map(l => ({ ...l, qty: +l.qty, rate: +l.rate, taxPercent: +l.taxPercent })) });
    if (res.ok) { setOpen(false); setLines([{ ...blank }]); load(); } else setMsg('Invoice could not be created.');
  };
  const record = async () => {
    const res = await post(`/api/invoices/${pay!.id}/payments`, { date: today(), amount: +amt, mode });
    if (res.ok) { setPay(null); load(); } else setMsg((await res.json()).message || 'Payment failed.');
  };
  const setLine = (i: number, k: string, v: string) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto', display: 'grid', gap: 3 }}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="h5" fontWeight={700} sx={{ flexGrow: 1 }}>Invoices & Ledger</Typography>
        <TextField select size="small" label="Customer" value={cid} onChange={e => setCid(e.target.value)} sx={{ minWidth: 260 }}>{custs.map(c => <MenuItem key={c.id} value={c.id}>{c.companyName}</MenuItem>)}</TextField>
        <Button variant="contained" color="secondary" disabled={!cid} onClick={openForm}>Raise Invoice</Button>
      </Box>
      {cid && <>
        <Paper sx={{ overflowX: 'auto' }}><Typography sx={{ p: 2 }} fontWeight={600}>Past invoices</Typography><Table size="small">
          <TableHead><TableRow>{['Invoice', 'Date', 'Due', 'Total', 'Paid', 'Balance', 'Status', ''].map(x => <TableCell key={x}>{x}</TableCell>)}</TableRow></TableHead>
          <TableBody>{invs.map(i => <TableRow key={i.id}><TableCell><Link href={`/admin/invoices/${i.id}`} style={{ color: 'inherit', fontWeight: 600 }}>{i.id}</Link></TableCell><TableCell>{i.date}</TableCell><TableCell>{i.dueDate}</TableCell><TableCell>{i.grandTotal}</TableCell><TableCell>{i.amountPaid}</TableCell><TableCell>{i.balanceDue}</TableCell>
            <TableCell><Chip size="small" label={i.status} color={i.status === 'Paid' ? 'success' : 'default'} /></TableCell>
            <TableCell>{Number(i.balanceDue) > 0 && <Button size="small" onClick={() => { setPay(i); setAmt(Number(i.balanceDue)); }}>Record payment</Button>}</TableCell></TableRow>)}</TableBody></Table></Paper>
        <Paper sx={{ overflowX: 'auto' }}><Typography sx={{ p: 2 }} fontWeight={600}>Ledger - outstanding {ledger?.outstanding ?? 0}</Typography><Table size="small">
          <TableHead><TableRow>{['Date', 'Reference', 'Type', 'Debit', 'Credit', 'Balance'].map(x => <TableCell key={x}>{x}</TableCell>)}</TableRow></TableHead>
          <TableBody>{ledger?.entries.map((e, k) => <TableRow key={k}><TableCell>{e.date}</TableCell><TableCell>{e.ref}</TableCell><TableCell>{e.type}</TableCell><TableCell>{e.debit || ''}</TableCell><TableCell>{e.credit || ''}</TableCell><TableCell>{e.balance}</TableCell></TableRow>)}</TableBody></Table></Paper></>}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md"><DialogTitle>Raise Invoice</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField type="date" label="Date" InputLabelProps={{ shrink: true }} value={h.date} onChange={e => setH({ ...h, date: e.target.value })} />
            <TextField type="date" label="Due" InputLabelProps={{ shrink: true }} value={h.dueDate} onChange={e => setH({ ...h, dueDate: e.target.value })} />
            <TextField label="Place of supply (state)" value={h.placeOfSupply} onChange={e => setH({ ...h, placeOfSupply: e.target.value })} /></Box>
          <TextField multiline minRows={2} label="Billing address (editable for this invoice)" value={h.billingAddress} onChange={e => setH({ ...h, billingAddress: e.target.value })} />
          {lines.map((l, i) => <Box key={i} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <TextField size="small" label="Description" value={l.description} onChange={e => setLine(i, 'description', e.target.value)} sx={{ flex: 2, minWidth: 200 }} />
            <TextField size="small" label="SAC/HSN" value={l.hsnSac} onChange={e => setLine(i, 'hsnSac', e.target.value)} sx={{ width: 100 }} />
            <TextField size="small" label="Qty" value={l.qty} onChange={e => setLine(i, 'qty', e.target.value)} sx={{ width: 70 }} />
            <TextField size="small" label="Rate" value={l.rate} onChange={e => setLine(i, 'rate', e.target.value)} sx={{ width: 110 }} />
            <TextField size="small" label="GST %" value={l.taxPercent} onChange={e => setLine(i, 'taxPercent', e.target.value)} sx={{ width: 80 }} /></Box>)}
          <Button onClick={() => setLines([...lines, { ...blank }])}>Add line</Button>
        </DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" onClick={create}>Create</Button></DialogActions></Dialog>
      <Dialog open={!!pay} onClose={() => setPay(null)}><DialogTitle>Record payment {pay?.id}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
          <TextField label="Amount" value={amt} onChange={e => setAmt(+e.target.value)} />
          <TextField select label="Mode" value={mode} onChange={e => setMode(e.target.value)}>{['Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Card', 'Other'].map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}</TextField></DialogContent>
        <DialogActions><Button onClick={() => setPay(null)}>Cancel</Button><Button variant="contained" onClick={record}>Save</Button></DialogActions></Dialog>
      <Snackbar open={!!msg} autoHideDuration={4000} onClose={() => setMsg('')} message={msg} />
    </Box>
  );
}
