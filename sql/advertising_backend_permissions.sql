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
  (has_table_privilege('service_role', 'public.advertising_campaigns', 'SELECT')
    AND has_table_privilege('service_role', 'public.advertising_campaigns', 'INSERT')
    AND has_table_privilege('service_role', 'public.advertising_campaigns', 'UPDATE')) AS campaigns_ready,
  (has_table_privilege('service_role', 'public.advertising_impressions', 'SELECT')
    AND has_table_privilege('service_role', 'public.advertising_impressions', 'INSERT')) AS impressions_ready,
  (has_table_privilege('service_role', 'public.advertising_clicks', 'SELECT')
    AND has_table_privilege('service_role', 'public.advertising_clicks', 'INSERT')) AS clicks_ready,
  (has_table_privilege('service_role', 'public.machinery_advertisements', 'SELECT')
    AND has_table_privilege('service_role', 'public.machinery_advertisements', 'INSERT')
    AND has_table_privilege('service_role', 'public.machinery_advertisements', 'UPDATE')) AS machinery_ready;
