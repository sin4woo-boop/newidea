import crypto from 'crypto';
import { readFileSync } from 'fs';
import sharp from 'sharp';
import { OCRBlock } from './types';

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type VisionSymbol = { text?: string };
type VisionWord = { symbols?: VisionSymbol[]; confidence?: number };
type VisionParagraph = { words?: VisionWord[] };
type VisionBlock = {
  paragraphs?: VisionParagraph[];
  confidence?: number;
  boundingBox?: { vertices?: { x?: number; y?: number }[] };
};
type VisionPage = { blocks?: VisionBlock[] };
type VisionAnnotation = { text?: string; pages?: VisionPage[] };

type OCRResult = {
  text: string;
  confidence?: number;
  blocks: OCRBlock[];
  wordCount: number;
};

function toBase64Url(input: string) {
  return Buffer.from(input).toString('base64url');
}

function loadCredentials(): ServiceAccount | null {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    return JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) as ServiceAccount;
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const raw = readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8');
    return JSON.parse(raw) as ServiceAccount;
  }
  return null;
}

function getLanguageHints() {
  const fromEnv = process.env.OCR_LANGUAGE_HINTS?.split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return fromEnv && fromEnv.length > 0 ? fromEnv : ['ko', 'zh-Hant', 'ja'];
}

async function preprocessImage(input: Buffer) {
  // Keep details for calligraphy; only orientation + resize.
  return sharp(input).rotate().resize({ width: 2400, withoutEnlargement: true }).toBuffer();
}

async function getAccessToken(creds: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: creds.token_uri ?? 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  const unsigned = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(claim))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(creds.private_key, 'base64url');
  const assertion = `${unsigned}.${signature}`;

  const tokenRes = await fetch(claim.aud, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });

  if (!tokenRes.ok) throw new Error(`Google OAuth failed: ${tokenRes.status}`);
  const tokenJson = (await tokenRes.json()) as { access_token: string };
  return tokenJson.access_token;
}

function parseAnnotation(annotation?: VisionAnnotation): OCRResult {
  const pages: VisionPage[] = annotation?.pages ?? [];

  const blocks: OCRBlock[] = pages.flatMap((page) =>
    (page.blocks ?? []).map((block) => ({
      text: (block.paragraphs ?? [])
        .map((paragraph) =>
          (paragraph.words ?? [])
            .map((word) => (word.symbols ?? []).map((symbol) => symbol.text ?? '').join(''))
            .join(' ')
        )
        .join('\n')
        .trim(),
      confidence: block.confidence,
      boundingBox: block.boundingBox?.vertices?.map((v) => ({ x: v.x ?? 0, y: v.y ?? 0 }))
    }))
  );

  const words: VisionWord[] = pages.flatMap((page) =>
    (page.blocks ?? []).flatMap((block) => (block.paragraphs ?? []).flatMap((paragraph) => paragraph.words ?? []))
  );

  const wordsText = words
    .map((word) => (word.symbols ?? []).map((symbol) => symbol.text ?? '').join(''))
    .filter(Boolean);

  const text = (annotation?.text?.trim() || wordsText.join(' ').trim() || '').trim();
  const confidences = words.map((word) => word.confidence).filter((value): value is number => typeof value === 'number');
  const confidence = confidences.length ? confidences.reduce((sum, v) => sum + v, 0) / confidences.length : undefined;

  return { text, confidence, blocks, wordCount: wordsText.length };
}

async function detectByType(args: {
  accessToken: string;
  imageBase64: string;
  languageHints: string[];
  featureType: 'DOCUMENT_TEXT_DETECTION' | 'TEXT_DETECTION';
}) {
  const res = await fetch('https://vision.googleapis.com/v1/images:annotate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        {
          image: { content: args.imageBase64 },
          features: [{ type: args.featureType }],
          imageContext: { languageHints: args.languageHints }
        }
      ]
    })
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Vision API failed: ${res.status} ${raw.slice(0, 180)}`);
  }

  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`Vision response parse failed: ${raw.slice(0, 180)}`);
  }

  const first = json.responses?.[0];
  const full = first?.fullTextAnnotation as VisionAnnotation | undefined;
  if (full) return parseAnnotation(full);

  const detectedText = first?.textAnnotations?.[0]?.description as string | undefined;
  return {
    text: (detectedText ?? '').trim(),
    confidence: undefined,
    blocks: [],
    wordCount: (detectedText ?? '')
      .split(/\s+/)
      .map((v: string) => v.trim())
      .filter(Boolean).length
  };
}

function rankResult(result: OCRResult) {
  return result.text.length + (result.confidence ?? 0) * 120 + result.wordCount * 2;
}

export async function runVisionOCR(imageBuffer: Buffer): Promise<{ text: string; confidence?: number; blocks: OCRBlock[] }> {
  const creds = loadCredentials();
  if (!creds) {
    throw new Error('Google credentials missing. Set GOOGLE_APPLICATION_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS.');
  }

  const preprocessed = await preprocessImage(imageBuffer);
  const imageBase64 = preprocessed.toString('base64');
  const accessToken = await getAccessToken(creds);
  const languageHints = getLanguageHints();

  const primary = await detectByType({
    accessToken,
    imageBase64,
    languageHints,
    featureType: 'DOCUMENT_TEXT_DETECTION'
  });

  let best = primary;

  // Calligraphy / seal cases often improve with TEXT_DETECTION fallback.
  if (primary.wordCount < 8 || (primary.confidence ?? 0) < 0.45 || primary.text.length < 16) {
    const fallback = await detectByType({
      accessToken,
      imageBase64,
      languageHints,
      featureType: 'TEXT_DETECTION'
    });
    if (rankResult(fallback) > rankResult(primary)) best = fallback;
  }

  return { text: best.text, confidence: best.confidence, blocks: best.blocks };
}
