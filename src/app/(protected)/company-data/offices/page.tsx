import type { Metadata } from "next";
import { OfficesPanel } from "@/components/forms/offices-form";
import { PageHeader } from "@/components/shared/page-header";
import { companyModules } from "@/features/company-data/modules";
import { requirePermission } from "@/server/auth/current-user";
import { hasPermission } from "@/server/policies/permissions";
import { getOffices } from "@/server/services/office-service";

export const metadata: Metadata = { title: "Offices" };
export const instant = false;

export default async function OfficesPage() {
  const section = companyModules.offices;
  const actor = await requirePermission(section.permission);
  const offices = await getOffices();

  return (
    <div className="space-y-6">
      <PageHeader
        title={section.title}
        description="GST registrations and registered office addresses."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Company Data" },
          { label: section.title },
        ]}
      />
      <OfficesPanel
        canWrite={hasPermission(actor.permissions, "company.offices.write")}
        offices={offices.map((office) => ({
          id: office.id,
          gstin: office.gstin,
          addressLine1: office.addressLine1,
          city: office.city,
          district: office.district,
          stateCode: office.stateCode,
          pinCode: office.pinCode,
          propertyType: office.propertyType,
          documents: office.documents.map((document) => ({
            id: document.id,
            title: document.title,
            originalName: document.originalName,
          })),
        }))}
      />
    </div>
  );
}
