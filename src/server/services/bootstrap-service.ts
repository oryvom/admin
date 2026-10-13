import { sql } from "drizzle-orm";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getDb } from "@/lib/db/client";
import { isUniqueViolation } from "@/lib/db/errors";
import { expectedMigrationCount } from "@/lib/db/migrations";
import { generateOpaqueToken } from "@/lib/security/tokens";
import { findUserCredentialsByEmail } from "@/server/repositories/credentials";
import { insertAuditLog } from "@/server/repositories/audit-logs";
import { ensureRoleCatalog, findRoleByKey } from "@/server/repositories/roles";
import { findManagedUser, insertManagedUser } from "@/server/repositories/users";
import { decideBootstrap, INITIAL_ADMIN, type AdminIdentity } from "@/server/policies/bootstrap";

export type BootstrapResult =
  | {
      status: "created" | "already_provisioned";
      id: string;
      email: string;
      role: string;
      accountStatus: string;
    }
  | { status: "absent" }
  | {
      status: "stopped";
      reason: string;
      existingRole: string | null;
      existingStatus: string | null;
    };

export async function inspectInitialAdmin(): Promise<BootstrapResult> {
  const db = getDb("admin");
  await assertMigrationsApplied(db);
  const existing = await findManagedUserByEmail(INITIAL_ADMIN.email);
  const decision = decideBootstrap(existing, INITIAL_ADMIN);
  if (decision.action === "create") {
    return { status: "absent" };
  }
  if (decision.action === "already_provisioned" && existing) {
    return {
      status: "already_provisioned",
      id: existing.id,
      email: existing.email,
      role: existing.roleKey,
      accountStatus: existing.status,
    };
  }
  return {
    status: "stopped",
    reason: decision.action === "stop" ? decision.reason : "The initial administrator could not be inspected.",
    existingRole: existing?.roleKey ?? null,
    existingStatus: existing?.status ?? null,
  };
}

export async function provisionInitialAdmin(): Promise<BootstrapResult> {
  const password = generateOpaqueToken();
  const db = getDb("admin");
  await assertMigrationsApplied(db);
  const existing = await findManagedUserByEmail(INITIAL_ADMIN.email);
  const decision = decideBootstrap(existing, INITIAL_ADMIN);
  if (decision.action === "already_provisioned" && existing) {
    return {
      status: "already_provisioned",
      id: existing.id,
      email: existing.email,
      role: existing.roleKey,
      accountStatus: existing.status,
    };
  }
  if (decision.action === "stop") {
    return {
      status: "stopped",
      reason: decision.reason,
      existingRole: existing?.roleKey ?? null,
      existingStatus: existing?.status ?? null,
    };
  }

  const passwordHash = await hashPassword(password);
  try {
    const outcome = await db.transaction(async (tx) => {
      const raced = await findManagedUserByEmail(INITIAL_ADMIN.email, tx);
      const racedDecision = decideBootstrap(raced, INITIAL_ADMIN);
      if (racedDecision.action === "already_provisioned" && raced) {
        return { kind: "exists" as const, id: raced.id };
      }
      if (racedDecision.action === "stop") {
        return { kind: "conflict" as const };
      }
      await ensureRoleCatalog(tx);
      const role = await findRoleByKey(tx, INITIAL_ADMIN.roleKey);
      if (!role) {
        throw new Error("The Super Admin role was not created.");
      }
      const now = new Date();
      const user = await insertManagedUser(tx, {
        name: INITIAL_ADMIN.name,
        email: INITIAL_ADMIN.email,
        phone: INITIAL_ADMIN.phone,
        passwordHash,
        roleId: role.id,
        status: INITIAL_ADMIN.status,
        emailVerifiedAt: now,
        passwordChangedAt: now,
      });
      await insertAuditLog(tx, {
        actorUserId: user.id,
        action: "bootstrap.super_admin_created",
        entityType: "user",
        entityId: user.id,
        requestId: null,
        metadata: { source: "cli", role: INITIAL_ADMIN.roleKey },
        outcome: "success",
      });
      return { kind: "created" as const, id: user.id };
    });

    if (outcome.kind === "exists") {
      const current = await findManagedUserByEmail(INITIAL_ADMIN.email);
      if (!current) {
        return stopped("The existing account could not be read back.");
      }
      return {
        status: "already_provisioned",
        id: current.id,
        email: current.email,
        role: current.roleKey,
        accountStatus: current.status,
      };
    }
    if (outcome.kind === "conflict") {
      const current = await findManagedUserByEmail(INITIAL_ADMIN.email);
      return {
        status: "stopped",
        reason: "A user with this email already exists and was not changed.",
        existingRole: current?.roleKey ?? null,
        existingStatus: current?.status ?? null,
      };
    }

    return verifyProvisionedAdmin(outcome.id, password);
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
    const current = await findManagedUserByEmail(INITIAL_ADMIN.email);
    const afterRace = decideBootstrap(current, INITIAL_ADMIN);
    if (afterRace.action === "already_provisioned" && current) {
      return {
        status: "already_provisioned",
        id: current.id,
        email: current.email,
        role: current.roleKey,
        accountStatus: current.status,
      };
    }
    return {
      status: "stopped",
      reason: "A user with this email already exists and was not changed.",
      existingRole: current?.roleKey ?? null,
      existingStatus: current?.status ?? null,
    };
  }
}

