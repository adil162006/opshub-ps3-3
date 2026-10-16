ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "draft" jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[],"theme":{}}'::jsonb;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sites_draft_object_ck' AND conrelid = 'public.sites'::regclass
  ) THEN
    ALTER TABLE "sites" ADD CONSTRAINT "sites_draft_object_ck" CHECK (jsonb_typeof("draft") = 'object');
  END IF;
END $$;
