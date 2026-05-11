-- IndiePact: Subscriptions table migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)

CREATE TABLE IF NOT EXISTS subscriptions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL UNIQUE,
  plan        text NOT NULL DEFAULT 'free'
                CHECK (plan IN ('free','starter','pro','business','agency','enterprise')),
  scans_used  integer NOT NULL DEFAULT 0,
  period_start timestamptz NOT NULL DEFAULT now(),
  paystack_reference text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: users can only read/write their own row (when accessed via anon key)
-- The API server uses the service role key, so it bypasses RLS automatically.
CREATE POLICY "Users can manage their own subscription"
  ON subscriptions
  FOR ALL
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions (user_id);

-- Function to atomically increment scan count (called by the API)
CREATE OR REPLACE FUNCTION increment_scan_count(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE subscriptions
  SET
    scans_used = CASE
      WHEN period_start < now() - interval '30 days' THEN 1
      ELSE scans_used + 1
    END,
    period_start = CASE
      WHEN period_start < now() - interval '30 days' THEN now()
      ELSE period_start
    END,
    updated_at = now()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO subscriptions (user_id, plan, scans_used, period_start)
    VALUES (p_user_id, 'free', 1, now())
    ON CONFLICT (user_id) DO UPDATE
      SET scans_used = subscriptions.scans_used + 1,
          updated_at = now();
  END IF;
END;
$$;
