import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';
import { Button } from '@/components/ui';

const trustPoints = [
  { title: '빠른 스크리닝', desc: '현장에서 작품 이미지를 등록하고 즉시 리스크를 점검합니다.' },
  { title: '근거 기반', desc: 'OCR 결과와 점수 규칙을 함께 보여 판단 근거를 명확히 제시합니다.' },
  { title: '전문가 연계', desc: '고위험 판단 시 전문가 검토 흐름으로 자연스럽게 연결합니다.' }
] as const;

export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.id) redirect('/dashboard');

  return (
    <div className="mx-auto flex min-h-[72vh] w-full max-w-xl items-center">
      <section className="w-full space-y-6 rounded-3xl border border-[#E9E1D3] bg-white p-7 shadow-sm sm:p-8">
        <header className="space-y-4">
          <h1 className="break-keep text-4xl font-bold leading-tight tracking-tight text-neutral-900">
            <span className="block">고미술 리스크</span>
            <span className="block">인텔리전스</span>
          </h1>
          <p className="break-keep text-base leading-relaxed text-neutral-600">
            <span className="block">갤러리를 위한 AI 기반 작품 리스크</span>
            <span className="block">사전 스크리닝 시스템</span>
          </p>
        </header>

        <section className="grid gap-3">
          {trustPoints.map((item) => (
            <div key={item.title} className="rounded-2xl border border-[#EEE5D8] bg-[#FFFEFC] p-4">
              <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#B89A5D]" />
                {item.title}
              </p>
              <p className="break-keep text-sm leading-relaxed text-neutral-600">{item.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-3 rounded-2xl border border-[#E9E1D3] bg-[#FAF7F1] p-4 sm:p-5">
          <form
            action={async () => {
              'use server';
              await signIn('google', { redirectTo: '/dashboard' });
            }}
          >
            <Button className="h-14 w-full rounded-2xl bg-[#B89A5D] text-base font-semibold text-white hover:bg-[#A88442]">
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-sm font-bold">G</span>
              Google로 로그인
            </Button>
          </form>
          <p className="break-keep text-sm text-neutral-600">로그인 후 대시보드에서 분석/관리할 수 있습니다.</p>
        </section>
      </section>
    </div>
  );
}
