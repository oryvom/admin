import { desc, eq } from "drizzle-orm";
import type { DbClient } from "@/lib/db/executor";
import { officeDocuments, offices } from "@/lib/db/office-tables";
import type { OfficeInput } from "@/lib/validation/office";

export type OfficeDocumentRecord = {
  id: string;
  officeId: string;
  documentRole: string;
  title: string;
  originalName: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  storageKey: string;
  createdAt: Date;
};

export type OfficeRecord = {
  id: string;
  gstin: string;
  addressLine1: string;
  city: string;
  district: string;
  stateCode: string;
  pinCode: string;
  propertyType: OfficeInput["propertyType"];
  createdAt: Date;
  documents: Omit<OfficeDocumentRecord, "sha256" | "storageKey" | "officeId">[];
};

export async function listOffices(db: DbClient): Promise<OfficeRecord[]> {
  const officeRows = await db
    .select({
      id: offices.id,
      gstin: offices.gstin,
      addressLine1: offices.addressLine1,
      city: offices.city,
      district: offices.district,
      stateCode: offices.stateCode,
      pinCode: offices.pinCode,
      propertyType: offices.propertyType,
      createdAt: offices.createdAt,
    })
    .from(offices)
    .orderBy(desc(offices.createdAt));
  const documentRows = await db
    .select({
      id: officeDocuments.id,
      officeId: officeDocuments.officeId,
      documentRole: officeDocuments.documentRole,
      title: officeDocuments.title,
      originalName: officeDocuments.originalName,
      contentType: officeDocuments.contentType,
      byteSize: officeDocuments.byteSize,
      createdAt: officeDocuments.createdAt,
    })
    .from(officeDocuments)
    .orderBy(desc(officeDocuments.createdAt));

  return officeRows.map((office) => ({
    ...office,
    propertyType: office.propertyType as OfficeInput["propertyType"],
    documents: documentRows
      .filter((document) => document.officeId === office.id)
      .map((document) => ({
        id: document.id,
        documentRole: document.documentRole,
        title: document.title,
        originalName: document.originalName,
        contentType: document.contentType,
        byteSize: document.byteSize,
        createdAt: document.createdAt,
      })),
  }));
}

export async function insertOffice(
  db: DbClient,
  input: OfficeInput & { createdBy: string },
): Promise<string> {
  const [row] = await db
    .insert(offices)
    .values(input)
    .returning({ id: offices.id });
  if (!row) {
    throw new Error("The office record was not created.");
  }
  return row.id;
}

export async function insertOfficeDocument(
  db: DbClient,
  input: {
    officeId: string;
    documentRole: "gst_certificate" | "rent_agreement" | "additional";
    title: string;
    storageKey: string;
    sha256: string;
    byteSize: number;
    contentType: string;
    originalName: string;
    uploadedBy: string;
  },
): Promise<string> {
  const [row] = await db.insert(officeDocuments).values(input).returning({ id: officeDocuments.id });
  if (!row) {
    throw new Error("The office document record was not created.");
  }
  return row.id;
}

export async function findOfficeDocument(db: DbClient, documentId: string): Promise<OfficeDocumentRecord | null> {
  const [row] = await db
    .select({
      id: officeDocuments.id,
      officeId: officeDocuments.officeId,
      documentRole: officeDocuments.documentRole,
      title: officeDocuments.title,
      originalName: officeDocuments.originalName,
      contentType: officeDocuments.contentType,
      byteSize: officeDocuments.byteSize,
      sha256: officeDocuments.sha256,
      storageKey: officeDocuments.storageKey,
      createdAt: officeDocuments.createdAt,
    })
    .from(officeDocuments)
    .where(eq(officeDocuments.id, documentId))
    .limit(1);
  return row ?? null;
}
