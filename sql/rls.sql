-- ==============================================================================
-- TRANSMOVE ROW LEVEL SECURITY (RLS) POLICIES (IDEMPOTENT)
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 1. PROFILES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view basic driver and owner profiles" ON public.profiles;
CREATE POLICY "Public can view basic driver and owner profiles"
    ON public.profiles FOR SELECT
    USING (
        role IN ('driver', 'owner') AND verification_status = 'approved'
        OR auth.uid() = id
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id 
        AND (role = (SELECT role FROM public.profiles WHERE id = auth.uid()) OR public.is_admin())
        AND (verification_status = (SELECT verification_status FROM public.profiles WHERE id = auth.uid()) OR public.is_admin())
    );

DROP POLICY IF EXISTS "Admins have full access to profiles" ON public.profiles;
CREATE POLICY "Admins have full access to profiles"
    ON public.profiles FOR ALL
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 2. VEHICLES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view verified active vehicles" ON public.vehicles;
CREATE POLICY "Public can view verified active vehicles"
    ON public.vehicles FOR SELECT
    USING (
        (verification_status = 'approved' AND is_active = true)
        OR driver_id = auth.uid()
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Drivers can insert their own vehicles" ON public.vehicles;
CREATE POLICY "Drivers can insert their own vehicles"
    ON public.vehicles FOR INSERT
    WITH CHECK (
        driver_id = auth.uid()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('driver', 'admin'))
    );

