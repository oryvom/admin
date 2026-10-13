import { MAX_DOCUMENT_BYTES } from "@/lib/company/india";
import { getServerEnv } from "@/lib/config/env";
import { getDb } from "@/lib/db/client";
import { fetchRemoteFile, readStorageSettings, removeRemoteFile, StorageHostError, storeRemoteFile } from "@/lib/files/remote-storage";
import { detectDocumentContent } from "@/lib/security/documents";
import { logSafeError } from "@/lib/security/log";
import type { RequestContext } from "@/lib/security/request";
import { sanitizeFileName } from "@/lib/validation/company";
import { officeDocumentTitleSchema, officeSchema, type OfficeInput } from "@/lib/validation/office";
import { insertAuditLog } from "@/server/repositories/audit-logs";
import {
  findOfficeDocument,
  insertOffice,
  insertOfficeDocument,
  listOffices,
  type OfficeRecord,
} from "@/server/repositories/offices";

export type OfficeUpload = {
  role: "gst_certificate" | "rent_agreement" | "additional";
  title: string;
  fileName: string;
  bytes: Buffer;
};

export async function getOffices(): Promise<OfficeRecord[]> {
  return listOffices(getDb());
}

export async function createOffice(input: {
  actorId: string;
  values: unknown;
  uploads: OfficeUpload[];
  context: RequestContext;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = officeSchema.safeParse(input.values);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the office details and try again." };
  }
  const prepared = prepareUploads(parsed.data, input.uploads);
  if (!prepared.ok) {
    return prepared;
  }
  if (!readStorageSettings(getServerEnv())) {
    return { ok: false, message: "Document storage is not configured." };
  }

  const stored: { storageKey: string; sha256: string; byteSize: number; contentType: string; upload: OfficeUpload }[] = [];
  try {
    for (const upload of prepared.uploads) {
      const contentType = detectDocumentContent(upload.bytes);
      if (!contentType) {
        throw new Error("Upload a PDF, JPEG, or PNG file.");
      }
      const remote = await storeRemoteFile(upload.bytes, contentType);
      stored.push({ ...remote, upload });
    }
    await getDb().transaction(async (tx) => {
      const officeId = await insertOffice(tx, { ...parsed.data, createdBy: input.actorId });
      for (const file of stored) {
        await insertOfficeDocument(tx, {
          officeId,
          documentRole: file.upload.role,
          title: file.upload.title,
          storageKey: file.storageKey,
          sha256: file.sha256,
          byteSize: file.byteSize,
          contentType: file.contentType,
          originalName: sanitizeFileName(file.upload.fileName),
          uploadedBy: input.actorId,
        });
      }
      await insertAuditLog(tx, {
        actorUserId: input.actorId,
        action: "company.office_created",
        entityType: "office",
        entityId: officeId,
        requestId: input.context.requestId,
        metadata: { stateCode: parsed.data.stateCode, documentCount: stored.length },
        outcome: "success",
      });
    });
  } catch (error) {
    await Promise.all(stored.map((file) => removeRemoteFile(file.storageKey).catch(() => undefined)));
    if (error instanceof Error && error.message === "Upload a PDF, JPEG, or PNG file.") {
      return { ok: false, message: error.message };
    }
    logSafeError("office create failed", error);
    if (error instanceof StorageHostError) {
      return { ok: false, message: `The document host did not accept the file (${error.status}).` };
    }
    return { ok: false, message: "The office could not be saved." };
  }
  return { ok: true };
}

export async function readOfficeDocument(documentId: string): Promise<{
  fileName: string;
  contentType: string;
  bytes: Buffer;
} | null> {
  const record = await findOfficeDocument(getDb(), documentId);
  if (!record) {
    return null;
  }
  const remote = await fetchRemoteFile(record.storageKey);
  if (remote.sha256 !== record.sha256 || remote.contentType !== record.contentType) {
    throw new Error("The stored document did not match its record.");
  }
  return { fileName: record.originalName, contentType: remote.contentType, bytes: remote.bytes };
}

function prepareUploads(
  office: OfficeInput,
  uploads: OfficeUpload[],
): { ok: true; uploads: OfficeUpload[] } | { ok: false; message: string } {
  const gst = uploads.filter((upload) => upload.role === "gst_certificate");
  const rent = uploads.filter((upload) => upload.role === "rent_agreement");
  const additional = uploads.filter((upload) => upload.role === "additional");
  if (gst.length !== 1) {
    return { ok: false, message: "Upload the GST certificate." };
  }
  if (office.propertyType === "rented" && rent.length !== 1) {
    return { ok: false, message: "Upload the rent agreement." };
  }
  if (office.propertyType !== "rented" && rent.length > 0) {
    return { ok: false, message: "A rent agreement is only used for a rented office." };
  }
  if (additional.length > 8) {
    return { ok: false, message: "Upload at most 8 additional documents." };
  }
  const prepared = [...gst, ...rent, ...additional];
  for (const upload of prepared) {
    if (upload.bytes.length === 0 || upload.bytes.length > MAX_DOCUMENT_BYTES) {
      return { ok: false, message: "Upload a PDF, JPEG, or PNG no larger than 10 MB." };
    }
    const title = officeDocumentTitleSchema.safeParse(upload.title);
    if (!title.success) {
      return { ok: false, message: title.error.issues[0]?.message ?? "Enter a document title." };
    }
    upload.title = title.data;
  }
  return { ok: true, uploads: prepared };
}
