import type { Metadata, Viewport } from 'next';
import Providers from './providers';
export const metadata: Metadata = {
  title: 'Velvotix Portal', applicationName: 'Velvotix Portal', description: 'Support tickets, hours, invoices and contracts.',
  appleWebApp: { capable: true, title: 'Velvotix', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: { icon: [{ url: '/pwa-icon?s=192', sizes: '192x192', type: 'image/png' }], apple: [{ url: '/pwa-icon?s=180', sizes: '180x180', type: 'image/png' }] },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: [{ media: '(prefers-color-scheme: light)', color: '#1565c0' }, { media: '(prefers-color-scheme: dark)', color: '#0f1420' }] };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><Providers>{children}</Providers></body></html>;
}
