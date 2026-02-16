import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Antique Risk Screen',
    short_name: 'RiskScreen',
    description: '고미술 리스크 스크리닝 PWA',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#1f2a44',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  };
}
