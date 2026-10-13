import { z } from "zod";
import { isIndianStateCode } from "@/lib/company/india";

const identityText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(2, { error: `Enter the ${label}.` })
    .max(max, { error: `Use a shorter ${label}.` })
    .refine((value) => !/[\u0000-\u001F]/.test(value), { error: `Enter a valid ${label}.` });

export const companyProfileSchema = z.object({
  companyName: identityText("company name", 200),
  cin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/, { error: "Enter a valid 21-character CIN." }),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{5}\d{4}[A-Z]$/, { error: "Enter a valid PAN." }),
  tan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}\d{5}[A-Z]$/, { error: "Enter a valid TAN." }),
  addressLine1: identityText("address", 200),
  city: identityText("city", 80),
  district: identityText("district", 80),
  stateCode: z.string().trim().refine(isIndianStateCode, { error: "Choose a state." }),
  pinCode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, { error: "Enter a valid 6-digit PIN code." }),
});

export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;

export function sanitizeFileName(value: string): string {
  const base = value.split(/[/\\]/).pop() ?? "document";
  const cleaned = base.replace(/[\u0000-\u001F]/g, "").replace(/[^\w.\- ()]/g, "").trim();
  return cleaned.slice(0, 120) || "document";
}
