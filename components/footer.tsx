import { DISCLAIMER } from '@/lib/disclaimer';

export function FooterDisclaimer() {
  return <p className="safe-px safe-pb py-4 text-center text-xs text-muted-foreground">{DISCLAIMER}</p>;
}
