-- ==============================================================================
-- TRANSMOVE DATABASE SCHEMA & ROW LEVEL SECURITY (RLS)
-- SOLE BACKEND: SUPABASE POSTGRESQL
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. ENUMS & DOMAINS
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('customer', 'driver', 'owner', 'admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE verification_status AS ENUM ('none', 'pending', 'approved', 'rejected', 'suspended');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE account_status AS ENUM ('active', 'suspended', 'deactivated');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE driver_availability AS ENUM ('online', 'offline', 'busy');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE request_type AS ENUM ('ride', 'logistics', 'hire');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE request_status AS ENUM ('searching', 'offers_received', 'negotiating', 'accepted', 'driver_arriving', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE offer_status AS ENUM ('pending', 'countered_by_customer', 'countered_by_driver', 'accepted', 'rejected', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE booking_status AS ENUM ('confirmed', 'driver_arriving', 'in_progress', 'completed', 'cancelled', 'disputed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE subscription_tier AS ENUM ('free', 'standard', 'pro', 'enterprise');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('active', 'expired', 'cancelled', 'pending_payment');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('credit', 'debit');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE transaction_category AS ENUM ('payment', 'refund', 'commission', 'payout', 'adjustment');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 2. PROFILES TABLE (Linked to auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone_number TEXT,
    profile_photo_url TEXT,
    role user_role NOT NULL DEFAULT 'customer',
    verification_status verification_status NOT NULL DEFAULT 'none',
    account_status account_status NOT NULL DEFAULT 'active',
    driver_availability driver_availability NOT NULL DEFAULT 'offline',
    service_area TEXT,
    bio TEXT,
    national_id_number TEXT,
    national_id_photo_url TEXT,
    driver_license_url TEXT,
    company_name TEXT,
    corporate_id UUID,
    emergency_contacts JSONB DEFAULT '[]'::jsonb,
    referral_code TEXT UNIQUE,
    rating_avg NUMERIC(3, 2) DEFAULT 0.00,
    rating_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. VEHICLES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    vehicle_type TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INT NOT NULL,
    registration_number TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL,
    passenger_capacity INT NOT NULL DEFAULT 4,
    load_capacity_kg NUMERIC(10, 2) DEFAULT 0.00,
    insurance_doc_url TEXT,
    operating_area TEXT,
    photos JSONB DEFAULT '[]'::jsonb,
    documents JSONB DEFAULT '[]'::jsonb,
    verification_status verification_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. EQUIPMENT & MACHINERY LISTINGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.equipment_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INT,
    description TEXT NOT NULL,
    rate_per_hour NUMERIC(10, 2),
    rate_per_day NUMERIC(10, 2) NOT NULL,
    rate_currency TEXT NOT NULL DEFAULT 'USD',
    location_name TEXT NOT NULL,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    photos JSONB DEFAULT '[]'::jsonb,
    availability_status TEXT NOT NULL DEFAULT 'available',
    verification_status verification_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. RIDE & TRANSPORT REQUESTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ride_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    request_type request_type NOT NULL DEFAULT 'ride',
    pickup_address TEXT NOT NULL,
    pickup_lat NUMERIC(10, 7) NOT NULL,
    pickup_lng NUMERIC(10, 7) NOT NULL,
    destination_address TEXT NOT NULL,
    dest_lat NUMERIC(10, 7) NOT NULL,
    dest_lng NUMERIC(10, 7) NOT NULL,
    estimated_distance_km NUMERIC(8, 2),
    estimated_duration_mins INT,
    requested_vehicle_type TEXT,
    passenger_count INT DEFAULT 1,
    load_description TEXT,
    load_weight_kg NUMERIC(10, 2),
    load_dimensions TEXT,
    load_photos JSONB DEFAULT '[]'::jsonb,
    recipient_name TEXT,
    recipient_phone TEXT,
    recipient_pin TEXT,
    tracking_number TEXT,
    package_details JSONB DEFAULT '{}'::jsonb,
    requested_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    suggested_price NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    notes TEXT,
    status request_status NOT NULL DEFAULT 'searching',
    accepted_offer_id UUID,
    cancellation_reason TEXT,
    cancelled_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. TRANSMOVE OFFERS & BIDDING
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES public.ride_requests(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES public.vehicles(id),
    proposed_price NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    estimated_arrival_mins INT NOT NULL,
    message TEXT,
    counter_price NUMERIC(10, 2),
    counter_by UUID REFERENCES public.profiles(id),
    status offer_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_driver_request_offer UNIQUE (request_id, driver_id)
);

-- ------------------------------------------------------------------------------
-- 7. BOOKINGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES public.ride_requests(id) ON DELETE RESTRICT,
    offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    vehicle_id UUID REFERENCES public.vehicles(id),
    equipment_id UUID REFERENCES public.equipment_listings(id),
    final_price NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    trip_pin VARCHAR(4),
    recipient_pin VARCHAR(4),
    tracking_number TEXT,
    status booking_status NOT NULL DEFAULT 'confirmed',
    pickup_time TIMESTAMPTZ,
    start_time TIMESTAMPTZ,
    completed_time TIMESTAMPTZ,
    cancellation_reason TEXT,
    cancelled_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_booking_request UNIQUE (request_id)
);

-- ------------------------------------------------------------------------------
-- 7B. SAVED LOCATIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    address TEXT NOT NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7C. CORPORATE ACCOUNTS & EMPLOYEES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.corporate_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name TEXT NOT NULL,
    admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    billing_email TEXT NOT NULL,
    monthly_spending_limit NUMERIC(10, 2) DEFAULT 1000.00,
    current_month_spend NUMERIC(10, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.corporate_employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    corporate_id UUID NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    spending_limit NUMERIC(10, 2) DEFAULT 200.00,
    current_spend NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_corporate_employee UNIQUE (corporate_id, employee_id)
);

-- ------------------------------------------------------------------------------
-- 7D. SUPPORT & DISPUTES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES public.bookings(id),
    category TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    resolution_notes TEXT,
    refund_amount NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7E. PROMOTIONS & REFERRALS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.promo_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    discount_percent INT DEFAULT 10,
    max_discount_usd NUMERIC(10, 2) DEFAULT 5.00,
    valid_until TIMESTAMPTZ,
    max_uses INT DEFAULT 100,
    current_uses INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    referred_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reward_amount NUMERIC(10, 2) DEFAULT 2.00,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. REALTIME MESSAGING
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. NOTIFICATIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL,
    reference_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 10. SUBSCRIPTION PLANS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    tier subscription_tier NOT NULL,
    role_target TEXT NOT NULL DEFAULT 'all',
    price NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    billing_interval TEXT NOT NULL DEFAULT 'monthly',
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 11. USER SUBSCRIPTIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
    status subscription_status NOT NULL DEFAULT 'pending_payment',
    price_paid NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    start_date TIMESTAMPTZ,
    expiry_date TIMESTAMPTZ,
    payment_reference TEXT,
    provider TEXT NOT NULL DEFAULT 'paynow',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 12. PAYMENT TRANSACTIONS & AUDIT LEDGER
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    payment_provider TEXT NOT NULL DEFAULT 'paynow',
    paynow_reference TEXT,
    internal_reference TEXT NOT NULL UNIQUE,
    payment_status payment_status NOT NULL DEFAULT 'pending',
    subscription_id UUID REFERENCES public.user_subscriptions(id),
    booking_id UUID REFERENCES public.bookings(id),
    purpose TEXT NOT NULL,
    verification_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wallet_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    amount NUMERIC(10, 2) NOT NULL,
    transaction_type transaction_type NOT NULL,
    category transaction_category NOT NULL,
    reference_id UUID,
    description TEXT NOT NULL,
    balance_after NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 13. RATINGS & REVIEWS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reviewee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_booking_reviewer UNIQUE (booking_id, reviewer_id)
);

