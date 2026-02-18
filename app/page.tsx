import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';
import { Button } from '@/components/ui';

export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.id) redirect('/dashboard');

  return (
    <div className="mx-auto flex min-h-[68vh] w-full max-w-xl items-center">
      <section className="mx-auto w-full max-w-[560px] space-y-6 rounded-2xl border border-[#E9E1D3] bg-white p-7 shadow-sm">
        <div className="max-w-[28ch] space-y-3">
          <h1 className="break-keep text-3xl font-semibold leading-snug tracking-tight text-neutral-900">
            <span className="block">고미술 리스크</span>
            <span className="block">인텔리전스</span>
          </h1>
          <p className="text-base text-neutral-600">갤러리를 위한 AI 기반 작품 리스크 사전 스크리닝 시스템</p>
        </div>

        <form
          action={async () => {
            'use server';
            await signIn('google', { redirectTo: '/dashboard' });
          }}
        >
          <Button className="h-12 w-full rounded-xl bg-[#B89A5D] text-base font-semibold text-white hover:bg-[#A88442]">
            Google로 로그인
          </Button>
        </form>

        <p className="text-sm text-neutral-500">로그인 후 대시보드에서 분석/관리 가능합니다.</p>
      </section>
    </div>
  );
}
