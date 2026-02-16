import { promises as fs } from 'fs';
import path from 'path';
import { CaseRecord } from './types';
import { getCasesFilePath } from './paths';

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
  await ensure();
  const raw = await fs.readFile(casesFile, 'utf8');
  return JSON.parse(raw) as CaseRecord[];
}

export async function getCase(id: string) {
  const items = await listCases();
  return items.find((item) => item.id === id) ?? null;
}

export async function upsertCase(nextCase: CaseRecord) {
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
