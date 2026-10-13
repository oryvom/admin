import { eq } from "drizzle-orm";
import type { DbClient } from "@/lib/db/executor";
import { permissions, rolePermissions, roles } from "@/lib/db/schema";
import { ROLE_DEFINITIONS, type PermissionKey } from "@/server/policies/permissions";

export async function ensureRoleCatalog(db: DbClient): Promise<void> {
  const permissionIds = new Map<PermissionKey, string>();
  const permissionRows = Object.entries(ROLE_DEFINITIONS).flatMap(([, role]) => role.permissions);
  const uniquePermissions = [...new Set(permissionRows)];

  for (const key of uniquePermissions) {
    const description = key;
    const [inserted] = await db
      .insert(permissions)
      .values({ key, name: key, description })
      .onConflictDoNothing({ target: permissions.key })
      .returning({ id: permissions.id });

    if (inserted) {
      permissionIds.set(key, inserted.id);
      continue;
    }

    const [existing] = await db
      .select({ id: permissions.id })
      .from(permissions)
      .where(eq(permissions.key, key))
      .limit(1);
    if (!existing) {
      throw new Error("Permission catalog could not be loaded.");
    }
    permissionIds.set(key, existing.id);
  }

  for (const [key, definition] of Object.entries(ROLE_DEFINITIONS)) {
    const [inserted] = await db
      .insert(roles)
      .values({ key, name: definition.name, description: definition.description })
      .onConflictDoNothing({ target: roles.key })
      .returning({ id: roles.id });

    const roleId = inserted?.id ?? (await findRoleId(db, key));
    if (!roleId) {
      throw new Error("Role catalog could not be loaded.");
    }

    for (const permissionKey of definition.permissions) {
      const permissionId = permissionIds.get(permissionKey);
      if (!permissionId) {
        throw new Error("Permission catalog is incomplete.");
      }
      await db
        .insert(rolePermissions)
        .values({ roleId, permissionId })
        .onConflictDoNothing();
    }
  }
}

export async function findRoleByKey(db: DbClient, key: string): Promise<{ id: string; key: string; name: string } | null> {
  const [role] = await db
    .select({ id: roles.id, key: roles.key, name: roles.name })
    .from(roles)
    .where(eq(roles.key, key))
    .limit(1);
  return role ?? null;
}

export async function listRoles(db: DbClient): Promise<{ key: string; name: string }[]> {
  return db.select({ key: roles.key, name: roles.name }).from(roles).orderBy(roles.name);
}

async function findRoleId(db: DbClient, key: string): Promise<string | null> {
  const role = await findRoleByKey(db, key);
  return role?.id ?? null;
}
