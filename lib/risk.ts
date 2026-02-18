import { Category, QualityResult, RiskLevel } from './types';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function scoreRisk(input: { quality: QualityResult; ocrText: string; ocrConfidence?: number; category?: Category }) {
  const reasons: string[] = [];
  let score = 15;

  if (input.quality.isLowResolution) {
    score += 12;
    reasons.push('해상도가 낮아 세부 판독 신뢰가 떨어질 수 있습니다.');
  }

  if (input.quality.isBlurry) {
    score += 14;
    reasons.push('초점 흐림이 감지되어 추가 확인이 필요합니다.');
  }

  if (input.quality.isTooDark || input.quality.isTooBright) {
    score += 10;
    reasons.push('밝기 조건이 불안정해 결과 편차가 발생할 수 있습니다.');
  }

  const blurPenalty = clamp((120 - input.quality.blurScore) / 8, 0, 18);
  score += blurPenalty;

  const brightnessPenalty = clamp(Math.abs(input.quality.brightness - 140) / 10, 0, 10);
  score += brightnessPenalty;

  const normalized = input.ocrText.trim();
  const textMissingPenalty = input.category === '회화' ? 10 : 26;
  const textShortPenalty = input.category === '회화' ? 8 : 18;

  if (!normalized) {
    score += textMissingPenalty;
    reasons.push('OCR 텍스트가 제한적이어서 근거 데이터가 부족할 수 있습니다.');
  } else if (normalized.length < 8) {
    score += textShortPenalty;
    reasons.push('인식 텍스트가 매우 짧아 판독 신뢰도가 낮습니다.');
  } else if (normalized.length < 20) {
    score += 9;
  }

  const nonWordRatio = normalized
    ? (normalized.match(/[^\p{L}\p{N}\s]/gu)?.length ?? 0) / normalized.length
    : 0;
  if (nonWordRatio > 0.6) {
    score += 8;
    reasons.push('문자 패턴이 불안정해 오인식 가능성이 있습니다.');
  }

  if (input.ocrConfidence === undefined) {
    score += 6;
  } else if (input.ocrConfidence < 0.45) {
    score += 14;
    reasons.push('OCR 평균 신뢰도가 낮아 수기 검토가 권장됩니다.');
  } else if (input.ocrConfidence < 0.65) {
    score += 8;
  } else if (input.ocrConfidence > 0.85) {
    score -= 6;
  }

  if (/(불명|추정|유사|attrib|possibly)/i.test(normalized)) {
    score += 12;
    reasons.push('불확실성을 시사하는 표현이 포함되어 있습니다.');
  }

  score = clamp(Math.round(score), 0, 100);

  let level: RiskLevel = '낮음';
  if (score >= 70) level = '높음';
  else if (score >= 40) level = '중간';

  if (reasons.length < 2) {
    reasons.push('자동 스크리닝 결과이며 추가 촬영과 전문가 검토가 필요합니다.');
  }

  return { score, level, reasons: reasons.slice(0, 4) };
}
