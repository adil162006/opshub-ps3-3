ALTER TABLE "repair_records" ADD COLUMN IF NOT EXISTS "customer_contact" varchar(100);
--> statement-breakpoint
ALTER TABLE "repair_records" ADD COLUMN IF NOT EXISTS "serial_no" varchar(100);
--> statement-breakpoint
ALTER TABLE "repair_records" ADD COLUMN IF NOT EXISTS "diagnosis" text;
