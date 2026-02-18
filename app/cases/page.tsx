import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Badge, Card } from '@/components/ui';
import { listCasesByUser } from '@/lib/storage';

export default async function CasesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const items = await listCasesByUser(session.user.id);

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold text-neutral-900">내 접수함</h1>
      {items.length === 0 && <Card className="border-[#E9E1D3] text-sm text-neutral-500">아직 접수된 케이스가 없습니다.</Card>}
      {items.map((item) => (
        <Link href={`/case/${item.id}`} key={item.id}>
          <Card className="space-y-1 border-[#E9E1D3] bg-white">
            <div className="flex items-center justify-between">
              <p className="font-medium text-neutral-900">{item.category}</p>
              <Badge>{item.riskLevel}</Badge>
            </div>
            <p className="text-xs text-neutral-500">{new Date(item.createdAt).toLocaleString('ko-KR')}</p>
            <p className="text-sm text-neutral-900">리스크 점수: {item.riskScore}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
