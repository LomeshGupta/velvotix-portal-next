export const metadata = { title: 'Offline - Velvotix Portal' };
/** Plain server-rendered page (no client JS needed) so it can be shown from the service-worker cache. */
export default function Offline() {
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div>
        <h1 style={{ color: '#1565c0', margin: 0 }}>You are offline</h1>
        <p style={{ color: '#555' }}>Velvotix Portal needs an internet connection to load your latest data. Please check your connection and try again.</p>
        <a href="/" style={{ display: 'inline-block', marginTop: 8, padding: '10px 20px', borderRadius: 8, background: '#1565c0', color: '#fff', textDecoration: 'none', fontWeight: 600 }}>Try again</a>
      </div>
    </main>
  );
}
