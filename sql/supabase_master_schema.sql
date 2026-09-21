-- ==============================================================================
-- TRANSMOVE MASTER SUPABASE DATABASE SCHEMA
-- PostgreSQL schema for Supabase: Authentication, Profiles, Vehicles, Requests,
-- Bids, Negotiations, Bookings, Events, Messages, Notifications, Reviews,
-- Subscriptions, EcoCash Payments, Advertising, and Driver Presence.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. PROFILES (Linked to auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    city TEXT,
    bio TEXT,
    role TEXT NOT NULL DEFAULT 'customer',
    profile_image_id TEXT,
    profile_photo_url TEXT,
    account_status TEXT NOT NULL DEFAULT 'active',
    verification_status TEXT NOT NULL DEFAULT 'unverified',
    verification_rejection_reason TEXT,
    rating_avg NUMERIC(3, 2) DEFAULT 0.00,
    rating_count INT DEFAULT 0,
    legacy_appwrite_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON public.profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_profiles_legacy_appwrite_id ON public.profiles(legacy_appwrite_id);

-- ------------------------------------------------------------------------------
-- 2. VEHICLES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    vehicle_type TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INT,
    colour TEXT,
    registration_number TEXT NOT NULL,
    passenger_capacity INT,
    load_capacity NUMERIC(10, 2),
    service_category TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    verification_status TEXT NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    legacy_appwrite_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_driver_id ON public.vehicles(driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_registration_number ON public.vehicles(registration_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_service_category ON public.vehicles(service_category);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON public.vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_verification_status ON public.vehicles(verification_status);

-- ------------------------------------------------------------------------------
-- 3. VEHICLE PHOTOS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    storage_provider TEXT NOT NULL DEFAULT 'google_drive',
    drive_file_id TEXT NOT NULL,
    original_filename TEXT,
    file_url TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    legacy_appwrite_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_photos_vehicle_id ON public.vehicle_photos(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_photos_driver_id ON public.vehicle_photos(driver_id);

-- ------------------------------------------------------------------------------
-- 4. VERIFICATION DOCUMENTS (Google Drive storage for physical bytes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verification_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    document_type TEXT NOT NULL,
    storage_provider TEXT NOT NULL DEFAULT 'google_drive',
    drive_file_id TEXT NOT NULL,
    original_filename TEXT,
    mime_type TEXT,
    file_size BIGINT,
    verification_status TEXT NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    expires_at TIMESTAMPTZ,
    legacy_appwrite_id TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_docs_user_id ON public.verification_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_docs_vehicle_id ON public.verification_documents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_verification_docs_status ON public.verification_documents(verification_status);

-- ------------------------------------------------------------------------------
-- 5. DRIVER PRESENCE (Heartbeat ~45s, offline after ~3 minutes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_presence (
    driver_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_online BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_lat NUMERIC(10, 7),
    current_lng NUMERIC(10, 7),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_presence_online ON public.driver_presence(is_online);
CREATE INDEX IF NOT EXISTS idx_driver_presence_last_seen ON public.driver_presence(last_seen_at);

-- ------------------------------------------------------------------------------
-- 6. SERVICE REQUESTS (Ride, Logistics, Hire, Courier, Bus, Machinery)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    passenger_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL,
    pickup_location TEXT NOT NULL,
    pickup_latitude NUMERIC(10, 7),
    pickup_longitude NUMERIC(10, 7),
    destination TEXT NOT NULL,
    destination_latitude NUMERIC(10, 7),
    destination_longitude NUMERIC(10, 7),
    request_date TIMESTAMPTZ,
    preferred_time TEXT,
    passenger_count INT,
    goods_type TEXT,
    details TEXT,
    budget NUMERIC(10, 2),
    status TEXT NOT NULL DEFAULT 'open_for_bids',
    legacy_appwrite_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_requests_passenger_id ON public.service_requests(passenger_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_service_type ON public.service_requests(service_type);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON public.service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_created_at ON public.service_requests(created_at);

-- ------------------------------------------------------------------------------
-- 7. REQUEST IMAGES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.request_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
    storage_provider TEXT NOT NULL DEFAULT 'google_drive',
    drive_file_id TEXT,
    url TEXT,
    legacy_appwrite_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_images_request_id ON public.request_images(request_id);

-- ------------------------------------------------------------------------------
-- 8. BIDS (Driver Offers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL,
    estimated_arrival_minutes INT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    legacy_appwrite_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uniq_request_driver UNIQUE (request_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_bids_request_id ON public.bids(request_id);
CREATE INDEX IF NOT EXISTS idx_bids_driver_id ON public.bids(driver_id);
CREATE INDEX IF NOT EXISTS idx_bids_status ON public.bids(status);

-- ------------------------------------------------------------------------------
-- 9. BID NEGOTIATIONS (Counter-offers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bid_negotiations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL,
    counter_amount NUMERIC(10, 2) NOT NULL,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    legacy_appwrite_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bid_negotiations_bid_id ON public.bid_negotiations(bid_id);
CREATE INDEX IF NOT EXISTS idx_bid_negotiations_sender_id ON public.bid_negotiations(sender_id);

-- ------------------------------------------------------------------------------
-- 10. BOOKINGS (Awarded Trips)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
    passenger_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    accepted_bid_id UUID REFERENCES public.bids(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    trip_pin TEXT,
    payment_status TEXT NOT NULL DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    legacy_appwrite_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uniq_booking_request UNIQUE (request_id)
);

CREATE INDEX IF NOT EXISTS idx_bookings_request_id ON public.bookings(request_id);
CREATE INDEX IF NOT EXISTS idx_bookings_passenger_id ON public.bookings(passenger_id);
CREATE INDEX IF NOT EXISTS idx_bookings_driver_id ON public.bookings(driver_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);

-- ------------------------------------------------------------------------------
-- 11. BOOKING EVENTS (Audit Trail)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL,
    event_type TEXT NOT NULL,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_events_booking_id ON public.booking_events(booking_id);

-- ------------------------------------------------------------------------------
-- 12. MESSAGES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id TEXT NOT NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    legacy_appwrite_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- ------------------------------------------------------------------------------
-- 13. NOTIFICATIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_id TEXT,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    legacy_appwrite_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);

-- ------------------------------------------------------------------------------
-- 14. REVIEWS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE,
    reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reviewee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    legacy_appwrite_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_booking_id ON public.reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON public.reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON public.reviews(reviewer_id);

-- ------------------------------------------------------------------------------
-- 15. FAVOURITES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.favourites (
    passenger_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (passenger_id, driver_id)
);

-- ------------------------------------------------------------------------------
-- 16. SUBSCRIPTION PLANS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'USD',
    duration_days INT NOT NULL DEFAULT 30,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    recommended BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INT NOT NULL DEFAULT 0,
    features JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON public.subscription_plans(slug);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON public.subscription_plans(active);

-- ------------------------------------------------------------------------------
-- 17. SUBSCRIPTIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
    plan TEXT NOT NULL DEFAULT 'TransMove Professional',
    amount NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'inactive',
    started_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    legacy_appwrite_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON public.subscriptions(expires_at);

-- ------------------------------------------------------------------------------
-- 18. PAYMENT DESTINATIONS (EcoCash accounts)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL DEFAULT 'ecocash',
    account_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    instructions TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_destinations_active ON public.payment_destinations(active);

-- ------------------------------------------------------------------------------
-- 19. PAYMENTS (EcoCash Manual Submissions & Verified Transactions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    payment_destination_id UUID REFERENCES public.payment_destinations(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    provider TEXT NOT NULL DEFAULT 'ecocash',
    reference TEXT NOT NULL,
    provider_reference TEXT,
    payment_type TEXT NOT NULL DEFAULT 'subscription',
    sender_name TEXT,
    sender_phone TEXT,
    proof_storage_provider TEXT NOT NULL DEFAULT 'google_drive',
    proof_file_id TEXT,
    proof_filename TEXT,
    status TEXT NOT NULL DEFAULT 'pending_review',
    admin_notes TEXT,
    poll_url TEXT,
    paid_at TIMESTAMPTZ,
    legacy_appwrite_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON public.payments(reference);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_payment_type ON public.payments(payment_type);

-- ------------------------------------------------------------------------------
-- 20. ADVERTISING CAMPAIGNS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.advertising_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    placement TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_review',
    budget NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    image_file_id TEXT,
    target_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_user_id ON public.advertising_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON public.advertising_campaigns(status);

-- ------------------------------------------------------------------------------
-- 21. ADVERTISING IMPRESSIONS & CLICKS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.advertising_impressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.advertising_campaigns(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_impressions_campaign_id ON public.advertising_impressions(campaign_id);

CREATE TABLE IF NOT EXISTS public.advertising_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.advertising_campaigns(id) ON DELETE CASCADE,
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_clicks_campaign_id ON public.advertising_clicks(campaign_id);

-- ------------------------------------------------------------------------------
-- 22. ACTIVITY LOGS (Admin Audit Trail)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT 'system',
    activity_type TEXT NOT NULL DEFAULT 'general',
    title TEXT NOT NULL,
    description TEXT,
    related_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at);

-- ------------------------------------------------------------------------------
-- 23. SAVED ADDRESSES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    address TEXT NOT NULL,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_addresses_user_id ON public.saved_addresses(user_id);

-- ------------------------------------------------------------------------------
-- AUTOMATED DRIVER RATING TRIGGER
-- Recalculates driver average rating and review count whenever a review is added
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_driver_rating_on_review()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET rating_avg = COALESCE((
            SELECT ROUND(AVG(rating)::numeric, 2)
            FROM public.reviews
            WHERE reviewee_id = NEW.reviewee_id
        ), 0.00),
        rating_count = (
            SELECT COUNT(*)
            FROM public.reviews
            WHERE reviewee_id = NEW.reviewee_id
        ),
        updated_at = NOW()
    WHERE id = NEW.reviewee_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_driver_rating ON public.reviews;
CREATE TRIGGER trg_update_driver_rating
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.update_driver_rating_on_review();

-- Trusted backend access for manual subscription payments. RLS remains in
-- force for browser roles; only the server-side service role receives writes.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.subscription_plans TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_destinations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO service_role;
