'use client';
import { useEffect, useState } from 'react';
import { Alert, Box, Card, CardContent, Snackbar, TextField, Typography } from '@mui/material';
import { Button } from '@/components/ui';
type Row = Record<string, string>;
// [key, label, multiline?]
const F: [string, string, boolean?][] = [
  ['name', 'Display name'], ['legalName', 'Legal name'], ['cin', 'CIN (Corporate Identification No.)'], ['gstin', 'GSTIN'], ['pan', 'PAN'],
  ['address', 'Address', true], ['city', 'City'], ['state', 'State (used to decide CGST/SGST vs IGST)'], ['country', 'Country'], ['pin', 'PIN code'],
  ['email', 'Email'], ['phone', 'Phone'], ['website', 'Website'], ['supportEmail', 'Support email'], ['logo', 'Logo URL'], ['invoicePrefix', 'Invoice prefix'],
  ['bankName', 'Bank name'], ['accountName', 'Account name'], ['accountNumber', 'Account number'], ['ifsc', 'IFSC'], ['branch', 'Branch'],
  ['terms', 'Invoice terms', true], ['footer', 'Invoice footer', true],
];
export default function Settings() {
  const [v, setV] = useState<Row>({}); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [denied, setDenied] = useState(false);
  useEffect(() => { fetch('/api/company').then(async r => r.ok && setV(await r.json())); fetch('/api/auth/me').then(async r => { if (r.ok && !['SUPER_ADMIN', 'ADMIN'].includes((await r.json()).role)) setDenied(true); }); }, []);
  const save = async () => {
    setErr('');
    if (!(v.cin || '').trim()) return setErr('CIN is required.');
    const body = Object.fromEntries(F.map(([k]) => [k, v[k] ?? '']));
    const r = await fetch('/api/company', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) { setV(await r.json()); setMsg('Company profile saved.'); } else { const j = await r.json().catch(() => ({})); setErr(j.issues?.[0]?.message || j.message || 'Could not save.'); }
  };
  if (denied) return <Box p={3}><Alert severity="warning">Only Admin and Super Admin can edit company settings.</Alert></Box>;
  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto', display: 'grid', gap: 2 }}>
      <Typography variant="h5" fontWeight={700}>Company profile</Typography>
      <Typography variant="body2" color="text.secondary">These details are printed on every invoice as the seller.</Typography>
      <Card><CardContent sx={{ display: 'grid', gap: 2 }}>
        {err && <Alert severity="error">{err}</Alert>}
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          {F.map(([k, l, area]) => <TextField key={k} label={l} multiline={area} minRows={area ? 2 : 1} value={v[k] ?? ''} required={k === 'cin'}
            onChange={e => setV({ ...v, [k]: k === 'cin' ? e.target.value.toUpperCase() : e.target.value })} inputProps={k === 'cin' ? { maxLength: 21 } : undefined}
            helperText={k === 'cin' ? '21 characters, e.g. U74999HR2020PTC000000' : undefined} sx={area ? { gridColumn: '1 / -1' } : undefined} />)}</Box>
        <Box><Button variant="contained" onClick={save}>Save</Button></Box>
      </CardContent></Card>
      <Snackbar open={!!msg} autoHideDuration={4000} onClose={() => setMsg('')} message={msg} />
    </Box>);
}
