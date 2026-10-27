import { getServerEnv } from "@/lib/config/env";
import { logSafeError } from "@/lib/security/log";
import { shipmentTrackingInputSchema } from "@/lib/shipping/tracking";
import { readBlueDartGatewaySettings } from "@/lib/shipping/transit-time";
import { getCurrentUser } from "@/server/auth/current-user";
import { readMutationContext } from "@/server/http/request";
import { hasPermission } from "@/server/policies/permissions";
import { requestShipmentTracking } from "@/server/services/shipment-tracking";

export const instant = false;

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const context = await readMutationContext();
  if (!context) {
    return Response.json({ error: "The request could not be verified." }, { status: 403, headers: privateHeaders });
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: privateHeaders });
    }
    if (!hasPermission(user.permissions, "dashboard.read")) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: privateHeaders });
    }

    const settings = readBlueDartGatewaySettings(getServerEnv());
    if (!settings) {
      return Response.json(
        { error: "Blue Dart credentials are not configured on the server." },
        { status: 503, headers: privateHeaders },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Check the tracking number." }, { status: 400, headers: privateHeaders });
    }
    const parsed = shipmentTrackingInputSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues?.[0]?.message ?? "Check the tracking number.";
      return Response.json({ error: message }, { status: 400, headers: privateHeaders });
    }

    const result = await requestShipmentTracking(settings, parsed.data);
    if (!result.ok) {
      return Response.json({ error: result.message }, { status: 502, headers: privateHeaders });
    }
    return Response.json({ tracking: result.tracking }, { headers: privateHeaders });
  } catch (error) {
    logSafeError("shipment tracking failed", error);
    return Response.json({ error: "Blue Dart did not return a tracking status." }, { status: 503, headers: privateHeaders });
  }
}
