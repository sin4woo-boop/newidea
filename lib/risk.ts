import { QualityResult, RiskLevel } from './types';

export function scoreRisk(input: { quality: QualityResult; ocrText: string }) {
  const reasons: string[] = [];
  let score = 25;

  if (input.quality.status === '재촬영 권장') {
    score += 25;
    reasons.push('촬영 품질이 낮아 판독 신뢰도가 제한됩니다.');
  }

  const normalized = input.ocrText.trim();
  if (!normalized) {
    score += 30;
    reasons.push('OCR 텍스트가 비어 있어 참고 근거가 부족합니다.');
  }

  if (/^[^\p{L}\p{N}]{0,6}$/u.test(normalized)) {
    score += 15;
    reasons.push('문자열이 매우 짧거나 의미 해석이 어렵습니다.');
  }

  if (/(불명|추정|유사|attrib|possibly)/i.test(normalized)) {
    score += 20;
    reasons.push('불확실성을 시사하는 키워드가 포함되어 있습니다.');
  }

  score = Math.max(0, Math.min(100, score));

  let level: RiskLevel = '낮음';
  if (score >= 70) level = '높음';
  else if (score >= 40) level = '중간';

  if (reasons.length < 2) {
    reasons.push('현 단계는 자동 스크리닝 결과로, 추가 촬영과 전문가 검토가 필요합니다.');
  }

  return { score, level, reasons: reasons.slice(0, 4) };
}
