import "server-only";
import { prisma } from "@/server/db";
import type { CandidateEntry } from "@/lib/types";
import { PrismaRepo } from "./prisma-repo";

export const repo = new PrismaRepo(prisma);

let candidateCache: { at: number; data: CandidateEntry[] } | null = null;
const CANDIDATE_TTL_MS = 5 * 60_000;

/** The public autocomplete index, memoized per server instance. */
export async function getCandidates(): Promise<CandidateEntry[]> {
  if (candidateCache && Date.now() - candidateCache.at < CANDIDATE_TTL_MS) return candidateCache.data;
  const data = await repo.listCandidates();
  candidateCache = { at: Date.now(), data };
  return data;
}
