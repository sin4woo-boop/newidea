import sharp from 'sharp';
import { GoogleGenerativeAI } from '@google/generative-ai';

type AnalyzeInput = {
  category: string;
  shots: Array<{ slot: string; buffer: Buffer }>;
};

type CategoryGuess = '?쒗솕' | '?뚰솕' | '?꾩옄' | '怨듭삁' | '湲고?';
type RiskLevel = '??쓬' | '以묎컙' | '?믪쓬';

type AnalyzeOutput = {
  estimated_title: string;
  category_guess: CategoryGuess;
  one_line_summary: string;
  key_features: string[];
  risk_score: number;
  risk_level: RiskLevel;
  risk_reasons: string[];
  recommended_shots: string[];
};

function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key missing. Set GEMINI_API_KEY in environment variables.');
  }
  const model = process.env.GEMINI_OCR_MODEL || 'gemini-3-flash';
  return { apiKey, model };
}

function stripCodeFence(input: string) {
  return input.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

async function detectMimeType(buffer: Buffer) {
  try {
    const format = (await sharp(buffer).metadata()).format;
    if (format === 'png') return 'image/png';
    if (format === 'webp') return 'image/webp';
    return 'image/jpeg';
  } catch {
    return 'image/jpeg';
  }
}

function toCategoryGuess(raw: unknown, fallback: string): CategoryGuess {
  const value = String(raw ?? '').trim();
  if (value === '?쒗솕' || value === '?뚰솕' || value === '?꾩옄' || value === '怨듭삁' || value === '湲고?') return value;
  if (fallback === '?쒗솕' || fallback === '?뚰솕' || fallback === '?꾩옄' || fallback === '怨듭삁') return fallback;
  return '湲고?';
}

function toRiskLevel(raw: unknown): RiskLevel {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === '??쓬' || value === '以묎컙' || value === '?믪쓬') return value as RiskLevel;
  if (value.includes('very high') || value.includes('critical') || value.includes('매우 높음')) return '?믪쓬';
  if (value.includes('high') || value.includes('높음')) return '?믪쓬';
  if (value.includes('medium') || value.includes('보통') || value.includes('중간')) return '以묎컙';
  return '??쓬';
}

function toStringList(raw: unknown, max = 3) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, max);
}

function toSafeScore(raw: unknown, fallback = 50) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function buildPrompt(category: string) {
  return [
    '# 역할: 고미술(회화, 서화, 도자) 리스크 지능형 분석 전문가',
    '',
    '# 감정 전략:',
    '1. 촬영 환경 무시: 이미지의 격자무늬(Moire), 픽셀 노이즈, 조명 반사는 디지털 재현 흔적으로 보고 분석에서 배제한다.',
    '2. 카테고리별 핵심 지표:',
    '   - 회화/서화: 필선 숙련도, 준법, 묵법, 제발(한자) 해독 기반 작가 데이터 대조.',
    '   - 도자: 기형 비례, 유색 깊이, 빙렬 자연스러움, 굽 태토 분석.',
    '3. 확률적 작가 추론: 단정 결론 대신 후보군과 확률(Confidence Score) 제시.',
    '',
    '# 입력 카테고리 힌트',
    `- ${category}`,
    '',
    '# 출력 규칙',
    '- 반드시 JSON만 출력한다.',
    '- 마크다운 코드펜스 사용 금지.',
    '- 숫자 필드는 0~100 범위를 지킨다.',
    '',
    '# 출력 스키마',
    '{',
    '  "category": "회화 | 서화 | 도자",',
    '  "detected_writer": {',
    '    "primary": { "name": "작가명", "confidence": 0, "reason": "화풍/제발 근거" },',
    '    "alternatives": [{ "name": "작가명", "probability": 0, "reason": "유사성 설명" }]',
    '  },',
    '  "risk_analysis": {',
    '    "score": 0,',
    '    "level": "낮음 | 보통 | 높음 | 매우 높음",',
    '    "factors": ["리스크 요인 1", "리스크 요인 2"]',
    '  },',
    '  "expert_comment": "노이즈 너머로 보이는 작품 완성도 총평"',
    '}'
  ].join('\n');
}

function getPrimarySummary(parsed: any) {
  const primaryName = String(parsed?.detected_writer?.primary?.name ?? '').trim();
  const primaryReason = String(parsed?.detected_writer?.primary?.reason ?? '').trim();
  const primaryConfidence = toSafeScore(parsed?.detected_writer?.primary?.confidence, 0);

  if (!primaryName) return '';
  const confidenceText = primaryConfidence > 0 ? ` (${primaryConfidence}%)` : '';
  return primaryReason ? `${primaryName}${confidenceText} - ${primaryReason}` : `${primaryName}${confidenceText}`;
}

export async function analyzeArtworkWithGemini(input: AnalyzeInput): Promise<AnalyzeOutput> {
  if (input.shots.length === 0) throw new Error('No images provided for analysis.');

  const { apiKey, model } = getGeminiConfig();
  const client = new GoogleGenerativeAI(apiKey);
  const geminiModel = client.getGenerativeModel({ model });

  type GeminiPart =
    | { text: string }
    | {
        inlineData: {
          data: string;
          mimeType: string;
        };
      };

  const contentParts: GeminiPart[] = [{ text: buildPrompt(input.category) }];

  for (const shot of input.shots) {
    const mimeType = await detectMimeType(shot.buffer);
    if (shot.slot) {
      contentParts.push({ text: `첨부 이미지: ${shot.slot}` });
    }
    contentParts.push({
      inlineData: {
        data: shot.buffer.toString('base64'),
        mimeType
      }
    });
  }

  const result = await geminiModel.generateContent({
    contents: [{ role: 'user', parts: contentParts }],
    generationConfig: {
      responseMimeType: 'application/json'
    }
  } as any);

  const rawText = result.response.text();
  const parsed = JSON.parse(stripCodeFence(rawText));

  const riskFactors = toStringList(parsed?.risk_analysis?.factors ?? parsed?.risk_reasons, 3);
  const primarySummary = getPrimarySummary(parsed);
  const alternatives = toStringList(
    Array.isArray(parsed?.detected_writer?.alternatives)
      ? parsed.detected_writer.alternatives.map((item: any) => {
          const name = String(item?.name ?? '').trim();
          const prob = toSafeScore(item?.probability, 0);
          const reason = String(item?.reason ?? '').trim();
          if (!name) return '';
          const withProb = prob > 0 ? `${name} (${prob}%)` : name;
          return reason ? `${withProb} - ${reason}` : withProb;
        })
      : [],
    2
  );

  return {
    estimated_title: String(parsed?.detected_writer?.primary?.name ?? parsed?.estimated_title ?? '?묓뭹紐?誘몄긽(異붿젙)'),
    category_guess: toCategoryGuess(parsed?.category ?? parsed?.category_guess, input.category),
    one_line_summary: String(parsed?.expert_comment ?? parsed?.one_line_summary ?? ''),
    key_features: toStringList([primarySummary, ...alternatives], 3),
    risk_score: toSafeScore(parsed?.risk_analysis?.score ?? parsed?.risk_score, 50),
    risk_level: toRiskLevel(parsed?.risk_analysis?.level ?? parsed?.risk_level),
    risk_reasons: riskFactors.length > 0 ? riskFactors : ['AI 분석 근거가 제한적입니다.'],
    recommended_shots: toStringList(parsed?.recommended_shots, 3)
  };
}
