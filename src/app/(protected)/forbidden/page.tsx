import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Access denied" };
export const instant = false;

export default async function ForbiddenPage() {
  await requireUser();
  return (
    <PageHeader
      title="Access denied"
      description="Your account does not have permission to open that page."
      breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Access denied" }]}
    />
  );
}
