"use server";

import { redirect } from "next/navigation";
import { loginCodeSchema, loginIdentifierSchema, mfaSchema } from "@/features/auth/schema";
import { GENERIC_AUTH_ERROR, ORIGIN_ERROR, OTP_SENT_MESSAGE, THROTTLE_ERROR, UNAVAILABLE_ERROR } from "@/lib/security/messages";
import { logSafeError } from "@/lib/security/log";
import { safeInternalPath } from "@/lib/security/redirect";
import { logoutSession } from "@/server/services/auth-service";
import { requestLoginOtp, verifyLoginOtp } from "@/server/services/login-otp-service";
import { completeMfaLogin } from "@/server/services/mfa-service";
import {
  clearLoginOtpCookie,
  clearMfaCookie,
  clearSessionCookie,
  presentedLoginOtpToken,
  presentedMfaToken,
  presentedSessionToken,
  readMutationContext,
  setLoginOtpCookie,
  setMfaCookie,
  setSessionCookie,
} from "@/server/http/request";

export type AuthFormState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  step?: "code";
};

export async function requestLoginCode(input: unknown): Promise<AuthFormState> {
  const context = await readMutationContext();
  if (!context) {
    return { error: ORIGIN_ERROR };
  }

  const parsed = loginIdentifierSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: { identifier: parsed.error.issues[0]?.message ?? "Enter an email address or phone number." } };
  }

  try {
    const result = await requestLoginOtp({ identifier: parsed.data, context });
    if (result.status === "throttled") {
      return { error: THROTTLE_ERROR };
    }
    if (result.status === "unavailable") {
      return { error: UNAVAILABLE_ERROR };
    }
    if (result.status === "sent") {
      await setLoginOtpCookie(result.challengeToken, result.expiresAt);
    } else {
      await clearLoginOtpCookie();
    }
    return { step: "code", message: OTP_SENT_MESSAGE };
  } catch (error) {
    if (isNextControlFlow(error)) {
      throw error;
    }
    logSafeError("login code request failed", error);
    return { error: UNAVAILABLE_ERROR };
  }
}

export async function verifyLoginCode(input: unknown): Promise<AuthFormState> {
  const context = await readMutationContext();
  if (!context) {
    return { error: ORIGIN_ERROR };
  }
  const parsed = loginCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { step: "code", fieldErrors: fieldErrorMap(parsed.error.issues) };
  }

  try {
    const result = await verifyLoginOtp({
      code: parsed.data.code,
      challengeToken: await presentedLoginOtpToken(),
      context,
      presentedSessionToken: await presentedSessionToken(),
    });
    if (result.status === "throttled") {
      return { step: "code", error: THROTTLE_ERROR };
    }
    if (result.status !== "success" && result.status !== "mfa") {
      return { step: "code", error: GENERIC_AUTH_ERROR };
    }
    await clearLoginOtpCookie();
    if (result.status === "mfa") {
      await setMfaCookie(result.challengeToken, result.expiresAt);
      redirect("/login/mfa");
    }
    await setSessionCookie(result.token, result.expiresAt);
    redirect(safeInternalPath(parsed.data.next));
  } catch (error) {
    if (isNextControlFlow(error)) {
      throw error;
    }
    logSafeError("login code verification failed", error);
    return { step: "code", error: UNAVAILABLE_ERROR };
  }
}

export async function verifyMfa(input: unknown): Promise<AuthFormState> {
  const context = await readMutationContext();
  if (!context) {
    return { error: ORIGIN_ERROR };
  }
  const parsed = mfaSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorMap(parsed.error.issues) };
  }
  const challengeToken = await presentedMfaToken();
  if (!challengeToken) {
    return { error: GENERIC_AUTH_ERROR };
  }

  try {
    const result = await completeMfaLogin({
      challengeToken,
      code: parsed.data.code,
      context,
      presentedSessionToken: await presentedSessionToken(),
    });
    if (result.status !== "success") {
      return { error: GENERIC_AUTH_ERROR };
    }
    await clearMfaCookie();
    await setSessionCookie(result.token, result.expiresAt);
    redirect("/dashboard");
  } catch (error) {
    if (isNextControlFlow(error)) {
      throw error;
    }
    logSafeError("mfa verification failed", error);
    return { error: UNAVAILABLE_ERROR };
  }
}

export async function logout(): Promise<void> {
  const context = await readMutationContext();
  const token = await presentedSessionToken();
  if (context && token) {
    try {
      await logoutSession(token, context);
    } catch (error) {
      logSafeError("logout failed", error);
    }
  }
  await clearSessionCookie();
  await clearMfaCookie();
  await clearLoginOtpCookie();
  redirect("/login");
}

function fieldErrorMap(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
}

function isNextControlFlow(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }
  const digest = error.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"));
}
