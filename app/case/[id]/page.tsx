import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getChecklist } from '@/lib/checklists';
import { getCaseByUser } from '@/lib/storage';
import { CaseReportClient } from '@/app/case/[id]/case-report-client';

export default async function CaseDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const data = await getCaseByUser(params.id, session.user.id);
  if (!data) return notFound();
  const checklist = getChecklist(data.category);
  return <CaseReportClient data={data} checklist={checklist} />;
}
