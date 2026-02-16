import { promises as fs } from 'fs';
import path from 'path';
import { auth } from '@/auth';
import { getUploadsDirPath } from '@/lib/paths';

const types: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
};

export async function GET(_: Request, { params }: { params: { name: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const filePath = path.join(getUploadsDirPath(), params.name);
  const ext = params.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const contentType = types[ext] ?? 'application/octet-stream';

  try {
    const file = await fs.readFile(filePath);
    return new Response(file, { headers: { 'Content-Type': contentType } });
  } catch {
    return new Response('Not Found', { status: 404 });
  }
}
