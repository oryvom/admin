import { getServerEnv } from "@/lib/config/env";
import { logSafeError } from "@/lib/security/log";
import { shipmentCostInputSchema } from "@/lib/shipping/shipment-cost";
import { readBlueDartSettings } from "@/lib/shipping/transit-time";
import { getCurrentUser } from "@/server/auth/current-user";
import { readMutationContext } from "@/server/http/request";
import { hasPermission } from "@/server/policies/permissions";
import { requestShipmentCost } from "@/server/services/bluedart-service";

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

    const settings = readBlueDartSettings(getServerEnv());
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
      return Response.json({ error: "Check the shipment details." }, { status: 400, headers: privateHeaders });
    }
    const parsed = shipmentCostInputSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues?.[0]?.message ?? "Check the shipment details.";
      return Response.json({ error: message }, { status: 400, headers: privateHeaders });
    }

    const result = await requestShipmentCost(settings, parsed.data);
    if (!result.ok) {
      return Response.json({ error: result.message }, { status: 502, headers: privateHeaders });
    }
    return Response.json({ cost: result.cost }, { headers: privateHeaders });
  } catch (error) {
    logSafeError("shipment cost failed", error);
    return Response.json({ error: "Blue Dart did not return a total cost." }, { status: 503, headers: privateHeaders });
  }
}
