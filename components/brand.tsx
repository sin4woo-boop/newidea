import Link from 'next/link';
import { cn } from '@/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn('text-xl font-semibold tracking-[0.02em]', className)}>
      <span className="text-neutral-900">HERIT</span>
      <span className="text-[#B89A5D]">AI</span>
    </span>
  );
}

export function BrandLink() {
  return (
    <Link href="/" className="inline-flex items-center">
      <BrandMark />
    </Link>
  );
}
