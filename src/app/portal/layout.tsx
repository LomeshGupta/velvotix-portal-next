'use client';
import { useRouter } from 'next/navigation';
import { AppBar, Box, Button, Container, IconButton, Toolbar, Typography } from '@mui/material';
import Brightness4 from '@mui/icons-material/Brightness4';
import { useToggleMode } from '../providers';
import { InstallButton } from '@/components/PwaRegister';
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const r = useRouter(), toggle = useToggleMode();
  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); r.push('/'); };
  return (<Box sx={{ minHeight: '100vh' }}>
    <AppBar position="sticky" elevation={0} sx={{ background: 'linear-gradient(90deg,#0d47a1,#1565c0 60%,#ef6c00)' }}><Toolbar sx={{ gap: 1 }}>
      <Typography variant="h6" fontWeight={800} sx={{ flexGrow: 1 }}>VELVOTIX <span style={{ fontWeight: 400, opacity: 0.85 }}>Support Portal</span></Typography>
      <InstallButton color="inherit" /><IconButton color="inherit" onClick={toggle} aria-label="toggle theme"><Brightness4 /></IconButton><Button color="inherit" onClick={logout}>Sign out</Button></Toolbar></AppBar>
    <Container maxWidth="lg" sx={{ py: 3 }}>{children}</Container></Box>);
}
