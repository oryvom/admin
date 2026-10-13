import { revalidatePath } from "next/cache";
import { MAX_DOCUMENT_BYTES } from "@/lib/company/india";
import { UNAVAILABLE_ERROR } from "@/lib/security/messages";
import { logSafeError } from "@/lib/security/log";
import { getCurrentUser } from "@/server/auth/current-user";
import { readMutationContext } from "@/server/http/request";
import { hasPermission } from "@/server/policies/permissions";
import { createOffice, type OfficeUpload } from "@/server/services/office-service";
import { MAX_ADDITIONAL_OFFICE_DOCUMENTS } from "@/lib/validation/office";

export const instant = false;

const privateHeaders = { "Cache-Control": "private, no-store" };
const maxRequestBytes = MAX_DOCUMENT_BYTES * (2 + MAX_ADDITIONAL_OFFICE_DOCUMENTS) + 1024 * 1024;

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
    if (!hasPermission(user.permissions, "company.offices.write")) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: privateHeaders });
    }

    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (declaredLength > maxRequestBytes) {
      return Response.json({ error: "The office documents are too large." }, { status: 413, headers: privateHeaders });
    }

    const form = await request.formData();
    const uploads = await readUploads(form);
    if (!uploads.ok) {
      return Response.json({ error: uploads.message }, { status: 400, headers: privateHeaders });
    }
    const result = await createOffice({
      actorId: user.id,
      values: {
        gstin: String(form.get("gstin") ?? ""),
        addressLine1: String(form.get("addressLine1") ?? ""),
        city: String(form.get("city") ?? ""),
        district: String(form.get("district") ?? ""),
        stateCode: String(form.get("stateCode") ?? ""),
        pinCode: String(form.get("pinCode") ?? ""),
        propertyType: String(form.get("propertyType") ?? ""),
      },
      uploads: uploads.files,
      context,
    });
    if (!result.ok) {
      const unavailable = result.message === "Document storage is not configured." || result.message.startsWith("The document host did not accept the file");
      return Response.json({ error: result.message }, { status: unavailable ? 503 : 400, headers: privateHeaders });
    }
    revalidatePath("/company-data/offices");
    return Response.json({ ok: true }, { headers: privateHeaders });
  } catch (error) {
    logSafeError("office create failed", error);
    return Response.json({ error: UNAVAILABLE_ERROR }, { status: 503, headers: privateHeaders });
  }
}

async function readUploads(form: FormData): Promise<{ ok: true; files: OfficeUpload[] } | { ok: false; message: string }> {
  const files: OfficeUpload[] = [];
  const gst = await namedFile(form.get("gstCertificate"), "GST Certificate");
  if (!gst.ok) {
    return gst;
  }
  if (gst.file) {
    files.push({ role: "gst_certificate", title: "GST Certificate", fileName: gst.file.name, bytes: gst.file.bytes });
  }
  const rent = await namedFile(form.get("rentAgreement"), "Rent agreement");
  if (!rent.ok) {
    return rent;
  }
  if (rent.file) {
    files.push({ role: "rent_agreement", title: "Rent agreement", fileName: rent.file.name, bytes: rent.file.bytes });
  }

  const titles = form.getAll("additionalTitle");
  const extraFiles = form.getAll("additionalFile");
  if (titles.length !== extraFiles.length || titles.length > MAX_ADDITIONAL_OFFICE_DOCUMENTS) {
    return { ok: false, message: "Check the additional documents and try again." };
  }
  for (let index = 0; index < titles.length; index += 1) {
    const titleValue = titles[index];
    const title = typeof titleValue === "string" ? titleValue : "";
    const file = await namedFile(extraFiles[index] ?? null, "Additional document");
    if (!file.ok) {
      return file;
    }
    if (!title.trim() && !file.file) {
      continue;
    }
    if (!title.trim() || !file.file) {
      return { ok: false, message: "Enter a title and choose a file for each additional document." };
    }
    files.push({ role: "additional", title: title.trim(), fileName: file.file.name, bytes: file.file.bytes });
  }
  return { ok: true, files };
}

async function namedFile(
  value: FormDataEntryValue | null,
  label: string,
): Promise<{ ok: true; file: { name: string; bytes: Buffer } | null } | { ok: false; message: string }> {
  if (!(value instanceof File) || value.size === 0) {
    return { ok: true, file: null };
  }
  if (value.size > MAX_DOCUMENT_BYTES) {
    return { ok: false, message: `${label} must be a PDF, JPEG, or PNG no larger than 10 MB.` };
  }
  return { ok: true, file: { name: value.name, bytes: Buffer.from(await value.arrayBuffer()) } };
}
