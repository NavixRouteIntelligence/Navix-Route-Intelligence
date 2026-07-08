import type { MetadataRoute } from 'next';

/** Web App Manifest (PWA). Torna a Navix instalável no desktop e no celular. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Navix Route Intelligence',
    short_name: 'Navix',
    description: 'Plataforma de inteligência logística de última milha.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0b0b12',
    theme_color: '#6d4aff',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
