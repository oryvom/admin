import type { PermissionKey } from "@/server/policies/permissions";
import { hasPermission } from "@/server/policies/permissions";

export type DashboardIcon = "users" | "building" | "truck";

export type DashboardCardModel = {
  id: string;
  title: string;
  description: string;
  icon: DashboardIcon;
  links: {
    title: string;
    description: string;
    href: string;
  }[];
};

type DashboardSection = {
  id: string;
  title: string;
  description: string;
  icon: DashboardIcon;
  permission: PermissionKey;
  links: {
    title: string;
    description: string;
    href: string;
    permission: PermissionKey;
  }[];
};

const sections: DashboardSection[] = [
  {
    id: "users",
    title: "Users",
    description: "Review accounts, roles, and access for people who operate the administration portal.",
    icon: "users",
    permission: "dashboard.read",
    links: [
      {
        title: "Manage Users",
        description: "Search accounts, review status, and perform permitted account changes.",
        href: "/users",
        permission: "users.read",
      },
    ],
  },
  {
    id: "company-data",
    title: "Company Data",
    description: "Company records for ORYVOM MOBILITY PRIVATE LIMITED, including administration and offices.",
    icon: "building",
    permission: "dashboard.read",
    links: [
      {
        title: "Administration",
        description: "Administrative records will appear here once they are defined.",
        href: "/company-data/administration",
        permission: "company.administration.read",
      },
      {
        title: "Offices",
        description: "Office records will appear here once they are defined.",
        href: "/company-data/offices",
        permission: "company.offices.read",
      },
    ],
  },
  {
    id: "shipments",
    title: "Shipments",
    description: "Blue Dart cost for a shipment, and tracking for a waybill or reference number.",
    icon: "truck",
    permission: "dashboard.read",
    links: [
      {
        title: "Shipment cost",
        description: "Enter the weight, boxes, and dimensions, then read the total Blue Dart returns.",
        href: "/shipments",
        permission: "dashboard.read",
      },
      {
        title: "Tracking",
        description: "Look up a waybill or reference number and read the status Blue Dart returns.",
        href: "/shipments/tracking",
        permission: "dashboard.read",
      },
    ],
  },
];

export function visibleDashboardSections(permissions: ReadonlySet<PermissionKey>): DashboardCardModel[] {
  return sections.flatMap((section) => {
    if (!hasPermission(permissions, section.permission)) {
      return [];
    }
    const links = section.links
      .filter((link) => hasPermission(permissions, link.permission))
      .map(({ title, description, href }) => ({ title, description, href }));
    if (links.length === 0) {
      return [];
    }
    return [{ id: section.id, title: section.title, description: section.description, icon: section.icon, links }];
  });
}
