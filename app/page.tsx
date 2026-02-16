import Image from 'next/image';
import Link from 'next/link';
import { Badge, Button, Card } from '@/components/ui';
import { listCases } from '@/lib/storage';
import { CaseRecord } from '@/lib/types';

function formatDelta(current: number, previous: number, suffix = '') {
  if (previous === 0) {
    if (current === 0) return { text: 'No change', positive: true };
    return { text: `+${current.toFixed(1)}${suffix}`, positive: true };
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
  const avgRisk =
    items.length > 0 ? items.reduce((sum, item) => sum + item.riskScore, 0) / items.length : 0;
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
      title: 'Total Screened Works',
      value: totalScreened.toLocaleString('en-US'),
      sub: 'All-time processed artworks',
      delta: totalDelta
    },
    {
      title: 'Average Risk Score',
      value: avgRisk.toFixed(1),
      sub: 'Across all screened works',
      delta: avgDelta
    },
    {
      title: 'High Risk Ratio',
      value: `${highRiskRatio.toFixed(1)}%`,
      sub: 'Works with risk score >= 70',
      delta: highDelta
    },
    {
      title: 'This Month Analyses',
      value: monthAnalyses.toLocaleString('en-US'),
      sub: 'Screenings created this month',
      delta: monthDelta
    }
  ];

  return (
    <div className="space-y-6 pb-4">
      <Card className="space-y-3 border-border/70 shadow-none">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Risk Intelligence Dashboard</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Art Risk Intelligence</h1>
        <p className="max-w-lg text-sm text-muted-foreground">
          AI-powered artwork risk screening platform for galleries
        </p>
      </Card>

      <section className="grid grid-cols-2 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="space-y-2 border-border/70 p-4 shadow-none">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{kpi.title}</p>
            <p className="text-2xl font-semibold tabular-nums">{kpi.value}</p>
            <p className="text-xs text-muted-foreground">{kpi.sub}</p>
            <Badge className={kpi.delta.positive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
              {kpi.delta.text} vs last month
            </Badge>
          </Card>
        ))}
      </section>

      <Card className="space-y-4 border-border/70 shadow-none">
        <div>
          <h2 className="text-lg font-semibold">Risk Distribution</h2>
          <p className="text-xs text-muted-foreground">Current distribution of screened works by risk level</p>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Low', value: dist.low, color: 'bg-emerald-500' },
            { label: 'Medium', value: dist.medium, color: 'bg-amber-500' },
            { label: 'High', value: dist.high, color: 'bg-red-500' }
          ].map((row) => {
            const width = pct(row.value, totalScreened);
            return (
              <div key={row.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{row.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {row.value} ({width}%)
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

      <Card className="space-y-3 border-border/70 shadow-none">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold">Recent Cases</h2>
          <Link href="/cases" className="text-xs text-muted-foreground hover:text-foreground">
            View all
          </Link>
        </div>
        {recent.length === 0 && (
          <p className="text-sm text-muted-foreground">No cases yet. Start a new artwork screening.</p>
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
                  <Image src={item.imageUrl} alt="case thumbnail" fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                    No Image
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-medium">{item.category}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
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
          + New Artwork Screening
        </Button>
      </Link>
    </div>
  );
}
