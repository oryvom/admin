export const PERMISSIONS = {
  "dashboard.read": "View the dashboard",
  "users.read": "View user accounts",
  "users.create": "Create user accounts",
  "users.suspend": "Suspend or reactivate user accounts",
  "users.change_role": "Change user roles",
  "users.grant_super_admin": "Grant the Super Admin role",
  "audit.read": "View administrative audit records",
  "company.administration.read": "View company administration",
  "company.administration.write": "Update company administration and documents",
  "company.offices.read": "View company offices",
  "company.offices.write": "Create company offices and documents",
  "security.mfa.enroll": "Manage multi-factor authentication on the signed-in account",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as PermissionKey[];

export const ROLE_DEFINITIONS = {
  SUPER_ADMIN: {
    name: "Super Admin",
    description: "Full administration of the portal.",
    permissions: ALL_PERMISSIONS,
  },
  ADMIN: {
    name: "Admin",
    description: "Operational administration without Super Admin grants.",
    permissions: [
      "dashboard.read",
      "users.read",
      "users.create",
      "users.suspend",
      "users.change_role",
      "audit.read",
      "company.administration.read",
      "company.administration.write",
      "company.offices.read",
      "company.offices.write",
      "security.mfa.enroll",
    ] as const satisfies readonly PermissionKey[],
  },
  STAFF: {
    name: "Staff",
    description: "Read-only access to company sections.",
    permissions: [
      "dashboard.read",
      "company.administration.read",
      "company.offices.read",
      "security.mfa.enroll",
    ] as const satisfies readonly PermissionKey[],
  },
} as const;

export function hasPermission(permissions: ReadonlySet<PermissionKey>, permission: PermissionKey): boolean {
  return permissions.has(permission);
}
