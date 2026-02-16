import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUploadsDirPath } from '@/lib/paths';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: '파일이 필요합니다.' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${Date.now()}-${randomUUID()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || 'image/jpeg';

    const supabase = getSupabaseAdmin();
    if (supabase) {
      const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'uploads';
      const objectPath = `cases/${filename}`;
      const { error } = await supabase.storage
        .from(bucket)
        .upload(objectPath, bytes, { contentType, upsert: false });
      if (error) throw error;

      const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
      return NextResponse.json({ imageUrl: data.publicUrl });
    }

    const uploadDir = getUploadsDirPath();
    await fs.mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, bytes);

    return NextResponse.json({ imageUrl: `/api/uploads/${filename}` });
  } catch (error) {
    console.error('/api/uploads error', error);
    return NextResponse.json({ error: '파일 저장 실패' }, { status: 500 });
  }
}
