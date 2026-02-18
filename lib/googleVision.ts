import sharp from 'sharp';
import { OCRBlock } from './types';

type GeminiOCRPayload = {
  text?: string;
  confidence?: number;
  lines?: string[];
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

function parseGeminiJson(raw: string): GeminiOCRPayload {
  const cleaned = stripCodeFence(raw);
  try {
    return JSON.parse(cleaned) as GeminiOCRPayload;
  } catch {
    // Fallback: if model returned plain text, treat it as OCR text.
    return { text: cleaned, confidence: undefined, lines: cleaned ? cleaned.split(/\n+/).map((v) => v.trim()).filter(Boolean) : [] };
  }
}

function toBlocks(lines: string[]): OCRBlock[] {
  return lines.map((line) => ({ text: line }));
}

export async function runVisionOCR(imageBuffer: Buffer): Promise<{ text: string; confidence?: number; blocks: OCRBlock[] }> {
  const { apiKey, model } = getGeminiConfig();
  const mimeType = await detectMimeType(imageBuffer);

  const prompt = [
    'You are an OCR engine specialized for East Asian calligraphy inscriptions on artworks.',
    'Task: extract inscription text from the image.',
    'Rules:',
    '- Prioritize Hanja (Chinese characters).',
    '- Exclude unrelated Korean/English/UI/noise text unless it is clearly part of the inscription.',
    '- Keep original order as much as possible.',
    '- If nothing is readable, return empty text.',
    'Return STRICT JSON only with this schema:',
    '{"text":"...","confidence":0.0,"lines":["..."]}',
    'confidence must be a number between 0 and 1.'
  ].join('\n');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBuffer.toString('base64')
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    })
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Gemini OCR failed: ${res.status} ${raw.slice(0, 180)}`);
  }

  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`Gemini response parse failed: ${raw.slice(0, 180)}`);
  }

  const modelText =
    json.candidates?.[0]?.content?.parts
      ?.map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
      .join('\n')
      .trim() ?? '';

  const parsed = parseGeminiJson(modelText);
  const lines = (parsed.lines ?? [])
    .map((v) => v.trim())
    .filter(Boolean);
  const text = (parsed.text ?? lines.join('\n')).trim();
  const confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : undefined;

  return { text, confidence, blocks: toBlocks(lines) };
}
