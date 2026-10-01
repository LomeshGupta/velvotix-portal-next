'use client';
import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
type Row = Record<string, string>;
const color = (s: string) => (s === 'Active' ? 'success' : s === 'Expiring' ? 'warning' : s === 'Cancelled' || s === 'Expired' ? 'error' : 'default');
const rank = (s: string) => (s === 'Active' ? 0 : s === 'Expiring' ? 1 : 2);
/** Read-only contract + coverage summary for a customer (industry, period, covered products, hours, SLA, priority). No management controls. */
export default function ContractInfo({ customerId, title = 'Contract & coverage' }: { customerId: string; title?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/contracts?customerId=${encodeURIComponent(customerId)}`).then(async r => { if (live) setRows(r.ok ? (await r.json()).rows : []); }).catch(() => live && setRows([]));
    return () => { live = false; };
  }, [customerId]);
  const list = [...(rows || [])].sort((a, b) => rank(a.status) - rank(b.status) || (b.endDate || '').localeCompare(a.endDate || ''));
  return (
    <Card><CardContent sx={{ display: 'grid', gap: 1.5 }}>
      <Typography fontWeight={700}>{title}</Typography>
      {rows === null && <Typography variant="body2" color="text.secondary">Loading...</Typography>}
      {rows !== null && !list.length && <Typography variant="body2" color="text.secondary">No support contract on record.</Typography>}
      {list.map(c => <Box key={c.id} sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover', display: 'grid', gap: 0.75 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
          <Typography fontWeight={700}>{c.contractNumber} <Typography component="span" variant="body2" color="text.secondary">{c.type}</Typography></Typography>
          <Chip size="small" label={c.status} color={color(c.status)} /></Box>
        <Box sx={{ display: 'grid', gap: 0.5, gridTemplateColumns: '1fr 1fr' }}>
          {([['Industry', c.industry], ['Period', `${c.startDate} to ${c.endDate}`], ['Contract hours', c.supportHours], ['SLA', c.sla], ['Priority support', c.prioritySupport === 'true' ? 'Yes' : 'No']] as [string, string][]).map(([k, v]) =>
            <Box key={k}><Typography variant="caption" color="text.secondary">{k}</Typography><Typography variant="body2">{v || '-'}</Typography></Box>)}</Box>
        <Box><Typography variant="caption" color="text.secondary">Covered products / services</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.25 }}>
            {(c.productNames || '').split('|').filter(Boolean).map(n => <Chip key={n} size="small" variant="outlined" label={n} />)}
            {!c.productNames && <Typography variant="body2">-</Typography>}</Box></Box>
      </Box>)}
    </CardContent></Card>);
}
