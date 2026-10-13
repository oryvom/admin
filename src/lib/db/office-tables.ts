import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { INDIAN_STATES } from "@/lib/company/india";
import { users } from "@/lib/db/schema";

const stateCodeList = INDIAN_STATES.map((state) => `'${state.code}'`).join(", ");

export const offices = pgTable("offices", {
  id: uuid("id").primaryKey().defaultRandom(),
  gstin: text("gstin").notNull(),
  addressLine1: text("address_line_1").notNull(),
  city: text("city").notNull(),
  district: text("district").notNull(),
  stateCode: text("state_code").notNull(),
  pinCode: text("pin_code").notNull(),
  propertyType: text("property_type").notNull(),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  index("offices_created_at_idx").on(table.createdAt),
  foreignKey({
    columns: [table.createdBy],
    foreignColumns: [users.id],
    name: "offices_created_by_fk",
  }),
  check("offices_gstin", sql.raw(`"gstin" ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'`)),
  check("offices_state_code", sql.raw(`"state_code" in (${stateCodeList})`)),
  check("offices_pin_code", sql.raw(`"pin_code" ~ '^[1-9][0-9]{5}$'`)),
  check("offices_property_type", sql.raw(`"property_type" in ('rented')`)),
]);

export const officeDocuments = pgTable("office_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  officeId: uuid("office_id").notNull(),
  documentRole: text("document_role").notNull(),
  title: text("title").notNull(),
  storageKey: uuid("storage_key").notNull(),
  sha256: text("sha256").notNull(),
  byteSize: integer("byte_size").notNull(),
  contentType: text("content_type").notNull(),
  originalName: text("original_name").notNull(),
  uploadedBy: uuid("uploaded_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("office_documents_storage_key_unique").on(table.storageKey),
  uniqueIndex("office_documents_role_unique")
    .on(table.officeId, table.documentRole)
    .where(sql.raw(`"document_role" in ('gst_certificate', 'rent_agreement')`)),
  index("office_documents_office_id_idx").on(table.officeId),
  foreignKey({
    columns: [table.officeId],
    foreignColumns: [offices.id],
    name: "office_documents_office_id_fk",
  }),
  foreignKey({
    columns: [table.uploadedBy],
    foreignColumns: [users.id],
    name: "office_documents_uploaded_by_fk",
  }),
  check("office_documents_role", sql.raw(`"document_role" in ('gst_certificate', 'rent_agreement', 'additional')`)),
  check("office_documents_title", sql.raw(`char_length("title") between 2 and 80`)),
  check("office_documents_content_type", sql.raw(`"content_type" in ('application/pdf', 'image/jpeg', 'image/png')`)),
  check("office_documents_sha256", sql.raw(`"sha256" ~ '^[a-f0-9]{64}$'`)),
  check("office_documents_byte_size", sql.raw(`"byte_size" > 0 and "byte_size" <= 10485760`)),
]);
