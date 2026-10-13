ALTER TYPE "public"."login_event_type" ADD VALUE 'otp_sent';--> statement-breakpoint
ALTER TYPE "public"."login_event_type" ADD VALUE 'otp_failed';--> statement-breakpoint
CREATE TABLE "login_otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"challenge_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"request_id" text
);
--> statement-breakpoint
ALTER TABLE "login_events" DROP CONSTRAINT "login_events_failure_code";--> statement-breakpoint
ALTER TABLE "login_otps" ADD CONSTRAINT "login_otps_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "login_otps_challenge_hash_unique" ON "login_otps" USING btree ("challenge_hash");--> statement-breakpoint
CREATE INDEX "login_otps_user_id_idx" ON "login_otps" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_phone_idx" ON "users" USING btree ("phone");--> statement-breakpoint
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_failure_code" CHECK ("login_events"."failure_code" is null or "login_events"."failure_code" in ('unknown_email', 'invalid_password', 'account_unavailable', 'rate_limited', 'mfa_invalid', 'mfa_expired', 'validation_error', 'otp_invalid', 'otp_expired'));