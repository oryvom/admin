import type { Metadata } from "next";
import { ShipmentCostForm } from "@/components/forms/shipment-cost-form";
import { PageHeader } from "@/components/shared/page-header";
import { getServerEnv } from "@/lib/config/env";
import { readBlueDartSettings } from "@/lib/shipping/transit-time";
import { requirePermission } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Shipments" };
export const instant = false;

export default async function ShipmentsPage() {
  await requirePermission("dashboard.read");
  const configured = readBlueDartSettings(getServerEnv()) !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shipments"
        description="Enter the weight, boxes, and dimensions. Blue Dart returns the total cost for this lane."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Shipments" }]}
      />
      <ShipmentCostForm configured={configured} />
    </div>
  );
}
