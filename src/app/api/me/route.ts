import { getCurrentUser } from "@/server/auth/current-user";
import { logSafeError } from "@/lib/security/log";

export const instant = false;

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: privateHeaders });
    }
    return Response.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.roleKey,
          status: user.status,
        },
      },
      { headers: privateHeaders },
    );
  } catch (error) {
    logSafeError("session api failed", error);
    return Response.json({ error: "Service unavailable" }, { status: 503, headers: privateHeaders });
  }
}
