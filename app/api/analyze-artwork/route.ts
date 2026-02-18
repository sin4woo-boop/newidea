import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { analyzeArtworkWithGemini } from '@/lib/artworkAnalysis';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const category = String(formData.get('category') ?? '기타');

    const shots: Array<{ slot: string; buffer: Buffer }> = [];
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith('shot:')) continue;
      if (!(value instanceof File)) continue;
      const slot = key.replace('shot:', '');
      const buffer = Buffer.from(await value.arrayBuffer());
      shots.push({ slot, buffer });
    }

    if (shots.length === 0) {
      return NextResponse.json({ error: '분석할 이미지가 없습니다.' }, { status: 400 });
    }

    const analysis = await analyzeArtworkWithGemini({ category, shots });
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('/api/analyze-artwork error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '분석 처리에 실패했습니다.' },
      { status: 500 }
    );
  }
}
