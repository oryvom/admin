import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  boolean,
} from "drizzle-orm/pg-core";
import { INDIAN_STATES } from "@/lib/company/india";
import {
  accountStatuses,
  eventOutcomes,
  loginEventTypes,
} from "@/lib/db/constants";
import type { AuditMetadata } from "@/lib/security/audit-metadata";

export const accountStatusEnum = pgEnum("account_status", accountStatuses);
export const loginEventTypeEnum = pgEnum("login_event_type", loginEventTypes);
export const eventOutcomeEnum = pgEnum("event_outcome", eventOutcomes);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("roles_key_unique").on(table.key),
]);

export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("permissions_key_unique").on(table.key),
]);

export const rolePermissions = pgTable("role_permissions", {
  roleId: uuid("role_id").notNull(),
  permissionId: uuid("permission_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.roleId, table.permissionId], name: "role_permissions_pk" }),
  foreignKey({
    columns: [table.roleId],
    foreignColumns: [roles.id],
    name: "role_permissions_role_id_fk",
  }),
  foreignKey({
    columns: [table.permissionId],
    foreignColumns: [permissions.id],
    name: "role_permissions_permission_id_fk",
  }),
  index("role_permissions_permission_id_idx").on(table.permissionId),
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  passwordHash: text("password_hash").notNull(),
  roleId: uuid("role_id").notNull(),
  status: accountStatusEnum("status").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true, mode: "date" }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: "date" }),
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true, mode: "date" }),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
}, (table) => [
  uniqueIndex("users_email_unique").on(table.email),
  index("users_role_id_idx").on(table.roleId),
  index("users_status_idx").on(table.status),
  index("users_created_at_idx").on(table.createdAt),
  index("users_phone_idx").on(table.phone),
  foreignKey({
    columns: [table.roleId],
    foreignColumns: [roles.id],
    name: "users_role_id_fk",
  }),
  check("users_email_lowercase", sql`${table.email} = lower(${table.email})`),
  check("users_phone_digits", sql`${table.phone} ~ '^[0-9]{10,15}$'`),
  check("users_name_length", sql`char_length(${table.name}) between 2 and 120`),
]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  idleExpiresAt: timestamp("idle_expires_at", { withTimezone: true, mode: "date" }).notNull(),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  requestId: text("request_id"),
}, (table) => [
  uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
  index("sessions_user_id_idx").on(table.userId),
  index("sessions_expires_at_idx").on(table.expiresAt),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "sessions_user_id_fk",
  }),
]);

export const loginEvents = pgTable("login_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  email: text("email"),
  eventType: loginEventTypeEnum("event_type").notNull(),
  outcome: eventOutcomeEnum("outcome").notNull(),
  failureCode: text("failure_code"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  requestId: text("request_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  index("login_events_user_id_idx").on(table.userId),
  index("login_events_email_idx").on(table.email),
  index("login_events_created_at_idx").on(table.createdAt),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "login_events_user_id_fk",
  }),
  check(
    "login_events_failure_code",
    sql`${table.failureCode} is null or ${table.failureCode} in ('unknown_email', 'invalid_password', 'account_unavailable', 'rate_limited', 'mfa_invalid', 'mfa_expired', 'validation_error', 'otp_invalid', 'otp_expired')`,
  ),
]);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  requestId: text("request_id"),
  metadata: jsonb("metadata").$type<AuditMetadata>().notNull().default({}),
  outcome: text("outcome").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  index("audit_logs_actor_user_id_idx").on(table.actorUserId),
  index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  index("audit_logs_created_at_idx").on(table.createdAt),
  foreignKey({
    columns: [table.actorUserId],
    foreignColumns: [users.id],
    name: "audit_logs_actor_user_id_fk",
  }),
  check("audit_logs_outcome", sql`${table.outcome} in ('success', 'failure')`),
]);

