'use client';
import { useCallback, useEffect, useState } from 'react';
import HoursPanel from './HoursPanel';
import { Alert, Box, Button, Card, CardContent, Chip, FormControlLabel, MenuItem, Switch, TextField, Typography } from '@mui/material';
type Row = Record<string, string>;
const STATUS = ['Open', 'Assigned', 'In Progress', 'Waiting for Customer', 'Resolved', 'Closed'];
const json = (m: string, b: unknown) => ({ method: m, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
export default function TicketDetail({ id, staff }: { id: string; staff: boolean }) {
  const [d, setD] = useState<{ ticket: Row; messages: Row[]; activities: Row[] } | null>(null);
  const [users, setUsers] = useState<Row[]>([]); const [text, setText] = useState(''); const [internal, setInternal] = useState(false); const [err, setErr] = useState('');
  const load = useCallback(async () => { const r = await fetch(`/api/tickets/${id}`); r.ok ? setD(await r.json()) : setErr('Unable to load ticket.'); }, [id]);
  useEffect(() => { load(); if (staff) fetch('/api/users').then(async r => r.ok && setUsers(await r.json())); }, [load, staff]);
  const send = async () => { if (!text.trim()) return; const r = await fetch(`/api/tickets/${id}/messages`, json('POST', { message: text, isInternal: internal })); if (r.ok) { setText(''); load(); } else setErr('Message could not be sent.'); };
  const upd = async (p: object) => { const r = await fetch(`/api/tickets/${id}`, json('PUT', p)); r.ok ? load() : setErr('Ticket could not be updated.'); };
  if (!d) return <Box p={3}>{err || 'Loading...'}</Box>;
  const t = d.ticket;
  return (
    <Box sx={{ p: 3, display: 'grid', gap: 2 }}>
      {err && <Alert severity="error" onClose={() => setErr('')}>{err}</Alert>}
      <Box><Typography variant="overline" color="text.secondary">{t.id}</Typography><Typography variant="h5" fontWeight={700}>{t.subject}</Typography></Box>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, alignItems: 'start' }}>
        <Card><CardContent sx={{ display: 'grid', gap: 2 }}>
          <Typography color="text.secondary">{t.description}</Typography>
          <Box sx={{ display: 'grid', gap: 1.5, maxHeight: 460, overflowY: 'auto' }}>
            {d.messages.map(m => { const mine = staff ? m.senderType === 'STAFF' : m.senderType === 'CUSTOMER'; return (
              <Box key={m.id} sx={{ justifySelf: mine ? 'end' : 'start', maxWidth: '80%', p: 1.5, borderRadius: 2, bgcolor: m.isInternal === 'true' ? 'warning.light' : mine ? 'primary.main' : 'action.hover', color: m.isInternal === 'true' ? 'warning.contrastText' : mine ? 'primary.contrastText' : 'text.primary' }}>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>{m.isInternal === 'true' ? 'Internal note' : m.senderType} - {m.createdAt.slice(0, 16).replace('T', ' ')}</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{m.message}</Typography></Box>); })}
          </Box>
          <TextField multiline minRows={2} placeholder={internal ? 'Add an internal note (hidden from customer)' : 'Write a reply'} value={text} onChange={e => setText(e.target.value)} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {staff ? <FormControlLabel control={<Switch checked={internal} onChange={e => setInternal(e.target.checked)} />} label="Internal note" /> : <span />}
            <Button variant="contained" onClick={send}>{internal ? 'Add note' : 'Send'}</Button></Box>
        </CardContent></Card>
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Card><CardContent sx={{ display: 'grid', gap: 2 }}>
            {staff ? <>
              <TextField select size="small" label="Status" value={t.status} onChange={e => upd({ status: e.target.value })}>{STATUS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField>
              <TextField select size="small" label="Priority" value={t.priority} onChange={e => upd({ priority: e.target.value })}>{['Low', 'Medium', 'High', 'Critical'].map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField>
              <TextField select size="small" label="Assignee" value={t.assignedTo} onChange={e => upd({ assignedTo: e.target.value })}><MenuItem value="">Unassigned</MenuItem>{users.map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}</TextField>
            </> : <><Chip label={t.status} color="primary" /><Typography variant="body2">Priority: {t.priority}</Typography></>}
            <Typography variant="body2" color="text.secondary">{t.category} - created {t.createdAt.slice(0, 10)}</Typography>
          </CardContent></Card>
          <HoursPanel ticket={t} />
          <Card><CardContent><Typography fontWeight={600} mb={1}>Activity</Typography>
            {d.activities.map(a => <Box key={a.id} sx={{ borderLeft: 2, borderColor: 'primary.main', pl: 1.5, pb: 1.5 }}><Typography variant="body2" fontWeight={600}>{a.type}</Typography>
              <Typography variant="caption" color="text.secondary">{a.detail} {a.createdAt.slice(0, 16).replace('T', ' ')}</Typography></Box>)}</CardContent></Card>
        </Box>
      </Box>
    </Box>);
}
