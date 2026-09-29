export const dynamic = 'force-static';
const SW = `
const VERSION = 'v1';
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
`;
export function GET() {
  return new Response(SW, { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Service-Worker-Allowed': '/' } });
}
