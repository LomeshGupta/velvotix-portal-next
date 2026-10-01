'use client';
import { useEffect, useState } from 'react';
import { Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Tooltip, Typography } from '@mui/material';
import { Button } from '@/components/ui';
import InstallMobile from '@mui/icons-material/InstallMobile';

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
// The browser fires beforeinstallprompt once; keep it at module level so any InstallButton can use it.
let deferred: BIPEvent | null = null;
const subs = new Set<() => void>();
const notify = () => subs.forEach(f => f());

/** Registers the service worker (production only) and captures the install prompt. Renders nothing. */
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(reg => {
          // Make a newly installed/updated worker active immediately.
          reg.update().catch(() => {});
          window.dispatchEvent(new Event('velvotix-sw-ready'));
        })
        .catch(err => console.error('[PWA] service worker registration failed', err));
    }
    const onPrompt = (e: Event) => { e.preventDefault(); deferred = e as BIPEvent; notify(); };
    const onInstalled = () => { deferred = null; notify(); };
    window.addEventListener('beforeinstallprompt', onPrompt); window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  return null;
}

/** "Install app" button. Chrome/Edge/Android: native prompt. iPhone/iPad: shows Add-to-Home-Screen steps. Hidden once installed. */
export function InstallButton({ color }: { color?: 'inherit' }) {
  const [, tick] = useState(0); const [ios, setIos] = useState(false); const [standalone, setStandalone] = useState(true); const [help, setHelp] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    setStandalone(window.matchMedia('(display-mode: standalone)').matches || !!nav.standalone);
    setIos(/iphone|ipad|ipod/i.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1));
    const f = () => tick(n => n + 1); subs.add(f); return () => { subs.delete(f); };
  }, []);
  if (standalone || (!deferred && !ios)) return null;
  const click = async () => { if (deferred) { await deferred.prompt(); await deferred.userChoice; deferred = null; notify(); } else setHelp(true); };
  return (<>
    <Tooltip title="Install app"><IconButton color={color} onClick={click} aria-label="install app"><InstallMobile /></IconButton></Tooltip>
    <Dialog open={help} onClose={() => setHelp(false)}><DialogTitle>Install on iPhone / iPad</DialogTitle>
      <DialogContent><Typography>1. Open this site in Safari.</Typography><Typography>2. Tap the Share button.</Typography><Typography>3. Choose "Add to Home Screen", then tap Add.</Typography></DialogContent>
      <DialogActions><Button onClick={() => setHelp(false)}>Got it</Button></DialogActions></Dialog>
  </>);
}
