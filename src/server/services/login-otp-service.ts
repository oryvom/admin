import { randomInt } from "node:crypto";
import { LOGIN_OTP_ATTEMPTS, LOGIN_OTP_MS } from "@/lib/auth/cookies";
import { getServerEnv } from "@/lib/config/env";
import { getDb } from "@/lib/db/client";
import { readSmtpSettings, sendLoginCode } from "@/lib/email/smtp";
import type { RequestContext } from "@/lib/security/request";
import { generateOpaqueToken, hashScopedValue, safeEqual } from "@/lib/security/tokens";
import { parseLoginIdentifier } from "@/lib/validation/identifier";
import { issueMfaChallenge, issueSession, type LoginResult } from "@/server/services/auth-service";
import { findUserCredentialsByEmail, findUserCredentialsById, findUserCredentialsByPhone } from "@/server/repositories/credentials";
import { insertLoginEvent } from "@/server/repositories/login-events";
import {
  consumeLoginOtp,
  findActiveLoginOtp,
  incrementLoginOtpAttempts,
  insertLoginOtp,
  revokeActiveLoginOtps,
} from "@/server/repositories/login-otps";
import { isLoginThrottled, recordLoginFailure } from "@/server/repositories/rate-limits";

export type OtpRequestResult =
  | { status: "sent"; challengeToken: string; expiresAt: Date }
  | { status: "accepted" }
  | { status: "throttled" }
  | { status: "unavailable" };

export async function requestLoginOtp(input: {
  identifier: string;
  context: RequestContext;
}): Promise<OtpRequestResult> {
  const parsed = parseLoginIdentifier(input.identifier);
  if (!parsed) {
    return { status: "accepted" };
  }
  if (!readSmtpSettings(getServerEnv())) {
    return { status: "unavailable" };
  }

  const env = getServerEnv();
  const db = getDb();
  const identifierValue = parsed.kind === "email" ? parsed.email : parsed.phone;
  const accountKey = rateKey(identifierValue, env.SESSION_HASH_SECRET);
  const ipKey = input.context.ipAddress ? rateKey(input.context.ipAddress, env.SESSION_HASH_SECRET) : null;
  const buckets = ipKey ? [accountKey, ipKey] : [accountKey];
  const throttled = await db.transaction(async (tx) => isLoginThrottled(tx, buckets));
  if (throttled) {
    await recordOtpEvent(null, identifierValue, "auth_throttled", "denied", "rate_limited", input.context);
    return { status: "throttled" };
  }

  const user = parsed.kind === "email"
    ? await findUserCredentialsByEmail(db, parsed.email)
    : await findUserCredentialsByPhone(db, parsed.phone);

  await db.transaction(async (tx) => {
    await recordLoginFailure(tx, accountKey, "account");
    if (ipKey) {
      await recordLoginFailure(tx, ipKey, "ip");
    }
  });

  if (!user || user.status !== "ACTIVE") {
    await recordOtpEvent(
      user?.id ?? null,
      user?.email ?? identifierValue,
      "login_failed",
      "failure",
      user ? "account_unavailable" : "unknown_email",
      input.context,
    );
    return { status: "accepted" };
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const challengeToken = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + LOGIN_OTP_MS);
  await db.transaction(async (tx) => {
    await revokeActiveLoginOtps(tx, user.id);
    await insertLoginOtp(tx, {
      userId: user.id,
      codeHash: hashScopedValue("login-otp", code, env.SESSION_HASH_SECRET),
      challengeHash: hashScopedValue("login-otp-challenge", challengeToken, env.SESSION_HASH_SECRET),
      expiresAt,
      ipAddress: input.context.ipAddress,
      userAgent: input.context.userAgent,
      requestId: input.context.requestId,
    });
  });

  try {
    await sendLoginCode(user.email, code);
  } catch {
    await consumeLoginOtp(db, await challengeId(challengeToken, env.SESSION_HASH_SECRET));
    return { status: "unavailable" };
  }

  await recordOtpEvent(user.id, user.email, "otp_sent", "pending", null, input.context);
  return { status: "sent", challengeToken, expiresAt };
}

export async function verifyLoginOtp(input: {
  code: string;
  challengeToken: string | null;
  context: RequestContext;
  presentedSessionToken: string | null;
}): Promise<LoginResult> {
  if (!input.challengeToken || !/^\d{6}$/.test(input.code)) {
    return { status: "invalid" };
  }

  const env = getServerEnv();
  const db = getDb();
  const challengeHash = hashScopedValue("login-otp-challenge", input.challengeToken, env.SESSION_HASH_SECRET);
  const otp = await findActiveLoginOtp(db, challengeHash);
  if (!otp) {
    return { status: "invalid" };
  }

  const user = await findUserCredentialsById(db, otp.userId);
  if (!user || user.status !== "ACTIVE") {
    await consumeLoginOtp(db, otp.id);
    await recordOtpEvent(user?.id ?? otp.userId, user?.email ?? null, "otp_failed", "failure", "account_unavailable", input.context);
    return { status: "invalid" };
  }

  if (otp.expiresAt.getTime() <= Date.now() || otp.attempts >= LOGIN_OTP_ATTEMPTS) {
    await consumeLoginOtp(db, otp.id);
    await recordOtpEvent(user.id, user.email, "otp_failed", "failure", "otp_expired", input.context);
    return { status: "invalid" };
  }

  const codeHash = hashScopedValue("login-otp", input.code, env.SESSION_HASH_SECRET);
  if (!safeEqual(codeHash, otp.codeHash)) {
    await incrementLoginOtpAttempts(db, otp.id);
    await recordOtpEvent(user.id, user.email, "otp_failed", "failure", "otp_invalid", input.context);
    return { status: "invalid" };
  }

  await consumeLoginOtp(db, otp.id);
  if (user.mfaEnabled) {
    return issueMfaChallenge({ userId: user.id, email: user.email, context: input.context });
  }

  return issueSession({
    userId: user.id,
    email: user.email,
    context: input.context,
    presentedSessionToken: input.presentedSessionToken,
    successEvent: "login_succeeded",
  });
}

async function challengeId(challengeToken: string, secret: string): Promise<string> {
  const otp = await findActiveLoginOtp(
    getDb(),
    hashScopedValue("login-otp-challenge", challengeToken, secret),
  );
  if (!otp) {
    throw new Error("Email delivery failed.");
  }
  return otp.id;
}

async function recordOtpEvent(
  userId: string | null,
  email: string | null,
  eventType: "otp_sent" | "otp_failed" | "login_failed" | "auth_throttled",
  outcome: "pending" | "failure" | "denied",
  failureCode: "unknown_email" | "account_unavailable" | "rate_limited" | "otp_invalid" | "otp_expired" | null,
  context: RequestContext,
): Promise<void> {
  await getDb().transaction(async (tx) => {
    await insertLoginEvent(tx, {
      userId,
      email,
      eventType,
      outcome,
      failureCode,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });
  });
}

function rateKey(value: string, secret: string): string {
  return `otp:${hashScopedValue("rate", value, secret)}`;
}
