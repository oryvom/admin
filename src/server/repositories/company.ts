import { and, desc, eq, isNull } from "drizzle-orm";
import type { CompanyDocumentType } from "@/lib/company/india";
import type { DbClient } from "@/lib/db/executor";
import { companyDocuments, companyProfiles } from "@/lib/db/schema";
import type { CompanyProfileInput } from "@/lib/validation/company";

export type CompanyProfileRecord = {
  companyName: string;
  cin: string;
  pan: string;
  tan: string;
  addressLine1: string;
  city: string;
  district: string;
  stateCode: string;
  pinCode: string;
  updatedAt: Date;
};

export type CompanyDocumentRecord = {
  id: string;
  documentType: string;
  originalName: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  storageKey: string;
  createdAt: Date;
};

export async function findCompanyProfile(db: DbClient): Promise<CompanyProfileRecord | null> {
  const [row] = await db
    .select({
      companyName: companyProfiles.companyName,
      cin: companyProfiles.cin,
      pan: companyProfiles.pan,
      tan: companyProfiles.tan,
      addressLine1: companyProfiles.addressLine1,
      city: companyProfiles.city,
      district: companyProfiles.district,
      stateCode: companyProfiles.stateCode,
      pinCode: companyProfiles.pinCode,
      updatedAt: companyProfiles.updatedAt,
    })
    .from(companyProfiles)
    .where(eq(companyProfiles.recordKey, "primary"))
    .limit(1);
  return row ?? null;
}

export async function saveCompanyProfile(db: DbClient, input: CompanyProfileInput, actorId: string): Promise<void> {
  const now = new Date();
  await db
    .insert(companyProfiles)
    .values({
      recordKey: "primary",
      companyName: input.companyName,
      cin: input.cin,
      pan: input.pan,
      tan: input.tan,
      addressLine1: input.addressLine1,
      city: input.city,
      district: input.district,
      stateCode: input.stateCode,
      pinCode: input.pinCode,
      updatedBy: actorId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: companyProfiles.recordKey,
      set: {
        companyName: input.companyName,
        cin: input.cin,
        pan: input.pan,
        tan: input.tan,
        addressLine1: input.addressLine1,
        city: input.city,
        district: input.district,
        stateCode: input.stateCode,
        pinCode: input.pinCode,
        updatedBy: actorId,
        updatedAt: now,
      },
    });
}

export async function listCurrentDocuments(db: DbClient): Promise<CompanyDocumentRecord[]> {
  return db
    .select({
      id: companyDocuments.id,
      documentType: companyDocuments.documentType,
      originalName: companyDocuments.originalName,
      contentType: companyDocuments.contentType,
      byteSize: companyDocuments.byteSize,
      sha256: companyDocuments.sha256,
      storageKey: companyDocuments.storageKey,
      createdAt: companyDocuments.createdAt,
    })
    .from(companyDocuments)
    .where(isNull(companyDocuments.supersededAt))
    .orderBy(desc(companyDocuments.createdAt));
}

export async function findCurrentDocument(db: DbClient, documentId: string): Promise<CompanyDocumentRecord | null> {
  const [row] = await db
    .select({
      id: companyDocuments.id,
      documentType: companyDocuments.documentType,
      originalName: companyDocuments.originalName,
      contentType: companyDocuments.contentType,
      byteSize: companyDocuments.byteSize,
      sha256: companyDocuments.sha256,
      storageKey: companyDocuments.storageKey,
      createdAt: companyDocuments.createdAt,
    })
    .from(companyDocuments)
    .where(and(eq(companyDocuments.id, documentId), isNull(companyDocuments.supersededAt)))
    .limit(1);
  return row ?? null;
}

export async function replaceCompanyDocument(
  db: DbClient,
  input: {
    documentType: CompanyDocumentType;
    storageKey: string;
    sha256: string;
    byteSize: number;
    contentType: string;
    originalName: string;
    uploadedBy: string;
  },
): Promise<string> {
  const now = new Date();
  await db
    .update(companyDocuments)
    .set({ supersededAt: now })
    .where(and(eq(companyDocuments.documentType, input.documentType), isNull(companyDocuments.supersededAt)));
  const [row] = await db
    .insert(companyDocuments)
    .values({
      documentType: input.documentType,
      storageKey: input.storageKey,
      sha256: input.sha256,
      byteSize: input.byteSize,
      contentType: input.contentType,
      originalName: input.originalName,
      uploadedBy: input.uploadedBy,
    })
    .returning({ id: companyDocuments.id });
  if (!row) {
    throw new Error("The document record was not created.");
  }
  return row.id;
}
