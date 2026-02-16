import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';
import { BrandMark } from '@/components/brand';
import { Button, Card } from '@/components/ui';

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect('/');

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-sm space-y-5 border-[#E9E1D3] bg-white p-6 text-center">
        <BrandMark className="text-3xl" />
        <p className="text-sm text-neutral-500">AI-powered artwork risk screening for galleries</p>
        <form
          action={async () => {
            'use server';
            await signIn('google', { redirectTo: '/' });
          }}
        >
          <Button className="h-[52px] w-full rounded-xl bg-[#B89A5D] text-white hover:bg-[#A88442]">
            Google로 로그인
          </Button>
        </form>
      </Card>
    </div>
  );
}
