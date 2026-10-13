import type { AccountStatus } from "@/lib/db/constants";

export const INITIAL_ADMIN = {
  name: "Manjeet Chandra",
  email: "majormchandra@gmail.com",
  phone: "8252945156",
  roleKey: "SUPER_ADMIN",
  status: "ACTIVE",
} as const satisfies {
  name: string;
  email: string;
  phone: string;
  roleKey: "SUPER_ADMIN";
  status: AccountStatus;
};

export type AdminIdentity = {
  name: string;
  email: string;
  phone: string;
  roleKey: string;
  status: string;
};

export type BootstrapDecision =
  | { action: "create" }
  | { action: "already_provisioned" }
  | { action: "stop"; reason: string };

export function decideBootstrap(existing: AdminIdentity | null, expected: AdminIdentity): BootstrapDecision {
  if (!existing) {
    return { action: "create" };
  }

  const matches =
    existing.email === expected.email &&
    existing.name === expected.name &&
    existing.phone === expected.phone &&
    existing.roleKey === expected.roleKey &&
    existing.status === expected.status;

  if (matches) {
    return { action: "already_provisioned" };
  }

  return {
    action: "stop",
    reason:
      "A user with this email already exists and does not match the expected initial administrator. No identity or privilege changes were made.",
  };
}
