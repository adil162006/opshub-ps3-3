ALTER TABLE "assignments" ADD COLUMN "assignee" varchar(180);
--> statement-breakpoint
ALTER TABLE "repair_records" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;
