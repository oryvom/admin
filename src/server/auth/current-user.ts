import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ACTIVITY_WRITE_INTERVAL_MS, SESSION_COOKIE } from "@/lib/auth/cookies";
import { getServerEnv } from "@/lib/config/env";
import type { AccountStatus } from "@/lib/db/constants";
import { getDb } from "@/lib/db/client";
import { hashSessionToken } from "@/lib/security/tokens";
import { logSafeError } from "@/lib/security/log";
import { findSessionUser, revokeSessionByHash, touchSession } from "@/server/repositories/sessions";
import { hasPermission, type PermissionKey } from "@/server/policies/permissions";

export type CurrentUser = {
  id: string;
  sessionId: string;
  name: string;
  email: string;
  phone: string;
  roleKey: string;
  roleName: string;
  status: AccountStatus;
  permissions: ReadonlySet<PermissionKey>;
  mfaEnabled: boolean;
  sessionExpiresAt: Date;
  lastActivityAt: Date;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  await connection();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  try {
    const env = getServerEnv();
    const db = getDb();
    const tokenHash = hashSessionToken(token, env.SESSION_HASH_SECRET);
    const session = await findSessionUser(db, tokenHash);
    if (!session || session.status !== "ACTIVE") {
      if (session && session.status !== "ACTIVE") {
        await revokeSessionByHash(db, tokenHash);
      }
      return null;
    }

    if (Date.now() - session.lastActivityAt.getTime() >= ACTIVITY_WRITE_INTERVAL_MS) {
      await touchSession(db, session.sessionId, session.sessionExpiresAt).catch((error: unknown) => {
        logSafeError("session activity update failed", error);
      });
    }

    return {
      id: session.userId,
      sessionId: session.sessionId,
      name: session.name,
      email: session.email,
      phone: session.phone,
      roleKey: session.roleKey,
      roleName: session.roleName,
      status: session.status,
      permissions: new Set(session.permissions),
      mfaEnabled: session.mfaEnabled,
      sessionExpiresAt: session.sessionExpiresAt,
      lastActivityAt: session.lastActivityAt,
    };
  } catch (error) {
    logSafeError("session lookup failed", error);
    throw new Error("The service is temporarily unavailable. Please try again later.");
  }
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requirePermission(permission: PermissionKey): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasPermission(user.permissions, permission)) {
    redirect("/forbidden");
  }
  return user;
}
