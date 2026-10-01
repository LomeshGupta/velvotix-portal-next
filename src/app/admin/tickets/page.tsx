'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Snackbar, Table, TableBody, TableCell, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import ViewKanban from '@mui/icons-material/ViewKanban';
import ViewList from '@mui/icons-material/ViewList';
import { Button } from '@/components/ui';
type T = { id: string; customerId: string; subject: string; priority: string; status: string; assignedTo: string };
const STATUS = ['Open', 'Assigned', 'In Progress', 'Waiting for Customer', 'Resolved', 'Closed'];
const PRI: Record<string, string> = { Critical: 'error.main', High: 'warning.main', Medium: 'info.main', Low: 'grey.500' };
export default function Board() {
  const router = useRouter();
  const [rows, setRows] = useState<T[]>([]); const [custs, setCusts] = useState<{ id: string; companyName: string }[]>([]); const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [cid, setCid] = useState(''); const [q, setQ] = useState(''); const [msg, setMsg] = useState(''); const [drag, setDrag] = useState('');
  const [view, setView] = useState<'board' | 'list'>('board');
  useEffect(() => {
    fetch('/api/customers?pageSize=100').then(async r => (r.ok ? setCusts((await r.json()).rows) : router.push('/admin/login')));
    fetch('/api/users').then(async r => r.ok && setUsers(await r.json()));
  }, [router]);
  const load = useCallback(async () => { const r = await fetch(`/api/tickets?customerId=${cid}`); r.ok ? setRows((await r.json()).rows) : setMsg('Unable to load tickets.'); }, [cid]);
  useEffect(() => { load(); }, [load]);
  const move = async (id: string, status: string) => {
    setRows(rs => rs.map(r => (r.id === id ? { ...r, status } : r))); // optimistic
    const r = await fetch(`/api/tickets/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (!r.ok) { setMsg('Status could not be updated.'); load(); }
  };
  const [nt, setNt] = useState(false); const [f, setF] = useState({ customerId: '', subject: '', description: '', category: 'General', priority: 'Medium' });
  const create = async () => { const r = await fetch('/api/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }); if (r.ok) { setNt(false); setF({ ...f, subject: '', description: '' }); load(); } else setMsg('Ticket could not be created.'); };
  const cname = (id: string) => custs.find(c => c.id === id)?.companyName || id;
  const shown = rows.filter(r => `${r.id} ${r.subject}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="h5" fontWeight={700} sx={{ flexGrow: 1 }}>Ticket board</Typography>
        <TextField size="small" placeholder="Search tickets" value={q} onChange={e => setQ(e.target.value)} />
        <TextField select size="small" label="Customer" value={cid} onChange={e => setCid(e.target.value)} sx={{ minWidth: 240 }}><MenuItem value="">All customers</MenuItem>{custs.map(c => <MenuItem key={c.id} value={c.id}>{c.companyName}</MenuItem>)}</TextField>
        <ToggleButtonGroup size="small" value={view} exclusive onChange={(_, v) => v && setView(v)}>
          <ToggleButton value="board" aria-label="board view"><ViewKanban fontSize="small" /></ToggleButton>
          <ToggleButton value="list" aria-label="list view"><ViewList fontSize="small" /></ToggleButton>
        </ToggleButtonGroup>
        <Button variant="contained" color="secondary" onClick={() => setNt(true)}>New ticket</Button>
      </Box>
      {view === 'list' && <Paper sx={{ overflowX: 'auto' }}><Table size="small">
        <TableHead><TableRow>{['Ticket', 'Subject', 'Customer', 'Priority', 'Status', 'Assignee'].map(h => <TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead>
        <TableBody>{shown.map(r => <TableRow key={r.id} hover sx={{ cursor: 'pointer' }} onClick={() => router.push(`/admin/tickets/${r.id}`)}>
          <TableCell>{r.id}</TableCell><TableCell>{r.subject}</TableCell><TableCell>{cname(r.customerId)}</TableCell>
          <TableCell><Chip size="small" label={r.priority} /></TableCell><TableCell>{r.status}</TableCell>
          <TableCell>{users.find(u => u.id === r.assignedTo)?.name || 'Unassigned'}</TableCell></TableRow>)}
          {!shown.length && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No tickets found.</TableCell></TableRow>}</TableBody></Table></Paper>}
      {view === 'board' && <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2, alignItems: 'flex-start' }}>
        {STATUS.map(s => (
          <Paper key={s} variant="outlined" onDragOver={e => e.preventDefault()} onDrop={() => drag && move(drag, s)} sx={{ minWidth: 260, width: 260, p: 1.5, bgcolor: 'action.hover', minHeight: 300 }}>
            <Typography variant="overline" fontWeight={700}>{s} ({shown.filter(r => r.status === s).length})</Typography>
            <Box sx={{ display: 'grid', gap: 1, mt: 1 }}>
              {shown.filter(r => r.status === s).map(r => (
                <Paper key={r.id} draggable onDragStart={() => setDrag(r.id)} onClick={() => router.push(`/admin/tickets/${r.id}`)} sx={{ p: 1.5, cursor: 'pointer', borderLeft: 4, borderColor: PRI[r.priority] || 'grey.500', '&:hover': { boxShadow: 4 } }}>
                  <Typography variant="caption" color="text.secondary">{r.id}</Typography>
                  <Typography variant="body2" fontWeight={600}>{r.subject}</Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, alignItems: 'center' }}>
                    <Chip size="small" label={r.priority} /><Typography variant="caption" noWrap sx={{ maxWidth: 110 }}>{users.find(u => u.id === r.assignedTo)?.name || 'Unassigned'}</Typography></Box>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">{cname(r.customerId)}</Typography>
                </Paper>))}
            </Box>
          </Paper>))}
      </Box>}
      <Dialog open={nt} onClose={() => setNt(false)} fullWidth maxWidth="sm"><DialogTitle>New ticket on behalf of customer</DialogTitle><DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        <TextField select label="Customer" value={f.customerId} onChange={e => setF({ ...f, customerId: e.target.value })}>{custs.map(c => <MenuItem key={c.id} value={c.id}>{c.companyName}</MenuItem>)}</TextField>
        <TextField label="Subject" value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} /><TextField label="Description" multiline minRows={3} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
        <TextField select label="Category" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>{['Technical Support', 'Business Central', 'ERP', 'Application', 'Integration', 'Billing', 'General', 'Other'].map(x => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField>
        <TextField select label="Priority" value={f.priority} onChange={e => setF({ ...f, priority: e.target.value })}>{['Low', 'Medium', 'High', 'Critical'].map(x => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField></DialogContent>
        <DialogActions><Button onClick={() => setNt(false)}>Cancel</Button><Button variant="contained" disabled={!f.customerId || !f.subject || !f.description} onClick={create}>Create</Button></DialogActions></Dialog>
      <Snackbar open={!!msg} autoHideDuration={4000} onClose={() => setMsg('')} message={msg} />
    </Box>);
}