function stopped(reason: string): BootstrapResult {
  return { status: "stopped", reason, existingRole: null, existingStatus: null };
}

async function verifyProvisionedAdmin(id: string, password: string): Promise<BootstrapResult> {
  const user = await findManagedUser(getDb("admin"), id);
  const credentials = await findUserCredentialsByEmail(getDb("admin"), INITIAL_ADMIN.email);
  if (!user || !credentials || user.id !== credentials.id) {
    return {
      status: "stopped",
      reason: "The administrator record could not be verified after insert.",
      existingRole: user?.roleKey ?? null,
      existingStatus: user?.status ?? null,
    };
  }
  const hashLooksHashed = credentials.passwordHash.startsWith("$argon2id$") && credentials.passwordHash !== password;
  const passwordMatches = hashLooksHashed && (await verifyPassword(password, credentials.passwordHash));
  const identityMatches = decideBootstrap(
    {
      name: user.name,
      email: user.email,
      phone: user.phone,
      roleKey: user.roleKey,
      status: user.status,
    },
    INITIAL_ADMIN,
  );
  if (!passwordMatches || identityMatches.action !== "already_provisioned") {
    return {
      status: "stopped",
      reason: "The administrator record was inserted but failed verification. Inspect the account before trying again.",
      existingRole: user.roleKey,
      existingStatus: user.status,
    };
  }
  return {
    status: "created",
    id: user.id,
    email: user.email,
    role: user.roleKey,
    accountStatus: user.status,
  };
}

async function findManagedUserByEmail(email: string, db = getDb("admin")) {
  const credentials = await findUserCredentialsByEmail(db, email);
  if (!credentials) {
    return null;
  }
  return {
    id: credentials.id,
    name: credentials.name,
    email: credentials.email,
    phone: credentials.phone,
    roleKey: credentials.roleKey,
    status: credentials.status,
  } satisfies AdminIdentity & { id: string };
}

async function assertMigrationsApplied(db: ReturnType<typeof getDb>): Promise<void> {
  let applied = 0;
  try {
    const result = await db.execute<{ count: number }>(
      sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
    );
    const row = result.rows[0];
    applied = row?.count ?? 0;
  } catch {
    throw new Error("Database migrations are not applied. Run npm run db:migrate before creating the administrator.");
  }

  const expected = expectedMigrationCount();
  if (applied < expected) {
    throw new Error("Database migrations are incomplete. Run npm run db:migrate before creating the administrator.");
  }
}