export const authRateLimits = pgTable("auth_rate_limits", {
  bucketKey: text("bucket_key").primaryKey(),
  failureCount: integer("failure_count").notNull(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true, mode: "date" }).notNull(),
  lockedUntil: timestamp("locked_until", { withTimezone: true, mode: "date" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const mfaFactors = pgTable("mfa_factors", {
  userId: uuid("user_id").primaryKey(),
  secretCiphertext: text("secret_ciphertext").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "mfa_factors_user_id_fk",
  }),
]);

export const mfaRecoveryCodes = pgTable("mfa_recovery_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  codeHash: text("code_hash").notNull(),
  usedAt: timestamp("used_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("mfa_recovery_codes_code_hash_unique").on(table.codeHash),
  index("mfa_recovery_codes_user_id_idx").on(table.userId),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "mfa_recovery_codes_user_id_fk",
  }),
]);

export const mfaChallenges = pgTable("mfa_challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  requestId: text("request_id"),
}, (table) => [
  uniqueIndex("mfa_challenges_token_hash_unique").on(table.tokenHash),
  index("mfa_challenges_user_id_idx").on(table.userId),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "mfa_challenges_user_id_fk",
  }),
]);

export const loginOtps = pgTable("login_otps", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  codeHash: text("code_hash").notNull(),
  challengeHash: text("challenge_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" }),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  requestId: text("request_id"),
}, (table) => [
  uniqueIndex("login_otps_challenge_hash_unique").on(table.challengeHash),
  index("login_otps_user_id_idx").on(table.userId),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "login_otps_user_id_fk",
  }),
]);

const stateCodeList = INDIAN_STATES.map((state) => `'${state.code}'`).join(", ");

export const companyProfiles = pgTable("company_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  recordKey: text("record_key").notNull().default("primary"),
  companyName: text("company_name").notNull(),
  cin: text("cin").notNull(),
  pan: text("pan").notNull(),
  tan: text("tan").notNull(),
  addressLine1: text("address_line_1").notNull(),
  city: text("city").notNull(),
  district: text("district").notNull(),
  stateCode: text("state_code").notNull(),
  pinCode: text("pin_code").notNull(),
  updatedBy: uuid("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("company_profiles_record_key_unique").on(table.recordKey),
  foreignKey({
    columns: [table.updatedBy],
    foreignColumns: [users.id],
    name: "company_profiles_updated_by_fk",
  }),
  check("company_profiles_record_key", sql.raw(`"record_key" = 'primary'`)),
  check("company_profiles_state_code", sql.raw(`"state_code" in (${stateCodeList})`)),
  check("company_profiles_pin_code", sql.raw(`"pin_code" ~ '^[1-9][0-9]{5}$'`)),
  check("company_profiles_cin", sql.raw(`"cin" ~ '^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$'`)),
  check("company_profiles_pan", sql.raw(`"pan" ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'`)),
  check("company_profiles_tan", sql.raw(`"tan" ~ '^[A-Z]{4}[0-9]{5}[A-Z]$'`)),
]);

export const companyDocuments = pgTable("company_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentType: text("document_type").notNull(),
  storageKey: uuid("storage_key").notNull(),
  sha256: text("sha256").notNull(),
  byteSize: integer("byte_size").notNull(),
  contentType: text("content_type").notNull(),
  originalName: text("original_name").notNull(),
  uploadedBy: uuid("uploaded_by").notNull(),
  supersededAt: timestamp("superseded_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("company_documents_storage_key_unique").on(table.storageKey),
  uniqueIndex("company_documents_current_type_unique").on(table.documentType).where(sql`${table.supersededAt} is null`),
  index("company_documents_type_idx").on(table.documentType),
  foreignKey({
    columns: [table.uploadedBy],
    foreignColumns: [users.id],
    name: "company_documents_uploaded_by_fk",
  }),
  check(
    "company_documents_type",
    sql.raw(`"document_type" in ('certificate_of_incorporation', 'memorandum_of_association', 'articles_of_association', 'tin', 'pan')`),
  ),
  check(
    "company_documents_content_type",
    sql.raw(`"content_type" in ('application/pdf', 'image/jpeg', 'image/png')`),
  ),
  check("company_documents_sha256", sql.raw(`"sha256" ~ '^[a-f0-9]{64}$'`)),
  check("company_documents_byte_size", sql.raw(`"byte_size" > 0 and "byte_size" <= 10485760`)),
]);
