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
  return sharp(input).rotate().resize({ width: 2000, withoutEnlargement: true }).grayscale().normalize().sharpen().toBuffer();
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

export async function runVisionOCR(imageBuffer: Buffer): Promise<{ text: string; confidence?: number; blocks: OCRBlock[] }> {
  const creds = loadCredentials();
  if (!creds) {
    throw new Error('Google credentials missing. Set GOOGLE_APPLICATION_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS.');
  }

  const processed = await preprocessImage(imageBuffer);
  const imageBase64 = processed.toString('base64');
  const accessToken = await getAccessToken(creds);
  const languageHints = getLanguageHints();

  const res = await fetch('https://vision.googleapis.com/v1/images:annotate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        {
          image: { content: imageBase64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          imageContext: { languageHints }
        }
      ]
    })
  });

  if (!res.ok) throw new Error(`Vision API failed: ${res.status}`);

  const json = await res.json();
  const pages: VisionPage[] = json.responses?.[0]?.fullTextAnnotation?.pages ?? [];

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

  const text = words
    .map((word) => (word.symbols ?? []).map((symbol) => symbol.text ?? '').join(''))
    .filter(Boolean)
    .join(' ')
    .trim();

  const confidences = words.map((word) => word.confidence).filter((value): value is number => typeof value === 'number');
  const confidence = confidences.length ? confidences.reduce((sum, v) => sum + v, 0) / confidences.length : undefined;

  return { text, confidence, blocks };
}
