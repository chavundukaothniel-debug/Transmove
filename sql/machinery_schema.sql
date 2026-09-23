-- TransMove Machinery Marketplace Schema Migration
-- Safe DDL: creates machinery, machinery_hires, machinery_advertisements, and machinery_ad_dismissals
-- Does NOT drop or reset any existing tables or production data.

CREATE TABLE IF NOT EXISTS public.machinery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER,
    condition TEXT DEFAULT 'good',
    description TEXT,
    location TEXT NOT NULL,
    province TEXT,
    operating_hours NUMERIC DEFAULT 0,
    fuel_type TEXT,
    power TEXT,
    capacity TEXT,
    status TEXT NOT NULL DEFAULT 'active', -- active, inactive, draft, archived
    verification_status TEXT NOT NULL DEFAULT 'pending', -- pending, verified, rejected
    availability_status TEXT NOT NULL DEFAULT 'available', -- available, busy, maintenance
    base_hire_rate NUMERIC NOT NULL,
    rate_period TEXT NOT NULL DEFAULT 'per_day', -- per_day, per_hour, per_week, per_month
    operator_available BOOLEAN NOT NULL DEFAULT false,
    operator_rate NUMERIC DEFAULT 0,
    operator_inclusive_rate NUMERIC,
    minimum_hire_period INTEGER DEFAULT 1,
    transport_available BOOLEAN DEFAULT false,
    photos JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.machinery_hires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machinery_id UUID NOT NULL REFERENCES public.machinery(id) ON DELETE CASCADE,
    renter_id UUID NOT NULL,
    owner_id UUID NOT NULL,
    with_operator BOOLEAN NOT NULL DEFAULT false,
    rate_applied NUMERIC NOT NULL,
    rate_period TEXT NOT NULL DEFAULT 'per_day',
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

CREATE TABLE IF NOT EXISTS public.machinery_ad_dismissals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    advertisement_id UUID NOT NULL REFERENCES public.machinery_advertisements(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_machinery_owner ON public.machinery(owner_id);
CREATE INDEX IF NOT EXISTS idx_machinery_category ON public.machinery(category);
CREATE INDEX IF NOT EXISTS idx_machinery_status ON public.machinery(status, availability_status);
CREATE INDEX IF NOT EXISTS idx_machinery_hires_machinery ON public.machinery_hires(machinery_id);
CREATE INDEX IF NOT EXISTS idx_machinery_hires_renter ON public.machinery_hires(renter_id);
CREATE INDEX IF NOT EXISTS idx_machinery_hires_owner ON public.machinery_hires(owner_id);
CREATE INDEX IF NOT EXISTS idx_machinery_hires_status ON public.machinery_hires(status);
CREATE INDEX IF NOT EXISTS idx_machinery_ads_status ON public.machinery_advertisements(status, end_at);
CREATE INDEX IF NOT EXISTS idx_machinery_ad_dismissals_user ON public.machinery_ad_dismissals(user_id, advertisement_id);
