import { promises as fs } from 'fs';
import path from 'path';

export async function GET(_: Request, { params }: { params: { name: string } }) {
  const filePath = path.join(process.cwd(), '.data', 'uploads', params.name);
  try {
    const file = await fs.readFile(filePath);
    return new Response(file, { headers: { 'Content-Type': 'image/jpeg' } });
  } catch {
    return new Response('Not Found', { status: 404 });
  }
}
