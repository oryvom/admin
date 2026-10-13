CREATE TABLE "company_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_type" text NOT NULL,
	"storage_key" uuid NOT NULL,
	"sha256" text NOT NULL,
	"byte_size" integer NOT NULL,
	"content_type" text NOT NULL,
	"original_name" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_documents_type" CHECK ("document_type" in ('certificate_of_incorporation', 'memorandum_of_association', 'articles_of_association', 'tin', 'pan')),
	CONSTRAINT "company_documents_content_type" CHECK ("content_type" in ('application/pdf', 'image/jpeg', 'image/png')),
	CONSTRAINT "company_documents_sha256" CHECK ("sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "company_documents_byte_size" CHECK ("byte_size" > 0 and "byte_size" <= 10485760)
);
--> statement-breakpoint
CREATE TABLE "company_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_key" text DEFAULT 'primary' NOT NULL,
	"company_name" text NOT NULL,
	"cin" text NOT NULL,
	"pan" text NOT NULL,
	"tan" text NOT NULL,
	"address_line_1" text NOT NULL,
	"city" text NOT NULL,
	"district" text NOT NULL,
	"state_code" text NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_profiles_record_key" CHECK ("record_key" = 'primary'),
	CONSTRAINT "company_profiles_state_code" CHECK ("state_code" in ('AN', 'AP', 'AR', 'AS', 'BR', 'CH', 'CG', 'DH', 'DL', 'GA', 'GJ', 'HR', 'HP', 'JK', 'JH', 'KA', 'KL', 'LA', 'LD', 'MP', 'MH', 'MN', 'ML', 'MZ', 'NL', 'OD', 'PY', 'PB', 'RJ', 'SK', 'TN', 'TS', 'TR', 'UP', 'UK', 'WB')),
	CONSTRAINT "company_profiles_cin" CHECK ("cin" ~ '^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$'),
	CONSTRAINT "company_profiles_pan" CHECK ("pan" ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
	CONSTRAINT "company_profiles_tan" CHECK ("tan" ~ '^[A-Z]{4}[0-9]{5}[A-Z]$')
);
--> statement-breakpoint
ALTER TABLE "company_documents" ADD CONSTRAINT "company_documents_uploaded_by_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_updated_by_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_documents_storage_key_unique" ON "company_documents" USING btree ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "company_documents_current_type_unique" ON "company_documents" USING btree ("document_type") WHERE "company_documents"."superseded_at" is null;--> statement-breakpoint
CREATE INDEX "company_documents_type_idx" ON "company_documents" USING btree ("document_type");--> statement-breakpoint
CREATE UNIQUE INDEX "company_profiles_record_key_unique" ON "company_profiles" USING btree ("record_key");--> statement-breakpoint
INSERT INTO "permissions" ("key", "name", "description")
VALUES ('company.administration.write', 'Update company administration and documents', 'Update company administration and documents')
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT "roles"."id", "permissions"."id"
FROM "roles"
JOIN "permissions" ON "permissions"."key" = 'company.administration.write'
WHERE "roles"."key" IN ('SUPER_ADMIN', 'ADMIN')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;