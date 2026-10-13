import { ABSOLUTE_SESSION_MS, IDLE_SESSION_MS, MFA_CHALLENGE_MS } from "@/lib/auth/cookies";
import { getServerEnv } from "@/lib/config/env";
import { getDb } from "@/lib/db/client";
import type { RequestContext } from "@/lib/security/request";
import { generateOpaqueToken, hashScopedValue, hashSessionToken } from "@/lib/security/tokens";
import { insertLoginEvent } from "@/server/repositories/login-events";
import { clearLoginBucket } from "@/server/repositories/rate-limits";
import { insertMfaChallenge } from "@/server/repositories/mfa";
import { insertSession, revokeSessionByHash } from "@/server/repositories/sessions";
import { markUserLogin } from "@/server/repositories/users";

export type IssuedSession = {
  status: "success";
  token: string;
  expiresAt: Date;
};

export type LoginResult =
  | IssuedSession
  | { status: "mfa"; challengeToken: string; expiresAt: Date }
  | { status: "invalid" }
  | { status: "throttled" };

export async function issueMfaChallenge(input: {
  userId: string;
  email: string;
  context: RequestContext;
}): Promise<Extract<LoginResult, { status: "mfa" }>> {
  const env = getServerEnv();
  const challengeToken = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + MFA_CHALLENGE_MS);
  await getDb().transaction(async (tx) => {
    await insertLoginEvent(tx, {
      userId: input.userId,
      email: input.email,
      eventType: "mfa_challenge_issued",
      outcome: "pending",
      ipAddress: input.context.ipAddress,
      userAgent: input.context.userAgent,
      requestId: input.context.requestId,
    });
    await insertMfaChallenge(tx, {
      userId: input.userId,
      tokenHash: hashScopedValue("mfa-challenge", challengeToken, env.SESSION_HASH_SECRET),
      expiresAt,
      ipAddress: input.context.ipAddress,
      userAgent: input.context.userAgent,
      requestId: input.context.requestId,
    });
  });
  return { status: "mfa", challengeToken, expiresAt };
}

export async function logoutSession(token: string, context: RequestContext): Promise<void> {
  const env = getServerEnv();
  const db = getDb();
  const tokenHash = hashSessionToken(token, env.SESSION_HASH_SECRET);
  await db.transaction(async (tx) => {
    const userId = await revokeSessionByHash(tx, tokenHash);
    await insertLoginEvent(tx, {
      userId,
      email: null,
      eventType: "logout",
      outcome: "success",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });
  });
}

export async function issueSession(input: {
  userId: string;
  email: string;
  context: RequestContext;
  presentedSessionToken: string | null;
  successEvent: "login_succeeded" | "mfa_succeeded";
  clearBucketKey?: string;
}): Promise<IssuedSession> {
  const env = getServerEnv();
  const db = getDb();
  const token = generateOpaqueToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ABSOLUTE_SESSION_MS);
  const idleExpiresAt = new Date(Math.min(now.getTime() + IDLE_SESSION_MS, expiresAt.getTime()));

  await db.transaction(async (tx) => {
    if (input.presentedSessionToken) {
      const previousUserId = await revokeSessionByHash(
        tx,
        hashSessionToken(input.presentedSessionToken, env.SESSION_HASH_SECRET),
      );
      if (previousUserId) {
        await insertLoginEvent(tx, {
          userId: previousUserId,
          email: input.email,
          eventType: "session_revoked",
          outcome: "success",
          ipAddress: input.context.ipAddress,
          userAgent: input.context.userAgent,
          requestId: input.context.requestId,
        });
      }
    }

    await insertLoginEvent(tx, {
      userId: input.userId,
      email: input.email,
      eventType: input.successEvent,
      outcome: "success",
      ipAddress: input.context.ipAddress,
      userAgent: input.context.userAgent,
      requestId: input.context.requestId,
    });
    await insertSession(tx, {
      userId: input.userId,
      tokenHash: hashSessionToken(token, env.SESSION_HASH_SECRET),
      expiresAt,
      idleExpiresAt,
      ipAddress: input.context.ipAddress,
      userAgent: input.context.userAgent,
      requestId: input.context.requestId,
    });
    await markUserLogin(tx, input.userId, now);
    if (input.clearBucketKey) {
      await clearLoginBucket(tx, input.clearBucketKey);
    }
  });

  return { status: "success", token, expiresAt };
}