-- ------------------------------------------------------------------------------
-- 14. ADMIN AUDIT LOGS & PLATFORM SETTINGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 14B. ADVERTISING PLATFORM & EVENT TRACKING
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.advertisements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    advertiser_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT NOT NULL,
    destination_url TEXT NOT NULL,
    placement TEXT NOT NULL DEFAULT 'marketplace_banner',
    status TEXT NOT NULL DEFAULT 'pending_review',
    start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_at TIMESTAMPTZ,
    budget NUMERIC(10, 2) DEFAULT 0.00,
    impressions INT NOT NULL DEFAULT 0,
    clicks INT NOT NULL DEFAULT 0,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ad_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    advertisement_id UUID NOT NULL REFERENCES public.advertisements(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 15. INDEXES FOR HIGH-PERFORMANCE QUERIES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_verification ON public.profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_vehicles_driver ON public.vehicles(driver_id);
CREATE INDEX IF NOT EXISTS idx_equipment_owner ON public.equipment_listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.ride_requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_customer ON public.ride_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_offers_request ON public.offers(request_id);
CREATE INDEX IF NOT EXISTS idx_offers_driver ON public.offers(driver_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON public.bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_driver ON public.bookings(driver_id);
CREATE INDEX IF NOT EXISTS idx_messages_booking ON public.messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON public.wallet_ledger(user_id);

-- ------------------------------------------------------------------------------
-- 16. HELPER FUNCTIONS & RESILIENT TRIGGERS
-- ------------------------------------------------------------------------------

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$;

-- Resilient Trigger to create profile upon new Supabase auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role_text TEXT;
    v_role user_role := 'customer'::user_role;
    v_status verification_status := 'none'::verification_status;
BEGIN
    v_role_text := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'customer'));
    
    IF v_role_text = 'driver' THEN
        v_role := 'driver'::user_role;
        v_status := 'pending'::verification_status;
    ELSIF v_role_text = 'owner' THEN
        v_role := 'owner'::user_role;
        v_status := 'pending'::verification_status;
    ELSIF v_role_text = 'admin' THEN
        v_role := 'admin'::user_role;
        v_status := 'none'::verification_status;
    ELSE
        v_role := 'customer'::user_role;
        v_status := 'none'::verification_status;
    END IF;

    INSERT INTO public.profiles (
        id,
        full_name,
        email,
        phone_number,
        role,
        verification_status
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'TransMove User'),
        COALESCE(NEW.email, ''),
        NEW.raw_user_meta_data->>'phone_number',
        v_role,
        v_status
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone_number = EXCLUDED.phone_number,
        updated_at = NOW();

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Prevent signup failure even if profile insertion encounters an unexpected issue
    RAISE WARNING 'handle_new_user trigger caught error: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for updating ratings upon review insertion
