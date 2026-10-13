"use server";

import { revalidatePath } from "next/cache";
import { ORIGIN_ERROR, UNAVAILABLE_ERROR } from "@/lib/security/messages";
import { logSafeError } from "@/lib/security/log";
import { requirePermission } from "@/server/auth/current-user";
import { readMutationContext } from "@/server/http/request";
import { saveCompanyAdministration } from "@/server/services/company-service";

export type CompanyFormState = {
  error?: string;
  message?: string;
};

export async function saveCompanyProfileAction(input: unknown): Promise<CompanyFormState> {
  const context = await readMutationContext();
  if (!context) {
    return { error: ORIGIN_ERROR };
  }
  try {
    const actor = await requirePermission("company.administration.write");
    const result = await saveCompanyAdministration({ actorId: actor.id, values: input, context });
    if (!result.ok) {
      return { error: result.message };
    }
    revalidatePath("/company-data/administration");
    return { message: "Company details saved." };
  } catch (error) {
    if (isRedirect(error)) {
      throw error;
    }
    logSafeError("company profile save failed", error);
    return { error: UNAVAILABLE_ERROR };
  }
}

function isRedirect(error: unknown): boolean {
  return typeof error === "object" && error !== null && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT");
}
