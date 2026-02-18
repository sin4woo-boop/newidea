'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';

export function CaseDeleteButton({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    const confirmOnce = window.confirm('이 케이스를 삭제하시겠습니까?');
    if (!confirmOnce) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}`, { method: 'DELETE' });
      if (!res.ok) {
        alert('삭제에 실패했습니다.');
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-8 w-8 rounded-lg border-[#E2D8C4] bg-white px-0 text-base text-neutral-600 hover:bg-[#FAF7F1]"
        onClick={() => setOpen(true)}
      >
        ⋯
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/25" onClick={() => setOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl border border-[#E9E1D3] bg-[#F7F4EE] p-4 shadow-md" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto h-1 w-10 rounded-full bg-[#D8C8AA]" />
            <div className="mt-4 space-y-2">
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full rounded-xl border-red-200 bg-white text-red-600 hover:bg-red-50"
                onClick={onDelete}
                disabled={loading}
              >
                {loading ? '삭제 중...' : '삭제'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full rounded-xl border-[#E2D8C4] bg-white"
                onClick={() => setOpen(false)}
              >
                취소
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
