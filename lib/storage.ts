import { promises as fs } from 'fs';
import path from 'path';
import { CaseRecord } from './types';
import { getCasesFilePath } from './paths';
import { getSupabaseAdmin } from './supabase';

const casesFile = getCasesFilePath();

async function ensure() {
  await fs.mkdir(path.dirname(casesFile), { recursive: true });
  try {
    await fs.access(casesFile);
  } catch {
    await fs.writeFile(casesFile, '[]', 'utf8');
  }
}

export async function listCases() {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from('cases')
      .select('payload')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => row.payload as CaseRecord);
  }

  await ensure();
  const raw = await fs.readFile(casesFile, 'utf8');
  return JSON.parse(raw) as CaseRecord[];
}

export async function getCase(id: string) {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from('cases')
      .select('payload')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data?.payload as CaseRecord | undefined) ?? null;
  }

  const items = await listCases();
  return items.find((item) => item.id === id) ?? null;
}

export async function upsertCase(nextCase: CaseRecord) {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from('cases').upsert(
      {
        id: nextCase.id,
        created_at: nextCase.createdAt,
        payload: nextCase
      },
      { onConflict: 'id' }
    );
    if (error) throw error;
    return nextCase;
  }

  const items = await listCases();
  const index = items.findIndex((item) => item.id === nextCase.id);
  if (index >= 0) {
    items[index] = nextCase;
  } else {
    items.unshift(nextCase);
  }
  await fs.writeFile(casesFile, JSON.stringify(items, null, 2), 'utf8');
  return nextCase;
}
