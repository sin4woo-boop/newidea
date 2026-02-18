'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Badge, Button, Card } from '@/components/ui';
import { getChecklist } from '@/lib/checklists';
import { scoreRisk } from '@/lib/risk';
import { Category, QualityResult } from '@/lib/types';

const maxSourceFileMB = 30;
const targetMaxEdge = 3200;
const jpegQuality = 0.95;
const maxDetailShots = 3;

type OCRPayload = {
  text?: string;
  confidence?: number;
  blocks?: unknown[];
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
  const bitmap = await createImageBitmap(file);
  const maxEdge = Math.max(bitmap.width, bitmap.height);
  if (maxEdge <= targetMaxEdge && file.size <= 10 * 1024 * 1024) return file;

  const ratio = Math.min(1, targetMaxEdge / maxEdge);
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', jpegQuality));
  if (!blob) return file;

  const nextName = file.name.replace(/\.[^.]+$/, '') || 'upload';
  return new File([blob], `${nextName}.jpg`, { type: 'image/jpeg' });
}

async function runOCR(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/ocr', { method: 'POST', body: formData });
  const bodyText = await res.text();

  let json: OCRPayload = {};
  try {
    json = JSON.parse(bodyText) as OCRPayload;
  } catch {
    throw new Error(bodyText.slice(0, 140) || 'OCR 응답 파싱에 실패했습니다.');
  }

  if (!res.ok) throw new Error((json as { error?: string }).error ?? 'OCR 처리에 실패했습니다.');
  return json;
}

