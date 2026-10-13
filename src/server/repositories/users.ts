import { and, count, desc, eq, ilike, isNull, or } from "drizzle-orm";
import type { AccountStatus } from "@/lib/db/constants";
import type { DbClient } from "@/lib/db/executor";
import { roles, users } from "@/lib/db/schema";
import { PAGE_SIZE } from "@/lib/auth/cookies";
import { escapeLike } from "@/lib/validation/search";

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  roleKey: string;
  roleName: string;
  status: AccountStatus;
  createdAt: Date;
  lastLoginAt: Date | null;
  mfaEnabled: boolean;
};

export async function listUsers(
  db: DbClient,
  input: { query: string; page: number },
): Promise<{ users: ManagedUser[]; total: number }> {
  const filters = [isNull(users.deletedAt)];
  if (input.query) {
    const pattern = `%${escapeLike(input.query)}%`;
    const search = or(ilike(users.name, pattern), ilike(users.email, pattern), ilike(users.phone, pattern));
    if (search) {
      filters.push(search);
    }
  }
  const where = and(...filters);
  const offset = (input.page - 1) * PAGE_SIZE;

  const [rows, totals] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        roleKey: roles.key,
        roleName: roles.name,
        status: users.status,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        mfaEnabled: users.mfaEnabled,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(users).where(where),
  ]);

  return { users: rows, total: totals[0]?.total ?? 0 };
}

export async function findManagedUser(db: DbClient, userId: string): Promise<ManagedUser | null> {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      roleKey: roles.key,
      roleName: roles.name,
      status: users.status,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      mfaEnabled: users.mfaEnabled,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  return row ?? null;
}

export async function findUserForUpdate(db: DbClient, userId: string): Promise<ManagedUser | null> {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      roleKey: roles.key,
      roleName: roles.name,
      status: users.status,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      mfaEnabled: users.mfaEnabled,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1)
    .for("update");

  return row ?? null;
}

export async function listActiveSuperAdminIds(db: DbClient): Promise<string[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(roles.key, "SUPER_ADMIN"), eq(users.status, "ACTIVE"), isNull(users.deletedAt)))
    .for("update");

  return rows.map((row) => row.id);
}

export async function insertManagedUser(
  db: DbClient,
  input: {
    name: string;
    email: string;
    phone: string;
    passwordHash: string;
    roleId: string;
    status: AccountStatus;
    emailVerifiedAt: Date | null;
    passwordChangedAt: Date | null;
  },
): Promise<{ id: string }> {
  const [row] = await db
    .insert(users)
    .values({
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash: input.passwordHash,
      roleId: input.roleId,
      status: input.status,
      emailVerifiedAt: input.emailVerifiedAt,
      passwordChangedAt: input.passwordChangedAt,
      mfaEnabled: false,
    })
    .returning({ id: users.id });

  if (!row) {
    throw new Error("User insert did not return an id.");
  }
  return row;
}

export async function updateUserRole(db: DbClient, userId: string, roleId: string): Promise<void> {
  await db.update(users).set({ roleId, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function updateUserStatus(db: DbClient, userId: string, status: AccountStatus): Promise<void> {
  await db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function markUserLogin(db: DbClient, userId: string, at: Date): Promise<void> {
  await db.update(users).set({ lastLoginAt: at, updatedAt: at }).where(eq(users.id, userId));
}
