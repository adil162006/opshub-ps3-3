DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'repair_records' AND column_name = 'ticket_number')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'repair_records' AND column_name = 'ticket_no') THEN
    ALTER TABLE "repair_records" RENAME COLUMN "ticket_number" TO "ticket_no";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'repair_records' AND column_name = 'device')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'repair_records' AND column_name = 'board_model') THEN
    ALTER TABLE "repair_records" RENAME COLUMN "device" TO "board_model";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'repair_records' AND column_name = 'fault')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'repair_records' AND column_name = 'fault_description') THEN
    ALTER TABLE "repair_records" RENAME COLUMN "fault" TO "fault_description";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'repair_records' AND column_name = 'metadata')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'repair_records' AND column_name = 'data') THEN
    ALTER TABLE "repair_records" RENAME COLUMN "metadata" TO "data";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'repair_records' AND column_name = 'opened_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'repair_records' AND column_name = 'received_at') THEN
    ALTER TABLE "repair_records" RENAME COLUMN "opened_at" TO "received_at";
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "repair_records" DROP CONSTRAINT IF EXISTS "repair_records_site_ticket_uq";--> statement-breakpoint
ALTER TABLE "repair_records" ALTER COLUMN "customer_name" SET DATA TYPE varchar(150);--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'repair_records_site_ticket_uq' AND conrelid = 'public.repair_records'::regclass
  ) THEN
    ALTER TABLE "repair_records" ADD CONSTRAINT "repair_records_site_ticket_uq" UNIQUE("site_id","ticket_no");
  END IF;
END $$;
