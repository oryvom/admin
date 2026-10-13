"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createUserSchema, roleChangeSchema, statusChangeSchema } from "@/features/users/schema";
import { ORIGIN_ERROR, UNAVAILABLE_ERROR } from "@/lib/security/messages";
import { logSafeError } from "@/lib/security/log";
import { requirePermission } from "@/server/auth/current-user";
import { readMutationContext } from "@/server/http/request";
import { changeUserRole, createUserAccount, setUserStatus } from "@/server/services/user-service";

export type UserActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
};

export async function createUserAction(input: unknown): Promise<UserActionState> {
  const context = await readMutationContext();
  if (!context) {
    return { error: ORIGIN_ERROR };
  }
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorMap(parsed.error.issues) };
  }

  try {
    const actor = await requirePermission("users.create");
    const result = await createUserAccount({ actor, values: parsed.data, context });
    if (!result.ok) {
      return { error: result.message };
    }
    revalidatePath("/users");
    redirect(`/users/${result.id}`);
  } catch (error) {
    if (isNextControlFlow(error)) {
      throw error;
    }
    logSafeError("user creation failed", error);
    return { error: UNAVAILABLE_ERROR };
  }
}

export async function changeRoleAction(input: unknown): Promise<UserActionState> {
  const context = await readMutationContext();
  if (!context) {
    return { error: ORIGIN_ERROR };
  }
  const parsed = roleChangeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Choose a valid role." };
  }

  try {
    const actor = await requirePermission("users.change_role");
    const result = await changeUserRole({
      actor,
      targetId: parsed.data.userId,
      nextRoleKey: parsed.data.roleKey,
      context,
    });
    if (!result.ok) {
      return { error: result.message };
    }
    revalidatePath("/users");
    revalidatePath(`/users/${parsed.data.userId}`);
    return { ok: true };
  } catch (error) {
    if (isNextControlFlow(error)) {
      throw error;
    }
    logSafeError("role change failed", error);
    return { error: UNAVAILABLE_ERROR };
  }
}

export async function setStatusAction(input: unknown): Promise<UserActionState> {
  const context = await readMutationContext();
  if (!context) {
    return { error: ORIGIN_ERROR };
  }
  const parsed = statusChangeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "That account update is not valid." };
  }

  try {
    const actor = await requirePermission("users.suspend");
    const result = await setUserStatus({
      actor,
      targetId: parsed.data.userId,
      nextStatus: parsed.data.status,
      context,
    });
    if (!result.ok) {
      return { error: result.message };
    }
    revalidatePath("/users");
    revalidatePath(`/users/${parsed.data.userId}`);
    return { ok: true };
  } catch (error) {
    if (isNextControlFlow(error)) {
      throw error;
    }
    logSafeError("status change failed", error);
    return { error: UNAVAILABLE_ERROR };
  }
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
