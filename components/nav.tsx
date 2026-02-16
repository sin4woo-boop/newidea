import Link from 'next/link';

const links = [
  { href: '/', label: '홈' },
  { href: '/new', label: '신규 접수' },
  { href: '/cases', label: '내 접수함' },
  { href: '/admin', label: '관리자' }
] as const;

export function TopNav() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-white/90 backdrop-blur">
      <nav className="safe-px flex h-14 items-center justify-between">
        <Link href="/" className="text-sm font-semibold">
          Antique Risk Screen
        </Link>
        <div className="flex gap-3 text-xs">
          {links.map((item) => (
            <Link key={item.href} href={item.href} className="text-muted-foreground hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
