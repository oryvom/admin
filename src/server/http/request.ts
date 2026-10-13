import "server-only";

import { cookies, headers } from "next/headers";
import {
  LOGIN_OTP_COOKIE,
  MFA_COOKIE,
  SESSION_COOKIE,
  cookiesAreSecure,
  loginOtpCookieOptions,
  mfaCookieOptions,
  sessionCookieOptions,
} from "@/lib/auth/cookies";
import { isSameOrigin } from "@/lib/security/origin";
import { readRequestContext, type RequestContext } from "@/lib/security/request";

export async function readMutationContext(): Promise<RequestContext | null> {
  const headerStore = await headers();
  if (!isSameOrigin(headerStore)) {
    return null;
  }
  return readRequestContext(headerStore);
}

export async function readPageContext(): Promise<RequestContext> {
  return readRequestContext(await headers());
}

export async function presentedSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

export async function presentedLoginOtpToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(LOGIN_OTP_COOKIE)?.value ?? null;
}

export async function setLoginOtpCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(LOGIN_OTP_COOKIE, token, loginOtpCookieOptions(expiresAt, cookiesAreSecure()));
}

export async function clearLoginOtpCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(LOGIN_OTP_COOKIE, "", { ...loginOtpCookieOptions(new Date(0), cookiesAreSecure()), maxAge: 0 });
}

export async function presentedMfaToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(MFA_COOKIE)?.value ?? null;
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt, cookiesAreSecure()));
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { ...sessionCookieOptions(new Date(0), cookiesAreSecure()), maxAge: 0 });
}

export async function setMfaCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(MFA_COOKIE, token, mfaCookieOptions(expiresAt, cookiesAreSecure()));
}

export async function clearMfaCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(MFA_COOKIE, "", { ...mfaCookieOptions(new Date(0), cookiesAreSecure()), maxAge: 0 });
}
