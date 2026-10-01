'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Avatar, Badge, Box, Divider, IconButton, List, ListItemAvatar, ListItemButton, ListItemText, Popover, Snackbar, Tooltip, Typography } from '@mui/material';
import Notifications from '@mui/icons-material/Notifications';
import NotificationsNone from '@mui/icons-material/NotificationsNone';
import NotificationsActive from '@mui/icons-material/NotificationsActive';
import ConfirmationNumber from '@mui/icons-material/ConfirmationNumber';
import Schedule from '@mui/icons-material/Schedule';
import Receipt from '@mui/icons-material/Receipt';
import Payments from '@mui/icons-material/Payments';
import Description from '@mui/icons-material/Description';
import { Button } from './ui';

type N = { id: string; type: string; title: string; body: string; link: string; at: string; read: boolean };
const BG = { 'x-bg': '1' }; // background polling does not flash the global progress bar
const POLL_MS = 30_000;

const style = (t: string): { icon: React.ReactNode; color: string } => {
  if (t.startsWith('TICKET')) return { icon: <ConfirmationNumber fontSize="small" />, color: '#1565c0' };
  if (t.startsWith('HOURS')) return { icon: <Schedule fontSize="small" />, color: '#ef6c00' };
  if (t.startsWith('PAYMENT')) return { icon: <Payments fontSize="small" />, color: '#2e7d32' };
  if (t.startsWith('CONTRACT')) return { icon: <Description fontSize="small" />, color: '#6a1b9a' };
  return { icon: <Receipt fontSize="small" />, color: '#00838f' };
};
export const ago = (iso: string) => {
  const s = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)} min ago`; if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};
const b64 = (s: string) => { const p = '='.repeat((4 - (s.length % 4)) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };

/** Call before signing out so this browser stops receiving the previous user's push notifications. */
export async function detachPush() {
  try {
    if (!('serviceWorker' in navigator)) return;
    const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
    if (sub) { await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }); }
  } catch { /* logging out must never fail because of this */ }
}

export default function NotificationBell({ color }: { color?: 'inherit' }) {
  const router = useRouter();
  const [items, setItems] = useState<N[]>([]); const [unread, setUnread] = useState(0); const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [toast, setToast] = useState<N | null>(null); const [push, setPush] = useState<'unsupported' | 'off' | 'on' | 'denied'>('unsupported'); const [serverPush, setServerPush] = useState<{ enabled: boolean; publicKey: string }>({ enabled: false, publicKey: '' });
  const ver = useRef<number | undefined>(undefined); const last = useRef(0); const first = useRef(true); const stopped = useRef(false);

  const apply = useCallback((j: { v: number; changed?: boolean; unread?: number; items?: N[] }) => {
    ver.current = j.v; if (j.changed === false || !j.items) return;
    const newest = j.items.find(i => !i.read);
    if (!first.current && (j.unread ?? 0) > last.current && newest) setToast(newest); // announce only genuinely new arrivals
    first.current = false; last.current = j.unread ?? 0; setItems(j.items); setUnread(j.unread ?? 0);
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    try { (j.unread ? nav.setAppBadge?.(j.unread) : nav.clearAppBadge?.())?.catch(() => {}); } catch { /* not supported */ }
    document.title = `${j.unread ? `(${j.unread}) ` : ''}${document.title.replace(/^\(\d+\)\s*/, '')}`;
  }, []);
  const load = useCallback(async () => {
    if (stopped.current) return;
    try {
      const r = await fetch(`/api/notifications${ver.current !== undefined ? `?v=${ver.current}` : ''}`, { headers: BG, cache: 'no-store' });
      if (r.status === 401) { stopped.current = true; return; }
      if (r.ok) apply(await r.json());
    } catch { /* offline: try again next tick */ }
  }, [apply]);

  useEffect(() => { // polling: only while the tab is visible, plus instant refresh on focus / reconnect / push arrival
    load();
    const t = setInterval(() => document.visibilityState === 'visible' && load(), POLL_MS);
    const vis = () => document.visibilityState === 'visible' && load();
    const msg = (e: MessageEvent) => e.data?.type === 'notif' && load();
    document.addEventListener('visibilitychange', vis); window.addEventListener('online', load); navigator.serviceWorker?.addEventListener('message', msg);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); window.removeEventListener('online', load); navigator.serviceWorker?.removeEventListener('message', msg); };
  }, [load]);

  useEffect(() => { // push status; silently re-registers this device once per session so the server never loses it
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
      const reg = await navigator.serviceWorker.getRegistration(); if (!reg) return;
      const r = await fetch('/api/push', { headers: BG }); if (!r.ok) return;
      const cfg = await r.json(); setServerPush(cfg); if (!cfg.enabled) return;
      if (Notification.permission === 'denied') return setPush('denied');
      if (Notification.permission !== 'granted') return setPush('off');
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(cfg.publicKey) });
      if (!sessionStorage.getItem('pushSynced')) { await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json', ...BG }, body: JSON.stringify(sub) }); sessionStorage.setItem('pushSynced', '1'); }
      setPush('on');
    })().catch(() => {});
  }, []);
  const enablePush = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      if ((await Notification.requestPermission()) !== 'granted') return setPush(Notification.permission === 'denied' ? 'denied' : 'off');
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(serverPush.publicKey) });
      const r = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub) });
      if (r.ok) { sessionStorage.setItem('pushSynced', '1'); setPush('on'); }
    } catch { setPush('off'); }
  };

  const post = async (body: object) => { const r = await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (r.ok) apply(await r.json()); };
  const open = async (n: N) => { setAnchor(null); if (!n.read) post({ action: 'read', ids: [n.id] }); if (n.link) router.push(n.link); };
  const canPush = serverPush.enabled && push !== 'unsupported';

  // Proactive, always-visible nudge (not just inside the dropdown): shown once per browser session until the user enables push or dismisses it, so it is not missed.
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  useEffect(() => { if (sessionStorage.getItem('pushNudgeDismissed')) setNudgeDismissed(true); }, []);
  const dismissNudge = () => { sessionStorage.setItem('pushNudgeDismissed', '1'); setNudgeDismissed(true); };
  const showNudge = canPush && !nudgeDismissed && (push === 'off' || push === 'denied');

  return (<>
    {showNudge && (
      <Box sx={{ position: 'fixed', top: { xs: 'env(safe-area-inset-top, 0px)', sm: 8 }, left: 0, right: 0, zIndex: 1301, display: 'flex', justifyContent: 'center', px: 1, pointerEvents: 'none' }}>
        <Alert severity={push === 'denied' ? 'warning' : 'info'} icon={<NotificationsActive fontSize="small" />} onClose={dismissNudge}
          sx={{ mt: 1, maxWidth: 480, width: '100%', boxShadow: 4, pointerEvents: 'auto' }}
          action={push === 'off' ? <Button size="small" onClick={async () => { await enablePush(); dismissNudge(); }}>Turn on</Button> : undefined}>
          {push === 'denied'
            ? 'Notifications are blocked for this site. Turn them back on from your browser\'s site settings to get ticket and invoice alerts.'
            : 'Turn on notifications so you never miss a ticket reply, invoice, or approval request.'}
        </Alert>
      </Box>
    )}
    <Tooltip title="Notifications">
      <IconButton color={color} onClick={e => setAnchor(e.currentTarget)} aria-label={`notifications, ${unread} unread`}>
        <Badge badgeContent={unread} color="error" max={99} sx={unread ? { '& .MuiBadge-badge': { animation: 'vxpop .4s ease' }, '@keyframes vxpop': { '0%': { transform: 'scale(.4) translate(50%,-50%)' }, '70%': { transform: 'scale(1.25) translate(50%,-50%)' } } } : undefined}>
          {unread ? <NotificationsActive /> : <NotificationsNone />}</Badge>
      </IconButton>
    </Tooltip>
    <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { width: { xs: 'calc(100vw - 16px)', sm: 400 }, maxHeight: '70vh', display: 'flex', flexDirection: 'column', borderRadius: 3, overflow: 'hidden' } } }}>
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', background: 'linear-gradient(90deg,#0d47a1,#1565c0)', color: '#fff' }}>
        <Notifications fontSize="small" /><Typography fontWeight={700} sx={{ ml: 1, flexGrow: 1 }}>Notifications{unread ? ` (${unread})` : ''}</Typography>
        <Button size="small" color="inherit" disabled={!unread} onClick={() => post({ action: 'readAll' })}>Mark all read</Button>
      </Box>
      {canPush && push !== 'on' && <Alert severity="info" icon={<NotificationsActive fontSize="small" />} sx={{ borderRadius: 0 }}
        action={push === 'off' ? <Button size="small" onClick={enablePush}>Enable</Button> : undefined}>
        {push === 'denied' ? 'Alerts are blocked in your browser settings for this site.' : 'Get alerts even when the app is closed.'}</Alert>}
      <List disablePadding sx={{ overflowY: 'auto' }}>
        {items.length === 0 && <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}><NotificationsNone sx={{ fontSize: 44, opacity: 0.4 }} /><Typography>You are all caught up</Typography></Box>}
        {items.map((n, i) => { const s = style(n.type); return (<Box key={n.id}>
          {i > 0 && <Divider component="li" />}
          <ListItemButton onClick={() => open(n)} sx={{ alignItems: 'flex-start', bgcolor: n.read ? 'transparent' : 'action.hover', py: 1.25 }}>
            <ListItemAvatar sx={{ minWidth: 48 }}><Avatar sx={{ bgcolor: s.color, width: 34, height: 34 }}>{s.icon}</Avatar></ListItemAvatar>
            <ListItemText primary={n.title} secondary={<>{n.body && <Box component="span" sx={{ display: 'block' }}>{n.body}</Box>}<Box component="span" sx={{ fontSize: 12, opacity: 0.75 }}>{ago(n.at)}</Box></>}
              primaryTypographyProps={{ fontWeight: n.read ? 500 : 700, fontSize: 14 }} secondaryTypographyProps={{ component: 'span', fontSize: 13 }} />
            {!n.read && <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: 'primary.main', mt: 1, ml: 1, flexShrink: 0 }} />}
          </ListItemButton></Box>); })}
      </List>
    </Popover>
    <Snackbar open={!!toast} autoHideDuration={6000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} sx={{ top: { xs: 'calc(env(safe-area-inset-top, 0px) + 8px) !important' } }}>
      <Alert severity="info" variant="filled" icon={<NotificationsActive fontSize="small" />} onClick={() => { if (toast) open(toast); setToast(null); }} sx={{ cursor: 'pointer', width: '100%' }}>
        <b>{toast?.title}</b>{toast?.body ? ` - ${toast.body}` : ''}</Alert>
    </Snackbar>
  </>);
}
