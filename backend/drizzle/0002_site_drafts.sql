ALTER TABLE "sites" ADD COLUMN "draft" jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[],"theme":{}}'::jsonb;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_draft_object_ck" CHECK (jsonb_typeof("draft") = 'object');
