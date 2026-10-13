import { z } from "zod";
import { parseLoginIdentifier } from "@/lib/validation/identifier";

export const loginIdentifierSchema = z.string().trim().min(1, { error: "Enter an email address or phone number." }).max(254).refine(
  (value) => parseLoginIdentifier(value) !== null,
  { error: "Enter a valid email address or phone number." },
);

export const loginCodeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, { error: "Enter the 6-digit code from your email." }),
  next: z.string().optional(),
});

export const mfaSchema = z.object({
  code: z
    .string()
    .trim()
    .min(6, { error: "Enter the authentication code." })
    .max(32, { error: "Enter the authentication code." }),
});

export type LoginCodeValues = z.infer<typeof loginCodeSchema>;
export type MfaValues = z.infer<typeof mfaSchema>;
