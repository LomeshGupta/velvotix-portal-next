import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/', name: 'Velvotix Portal', short_name: 'Velvotix', description: 'Support tickets, hours, invoices and contracts.',
    start_url: '/', scope: '/', display: 'standalone', orientation: 'any', background_color: '#f4f6fb', theme_color: '#1565c0', categories: ['business', 'productivity'],
    icons: [
      { src: '/pwa-icon?s=192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon?s=512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon?s=512&m=1', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Staff login', short_name: 'Staff', url: '/admin/login' },
      { name: 'Tickets', short_name: 'Tickets', url: '/admin/tickets' },
      { name: 'Invoices & Ledger', short_name: 'Invoices', url: '/admin/invoices' },
    ],
  };
}
