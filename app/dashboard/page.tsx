import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Badge, Button, Card } from '@/components/ui';
import { listCasesByUser } from '@/lib/storage';
import { CaseRecord } from '@/lib/types';
import { normalizeRiskLevel } from '@/lib/risk-level';

function formatDelta(current: number, previous: number) {
  if (previous === 0) return { text: '변화 없음', positive: true };
  const delta = ((current - previous) / Math.abs(previous)) * 100;
  return { text: `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`, positive: delta >= 0 };
}

function riskLevelByScore(score: number) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function riskBadgeClass(score: number) {
  const level = riskLevelByScore(score);
  if (level === 'high') return 'bg-[#E9D6D5] text-[#7D3F3B]';
  if (level === 'medium') return 'bg-[#F3E8CF] text-[#8A6A33]';
  return 'bg-[#DDE8DF] text-[#486653]';
}

function riskDistribution(cases: CaseRecord[]) {
  const counts = { low: 0, medium: 0, high: 0 };
  for (const item of cases) counts[riskLevelByScore(item.riskScore)] += 1;
  return counts;
}

function pct(n: number, total: number) {
  return total === 0 ? 0 : Math.round((n / total) * 100);
}

function monthBoundary(base: Date) {
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const prev = new Date(base.getFullYear(), base.getMonth() - 1, 1);
  return { start, prev };
}

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect('/');

  const items = await listCasesByUser(userId);
  const { start, prev } = monthBoundary(new Date());
  const thisMonthCases = items.filter((item) => new Date(item.createdAt) >= start);
  const previousMonthCases = items.filter((item) => {
    const d = new Date(item.createdAt);
    return d >= prev && d < start;
  });

  const totalScreened = items.length;
  const avgRisk = totalScreened ? items.reduce((sum, item) => sum + item.riskScore, 0) / totalScreened : 0;
  const highRiskRatio = totalScreened ? (items.filter((item) => item.riskScore >= 70).length / totalScreened) * 100 : 0;
  const monthAnalyses = thisMonthCases.length;

  const prevAvgRisk = previousMonthCases.length
    ? previousMonthCases.reduce((sum, item) => sum + item.riskScore, 0) / previousMonthCases.length
    : 0;
  const prevHighRiskRatio = previousMonthCases.length
    ? (previousMonthCases.filter((item) => item.riskScore >= 70).length / previousMonthCases.length) * 100
    : 0;

  const kpis = [
    {
      title: '누적 분석 작품',
      value: totalScreened.toLocaleString('ko-KR'),
      sub: '전체 분석 완료 건수',
      delta: formatDelta(thisMonthCases.length, previousMonthCases.length)
    },
    {
      title: '평균 리스크 점수',
      value: avgRisk.toFixed(1),
      sub: '누적 평균 점수',
      delta: formatDelta(avgRisk, prevAvgRisk)
    },
    {
      title: '고위험 비율',
      value: `${highRiskRatio.toFixed(1)}%`,
      sub: '점수 70 이상 비중',
      delta: formatDelta(highRiskRatio, prevHighRiskRatio)
    },
    {
      title: '이번 달 분석 건수',
      value: monthAnalyses.toLocaleString('ko-KR'),
      sub: '월간 신규 접수',
      delta: formatDelta(thisMonthCases.length, previousMonthCases.length)
    }
  ];

  const dist = riskDistribution(items);
  const recent = items.slice(0, 5);

  return (
    <div className="space-y-6 pb-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Risk Intelligence Dashboard</p>
        <h1 className="text-xl font-semibold text-neutral-900">리스크 인텔리전스 대시보드</h1>
      </header>

      {items.length === 0 && (
        <Card className="space-y-4 border-[#E9E1D3] bg-white p-5">
          <p className="text-sm text-neutral-600">아직 분석 기록이 없습니다.</p>
          <Link href="/new" className="block">
            <Button className="h-12 w-full rounded-xl bg-[#B89A5D] text-white hover:bg-[#A88442]">+ 신규 작품 스크리닝</Button>
          </Link>
        </Card>
      )}

      <section className="grid grid-cols-2 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="relative space-y-2 border-[#E9E1D3] bg-white p-4">
            <div className="absolute left-0 right-0 top-0 h-[2px] rounded-t-xl bg-[#B89A5D]" />
            <p className="whitespace-nowrap pt-1 text-[11px] tracking-wide text-neutral-500">{kpi.title}</p>
            <p className="text-3xl font-semibold tabular-nums text-neutral-900">{kpi.value}</p>
            <p className="text-xs text-neutral-500">{kpi.sub}</p>
            <Badge className={kpi.delta.positive ? 'bg-[#E8F0EA] text-[#4F6B59]' : 'bg-[#F3E3E3] text-[#8B4D4B]'}>
              {kpi.delta.text} 전월 대비
            </Badge>
          </Card>
        ))}
      </section>

      <Card className="space-y-4 border-[#E9E1D3] bg-white p-5">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">리스크 분포</h2>
          <p className="text-xs text-neutral-500">현재까지 분석한 작품의 위험도 비율</p>
        </div>
        <div className="space-y-3">
          {[
            { label: '낮음', value: dist.low, color: 'bg-[#6E8F78]' },
            { label: '중간', value: dist.medium, color: 'bg-[#B89A5D]' },
            { label: '높음', value: dist.high, color: 'bg-[#8B4D4B]' }
          ].map((row) => {
            const width = pct(row.value, totalScreened);
            return (
              <div key={row.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-neutral-900">{row.label}</span>
                  <span className="tabular-nums text-neutral-500">
                    {row.value}건 ({width}%)
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#EDE6D7]">
                  <div className={`h-1.5 rounded-full ${row.color}`} style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-3 border-[#E9E1D3] bg-white p-5">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">최근 분석 케이스</h2>
          <Link href="/cases" className="text-xs text-neutral-500 hover:text-neutral-900">
            전체 보기
          </Link>
        </div>
        {recent.length === 0 && <p className="text-sm text-neutral-500">최근 분석 데이터가 없습니다.</p>}
        <div className="space-y-2">
          {recent.map((item) => (
            <Link
              key={item.id}
              href={`/case/${item.id}`}
              className="flex items-center gap-3 rounded-xl border border-[#ECE5D9] bg-white p-2 transition hover:border-[#DCCBA5]"
            >
              <div className="relative h-14 w-14 overflow-hidden rounded-lg bg-[#F1ECE3]">
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt="케이스 이미지" fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-500">이미지 없음</div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-medium text-neutral-900">{item.category}</p>
                <p className="text-xs text-neutral-500">
                  {new Date(item.createdAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                  })}
                </p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-sm font-semibold tabular-nums text-neutral-900">{item.riskScore}</p>
                <Badge className={riskBadgeClass(item.riskScore)}>{normalizeRiskLevel(item.riskLevel)}</Badge>
              </div>
            </Link>
          ))}
        </div>
      </Card>

      <Link href="/new" className="block">
        <Button className="h-12 w-full justify-center rounded-xl bg-[#B89A5D] text-base font-semibold text-white hover:bg-[#A88442]">
          + 신규 작품 스크리닝
        </Button>
      </Link>
    </div>
  );
}
