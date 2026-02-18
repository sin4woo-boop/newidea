'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Badge, Button, Card } from '@/components/ui';
import { getChecklist } from '@/lib/checklists';
import { Category, QualityResult } from '@/lib/types';

const maxSourceFileMB = 30;
const largeFileWarningMB = 10;
const targetMaxWidth = 3072;
const targetMaxFileBytes = 10 * 1024 * 1024;
const jpegQuality = 0.9;

type AnalysisPayload = {
  estimated_title?: string;
  category_guess?: '서화' | '회화' | '도자' | '공예' | '기타';
  one_line_summary?: string;
  key_features?: string[];
  risk_score?: number;
  risk_level?: '낮음' | '중간' | '높음';
  risk_reasons?: string[];
  recommended_shots?: string[];
};

type ShotSlot = {
  id: string;
  title: string;
  required: boolean;
  ocrTarget: boolean;
  cameraPrimary?: boolean;
};

type LocalShot = {
  original: File;
  upload: File;
  preview: string;
};

function createCaseId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `case-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function getSlotsByCategory(category: Category): ShotSlot[] {
  if (category === '서화') {
    return [
      { id: 'main', title: '전신 이미지', required: true, ocrTarget: false, cameraPrimary: true },
      { id: 'inscription_main', title: '명문 근접 (선택)', required: false, ocrTarget: true },
      { id: 'inscription_sub', title: '명문 근접 (추가)', required: false, ocrTarget: true }
    ];
  }
  if (category === '회화') {
    return [
      { id: 'main', title: '전신 이미지', required: true, ocrTarget: false, cameraPrimary: true },
      { id: 'seal', title: '서명/낙관 근접 (선택)', required: false, ocrTarget: true }
    ];
  }
  if (category === '도자') {
    return [
      { id: 'main', title: '전신 이미지', required: true, ocrTarget: false, cameraPrimary: true },
      { id: 'base_mark', title: '저부/바닥 명문 근접', required: true, ocrTarget: true },
      { id: 'damage_detail', title: '구연/손상 부위 근접', required: true, ocrTarget: false }
    ];
  }
  return [
    { id: 'main', title: '전신 이미지', required: true, ocrTarget: false, cameraPrimary: true },
    { id: 'detail', title: '근접 이미지 (선택)', required: false, ocrTarget: true }
  ];
}

async function analyzeImage(file: File): Promise<QualityResult> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bitmap, 0, 0);

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let brightnessSum = 0;
  const gray = new Float32Array(canvas.width * canvas.height);

  for (let i = 0; i < data.length; i += 4) {
    const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[i / 4] = y;
    brightnessSum += y;
  }
  const brightness = brightnessSum / gray.length;

  let lapVariance = 0;
  let lapSum = 0;
  const w = canvas.width;
  const h = canvas.height;
  const lapValues: number[] = [];

  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const i = y * w + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      lapValues.push(lap);
      lapSum += lap;
    }
  }

  const mean = lapSum / Math.max(1, lapValues.length);
  for (const v of lapValues) lapVariance += (v - mean) ** 2;
  const blurScore = lapVariance / Math.max(1, lapValues.length);

  const isLowResolution = w < 1200 || h < 1200;
  const isTooDark = brightness < 60;
  const isTooBright = brightness > 210;
  const isBlurry = blurScore < 100;
  const status = isLowResolution || isTooDark || isTooBright || isBlurry ? '재촬영 권장' : 'OK';

  const guides = [
    isBlurry ? '흔들림 방지를 위해 작품과 거리를 두고 고정 촬영해주세요.' : '초점은 비교적 양호합니다.',
    isLowResolution ? '원본 해상도로 촬영하고 확대/캡처는 지양해주세요.' : '해상도는 기준을 충족합니다.',
    isTooDark || isTooBright ? '과한 명암을 피하고 균일한 조명에서 다시 촬영해주세요.' : '밝기는 적정 수준입니다.'
  ];

  return {
    width: w,
    height: h,
    brightness,
    blurScore,
    isLowResolution,
    isTooDark,
    isTooBright,
    isBlurry,
    status,
    guides
  };
}

async function prepareImageForUpload(file: File): Promise<File> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('이미지 로드에 실패했습니다.'));
      img.src = sourceUrl;
    });

    const initialRatio = image.width > targetMaxWidth ? targetMaxWidth / image.width : 1;
    const width = Math.max(1, Math.round(image.width * initialRatio));
    const height = Math.max(1, Math.round(image.height * initialRatio));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', jpegQuality));
    if (!blob) throw new Error('이미지 압축에 실패했습니다.');

    if (blob.size > targetMaxFileBytes) {
      throw new Error('이미지 용량이 너무 큽니다. 고화질을 유지하며 용량을 줄여주세요');
    }

    const nextName = file.name.replace(/\.[^.]+$/, '') || 'upload';
    return new File([blob], `${nextName}.jpg`, { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

async function runArtworkAnalysis(category: Category, shots: Array<{ slot: string; file: File }>) {
  const formData = new FormData();
  formData.append('category', category);
  for (const shot of shots) formData.append(`shot:${shot.slot}`, shot.file);

  const res = await fetch('/api/analyze-artwork', { method: 'POST', body: formData });
  const bodyText = await res.text();

  let json: AnalysisPayload = {};
  try {
    json = JSON.parse(bodyText) as AnalysisPayload;
  } catch {
    throw new Error(bodyText.slice(0, 160) || 'AI 분석 응답 파싱에 실패했습니다.');
  }

  if (!res.ok) throw new Error((json as { error?: string }).error ?? 'AI 분석에 실패했습니다.');
  return json;
}

export function NewCaseClient() {
  const router = useRouter();
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const cameraRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [category, setCategory] = useState<Category>('도자');
  const [shots, setShots] = useState<Record<string, LocalShot | null>>({});
  const [quality, setQuality] = useState<QualityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [compressionNotice, setCompressionNotice] = useState('');

  const slots = useMemo(() => getSlotsByCategory(category), [category]);
  const checklist = useMemo(() => getChecklist(category), [category]);

  async function onSelectShot(slotId: string, file: File) {
    if (file.size > maxSourceFileMB * 1024 * 1024) {
      setError(`파일은 ${maxSourceFileMB}MB 이하만 가능합니다.`);
      return;
    }
    setError('');
    setCompressionNotice(file.size > largeFileWarningMB * 1024 * 1024 ? '이미지 용량이 너무 큽니다. 자동 압축 중...' : '');
    try {
      const prepared = await prepareImageForUpload(file);
      const preview = URL.createObjectURL(file);
      setShots((prev) => ({ ...prev, [slotId]: { original: file, upload: prepared, preview } }));

      if (slotId === 'main') {
        setQuality(await analyzeImage(prepared));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 처리에 실패했습니다.');
    }
  }

  function removeShot(slotId: string) {
    setShots((prev) => ({ ...prev, [slotId]: null }));
  }

  async function onRunAnalysis() {
    const mainShot = shots.main;
    if (!mainShot || !quality) return;

    const missing = slots.filter((slot) => slot.required && !shots[slot.id]);
    if (missing.length > 0) {
      setError(`필수 촬영 컷이 부족합니다: ${missing.map((m) => m.title).join(', ')}`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const uploadMainForm = new FormData();
      uploadMainForm.append('file', mainShot.upload);
      const mainUploadRes = await fetch('/api/uploads', { method: 'POST', body: uploadMainForm });
      const mainUploadJson = await mainUploadRes.json();
      if (!mainUploadRes.ok) throw new Error(mainUploadJson.error ?? '대표 이미지 업로드에 실패했습니다.');

      const detailImageTags: string[] = [];
      for (const slot of slots.filter((s) => s.id !== 'main')) {
        const shot = shots[slot.id];
        if (!shot) continue;
        const form = new FormData();
        form.append('file', shot.upload);
        const res = await fetch('/api/uploads', { method: 'POST', body: form });
        const json = await res.json();
        if (res.ok && json.imageUrl) detailImageTags.push(`slot:${slot.id}:${json.imageUrl}`);
      }

      const analysisShots = slots
        .map((slot) => ({ slot: slot.id, file: shots[slot.id]?.upload }))
        .filter((v): v is { slot: string; file: File } => Boolean(v.file));
      const analysis = await runArtworkAnalysis(category, analysisShots);

      const payload = {
        id: createCaseId(),
        createdAt: new Date().toISOString(),
        category,
        imageUrl: mainUploadJson.imageUrl,
        qualityResult: quality,
        ocrText: '',
        ocrConfidence: undefined,
        riskScore: Number.isFinite(analysis.risk_score) ? Math.max(0, Math.min(100, Math.round(analysis.risk_score ?? 0))) : 50,
        riskLevel: (analysis.risk_level ?? '중간') as '낮음' | '중간' | '높음',
        riskReasons: (analysis.risk_reasons ?? ['AI 분석 근거가 제한적입니다.']).slice(0, 3),
        notes: JSON.stringify({
          estimated_title: analysis.estimated_title ?? '',
          category_guess: analysis.category_guess ?? category,
          one_line_summary: analysis.one_line_summary ?? '',
          key_features: analysis.key_features ?? [],
          risk_score: analysis.risk_score ?? undefined,
          risk_level: analysis.risk_level ?? undefined,
          risk_reasons: analysis.risk_reasons ?? [],
          recommended_shots: analysis.recommended_shots ?? []
        }),
        tags: detailImageTags
      };

      const saveRes = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!saveRes.ok) {
        const saveJson = await saveRes.json();
        throw new Error(saveJson.error ?? '케이스 저장에 실패했습니다.');
      }

      router.push(`/case/${payload.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4 border-[#E9E1D3] bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">AI 리스크 분석</h1>

        <select
          className="w-full rounded-xl border border-[#E9E1D3] bg-white p-3 text-sm"
          value={category}
          onChange={(e) => {
            const next = e.target.value as Category;
            setCategory(next);
            setShots({});
            setQuality(null);
          }}
        >
          {['도자', '서화', '회화', '기타'].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>

        {slots.map((slot) => {
          const shot = shots[slot.id];
          return (
            <div key={slot.id} className="space-y-2 rounded-2xl border border-[#E9E1D3] bg-[#FCFAF6] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-neutral-900">
                  {slot.title} {slot.required ? '(필수)' : '(선택)'}
                </p>
                {shot && (
                  <button type="button" className="text-xs text-neutral-500 hover:text-neutral-700" onClick={() => removeShot(slot.id)}>
                    제거
                  </button>
                )}
              </div>

              <input
                ref={(el) => {
                  inputRefs.current[slot.id] = el;
                }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onSelectShot(slot.id, e.target.files[0])}
              />
              <input
                ref={(el) => {
                  cameraRefs.current[slot.id] = el;
                }}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onSelectShot(slot.id, e.target.files[0])}
              />

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  type="button"
                  className="h-[52px] rounded-xl border-[#E2D8C4] bg-white"
                  onClick={() => inputRefs.current[slot.id]?.click()}
                >
                  파일 선택
                </Button>
                <Button
                  type="button"
                  className="h-[52px] rounded-xl bg-[#B89A5D] text-white hover:bg-[#A88442]"
                  onClick={() => cameraRefs.current[slot.id]?.click()}
                >
                  카메라 촬영
                </Button>
              </div>

              <div className="rounded-xl border border-dashed border-[#D8C8AA] bg-white p-2">
                {!shot && <div className="flex h-24 items-center justify-center text-sm text-neutral-500">아직 이미지가 없습니다.</div>}
                {shot && (
                  <Image src={shot.preview} alt={`${slot.title} 미리보기`} width={1200} height={900} className="h-24 w-full rounded-lg object-cover" unoptimized />
                )}
              </div>
            </div>
          );
        })}
      </Card>

      {quality && (
        <Card className="space-y-3 border-[#E9E1D3] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-neutral-900">촬영 품질 체크</h2>
            <Badge>{quality.status}</Badge>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-600">
            {quality.guides.map((guide) => (
              <li key={guide}>{guide}</li>
            ))}
          </ul>
          <p className="text-xs text-neutral-500">추가 촬영 권장 컷: {checklist.join(', ')}</p>
        </Card>
      )}

      {error && <Card className="border-red-200 bg-white p-4 text-sm text-red-700 shadow-sm">{error}</Card>}
      {compressionNotice && <Card className="border-amber-200 bg-white p-4 text-sm text-amber-700 shadow-sm">{compressionNotice}</Card>}

      <div className="space-y-2">
        <Button
          className="h-[56px] w-full rounded-2xl bg-[#B89A5D] text-base font-semibold text-white hover:bg-[#A88442]"
          onClick={onRunAnalysis}
          disabled={!shots.main || !quality || loading}
        >
          {loading ? '분석 중...' : 'AI 리스크 분석 시작'}
        </Button>
        <p className="text-center text-sm text-neutral-600">카테고리별 촬영 컷을 기반으로 리스크를 자동 분석합니다.</p>
      </div>
    </div>
  );
}
