-- ============================================================
-- IndiePact AI — Supabase Schema
-- Run this in the Supabase SQL Editor.
-- Safe to re-run on an existing database: every statement uses
-- IF NOT EXISTS / ADD COLUMN IF NOT EXISTS guards.
--
-- EXECUTION ORDER (critical for PostgreSQL sequential processing):
--   Phase 1 — Extensions
--   Phase 2 — CREATE TABLE (base tables, original columns only)
--   Phase 3 — ALTER TABLE  (inject new billing columns into existing tables)
--   Phase 4 — CREATE INDEX (only after ALL columns are guaranteed to exist)
--   Phase 5 — webhook_events table + its index
--   Phase 6 — Row Level Security (ENABLE + POLICIES)
--   Phase 7 — Seed data
-- ============================================================


-- ============================================================
-- PHASE 1: EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- PHASE 2: CREATE BASE TABLES
-- Indexes are intentionally omitted here — they come in Phase 4
-- after ALTER TABLE has added any new columns.
-- ============================================================

CREATE TABLE IF NOT EXISTS scans (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              TEXT        NOT NULL,
  contract_name        TEXT        NOT NULL,
  contract_text        TEXT        NOT NULL,
  -- SHA-256 fingerprint of normalised contract text (trim + lowercase + collapse whitespace).
  -- Used for instant deduplication: if the same user submits the same contract again,
  -- the stored result is returned immediately without calling OpenAI.
  contract_hash        TEXT,
  result               JSONB       NOT NULL,
  protection_score     INTEGER     NOT NULL DEFAULT 0,
  revenue_at_risk_min  NUMERIC     NOT NULL DEFAULT 0,
  revenue_at_risk_max  NUMERIC     NOT NULL DEFAULT 0,
  risk_count           INTEGER     NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clause_cache (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clause_hash      TEXT        NOT NULL UNIQUE,
  clause_text      TEXT        NOT NULL,
  analysis_result  JSONB       NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clause_templates (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  category       TEXT        NOT NULL,
  title          TEXT        NOT NULL,
  risky_version  TEXT        NOT NULL,
  safe_version   TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL UNIQUE,
  plan        TEXT        NOT NULL DEFAULT 'free'
                CHECK (plan IN ('free','starter','pro','business','agency','enterprise')),
  scans_used  INTEGER     NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Core billing fields (present in original schema)
  paystack_reference TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- PHASE 3: ALTER TABLE — inject new billing columns
-- Must run BEFORE any index that references these columns.
-- ADD COLUMN IF NOT EXISTS is a no-op when the column already exists.
-- ============================================================

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS subscription_status
    TEXT NOT NULL DEFAULT 'active';          -- active | payment_failed | disabled

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS subscription_code
    TEXT;                                    -- Paystack SUB_xxx identifier

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS paystack_authorization_code
    TEXT;                                    -- Stored for future recurring recovery

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS last_payment_at
    TIMESTAMPTZ;                             -- Timestamp of last successful charge

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS next_payment_date
    TIMESTAMPTZ;                             -- Paystack's next scheduled rebill date


-- ============================================================
-- PHASE 4: CREATE INDEXES
-- All columns referenced below are now guaranteed to exist.
-- ============================================================

-- scans
CREATE INDEX IF NOT EXISTS idx_scans_user_id
  ON scans(user_id);

CREATE INDEX IF NOT EXISTS idx_scans_created_at
  ON scans(created_at DESC);

-- Composite index powers the dedup lookup: WHERE user_id = ? AND contract_hash = ?
CREATE INDEX IF NOT EXISTS idx_scans_user_hash
  ON scans(user_id, contract_hash);

-- subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON subscriptions(user_id);

-- subscription_code exists now (added in Phase 3) — safe to index
CREATE INDEX IF NOT EXISTS idx_subscriptions_sub_code
  ON subscriptions(subscription_code);


-- ============================================================
-- PHASE 5: WEBHOOK EVENTS TABLE (idempotency store)
-- Prevents duplicate processing when Paystack retries delivery.
-- idempotency_key format: "<event_type>:<reference|subscription_code>"
-- ============================================================

CREATE TABLE IF NOT EXISTS webhook_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type       TEXT        NOT NULL,
  idempotency_key  TEXT        NOT NULL UNIQUE,
  processed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_key
  ON webhook_events(idempotency_key);


-- ============================================================
-- PHASE 6: ROW LEVEL SECURITY
-- Enable RLS then attach policies.
-- The API server uses the service-role key which bypasses RLS entirely.
-- ============================================================

ALTER TABLE scans            ENABLE ROW LEVEL SECURITY;
ALTER TABLE clause_cache     ENABLE ROW LEVEL SECURITY;
ALTER TABLE clause_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events   ENABLE ROW LEVEL SECURITY;

-- scans: users may only see/insert/delete their own rows.
-- NOTE: scans.user_id is TEXT; auth.uid() returns UUID — explicit cast required.
CREATE POLICY "Users can view their own scans" ON scans
  FOR SELECT USING (user_id = (auth.uid())::text);

CREATE POLICY "Users can insert their own scans" ON scans
  FOR INSERT WITH CHECK (user_id = (auth.uid())::text);

CREATE POLICY "Users can delete their own scans" ON scans
  FOR DELETE USING (user_id = (auth.uid())::text);

-- clause_cache: read-only for authenticated users; writes via service role only.
CREATE POLICY "Clause cache is public read" ON clause_cache
  FOR SELECT USING (true);

-- clause_templates: read-only reference data; no direct client writes.
CREATE POLICY "Templates are public read" ON clause_templates
  FOR SELECT USING (true);

-- subscriptions: users may read their own row only.
-- All mutations go through the API server (service-role key bypasses RLS).
-- NOTE: subscriptions.user_id is TEXT; cast auth.uid() for comparison.
CREATE POLICY "Users can view their own subscription" ON subscriptions
  FOR SELECT USING (user_id = (auth.uid())::text);

-- webhook_events: no client-facing policies.
-- All access is via service-role key (bypasses RLS). No direct client reads/writes.


-- ============================================================
-- PHASE 7: SEED DATA
-- ON CONFLICT DO NOTHING makes this re-runnable safely.
-- ============================================================

INSERT INTO clause_templates (category, title, risky_version, safe_version) VALUES
  (
    'ipOwnership',
    'Work for Hire',
    'All work product shall be considered work made for hire and shall be the sole property of the Client.',
    'Contractor retains ownership of all pre-existing IP. Upon full payment, Contractor grants Client a perpetual, non-exclusive license to use the deliverables for the agreed purpose.'
  ),
  (
    'paymentDelay',
    'Net 90 Payment',
    'Payment shall be due within 90 days of invoice receipt.',
    'Payment shall be due within 14 days of invoice receipt. A 1.5% monthly late fee applies to overdue balances.'
  ),
  (
    'scopeCreep',
    'Unlimited Revisions',
    'Contractor shall provide unlimited revisions until Client is fully satisfied.',
    'Contract includes up to 3 rounds of revisions. Additional revisions will be billed at the agreed hourly rate.'
  ),
  (
    'termination',
    'Termination Without Cause',
    'Client may terminate this agreement at any time without cause and without notice.',
    'Either party may terminate with 14 days written notice. Upon termination, Client shall pay for all work completed to date within 7 days.'
  )
ON CONFLICT DO NOTHING;
