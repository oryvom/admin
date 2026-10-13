import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashScopedValue(scope: string, value: string, secret: string): string {
  return createHmac("sha256", secret).update(`${scope}:${value}`).digest("base64url");
}

export function hashSessionToken(token: string, secret: string): string {
  return hashScopedValue("session", token, secret);
}

export function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}
