import { NextResponse } from 'next/server';
import { listCases, upsertCase } from '@/lib/storage';
import { CaseRecord } from '@/lib/types';

export async function GET() {
  const cases = await listCases();
  return NextResponse.json(cases);
}

export async function POST(request: Request) {
  const payload = (await request.json()) as CaseRecord;
  const saved = await upsertCase(payload);
  return NextResponse.json(saved);
}
