import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INITIAL_ADMIN } from "@/server/policies/bootstrap";

const databaseUrl = process.env.TEST_DATABASE_URL;
const enabled =
  process.env.ALLOW_DB_TESTS === "true" &&
  Boolean(databaseUrl) &&
  /test/i.test(databaseUrl ?? "") &&
  !/prod/i.test(databaseUrl ?? "");

const password = "Correct-Horse-Battery-1";

describe.skipIf(!enabled)("database integration", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    if (!process.env.SESSION_HASH_SECRET || process.env.SESSION_HASH_SECRET.length < 32) {
      process.env.SESSION_HASH_SECRET = "integration-test-session-hash-secret-32";
    }
    if (!process.env.FIELD_ENCRYPTION_KEY) {
      process.env.FIELD_ENCRYPTION_KEY = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");
    }
    const { resetServerEnvCache } = await import("@/lib/config/env");
    resetServerEnvCache();
    const { getDb } = await import("@/lib/db/client");
    const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
    const db = getDb("admin");
    await migrate(db, { migrationsFolder: "./drizzle" });
    await truncateApplicationTables();
  });

  afterAll(async () => {
    const { closeDb } = await import("@/lib/db/client");
    await closeDb();
  });

  it("stops when the email belongs to a different identity", async () => {
    const { hashPassword } = await import("@/lib/auth/password");
    const { getDb } = await import("@/lib/db/client");
    const { ensureRoleCatalog, findRoleByKey } = await import("@/server/repositories/roles");
    const { insertManagedUser } = await import("@/server/repositories/users");
    const { provisionInitialAdmin } = await import("@/server/services/bootstrap-service");
    const db = getDb("admin");
    await ensureRoleCatalog(db);
    const staff = await findRoleByKey(db, "STAFF");
    if (!staff) {
      throw new Error("STAFF role was not created.");
    }
    await insertManagedUser(db, {
      name: "Existing Person",
      email: INITIAL_ADMIN.email,
      phone: "9999999999",
      passwordHash: await hashPassword(password),
      roleId: staff.id,
      status: "ACTIVE",
      emailVerifiedAt: null,
      passwordChangedAt: null,
    });

    const result = await provisionInitialAdmin();
    expect(result.status).toBe("stopped");

    const { findUserCredentialsByEmail } = await import("@/server/repositories/credentials");
    const existing = await findUserCredentialsByEmail(db, INITIAL_ADMIN.email);
    expect(existing?.name).toBe("Existing Person");
    expect(existing?.roleKey).toBe("STAFF");
    await truncateApplicationTables();
  });

  it("creates the initial administrator with a database uuid and an argon2id hash", async () => {
    const { getDb } = await import("@/lib/db/client");
    const { users, auditLogs, rolePermissions, roles, permissions } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const { provisionInitialAdmin } = await import("@/server/services/bootstrap-service");
    const { findUserCredentialsByEmail } = await import("@/server/repositories/credentials");
    const { verifyPassword } = await import("@/lib/auth/password");

    const created = await provisionInitialAdmin();
    expect(created.status).toBe("created");
    if (created.status !== "created") {
      return;
    }
    expect(created.email).toBe(INITIAL_ADMIN.email);
    expect(created.role).toBe("SUPER_ADMIN");
    expect(created.accountStatus).toBe("ACTIVE");
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);

    const db = getDb("admin");
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, created.id));
    expect(row?.id).toBe(created.id);

    const credentials = await findUserCredentialsByEmail(db, INITIAL_ADMIN.email);
    expect(credentials?.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(credentials?.passwordHash).not.toBe("");
    expect(await verifyPassword(password, credentials?.passwordHash ?? "")).toBe(false);

    const audits = await db.select({ action: auditLogs.action }).from(auditLogs);
    expect(audits.map((entry) => entry.action)).toContain("bootstrap.super_admin_created");

    const assigned = await db
      .select({ key: permissions.key })
      .from(rolePermissions)
      .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(roles.key, "SUPER_ADMIN"));
    expect(assigned.length).toBeGreaterThan(0);
  });

  it("does not reset the password when bootstrap runs again", async () => {
    const { getDb } = await import("@/lib/db/client");
    const { provisionInitialAdmin } = await import("@/server/services/bootstrap-service");
    const { findUserCredentialsByEmail } = await import("@/server/repositories/credentials");
    const db = getDb("admin");
    const before = await findUserCredentialsByEmail(db, INITIAL_ADMIN.email);
    const again = await provisionInitialAdmin();
    expect(again.status).toBe("already_provisioned");
    if (again.status === "already_provisioned") {
      expect(again.id).toBe(before?.id);
    }
    const after = await findUserCredentialsByEmail(db, INITIAL_ADMIN.email);
    expect(after?.passwordHash).toBe(before?.passwordHash);
    expect(after?.roleKey).toBe("SUPER_ADMIN");
  });

  it("records a successful login code without storing the code or session token", async () => {
    const code = "246810";
    const challenge = "integration-challenge-token";
    const { getServerEnv } = await import("@/lib/config/env");
    const { hashScopedValue } = await import("@/lib/security/tokens");
    const { getDb } = await import("@/lib/db/client");
    const { findUserCredentialsByEmail } = await import("@/server/repositories/credentials");
    const { insertLoginOtp } = await import("@/server/repositories/login-otps");
    const { verifyLoginOtp } = await import("@/server/services/login-otp-service");
    const { loginEvents, sessions } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const env = getServerEnv();
    const db = getDb("admin");
    const user = await findUserCredentialsByEmail(db, INITIAL_ADMIN.email);
    if (!user) {
      throw new Error("Expected the bootstrapped administrator.");
    }
    await insertLoginOtp(db, {
      userId: user.id,
      codeHash: hashScopedValue("login-otp", code, env.SESSION_HASH_SECRET),
      challengeHash: hashScopedValue("login-otp-challenge", challenge, env.SESSION_HASH_SECRET),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: null,
      userAgent: "vitest",
      requestId: crypto.randomUUID(),
    });
    const result = await verifyLoginOtp({
      code,
      challengeToken: challenge,
      presentedSessionToken: null,
      context: requestContext(),
    });
    expect(result.status).toBe("success");
    if (result.status !== "success") {
      return;
    }
    const events = await db.select().from(loginEvents).where(eq(loginEvents.eventType, "login_succeeded"));
    expect(events.length).toBeGreaterThan(0);
    expect(JSON.stringify(events)).not.toContain(result.token);
    expect(JSON.stringify(events)).not.toContain(code);
    const stored = await db.select({ tokenHash: sessions.tokenHash }).from(sessions);
    expect(stored.some((session) => session.tokenHash === result.token)).toBe(false);
  });

  it("records an invalid login code", async () => {
    const challenge = "integration-challenge-token-wrong";
    const { getServerEnv } = await import("@/lib/config/env");
    const { hashScopedValue } = await import("@/lib/security/tokens");
    const { getDb } = await import("@/lib/db/client");
    const { findUserCredentialsByEmail } = await import("@/server/repositories/credentials");
    const { insertLoginOtp } = await import("@/server/repositories/login-otps");
    const { verifyLoginOtp } = await import("@/server/services/login-otp-service");
    const { loginEvents } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const env = getServerEnv();
    const db = getDb("admin");
    const user = await findUserCredentialsByEmail(db, INITIAL_ADMIN.email);
    if (!user) {
      throw new Error("Expected the bootstrapped administrator.");
    }
    await insertLoginOtp(db, {
      userId: user.id,
      codeHash: hashScopedValue("login-otp", "135790", env.SESSION_HASH_SECRET),
      challengeHash: hashScopedValue("login-otp-challenge", challenge, env.SESSION_HASH_SECRET),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: null,
      userAgent: "vitest",
      requestId: crypto.randomUUID(),
    });
    const result = await verifyLoginOtp({
      code: "000000",
      challengeToken: challenge,
      presentedSessionToken: null,
      context: requestContext(),
    });
    expect(result.status).toBe("invalid");
    const events = await db.select().from(loginEvents).where(eq(loginEvents.failureCode, "otp_invalid"));
    expect(events.length).toBeGreaterThan(0);
    expect(JSON.stringify(events)).not.toContain("135790");
  });

  it("does not sign in a suspended account with a valid code", async () => {
    const code = "112233";
    const challenge = "integration-challenge-token-suspended";
    const { getServerEnv } = await import("@/lib/config/env");
    const { hashScopedValue } = await import("@/lib/security/tokens");
    const { getDb } = await import("@/lib/db/client");
    const { updateUserStatus } = await import("@/server/repositories/users");
    const { findUserCredentialsByEmail } = await import("@/server/repositories/credentials");
    const { insertLoginOtp } = await import("@/server/repositories/login-otps");
    const { verifyLoginOtp } = await import("@/server/services/login-otp-service");
    const { loginEvents } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const env = getServerEnv();
    const db = getDb("admin");
    const user = await findUserCredentialsByEmail(db, INITIAL_ADMIN.email);
    if (!user) {
      throw new Error("Expected the bootstrapped administrator.");
    }
    await insertLoginOtp(db, {
      userId: user.id,
      codeHash: hashScopedValue("login-otp", code, env.SESSION_HASH_SECRET),
      challengeHash: hashScopedValue("login-otp-challenge", challenge, env.SESSION_HASH_SECRET),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: null,
      userAgent: "vitest",
      requestId: crypto.randomUUID(),
    });
    await updateUserStatus(db, user.id, "SUSPENDED");
    const result = await verifyLoginOtp({
      code,
      challengeToken: challenge,
      presentedSessionToken: null,
      context: requestContext(),
    });
    expect(result.status).toBe("invalid");
    const events = await db.select().from(loginEvents).where(eq(loginEvents.failureCode, "account_unavailable"));
    expect(events.length).toBeGreaterThan(0);
    await updateUserStatus(db, user.id, "ACTIVE");
  });

  it("rolls back a failed transaction", async () => {
    const { getDb } = await import("@/lib/db/client");
    const { auditLogs } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const { insertAuditLog } = await import("@/server/repositories/audit-logs");
    const db = getDb("admin");
    await expect(
      db.transaction(async (tx) => {
        await insertAuditLog(tx, {
          actorUserId: null,
          action: "test.rollback",
          entityType: "user",
          entityId: null,
          requestId: "integration-rollback",
          outcome: "failure",
        });
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    const rows = await db.select({ id: auditLogs.id }).from(auditLogs).where(eq(auditLogs.action, "test.rollback"));
    expect(rows).toHaveLength(0);
  });

  it("rejects updates to audit logs", async () => {
    const { getDb } = await import("@/lib/db/client");
    const db = getDb("admin");
    await expect(
      db.execute(sql`update audit_logs set action = 'tampered' where action = 'bootstrap.super_admin_created'`),
    ).rejects.toThrow(/append-only/i);
  });
});

async function truncateApplicationTables(): Promise<void> {
  const { getDb } = await import("@/lib/db/client");
  await getDb("admin").execute(sql`
    TRUNCATE TABLE
      office_documents,
      offices,
      company_documents,
      company_profiles,
      login_otps,
      mfa_recovery_codes,
      mfa_challenges,
      mfa_factors,
      sessions,
      login_events,
      audit_logs,
      auth_rate_limits,
      users,
      role_permissions,
      roles,
      permissions
    RESTART IDENTITY CASCADE
  `);
}

function requestContext() {
  return {
    ipAddress: "203.0.113.10",
    userAgent: "vitest",
    requestId: crypto.randomUUID(),
  };
}
