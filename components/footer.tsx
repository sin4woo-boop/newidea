import { BrandMark } from '@/components/brand';
import { DISCLAIMER } from '@/lib/disclaimer';

export function FooterDisclaimer() {
  return (
    <footer className="safe-px safe-pb py-5">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-2">
        <BrandMark className="text-base" />
        <p className="korean-keep text-center text-xs text-muted-foreground">{DISCLAIMER}</p>
      </div>
    </footer>
  );
}
