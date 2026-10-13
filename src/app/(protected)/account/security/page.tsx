import type { Metadata } from "next";
import { SecurityPanel } from "@/components/forms/security-panel";
import { PageHeader } from "@/components/shared/page-header";
import { requirePermission } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Security" };
export const instant = false;

export default async function SecurityPage() {
  const user = await requirePermission("security.mfa.enroll");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Security"
        description="Authenticator enrollment and recovery codes for this account."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Security" }]}
      />
      <SecurityPanel mfaEnabled={user.mfaEnabled} />
    </div>
  );
}
