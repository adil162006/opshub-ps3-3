ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "assignee" varchar(180);
--> statement-breakpoint
ALTER TABLE "repair_records" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;
