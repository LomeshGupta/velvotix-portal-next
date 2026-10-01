export const dynamic = 'force-static';
const SW = `
const VERSION = 'v3-notifications';
const CACHE = 'velvotix-static-' + VERSION;
const OFFLINE = '/offline';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([OFFLINE, '/pwa-icon?s=192'])));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('velvotix-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return;
  // Never cache API responses: they are private, per-user and change constantly.
  if (u.pathname.startsWith('/api/')) return;
  // Pages: always the live version; friendly offline page if the network is down.
  if (r.mode === 'navigate') { e.respondWith(fetch(r).catch(() => caches.match(OFFLINE))); return; }
  // Hashed build assets and icons never change: serve from cache, fill on first use.
  if (u.pathname.startsWith('/_next/static/') || u.pathname === '/pwa-icon') {
    e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
      return res;
    })));
  }
});
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: 'Velvotix Portal', body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    wins.forEach(c => c.postMessage({ type: 'notif' })); // open tabs refresh their bell immediately
    if (wins.some(c => c.visibilityState === 'visible' && c.focused)) return; // user is looking at the app: the in-app toast covers it
    await self.registration.showNotification(d.title || 'Velvotix Portal', {
      body: d.body || '', icon: '/pwa-icon?s=192', badge: '/pwa-icon?s=192', tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || '/' },
    });
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of wins) { if ('focus' in c) { await c.focus(); if ('navigate' in c) { try { await c.navigate(url); } catch (_) {} } return; } }
    await self.clients.openWindow(url);
  })());
});
`;
export function GET() {
  return new Response(SW, { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Service-Worker-Allowed': '/' } });
}
