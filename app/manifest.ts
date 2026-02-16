import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HERITAI',
    short_name: 'HERITAI',
    description: 'Heritage Risk Intelligence Platform for galleries',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7F4EE',
    theme_color: '#B89A5D',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  };
}
