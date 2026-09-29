import { ImageResponse } from 'next/og';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const SIZES = [180, 192, 512];
/** /pwa-icon?s=192 (any) | ?s=512&m=1 (maskable: full-bleed with a padded safe zone). Generated on the fly, so no image files are needed. */
export function GET(req: Request) {
  const sp = new URL(req.url).searchParams, s = Number(sp.get('s')), size = SIZES.includes(s) ? s : 512, mask = sp.get('m') === '1';
  const glyph = Math.round(size * (mask ? 0.42 : 0.56)), dot = Math.round(size * 0.09);
  return new ImageResponse(
    (<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', background: 'linear-gradient(135deg,#0d47a1,#1565c0 60%,#ef6c00)', borderRadius: mask ? 0 : Math.round(size * 0.22) }}>
      <div style={{ color: '#fff', fontSize: glyph, fontWeight: 800, lineHeight: 1, display: 'flex' }}>V</div>
      <div style={{ position: 'absolute', width: dot, height: dot, borderRadius: dot, background: '#ffb74d', right: Math.round(size * (mask ? 0.3 : 0.22)), bottom: Math.round(size * (mask ? 0.3 : 0.22)), display: 'flex' }} />
    </div>),
    { width: size, height: size, headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } });
}
