import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { mfaCookieOptions, sessionCookieOptions } from "@/lib/auth/cookies";
import { parseServerEnv } from "@/lib/config/env";
import { buildContentSecurityPolicy } from "@/lib/security/csp";
import { sanitizeAuditMetadata } from "@/lib/security/audit-metadata";
import { isSameOrigin } from "@/lib/security/origin";
import { accountLockoutMs, ipLockoutMs } from "@/lib/security/rate-limit";
import { safeInternalPath } from "@/lib/security/redirect";
import { generateOpaqueToken, hashSessionToken, safeEqual } from "@/lib/security/tokens";
import { decodeEncryptionKey, encryptField as encrypt, decryptField as decrypt } from "@/lib/security/encryption";
import { emailSchema } from "@/lib/validation/email";
import { parseLoginIdentifier } from "@/lib/validation/identifier";
import { passwordContainsEmail, passwordSchema } from "@/lib/validation/password";
import { phoneSchema } from "@/lib/validation/phone";
import { escapeLike, parsePage, parseSearchQuery } from "@/lib/validation/search";
import { visibleDashboardSections } from "@/features/dashboard/sections";
import { evaluateCreateUser, evaluateRoleChange, evaluateSuspension } from "@/server/policies/account-changes";
import { decideBootstrap, INITIAL_ADMIN } from "@/server/policies/bootstrap";
import { ALL_PERMISSIONS, ROLE_DEFINITIONS } from "@/server/policies/permissions";

const permissions = new Set(ALL_PERMISSIONS);

describe("validation", () => {
  it("normalizes email addresses", () => {
    expect(emailSchema.parse("  MajorMcHandra@Gmail.com ")).toBe("majormchandra@gmail.com");
  });

  it("accepts the initial administrator phone number", () => {
    expect(phoneSchema.parse("8252945156")).toBe("8252945156");
    expect(phoneSchema.safeParse("123").success).toBe(false);
  });

  it("accepts an email or phone as a login identifier", () => {
    expect(parseLoginIdentifier(" MajorMcHandra@Gmail.com ")?.kind).toBe("email");
    expect(parseLoginIdentifier("82529 45156")).toEqual({ kind: "phone", phone: "8252945156" });
    expect(parseLoginIdentifier("not-an-email")).toBeNull();
  });

  it("requires a strong password and rejects the email identity", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("Correct-Horse-Battery-1").success).toBe(true);
    expect(passwordContainsEmail("majormchandra-Extra-1!", "majormchandra@gmail.com")).toBe(true);
  });

  it("parses search and pagination safely", () => {
    expect(parsePage("2")).toBe(2);
    expect(parsePage("-1")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parseSearchQuery("  ada  ")).toBe("ada");
    expect(escapeLike("100%_\\")).toBe("100\\%\\_\\\\");
  });
});

