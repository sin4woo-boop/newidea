import crypto from 'crypto';
import { readFileSync } from 'fs';
import { OCRBlock } from './types';

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
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

  if (!tokenRes.ok) {
    throw new Error(`Google OAuth failed: ${tokenRes.status}`);
  }
  const tokenJson = (await tokenRes.json()) as { access_token: string };
  return tokenJson.access_token;
}

export async function runVisionOCR(imageBase64: string): Promise<{ text: string; confidence?: number; blocks: OCRBlock[] }> {
  const creds = loadCredentials();
  if (!creds) {
    throw new Error('Google credentials missing. Set GOOGLE_APPLICATION_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS.');
  }
  const accessToken = await getAccessToken(creds);

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
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
        }
      ]
    })
  });

  if (!res.ok) {
    throw new Error(`Vision API failed: ${res.status}`);
  }

  const json = await res.json();
  const annotation = json.responses?.[0]?.fullTextAnnotation;
  const text = annotation?.text ?? '';

  const blocks: OCRBlock[] = (annotation?.pages?.[0]?.blocks ?? []).map((block: any) => ({
    text: (block.paragraphs ?? [])
      .flatMap((p: any) => p.words ?? [])
      .map((w: any) => (w.symbols ?? []).map((s: any) => s.text).join(''))
      .join(' '),
    confidence: block.confidence,
    boundingBox: block.boundingBox?.vertices?.map((v: any) => ({ x: v.x ?? 0, y: v.y ?? 0 }))
  }));

  const confidence = blocks.length
    ? blocks.reduce((sum, b) => sum + (b.confidence ?? 0), 0) / blocks.length
    : undefined;

  return { text, confidence, blocks };
}