function mergeOCRResults(results: OCRPayload[]) {
  const hanjaRegex = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
  const sourceLines = results
    .flatMap((item) => (item.text ?? '').split(/\n+/))
    .map((line) => line.trim())
    .filter(Boolean);

  const filtered = sourceLines
    .map((line) => {
      const compact = line.replace(/\s+/g, '');
      const hanjaCount = compact.match(hanjaRegex)?.length ?? 0;
      const allowedOnly = compact.replace(/[^\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g, '');
      const ratio = hanjaCount / Math.max(compact.length, 1);
      return { line: allowedOnly, hanjaCount, ratio };
    })
    .filter((item) => item.hanjaCount >= 2 && item.ratio >= 0.45 && item.line.length > 0)
    .sort((a, b) => b.hanjaCount - a.hanjaCount || b.line.length - a.line.length);

  const uniqueLines: string[] = [];
  for (const item of filtered) {
    if (!uniqueLines.some((saved) => saved === item.line || saved.includes(item.line) || item.line.includes(saved))) {
      uniqueLines.push(item.line);
    }
  }

  const text = (uniqueLines.length ? uniqueLines : sourceLines.slice(0, 3)).join('\n').trim();
  const confValues = results
    .map((item) => item.confidence)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const confidence = confValues.length ? confValues.reduce((sum, v) => sum + v, 0) / confValues.length : undefined;
  const blocks = results.flatMap((item) => (Array.isArray(item.blocks) ? item.blocks : []));

  return { text, confidence, blocks };
}

export function NewCaseClient() {
  const router = useRouter();
  const mainFileInputRef = useRef<HTMLInputElement | null>(null);
  const mainCameraInputRef = useRef<HTMLInputElement | null>(null);
  const detailFileInputRef = useRef<HTMLInputElement | null>(null);
  const detailCameraInputRef = useRef<HTMLInputElement | null>(null);

  const [mainOriginalFile, setMainOriginalFile] = useState<File | null>(null);
  const [mainUploadFile, setMainUploadFile] = useState<File | null>(null);
  const [mainPreview, setMainPreview] = useState('');
  const [detailUploadFiles, setDetailUploadFiles] = useState<File[]>([]);
  const [detailPreviews, setDetailPreviews] = useState<string[]>([]);
  const [quality, setQuality] = useState<QualityResult | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [ocrConfidence, setOcrConfidence] = useState<number | undefined>();
  const [blocks, setBlocks] = useState<any[]>([]);
  const [category, setCategory] = useState<Category>('도자');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const checklist = useMemo(() => getChecklist(category), [category]);

  async function onMainFileChange(next: File) {
    if (next.size > maxSourceFileMB * 1024 * 1024) {
      setError(`파일은 ${maxSourceFileMB}MB 이하만 가능합니다.`);
      return;
    }
    setError('');
    const prepared = await prepareImageForUpload(next);
    setMainOriginalFile(next);
    setMainUploadFile(prepared);
    setMainPreview(URL.createObjectURL(next));
    setQuality(await analyzeImage(prepared));
  }

  async function onDetailFilesChange(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError('');

    const room = Math.max(0, maxDetailShots - detailUploadFiles.length);
    if (room === 0) {
      setError(`명문 근접 이미지는 최대 ${maxDetailShots}장까지 등록할 수 있습니다.`);
      return;
    }

    const selected = Array.from(files).slice(0, room);
    const preparedList: File[] = [];
    const previewList: string[] = [];

    for (const file of selected) {
      if (file.size > maxSourceFileMB * 1024 * 1024) continue;
      preparedList.push(await prepareImageForUpload(file));
      previewList.push(URL.createObjectURL(file));
    }

    setDetailUploadFiles((prev) => [...prev, ...preparedList].slice(0, maxDetailShots));
    setDetailPreviews((prev) => [...prev, ...previewList].slice(0, maxDetailShots));
  }

  function removeDetailShot(index: number) {
    setDetailUploadFiles((prev) => prev.filter((_, i) => i !== index));
    setDetailPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function onRunAnalysis() {
    if (!mainUploadFile || !quality) return;
    setLoading(true);
    setError('');
    try {
      const uploadForm = new FormData();
      uploadForm.append('file', mainUploadFile);
      const uploadRes = await fetch('/api/uploads', { method: 'POST', body: uploadForm });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadJson.error ?? '업로드에 실패했습니다.');

      const ocrTargets = [mainUploadFile, ...detailUploadFiles];
      const ocrResults = await Promise.all(ocrTargets.map((file) => runOCR(file)));
      const merged = mergeOCRResults(ocrResults);

      setOcrText(merged.text ?? '');
      setOcrConfidence(merged.confidence);
      setBlocks(merged.blocks ?? []);

      const risk = scoreRisk({ quality, ocrText: merged.text ?? '', ocrConfidence: merged.confidence });
      const id = createCaseId();

      const payload = {
        id,
        createdAt: new Date().toISOString(),
        category,
        imageUrl: uploadJson.imageUrl,
        qualityResult: quality,
        ocrText: merged.text ?? '',
        ocrConfidence: merged.confidence,
        riskScore: risk.score,
        riskLevel: risk.level,
        riskReasons: risk.reasons,
        notes: '',
        tags: []
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

      router.push(`/case/${id}`);
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
          onChange={(e) => setCategory(e.target.value as Category)}
        >
          {['도자', '서화', '회화', '기타'].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>

        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-900">1. 전신 이미지</p>
          <input
            ref={mainFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onMainFileChange(e.target.files[0])}
          />
          <input
            ref={mainCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onMainFileChange(e.target.files[0])}
          />

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              type="button"
              className="h-[52px] rounded-xl border-[#E2D8C4] bg-white"
              onClick={() => mainFileInputRef.current?.click()}
            >
              파일 선택
            </Button>
            <Button
              type="button"
              className="h-[52px] rounded-xl bg-[#B89A5D] text-white hover:bg-[#A88442]"
              onClick={() => mainCameraInputRef.current?.click()}
            >
              카메라 촬영
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-900">2. 명문 근접 이미지 (선택, 최대 3장)</p>
          <input
            ref={detailFileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onDetailFilesChange(e.target.files)}
          />
          <input
            ref={detailCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => onDetailFilesChange(e.target.files)}
          />

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              type="button"
              className="h-[52px] rounded-xl border-[#E2D8C4] bg-white"
              onClick={() => detailFileInputRef.current?.click()}
            >
              근접컷 파일 추가
            </Button>
            <Button
              type="button"
              className="h-[52px] rounded-xl bg-[#B89A5D] text-white hover:bg-[#A88442]"
              onClick={() => detailCameraInputRef.current?.click()}
            >
              근접컷 촬영
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-[#D8C8AA] bg-[#FCFAF6] p-4">
          {!mainPreview && (
            <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-[#EEE5D8] bg-white text-sm text-neutral-500">
              전신 이미지를 먼저 등록해주세요.
            </div>
          )}
          {mainPreview && (
            <div className="overflow-hidden rounded-xl border border-[#E9E1D3] bg-white">
              <Image src={mainPreview} alt="전신 이미지 미리보기" width={1200} height={900} className="h-auto w-full" unoptimized />
            </div>
          )}
        </div>

        {detailPreviews.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {detailPreviews.map((src, idx) => (
              <div key={`${src}-${idx}`} className="relative overflow-hidden rounded-xl border border-[#E9E1D3] bg-white">
                <Image src={src} alt={`명문 근접 ${idx + 1}`} width={360} height={360} className="h-24 w-full object-cover" unoptimized />
                <button
                  type="button"
                  onClick={() => removeDetailShot(idx)}
                  className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
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

      <div className="space-y-2">
        <Button
          className="h-[56px] w-full rounded-2xl bg-[#B89A5D] text-base font-semibold text-white hover:bg-[#A88442]"
          onClick={onRunAnalysis}
          disabled={!mainUploadFile || !quality || loading}
        >
          {loading ? '분석 중...' : 'AI 리스크 분석 시작'}
        </Button>
        <p className="text-center text-sm text-neutral-600">전신/근접 이미지 기반으로 작품 리스크를 자동 분석합니다.</p>
      </div>

      {ocrText && (
        <Card className="space-y-2 border-[#E9E1D3] bg-white p-6 shadow-sm">
          <h2 className="font-medium text-neutral-900">OCR 통합 미리보기</h2>
          <p className="whitespace-pre-wrap text-sm text-neutral-700">{ocrText}</p>
          {ocrConfidence !== undefined && <p className="text-xs text-neutral-500">평균 신뢰도 {(ocrConfidence * 100).toFixed(1)}%</p>}
          <p className="text-xs text-neutral-500">블록 수 {blocks.length}</p>
        </Card>
      )}
    </div>
  );
}