describe("authentication helpers", () => {
  it("hashes passwords with argon2id and verifies them", async () => {
    const password = "Correct-Horse-Battery-1";
    const hashed = await hashPassword(password);
    expect(hashed.startsWith("$argon2id$")).toBe(true);
    expect(hashed).not.toBe(password);
    expect(await verifyPassword(password, hashed)).toBe(true);
    expect(await verifyPassword("wrong-password-1A!", hashed)).toBe(false);
  });

  it("stores only a hash of the session token", () => {
    const token = generateOpaqueToken();
    const hashed = hashSessionToken(token, "x".repeat(48));
    expect(hashed).not.toBe(token);
    expect(hashed).toHaveLength(43);
  });

  it("sets httpOnly lax session cookies and restricts the mfa cookie path", () => {
    const expires = new Date("2030-01-01T00:00:00Z");
    const session = sessionCookieOptions(expires, true);
    expect(session).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    expect(mfaCookieOptions(expires, false).path).toBe("/login");
  });

  it("uses one generic class of redirect targets", () => {
    expect(safeInternalPath("/users?q=ada")).toBe("/users?q=ada");
    expect(safeInternalPath("https://evil.example")).toBe("/dashboard");
    expect(safeInternalPath("//evil.example")).toBe("/dashboard");
    expect(safeInternalPath("/login")).toBe("/dashboard");
    expect(safeInternalPath("/\\evil")).toBe("/dashboard");
  });

  it("checks request origin against the host", () => {
    const headers = new Headers({ origin: "http://localhost:3000", host: "localhost:3000" });
    expect(isSameOrigin(headers)).toBe(true);
    const spoofed = new Headers({ origin: "https://evil.example", host: "localhost:3000" });
    expect(isSameOrigin(spoofed)).toBe(false);
  });

  it("compares equal-length strings without treating different lengths as equal", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("authorization decisions", () => {
  it("stops self promotion and removal of the last super admin", () => {
    expect(
      evaluateRoleChange({
        actorId: "actor",
        actorPermissions: permissions,
        targetId: "actor",
        targetRoleKey: "SUPER_ADMIN",
        targetStatus: "ACTIVE",
        nextRoleKey: "ADMIN",
        activeSuperAdminIds: ["actor"],
      }),
    ).toEqual({ ok: false, reason: "self" });

    expect(
      evaluateRoleChange({
        actorId: "actor",
        actorPermissions: permissions,
        targetId: "other",
        targetRoleKey: "SUPER_ADMIN",
        targetStatus: "ACTIVE",
        nextRoleKey: "ADMIN",
        activeSuperAdminIds: ["other"],
      }),
    ).toEqual({ ok: false, reason: "last_super_admin" });

    expect(
      evaluateSuspension({
        actorId: "actor",
        actorPermissions: new Set(["users.suspend"]),
        targetId: "other",
        targetRoleKey: "SUPER_ADMIN",
        targetStatus: "ACTIVE",
        nextStatus: "SUSPENDED",
        activeSuperAdminIds: ["other"],
      }),
    ).toEqual({ ok: false, reason: "last_super_admin" });
  });

  it("refuses a staff member granting super admin through the payload", () => {
    const staff = new Set(ROLE_DEFINITIONS.STAFF.permissions);
    expect(evaluateCreateUser({ actorPermissions: staff, nextRoleKey: "SUPER_ADMIN" })).toEqual({
      ok: false,
      reason: "forbidden",
    });
    expect(evaluateRoleChange({
      actorId: "staff",
      actorPermissions: staff,
      targetId: "other",
      targetRoleKey: "STAFF",
      targetStatus: "ACTIVE",
      nextRoleKey: "SUPER_ADMIN",
      activeSuperAdminIds: ["admin"],
    })).toEqual({ ok: false, reason: "forbidden" });
  });

  it("does not treat an existing different account as the initial super admin", () => {
    expect(decideBootstrap(null, INITIAL_ADMIN)).toEqual({ action: "create" });
    expect(
      decideBootstrap(
        { ...INITIAL_ADMIN },
        INITIAL_ADMIN,
      ).action,
    ).toBe("already_provisioned");
    expect(
      decideBootstrap(
        { ...INITIAL_ADMIN, roleKey: "STAFF" },
        INITIAL_ADMIN,
      ).action,
    ).toBe("stop");
  });
});

describe("security utilities", () => {
  it("encrypts field data so the plaintext is not stored", () => {
    const key = decodeEncryptionKey(Buffer.alloc(32, 7).toString("base64"));
    const ciphertext = encrypt("JBSWY3DPEHPK3PXP", key);
    expect(ciphertext).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decrypt(ciphertext, key)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("drops secrets from audit metadata", () => {
    expect(
      sanitizeAuditMetadata({
        role: "ADMIN",
        password: "secret",
        sessionToken: "abc",
        nested: { ok: true },
      }),
    ).toEqual({ role: "ADMIN" });
  });

  it("backs off login attempts and keeps the content security policy framed", () => {
    expect(accountLockoutMs(4)).toBeNull();
    expect(accountLockoutMs(5)).toBe(60_000);
    expect(ipLockoutMs(30)).toBe(15 * 60_000);
    const policy = buildContentSecurityPolicy({
      nonce: "nonce",
      isDevelopment: false,
      upgradeInsecureRequests: false,
    });
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("'nonce-nonce'");
    expect(policy).not.toContain("unsafe-eval");
  });

  it("reports missing configuration fields without their values", () => {
    const result = parseServerEnv({
      NODE_ENV: "test",
      DATABASE_URL: "not-a-url",
      SESSION_HASH_SECRET: "short",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields).toContain("DATABASE_URL");
      expect(JSON.stringify(result)).not.toContain("not-a-url");
    }
  });
});

describe("dashboard", () => {
  it("exposes users and company data sections", () => {
    const sections = visibleDashboardSections(permissions);
    expect(sections.map((section) => section.title)).toEqual(["Users", "Company Data", "Shipments"]);
    expect(sections[2]?.links.map((link) => link.href)).toEqual(["/shipments", "/shipments/tracking"]);
    expect(sections[0]?.links[0]?.href).toBe("/users");
    expect(sections[1]?.links.map((link) => link.href)).toEqual([
      "/company-data/administration",
      "/company-data/offices",
    ]);
  });
});
