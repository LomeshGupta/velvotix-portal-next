'use client';
import { useEffect, useState } from 'react';
import { Alert, Box, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { Button } from '@/components/ui';
type Row = Record<string, string>;
const F: [string, string, string?][] = [['companyName', 'Company name'], ['type', 'Customer type', 'sel'], ['contactPerson', 'Contact person'], ['email', 'Email'], ['phone', 'Phone'], ['altPhone', 'Alternate phone'], ['gstin', 'GSTIN'], ['pan', 'PAN'], ['cin', 'CIN (Corporate Identification No.)'],
  ['billingAddress', 'Billing address', 'area'], ['shippingAddress', 'Shipping address', 'area'], ['city', 'City'], ['state', 'State'], ['country', 'Country'], ['pin', 'PIN code'], ['status', 'Status', 'sel'], ['notes', 'Notes', 'area']];
export default function CustomerForm({ open, initial, onClose, onSaved }: { open: boolean; initial?: Row | null; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState<Row>({}); const [err, setErr] = useState('');
  useEffect(() => { if (open) { setV({ type: 'B2B', status: 'Active', ...(initial || {}) }); setErr(''); } }, [open, initial]);
  const save = async () => {
    const body = Object.fromEntries(F.map(([k]) => [k, v[k] ?? '']));
    const r = await fetch(initial?.id ? `/api/customers/${initial.id}` : '/api/customers', { method: initial?.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) { onSaved(); onClose(); return; }
    const j = await r.json().catch(() => ({}));
    setErr(j.issues?.[0]?.message || j.message || 'Customer could not be saved. Check company name and a valid email.');
  };
  const opts = (k: string) => (k === 'type' ? ['B2B', 'B2C'] : ['Active', 'Inactive']);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md"><DialogTitle>{initial?.id ? 'Edit customer' : 'New customer'}</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>{err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          {F.map(([k, l, t]) => t === 'sel' ? <TextField key={k} select label={l} value={v[k] || ''} onChange={e => setV({ ...v, [k]: e.target.value })}>{opts(k).map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}</TextField>
            : <TextField key={k} label={l} multiline={t === 'area'} minRows={t === 'area' ? 2 : 1} value={v[k] || ''} onChange={e => setV({ ...v, [k]: k === 'cin' ? e.target.value.toUpperCase() : e.target.value })} sx={t === 'area' && k === 'notes' ? { gridColumn: '1 / -1' } : undefined}
              required={k === 'cin' && v.type !== 'B2C'} inputProps={k === 'cin' ? { maxLength: 21 } : undefined}
              helperText={k === 'cin' ? (v.type === 'B2C' ? 'Optional for B2C' : '21 characters, required for B2B') : undefined} />)}
        </Box>
        <Button size="small" sx={{ mt: 1 }} onClick={() => setV({ ...v, shippingAddress: v.billingAddress || '' })}>Copy billing to shipping</Button></DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={save}>Save customer</Button></DialogActions></Dialog>);
}
