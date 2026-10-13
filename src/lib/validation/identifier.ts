import { emailSchema } from "@/lib/validation/email";
import { phoneSchema } from "@/lib/validation/phone";

export type LoginIdentifier = { kind: "email"; email: string } | { kind: "phone"; phone: string };

export function parseLoginIdentifier(value: string): LoginIdentifier | null {
  const trimmed = value.trim();
  if (trimmed.includes("@")) {
    const parsed = emailSchema.safeParse(trimmed);
    return parsed.success ? { kind: "email", email: parsed.data } : null;
  }
  const parsed = phoneSchema.safeParse(trimmed);
  return parsed.success ? { kind: "phone", phone: parsed.data } : null;
}
