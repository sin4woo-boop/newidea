import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listCasesByUser, upsertCaseForUser } from '@/lib/storage';
import { CaseCreateInput } from '@/lib/types';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const cases = await listCasesByUser(session.user.id);
  return NextResponse.json(cases);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const payload = (await request.json()) as CaseCreateInput;
    const saved = await upsertCaseForUser(payload, session.user.id);
    return NextResponse.json(saved);
  } catch (error) {
    if (error instanceof Error && error.message === 'forbidden') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'failed to save case' }, { status: 500 });
  }
}
