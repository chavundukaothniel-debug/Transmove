-- ==============================================================================
-- TRANSMOVE MULTI-ROLE & PERMISSION ARCHITECTURE
-- Supabase Table Definitions, Triggers & Row Level Security (RLS)
-- ==============================================================================

-- 1. Create USER_ROLES table for multi-role support
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_name TEXT NOT NULL,
    role_status TEXT NOT NULL DEFAULT 'active', -- 'active', 'pending', 'suspended', 'rejected'
    verification_status TEXT NOT NULL DEFAULT 'approved', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_role UNIQUE (user_id, role_name)
);

-- Index for fast user role lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id, role_status);

-- 2. Helper function to check if user has specific active role
CREATE OR REPLACE FUNCTION public.has_role(p_user_id UUID, p_role_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Admin role bypass
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'admin') THEN
        RETURN TRUE;
    END IF;

    -- Primary profile role check
    IF EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = p_user_id AND (
            role::text = p_role_name OR 
            (role = 'customer' AND p_role_name = 'passenger') OR
            (role = 'owner' AND p_role_name IN ('vehicle_owner', 'machinery_owner'))
        )
    ) THEN
        RETURN TRUE;
    END IF;

    -- Secondary user_roles table check
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = p_user_id 
          AND role_name = p_role_name 
          AND role_status = 'active'
    );
END;
$$;

-- 3. RLS Policies for user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert role requests" ON public.user_roles;
CREATE POLICY "Users can insert role requests"
ON public.user_roles FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update user roles" ON public.user_roles;
CREATE POLICY "Admins can update user roles"
ON public.user_roles FOR UPDATE
USING (public.is_admin());
