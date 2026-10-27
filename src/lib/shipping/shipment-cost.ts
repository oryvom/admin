import { z } from "zod";

const letter = z.string().trim().toUpperCase().regex(/^[A-Z]$/, { error: "Use one letter, such as A." });

const positiveMeasure = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^(?:\d+|\d+\.\d{1,2})$/, { error: `Enter the ${label}.` })
    .refine((value) => {
      const number = Number(value);
      return number > 0 && number <= 9999;
    }, { error: `Enter a ${label} greater than zero.` });

export const shipmentCostInputSchema = z.object({
  originPin: z.string().trim().regex(/^[1-9]\d{5}$/, { error: "Enter a 6-digit origin PIN." }),
  destinationPin: z.string().trim().regex(/^[1-9]\d{5}$/, { error: "Enter a 6-digit destination PIN." }),
  weightKg: positiveMeasure("weight"),
  boxes: z
    .string()
    .trim()
    .regex(/^[1-9]\d{0,2}$/, { error: "Enter the number of boxes." }),
  lengthCm: positiveMeasure("length"),
  breadthCm: positiveMeasure("breadth"),
  heightCm: positiveMeasure("height"),
  productCode: letter,
  subProductCode: letter,
  productType: z.enum(["Docs", "Dutiables"], { error: "Choose documents or dutiable goods." }),
  declaredValue: z
    .string()
    .trim()
    .regex(/^(?:\d+|\d+\.\d{1,2})$/, { error: "Enter the declared value." })
    .refine((value) => Number(value) <= 99_999_999, { error: "Enter a smaller declared value." }),
});

export type ShipmentCostInput = z.infer<typeof shipmentCostInputSchema>;

export type ShipmentCharge = {
  name: string;
  amount: string;
};

export type ShipmentCost = {
  grandTotal: string;
  total: string | null;
  serviceTax: string | null;
  charges: ShipmentCharge[];
};
