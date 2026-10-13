import { z } from "zod";
import { isIndianStateCode } from "@/lib/company/india";

const identityText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(2, { error: `Enter the ${label}.` })
    .max(max, { error: `Use a shorter ${label}.` })
    .refine((value) => !/[\u0000-\u001F]/.test(value), { error: `Enter a valid ${label}.` });

export const MAX_ADDITIONAL_OFFICE_DOCUMENTS = 8;

export const officePropertyTypes = ["rented"] as const;

export const officeSchema = z.object({
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, { error: "Enter a valid 15-character GSTIN." }),
  addressLine1: identityText("address", 200),
  city: identityText("city", 80),
  district: identityText("district", 80),
  stateCode: z.string().trim().refine(isIndianStateCode, { error: "Choose a state." }),
  pinCode: z.string().trim().regex(/^[1-9]\d{5}$/, { error: "Enter a valid 6-digit PIN code." }),
  propertyType: z.enum(officePropertyTypes, { error: "Choose a property type." }),
});

export const officeDocumentTitleSchema = identityText("document title", 80);

export type OfficeInput = z.infer<typeof officeSchema>;
