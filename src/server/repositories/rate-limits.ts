import { eq, sql } from "drizzle-orm";
import type { DbClient } from "@/lib/db/executor";
import { authRateLimits } from "@/lib/db/schema";
import { LOGIN_RATE_WINDOW_MS, accountLockoutMs, ipLockoutMs } from "@/lib/security/rate-limit";

export async function isLoginThrottled(db: DbClient, bucketKeys: string[]): Promise<boolean> {
  const now = new Date();
  for (const bucketKey of bucketKeys) {
    await db.execute(sql`select pg_advisory_xact_lock(hashtext(${bucketKey}))`);
    const [row] = await db
      .select({ lockedUntil: authRateLimits.lockedUntil })
      .from(authRateLimits)
      .where(eq(authRateLimits.bucketKey, bucketKey))
      .limit(1);
    if (row?.lockedUntil && row.lockedUntil.getTime() > now.getTime()) {
      return true;
    }
  }
  return false;
}

export async function recordLoginFailure(
  db: DbClient,
  bucketKey: string,
  kind: "account" | "ip",
): Promise<void> {
  const now = new Date();
  await db.execute(sql`select pg_advisory_xact_lock(hashtext(${bucketKey}))`);
  const [existing] = await db.select().from(authRateLimits).where(eq(authRateLimits.bucketKey, bucketKey)).limit(1);

  const windowIsOpen =
    existing !== undefined && now.getTime() - existing.windowStartedAt.getTime() < LOGIN_RATE_WINDOW_MS;
  const failureCount = windowIsOpen ? existing.failureCount + 1 : 1;
  const windowStartedAt = windowIsOpen ? existing.windowStartedAt : now;
  const lockMs = kind === "account" ? accountLockoutMs(failureCount) : ipLockoutMs(failureCount);
  const lockedUntil = lockMs === null ? null : new Date(now.getTime() + lockMs);

  if (!existing) {
    await db.insert(authRateLimits).values({
      bucketKey,
      failureCount,
      windowStartedAt,
      lockedUntil,
      updatedAt: now,
    });
    return;
  }

  await db
    .update(authRateLimits)
    .set({ failureCount, windowStartedAt, lockedUntil, updatedAt: now })
    .where(eq(authRateLimits.bucketKey, bucketKey));
}

export async function clearLoginBucket(db: DbClient, bucketKey: string): Promise<void> {
  await db.delete(authRateLimits).where(eq(authRateLimits.bucketKey, bucketKey));
}
