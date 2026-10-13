"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mfaSchema } from "@/features/auth/schema";
import { ORIGIN_ERROR, UNAVAILABLE_ERROR } from "@/lib/security/messages";
import { logSafeError } from "@/lib/security/log";
import { requirePermission } from "@/server/auth/current-user";
import { clearSessionCookie, readMutationContext } from "@/server/http/request";
import { beginMfaEnrollment, confirmMfaEnrollment, disableMfa } from "@/server/services/mfa-service";
import { z } from "zod";

export type MfaEnrollmentState = {
  error?: string;
  qrDataUrl?: string;
  manualKey?: string;
  recoveryCodes?: string[];
};

const disableSchema = z.object({
  code: z.string().trim().min(6).max(12),
});

export async function startEnrollmentAction(): Promise<MfaEnrollmentState> {
  const context = await readMutationContext();
  if (!context) {
    return { error: ORIGIN_ERROR };
  }
  try {
    const user = await requirePermission("security.mfa.enroll");
    const result = await beginMfaEnrollment({ userId: user.id, email: user.email });
    if (!result.ok) {
      return { error: result.message };
    }
    return { qrDataUrl: result.qrDataUrl, manualKey: result.manualKey };
  } catch (error) {
    if (isNextControlFlow(error)) {
      throw error;
    }
    logSafeError("mfa enrollment start failed", error);
    return { error: UNAVAILABLE_ERROR };
  }
}

export async function confirmEnrollmentAction(input: unknown): Promise<MfaEnrollmentState> {
  const context = await readMutationContext();
  if (!context) {
    return { error: ORIGIN_ERROR };
  }
  const parsed = mfaSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Enter the 6-digit authentication code." };
  }
  try {
    const user = await requirePermission("security.mfa.enroll");
    const result = await confirmMfaEnrollment({
      userId: user.id,
      email: user.email,
      code: parsed.data.code,
      context,
    });
    if (!result.ok) {
      return { error: result.message };
    }
    revalidatePath("/account/security");
    return { recoveryCodes: result.recoveryCodes };
  } catch (error) {
    if (isNextControlFlow(error)) {
      throw error;
    }
    logSafeError("mfa enrollment confirmation failed", error);
    return { error: UNAVAILABLE_ERROR };
  }
}

export async function disableMfaAction(input: unknown): Promise<MfaEnrollmentState> {
  const context = await readMutationContext();
  if (!context) {
    return { error: ORIGIN_ERROR };
  }
  const parsed = disableSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Enter a current authentication code." };
  }
  try {
    const user = await requirePermission("security.mfa.enroll");
    const result = await disableMfa({
      userId: user.id,
      email: user.email,
      code: parsed.data.code,
      context,
    });
    if (!result.ok) {
      return { error: result.message };
    }
    await clearSessionCookie();
    redirect("/login");
  } catch (error) {
    if (isNextControlFlow(error)) {
      throw error;
    }
    logSafeError("mfa disable failed", error);
    return { error: UNAVAILABLE_ERROR };
  }
}

function isNextControlFlow(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }
  const digest = error.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"));
}
