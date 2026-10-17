ALTER TABLE "users" ADD COLUMN "phone_number" varchar(24) NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_verified" boolean DEFAULT false NOT NULL;