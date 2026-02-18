import sharp from 'sharp';

type AnalyzeInput = {
  category: string;
  shots: Array<{ slot: string; buffer: Buffer }>;
};

type AnalyzeOutput = {
  titleGuess: string;
  summary: string;
  visualEvidence: string[];
  ocrEvidence: string[];
  consistencyEvidence: string[];
  coverageInsight: string;
  ocrText: string;
  aiConfidence: number;
  riskScore: number;
  riskLevel: '낮음' | '중간' | '높음';
  riskReasons: string[];
  dataPoints: number;
};

function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key missing. Set GEMINI_API_KEY in environment variables.');
  }
  const model = process.env.GEMINI_OCR_MODEL || 'gemini-2.5-flash-lite';
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

function parseLevel(raw: string): '낮음' | '중간' | '높음' {
  if (raw === '높음' || raw === '중간' || raw === '낮음') return raw;
  if (raw.toLowerCase().includes('high')) return '높음';
  if (raw.toLowerCase().includes('medium')) return '중간';
  return '낮음';
}

export async function analyzeArtworkWithGemini(input: AnalyzeInput): Promise<AnalyzeOutput> {
  const { apiKey, model } = getGeminiConfig();
  if (input.shots.length === 0) throw new Error('No images provided for analysis.');

  const prompt = [
    'You are an art-risk analyst for a gallery SaaS.',
    'Analyze all provided images of the same artwork.',
    `Category hint: ${input.category}`,
    'Return STRICT JSON only with keys:',
    '{',
    '  "titleGuess": string,',
    '  "summary": string,',
    '  "visualEvidence": string[],',
    '  "ocrEvidence": string[],',
    '  "consistencyEvidence": string[],',
    '  "coverageInsight": string,',
    '  "ocrText": string,',
    '  "aiConfidence": number (0..1),',
    '  "riskScore": number (0..100),',
    '  "riskLevel": "낮음" | "중간" | "높음",',
    '  "riskReasons": string[],',
    '  "dataPoints": number',
    '}',
    'Rules:',
    '- Be concise and evidence-based.',
    '- ocrText should focus on inscription text if available.',
    '- If inscription unreadable, set ocrText to empty string.',
    '- visualEvidence/ocrEvidence/consistencyEvidence each 2-4 bullets.'
  ].join('\n');

  const parts: any[] = [{ text: prompt }];
  for (const shot of input.shots) {
    const mimeType = await detectMimeType(shot.buffer);
    parts.push({ text: `Image slot: ${shot.slot}` });
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: shot.buffer.toString('base64')
      }
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    })
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(`Gemini analysis failed: ${res.status} ${raw.slice(0, 180)}`);

  const json = JSON.parse(raw);
  const modelText =
    json.candidates?.[0]?.content?.parts
      ?.map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
      .join('\n')
      .trim() ?? '';
  const parsed = JSON.parse(stripCodeFence(modelText));

  return {
    titleGuess: String(parsed.titleGuess ?? '작품 정보'),
    summary: String(parsed.summary ?? ''),
    visualEvidence: Array.isArray(parsed.visualEvidence) ? parsed.visualEvidence.map(String) : [],
    ocrEvidence: Array.isArray(parsed.ocrEvidence) ? parsed.ocrEvidence.map(String) : [],
    consistencyEvidence: Array.isArray(parsed.consistencyEvidence) ? parsed.consistencyEvidence.map(String) : [],
    coverageInsight: String(parsed.coverageInsight ?? ''),
    ocrText: String(parsed.ocrText ?? ''),
    aiConfidence: Number.isFinite(parsed.aiConfidence) ? Math.max(0, Math.min(1, Number(parsed.aiConfidence))) : 0.5,
    riskScore: Number.isFinite(parsed.riskScore) ? Math.max(0, Math.min(100, Math.round(Number(parsed.riskScore)))) : 50,
    riskLevel: parseLevel(String(parsed.riskLevel ?? '중간')),
    riskReasons: Array.isArray(parsed.riskReasons) ? parsed.riskReasons.map(String).slice(0, 4) : [],
    dataPoints: Number.isFinite(parsed.dataPoints) ? Math.max(1, Math.round(Number(parsed.dataPoints))) : input.shots.length
  };
}
