import { PAGE_SIZE } from "@/lib/auth/cookies";
import { logSafeError } from "@/lib/security/log";
import { parsePage, parseSearchQuery } from "@/lib/validation/search";
import { getCurrentUser } from "@/server/auth/current-user";
import { hasPermission } from "@/server/policies/permissions";
import { getUserPage } from "@/server/services/user-service";

export const instant = false;

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: privateHeaders });
    }
    if (!hasPermission(user.permissions, "users.read")) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: privateHeaders });
    }

    const url = new URL(request.url);
    const query = parseSearchQuery(url.searchParams.get("q") ?? undefined);
    const page = parsePage(url.searchParams.get("page") ?? undefined);
    const result = await getUserPage(query, page);
    return Response.json(
      {
        page,
        pageSize: PAGE_SIZE,
        total: result.total,
        users: result.users.map((account) => ({
          id: account.id,
          name: account.name,
          email: account.email,
          phone: account.phone,
          role: account.roleKey,
          status: account.status,
          createdAt: account.createdAt.toISOString(),
          lastLoginAt: account.lastLoginAt?.toISOString() ?? null,
        })),
      },
      { headers: privateHeaders },
    );
  } catch (error) {
    logSafeError("users api failed", error);
    return Response.json({ error: "Service unavailable" }, { status: 503, headers: privateHeaders });
  }
}
