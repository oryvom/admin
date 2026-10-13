import { logSafeError } from "@/lib/security/log";
import { getCurrentUser } from "@/server/auth/current-user";
import { hasPermission } from "@/server/policies/permissions";
import { readCompanyDocument } from "@/server/services/company-service";

export const instant = false;

const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(_request: Request, context: { params: Promise<{ documentId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: privateHeaders });
    }
    if (!hasPermission(user.permissions, "company.administration.read")) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: privateHeaders });
    }

    const { documentId } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(documentId)) {
      return Response.json({ error: "Not found" }, { status: 404, headers: privateHeaders });
    }
    const document = await readCompanyDocument(documentId);
    if (!document) {
      return Response.json({ error: "Not found" }, { status: 404, headers: privateHeaders });
    }

    return new Response(new Uint8Array(document.bytes), {
      headers: {
        ...privateHeaders,
        "Content-Type": document.contentType,
        "Content-Disposition": contentDisposition(document.fileName),
      },
    });
  } catch (error) {
    logSafeError("company document download failed", error);
    return Response.json({ error: "Service unavailable" }, { status: 503, headers: privateHeaders });
  }
}

function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\w.\- ]/g, "") || "document";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
