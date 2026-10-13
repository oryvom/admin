import { logSafeError } from "@/lib/security/log";
import { UNAVAILABLE_ERROR } from "@/lib/security/messages";
import { getCurrentUser } from "@/server/auth/current-user";
import { hasPermission } from "@/server/policies/permissions";
import { readStorageHostLog } from "@/server/services/company-service";

export const instant = false;

const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: privateHeaders });
    }
    if (!hasPermission(user.permissions, "company.administration.write")) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: privateHeaders });
    }

    const result = await readStorageHostLog();
    if (!result.ok) {
      const status = result.message === "Document storage is not configured." ? 503 : 502;
      return Response.json({ error: result.message }, { status, headers: privateHeaders });
    }
    return Response.json({ text: result.text }, { headers: privateHeaders });
  } catch (error) {
    logSafeError("company storage log failed", error);
    return Response.json({ error: UNAVAILABLE_ERROR }, { status: 503, headers: privateHeaders });
  }
}
