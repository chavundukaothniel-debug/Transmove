-- ==============================================================================
-- TRANSMOVE ROW LEVEL SECURITY (RLS) POLICIES
-- Strict least-privilege security. Service role bypasses RLS for trusted backend.
-- ==============================================================================

-- 1. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advertising_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advertising_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advertising_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;

-- Helper: Check if auth.uid() is an active admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin' AND account_status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- PROFILES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles are viewable by owners and admins" ON public.profiles;
CREATE POLICY "Profiles are viewable by owners and admins"
ON public.profiles FOR SELECT
USING (
    id = auth.uid()
    OR role IN ('driver', 'owner', 'logistics')
    OR public.is_admin()
);

DROP POLICY IF EXISTS "Users can update own non-privileged profile" ON public.profiles;
CREATE POLICY "Users can update own non-privileged profile"
ON public.profiles FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles"
ON public.profiles FOR ALL
USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- VEHICLES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Drivers can view and manage own vehicles" ON public.vehicles;
CREATE POLICY "Drivers can view and manage own vehicles"
ON public.vehicles FOR ALL
USING (driver_id = auth.uid() OR public.is_admin())
WITH CHECK (driver_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Public can view active verified vehicles" ON public.vehicles;
CREATE POLICY "Public can view active verified vehicles"
ON public.vehicles FOR SELECT
USING (status = 'active' AND verification_status = 'approved');

-- ------------------------------------------------------------------------------
-- VERIFICATION DOCUMENTS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own verification documents" ON public.verification_documents;
CREATE POLICY "Users can view own verification documents"
ON public.verification_documents FOR SELECT
USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can upload own verification documents" ON public.verification_documents;
CREATE POLICY "Users can upload own verification documents"
ON public.verification_documents FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can update verification status" ON public.verification_documents;
CREATE POLICY "Admins can update verification status"
ON public.verification_documents FOR UPDATE
USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- DRIVER PRESENCE POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view online driver presence" ON public.driver_presence;
CREATE POLICY "Anyone can view online driver presence"
ON public.driver_presence FOR SELECT
USING (is_online = true OR driver_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Drivers can upsert own presence" ON public.driver_presence;
CREATE POLICY "Drivers can upsert own presence"
ON public.driver_presence FOR ALL
USING (driver_id = auth.uid())
WITH CHECK (driver_id = auth.uid());

-- ------------------------------------------------------------------------------
-- SERVICE REQUESTS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Passengers manage own service requests" ON public.service_requests;
CREATE POLICY "Passengers manage own service requests"
ON public.service_requests FOR ALL
USING (passenger_id = auth.uid() OR public.is_admin())
WITH CHECK (passenger_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Providers can view open requests" ON public.service_requests;
CREATE POLICY "Providers can view open requests"
ON public.service_requests FOR SELECT
USING (status IN ('open_for_bids', 'offers_received', 'negotiating'));

-- ------------------------------------------------------------------------------
-- BIDS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Drivers manage own bids" ON public.bids;
CREATE POLICY "Drivers manage own bids"
ON public.bids FOR ALL
USING (driver_id = auth.uid() OR public.is_admin())
WITH CHECK (driver_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Passengers view bids for their requests" ON public.bids;
CREATE POLICY "Passengers view bids for their requests"
ON public.bids FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.service_requests sr
        WHERE sr.id = request_id AND sr.passenger_id = auth.uid()
    )
);

-- ------------------------------------------------------------------------------
-- BID NEGOTIATIONS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants view negotiations" ON public.bid_negotiations;
CREATE POLICY "Participants view negotiations"
ON public.bid_negotiations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.bids b
        JOIN public.service_requests sr ON sr.id = b.request_id
        WHERE b.id = bid_id AND (b.driver_id = auth.uid() OR sr.passenger_id = auth.uid())
    ) OR public.is_admin()
);

DROP POLICY IF EXISTS "Participants create counter offers" ON public.bid_negotiations;
CREATE POLICY "Participants create counter offers"
ON public.bid_negotiations FOR INSERT
WITH CHECK (sender_id = auth.uid());

-- ------------------------------------------------------------------------------
-- BOOKINGS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants view their bookings" ON public.bookings;
CREATE POLICY "Participants view their bookings"
ON public.bookings FOR SELECT
USING (passenger_id = auth.uid() OR driver_id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------------------------
-- MESSAGES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view own messages" ON public.messages;
CREATE POLICY "Users view own messages"
ON public.messages FOR SELECT
USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users send messages" ON public.messages;
CREATE POLICY "Users send messages"
ON public.messages FOR INSERT
WITH CHECK (sender_id = auth.uid());

-- ------------------------------------------------------------------------------
-- NOTIFICATIONS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users manage own notifications" ON public.notifications;
CREATE POLICY "Users manage own notifications"
ON public.notifications FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- REVIEWS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Reviews are publicly viewable" ON public.reviews;
CREATE POLICY "Reviews are publicly viewable"
ON public.reviews FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Passengers review completed bookings" ON public.reviews;
CREATE POLICY "Passengers review completed bookings"
ON public.reviews FOR INSERT
WITH CHECK (
    reviewer_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = booking_id AND b.passenger_id = auth.uid() AND b.status = 'completed'
    )
);

-- ------------------------------------------------------------------------------
-- SUBSCRIPTIONS & PLANS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Subscription plans are publicly viewable" ON public.subscription_plans;
CREATE POLICY "Subscription plans are publicly viewable"
ON public.subscription_plans FOR SELECT
USING (active = true OR public.is_admin());

DROP POLICY IF EXISTS "Users view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users view own subscriptions"
ON public.subscriptions FOR SELECT
USING (user_id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------------------------
-- PAYMENTS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Payment destinations are publicly viewable" ON public.payment_destinations;
CREATE POLICY "Payment destinations are publicly viewable"
ON public.payment_destinations FOR SELECT
USING (active = true OR public.is_admin());

DROP POLICY IF EXISTS "Users view own payments" ON public.payments;
CREATE POLICY "Users view own payments"
ON public.payments FOR SELECT
USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users submit own payments" ON public.payments;
CREATE POLICY "Users submit own payments"
ON public.payments FOR INSERT
WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- SAVED ADDRESSES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users manage own saved addresses" ON public.saved_addresses;
CREATE POLICY "Users manage own saved addresses"
ON public.saved_addresses FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
