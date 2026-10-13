import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "@/lib/db/executor";
import { loginOtps } from "@/lib/db/schema";

export async function revokeActiveLoginOtps(db: DbClient, userId: string): Promise<void> {
  await db
    .update(loginOtps)
    .set({ consumedAt: new Date() })
    .where(and(eq(loginOtps.userId, userId), isNull(loginOtps.consumedAt)));
}

export async function insertLoginOtp(
  db: DbClient,
  input: {
    userId: string;
    codeHash: string;
    challengeHash: string;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
    requestId: string;
  },
): Promise<void> {
  await db.insert(loginOtps).values(input);
}

export async function findActiveLoginOtp(db: DbClient, challengeHash: string) {
  const [row] = await db
    .select({
      id: loginOtps.id,
      userId: loginOtps.userId,
      codeHash: loginOtps.codeHash,
      expiresAt: loginOtps.expiresAt,
      attempts: loginOtps.attempts,
    })
    .from(loginOtps)
    .where(and(eq(loginOtps.challengeHash, challengeHash), isNull(loginOtps.consumedAt)))
    .limit(1);
  return row ?? null;
}

export async function incrementLoginOtpAttempts(db: DbClient, id: string): Promise<void> {
  const [row] = await db.select({ attempts: loginOtps.attempts }).from(loginOtps).where(eq(loginOtps.id, id)).limit(1);
  await db
    .update(loginOtps)
    .set({ attempts: (row?.attempts ?? 0) + 1 })
    .where(eq(loginOtps.id, id));
}

export async function consumeLoginOtp(db: DbClient, id: string): Promise<void> {
  await db.update(loginOtps).set({ consumedAt: new Date() }).where(eq(loginOtps.id, id));
}
