-- ==============================================================================
-- TRANSMOVE SUPABASE STORAGE BUCKETS & SECURITY POLICIES (IDEMPOTENT)
-- ==============================================================================

-- 1. Create storage buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('avatars', 'avatars', true),
    ('vehicles', 'vehicles', true),
    ('equipment', 'equipment', true),
    ('loads', 'loads', true),
    ('documents', 'documents', false) -- Private bucket for verification docs/licenses
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies for Avatars
DROP POLICY IF EXISTS "Public avatar read" ON storage.objects;
CREATE POLICY "Public avatar read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated user avatar upload" ON storage.objects;
CREATE POLICY "Authenticated user avatar upload"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 3. Storage Policies for Vehicles
DROP POLICY IF EXISTS "Public vehicle photos read" ON storage.objects;
CREATE POLICY "Public vehicle photos read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'vehicles');

DROP POLICY IF EXISTS "Driver vehicle photo upload" ON storage.objects;
CREATE POLICY "Driver vehicle photo upload"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'vehicles' AND auth.role() = 'authenticated');

-- 4. Storage Policies for Equipment
DROP POLICY IF EXISTS "Public equipment photos read" ON storage.objects;
CREATE POLICY "Public equipment photos read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'equipment');

DROP POLICY IF EXISTS "Owner equipment photo upload" ON storage.objects;
CREATE POLICY "Owner equipment photo upload"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'equipment' AND auth.role() = 'authenticated');

-- 5. Storage Policies for Cargo Loads
DROP POLICY IF EXISTS "Cargo loads photos read" ON storage.objects;
CREATE POLICY "Cargo loads photos read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'loads');

DROP POLICY IF EXISTS "Customer cargo photo upload" ON storage.objects;
CREATE POLICY "Customer cargo photo upload"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'loads' AND auth.role() = 'authenticated');

-- 6. Storage Policies for Private Driver Documents
DROP POLICY IF EXISTS "Driver and Admin document read" ON storage.objects;
CREATE POLICY "Driver and Admin document read"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'documents'
        AND (
            auth.uid()::text = (storage.foldername(name))[1]
            OR public.is_admin()
        )
    );

DROP POLICY IF EXISTS "Driver document upload" ON storage.objects;
CREATE POLICY "Driver document upload"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'documents'
        AND auth.role() = 'authenticated'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
