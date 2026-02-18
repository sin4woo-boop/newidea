'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function CasesToast() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('deleted') === '1') {
      setOpen(true);
      const timer = setTimeout(() => {
        setOpen(false);
        router.replace('/cases', { scroll: false });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  if (!open) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-[#DCCBA5] bg-white px-4 py-2 text-sm text-neutral-800 shadow-md">
      삭제되었습니다
    </div>
  );
}
