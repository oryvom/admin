import { z } from "zod";

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export const phoneSchema = z
  .string()
  .trim()
  .transform(normalizePhone)
  .refine((value) => /^\d{10,15}$/.test(value), {
    error: "Enter a phone number with 10 to 15 digits.",
  });
