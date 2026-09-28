'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, Card, CardContent, IconButton, Link, TextField, Typography } from '@mui/material';
import Brightness4 from '@mui/icons-material/Brightness4';
import { useToggleMode } from './providers';
export default function LoginForm({ portal }: { portal: 'admin' | 'customer' }) {
  const r = useRouter(); const toggle = useToggleMode();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [err, setErr] = useState('');
  const submit = async () => {
    setErr('');
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, portal }) });
    res.ok ? r.push(portal === 'admin' ? '/admin/dashboard' : '/portal/tickets') : setErr((await res.json()).message || 'Unable to sign in.');
  };
  const other = portal === 'admin' ? ['/', 'Customer login'] : ['/admin/login', 'Velvotix staff login'];
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Card sx={{ width: 380 }}><CardContent sx={{ display: 'grid', gap: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="h5" color="primary" fontWeight={700}>Velvotix <span style={{ color: '#ef6c00' }}>{portal === 'admin' ? 'Admin' : 'Support'}</span></Typography>
          <IconButton onClick={toggle} aria-label="toggle theme"><Brightness4 /></IconButton>
        </Box>
        {err && <Alert severity="error">{err}</Alert>}
        <TextField label="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <TextField label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
        <Button variant="contained" onClick={submit}>Sign in</Button>
        <Link href={other[0]} underline="hover" variant="body2">{other[1]}</Link>
      </CardContent></Card>
    </Box>
  );
}
