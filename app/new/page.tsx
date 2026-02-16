'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button, Card, Badge } from '@/components/ui';
import { Category, QualityResult } from '@/lib/types';
import { scoreRisk } from '@/lib/risk';
import { getChecklist } from '@/lib/checklists';

const maxFileMB = 8;

function createCaseId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
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
    isBlurry ? '손떨림 방지를 위해 작품과 30cm 이상 거리 확보 후 고정 촬영' : '초점은 비교적 양호합니다.',
    isLowResolution ? '원본 해상도로 촬영하고 디지털 줌을 피하세요.' : '해상도는 기준을 충족합니다.',
    isTooDark || isTooBright
      ? '자연광 또는 확산광에서 그림자/반사광을 줄여 다시 촬영하세요.'
      : '밝기는 적정 수준입니다.'
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

export default function NewCasePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [quality, setQuality] = useState<QualityResult | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [ocrConfidence, setOcrConfidence] = useState<number | undefined>();
  const [blocks, setBlocks] = useState<any[]>([]);
  const [category, setCategory] = useState<Category>('도자');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const checklist = useMemo(() => getChecklist(category), [category]);

  async function onFileChange(next: File) {
    if (next.size > maxFileMB * 1024 * 1024) {
      setError(`파일은 ${maxFileMB}MB 이하만 가능합니다.`);
      return;
    }
    setError('');
    setFile(next);
    setPreview(URL.createObjectURL(next));
    const qualityResult = await analyzeImage(next);
    setQuality(qualityResult);
  }

  async function onRunOCR() {
    if (!file || !quality) return;
    setLoading(true);
    setError('');
    try {
      const uploadForm = new FormData();
      uploadForm.append('file', file);
      const uploadRes = await fetch('/api/uploads', { method: 'POST', body: uploadForm });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadJson.error ?? '업로드 실패');

      const formData = new FormData();
      formData.append('file', file);
      const ocrRes = await fetch('/api/ocr', { method: 'POST', body: formData });
      const ocrJson = await ocrRes.json();
      if (!ocrRes.ok) throw new Error(ocrJson.error ?? 'OCR 실패');

      setOcrText(ocrJson.text ?? '');
      setOcrConfidence(ocrJson.confidence);
      setBlocks(ocrJson.blocks ?? []);

      const risk = scoreRisk({ quality, ocrText: ocrJson.text ?? '' });
      const id = createCaseId();
      const payload = {
        id,
        createdAt: new Date().toISOString(),
        category,
        imageUrl: uploadJson.imageUrl,
        qualityResult: quality,
        ocrText: ocrJson.text ?? '',
        ocrConfidence: ocrJson.confidence,
        riskScore: risk.score,
        riskLevel: risk.level,
        riskReasons: risk.reasons,
        notes: '',
        tags: []
      };
      await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      router.push(`/case/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h1 className="text-lg font-semibold">신규 접수</h1>
        <select className="w-full rounded border p-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
          {['도자', '서화', '회화', '기타'].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFileChange(e.target.files[0])}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFileChange(e.target.files[0])}
        />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} type="button">
            파일 선택
          </Button>
          <Button onClick={() => cameraInputRef.current?.click()} type="button">
            카메라 촬영
          </Button>
        </div>
        {preview && (
          <div className="overflow-hidden rounded-md border">
            <Image src={preview} alt="preview" width={1200} height={800} className="h-auto w-full" unoptimized />
          </div>
        )}
      </Card>

      {quality && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">촬영 품질 체크</h2>
            <Badge>{quality.status}</Badge>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {quality.guides.map((guide) => (
              <li key={guide}>{guide}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">추가 촬영 권장 컷: {checklist.join(', ')}</p>
        </Card>
      )}

      {error && <Card className="border-red-300 text-sm text-red-600">{error}</Card>}

      <Button className="w-full" onClick={onRunOCR} disabled={!file || !quality || loading}>
        {loading ? '처리 중...' : 'OCR 실행'}
      </Button>

      {ocrText && (
        <Card className="space-y-2">
          <h2 className="font-medium">OCR 미리보기</h2>
          <p className="whitespace-pre-wrap text-sm">{ocrText}</p>
          {ocrConfidence !== undefined && <p className="text-xs text-muted-foreground">평균 신뢰도: {(ocrConfidence * 100).toFixed(1)}%</p>}
          <p className="text-xs text-muted-foreground">블록 수: {blocks.length}</p>
        </Card>
      )}
    </div>
  );
}
