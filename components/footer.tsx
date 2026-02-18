'use client';

import { usePathname } from 'next/navigation';
import { DISCLAIMER } from '@/lib/disclaimer';

export function FooterDisclaimer() {
  const pathname = usePathname();
  if (pathname?.startsWith('/case/')) return null;

  return (
    <footer className="safe-px safe-pb py-5">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-2">
        <p className="korean-keep text-center text-xs text-muted-foreground opacity-70">{DISCLAIMER}</p>
      </div>
    </footer>
  );
}
