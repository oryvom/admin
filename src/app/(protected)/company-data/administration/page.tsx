import type { Metadata } from "next";
import { CompanyAdministrationForm } from "@/components/forms/company-administration-form";
import { PageHeader } from "@/components/shared/page-header";
import { companyModules } from "@/features/company-data/modules";
import { requirePermission } from "@/server/auth/current-user";
import { hasPermission } from "@/server/policies/permissions";
import { getCompanyAdministration } from "@/server/services/company-service";

export const metadata: Metadata = { title: "Administration" };
export const instant = false;

export default async function AdministrationPage() {
  const section = companyModules.administration;
  const actor = await requirePermission(section.permission);
  const record = await getCompanyAdministration();

  return (
    <div className="space-y-6">
      <PageHeader
        title={section.title}
        description="Registered company details and statutory documents."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Company Data" },
          { label: section.title },
        ]}
      />
      <CompanyAdministrationForm
        canWrite={hasPermission(actor.permissions, "company.administration.write")}
        storageConfigured={record.storageConfigured}
        profile={record.profile}
        documents={record.documents.map((document) => ({
          ...document,
          createdAt: document.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
