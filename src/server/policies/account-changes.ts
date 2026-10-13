import type { AccountStatus, RoleKey } from "@/lib/db/constants";
import { type PermissionKey, hasPermission } from "@/server/policies/permissions";

export type RoleChangeDecision =
  | { ok: true }
  | { ok: false; reason: "self" | "forbidden" | "last_super_admin" | "same_role" | "unknown_role" };

export function evaluateRoleChange(input: {
  actorId: string;
  actorPermissions: ReadonlySet<PermissionKey>;
  targetId: string;
  targetRoleKey: string;
  targetStatus: AccountStatus;
  nextRoleKey: string;
  activeSuperAdminIds: readonly string[];
}): RoleChangeDecision {
  if (!hasPermission(input.actorPermissions, "users.change_role")) {
    return { ok: false, reason: "forbidden" };
  }
  if (input.actorId === input.targetId) {
    return { ok: false, reason: "self" };
  }
  if (!isRoleKey(input.nextRoleKey)) {
    return { ok: false, reason: "unknown_role" };
  }
  if (input.nextRoleKey === "SUPER_ADMIN" && !hasPermission(input.actorPermissions, "users.grant_super_admin")) {
    return { ok: false, reason: "forbidden" };
  }
  if (input.targetRoleKey === input.nextRoleKey) {
    return { ok: false, reason: "same_role" };
  }
  if (removesLastActiveSuperAdmin(input.targetId, input.targetRoleKey, input.targetStatus, input.nextRoleKey, "ACTIVE", input.activeSuperAdminIds)) {
    return { ok: false, reason: "last_super_admin" };
  }
  return { ok: true };
}

export type SuspensionDecision =
  | { ok: true }
  | { ok: false; reason: "self" | "forbidden" | "last_super_admin" | "same_status" };

export function evaluateSuspension(input: {
  actorId: string;
  actorPermissions: ReadonlySet<PermissionKey>;
  targetId: string;
  targetRoleKey: string;
  targetStatus: AccountStatus;
  nextStatus: "ACTIVE" | "SUSPENDED";
  activeSuperAdminIds: readonly string[];
}): SuspensionDecision {
  if (!hasPermission(input.actorPermissions, "users.suspend")) {
    return { ok: false, reason: "forbidden" };
  }
  if (input.actorId === input.targetId) {
    return { ok: false, reason: "self" };
  }
  if (input.targetStatus === input.nextStatus) {
    return { ok: false, reason: "same_status" };
  }
  if (
    input.nextStatus === "SUSPENDED" &&
    removesLastActiveSuperAdmin(
      input.targetId,
      input.targetRoleKey,
      input.targetStatus,
      input.targetRoleKey,
      "SUSPENDED",
      input.activeSuperAdminIds,
    )
  ) {
    return { ok: false, reason: "last_super_admin" };
  }
  return { ok: true };
}

export function evaluateCreateUser(input: {
  actorPermissions: ReadonlySet<PermissionKey>;
  nextRoleKey: string;
}): { ok: true } | { ok: false; reason: "forbidden" | "unknown_role" } {
  if (!hasPermission(input.actorPermissions, "users.create")) {
    return { ok: false, reason: "forbidden" };
  }
  if (!isRoleKey(input.nextRoleKey)) {
    return { ok: false, reason: "unknown_role" };
  }
  if (input.nextRoleKey === "SUPER_ADMIN" && !hasPermission(input.actorPermissions, "users.grant_super_admin")) {
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true };
}

function removesLastActiveSuperAdmin(
  targetId: string,
  targetRoleKey: string,
  targetStatus: AccountStatus,
  nextRoleKey: string,
  nextStatus: AccountStatus,
  activeSuperAdminIds: readonly string[],
): boolean {
  const targetIsActiveSuperAdmin = targetRoleKey === "SUPER_ADMIN" && targetStatus === "ACTIVE";
  const nextIsActiveSuperAdmin = nextRoleKey === "SUPER_ADMIN" && nextStatus === "ACTIVE";
  if (!targetIsActiveSuperAdmin || nextIsActiveSuperAdmin) {
    return false;
  }
  const others = activeSuperAdminIds.filter((id) => id !== targetId);
  return others.length === 0;
}

function isRoleKey(value: string): value is RoleKey {
  return value === "SUPER_ADMIN" || value === "ADMIN" || value === "STAFF";
}
