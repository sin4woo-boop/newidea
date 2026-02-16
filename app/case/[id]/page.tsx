import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Button, Card } from '@/components/ui';
import { DISCLAIMER } from '@/lib/disclaimer';
import { getChecklist } from '@/lib/checklists';
import { getCase } from '@/lib/storage';

export default async function CaseDetailPage({ params }: { params: { id: string } }) {
  const data = await getCase(params.id);
  if (!data) return notFound();

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">리스크 결과</h1>
          <Badge>{data.riskLevel}</Badge>
        </div>
        <p className="text-3xl font-bold">{data.riskScore}</p>
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          {data.riskReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-medium">OCR 텍스트</h2>
        <textarea readOnly value={data.ocrText} className="h-40 w-full rounded border p-2 text-sm" />
      </Card>

      <Card className="space-y-2">
        <h2 className="font-medium">추가 촬영 체크리스트</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          {getChecklist(data.category).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-2">
        <p className="whitespace-pre-line text-xs text-muted-foreground">{DISCLAIMER}</p>
        <a href="https://www.seoulauction.com" target="_blank" rel="noreferrer">
          <Button className="w-full">서울옥션 위탁 상담 연결</Button>
        </a>
      </Card>

      <Link href="/cases">
        <Button variant="outline" className="w-full">
          내 접수함으로 이동
        </Button>
      </Link>
    </div>
  );
}
