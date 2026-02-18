import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { deleteCaseByUser, getCaseByUser, upsertCaseForUser } from '@/lib/storage';
import { CaseCreateInput } from '@/lib/types';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const item = await getCaseByUser(params.id, session.user.id);
  if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const current = await getCaseByUser(params.id, session.user.id);
  if (!current) return NextResponse.json({ error: 'not found' }, { status: 404 });
  try {
    const patch = (await request.json()) as Partial<CaseCreateInput>;
    const next = { ...current, ...patch };
    await upsertCaseForUser(next, session.user.id);
    return NextResponse.json(next);
  } catch (error) {
    if (error instanceof Error && error.message === 'forbidden') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'failed to update case' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const deleted = await deleteCaseByUser(params.id, session.user.id);
    if (!deleted) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'failed to delete case' }, { status: 500 });
  }
}