CREATE OR REPLACE FUNCTION public.update_profile_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles
    SET 
        rating_avg = (
            SELECT COALESCE(AVG(rating), 0.00) 
            FROM public.reviews 
            WHERE reviewee_id = NEW.reviewee_id
        ),
        rating_count = (
            SELECT COUNT(*) 
            FROM public.reviews 
            WHERE reviewee_id = NEW.reviewee_id
        ),
        updated_at = NOW()
    WHERE id = NEW.reviewee_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_review_created ON public.reviews;
CREATE TRIGGER on_review_created
    AFTER INSERT ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.update_profile_rating();

-- Function for atomic offer acceptance to prevent race conditions
CREATE OR REPLACE FUNCTION public.accept_offer(p_offer_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_offer RECORD;
    v_request RECORD;
    v_booking_id UUID;
BEGIN
    SELECT * INTO v_offer
    FROM public.offers
    WHERE id = p_offer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Offer not found';
    END IF;

    SELECT * INTO v_request
    FROM public.ride_requests
    WHERE id = v_offer.request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found';
    END IF;

    IF v_request.customer_id != auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized to accept this offer';
    END IF;

    IF v_request.status NOT IN ('searching', 'offers_received', 'negotiating') THEN
        RAISE EXCEPTION 'Request is no longer open for acceptance';
    END IF;

    -- Update accepted offer
    UPDATE public.offers
    SET status = 'accepted', updated_at = NOW()
    WHERE id = p_offer_id;

    -- Reject all other offers for this request
    UPDATE public.offers
    SET status = 'rejected', updated_at = NOW()
    WHERE request_id = v_offer.request_id AND id != p_offer_id;

    -- Update request status
    UPDATE public.ride_requests
    SET status = 'accepted', accepted_offer_id = p_offer_id, updated_at = NOW()
    WHERE id = v_offer.request_id;

    -- Generate 4-digit PIN and tracking number
    DECLARE
        v_pin VARCHAR(4) := LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');
        v_tracking TEXT := 'TRX-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
    BEGIN
        -- Create confirmed booking
        INSERT INTO public.bookings (
            request_id,
            offer_id,
            customer_id,
            driver_id,
            vehicle_id,
            final_price,
            currency,
            trip_pin,
            recipient_pin,
            tracking_number,
            status,
            pickup_time
        )
        VALUES (
            v_offer.request_id,
            p_offer_id,
            v_request.customer_id,
            v_offer.driver_id,
            v_offer.vehicle_id,
            COALESCE(v_offer.counter_price, v_offer.proposed_price),
            v_offer.currency,
            v_pin,
            v_request.recipient_pin,
            COALESCE(v_request.tracking_number, v_tracking),
            'confirmed',
            v_request.requested_time
        )
        RETURNING id INTO v_booking_id;
    END;

    -- Create notification for selected driver
    INSERT INTO public.notifications (
        user_id,
        title,
        body,
        type,
        reference_id
    )
    VALUES (
        v_offer.driver_id,
        'Offer Accepted! 🎉',
        'Your offer has been accepted. View booking details and start trip.',
        'offer_accepted',
        v_booking_id
    );

    RETURN v_booking_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 15. TRIP EVENTS & STATUS TIMELINE LOGIC
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trip_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id),
    status TEXT NOT NULL,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 16. DRIVER & PROVIDER VERIFICATION DOCUMENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL, -- 'id_card', 'driver_license', 'vehicle_registration', 'insurance_policy'
    document_url TEXT NOT NULL,
    document_number TEXT,
    expiry_date DATE,
    verification_status verification_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helper function to generate human-readable reference IDs
CREATE OR REPLACE FUNCTION public.generate_transmove_reference(prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    seq_num INT;
BEGIN
    seq_num := floor(100000 + random() * 900000)::INT;
    RETURN prefix || '-' || TO_CHAR(NOW(), 'YYYY') || '-' || seq_num;
END;
$$;
