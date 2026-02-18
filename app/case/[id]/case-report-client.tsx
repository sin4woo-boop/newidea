'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@/components/ui';
import { CaseRecord } from '@/lib/types';
import { DISCLAIMER } from '@/lib/disclaimer';
import { normalizeRiskLevel } from '@/lib/risk-level';

type ReportNotes = {
  estimated_title?: string;
  category_guess?: '서화' | '회화' | '도자' | '공예' | '기타';
  one_line_summary?: string;
  key_features?: string[];
  risk_score?: number;
  risk_level?: string;
  risk_reasons?: string[];
  recommended_shots?: string[];
  titleGuess?: string;
  summary?: string;
  visualEvidence?: string[];
};

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

function parseNotes(notes?: string): ReportNotes | null {
  if (!notes) return null;
  try {
    return JSON.parse(notes) as ReportNotes;
  } catch {
    return null;
  }
}

export function CaseReportClient({ data }: { data: CaseRecord }) {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const extraImages = useMemo(() => extractExtraImages(data.tags), [data.tags]);
  const notes = useMemo(() => parseNotes(data.notes), [data.notes]);

  const estimatedTitle = notes?.estimated_title || notes?.titleGuess || '작품명 미상(추정)';
  const oneLineSummary = notes?.one_line_summary || notes?.summary || '이미지 기반 작품 분석 결과입니다.';
  const keyFeatures = (notes?.key_features?.length ? notes.key_features : notes?.visualEvidence ?? []).slice(0, 3);
  const riskScore = Number.isFinite(notes?.risk_score) ? Math.max(0, Math.min(100, Math.round(Number(notes?.risk_score)))) : data.riskScore;
  const riskLevel = normalizeRiskLevel(notes?.risk_level ?? data.riskLevel);
  const riskReasons = (notes?.risk_reasons?.length ? notes.risk_reasons : data.riskReasons).slice(0, 3);
  const recommendedShots = (notes?.recommended_shots ?? []).slice(0, 3);

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
    <div className="space-y-4 pb-4">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Artwork Intelligence</p>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{estimatedTitle}</h1>
        <p className="text-sm text-neutral-600">(추정)</p>
      </header>

      <Card className="space-y-4 border-[#E9E1D3] bg-white p-4 shadow-sm md:p-5">
        <h2 className="text-lg font-semibold text-neutral-900">작품 이미지</h2>
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

      <Card className="space-y-4 border-[#E9E1D3] bg-white p-4 shadow-sm md:p-5">
        <h2 className="text-lg font-semibold text-neutral-900">한 줄 요약</h2>
        <p className="text-sm leading-relaxed text-neutral-800">{oneLineSummary}</p>
        <div className="rounded-xl border border-[#EEE5D8] bg-[#FCFAF6] p-4">
          <p className="mb-1 text-xs uppercase tracking-[0.14em] text-neutral-500">핵심 특징</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
            {keyFeatures.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </Card>

      <Card className="space-y-4 border-[#E9E1D3] bg-white p-4 shadow-sm md:p-5">
        <h2 className="text-lg font-semibold text-neutral-900">리스크 판단</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[#EEE5D8] bg-[#FCFAF6] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">점수</p>
            <p className="mt-1 text-5xl font-bold tabular-nums tracking-tight text-neutral-900">{riskScore}</p>
          </div>
          <div className="rounded-2xl border border-[#EEE5D8] bg-[#FCFAF6] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">레벨</p>
            <p className="mt-3 text-lg font-semibold text-neutral-900">{riskLevel}</p>
          </div>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
          {riskReasons.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3 border-[#E9E1D3] bg-white p-4 shadow-sm md:p-5">
        <h2 className="text-lg font-semibold text-neutral-900">추가 촬영 권장</h2>
        {recommendedShots.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
            {recommendedShots.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-700">현재 촬영본으로 1차 분석은 가능합니다. 필요 시 명문/저부 근접 컷을 추가하세요.</p>
        )}
        <p className="korean-keep border-t border-[#EEE5D8] pt-3 text-xs text-neutral-500">{DISCLAIMER}</p>
      </Card>

      <Card className="space-y-3 border-[#E9E1D3] bg-white p-4 shadow-sm md:p-5">
        <h2 className="text-lg font-semibold text-neutral-900">전문 검토</h2>
        <a href="https://www.seoulauction.com" target="_blank" rel="noreferrer" className="block">
          <Button className="h-14 w-full rounded-2xl bg-[#B89A5D] text-base font-semibold text-white hover:bg-[#A88442]">전문 감정사 검토 요청</Button>
        </a>
        <Link href="/cases" className="block">
          <Button variant="outline" className="h-12 w-full rounded-2xl border-[#E2D8C4] bg-white">
            접수함으로 이동
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
              <Button type="button" className="h-11 rounded-xl bg-red-600 text-white hover:bg-red-700" onClick={onDelete} disabled={deleting}>
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
