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
  feature: 'DOCUMENT_TEXT_DETECTION' | 'TEXT_DETECTION';
  candidateName: string;
};

type OCRCandidate = {
  name: string;
  buffer: Buffer;
};

function toBase64Url(input: string) {
  return Buffer.from(input).toString('base64url');
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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

function getOCRMode() {
  const mode = (process.env.OCR_MODE ?? 'quality').toLowerCase();
  return mode === 'fast' ? 'fast' : 'quality';
}

function getMaxCandidates() {
  const n = Number(process.env.OCR_MAX_CANDIDATES ?? 8);
  if (!Number.isFinite(n)) return 8;
  return clamp(Math.floor(n), 3, 16);
}

async function preprocessBase(input: Buffer) {
  return sharp(input).rotate().resize({ width: 3000, withoutEnlargement: true }).toBuffer();
}

async function preprocessEnhanced(input: Buffer) {
  return sharp(input)
    .rotate()
    .resize({ width: 3000, withoutEnlargement: true })
    .grayscale()
    .normalize()
    .sharpen()
    .toBuffer();
}

async function createTileCandidates(input: Buffer) {
  const meta = await sharp(input).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) return [] as OCRCandidate[];

  const cols = 2;
  const rows = 2;
  const tileW = Math.floor(width / cols);
  const tileH = Math.floor(height / rows);
  const candidates: OCRCandidate[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const left = c * tileW;
      const top = r * tileH;
      const w = c === cols - 1 ? width - left : tileW;
      const h = r === rows - 1 ? height - top : tileH;

      const tile = await sharp(input)
        .extract({ left, top, width: w, height: h })
        .resize({ width: 2200, withoutEnlargement: false })
        .toBuffer();
      candidates.push({ name: `tile-${r}-${c}`, buffer: tile });
    }
  }
  return candidates;
}

async function createCandidates(input: Buffer) {
  const base = await preprocessBase(input);
  const enhanced = await preprocessEnhanced(input);
  const rotate90 = await sharp(base).rotate(90).toBuffer();
  const rotate270 = await sharp(base).rotate(270).toBuffer();
  const tiles = await createTileCandidates(base);

  return [
    { name: 'base', buffer: base },
    { name: 'enhanced', buffer: enhanced },
    { name: 'rot90', buffer: rotate90 },
    { name: 'rot270', buffer: rotate270 },
    ...tiles
  ];
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

function parseAnnotation(annotation?: VisionAnnotation) {
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

  const wordTexts = words
    .map((word) => (word.symbols ?? []).map((symbol) => symbol.text ?? '').join(''))
    .filter(Boolean);

  const text = (annotation?.text?.trim() || wordTexts.join(' ').trim() || '').trim();
  const confidences = words.map((word) => word.confidence).filter((v): v is number => typeof v === 'number');
  const confidence = confidences.length ? confidences.reduce((sum, v) => sum + v, 0) / confidences.length : undefined;

  return { text, confidence, blocks, wordCount: wordTexts.length };
}

async function detectByType(args: {
  accessToken: string;
  imageBase64: string;
  languageHints: string[];
  featureType: 'DOCUMENT_TEXT_DETECTION' | 'TEXT_DETECTION';
  candidateName: string;
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
  if (!res.ok) throw new Error(`Vision API failed: ${res.status} ${raw.slice(0, 180)}`);

  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`Vision response parse failed: ${raw.slice(0, 180)}`);
  }

  const first = json.responses?.[0];
  const full = first?.fullTextAnnotation as VisionAnnotation | undefined;
  if (full) {
    const parsed = parseAnnotation(full);
    return { ...parsed, feature: args.featureType, candidateName: args.candidateName } satisfies OCRResult;
  }

  const detectedText = first?.textAnnotations?.[0]?.description as string | undefined;
  const plain = (detectedText ?? '').trim();
  return {
    text: plain,
    confidence: undefined,
    blocks: [],
    wordCount: plain
      .split(/\s+/)
      .map((v: string) => v.trim())
      .filter(Boolean).length,
    feature: args.featureType,
    candidateName: args.candidateName
  } satisfies OCRResult;
}

function rankResult(result: OCRResult) {
  const cjk = (result.text.match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7a3]/g)?.length ?? 0) / Math.max(result.text.length, 1);
  return result.text.length + result.wordCount * 2 + (result.confidence ?? 0) * 140 + cjk * 20;
}

function isWeak(result: OCRResult) {
  return result.wordCount < 10 || result.text.length < 20 || (result.confidence ?? 0) < 0.45;
}

async function evaluateCandidate(args: {
  candidate: OCRCandidate;
  accessToken: string;
  languageHints: string[];
  allowFallback: boolean;
}) {
  const imageBase64 = args.candidate.buffer.toString('base64');
  const doc = await detectByType({
    accessToken: args.accessToken,
    imageBase64,
    languageHints: args.languageHints,
    featureType: 'DOCUMENT_TEXT_DETECTION',
    candidateName: args.candidate.name
  });

  if (!args.allowFallback || !isWeak(doc)) return doc;

  const text = await detectByType({
    accessToken: args.accessToken,
    imageBase64,
    languageHints: args.languageHints,
    featureType: 'TEXT_DETECTION',
    candidateName: args.candidate.name
  });

  return rankResult(text) > rankResult(doc) ? text : doc;
}

export async function runVisionOCR(imageBuffer: Buffer): Promise<{ text: string; confidence?: number; blocks: OCRBlock[] }> {
  const creds = loadCredentials();
  if (!creds) {
    throw new Error('Google credentials missing. Set GOOGLE_APPLICATION_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS.');
  }

  const mode = getOCRMode();
  const maxCandidates = getMaxCandidates();
  const languageHints = getLanguageHints();
  const accessToken = await getAccessToken(creds);

  const candidates = await createCandidates(imageBuffer);
  const baseCandidate = candidates[0];

  let best = await evaluateCandidate({
    candidate: baseCandidate,
    accessToken,
    languageHints,
    allowFallback: true
  });

  if (mode === 'fast' && !isWeak(best)) {
    return { text: best.text, confidence: best.confidence, blocks: best.blocks };
  }

  const queue = candidates.slice(1, maxCandidates);
  for (const candidate of queue) {
    const result = await evaluateCandidate({
      candidate,
      accessToken,
      languageHints,
      allowFallback: mode === 'quality'
    });
    if (rankResult(result) > rankResult(best)) best = result;
  }

  return { text: best.text, confidence: best.confidence, blocks: best.blocks };
}
