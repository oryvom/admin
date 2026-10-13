import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { Secret, TOTP } from "otpauth";
import { getServerEnv } from "@/lib/config/env";
import { getDb } from "@/lib/db/client";
import { decryptField, decodeEncryptionKey, encryptField } from "@/lib/security/encryption";
import type { RequestContext } from "@/lib/security/request";
import type { DbClient } from "@/lib/db/executor";
import { hashScopedValue } from "@/lib/security/tokens";
import { findUserCredentialsById } from "@/server/repositories/credentials";
import { insertAuditLog } from "@/server/repositories/audit-logs";
import { insertLoginEvent } from "@/server/repositories/login-events";
import {
  consumeMfaChallenge,
  consumeRecoveryCode,
  deleteFactor,
  findFactor,
  findOpenMfaChallenge,
  findUnusedRecoveryCode,
  markFactorVerified,
  replaceRecoveryCodes,
  upsertPendingFactor,
} from "@/server/repositories/mfa";
import { insertSession, revokeSessionByHash, revokeSessionsForUser } from "@/server/repositories/sessions";
import { markUserLogin } from "@/server/repositories/users";
import { recordLoginFailure } from "@/server/repositories/rate-limits";
import type { IssuedSession } from "@/server/services/auth-service";
import { ABSOLUTE_SESSION_MS, IDLE_SESSION_MS } from "@/lib/auth/cookies";
import { generateOpaqueToken, hashSessionToken } from "@/lib/security/tokens";

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function beginMfaEnrollment(input: {
  userId: string;
  email: string;
}): Promise<{ ok: true; qrDataUrl: string; manualKey: string } | { ok: false; message: string }> {
  const db = getDb();
  const credentials = await findUserCredentialsById(db, input.userId);
  if (!credentials) {
    return { ok: false, message: "The account is no longer available." };
  }
  if (credentials.mfaEnabled) {
    return { ok: false, message: "Multi-factor authentication is already enabled." };
  }

  const secret = new Secret({ size: 20 });
  const env = getServerEnv();
  await upsertPendingFactor(db, input.userId, encryptField(secret.base32, decodeEncryptionKey(env.FIELD_ENCRYPTION_KEY)));

  const totp = new TOTP({
    issuer: "ORYVOM",
    label: input.email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });
  const qrDataUrl = await QRCode.toDataURL(totp.toString());
  return { ok: true, qrDataUrl, manualKey: formatManualKey(secret.base32) };
}

export async function confirmMfaEnrollment(input: {
  userId: string;
  email: string;
  code: string;
  context: RequestContext;
}): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; message: string }> {
  const db = getDb();
  const valid = await verifyUserTotp(input.userId, input.code);
  if (!valid) {
    return { ok: false, message: "That authentication code is not valid." };
  }

  const recoveryCodes = Array.from({ length: 10 }, () => createRecoveryCode());
  const env = getServerEnv();
  await db.transaction(async (tx) => {
    await markFactorVerified(tx, input.userId);
    await replaceRecoveryCodes(
      tx,
      input.userId,
      recoveryCodes.map((code) => hashScopedValue("recovery", normalizeRecoveryCode(code), env.SESSION_HASH_SECRET)),
    );
    await insertLoginEvent(tx, {
      userId: input.userId,
      email: input.email,
      eventType: "mfa_enrolled",
      outcome: "success",
      ipAddress: input.context.ipAddress,
      userAgent: input.context.userAgent,
      requestId: input.context.requestId,
    });
    await insertAuditLog(tx, {
      actorUserId: input.userId,
      action: "mfa.enrolled",
      entityType: "user",
      entityId: input.userId,
      requestId: input.context.requestId,
      metadata: { method: "totp" },
      outcome: "success",
    });
  });

  return { ok: true, recoveryCodes };
}

