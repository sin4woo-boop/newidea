import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { NewCaseClient } from '@/app/new/new-case-client';

export default async function NewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <NewCaseClient />;
}
