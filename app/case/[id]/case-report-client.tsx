'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card } from '@/components/ui';
import { CaseRecord } from '@/lib/types';
import { DISCLAIMER } from '@/lib/disclaimer';

function riskTone(score: number) {
  if (score >= 70) return 'bg-[#E9D6D5] text-[#7D3F3B]';
  if (score >= 40) return 'bg-[#F3E8CF] text-[#8A6A33]';
  return 'bg-[#DDE8DF] text-[#486653]';
}

function coverageLabel(data: CaseRecord, extraImageCount: number) {
  const score =
    (data.imageUrl ? 1 : 0) +
    Math.min(extraImageCount, 2) +
    (data.ocrText.trim().length >= 12 ? 1 : 0) +
    ((data.ocrConfidence ?? 0) >= 0.55 ? 1 : 0);
  if (score >= 4) return { level: 'High', text: '촬영 커버리지가 충분하며 분석 근거가 안정적입니다.' };
  if (score >= 2) return { level: 'Medium', text: '기본 커버리지는 확보되었으나 근접 명문 컷 보강이 유효합니다.' };
  return { level: 'Low', text: '데이터 포인트가 부족해 리스크 추정 신뢰도가 낮을 수 있습니다.' };
}

function extractExtraImages(tags: string[]) {
  return tags
    .map((tag) => {
      if (tag.startsWith('detail-image:')) return tag.replace('detail-image:', '');
      if (tag.startsWith('slot:')) {
        const parts = tag.split(':');
        return parts.length >= 3 ? parts.slice(2).join(':') : '';
      }
      return '';
    })
    .filter(Boolean);
}

function parseNotes(notes?: string) {
  if (!notes) return null;
  try {
    return JSON.parse(notes) as {
      titleGuess?: string;
      summary?: string;
      visualEvidence?: string[];
      ocrEvidence?: string[];
      consistencyEvidence?: string[];
      coverageInsight?: string;
      aiConfidence?: number;
      dataPoints?: number;
    };
  } catch {
    return null;
  }
}

