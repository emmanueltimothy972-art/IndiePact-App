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
  paystack_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- RLS Policies
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE clause_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE clause_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scans" ON scans FOR SELECT USING (true);
CREATE POLICY "Users can insert their own scans" ON scans FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete their own scans" ON scans FOR DELETE USING (true);
CREATE POLICY "Clause cache is public read" ON clause_cache FOR SELECT USING (true);
CREATE POLICY "Clause cache insert" ON clause_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Templates are public read" ON clause_templates FOR SELECT USING (true);
CREATE POLICY "Users can manage their own subscription" ON subscriptions
  FOR ALL USING (true) WITH CHECK (true);

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
