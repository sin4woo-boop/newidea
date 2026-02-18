import Link from 'next/link';
import Image from 'next/image';
import { auth, signIn, signOut } from '@/auth';
import { BrandLink } from '@/components/brand';
import { Button } from '@/components/ui';

const appLinks = [
  { href: '/dashboard', label: '대시보드' },
  { href: '/new', label: '신규분석' },
  { href: '/cases', label: '내 접수함' }
] as const;

export async function TopNav() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-20 border-b border-[#E9E1D3] bg-[#F7F4EE]/95 backdrop-blur">
      <nav className="safe-px mx-auto flex h-14 w-full max-w-xl items-center justify-between gap-2">
        <BrandLink />

        {!user && (
          <form
            action={async () => {
              'use server';
              await signIn('google', { redirectTo: '/dashboard' });
            }}
          >
            <Button className="h-11 rounded-xl bg-[#B89A5D] px-4 text-white hover:bg-[#A88442]">로그인</Button>
          </form>
        )}

        {user && (
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1 sm:flex">
              {appLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex h-10 items-center rounded-xl px-3 text-sm text-neutral-700 hover:bg-white"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <details className="relative">
              <summary className="list-none">
                <span className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-[#E2D8C4] bg-white px-3 text-sm text-neutral-700">
                  {user.image ? (
                    <span className="relative h-6 w-6 overflow-hidden rounded-full border border-[#E2D8C4]">
                      <Image src={user.image} alt="profile" fill className="object-cover" unoptimized />
                    </span>
                  ) : (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#EFE7D8] text-xs font-semibold text-[#8A6A33]">
                      {user.name?.slice(0, 1) ?? 'U'}
                    </span>
                  )}
                  <span className="hidden max-w-[120px] truncate sm:inline">{user.name ?? '내 계정'}</span>
                  <span className="sm:hidden">내 계정</span>
                </span>
              </summary>
              <div className="absolute right-0 top-12 w-44 rounded-xl border border-[#E2D8C4] bg-white p-2 shadow-sm">
                <p className="mb-2 truncate px-2 text-xs text-neutral-500">{user.email}</p>
                <form
                  action={async () => {
                    'use server';
                    await signOut({ redirectTo: '/' });
                  }}
                >
                  <Button variant="outline" className="h-10 w-full rounded-lg border-[#E2D8C4] bg-white">
                    로그아웃
                  </Button>
                </form>
              </div>
            </details>
          </div>
        )}
      </nav>

      {user && (
        <div className="safe-px border-t border-[#EDE4D5] bg-[#F7F4EE] sm:hidden">
          <div className="mx-auto grid h-11 w-full max-w-xl grid-cols-3 gap-1 py-1">
            {appLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-[36px] items-center justify-center rounded-lg text-xs text-neutral-700 hover:bg-white"
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
