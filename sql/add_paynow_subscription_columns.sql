-- Migration: Add poll_url and payment_type columns to public.payment_transactions table if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'poll_url'
    ) THEN
        ALTER TABLE public.payment_transactions ADD COLUMN poll_url TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'payment_type'
    ) THEN
        ALTER TABLE public.payment_transactions ADD COLUMN payment_type TEXT DEFAULT 'SUBSCRIPTION';
    END IF;
END $$;
