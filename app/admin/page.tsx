import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AdminClient } from '@/app/admin/admin-client';

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');
  return <AdminClient />;
}
