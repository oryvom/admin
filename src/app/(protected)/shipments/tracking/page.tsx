import type { Metadata } from "next";
import { ShipmentTrackingForm } from "@/components/forms/shipment-tracking-form";
import { PageHeader } from "@/components/shared/page-header";
import { getServerEnv } from "@/lib/config/env";
import { readBlueDartGatewaySettings } from "@/lib/shipping/transit-time";
import { requirePermission } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Tracking" };
export const instant = false;

export default async function ShipmentTrackingPage() {
  await requirePermission("dashboard.read");
  const configured = readBlueDartGatewaySettings(getServerEnv()) !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tracking"
        description="Enter a waybill or reference number. Blue Dart returns the status and scan history."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Shipments", href: "/shipments" },
          { label: "Tracking" },
        ]}
      />
      <ShipmentTrackingForm configured={configured} />
    </div>
  );
}
