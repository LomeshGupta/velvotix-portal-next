'use client';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Card, CardContent, Chip, LinearProgress, TextField, Typography } from '@mui/material';
import { Button } from '@/components/ui';
type Row = Record<string, string>;
const json = (m: string, b: unknown) => ({ method: m, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
export default function HoursPanel({ ticket }: { ticket: Row }) {
  const [me, setMe] = useState<{ id: string; role: string } | null>(null); const [reqs, setReqs] = useState<Row[]>([]); const [sm, setSm] = useState<{ added: number; used: number; remaining: number; validTill: string; expired: boolean } | null>(null);
  const [hours, setHours] = useState(''); const [reason, setReason] = useState(''); const [err, setErr] = useState('');
  // ONE request: the requests list, the customer's hour balance and the current user all come back together.
  const load = useCallback(async () => {
    const r = await fetch(`/api/hour-requests?ticketId=${ticket.id}`);
    if (!r.ok) return;
    const j = await r.json(); setMe(j.me); setReqs(j.rows); if (j.summary) setSm(j.summary);
  }, [ticket.id]);
  useEffect(() => { load(); }, [load]);
  const decide = async (id: string, decision: string) => { const r = await fetch(`/api/hour-requests/${id}`, json('PUT', { decision })); if (r.ok) { setErr(''); load(); } else setErr((await r.json()).message); };
  const raise = async () => { const r = await fetch('/api/hour-requests', json('POST', { ticketId: ticket.id, hours: Number(hours), reason })); if (r.ok) { setHours(''); setReason(''); setErr(''); load(); } else setErr((await r.json()).message || 'Request failed.'); };
  const isAdmin = me && ['SUPER_ADMIN', 'ADMIN'].includes(me.role), canDecide = me && (isAdmin || me.role === 'CUSTOMER');
  const canRaise = me && me.role !== 'CUSTOMER' && (ticket.assignedTo === me.id || isAdmin);
  const pct = sm && sm.added ? Math.min(100, (sm.used / sm.added) * 100) : 0;
  return (
    <Card><CardContent sx={{ display: 'grid', gap: 1.5 }}>
      <Typography fontWeight={700}>Support hours</Typography>
      {sm && <Box><Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="h5" fontWeight={800} color={sm.remaining < 5 ? 'error' : 'primary'}>{sm.remaining} h left</Typography>
        <Chip size="small" color={sm.expired ? 'error' : 'default'} label={sm.expired ? 'Expired' : sm.validTill ? `Valid till ${sm.validTill}` : 'No hours'} /></Box>
        <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4, mt: 1 }} />
        <Typography variant="caption" color="text.secondary">{sm.used} of {sm.added} h used</Typography></Box>}
      {err && <Alert severity="error" onClose={() => setErr('')}>{err}</Alert>}
      {reqs.map(r => <Box key={r.id} sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography fontWeight={700}>{r.hours} h</Typography>
          <Chip size="small" label={r.status} color={r.status === 'Approved' ? 'success' : r.status === 'Rejected' ? 'error' : 'warning'} /></Box>
        <Typography variant="body2">{r.reason}</Typography><Typography variant="caption" color="text.secondary">by {r.requestedByName}</Typography>
        {r.status === 'Pending' && canDecide && <Box sx={{ mt: 1, display: 'flex', gap: 1 }}><Button size="small" variant="contained" onClick={() => decide(r.id, 'Approved')}>Approve</Button><Button size="small" color="error" onClick={() => decide(r.id, 'Rejected')}>Reject</Button></Box>}
      </Box>)}
      {canRaise && <Box sx={{ display: 'grid', gap: 1 }}><Typography variant="body2" fontWeight={600}>Request hours</Typography>
        <TextField size="small" type="number" label="Hours" value={hours} onChange={e => setHours(e.target.value)} />
        <TextField size="small" label="Reason" value={reason} onChange={e => setReason(e.target.value)} />
        <Button variant="outlined" disabled={!hours || reason.length < 3} onClick={raise}>Send for approval</Button></Box>}
    </CardContent></Card>);
}
