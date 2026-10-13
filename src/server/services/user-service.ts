import { hashRandomSecret } from "@/lib/auth/password";
import { createUserSchema } from "@/features/users/schema";
import { getDb } from "@/lib/db/client";
import { isUniqueViolation } from "@/lib/db/errors";
import type { AccountStatus } from "@/lib/db/constants";
import type { RequestContext } from "@/lib/security/request";
import { insertAuditLog } from "@/server/repositories/audit-logs";
import { findRoleByKey, listRoles } from "@/server/repositories/roles";
import { revokeSessionsForUser } from "@/server/repositories/sessions";
import {
  findManagedUser,
  findUserForUpdate,
  insertManagedUser,
  listActiveSuperAdminIds,
  listUsers,
  updateUserRole,
  updateUserStatus,
  type ManagedUser,
} from "@/server/repositories/users";
import { evaluateCreateUser, evaluateRoleChange, evaluateSuspension } from "@/server/policies/account-changes";
import type { CurrentUser } from "@/server/auth/current-user";
import { hasPermission, type PermissionKey } from "@/server/policies/permissions";
export async function getUserPage(query: string, page: number): Promise<{ users: ManagedUser[]; total: number }> {
  return listUsers(getDb(), { query, page });
}

export async function getUserDetail(userId: string): Promise<ManagedUser | null> {
  return findManagedUser(getDb(), userId);
}

export async function getAssignableRoles(permissions: ReadonlySet<PermissionKey>): Promise<{ key: string; name: string }[]> {
  const roles = await listRoles(getDb());
  return roles.filter((role) => evaluateCreateUser({ actorPermissions: permissions, nextRoleKey: role.key }).ok);
}

export async function createUserAccount(input: {
  actor: CurrentUser;
  values: unknown;
  context: RequestContext;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const parsed = createUserSchema.safeParse(input.values);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the account details and try again." };
  }
  const decision = evaluateCreateUser({
    actorPermissions: input.actor.permissions,
    nextRoleKey: parsed.data.roleKey,
  });
  if (!decision.ok) {
    return { ok: false, message: "You do not have permission to create that account." };
  }

  const db = getDb();
  const role = await findRoleByKey(db, parsed.data.roleKey);
  if (!role) {
    return { ok: false, message: "That role is not available." };
  }

  const passwordHash = await hashRandomSecret();
  try {
    const created = await db.transaction(async (tx) => {
      const user = await insertManagedUser(tx, {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        passwordHash,
        roleId: role.id,
        status: "ACTIVE",
        emailVerifiedAt: null,
        passwordChangedAt: new Date(),
      });
      await insertAuditLog(tx, {
        actorUserId: input.actor.id,
        action: "user.created",
        entityType: "user",
        entityId: user.id,
        requestId: input.context.requestId,
        metadata: { role: role.key },
        outcome: "success",
      });
      return user;
    });
    return { ok: true, id: created.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, message: "An account with that email already exists." };
    }
    throw error;
  }
}

export async function changeUserRole(input: {
  actor: CurrentUser;
  targetId: string;
  nextRoleKey: string;
  context: RequestContext;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!hasPermission(input.actor.permissions, "users.change_role")) {
    return { ok: false, message: "You do not have permission to change roles." };
  }

  const db = getDb();
  return db.transaction(async (tx) => {
    const target = await findUserForUpdate(tx, input.targetId);
    if (!target) {
      return { ok: false, message: "That account was not found." };
    }
    const activeSuperAdminIds = await listActiveSuperAdminIds(tx);
    const decision = evaluateRoleChange({
      actorId: input.actor.id,
      actorPermissions: input.actor.permissions,
      targetId: target.id,
      targetRoleKey: target.roleKey,
      targetStatus: target.status,
      nextRoleKey: input.nextRoleKey,
      activeSuperAdminIds,
    });
    if (!decision.ok) {
      return { ok: false, message: roleChangeMessage(decision.reason) };
    }
    const role = await findRoleByKey(tx, input.nextRoleKey);
    if (!role) {
      return { ok: false, message: "That role is not available." };
    }
    await updateUserRole(tx, target.id, role.id);
    await revokeSessionsForUser(tx, target.id);
    await insertAuditLog(tx, {
      actorUserId: input.actor.id,
      action: "user.role_changed",
      entityType: "user",
      entityId: target.id,
      requestId: input.context.requestId,
      metadata: { previousRole: target.roleKey, nextRole: role.key },
      outcome: "success",
    });
    return { ok: true };
  });
}

export async function setUserStatus(input: {
  actor: CurrentUser;
  targetId: string;
  nextStatus: Extract<AccountStatus, "ACTIVE" | "SUSPENDED">;
  context: RequestContext;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const target = await findUserForUpdate(tx, input.targetId);
    if (!target) {
      return { ok: false, message: "That account was not found." };
    }
    const activeSuperAdminIds = await listActiveSuperAdminIds(tx);
    const decision = evaluateSuspension({
      actorId: input.actor.id,
      actorPermissions: input.actor.permissions,
      targetId: target.id,
      targetRoleKey: target.roleKey,
      targetStatus: target.status,
      nextStatus: input.nextStatus,
      activeSuperAdminIds,
    });
    if (!decision.ok) {
      return { ok: false, message: suspensionMessage(decision.reason) };
    }
    await updateUserStatus(tx, target.id, input.nextStatus);
    if (input.nextStatus === "SUSPENDED") {
      await revokeSessionsForUser(tx, target.id);
    }
    await insertAuditLog(tx, {
      actorUserId: input.actor.id,
      action: input.nextStatus === "SUSPENDED" ? "user.suspended" : "user.reactivated",
      entityType: "user",
      entityId: target.id,
      requestId: input.context.requestId,
      metadata: { status: input.nextStatus },
      outcome: "success",
    });
    return { ok: true };
  });
}

function roleChangeMessage(reason: "self" | "forbidden" | "last_super_admin" | "same_role" | "unknown_role"): string {
  switch (reason) {
    case "self":
      return "You cannot change your own role.";
    case "last_super_admin":
      return "The last active Super Admin cannot be changed.";
    case "same_role":
      return "That account already has this role.";
    case "unknown_role":
      return "That role is not available.";
    case "forbidden":
      return "You do not have permission to make that change.";
  }
}

function suspensionMessage(reason: "self" | "forbidden" | "last_super_admin" | "same_status"): string {
  switch (reason) {
    case "self":
      return "You cannot change your own account status.";
    case "last_super_admin":
      return "The last active Super Admin cannot be suspended.";
    case "same_status":
      return "That account already has this status.";
    case "forbidden":
      return "You do not have permission to change account status.";
  }
}
