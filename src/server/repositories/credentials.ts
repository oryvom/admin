import { and, eq, isNull } from "drizzle-orm";
import type { AccountStatus } from "@/lib/db/constants";
import type { DbClient } from "@/lib/db/executor";
import { roles, users } from "@/lib/db/schema";

export type UserCredentials = {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  status: AccountStatus;
  roleKey: string;
  roleId: string;
  mfaEnabled: boolean;
};

export async function findUserCredentialsByEmail(db: DbClient, email: string): Promise<UserCredentials | null> {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      passwordHash: users.passwordHash,
      status: users.status,
      roleKey: roles.key,
      roleId: users.roleId,
      mfaEnabled: users.mfaEnabled,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);

  return row ?? null;
}

export async function findUserCredentialsByPhone(db: DbClient, phone: string): Promise<UserCredentials | null> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      passwordHash: users.passwordHash,
      status: users.status,
      roleKey: roles.key,
      roleId: users.roleId,
      mfaEnabled: users.mfaEnabled,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.phone, phone), isNull(users.deletedAt)))
    .limit(2);

  return rows.length === 1 ? rows[0] ?? null : null;
}

export async function findUserCredentialsById(db: DbClient, userId: string): Promise<UserCredentials | null> {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      passwordHash: users.passwordHash,
      status: users.status,
      roleKey: roles.key,
      roleId: users.roleId,
      mfaEnabled: users.mfaEnabled,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  return row ?? null;
}
