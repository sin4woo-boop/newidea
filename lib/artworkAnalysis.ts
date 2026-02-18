import sharp from 'sharp';
import { GoogleGenerativeAI } from '@google/generative-ai';

type AnalyzeInput = {
  category: string;
  shots: Array<{ slot: string; buffer: Buffer }>;
};

type CategoryGuess = '서화' | '회화' | '도자' | '공예' | '기타';
type RiskLevel = '낮음' | '중간' | '높음';

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
  if (value === '서화' || value === '회화' || value === '도자' || value === '공예' || value === '기타') return value;
  if (fallback === '서화' || fallback === '회화' || fallback === '도자' || fallback === '공예') return fallback;
  return '기타';
}

function toRiskLevel(raw: unknown): RiskLevel {
  const value = String(raw ?? '').trim();
  if (value === '낮음' || value === '중간' || value === '높음') return value;
  if (value.toLowerCase().includes('high')) return '높음';
  if (value.toLowerCase().includes('medium')) return '중간';
  return '낮음';
}

function toStringList(raw: unknown, max = 3) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, max);
}

function buildPrompt(category: string) {
  return [
    "너는 갤러리용 '작품 리스크 인텔리전스' 분석기다.",
    '반드시 한국어로만 답하고 영어를 절대 쓰지 마라.',
    '장황하게 쓰지 말고, 아래 JSON 형식으로만 출력하라.',
    '추정/가정은 (추정)으로 표시하라.',
    `카테고리 힌트: ${category}`,
    '',
    '[출력 JSON 스키마]',
    '{',
    '  "estimated_title": "작품 제목 또는 작품명(추정)",',
    '  "category_guess": "서화|회화|도자|공예|기타",',
    '  "one_line_summary": "한 줄 요약",',
    '  "key_features": ["핵심 특징1","특징2","특징3"],',
    '  "risk_score": 0,',
    '  "risk_level": "낮음|중간|높음",',
    '  "risk_reasons": ["근거1","근거2","근거3"],',
    '  "recommended_shots": ["추가 촬영 권장1","권장2"]',
    '}',
    '',
    '[규칙]',
    '- risk_score는 0~100 정수',
    '- key_features, risk_reasons, recommended_shots는 각각 최대 3개',
    '- JSON 외 텍스트 출력 금지'
  ].join('\n');
}

export async function analyzeArtworkWithGemini(input: AnalyzeInput): Promise<AnalyzeOutput> {
  if (input.shots.length === 0) throw new Error('No images provided for analysis.');

  const { apiKey, model } = getGeminiConfig();
  const client = new GoogleGenerativeAI(apiKey);
  const geminiModel = client.getGenerativeModel({ model });

  const contentParts: Array<
    | string
    | {
        inlineData: {
          data: string;
          mimeType: string;
        };
      }
  > = [buildPrompt(input.category)];

  for (const shot of input.shots) {
    const mimeType = await detectMimeType(shot.buffer);
    contentParts.push(`이미지 슬롯: ${shot.slot}`);
    contentParts.push({
      inlineData: {
        data: shot.buffer.toString('base64'),
        mimeType
      }
    });
  }

  const result = await geminiModel.generateContent(contentParts);
  const rawText = result.response.text();
  const parsed = JSON.parse(stripCodeFence(rawText));

  return {
    estimated_title: String(parsed.estimated_title ?? parsed.titleGuess ?? '작품명 미상(추정)'),
    category_guess: toCategoryGuess(parsed.category_guess, input.category),
    one_line_summary: String(parsed.one_line_summary ?? parsed.summary ?? ''),
    key_features: toStringList(parsed.key_features ?? parsed.visualEvidence, 3),
    risk_score: Number.isFinite(parsed.risk_score)
      ? Math.max(0, Math.min(100, Math.round(Number(parsed.risk_score))))
      : Number.isFinite(parsed.riskScore)
      ? Math.max(0, Math.min(100, Math.round(Number(parsed.riskScore))))
      : 50,
    risk_level: toRiskLevel(parsed.risk_level ?? parsed.riskLevel),
    risk_reasons: toStringList(parsed.risk_reasons ?? parsed.riskReasons, 3),
    recommended_shots: toStringList(parsed.recommended_shots, 3)
  };
}
