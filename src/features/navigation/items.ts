import type { PermissionKey } from "@/server/policies/permissions";
import { hasPermission } from "@/server/policies/permissions";

export type NavItem = {
  href: string;
  title: string;
  terms: string[];
  permission: PermissionKey;
};

const items: NavItem[] = [
  { href: "/dashboard", title: "Dashboard", terms: ["dashboard", "home"], permission: "dashboard.read" },
  { href: "/users", title: "Users", terms: ["users", "user", "accounts"], permission: "users.read" },
  {
    href: "/company-data/administration",
    title: "Administration",
    terms: ["administration", "admin", "company", "company data"],
    permission: "company.administration.read",
  },
  { href: "/company-data/offices", title: "Offices", terms: ["offices", "office"], permission: "company.offices.read" },
  { href: "/account/security", title: "Security", terms: ["security", "account"], permission: "security.mfa.enroll" },
];

export function visibleNavigation(permissions: ReadonlySet<PermissionKey>): { href: string; title: string; terms: string[] }[] {
  return items
    .filter((item) => hasPermission(permissions, item.permission))
    .map(({ href, title, terms }) => ({ href, title, terms }));
}