export async function disableMfa(input: {
  userId: string;
  email: string;
  code: string;
  context: RequestContext;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getDb();
  const credentials = await findUserCredentialsById(db, input.userId);
  if (!credentials?.mfaEnabled) {
    return { ok: false, message: "Multi-factor authentication is not enabled." };
  }
  const codeMatches = await verifyUserTotp(input.userId, input.code);
  if (!codeMatches) {
    return { ok: false, message: "The authentication code is not valid." };
  }

  await db.transaction(async (tx) => {
    await deleteFactor(tx, input.userId);
    await revokeSessionsForUser(tx, input.userId);
    await insertLoginEvent(tx, {
      userId: input.userId,
      email: input.email,
      eventType: "mfa_disabled",
      outcome: "success",
      ipAddress: input.context.ipAddress,
      userAgent: input.context.userAgent,
      requestId: input.context.requestId,
    });
    await insertAuditLog(tx, {
      actorUserId: input.userId,
      action: "mfa.disabled",
      entityType: "user",
      entityId: input.userId,
      requestId: input.context.requestId,
      metadata: {},
      outcome: "success",
    });
  });

  return { ok: true };
}

export async function completeMfaLogin(input: {
  challengeToken: string;
  code: string;
  context: RequestContext;
  presentedSessionToken: string | null;
}): Promise<IssuedSession | { status: "invalid" }> {
  const env = getServerEnv();
  const db = getDb();
  const tokenHash = hashScopedValue("mfa-challenge", input.challengeToken, env.SESSION_HASH_SECRET);

  return db.transaction(async (tx) => {
    const challenge = await findOpenMfaChallenge(tx, tokenHash);
    if (!challenge || challenge.expiresAt.getTime() <= Date.now()) {
      await insertLoginEvent(tx, {
        userId: challenge?.userId ?? null,
        email: null,
        eventType: "mfa_failed",
        outcome: "failure",
        failureCode: "mfa_expired",
        ipAddress: input.context.ipAddress,
        userAgent: input.context.userAgent,
        requestId: input.context.requestId,
      });
      return { status: "invalid" };
    }

    const credentials = await findUserCredentialsById(tx, challenge.userId);
    if (!credentials || credentials.status !== "ACTIVE" || !credentials.mfaEnabled) {
      await insertLoginEvent(tx, {
        userId: challenge.userId,
        email: credentials?.email ?? null,
        eventType: "mfa_failed",
        outcome: "failure",
        failureCode: "account_unavailable",
        ipAddress: input.context.ipAddress,
        userAgent: input.context.userAgent,
        requestId: input.context.requestId,
      });
      return { status: "invalid" };
    }

    const totpValid = await totpMatches(credentials.id, input.code, tx);
    const recovery = totpValid
      ? null
      : await findUnusedRecoveryCode(
          tx,
          credentials.id,
          hashScopedValue("recovery", normalizeRecoveryCode(input.code), env.SESSION_HASH_SECRET),
        );

    if (!totpValid && !recovery) {
      await insertLoginEvent(tx, {
        userId: credentials.id,
        email: credentials.email,
        eventType: "mfa_failed",
        outcome: "failure",
        failureCode: "mfa_invalid",
        ipAddress: input.context.ipAddress,
        userAgent: input.context.userAgent,
        requestId: input.context.requestId,
      });
      await recordLoginFailure(tx, `login:email:${hashScopedValue("rate", `email:${credentials.email}`, env.SESSION_HASH_SECRET)}`, "account");
      return { status: "invalid" };
    }

    await consumeMfaChallenge(tx, challenge.id);
    if (recovery) {
      await consumeRecoveryCode(tx, recovery.id);
      await insertLoginEvent(tx, {
        userId: credentials.id,
        email: credentials.email,
        eventType: "recovery_code_used",
        outcome: "success",
        ipAddress: input.context.ipAddress,
        userAgent: input.context.userAgent,
        requestId: input.context.requestId,
      });
    }

    const token = generateOpaqueToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ABSOLUTE_SESSION_MS);
    const idleExpiresAt = new Date(now.getTime() + IDLE_SESSION_MS);
    if (input.presentedSessionToken) {
      await revokeSessionByHash(tx, hashSessionToken(input.presentedSessionToken, env.SESSION_HASH_SECRET));
    }
    await insertLoginEvent(tx, {
      userId: credentials.id,
      email: credentials.email,
      eventType: "mfa_succeeded",
      outcome: "success",
      ipAddress: input.context.ipAddress,
      userAgent: input.context.userAgent,
      requestId: input.context.requestId,
    });
    await insertSession(tx, {
      userId: credentials.id,
      tokenHash: hashSessionToken(token, env.SESSION_HASH_SECRET),
      expiresAt,
      idleExpiresAt,
      ipAddress: input.context.ipAddress,
      userAgent: input.context.userAgent,
      requestId: input.context.requestId,
    });
    await markUserLogin(tx, credentials.id, now);
    return { status: "success", token, expiresAt } satisfies IssuedSession;
  });
}

async function verifyUserTotp(userId: string, code: string): Promise<boolean> {
  return totpMatches(userId, code, getDb());
}

async function totpMatches(userId: string, code: string, db: DbClient): Promise<boolean> {
  const factor = await findFactor(db, userId);
  if (!factor) {
    return false;
  }
  try {
    const secret = decryptField(factor.secretCiphertext, decodeEncryptionKey(getServerEnv().FIELD_ENCRYPTION_KEY));
    const totp = new TOTP({
      issuer: "ORYVOM",
      label: "ORYVOM",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    });
    return totp.validate({ token: code.replace(/\s/g, ""), window: 1 }) !== null;
  } catch {
    return false;
  }
}

function createRecoveryCode(): string {
  let raw = "";
  while (raw.length < 8) {
    const byte = randomBytes(1)[0] ?? 0;
    const limit = 256 - (256 % RECOVERY_ALPHABET.length);
    if (byte >= limit) {
      continue;
    }
    raw += RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function formatManualKey(value: string): string {
  return value.replace(/(.{4})/g, "$1 ").trim();
}
