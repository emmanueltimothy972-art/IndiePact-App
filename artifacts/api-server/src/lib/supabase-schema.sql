-- IndiePact AI Supabase Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Scans table
CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  contract_name TEXT NOT NULL,
  contract_text TEXT NOT NULL,
  -- SHA-256 fingerprint of normalised contract text (trim + lowercase + collapse whitespace).
  -- Used for instant deduplication: if the same user submits the same contract again,
  -- the stored result is returned immediately without calling OpenAI.
  contract_hash TEXT,
  result JSONB NOT NULL,
  protection_score INTEGER NOT NULL DEFAULT 0,
  revenue_at_risk_min NUMERIC NOT NULL DEFAULT 0,
  revenue_at_risk_max NUMERIC NOT NULL DEFAULT 0,
  risk_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);
-- Composite index powers the dedup lookup: WHERE user_id = ? AND contract_hash = ?
CREATE INDEX IF NOT EXISTS idx_scans_user_hash ON scans(user_id, contract_hash);

-- Clause cache table (for future use)
CREATE TABLE IF NOT EXISTS clause_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clause_hash TEXT NOT NULL UNIQUE,
  clause_text TEXT NOT NULL,
  analysis_result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clause templates table
CREATE TABLE IF NOT EXISTS clause_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  risky_version TEXT NOT NULL,
  safe_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free','starter','pro','business','agency','enterprise')),
  scans_used INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Billing lifecycle fields (populated by webhook processor in webhook.ts)
  subscription_status TEXT NOT NULL DEFAULT 'active',
  subscription_code TEXT,                  -- Paystack SUB_xxx identifier
  paystack_reference TEXT,                 -- Last successful charge reference
  paystack_authorization_code TEXT,        -- Stored for future recurring recovery
  last_payment_at TIMESTAMPTZ,             -- Timestamp of last successful charge
  next_payment_date TIMESTAMPTZ,           -- Paystack's next scheduled rebill date
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_sub_code ON subscriptions(subscription_code);

-- Migration: add billing columns to existing subscriptions tables
-- Safe to run on an existing table — columns are added only if absent.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS subscription_code TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paystack_authorization_code TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS next_payment_date TIMESTAMPTZ;

-- Webhook events table (idempotency store)
-- Prevents duplicate processing when Paystack retries webhook delivery.
-- idempotency_key = "<event_type>:<reference|subscription_code>"
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_key ON webhook_events(idempotency_key);

-- RLS: webhook_events is written exclusively by the API server service-role key.
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
-- No client-facing policies — all access is via service role (bypasses RLS).

-- RLS Policies
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE clause_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE clause_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- NOTE: scans.user_id is TEXT; auth.uid() returns UUID — cast to text for comparison.
CREATE POLICY "Users can view their own scans" ON scans
  FOR SELECT USING (user_id = (auth.uid())::text);
CREATE POLICY "Users can insert their own scans" ON scans
  FOR INSERT WITH CHECK (user_id = (auth.uid())::text);
CREATE POLICY "Users can delete their own scans" ON scans
  FOR DELETE USING (user_id = (auth.uid())::text);

-- Clause cache: read-only for all authenticated users; inserts via service role only.
CREATE POLICY "Clause cache is public read" ON clause_cache FOR SELECT USING (true);
-- Templates: read-only reference data, no direct client writes.
CREATE POLICY "Templates are public read" ON clause_templates FOR SELECT USING (true);

-- NOTE: subscriptions.user_id is TEXT; cast auth.uid() for comparison.
CREATE POLICY "Users can view their own subscription" ON subscriptions
  FOR SELECT USING (user_id = (auth.uid())::text);
-- All subscription mutations go through the API server (service-role key bypasses RLS).
-- Direct client writes are blocked by omitting INSERT/UPDATE/DELETE policies.

-- Sample clause templates
INSERT INTO clause_templates (category, title, risky_version, safe_version) VALUES
  ('ipOwnership', 'Work for Hire',
   'All work product shall be considered work made for hire and shall be the sole property of the Client.',
   'Contractor retains ownership of all pre-existing IP. Upon full payment, Contractor grants Client a perpetual, non-exclusive license to use the deliverables for the agreed purpose.'),
  ('paymentDelay', 'Net 90 Payment',
   'Payment shall be due within 90 days of invoice receipt.',
   'Payment shall be due within 14 days of invoice receipt. A 1.5% monthly late fee applies to overdue balances.'),
  ('scopeCreep', 'Unlimited Revisions',
   'Contractor shall provide unlimited revisions until Client is fully satisfied.',
   'Contract includes up to 3 rounds of revisions. Additional revisions will be billed at the agreed hourly rate.'),
  ('termination', 'Termination Without Cause',
   'Client may terminate this agreement at any time without cause and without notice.',
   'Either party may terminate with 14 days written notice. Upon termination, Client shall pay for all work completed to date within 7 days.')
ON CONFLICT DO NOTHING;
