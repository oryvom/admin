import { z } from "zod";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const emailSchema = z
  .string()
  .trim()
  .pipe(z.email({ error: "Enter a valid email address." }))
  .transform(normalizeEmail);
