import Image from 'next/image';
import Link from 'next/link';
import { Badge, Button, Card } from '@/components/ui';
import { listCases } from '@/lib/storage';
import { CaseRecord } from '@/lib/types';

function formatDelta(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) return { text: '변동 없음', positive: true };
    return { text: `+${current.toFixed(1)}%`, positive: true };
  }
  const delta = ((current - previous) / Math.abs(previous)) * 100;
  const sign = delta >= 0 ? '+' : '';
  return { text: `${sign}${delta.toFixed(1)}%`, positive: delta >= 0 };
}

function startOfMonth(base: Date) {
  return new Date(base.getFullYear(), base.getMonth(), 1);
}

function startOfPreviousMonth(base: Date) {
  return new Date(base.getFullYear(), base.getMonth() - 1, 1);
}

function asDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function riskLevelByScore(score: number) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function riskBadgeClass(score: number) {
  const level = riskLevelByScore(score);
  if (level === 'high') return 'bg-red-100 text-red-700';
  if (level === 'medium') return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
}

function riskDistribution(cases: CaseRecord[]) {
  const counts = { low: 0, medium: 0, high: 0 };
  for (const item of cases) {
    const level = riskLevelByScore(item.riskScore);
    counts[level] += 1;
  }
  return counts;
}

function pct(n: number, total: number) {
  if (total === 0) return 0;
  return Math.round((n / total) * 100);
}

export default async function HomePage() {
  const items = await listCases();
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const previousMonthStart = startOfPreviousMonth(now);

  const thisMonthCases = items.filter((item) => {
    const d = asDate(item.createdAt);
    return d ? d >= thisMonthStart : false;
  });
  const previousMonthCases = items.filter((item) => {
    const d = asDate(item.createdAt);
    return d ? d >= previousMonthStart && d < thisMonthStart : false;
  });

  const totalScreened = items.length;
  const avgRisk = totalScreened > 0 ? items.reduce((sum, item) => sum + item.riskScore, 0) / totalScreened : 0;
  const highRiskCount = items.filter((item) => item.riskScore >= 70).length;
  const highRiskRatio = totalScreened > 0 ? (highRiskCount / totalScreened) * 100 : 0;
  const monthAnalyses = thisMonthCases.length;

  const prevAvgRisk =
    previousMonthCases.length > 0
      ? previousMonthCases.reduce((sum, item) => sum + item.riskScore, 0) / previousMonthCases.length
      : 0;
  const prevHighRatio =
    previousMonthCases.length > 0
      ? (previousMonthCases.filter((item) => item.riskScore >= 70).length / previousMonthCases.length) *
        100
      : 0;

  const totalDelta = formatDelta(thisMonthCases.length, previousMonthCases.length);
  const avgDelta = formatDelta(avgRisk, prevAvgRisk);
  const highDelta = formatDelta(highRiskRatio, prevHighRatio);
  const monthDelta = formatDelta(thisMonthCases.length, previousMonthCases.length);

  const dist = riskDistribution(items);
  const recent = items.slice(0, 5);

  const kpis = [
    {
      title: '누적 분석 작품',
      value: totalScreened.toLocaleString('ko-KR'),
      sub: '지금까지 분석된 전체 작품 수',
      delta: totalDelta
    },
    {
      title: '평균 리스크 점수',
      value: avgRisk.toFixed(1),
      sub: '전체 작품의 평균 점수',
      delta: avgDelta
    },
    {
      title: '고위험 비율',
      value: `${highRiskRatio.toFixed(1)}%`,
      sub: '70점 이상 고위험 비중',
      delta: highDelta
    },
    {
      title: '이번 달 분석 건수',
      value: monthAnalyses.toLocaleString('ko-KR'),
      sub: '이번 달 신규 분석 접수',
      delta: monthDelta
    }
  ];

  return (
    <div className="space-y-6 pb-4">
      <Card className="space-y-3 border-border/70 p-5 shadow-none">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">리스크 인텔리전스 대시보드</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Art Risk Intelligence</h1>
        <p className="max-w-lg text-sm text-muted-foreground">
          갤러리를 위한 AI 기반 작품 리스크 스크리닝 플랫폼
        </p>
      </Card>

      <section className="grid grid-cols-2 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="space-y-2 border-border/70 p-4 shadow-none">
            <p className="whitespace-nowrap text-[11px] font-medium tracking-wide text-muted-foreground">
              {kpi.title}
            </p>
            <p className="text-2xl font-semibold tabular-nums">{kpi.value}</p>
            <p className="text-xs text-muted-foreground">{kpi.sub}</p>
            <Badge className={kpi.delta.positive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
              {kpi.delta.text} 전월 대비
            </Badge>
          </Card>
        ))}
      </section>

      <Card className="space-y-4 border-border/70 p-5 shadow-none">
        <div>
          <h2 className="text-lg font-semibold">리스크 분포</h2>
          <p className="text-xs text-muted-foreground">현재 분석 작품의 리스크 수준 분포</p>
        </div>
        <div className="space-y-3">
          {[
            { label: '낮음', value: dist.low, color: 'bg-emerald-500' },
            { label: '중간', value: dist.medium, color: 'bg-amber-500' },
            { label: '높음', value: dist.high, color: 'bg-red-500' }
          ].map((row) => {
            const width = pct(row.value, totalScreened);
            return (
              <div key={row.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{row.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {row.value}건 ({width}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div className={`h-2 rounded-full ${row.color}`} style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-3 border-border/70 p-5 shadow-none">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold">최근 분석 케이스</h2>
          <Link href="/cases" className="text-xs text-muted-foreground hover:text-foreground">
            전체 보기
          </Link>
        </div>
        {recent.length === 0 && (
          <p className="text-sm text-muted-foreground">아직 분석 기록이 없습니다. 신규 스크리닝을 시작해 주세요.</p>
        )}
        <div className="space-y-2">
          {recent.map((item) => (
            <Link
              key={item.id}
              href={`/case/${item.id}`}
              className="flex items-center gap-3 rounded-lg border border-border/70 bg-white p-2 transition hover:bg-muted/50"
            >
              <div className="relative h-14 w-14 overflow-hidden rounded-md bg-muted">
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt="케이스 썸네일" fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                    이미지 없음
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-medium">{item.category}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                  })}
                </p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-sm font-semibold tabular-nums">{item.riskScore}</p>
                <Badge className={riskBadgeClass(item.riskScore)}>{item.riskLevel}</Badge>
              </div>
            </Link>
          ))}
        </div>
      </Card>

      <Link href="/new" className="block">
        <Button className="h-12 w-full justify-center rounded-lg text-base font-semibold">
          + 신규 작품 스크리닝
        </Button>
      </Link>
    </div>
  );
}