export function CaseReportClient({ data }: { data: CaseRecord }) {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const extraImages = useMemo(() => extractExtraImages(data.tags), [data.tags]);
  const notes = useMemo(() => parseNotes(data.notes), [data.notes]);

  const aiConfidencePct =
    notes?.aiConfidence !== undefined
      ? Math.round(notes.aiConfidence * 100)
      : data.ocrConfidence !== undefined
      ? Math.round(((data.ocrConfidence + Math.min(1, data.ocrText.length / 40)) / 2) * 100)
      : undefined;
  const dataPoints = notes?.dataPoints ?? 1 + extraImages.length + (data.ocrText.trim() ? 1 : 0) + (data.riskReasons.length || 0);

  const visualEvidence =
    notes?.visualEvidence && notes.visualEvidence.length > 0
      ? notes.visualEvidence
      : [
          data.qualityResult.isBlurry
            ? '초점 흐림 요소가 확인되어 세부 획 판독 신뢰가 제한됩니다.'
            : '초점과 해상도가 기준을 충족해 시각적 판독 조건이 양호합니다.'
        ];
  const ocrEvidence =
    notes?.ocrEvidence && notes.ocrEvidence.length > 0
      ? notes.ocrEvidence
      : [data.ocrText.trim().length >= 12 ? 'OCR 텍스트가 확보되었습니다.' : 'OCR 텍스트가 제한적입니다.'];
  const consistencyEvidence =
    notes?.consistencyEvidence && notes.consistencyEvidence.length > 0
      ? notes.consistencyEvidence
      : [data.riskScore >= 70 ? '고위험 신호가 일관됩니다.' : '중저위험 신호가 우세합니다.'];
  const coverage = { level: coverageLabel(data, extraImages.length).level, text: notes?.coverageInsight || coverageLabel(data, extraImages.length).text };

  async function copyOCR() {
    await navigator.clipboard.writeText(data.ocrText || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  async function onDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/cases/${data.id}`, { method: 'DELETE' });
      if (!res.ok) {
        alert('삭제에 실패했습니다.');
        return;
      }
      router.push('/cases?deleted=1');
    } finally {
      setDeleting(false);
      setConfirmDeleteOpen(false);
    }
  }

  return (
    <div className="space-y-8 pb-4">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Risk Intelligence Report</p>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">{notes?.titleGuess || 'HERITAI Risk Intelligence Summary'}</h1>
        {notes?.summary && <p className="text-sm text-neutral-600">{notes.summary}</p>}
      </header>

      <Card className="space-y-5 border-[#E9E1D3] bg-white p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[#EEE5D8] bg-[#FCFAF6] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">Risk Score</p>
            <p className="mt-1 text-5xl font-bold tabular-nums tracking-tight text-neutral-900">{data.riskScore}</p>
          </div>
          <div className="rounded-2xl border border-[#EEE5D8] bg-[#FCFAF6] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">Risk Level</p>
            <div className="mt-3">
              <Badge className={`rounded-full px-3 py-1 text-sm ${riskTone(data.riskScore)}`}>{data.riskLevel}</Badge>
            </div>
          </div>
          <div className="rounded-2xl border border-[#EEE5D8] bg-[#FCFAF6] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">AI Confidence</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900">{aiConfidencePct !== undefined ? `${aiConfidencePct}%` : 'N/A'}</p>
          </div>
          <div className="rounded-2xl border border-[#EEE5D8] bg-[#FCFAF6] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">Data Points</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900">{dataPoints}</p>
          </div>
        </div>
        <p className="korean-keep border-t border-[#EEE5D8] pt-3 text-xs text-neutral-500">{DISCLAIMER}</p>
      </Card>

      <Card className="space-y-4 border-[#E9E1D3] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">대표 이미지 + 추가 이미지 갤러리</h2>
        <div className="overflow-hidden rounded-2xl border border-[#E9E1D3] bg-[#F3EEE4]">
          {data.imageUrl ? (
            <button type="button" className="relative block aspect-[4/3] w-full" onClick={() => setSelectedImage(data.imageUrl ?? null)}>
              <Image src={data.imageUrl} alt="대표 이미지" fill className="object-cover" unoptimized />
            </button>
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center text-sm text-neutral-500">대표 이미지가 없습니다.</div>
          )}
        </div>
        {extraImages.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {extraImages.map((src, idx) => (
              <button
                key={`${src}-${idx}`}
                type="button"
                className="relative overflow-hidden rounded-xl border border-[#E9E1D3] bg-[#F3EEE4]"
                onClick={() => setSelectedImage(src)}
              >
                <Image src={src} alt={`추가 이미지 ${idx + 1}`} width={360} height={240} className="h-20 w-full object-cover" unoptimized />
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-4 border-[#E9E1D3] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">AI 분석 근거 (Visual / OCR / Consistency)</h2>
          <Button type="button" variant="outline" className="h-9 rounded-lg border-[#E2D8C4] px-3 text-xs" onClick={copyOCR}>
            {copied ? '복사됨' : 'OCR 복사'}
          </Button>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-[#EEE5D8] bg-[#FCFAF6] p-4">
            <p className="mb-1 text-xs uppercase tracking-[0.14em] text-neutral-500">Visual</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
              {visualEvidence.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-[#EEE5D8] bg-[#FCFAF6] p-4">
            <p className="mb-1 text-xs uppercase tracking-[0.14em] text-neutral-500">OCR</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
              {ocrEvidence.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-2 break-keep whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
              {data.ocrText || '인식된 텍스트가 없습니다.'}
            </p>
          </div>
          <div className="rounded-xl border border-[#EEE5D8] bg-[#FCFAF6] p-4">
            <p className="mb-1 text-xs uppercase tracking-[0.14em] text-neutral-500">Consistency</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
              {consistencyEvidence.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card className="space-y-3 border-[#E9E1D3] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">촬영 커버리지 인사이트</h2>
        <div className="flex items-center gap-2">
          <Badge className="bg-[#EFE8DA] text-neutral-700">{coverage.level}</Badge>
          <p className="text-sm text-neutral-700">{coverage.text}</p>
        </div>
      </Card>

      <Card className="space-y-3 border-[#E9E1D3] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">작업</h2>
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
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full rounded-2xl border-red-200 bg-white text-red-600 hover:bg-red-50"
          onClick={() => setConfirmDeleteOpen(true)}
        >
          기록 삭제
        </Button>
      </Card>

      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 p-4" onClick={() => setConfirmDeleteOpen(false)}>
          <div
            className="mx-auto mt-[24vh] w-full max-w-sm rounded-2xl border border-[#E9E1D3] bg-white p-5 shadow-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-neutral-900">이 분석 기록을 삭제할까요?</h3>
            <p className="mt-2 text-sm text-neutral-600">삭제하면 복구할 수 없습니다.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                type="button"
                className="h-11 rounded-xl bg-red-600 text-white hover:bg-red-700"
                onClick={onDelete}
                disabled={deleting}
              >
                {deleting ? '삭제 중...' : '삭제'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl border-[#E2D8C4] bg-white"
                onClick={() => setConfirmDeleteOpen(false)}
              >
                취소
              </Button>
            </div>
          </div>
        </div>
      )}

      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/70 p-4" onClick={() => setSelectedImage(null)}>
          <div className="mx-auto flex h-full max-w-3xl items-center justify-center">
            <div className="relative h-full max-h-[86vh] w-full">
              <Image src={selectedImage} alt="이미지 확대 보기" fill className="object-contain" unoptimized />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
