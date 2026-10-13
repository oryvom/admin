import type { PermissionKey } from "@/server/policies/permissions";

export const companyModules = {
  administration: {
    title: "Administration",
    href: "/company-data/administration",
    permission: "company.administration.read" as PermissionKey,
    emptyTitle: "No administration records",
    emptyDescription:
      "No administration records have been added yet. This section is ready for company administration data once those requirements are defined.",
  },
  offices: {
    title: "Offices",
    href: "/company-data/offices",
    permission: "company.offices.read" as PermissionKey,
    emptyTitle: "No office records",
    emptyDescription:
      "No office records have been added yet. This section is ready for office data once those requirements are defined.",
  },
} as const;
