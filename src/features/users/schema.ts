import { z } from "zod";
import { emailSchema } from "@/lib/validation/email";
import { phoneSchema } from "@/lib/validation/phone";

export const userNameSchema = z
  .string()
  .trim()
  .min(2, { error: "Enter the person's full name." })
  .max(120, { error: "Use a shorter name." })
  .refine((value) => !/[\u0000-\u001F]/.test(value), { error: "Enter a valid name." });

export const createUserSchema = z.object({
  name: userNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  roleKey: z.string().trim().min(1, { error: "Choose a role." }),
});

export const roleChangeSchema = z.object({
  userId: z.uuid({ error: "Choose a valid account." }),
  roleKey: z.string().trim().min(1, { error: "Choose a role." }),
});

export const statusChangeSchema = z.object({
  userId: z.uuid({ error: "Choose a valid account." }),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

export type CreateUserValues = z.infer<typeof createUserSchema>;
