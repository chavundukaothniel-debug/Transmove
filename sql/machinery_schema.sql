-- ==============================================================================
-- TRANSMOVE MACHINERY MARKETPLACE & HIRING & ADVERTISING SCHEMA MIGRATION
-- Safe & Idempotent DDL: Creates and safely updates all machinery tables,
-- supports multi-rate pricing, sale prices, operator rates, documents, enquiries,
-- ownership verification, and full permissions for Supabase service_role & authenticated.
-- ==============================================================================

-- 1. MACHINERY LISTINGS TABLE
CREATE TABLE IF NOT EXISTS public.machinery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    machine_category TEXT,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER,
    condition TEXT DEFAULT 'good', -- new, excellent, good, fair
    operating_hours NUMERIC DEFAULT 0,
    fuel_type TEXT DEFAULT 'diesel', -- diesel, petrol, electric, hybrid, other
    power TEXT,
    capacity TEXT,
    location TEXT NOT NULL,
    province TEXT,
    listing_type TEXT NOT NULL DEFAULT 'hire', -- hire, sale, both
    -- Multi-rate hire pricing
    hourly_rate NUMERIC,
    daily_rate NUMERIC,
    weekly_rate NUMERIC,
    monthly_rate NUMERIC,
    base_hire_rate NUMERIC, -- backward-compatibility alias for daily_rate
    rate_period TEXT DEFAULT 'daily',
    -- Sale pricing
    sale_price NUMERIC,
    -- Operator options and multi-rate operator pricing
    operator_available BOOLEAN NOT NULL DEFAULT false,
    operator_rate NUMERIC DEFAULT 0,
    operator_inclusive_rate NUMERIC,
    operator_hourly_rate NUMERIC,
    operator_daily_rate NUMERIC,
    operator_weekly_rate NUMERIC,
    operator_monthly_rate NUMERIC,
    -- Transport
    transport_available BOOLEAN DEFAULT false,
    transport_notes TEXT,
    -- Hire rules
    minimum_hire_period NUMERIC DEFAULT 1,
    minimum_hire_unit TEXT DEFAULT 'days', -- hours, days, weeks, months
    description TEXT,
    -- Photos metadata
    primary_photo JSONB DEFAULT '{}'::jsonb,
    gallery_photos JSONB DEFAULT '[]'::jsonb,
    photos JSONB DEFAULT '[]'::jsonb,
    -- Documents metadata
    documents JSONB DEFAULT '[]'::jsonb,
    -- Statuses
    status TEXT NOT NULL DEFAULT 'active', -- active, inactive, draft, archived
    verification_status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    availability_status TEXT NOT NULL DEFAULT 'available', -- available, booked, maintenance, unavailable, sold
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safely add any missing columns if table already existed with earlier schema
DO $$ 
BEGIN
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS machine_category TEXT;
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS listing_type TEXT NOT NULL DEFAULT 'hire';
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC;
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS daily_rate NUMERIC;
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS weekly_rate NUMERIC;
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS monthly_rate NUMERIC;
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS sale_price NUMERIC;
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS operator_hourly_rate NUMERIC;
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS operator_daily_rate NUMERIC;
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS operator_weekly_rate NUMERIC;
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS operator_monthly_rate NUMERIC;
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS transport_available BOOLEAN DEFAULT false;
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS transport_notes TEXT;
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS minimum_hire_period NUMERIC DEFAULT 1;
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS minimum_hire_unit TEXT DEFAULT 'days';
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS primary_photo JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS gallery_photos JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'good';
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS operating_hours NUMERIC DEFAULT 0;
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS fuel_type TEXT DEFAULT 'diesel';
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS power TEXT;
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS capacity TEXT;
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS province TEXT;
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS availability_status TEXT NOT NULL DEFAULT 'available';
    ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending';

    -- Sync machine_category and category
    UPDATE public.machinery SET machine_category = category WHERE machine_category IS NULL AND category IS NOT NULL;
    UPDATE public.machinery SET category = machine_category WHERE category IS NULL AND machine_category IS NOT NULL;
    UPDATE public.machinery SET daily_rate = base_hire_rate WHERE daily_rate IS NULL AND base_hire_rate IS NOT NULL;
    UPDATE public.machinery SET base_hire_rate = daily_rate WHERE base_hire_rate IS NULL AND daily_rate IS NOT NULL;
END $$;

-- 2. MACHINERY HIRES TABLE
CREATE TABLE IF NOT EXISTS public.machinery_hires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machinery_id UUID NOT NULL REFERENCES public.machinery(id) ON DELETE CASCADE,
    renter_id UUID NOT NULL,
    owner_id UUID NOT NULL,
    with_operator BOOLEAN NOT NULL DEFAULT false,
    rate_period TEXT NOT NULL DEFAULT 'daily', -- hourly, daily, weekly, monthly
    rate_applied NUMERIC NOT NULL,
    duration_units NUMERIC NOT NULL DEFAULT 1,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    calculated_total NUMERIC NOT NULL,
    job_location TEXT,
    notes TEXT,
    contact_name TEXT,
    contact_phone TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, declined, cancelled, active, completed
    decline_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safely add missing columns to machinery_hires if needed
