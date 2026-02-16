import Link from 'next/link';
import { Badge, Card } from '@/components/ui';
import { listCases } from '@/lib/storage';

export default async function CasesPage() {
  const items = await listCases();

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">내 접수함</h1>
      {items.length === 0 && <Card className="text-sm text-muted-foreground">아직 접수된 케이스가 없습니다.</Card>}
      {items.map((item) => (
        <Link href={`/case/${item.id}`} key={item.id}>
          <Card className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="font-medium">{item.category}</p>
              <Badge>{item.riskLevel}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString('ko-KR')}</p>
            <p className="text-sm">리스크 점수: {item.riskScore}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
