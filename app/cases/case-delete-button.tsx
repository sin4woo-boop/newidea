'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';

export function CaseDeleteButton({ caseId }: { caseId: string }) {
  const router = useRouter();

  async function onDelete() {
    const ok = window.confirm('이 케이스를 삭제하시겠습니까?');
    if (!ok) return;

    const res = await fetch(`/api/cases/${caseId}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('삭제에 실패했습니다.');
      return;
    }
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-8 rounded-lg border-[#E2D8C4] bg-white px-2 text-xs text-neutral-600 hover:bg-[#FAF7F1]"
      onClick={onDelete}
    >
      삭제
    </Button>
  );
}
