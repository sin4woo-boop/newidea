'use client';

import { useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui';
import { CaseRecord } from '@/lib/types';

export default function AdminPage() {
  const [items, setItems] = useState<CaseRecord[]>([]);
  const [selected, setSelected] = useState<CaseRecord | null>(null);
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');

  async function load() {
    const res = await fetch('/api/cases');
    const json = await res.json();
    setItems(json);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (selected) {
      setTags(selected.tags.join(', '));
      setNotes(selected.notes ?? '');
    }
  }, [selected]);

  async function save() {
    if (!selected) return;
    await fetch(`/api/cases/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tags: tags.split(',').map((s) => s.trim()).filter(Boolean),
        notes
      })
    });
    await load();
    alert('저장되었습니다.');
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">관리자 리뷰</h1>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="space-y-2">
          {items.map((item) => (
            <button key={item.id} className="w-full rounded border p-2 text-left text-sm" onClick={() => setSelected(item)}>
              {item.category} · {item.riskLevel} ({item.riskScore})
            </button>
          ))}
        </Card>
        <Card className="space-y-2">
          {!selected && <p className="text-sm text-muted-foreground">케이스를 선택하세요.</p>}
          {selected && (
            <>
              <p className="text-sm">ID: {selected.id}</p>
              <textarea value={tags} onChange={(e) => setTags(e.target.value)} className="w-full rounded border p-2 text-sm" placeholder="태그 (쉼표 구분)" />
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="h-32 w-full rounded border p-2 text-sm" placeholder="코멘트" />
              <Button onClick={save}>저장</Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
