BEGIN;
ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS rejection_reason text;
-- Preserve existing reviews while allowing one review per participant.
DO $$ DECLARE constraint_row record; BEGIN
 FOR constraint_row IN SELECT conname FROM pg_constraint WHERE conrelid='public.reviews'::regclass AND contype='u' AND pg_get_constraintdef(oid)='UNIQUE (booking_id)' LOOP
  EXECUTE format('ALTER TABLE public.reviews DROP CONSTRAINT %I',constraint_row.conname);
 END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS reviews_booking_reviewer_unique ON public.reviews(booking_id,reviewer_id);
CREATE EXTENSION IF NOT EXISTS btree_gist;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='machinery_hires_no_overlap' AND conrelid='public.machinery_hires'::regclass) THEN
  ALTER TABLE public.machinery_hires ADD CONSTRAINT machinery_hires_no_overlap EXCLUDE USING gist (machinery_id WITH =, tstzrange(start_date,end_date,'[)') WITH &&) WHERE (status IN ('accepted','active'));
 END IF;
END $$;
COMMIT;
