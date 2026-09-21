-- Non-destructive production migration for the trusted Supabase payment flow.
-- Run once in the Supabase SQL editor. It does not reset or delete user data.
BEGIN;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.subscription_plans TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_destinations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.subscriptions TO service_role;

INSERT INTO public.subscription_plans
  (id, name, slug, description, price, currency, duration_days, active, recommended, display_order, features)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'Flex Pass', 'flex-pass', '7 days bidding access for casual operators', 5.00, 'USD', 7, TRUE, FALSE, 1, '["Full bidding access for 7 days","Standard search placement","Direct chat with customers"]'::jsonb),
  ('10000000-0000-4000-8000-000000000002', 'TransMove Professional', 'professional', '30 days unlimited bidding and priority matching', 15.00, 'USD', 30, TRUE, TRUE, 2, '["Unlimited bidding for 30 days","Priority matching and notifications","Direct phone and chat","Verified provider badge"]'::jsonb),
  ('10000000-0000-4000-8000-000000000003', 'Pro 90', 'pro-90', 'Quarterly savings for active fleet operators', 40.00, 'USD', 90, TRUE, FALSE, 3, '["Full bidding for 90 days","Featured directory placement","Priority dispute resolution"]'::jsonb),
  ('10000000-0000-4000-8000-000000000004', 'Pro Annual', 'pro-annual', 'Best annual value with dedicated support', 140.00, 'USD', 365, TRUE, FALSE, 4, '["Full bidding for 365 days","Gold verified provider badge","Dedicated support line"]'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  currency = EXCLUDED.currency,
  duration_days = EXCLUDED.duration_days,
  active = EXCLUDED.active,
  recommended = EXCLUDED.recommended,
  display_order = EXCLUDED.display_order,
  features = EXCLUDED.features,
  updated_at = NOW();

INSERT INTO public.payment_destinations
  (id, provider, account_name, account_number, instructions, active, display_order)
VALUES
  ('20000000-0000-4000-8000-000000000001', 'ecocash', 'TransMove Logistics PVT LTD (Merchant)', '*151*2*2*123456#', 'Use EcoCash Send Money, enter the exact plan amount, and retain the confirmation reference.', TRUE, 1),
  ('20000000-0000-4000-8000-000000000002', 'ecocash', 'TransMove Operations (Biller Code 78901)', '78901', 'Use EcoCash Pay Merchant/Bill, enter biller code 78901, and retain the confirmation reference.', TRUE, 2)
ON CONFLICT (id) DO UPDATE SET
  provider = EXCLUDED.provider,
  account_name = EXCLUDED.account_name,
  account_number = EXCLUDED.account_number,
  instructions = EXCLUDED.instructions,
  active = EXCLUDED.active,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

COMMIT;
