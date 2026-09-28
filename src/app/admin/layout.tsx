'use client';
import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppBar, Box, Drawer, GlobalStyles, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography, useMediaQuery, useTheme } from '@mui/material';
import Menu from '@mui/icons-material/Menu';
import Dashboard from '@mui/icons-material/Dashboard';
import Confirmation from '@mui/icons-material/ConfirmationNumber';
import Receipt from '@mui/icons-material/Receipt';
import People from '@mui/icons-material/People';
import Brightness4 from '@mui/icons-material/Brightness4';
import Logout from '@mui/icons-material/Logout';
import { useToggleMode } from '../providers';
const NAV = [['/admin/dashboard', 'Dashboard', <Dashboard key="d" />], ['/admin/tickets', 'Tickets', <Confirmation key="t" />], ['/admin/invoices', 'Invoices & Ledger', <Receipt key="i" />], ['/admin/customers', 'Customers', <People key="c" />]] as const;
const W = 236;
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname(), r = useRouter(), toggle = useToggleMode(), theme = useTheme(), desk = useMediaQuery(theme.breakpoints.up('md'));
  const [open, setOpen] = useState(false);
  if (path === '/admin/login') return <>{children}</>;
  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); r.push('/admin/login'); };
  const nav = (
    <Box sx={{ width: W }}>
      <Toolbar><Typography variant="h6" color="primary" fontWeight={800}>Velvotix <span style={{ color: '#ef6c00' }}>Admin</span></Typography></Toolbar>
      <List>{NAV.map(([href, label, icon]) => <ListItemButton key={href} component={Link} href={href} selected={path.startsWith(href)} onClick={() => setOpen(false)} sx={{ mx: 1, borderRadius: 2 }}>
        <ListItemIcon>{icon}</ListItemIcon><ListItemText primary={label} /></ListItemButton>)}</List>
    </Box>);
  return (
    <Box sx={{ display: 'flex' }}>
      <GlobalStyles styles={{ '@media print': { '.no-print': { display: 'none !important' }, main: { margin: '0 !important', padding: '0 !important' } } }} />
      <AppBar className="no-print" position="fixed" color="inherit" elevation={0} sx={{ ml: { md: `${W}px` }, width: { md: `calc(100% - ${W}px)` }, borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>{!desk && <IconButton onClick={() => setOpen(true)} aria-label="menu"><Menu /></IconButton>}<Box sx={{ flexGrow: 1 }} />
          <IconButton onClick={toggle} aria-label="toggle theme"><Brightness4 /></IconButton><IconButton onClick={logout} aria-label="logout"><Logout /></IconButton></Toolbar>
      </AppBar>
      <Drawer className="no-print" variant={desk ? 'permanent' : 'temporary'} open={desk || open} onClose={() => setOpen(false)} sx={{ '& .MuiDrawer-paper': { width: W } }}>{nav}</Drawer>
      <Box component="main" sx={{ flexGrow: 1, ml: { md: `${W}px` }, mt: 8, minWidth: 0 }}>{children}</Box>
    </Box>);
}
