'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Box, Card, CardContent, IconButton, Link, TextField, Typography } from '@mui/material';
import { Button } from '@/components/ui';
import Brightness4 from '@mui/icons-material/Brightness4';
import { useToggleMode } from './providers';
import { InstallButton } from '@/components/PwaRegister';
export default function LoginForm({ portal }: { portal: 'admin' | 'customer' }) {
  const r = useRouter(); const toggle = useToggleMode();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  // Installed app / returning user with a live session goes straight in.
  useEffect(() => { fetch('/api/auth/me').then(async res => { if (!res.ok) return; const u = await res.json(); r.replace(u.role === 'CUSTOMER' ? '/portal/tickets' : '/admin/dashboard'); }).catch(() => {}); }, [r]);
  const submit = async () => {
    if (busy) return;
    setErr(''); setBusy(true);
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, portal }) });
    if (res.ok) { r.push(portal === 'admin' ? '/admin/dashboard' : '/portal/tickets'); return; } // stay in the loading state while the next page opens
    setErr((await res.json().catch(() => ({}))).message || 'Unable to sign in.'); setBusy(false);
  };
  const other = portal === 'admin' ? ['/', 'Customer login'] : ['/admin/login', 'Velvotix staff login'];
  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 380 }}><CardContent sx={{ display: 'grid', gap: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="h5" color="primary" fontWeight={700}>Velvotix <span style={{ color: '#ef6c00' }}>{portal === 'admin' ? 'Admin' : 'Support'}</span></Typography>
          <Box><InstallButton /><IconButton onClick={toggle} aria-label="toggle theme"><Brightness4 /></IconButton></Box>
        </Box>
        {err && <Alert severity="error">{err}</Alert>}
        <TextField label="Email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} />
        <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
        <Button variant="contained" size="large" loading={busy} onClick={submit}>{busy ? 'Signing in...' : 'Sign in'}</Button>
        <Link href={other[0]} underline="hover" variant="body2">{other[1]}</Link>
      </CardContent></Card>
    </Box>
  );
}
