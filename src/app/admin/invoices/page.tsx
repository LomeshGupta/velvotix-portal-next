'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, MenuItem, Paper, Snackbar, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from '@mui/material';
type Row = Record<string, string>;
type Ent = { date: string; customerId: string; customerName: string; ref: string; extRef: string; type: string; debit: number; credit: number; balance: number };
type Sum = { customerId: string; customerName: string; billed: number; received: number; outstanding: number };
type Data = { customers: Row[]; invoices: Row[]; entries: Ent[]; summary: Sum[]; totals: { billed: number; received: number; outstanding: number } };
const blank = { description: '', hsnSac: '', qty: 1, rate: 0, taxPercent: 18 };
const today = () => new Date().toISOString().slice(0, 10);
const inr = (n: number | string) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const send = (m: string, u: string, b?: unknown) => fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
const STATUSES = ['Issued', 'Partially Paid', 'Paid', 'Cancelled'];
const KPI = ({ l, v, c }: { l: string; v: string; c?: string }) => <Card sx={{ borderTop: 4, borderColor: c || 'primary.main' }}><CardContent><Typography variant="body2" color="text.secondary">{l}</Typography><Typography variant="h5" fontWeight={800}>{v}</Typography></CardContent></Card>;
const paid = (i: Row) => Number(i.amountPaid) > 0 || ['Paid', 'Partially Paid'].includes(i.status);