DO $$ 
BEGIN
    ALTER TABLE public.machinery_hires ADD COLUMN IF NOT EXISTS rate_period TEXT NOT NULL DEFAULT 'daily';
    ALTER TABLE public.machinery_hires ADD COLUMN IF NOT EXISTS contact_name TEXT;
    ALTER TABLE public.machinery_hires ADD COLUMN IF NOT EXISTS contact_phone TEXT;
    ALTER TABLE public.machinery_hires ADD COLUMN IF NOT EXISTS decline_reason TEXT;
END $$;

-- 3. MACHINERY ADVERTISEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.machinery_advertisements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machinery_id UUID NOT NULL REFERENCES public.machinery(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- active, paused, expired
    start_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_at TIMESTAMPTZ NOT NULL,
    impressions INTEGER NOT NULL DEFAULT 0,
    clicks INTEGER NOT NULL DEFAULT 0,
    hire_requests_generated INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. MACHINERY AD DISMISSALS TABLE
CREATE TABLE IF NOT EXISTS public.machinery_ad_dismissals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    advertisement_id UUID NOT NULL REFERENCES public.machinery_advertisements(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. MACHINERY ENQUIRIES TABLE (FOR SALE & CUSTOM ENQUIRIES)
CREATE TABLE IF NOT EXISTS public.machinery_enquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machinery_id UUID NOT NULL REFERENCES public.machinery(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    owner_id UUID NOT NULL,
    enquiry_type TEXT NOT NULL DEFAULT 'sale', -- sale, hire_info, custom
    message TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    contact_phone TEXT,
    contact_email TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, responded, closed
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. MACHINERY OWNERSHIP & VERIFICATION DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS public.machinery_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machinery_id UUID NOT NULL REFERENCES public.machinery(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL,
    document_type TEXT NOT NULL, -- ownership_proof, registration, insurance, inspection, other
    file_name TEXT NOT NULL,
    drive_file_id TEXT NOT NULL,
    file_url TEXT NOT NULL,
    verification_status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. PERFORMANCE INDICES
CREATE INDEX IF NOT EXISTS idx_machinery_owner ON public.machinery(owner_id);
CREATE INDEX IF NOT EXISTS idx_machinery_category ON public.machinery(category);
CREATE INDEX IF NOT EXISTS idx_machinery_status ON public.machinery(status, availability_status);
CREATE INDEX IF NOT EXISTS idx_machinery_listing_type ON public.machinery(listing_type);
CREATE INDEX IF NOT EXISTS idx_machinery_hires_machinery ON public.machinery_hires(machinery_id);
CREATE INDEX IF NOT EXISTS idx_machinery_hires_renter ON public.machinery_hires(renter_id);
CREATE INDEX IF NOT EXISTS idx_machinery_hires_owner ON public.machinery_hires(owner_id);
CREATE INDEX IF NOT EXISTS idx_machinery_hires_status ON public.machinery_hires(status);
CREATE INDEX IF NOT EXISTS idx_machinery_ads_status ON public.machinery_advertisements(status, end_at);
CREATE INDEX IF NOT EXISTS idx_machinery_ad_dismissals_user ON public.machinery_ad_dismissals(user_id, advertisement_id);
CREATE INDEX IF NOT EXISTS idx_machinery_enquiries_owner ON public.machinery_enquiries(owner_id);
CREATE INDEX IF NOT EXISTS idx_machinery_docs_machinery ON public.machinery_documents(machinery_id);

-- 8. LEAST-PRIVILEGE PERMISSIONS (HARDENED)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- Revoke any excessive default permissions from public roles
REVOKE ALL ON TABLE public.machinery FROM anon, authenticated;
REVOKE ALL ON TABLE public.machinery_hires FROM anon, authenticated;
REVOKE ALL ON TABLE public.machinery_advertisements FROM anon, authenticated;
REVOKE ALL ON TABLE public.machinery_ad_dismissals FROM anon, authenticated;
REVOKE ALL ON TABLE public.machinery_enquiries FROM anon, authenticated;
REVOKE ALL ON TABLE public.machinery_documents FROM anon, authenticated;

-- Service role retains full backend management for trusted API execution
GRANT ALL ON TABLE public.machinery TO postgres, service_role;
GRANT ALL ON TABLE public.machinery_hires TO postgres, service_role;
GRANT ALL ON TABLE public.machinery_advertisements TO postgres, service_role;
GRANT ALL ON TABLE public.machinery_ad_dismissals TO postgres, service_role;
GRANT ALL ON TABLE public.machinery_enquiries TO postgres, service_role;
GRANT ALL ON TABLE public.machinery_documents TO postgres, service_role;

-- Anon and authenticated read permissions for public browsing
GRANT SELECT ON public.machinery TO anon, authenticated;
GRANT SELECT ON public.machinery_advertisements TO anon, authenticated;

-- Authenticated roles strictly scoped to own records
GRANT SELECT, INSERT ON public.machinery_hires TO authenticated;
GRANT SELECT, INSERT ON public.machinery_ad_dismissals TO authenticated;
GRANT SELECT, INSERT ON public.machinery_enquiries TO authenticated;
GRANT SELECT, INSERT ON public.machinery_documents TO authenticated;

-- 9. ROW LEVEL SECURITY (RLS) POLICIES — LEAST PRIVILEGE ENFORCEMENT
ALTER TABLE public.machinery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machinery_hires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machinery_advertisements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machinery_ad_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machinery_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machinery_documents ENABLE ROW LEVEL SECURITY;

-- Clean existing policies safely before recreating
DROP POLICY IF EXISTS "Public can view active machinery" ON public.machinery;
DROP POLICY IF EXISTS "Service role full access on machinery" ON public.machinery;
DROP POLICY IF EXISTS "Owner can view own machinery" ON public.machinery;

DROP POLICY IF EXISTS "Public can view active advertisements" ON public.machinery_advertisements;
DROP POLICY IF EXISTS "Service role full access on machinery_advertisements" ON public.machinery_advertisements;
DROP POLICY IF EXISTS "Owner can view own advertisements" ON public.machinery_advertisements;

DROP POLICY IF EXISTS "Service role full access on machinery_hires" ON public.machinery_hires;
DROP POLICY IF EXISTS "Participants can view hires" ON public.machinery_hires;
DROP POLICY IF EXISTS "Renters can create hire requests" ON public.machinery_hires;

DROP POLICY IF EXISTS "Service role full access on machinery_ad_dismissals" ON public.machinery_ad_dismissals;
DROP POLICY IF EXISTS "Users can view own dismissals" ON public.machinery_ad_dismissals;
DROP POLICY IF EXISTS "Users can record own dismissal" ON public.machinery_ad_dismissals;

DROP POLICY IF EXISTS "Service role full access on machinery_enquiries" ON public.machinery_enquiries;
DROP POLICY IF EXISTS "Participants can view enquiries" ON public.machinery_enquiries;
DROP POLICY IF EXISTS "Users can submit enquiries" ON public.machinery_enquiries;

DROP POLICY IF EXISTS "Service role full access on machinery_documents" ON public.machinery_documents;
DROP POLICY IF EXISTS "Owner can view own documents" ON public.machinery_documents;
DROP POLICY IF EXISTS "Owner can upload documents" ON public.machinery_documents;

-- MACHINERY POLICIES
CREATE POLICY "Service role full access on machinery"
    ON public.machinery FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Public can view active machinery"
    ON public.machinery FOR SELECT TO anon, authenticated
    USING (status IN ('active', 'available'));

CREATE POLICY "Owner can view own machinery"
    ON public.machinery FOR SELECT TO authenticated
    USING (auth.uid() = owner_id);

-- ADVERTISEMENTS POLICIES
CREATE POLICY "Service role full access on machinery_advertisements"
    ON public.machinery_advertisements FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Public can view active advertisements"
    ON public.machinery_advertisements FOR SELECT TO anon, authenticated
    USING (status = 'active' AND end_at > now());

CREATE POLICY "Owner can view own advertisements"
    ON public.machinery_advertisements FOR SELECT TO authenticated
    USING (auth.uid() = owner_id);

-- HIRES POLICIES
CREATE POLICY "Service role full access on machinery_hires"
    ON public.machinery_hires FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Participants can view hires"
    ON public.machinery_hires FOR SELECT TO authenticated
    USING (auth.uid() = renter_id OR auth.uid() = owner_id);

CREATE POLICY "Renters can create hire requests"
    ON public.machinery_hires FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = renter_id);

-- DISMISSALS POLICIES
CREATE POLICY "Service role full access on machinery_ad_dismissals"
    ON public.machinery_ad_dismissals FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own dismissals"
    ON public.machinery_ad_dismissals FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can record own dismissal"
    ON public.machinery_ad_dismissals FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- ENQUIRIES POLICIES
CREATE POLICY "Service role full access on machinery_enquiries"
    ON public.machinery_enquiries FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Participants can view enquiries"
    ON public.machinery_enquiries FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR auth.uid() = owner_id);

CREATE POLICY "Users can submit enquiries"
    ON public.machinery_enquiries FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- DOCUMENTS POLICIES (STRICTLY PRIVATE TO OWNER & SERVICE_ROLE)
CREATE POLICY "Service role full access on machinery_documents"
    ON public.machinery_documents FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Owner can view own documents"
    ON public.machinery_documents FOR SELECT TO authenticated
    USING (auth.uid() = owner_id);

CREATE POLICY "Owner can upload documents"
    ON public.machinery_documents FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = owner_id);

-- 10. RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
