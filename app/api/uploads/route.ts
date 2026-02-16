import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import path from 'path';
import { getUploadsDirPath } from '@/lib/paths';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: '파일이 필요합니다.' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${Date.now()}-${randomUUID()}.${ext}`;
    const uploadDir = getUploadsDirPath();
    await fs.mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, filename);
    const bytes = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, bytes);

    return NextResponse.json({ imageUrl: `/api/uploads/${filename}` });
  } catch (error) {
    console.error('/api/uploads error', error);
    return NextResponse.json({ error: '파일 저장 실패' }, { status: 500 });
  }
}
