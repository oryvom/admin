import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "@/lib/db/executor";
import { mfaChallenges, mfaFactors, mfaRecoveryCodes, users } from "@/lib/db/schema";

export async function upsertPendingFactor(db: DbClient, userId: string, secretCiphertext: string): Promise<void> {
  const now = new Date();
  await db
    .insert(mfaFactors)
    .values({
      userId,
      secretCiphertext,
      verifiedAt: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: mfaFactors.userId,
      set: { secretCiphertext, verifiedAt: null, updatedAt: now },
    });
}

export async function findFactor(db: DbClient, userId: string) {
  const [factor] = await db.select().from(mfaFactors).where(eq(mfaFactors.userId, userId)).limit(1);
  return factor ?? null;
}

export async function markFactorVerified(db: DbClient, userId: string): Promise<void> {
  const now = new Date();
  await db.update(mfaFactors).set({ verifiedAt: now, updatedAt: now }).where(eq(mfaFactors.userId, userId));
  await db.update(users).set({ mfaEnabled: true, updatedAt: now }).where(eq(users.id, userId));
}

export async function deleteFactor(db: DbClient, userId: string): Promise<void> {
  await db.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, userId));
  await db.delete(mfaFactors).where(eq(mfaFactors.userId, userId));
  await db.update(users).set({ mfaEnabled: false, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function replaceRecoveryCodes(db: DbClient, userId: string, codeHashes: string[]): Promise<void> {
  await db.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, userId));
  if (codeHashes.length === 0) {
    return;
  }
  await db.insert(mfaRecoveryCodes).values(codeHashes.map((codeHash) => ({ userId, codeHash })));
}

export async function findUnusedRecoveryCode(db: DbClient, userId: string, codeHash: string) {
  const [code] = await db
    .select()
    .from(mfaRecoveryCodes)
    .where(and(eq(mfaRecoveryCodes.userId, userId), eq(mfaRecoveryCodes.codeHash, codeHash), isNull(mfaRecoveryCodes.usedAt)))
    .limit(1);
  return code ?? null;
}

export async function consumeRecoveryCode(db: DbClient, codeId: string): Promise<void> {
  await db.update(mfaRecoveryCodes).set({ usedAt: new Date() }).where(eq(mfaRecoveryCodes.id, codeId));
}

export async function insertMfaChallenge(
  db: DbClient,
  input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
    requestId: string;
  },
): Promise<void> {
  await db.insert(mfaChallenges).values(input);
}

export async function findOpenMfaChallenge(db: DbClient, tokenHash: string) {
  const [challenge] = await db
    .select()
    .from(mfaChallenges)
    .where(and(eq(mfaChallenges.tokenHash, tokenHash), isNull(mfaChallenges.consumedAt)))
    .limit(1)
    .for("update");
  return challenge ?? null;
}

export async function consumeMfaChallenge(db: DbClient, challengeId: string): Promise<void> {
  await db.update(mfaChallenges).set({ consumedAt: new Date() }).where(eq(mfaChallenges.id, challengeId));
}
