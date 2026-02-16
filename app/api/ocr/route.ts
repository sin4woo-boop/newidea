import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { runVisionOCR } from '@/lib/googleVision';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: '이미지 파일이 필요합니다.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const imageBase64 = buffer.toString('base64');
    const result = await runVisionOCR(imageBase64);
    return NextResponse.json(result);
  } catch (error) {
    console.error('/api/ocr error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'OCR 처리에 실패했습니다.' },
      { status: 500 }
    );
  }
}
