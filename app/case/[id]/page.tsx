import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Badge, Button, Card } from '@/components/ui';
import { DISCLAIMER } from '@/lib/disclaimer';
import { getChecklist } from '@/lib/checklists';
import { getCaseByUser } from '@/lib/storage';

export default async function CaseDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const data = await getCaseByUser(params.id, session.user.id);
  if (!data) return notFound();

  return (
    <div className="space-y-4">
      <Card className="space-y-2 border-[#E9E1D3] bg-white">
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

      <Card className="space-y-2 border-[#E9E1D3] bg-white">
        <h2 className="font-medium">OCR 텍스트</h2>
        <textarea readOnly value={data.ocrText} className="h-40 w-full rounded border border-[#E9E1D3] p-2 text-sm" />
      </Card>

      <Card className="space-y-2 border-[#E9E1D3] bg-white">
        <h2 className="font-medium">추가 촬영 체크리스트</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          {getChecklist(data.category).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-2 border-[#E9E1D3] bg-white">
        <p className="korean-keep text-xs text-muted-foreground">{DISCLAIMER}</p>
        <a href="https://www.seoulauction.com" target="_blank" rel="noreferrer">
          <Button className="h-12 w-full rounded-xl bg-[#B89A5D] text-white hover:bg-[#A88442]">서울옥션 위탁 상담 연결</Button>
        </a>
      </Card>

      <Link href="/cases">
        <Button variant="outline" className="h-12 w-full rounded-xl border-[#E2D8C4] bg-white">
          내 접수함으로 이동
        </Button>
      </Link>
    </div>
  );
}
