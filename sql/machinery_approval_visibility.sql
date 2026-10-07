-- Apply to an existing Supabase project before deploying the portal update.
BEGIN;
DROP POLICY IF EXISTS "Public can view active machinery" ON public.machinery;
CREATE POLICY "Public can view active machinery"
  ON public.machinery FOR SELECT TO anon, authenticated
  USING (status IN ('active', 'available') AND verification_status IN ('approved', 'verified'));
-- Hire creation must use the trusted API for approval, availability and pricing checks.
DROP POLICY IF EXISTS "Renters can create hire requests" ON public.machinery_hires;
COMMIT;
