import { and, eq, isNull, sql } from "drizzle-orm";
import { IDLE_SESSION_MS } from "@/lib/auth/cookies";
import type { AccountStatus } from "@/lib/db/constants";
import type { DbClient } from "@/lib/db/executor";
import { permissions, rolePermissions, roles, sessions, users } from "@/lib/db/schema";
import { ALL_PERMISSIONS, type PermissionKey } from "@/server/policies/permissions";

export type SessionUser = {
  sessionId: string;
  sessionExpiresAt: Date;
  idleExpiresAt: Date;
  lastActivityAt: Date;
  userId: string;
  name: string;
  email: string;
  phone: string;
  status: AccountStatus;
  roleKey: string;
  roleName: string;
  mfaEnabled: boolean;
  permissions: PermissionKey[];
};

export async function insertSession(
  db: DbClient,
  input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    idleExpiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
    requestId: string;
  },
): Promise<{ id: string }> {
  const [row] = await db
    .insert(sessions)
    .values({
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      idleExpiresAt: input.idleExpiresAt,
      lastActivityAt: new Date(),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      requestId: input.requestId,
    })
    .returning({ id: sessions.id });

  if (!row) {
    throw new Error("Session insert did not return an id.");
  }
  return row;
}

export async function findSessionUser(db: DbClient, tokenHash: string): Promise<SessionUser | null> {
  const rows = await db
    .select({
      sessionId: sessions.id,
      sessionExpiresAt: sessions.expiresAt,
      idleExpiresAt: sessions.idleExpiresAt,
      lastActivityAt: sessions.lastActivityAt,
      revokedAt: sessions.revokedAt,
      userId: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      status: users.status,
      deletedAt: users.deletedAt,
      roleKey: roles.key,
      roleName: roles.name,
      mfaEnabled: users.mfaEnabled,
      permissionKey: permissions.key,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(sessions.tokenHash, tokenHash));

  const first = rows[0];
  if (!first || first.revokedAt || first.deletedAt) {
    return null;
  }

  const now = Date.now();
  if (first.sessionExpiresAt.getTime() <= now || first.idleExpiresAt.getTime() <= now) {
    return null;
  }

  const permissionKeys = new Set<PermissionKey>();
  for (const row of rows) {
    if (row.permissionKey && isPermissionKey(row.permissionKey)) {
      permissionKeys.add(row.permissionKey);
    }
  }

  return {
    sessionId: first.sessionId,
    sessionExpiresAt: first.sessionExpiresAt,
    idleExpiresAt: first.idleExpiresAt,
    lastActivityAt: first.lastActivityAt,
    userId: first.userId,
    name: first.name,
    email: first.email,
    phone: first.phone,
    status: first.status,
    roleKey: first.roleKey,
    roleName: first.roleName,
    mfaEnabled: first.mfaEnabled,
    permissions: [...permissionKeys],
  };
}

export async function revokeSessionByHash(db: DbClient, tokenHash: string): Promise<string | null> {
  const [row] = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)))
    .returning({ userId: sessions.userId });
  return row?.userId ?? null;
}

export async function revokeSessionsForUser(db: DbClient, userId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

function isPermissionKey(value: string): value is PermissionKey {
  if (ALL_PERMISSIONS.some((permission) => permission === value)) {
    return true;
  }
  // Keep a permission the database already granted even when this process
  // loaded the catalog before that permission was added.
  return /^[a-z]+(?:\.[a-z0-9_]+)+$/.test(value);
}

export async function touchSession(db: DbClient, sessionId: string, absoluteExpiresAt: Date): Promise<void> {
  const now = new Date();
  const idleExpiresAt = new Date(Math.min(now.getTime() + IDLE_SESSION_MS, absoluteExpiresAt.getTime()));
  await db
    .update(sessions)
    .set({ lastActivityAt: now, idleExpiresAt })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt), sql`${sessions.expiresAt} > ${now}`));
}
