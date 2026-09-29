'use client';
import { forwardRef, useEffect, useRef, useState } from 'react';
import { Box, Button as MuiButton, CircularProgress, LinearProgress, Skeleton, TableCell, TableRow, Typography } from '@mui/material';
import type { ButtonProps } from '@mui/material';

/**
 * Drop-in replacement for MUI Button. If onClick returns a Promise (any `async` handler), the button shows a spinner and is
 * disabled until it settles, so double-submits are impossible and the user always sees that work is happening.
 * Pass `loading` to force the state from outside.
 */
const AsyncButton = forwardRef<HTMLButtonElement, ButtonProps & { loading?: boolean }>(function AsyncButton({ onClick, disabled, startIcon, loading, children, ...rest }, ref) {
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const handle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = (onClick as ((e: React.MouseEvent<HTMLButtonElement>) => unknown) | undefined)?.(e);
    if (r && typeof (r as Promise<unknown>).then === 'function') {
      setBusy(true);
      (r as Promise<unknown>).then(() => undefined, () => undefined).finally(() => { if (alive.current) setBusy(false); });
    }
  };
  const on = busy || !!loading;
  return (
    <MuiButton ref={ref} {...rest} onClick={handle} disabled={disabled || on} aria-busy={on}
      startIcon={on ? <CircularProgress size={16} thickness={5} color="inherit" /> : startIcon}>{children}</MuiButton>
  );
});
export const Button = AsyncButton as unknown as typeof MuiButton;

/* -------- global top progress bar: any in-flight fetch() shows it (add header x-bg:1 to opt out, e.g. background polling) -------- */
let inflight = 0;
const subs = new Set<(n: number) => void>();
const emit = () => subs.forEach(f => f(inflight));
function patchFetch() {
  const w = window as unknown as { __fetchPatched?: boolean };
  if (w.__fetchPatched) return;
  w.__fetchPatched = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let bg = false;
    try { bg = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)).has('x-bg'); } catch { /* ignore */ }
    if (!bg) { inflight++; emit(); }
    try { return await orig(input, init); } finally { if (!bg) { inflight = Math.max(0, inflight - 1); emit(); } }
  };
}
export function GlobalProgress() {
  const [n, setN] = useState(0), [show, setShow] = useState(false);
  useEffect(() => { patchFetch(); subs.add(setN); return () => { subs.delete(setN); }; }, []);
  useEffect(() => { // only appear if the request takes longer than 120ms (no flicker on fast calls)
    if (n > 0) { const t = setTimeout(() => setShow(true), 120); return () => clearTimeout(t); }
    const t = setTimeout(() => setShow(false), 250); return () => clearTimeout(t);
  }, [n]);
  return (
    <Box aria-hidden sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 2000, height: 3, opacity: show ? 1 : 0, transition: 'opacity .25s', pointerEvents: 'none' }}>
      <LinearProgress sx={{ height: 3, bgcolor: 'transparent', '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg,#1565c0,#42a5f5,#ef6c00)' } }} />
    </Box>
  );
}

/* -------- skeletons and empty states -------- */
export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return <>{Array.from({ length: rows }).map((_, r) => (
    <TableRow key={r}>{Array.from({ length: cols }).map((__, c) => <TableCell key={c}><Skeleton animation="wave" width={c === 0 ? '70%' : `${50 + ((r + c) % 4) * 12}%`} /></TableCell>)}</TableRow>))}</>;
}
export function CardSkeleton({ height = 96 }: { height?: number }) {
  return <Skeleton variant="rounded" animation="wave" height={height} sx={{ borderRadius: 3 }} />;
}
export function EmptyRow({ cols, title, hint }: { cols: number; title: string; hint?: string }) {
  return (
    <TableRow><TableCell colSpan={cols} align="center" sx={{ py: 6, border: 0 }}>
      <svg width="120" height="96" viewBox="0 0 120 96" fill="none" aria-hidden>
        <ellipse cx="60" cy="86" rx="40" ry="6" fill="currentColor" opacity=".08" />
        <rect x="22" y="14" width="76" height="62" rx="10" fill="#1565c0" opacity=".1" /><rect x="22" y="14" width="76" height="62" rx="10" stroke="#1565c0" strokeWidth="2" />
        <rect x="34" y="30" width="34" height="6" rx="3" fill="#1565c0" opacity=".55" /><rect x="34" y="44" width="52" height="6" rx="3" fill="#1565c0" opacity=".3" /><rect x="34" y="58" width="26" height="6" rx="3" fill="#ef6c00" opacity=".7" />
        <circle cx="92" cy="20" r="9" fill="#ef6c00" /><path d="M88.5 20l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <Typography fontWeight={700} sx={{ mt: 1 }}>{title}</Typography>
      {hint && <Typography variant="body2" color="text.secondary">{hint}</Typography>}
    </TableCell></TableRow>
  );
}
