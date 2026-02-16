'use client';

import { useEffect } from 'react';

export function SWRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error) => console.error('SW register failed', error));
    }
  }, []);

  return null;
}
