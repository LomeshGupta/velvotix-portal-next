'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, Box, Chip, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Button } from '@/components/ui';
import CustomerForm from '@/components/CustomerForm';
import { useRole } from '@/components/RoleContext';
import { RECORD_WRITE } from '@/lib/roles';
type Row = Record<string, string>;
export default function Customers() {
  const router = useRouter(); const role = useRole(); const [rows, setRows] = useState<Row[]>([]); const [q, setQ] = useState(''); const [open, setOpen] = useState(false);
  const load = useCallback(async () => { const r = await fetch(`/api/customers?search=${encodeURIComponent(q)}&pageSize=100`); r.ok ? setRows((await r.json()).rows) : router.push('/admin/login'); }, [q, router]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="h5" fontWeight={700} sx={{ flexGrow: 1 }}>Customers</Typography>
        <TextField size="small" placeholder="Search name, email, GSTIN" value={q} onChange={e => setQ(e.target.value)} />
        {(RECORD_WRITE as readonly string[]).includes(role) && <Button variant="contained" color="secondary" onClick={() => setOpen(true)}>Add customer</Button>}</Box>
      <Paper sx={{ overflowX: 'auto' }}><Table><TableHead><TableRow>{['Customer', 'Contact', 'Phone', 'Location', 'GSTIN', 'Status'].map(h => <TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead>
        <TableBody>{rows.map(r => <TableRow key={r.id} hover sx={{ cursor: 'pointer' }} onClick={() => router.push(`/admin/customers/${r.id}`)}>
          <TableCell><Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}><Avatar sx={{ bgcolor: 'primary.main', width: 34, height: 34 }}>{r.companyName[0]}</Avatar><Box><Typography fontWeight={600}>{r.companyName}</Typography><Typography variant="caption" color="text.secondary">{r.id} - {r.email}</Typography></Box></Box></TableCell>
          <TableCell>{r.contactPerson}</TableCell><TableCell>{r.phone}</TableCell><TableCell>{[r.city, r.state].filter(Boolean).join(', ')}</TableCell><TableCell>{r.gstin}</TableCell>
          <TableCell><Chip size="small" label={r.status} color={r.status === 'Active' ? 'success' : 'default'} /></TableCell></TableRow>)}</TableBody></Table></Paper>
      <CustomerForm open={open} onClose={() => setOpen(false)} onSaved={load} />
    </Box>);
}
