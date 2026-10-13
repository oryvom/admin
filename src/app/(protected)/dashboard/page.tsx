import type { Metadata } from "next";
import Link from "next/link";
import { SectionGrid } from "@/components/dashboard/section-grid";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { visibleDashboardSections } from "@/features/dashboard/sections";
import { requirePermission } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Dashboard" };
export const instant = false;

export default async function DashboardPage() {
  const user = await requirePermission("dashboard.read");
  const sections = visibleDashboardSections(user.permissions);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Signed in as ${user.name}. Open a section to reach its records.`}
        breadcrumbs={[{ label: "Dashboard" }]}
      />
      {user.mfaEnabled ? null : (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Multi-factor authentication is available and not enabled on this account.
          </p>
          <Button variant="outline" asChild>
            <Link href="/account/security">Set up MFA</Link>
          </Button>
        </div>
      )}
      <SectionGrid sections={sections} />
    </div>
  );
}
