import { Case as PrismaCase } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { CaseCreateInput, CaseRecord } from '@/lib/types';

function toCaseRecord(row: PrismaCase): CaseRecord {
  return {
    id: row.id,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
    category: row.category as CaseRecord['category'],
    imageUrl: row.imageUrl ?? undefined,
    qualityResult: JSON.parse(row.qualityResult) as CaseRecord['qualityResult'],
    ocrText: row.ocrText,
    ocrConfidence: row.ocrConfidence ?? undefined,
    riskScore: row.riskScore,
    riskLevel: row.riskLevel as CaseRecord['riskLevel'],
    riskReasons: JSON.parse(row.riskReasons) as string[],
    notes: row.notes ?? undefined,
    tags: JSON.parse(row.tags) as string[]
  };
}

export async function listCasesByUser(userId: string) {
  const rows = await prisma.case.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });
  return rows.map(toCaseRecord);
}

export async function getCaseByUser(id: string, userId: string) {
  const row = await prisma.case.findFirst({
    where: { id, userId }
  });
  return row ? toCaseRecord(row) : null;
}

export async function upsertCaseForUser(input: CaseCreateInput, userId: string) {
  const exists = await prisma.case.findUnique({ where: { id: input.id } });
  if (exists && exists.userId !== userId) {
    throw new Error('forbidden');
  }

  const row = exists
    ? await prisma.case.update({
        where: { id: input.id },
        data: {
          category: input.category,
          imageUrl: input.imageUrl ?? null,
          qualityResult: JSON.stringify(input.qualityResult),
          ocrText: input.ocrText,
          ocrConfidence: input.ocrConfidence ?? null,
          riskScore: input.riskScore,
          riskLevel: input.riskLevel,
          riskReasons: JSON.stringify(input.riskReasons),
          notes: input.notes ?? null,
          tags: JSON.stringify(input.tags)
        }
      })
    : await prisma.case.create({
        data: {
          id: input.id,
          userId,
          createdAt: new Date(input.createdAt),
          category: input.category,
          imageUrl: input.imageUrl ?? null,
          qualityResult: JSON.stringify(input.qualityResult),
          ocrText: input.ocrText,
          ocrConfidence: input.ocrConfidence ?? null,
          riskScore: input.riskScore,
          riskLevel: input.riskLevel,
          riskReasons: JSON.stringify(input.riskReasons),
          notes: input.notes ?? null,
          tags: JSON.stringify(input.tags)
        }
      });
  return toCaseRecord(row);
}
