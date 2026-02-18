export const RISK_LEVELS = ['낮음', '중간', '높음', '매우 높음'] as const;

export type NormalizedRiskLevel = (typeof RISK_LEVELS)[number];

export function normalizeRiskLevel(input: unknown): NormalizedRiskLevel {
  const s = String(input ?? '').trim().toLowerCase();

  if (['low', '낮음', '낮은', 'low risk'].includes(s)) return '낮음';
  if (['medium', '중간', '보통', 'normal'].includes(s)) return '중간';
  if (['high', '높음', '높은'].includes(s)) return '높음';
  if (['very high', 'critical', '매우 높음', '매우높음', '위험'].includes(s)) return '매우 높음';

  return '중간';
}