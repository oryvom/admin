import { MAX_DOCUMENT_BYTES } from "@/lib/company/india";
import { UNAVAILABLE_ERROR } from "@/lib/security/messages";
import { logSafeError } from "@/lib/security/log";
import { getCurrentUser } from "@/server/auth/current-user";
import { readMutationContext } from "@/server/http/request";
import { hasPermission } from "@/server/policies/permissions";
import { storeCompanyDocument } from "@/server/services/company-service";

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
    if (!hasPermission(user.permissions, "company.administration.write")) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: privateHeaders });
    }

    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_DOCUMENT_BYTES + 1024 * 1024) {
      return Response.json({ error: "Upload a PDF, JPEG, or PNG no larger than 10 MB." }, { status: 413, headers: privateHeaders });
    }

    const form = await request.formData();
    const documentType = form.get("documentType");
    const file = form.get("file");
    if (typeof documentType !== "string" || !(file instanceof File)) {
      return Response.json({ error: "Choose a document and a file." }, { status: 400, headers: privateHeaders });
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      return Response.json({ error: "Upload a PDF, JPEG, or PNG no larger than 10 MB." }, { status: 413, headers: privateHeaders });
    }

    const result = await storeCompanyDocument({
      actorId: user.id,
      documentType,
      fileName: file.name,
      bytes: Buffer.from(await file.arrayBuffer()),
      context,
    });
    if (!result.ok) {
      const unavailable = result.message === "Document storage is not configured." || result.message.startsWith("The document host did not accept the file");
      return Response.json({ error: result.message }, { status: unavailable ? 503 : 400, headers: privateHeaders });
    }
    return Response.json({ ok: true }, { headers: privateHeaders });
  } catch (error) {
    logSafeError("company document upload failed", error);
    return Response.json({ error: UNAVAILABLE_ERROR }, { status: 503, headers: privateHeaders });
  }
}
