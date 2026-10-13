CREATE TABLE "office_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"document_role" text NOT NULL,
	"title" text NOT NULL,
	"storage_key" uuid NOT NULL,
	"sha256" text NOT NULL,
	"byte_size" integer NOT NULL,
	"content_type" text NOT NULL,
	"original_name" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "office_documents_role" CHECK ("document_role" in ('gst_certificate', 'rent_agreement', 'additional')),
	CONSTRAINT "office_documents_title" CHECK (char_length("title") between 2 and 80),
	CONSTRAINT "office_documents_content_type" CHECK ("content_type" in ('application/pdf', 'image/jpeg', 'image/png')),
	CONSTRAINT "office_documents_sha256" CHECK ("sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "office_documents_byte_size" CHECK ("byte_size" > 0 and "byte_size" <= 10485760)
);
--> statement-breakpoint
CREATE TABLE "offices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gstin" text NOT NULL,
	"address_line_1" text NOT NULL,
	"city" text NOT NULL,
	"district" text NOT NULL,
	"state_code" text NOT NULL,
	"pin_code" text NOT NULL,
	"property_type" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offices_gstin" CHECK ("gstin" ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
	CONSTRAINT "offices_state_code" CHECK ("state_code" in ('AN', 'AP', 'AR', 'AS', 'BR', 'CH', 'CG', 'DH', 'DL', 'GA', 'GJ', 'HR', 'HP', 'JK', 'JH', 'KA', 'KL', 'LA', 'LD', 'MP', 'MH', 'MN', 'ML', 'MZ', 'NL', 'OD', 'PY', 'PB', 'RJ', 'SK', 'TN', 'TS', 'TR', 'UP', 'UK', 'WB')),
	CONSTRAINT "offices_pin_code" CHECK ("pin_code" ~ '^[1-9][0-9]{5}$'),
	CONSTRAINT "offices_property_type" CHECK ("property_type" in ('rented'))
);
--> statement-breakpoint
ALTER TABLE "office_documents" ADD CONSTRAINT "office_documents_office_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_documents" ADD CONSTRAINT "office_documents_uploaded_by_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offices" ADD CONSTRAINT "offices_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "office_documents_storage_key_unique" ON "office_documents" USING btree ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "office_documents_role_unique" ON "office_documents" USING btree ("office_id","document_role") WHERE "document_role" in ('gst_certificate', 'rent_agreement');--> statement-breakpoint
CREATE INDEX "office_documents_office_id_idx" ON "office_documents" USING btree ("office_id");--> statement-breakpoint
CREATE INDEX "offices_created_at_idx" ON "offices" USING btree ("created_at");--> statement-breakpoint
INSERT INTO "permissions" ("key", "name", "description")
VALUES ('company.offices.write', 'Create company offices and documents', 'Create company offices and documents')
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT "roles"."id", "permissions"."id"
FROM "roles"
JOIN "permissions" ON "permissions"."key" = 'company.offices.write'
WHERE "roles"."key" IN ('SUPER_ADMIN', 'ADMIN')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;