export default function Invoices() {
  const [d, setD] = useState<Data | null>(null); const [cid, setCid] = useState(''); const [st, setSt] = useState(''); const [q, setQ] = useState(''); const [tab, setTab] = useState(0);
  const [open, setOpen] = useState(false); const [h, setH] = useState({ customerId: '', externalDocNo: '', date: today(), dueDate: today(), placeOfSupply: '', billingAddress: '' }); const [lines, setLines] = useState([{ ...blank }]);
  const [pay, setPay] = useState<Row | null>(null); const [amt, setAmt] = useState(0); const [mode, setMode] = useState('Bank Transfer'); const [del, setDel] = useState<Row | null>(null);
  const [msg, setMsg] = useState(''); const [formErr, setFormErr] = useState('');

  // ONE request loads customers + invoices + ledger + totals for the current filter.
  const load = useCallback(async () => {
    const r = await fetch(`/api/ledger${cid ? `?customerId=${cid}` : ''}`);
    r.ok ? setD(await r.json()) : setMsg('Unable to load invoices.');
  }, [cid]);
  useEffect(() => { load(); }, [load]);

  const term = q.trim().toLowerCase();
  const invs = useMemo(() => (d?.invoices || []).filter(i => (!st || i.status === st) && (!term || `${i.id} ${i.externalDocNo} ${i.customerName}`.toLowerCase().includes(term))), [d, st, term]);
  const ents = useMemo(() => (d?.entries || []).filter(e => !term || `${e.ref} ${e.extRef} ${e.customerName}`.toLowerCase().includes(term)), [d, term]);

  const openForm = () => {
    const c = d?.customers.find(x => x.id === cid);
    setH({ customerId: cid, externalDocNo: '', date: today(), dueDate: today(), placeOfSupply: c?.state || '', billingAddress: c?.billingAddress || '' }); setFormErr(''); setOpen(true);
  };
  const pickCustomer = (id: string) => { const c = d?.customers.find(x => x.id === id); setH({ ...h, customerId: id, placeOfSupply: c?.state || '', billingAddress: c?.billingAddress || '' }); };
  const create = async () => {
    if (!h.customerId) return setFormErr('Select a customer.');
    if (!h.externalDocNo.trim()) return setFormErr('External document no. is required.');
    const res = await send('POST', '/api/invoices', { ...h, items: lines.map(l => ({ ...l, qty: +l.qty, rate: +l.rate, taxPercent: +l.taxPercent })) });
    if (res.ok) { setOpen(false); setLines([{ ...blank }]); setMsg('Invoice raised.'); load(); } else setFormErr((await res.json()).message || 'Invoice could not be created.');
  };
  const record = async () => {
    const res = await send('POST', `/api/invoices/${pay!.id}/payments`, { date: today(), amount: +amt, mode });
    if (res.ok) { setPay(null); load(); } else setMsg((await res.json()).message || 'Payment failed.');
  };
  const remove = async () => {
    const res = await send('DELETE', `/api/invoices/${del!.id}`);
    setMsg(res.ok ? `Invoice ${del!.id} deleted.` : (await res.json()).message || 'Delete failed.'); setDel(null); if (res.ok) load();
  };
  const setLine = (i: number, k: string, v: string) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const t = d?.totals;
  return (
    <Box sx={{ p: 3, maxWidth: 1300, mx: 'auto', display: 'grid', gap: 3 }}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="h5" fontWeight={700} sx={{ flexGrow: 1 }}>Invoices & Ledger</Typography>
        <TextField select size="small" label="Customer" value={cid} onChange={e => setCid(e.target.value)} sx={{ minWidth: 240 }}>
          <MenuItem value="">All customers</MenuItem>{d?.customers.map(c => <MenuItem key={c.id} value={c.id}>{c.companyName}</MenuItem>)}</TextField>
        <Button variant="contained" color="secondary" onClick={openForm}>Raise Invoice</Button>
      </Box>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3,1fr)' } }}>
        <KPI l="Total billed (INR)" v={inr(t?.billed ?? 0)} /><KPI l="Received (INR)" v={inr(t?.received ?? 0)} c="success.main" /><KPI l="Outstanding (INR)" v={inr(t?.outstanding ?? 0)} c="secondary.main" /></Box>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ flexGrow: 1 }}><Tab label={`Invoices (${invs.length})`} /><Tab label="Ledger" /></Tabs>
        <TextField size="small" placeholder="Search invoice, ext. doc no, customer" value={q} onChange={e => setQ(e.target.value)} sx={{ minWidth: 280 }} />
        {tab === 0 && <TextField select size="small" label="Status" value={st} onChange={e => setSt(e.target.value)} sx={{ minWidth: 150 }}><MenuItem value="">All</MenuItem>{STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField>}
      </Box>

      {tab === 0 && <Paper sx={{ overflowX: 'auto' }}><Table size="small">
        <TableHead><TableRow>{['Invoice', 'Ext. doc no.', 'Customer', 'Date', 'Due', 'Total', 'Paid', 'Balance', 'Status', ''].map(x => <TableCell key={x}>{x}</TableCell>)}</TableRow></TableHead>
        <TableBody>{invs.map(i => <TableRow key={i.id} hover>
          <TableCell><Link href={`/admin/invoices/${i.id}`} style={{ color: 'inherit', fontWeight: 600 }}>{i.id}</Link></TableCell>
          <TableCell>{i.externalDocNo || '-'}</TableCell><TableCell>{i.customerName}</TableCell><TableCell>{i.date}</TableCell><TableCell>{i.dueDate}</TableCell>
          <TableCell align="right">{inr(i.grandTotal)}</TableCell><TableCell align="right">{inr(i.amountPaid)}</TableCell><TableCell align="right">{inr(i.balanceDue)}</TableCell>
          <TableCell><Chip size="small" label={i.status} color={i.status === 'Paid' ? 'success' : i.status === 'Cancelled' ? 'error' : 'default'} /></TableCell>
          <TableCell sx={{ whiteSpace: 'nowrap' }}>
            {Number(i.balanceDue) > 0 && i.status !== 'Cancelled' && <Button size="small" onClick={() => { setPay(i); setAmt(Number(i.balanceDue)); }}>Record payment</Button>}
            {!paid(i) && <Button size="small" color="error" onClick={() => setDel(i)}>Delete</Button>}</TableCell></TableRow>)}
          {!invs.length && <TableRow><TableCell colSpan={10} align="center" sx={{ py: 4, color: 'text.secondary' }}>No invoices found.</TableCell></TableRow>}</TableBody></Table></Paper>}

      {tab === 1 && <>
        {!cid && <Paper sx={{ overflowX: 'auto' }}><Typography sx={{ p: 2 }} fontWeight={600}>Customer-wise summary</Typography><Table size="small">
          <TableHead><TableRow>{['Customer', 'Billed', 'Received', 'Outstanding'].map(x => <TableCell key={x} align={x === 'Customer' ? 'left' : 'right'}>{x}</TableCell>)}</TableRow></TableHead>
          <TableBody>{d?.summary.map(s => <TableRow key={s.customerId} hover sx={{ cursor: 'pointer' }} onClick={() => setCid(s.customerId)}><TableCell>{s.customerName}</TableCell><TableCell align="right">{inr(s.billed)}</TableCell><TableCell align="right">{inr(s.received)}</TableCell><TableCell align="right" sx={{ fontWeight: 700 }}>{inr(s.outstanding)}</TableCell></TableRow>)}</TableBody></Table></Paper>}
        <Paper sx={{ overflowX: 'auto' }}><Typography sx={{ p: 2 }} fontWeight={600}>Ledger entries {cid ? `- outstanding ${inr(t?.outstanding ?? 0)}` : '(running balance is per customer)'}</Typography><Table size="small">
          <TableHead><TableRow>{['Date', ...(cid ? [] : ['Customer']), 'Invoice', 'Ext. doc / reference', 'Type', 'Debit', 'Credit', 'Balance'].map(x => <TableCell key={x}>{x}</TableCell>)}</TableRow></TableHead>
          <TableBody>{ents.map((e, k) => <TableRow key={k}><TableCell>{e.date}</TableCell>{!cid && <TableCell>{e.customerName}</TableCell>}<TableCell>{e.ref}</TableCell><TableCell>{e.extRef}</TableCell><TableCell>{e.type}</TableCell>
            <TableCell align="right">{e.debit ? inr(e.debit) : ''}</TableCell><TableCell align="right">{e.credit ? inr(e.credit) : ''}</TableCell><TableCell align="right">{inr(e.balance)}</TableCell></TableRow>)}</TableBody></Table></Paper></>}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md"><DialogTitle>Raise Invoice</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
          {formErr && <Alert severity="error">{formErr}</Alert>}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField select label="Customer" value={h.customerId} onChange={e => pickCustomer(e.target.value)} sx={{ minWidth: 260, flex: 1 }}>{d?.customers.map(c => <MenuItem key={c.id} value={c.id}>{c.companyName}</MenuItem>)}</TextField>
            <TextField required label="External document no." helperText="Customer PO / reference number" value={h.externalDocNo} onChange={e => setH({ ...h, externalDocNo: e.target.value })} sx={{ minWidth: 220 }} /></Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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

      <Dialog open={!!del} onClose={() => setDel(null)}><DialogTitle>Delete invoice {del?.id}?</DialogTitle>
        <DialogContent><DialogContentText>This permanently removes the invoice{del?.externalDocNo ? ` (ext. doc ${del.externalDocNo})` : ''} and its line items. It can only be done while no payment is recorded.</DialogContentText></DialogContent>
        <DialogActions><Button onClick={() => setDel(null)}>Keep</Button><Button color="error" variant="contained" onClick={remove}>Delete</Button></DialogActions></Dialog>
      <Snackbar open={!!msg} autoHideDuration={4000} onClose={() => setMsg('')} message={msg} />
    </Box>
  );
}
