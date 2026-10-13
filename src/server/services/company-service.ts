import { MAX_DOCUMENT_BYTES, isCompanyDocumentType } from "@/lib/company/india";
import { getServerEnv } from "@/lib/config/env";
import { getDb } from "@/lib/db/client";
import { fetchRemoteFile, readRemoteLog, readStorageSettings, removeRemoteFile, StorageHostError, storeRemoteFile } from "@/lib/files/remote-storage";
import { sanitizeStorageLog } from "@/lib/files/storage-log";
import { detectDocumentContent } from "@/lib/security/documents";
import { logSafeError } from "@/lib/security/log";
import type { RequestContext } from "@/lib/security/request";
import { companyProfileSchema, sanitizeFileName } from "@/lib/validation/company";
import { insertAuditLog } from "@/server/repositories/audit-logs";
import {
  findCompanyProfile,
  findCurrentDocument,
  listCurrentDocuments,
  replaceCompanyDocument,
  saveCompanyProfile,
  type CompanyDocumentRecord,
  type CompanyProfileRecord,
} from "@/server/repositories/company";

export async function getCompanyAdministration(): Promise<{
  profile: CompanyProfileRecord | null;
  documents: Omit<CompanyDocumentRecord, "storageKey" | "sha256">[];
  storageConfigured: boolean;
}> {
  const db = getDb();
  const [profile, documents] = await Promise.all([findCompanyProfile(db), listCurrentDocuments(db)]);
  return {
    storageConfigured: readStorageSettings(getServerEnv()) !== null,
    profile,
    documents: documents.map((document) => ({
      id: document.id,
      documentType: document.documentType,
      originalName: document.originalName,
      contentType: document.contentType,
      byteSize: document.byteSize,
      createdAt: document.createdAt,
    })),
  };
}

export async function saveCompanyAdministration(input: {
  actorId: string;
  values: unknown;
  context: RequestContext;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = companyProfileSchema.safeParse(input.values);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the company details and try again." };
  }
  const db = getDb();
  await db.transaction(async (tx) => {
    await saveCompanyProfile(tx, parsed.data, input.actorId);
    await insertAuditLog(tx, {
      actorUserId: input.actorId,
      action: "company.profile_saved",
      entityType: "company_profile",
      entityId: "primary",
      requestId: input.context.requestId,
      metadata: { stateCode: parsed.data.stateCode },
      outcome: "success",
    });
  });
  return { ok: true };
}

export async function storeCompanyDocument(input: {
  actorId: string;
  documentType: string;
  fileName: string;
  bytes: Buffer;
  context: RequestContext;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const documentType = input.documentType;
  if (!isCompanyDocumentType(documentType)) {
    return { ok: false, message: "Choose a document type." };
  }
  if (input.bytes.length === 0 || input.bytes.length > MAX_DOCUMENT_BYTES) {
    return { ok: false, message: "Upload a PDF, JPEG, or PNG no larger than 10 MB." };
  }
  const contentType = detectDocumentContent(input.bytes);
  if (!contentType) {
    return { ok: false, message: "Upload a PDF, JPEG, or PNG file." };
  }
  if (!readStorageSettings(getServerEnv())) {
    return { ok: false, message: "Document storage is not configured." };
  }

  let stored;
  try {
    stored = await storeRemoteFile(input.bytes, contentType);
  } catch (error) {
    logSafeError("company document upload failed", error);
    if (error instanceof StorageHostError) {
      return { ok: false, message: `The document host did not accept the file (${error.status}).` };
    }
    return { ok: false, message: "The document host did not accept the file." };
  }
  try {
    await getDb().transaction(async (tx) => {
      const id = await replaceCompanyDocument(tx, {
        documentType,
        storageKey: stored.storageKey,
        sha256: stored.sha256,
        byteSize: stored.byteSize,
        contentType: stored.contentType,
        originalName: sanitizeFileName(input.fileName),
        uploadedBy: input.actorId,
      });
      await insertAuditLog(tx, {
        actorUserId: input.actorId,
        action: "company.document_uploaded",
        entityType: "company_document",
        entityId: id,
        requestId: input.context.requestId,
        metadata: { documentType, checksum: stored.sha256, byteSize: stored.byteSize },
        outcome: "success",
      });
    });
  } catch (error) {
    await removeRemoteFile(stored.storageKey).catch(() => undefined);
    throw error;
  }
  return { ok: true };
}

export async function readStorageHostLog(): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  if (!readStorageSettings(getServerEnv())) {
    return { ok: false, message: "Document storage is not configured." };
  }
  try {
    return { ok: true, text: sanitizeStorageLog(await readRemoteLog(), getServerEnv().FILE_STORAGE_SECRET) };
  } catch (error) {
    logSafeError("company storage log failed", error);
    return { ok: false, message: "The storage log could not be opened." };
  }
}

export async function readCompanyDocument(documentId: string): Promise<{
  fileName: string;
  contentType: string;
  bytes: Buffer;
} | null> {
  const record = await findCurrentDocument(getDb(), documentId);
  if (!record) {
    return null;
  }
  const remote = await fetchRemoteFile(record.storageKey);
  if (remote.sha256 !== record.sha256 || remote.contentType !== record.contentType) {
    throw new Error("The stored document did not match its record.");
  }
  return { fileName: record.originalName, contentType: remote.contentType, bytes: remote.bytes };
}
