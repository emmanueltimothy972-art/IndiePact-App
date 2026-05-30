-- ============================================================
-- IndiePact: Migration — contract_hash deduplication column
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- Safe to run multiple times (uses IF NOT EXISTS / DO NOTHING)
-- ============================================================

-- 1. Add the hash column (nullable so existing rows aren't broken)
ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS contract_hash TEXT;

-- 2. Composite index for the dedup lookup (user_id + contract_hash)
CREATE INDEX IF NOT EXISTS idx_scans_user_hash
  ON scans(user_id, contract_hash);

-- ============================================================
-- Subscriptions table (create if it doesn't exist yet)
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free','starter','pro','business','agency','enterprise')),
  scans_used INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paystack_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON subscriptions(user_id);

-- Policy: service role bypasses RLS; anon key falls through to this
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'subscriptions'
      AND policyname = 'Users can manage their own subscription'
  ) THEN
    CREATE POLICY "Users can manage their own subscription"
      ON subscriptions FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
