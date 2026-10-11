-- Run once in the TransMove Supabase project's SQL editor as database owner.
-- Repairs missing privileges for the existing trusted backend role.
-- Does not change records, grant browser access, or disable row-level security.
BEGIN;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.advertising_campaigns TO service_role;
GRANT SELECT, INSERT ON TABLE public.advertising_impressions TO service_role;
GRANT SELECT, INSERT ON TABLE public.advertising_clicks TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.machinery_advertisements TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;

-- Each result should be true after the repair.
SELECT
  has_table_privilege('service_role', 'public.advertising_campaigns', 'SELECT, INSERT, UPDATE') AS campaigns_ready,
  has_table_privilege('service_role', 'public.advertising_impressions', 'SELECT, INSERT') AS impressions_ready,
  has_table_privilege('service_role', 'public.advertising_clicks', 'SELECT, INSERT') AS clicks_ready,
  has_table_privilege('service_role', 'public.machinery_advertisements', 'SELECT, INSERT, UPDATE') AS machinery_ready;
