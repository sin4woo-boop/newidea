'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Badge, Button, Card } from '@/components/ui';
import { CaseRecord } from '@/lib/types';
import { DISCLAIMER } from '@/lib/disclaimer';

function riskTone(score: number) {
  if (score >= 70) return 'bg-[#E9D6D5] text-[#7D3F3B]';
  if (score >= 40) return 'bg-[#F3E8CF] text-[#8A6A33]';
  return 'bg-[#DDE8DF] text-[#486653]';
}

export function CaseReportClient({ data, checklist }: { data: CaseRecord; checklist: string[] }) {
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [checked, setChecked] = useState<boolean[]>(() => checklist.map(() => false));
  const [copied, setCopied] = useState(false);

  const confidenceText =
    data.ocrConfidence !== undefined ? `평균 신뢰도 ${(data.ocrConfidence * 100).toFixed(1)}%` : '평균 신뢰도 없음';

  const blockCount = useMemo(() => {
    const chunks = data.ocrText
      .split(/\n+/)
      .map((t) => t.trim())
      .filter(Boolean);
    return chunks.length;
  }, [data.ocrText]);

  const completedCount = checked.filter(Boolean).length;
  const allDone = checklist.length > 0 && completedCount === checklist.length;

  async function copyOCR() {
    await navigator.clipboard.writeText(data.ocrText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="space-y-8 pb-4">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Risk Intelligence Report</p>
        <h1 className="break-keep text-xl font-semibold tracking-tight text-neutral-900">리스크 인텔리전스 리포트</h1>
      </header>

      <Card className="space-y-4 border-[#E9E1D3] bg-white p-5 shadow-sm">
        <div className="overflow-hidden rounded-2xl border border-[#E9E1D3] bg-[#F3EEE4]">
          {data.imageUrl ? (
            <button type="button" className="relative block aspect-[4/3] w-full" onClick={() => setIsImageOpen(true)}>
              <Image src={data.imageUrl} alt="작품 이미지" fill className="object-cover" unoptimized />
            </button>
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center text-sm text-neutral-500">등록된 이미지가 없습니다.</div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-neutral-600">저장된 작품 이미지</p>
          {data.imageUrl && (
            <a
              href={data.imageUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center rounded-xl border border-[#E2D8C4] bg-white px-3 text-sm text-neutral-700 hover:bg-[#FAF7F1]"
            >
              원본 보기
            </a>
          )}
        </div>
      </Card>

      <Card className="space-y-4 border-[#E9E1D3] bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Risk Summary</p>
            <p className="mt-1 text-5xl font-bold tabular-nums tracking-tight text-neutral-900">{data.riskScore}</p>
          </div>
          <Badge className={riskTone(data.riskScore)}>{data.riskLevel}</Badge>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-neutral-900">핵심 근거</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
            {data.riskReasons.slice(0, 4).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>

        <p className="korean-keep border-t border-[#EEE5D8] pt-3 text-xs text-neutral-500">{DISCLAIMER}</p>
      </Card>

      <Card className="space-y-4 border-[#E9E1D3] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-neutral-900">명문 인식 결과</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-[#F3E8CF] text-[#8A6A33]">{confidenceText}</Badge>
            <Badge className="bg-[#EFE8DA] text-neutral-700">블록 {blockCount}</Badge>
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-lg border-[#E2D8C4] px-3 text-xs"
              onClick={copyOCR}
            >
              {copied ? '복사됨' : '복사'}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E9E1D3] bg-[#FCFAF6] p-4">
          <p className="break-keep whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
            {data.ocrText || '인식된 텍스트가 없습니다.'}
          </p>
        </div>
      </Card>

      <Card className="space-y-4 border-[#E9E1D3] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">촬영 체크리스트</h2>
          <Badge className="bg-[#EFE8DA] text-neutral-700">
            {completedCount}/{checklist.length} 완료
          </Badge>
        </div>
        <div className="space-y-2">
          {checklist.map((item, index) => (
            <label
              key={item}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${
                checked[index] ? 'border-[#D7C6A1] bg-[#FAF5EA]' : 'border-[#E9E1D3] bg-white'
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[#B89A5D]"
                checked={checked[index]}
                onChange={(e) => {
                  const next = [...checked];
                  next[index] = e.target.checked;
                  setChecked(next);
                }}
              />
              <span className={checked[index] ? 'text-neutral-900' : 'text-neutral-700'}>{item}</span>
            </label>
          ))}
        </div>
        {allDone && <p className="text-sm font-medium text-[#7A6433]">체크리스트가 모두 완료되었습니다. 검토 준비가 끝났습니다.</p>}
      </Card>

      <div className="space-y-3">
        <a href="https://www.seoulauction.com" target="_blank" rel="noreferrer" className="block">
          <Button className="h-14 w-full rounded-2xl bg-[#B89A5D] text-base font-semibold text-white hover:bg-[#A88442]">
            전문 감정사 검토 요청
          </Button>
        </a>
        <Link href="/cases" className="block">
          <Button variant="outline" className="h-12 w-full rounded-2xl border-[#E2D8C4] bg-white">
            내 접수함으로 이동
          </Button>
        </Link>
      </div>

      {isImageOpen && data.imageUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 p-4" onClick={() => setIsImageOpen(false)}>
          <div className="mx-auto flex h-full max-w-3xl items-center justify-center">
            <div className="relative h-full max-h-[86vh] w-full">
              <Image src={data.imageUrl} alt="작품 원본 확대" fill className="object-contain" unoptimized />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
