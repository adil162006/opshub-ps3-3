ALTER TABLE "users" ADD COLUMN "phone_number" varchar(24);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "users" SET "is_verified" = true WHERE "phone_number" IS NULL;
