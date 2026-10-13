import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(12, { error: "Use at least 12 characters." })
  .max(128, { error: "Use at most 128 characters." })
  .refine((value) => /[a-z]/.test(value), { error: "Include a lowercase letter." })
  .refine((value) => /[A-Z]/.test(value), { error: "Include an uppercase letter." })
  .refine((value) => /\d/.test(value), { error: "Include a number." })
  .refine((value) => /[^A-Za-z0-9]/.test(value), { error: "Include a symbol." });

export function passwordContainsEmail(password: string, email: string): boolean {
  const localPart = email.split("@")[0]?.toLowerCase() ?? "";
  return localPart.length >= 3 && password.toLowerCase().includes(localPart);
}