DROP POLICY IF EXISTS "Drivers can update their own vehicles" ON public.vehicles;
CREATE POLICY "Drivers can update their own vehicles"
    ON public.vehicles FOR UPDATE
    USING (driver_id = auth.uid() OR public.is_admin())
    WITH CHECK (driver_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Drivers can delete their own vehicles" ON public.vehicles;
CREATE POLICY "Drivers can delete their own vehicles"
    ON public.vehicles FOR DELETE
    USING (driver_id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 3. EQUIPMENT LISTINGS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view approved equipment listings" ON public.equipment_listings;
CREATE POLICY "Anyone can view approved equipment listings"
    ON public.equipment_listings FOR SELECT
    USING (
        (verification_status = 'approved' AND availability_status != 'maintenance')
        OR owner_id = auth.uid()
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Owners can insert equipment" ON public.equipment_listings;
CREATE POLICY "Owners can insert equipment"
    ON public.equipment_listings FOR INSERT
    WITH CHECK (
        owner_id = auth.uid()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
    );

DROP POLICY IF EXISTS "Owners can update their own equipment" ON public.equipment_listings;
CREATE POLICY "Owners can update their own equipment"
    ON public.equipment_listings FOR UPDATE
    USING (owner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Owners can delete their own equipment" ON public.equipment_listings;
CREATE POLICY "Owners can delete their own equipment"
    ON public.equipment_listings FOR DELETE
    USING (owner_id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 4. RIDE & TRANSPORT REQUESTS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers view their own requests; Approved Drivers view searching requests" ON public.ride_requests;
CREATE POLICY "Customers view their own requests; Approved Drivers view searching requests"
    ON public.ride_requests FOR SELECT
    USING (
        customer_id = auth.uid()
        OR (
            status IN ('searching', 'offers_received', 'negotiating')
            AND EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() AND role IN ('driver', 'owner') AND verification_status = 'approved'
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.bookings 
            WHERE request_id = public.ride_requests.id AND driver_id = auth.uid()
        )
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Customers can insert their own requests" ON public.ride_requests;
CREATE POLICY "Customers can insert their own requests"
    ON public.ride_requests FOR INSERT
    WITH CHECK (
        customer_id = auth.uid()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('customer', 'admin'))
    );

DROP POLICY IF EXISTS "Customers can update their own active requests" ON public.ride_requests;
CREATE POLICY "Customers can update their own active requests"
    ON public.ride_requests FOR UPDATE
    USING (customer_id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 5. OFFERS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Drivers and relevant customers view offers" ON public.offers;
CREATE POLICY "Drivers and relevant customers view offers"
    ON public.offers FOR SELECT
    USING (
        driver_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.ride_requests 
            WHERE id = public.offers.request_id AND customer_id = auth.uid()
        )
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Approved drivers can submit offers" ON public.offers;
CREATE POLICY "Approved drivers can submit offers"
    ON public.offers FOR INSERT
    WITH CHECK (
        driver_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('driver', 'owner') AND verification_status = 'approved'
        )
    );

DROP POLICY IF EXISTS "Drivers and Customers can update offers during negotiation" ON public.offers;
CREATE POLICY "Drivers and Customers can update offers during negotiation"
    ON public.offers FOR UPDATE
    USING (
        driver_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM public.ride_requests 
            WHERE id = public.offers.request_id AND customer_id = auth.uid()
        )
        OR public.is_admin()
    );

-- ------------------------------------------------------------------------------
-- 6. BOOKINGS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants view their bookings" ON public.bookings;
CREATE POLICY "Participants view their bookings"
    ON public.bookings FOR SELECT
    USING (
        customer_id = auth.uid()
        OR driver_id = auth.uid()
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Participants can insert bookings" ON public.bookings;
CREATE POLICY "Participants can insert bookings"
    ON public.bookings FOR INSERT
    WITH CHECK (
        customer_id = auth.uid()
        OR driver_id = auth.uid()
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Participants can update booking status" ON public.bookings;
CREATE POLICY "Participants can update booking status"
    ON public.bookings FOR UPDATE
    USING (
        customer_id = auth.uid()
        OR driver_id = auth.uid()
        OR public.is_admin()
    );

-- ------------------------------------------------------------------------------
-- 7. MESSAGES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants can view conversation messages" ON public.messages;
CREATE POLICY "Participants can view conversation messages"
    ON public.messages FOR SELECT
    USING (
        sender_id = auth.uid()
        OR receiver_id = auth.uid()
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Participants can insert messages in active bookings" ON public.messages;
CREATE POLICY "Participants can insert messages in active bookings"
    ON public.messages FOR INSERT
    WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.bookings 
            WHERE id = public.messages.booking_id 
            AND (customer_id = auth.uid() OR driver_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Receivers can mark messages as read" ON public.messages;
CREATE POLICY "Receivers can mark messages as read"
    ON public.messages FOR UPDATE
    USING (receiver_id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 8. NOTIFICATIONS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications"
    ON public.notifications FOR SELECT
    USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can mark own notifications as read" ON public.notifications;
CREATE POLICY "Users can mark own notifications as read"
    ON public.notifications FOR UPDATE
    USING (user_id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 9. SUBSCRIPTION PLANS & USER SUBSCRIPTIONS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view active subscription plans" ON public.subscription_plans;
CREATE POLICY "Anyone can view active subscription plans"
    ON public.subscription_plans FOR SELECT
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Users view own subscriptions" ON public.user_subscriptions;
CREATE POLICY "Users view own subscriptions"
    ON public.user_subscriptions FOR SELECT
    USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can create subscription requests" ON public.user_subscriptions;
CREATE POLICY "Users can create subscription requests"
    ON public.user_subscriptions FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 10. PAYMENT TRANSACTIONS & WALLET LEDGER
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view own payment transactions" ON public.payment_transactions;
CREATE POLICY "Users view own payment transactions"
    ON public.payment_transactions FOR SELECT
    USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert payment transactions" ON public.payment_transactions;
CREATE POLICY "Users can insert payment transactions"
    ON public.payment_transactions FOR INSERT
    WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users cannot directly modify payment transactions" ON public.payment_transactions;
CREATE POLICY "Users cannot directly modify payment transactions"
    ON public.payment_transactions FOR UPDATE
    USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users view own wallet ledger" ON public.wallet_ledger;
CREATE POLICY "Users view own wallet ledger"
    ON public.wallet_ledger FOR SELECT
    USING (user_id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 11. REVIEWS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
CREATE POLICY "Anyone can view reviews"
    ON public.reviews FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Verified booking participants can leave reviews" ON public.reviews;
CREATE POLICY "Verified booking participants can leave reviews"
    ON public.reviews FOR INSERT
    WITH CHECK (
        reviewer_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.bookings 
            WHERE id = public.reviews.booking_id 
            AND status = 'completed'
            AND (
                (customer_id = auth.uid() AND reviewee_id = driver_id)
                OR (driver_id = auth.uid() AND reviewee_id = customer_id)
            )
        )
    );

-- ------------------------------------------------------------------------------
-- 12. AUDIT LOGS & PLATFORM SETTINGS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins only for audit logs" ON public.audit_logs;
CREATE POLICY "Admins only for audit logs"
    ON public.audit_logs FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Public view platform settings, Admins manage" ON public.platform_settings;
CREATE POLICY "Public view platform settings, Admins manage"
    ON public.platform_settings FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can update platform settings" ON public.platform_settings;
CREATE POLICY "Admins can update platform settings"
    ON public.platform_settings FOR ALL
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 13. NEW MODULES (SAVED LOCATIONS, CORPORATE, DISPUTES, PROMOTIONS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.saved_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own saved locations" ON public.saved_locations;
CREATE POLICY "Users manage their own saved locations"
    ON public.saved_locations FOR ALL
    USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Corporate Admins manage corporate accounts" ON public.corporate_accounts;
CREATE POLICY "Corporate Admins manage corporate accounts"
    ON public.corporate_accounts FOR ALL
    USING (admin_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Corporate Admins manage corporate employees" ON public.corporate_employees;
CREATE POLICY "Corporate Admins manage corporate employees"
    ON public.corporate_employees FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.corporate_accounts WHERE id = corporate_id AND admin_id = auth.uid())
        OR employee_id = auth.uid()
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Users view and submit their own support disputes" ON public.support_disputes;
CREATE POLICY "Users view and submit their own support disputes"
    ON public.support_disputes FOR ALL
    USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Anyone can view active promo codes" ON public.promo_codes;
CREATE POLICY "Anyone can view active promo codes"
    ON public.promo_codes FOR SELECT
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Users view their own referrals" ON public.referrals;
CREATE POLICY "Users view their own referrals"
    ON public.referrals FOR SELECT
    USING (referrer_id = auth.uid() OR referred_id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 14. ADVERTISING PLATFORM POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view approved active advertisements" ON public.advertisements;
CREATE POLICY "Public view approved active advertisements"
    ON public.advertisements FOR SELECT
    USING (
        status = 'approved'
        OR advertiser_user_id = auth.uid()
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Advertisers insert own campaigns" ON public.advertisements;
CREATE POLICY "Advertisers insert own campaigns"
    ON public.advertisements FOR INSERT
    WITH CHECK (advertiser_user_id = auth.uid());

DROP POLICY IF EXISTS "Advertisers update own draft campaigns" ON public.advertisements;
CREATE POLICY "Advertisers update own draft campaigns"
    ON public.advertisements FOR UPDATE
    USING (advertiser_user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Anyone record ad events" ON public.ad_events;
CREATE POLICY "Anyone record ad events"
    ON public.ad_events FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Advertisers view own ad events" ON public.ad_events;
CREATE POLICY "Advertisers view own ad events"
    ON public.ad_events FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.advertisements WHERE id = advertisement_id AND advertiser_user_id = auth.uid())
        OR public.is_admin()
    );
