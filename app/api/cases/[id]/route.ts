import { NextResponse } from 'next/server';
import { getCase, upsertCase } from '@/lib/storage';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const item = await getCase(params.id);
  if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const current = await getCase(params.id);
  if (!current) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const patch = await request.json();
  const next = { ...current, ...patch };
  await upsertCase(next);
  return NextResponse.json(next);
}
