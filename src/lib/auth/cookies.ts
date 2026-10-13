export const SESSION_COOKIE = "oryvom_session";
export const MFA_COOKIE = "oryvom_mfa";
export const LOGIN_OTP_COOKIE = "oryvom_login_otp";

export const ABSOLUTE_SESSION_MS = 12 * 60 * 60 * 1000;
export const IDLE_SESSION_MS = 30 * 60 * 1000;
export const ACTIVITY_WRITE_INTERVAL_MS = 60 * 1000;
export const MFA_CHALLENGE_MS = 5 * 60 * 1000;
export const LOGIN_OTP_MS = 10 * 60 * 1000;
export const LOGIN_OTP_ATTEMPTS = 5;
export const PAGE_SIZE = 20;

export type CookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  expires: Date;
};

export function sessionCookieOptions(expiresAt: Date, secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  };
}

export function loginOtpCookieOptions(expiresAt: Date, secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/login",
    expires: expiresAt,
  };
}

export function mfaCookieOptions(expiresAt: Date, secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/login",
    expires: expiresAt,
  };
}

export function cookiesAreSecure(): boolean {
  return process.env.NODE_ENV === "production";
}
