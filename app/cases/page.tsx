import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Badge, Card } from '@/components/ui';
import { listCasesByUser } from '@/lib/storage';

function badgeTone(level: string) {
  if (level === '높음') return 'bg-[#E5C9C7] text-[#6F2F2B]';
  if (level === '중간') return 'bg-[#F1DFB8] text-[#7B5A1C]';
  return 'bg-[#D4E4D8] text-[#2F5D3E]';
}

export default async function CasesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const items = await listCasesByUser(session.user.id);

  return (
    <div className="space-y-6 pb-8">
      <h1 className="text-xl font-semibold tracking-tight text-neutral-900">내 접수함</h1>

      {items.length === 0 && (
        <Card className="border-[#E9E1D3] bg-white p-6 text-sm text-neutral-500 shadow-sm">아직 접수된 케이스가 없습니다.</Card>
      )}

      <div className="space-y-6">
        {items.map((item) => (
          <Link href={`/case/${item.id}`} key={item.id} className="block">
            <Card className="mb-6 border-[#E9E1D3] bg-white p-6 shadow-sm transition hover:shadow-md">
              <div className="flex items-start gap-4">
                <div className="relative h-14 w-14 flex-none overflow-hidden rounded-xl border border-[#E9E1D3] bg-[#F3EEE4]">
                  {item.imageUrl ? (
                    <Image src={item.imageUrl} alt="작품 썸네일" fill className="object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg text-neutral-400">◻</div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="truncate text-lg font-medium text-neutral-900">{item.category}</p>
                    <Badge className={`rounded-full px-3 py-1 text-sm ${badgeTone(item.riskLevel)}`}>{item.riskLevel}</Badge>
                  </div>

                  <p className="text-sm text-neutral-500">
                    {new Date(item.createdAt).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit'
                    })}
                  </p>

                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">리스크 점수</p>
                    <p className="text-3xl font-semibold tabular-nums tracking-tight text-neutral-900">{item.riskScore}</p>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
