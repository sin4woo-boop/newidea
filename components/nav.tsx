import Link from 'next/link';
import Image from 'next/image';
import { auth, signOut } from '@/auth';
import { BrandLink } from '@/components/brand';
import { Button } from '@/components/ui';

const links = [
  { href: '/', label: '대시보드' },
  { href: '/new', label: '신규분석' },
  { href: '/cases', label: '내 접수함' }
] as const;

export async function TopNav() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-[#F7F4EE]/95 backdrop-blur">
      <nav className="safe-px mx-auto flex min-h-16 w-full max-w-xl items-center justify-between gap-2 py-2">
        <BrandLink />

        {!user && (
          <Link href="/login">
            <Button className="h-12 rounded-xl bg-[#B89A5D] px-4 text-white hover:bg-[#A88442]">로그인</Button>
          </Link>
        )}

        {user && (
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1 sm:flex">
              {links.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex h-12 items-center rounded-xl px-3 text-sm text-neutral-700 hover:bg-white"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="hidden max-w-[180px] truncate text-xs text-neutral-500 md:block">{user.email}</div>
            {user.image && (
              <div className="relative hidden h-8 w-8 overflow-hidden rounded-full border border-[#E2D8C4] sm:block">
                <Image src={user.image} alt="profile" fill className="object-cover" unoptimized />
              </div>
            )}
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/login' });
              }}
            >
              <Button variant="outline" className="h-12 rounded-xl border-[#E2D8C4] bg-white px-3">
                로그아웃
              </Button>
            </form>
          </div>
        )}
      </nav>

      {user && (
        <div className="safe-px border-t border-[#EDE4D5] bg-[#F7F4EE] sm:hidden">
          <div className="mx-auto grid h-12 w-full max-w-xl grid-cols-3 gap-1 py-1">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg text-xs text-neutral-700 hover:bg-white"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
