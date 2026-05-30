-- =============================================================================
-- IndiePact — Row-Level Security Policies
-- =============================================================================
-- Run this once against your Supabase project.
-- Every table is isolated to the authenticated owner via user_id = auth.uid().
-- No user can ever read, modify, or delete another user's data.
--
-- Apply via: Supabase Dashboard → SQL Editor → paste & run
-- =============================================================================

-- ─── Enable RLS on all user-owned tables ─────────────────────────────────────

ALTER TABLE scans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- ─── Drop any existing policies to start clean ───────────────────────────────

DROP POLICY IF EXISTS "scans_select_own"  ON scans;
DROP POLICY IF EXISTS "scans_insert_own"  ON scans;
DROP POLICY IF EXISTS "scans_update_own"  ON scans;
DROP POLICY IF EXISTS "scans_delete_own"  ON scans;

DROP POLICY IF EXISTS "subscriptions_select_own"  ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_insert_own"  ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_update_own"  ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_delete_own"  ON subscriptions;

-- ─── scans ────────────────────────────────────────────────────────────────────
-- user_id column must exist and reference auth.users(id).

CREATE POLICY "scans_select_own"
  ON scans FOR SELECT
  USING (user_id::text = auth.uid()::text);

CREATE POLICY "scans_insert_own"
  ON scans FOR INSERT
  WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "scans_update_own"
  ON scans FOR UPDATE
  USING (user_id::text = auth.uid()::text)
  WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "scans_delete_own"
  ON scans FOR DELETE
  USING (user_id::text = auth.uid()::text);

-- ─── subscriptions ────────────────────────────────────────────────────────────
-- user_id column must exist and reference auth.users(id).

CREATE POLICY "subscriptions_select_own"
  ON subscriptions FOR SELECT
  USING (user_id::text = auth.uid()::text);

CREATE POLICY "subscriptions_insert_own"
  ON subscriptions FOR INSERT
  WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "subscriptions_update_own"
  ON subscriptions FOR UPDATE
  USING (user_id::text = auth.uid()::text)
  WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "subscriptions_delete_own"
  ON subscriptions FOR DELETE
  USING (user_id::text = auth.uid()::text);

-- ─── Service-role bypass ─────────────────────────────────────────────────────
-- The API server uses the SERVICE_ROLE key and bypasses RLS automatically.
-- No extra policies needed for server-side writes (subscription upgrades, etc.).
-- Confirm: your api-server must NEVER expose the service-role key to the client.

-- ─── Verify ──────────────────────────────────────────────────────────────────
-- After applying, check policies are active:
--   SELECT tablename, policyname, cmd, qual
--   FROM pg_policies
--   WHERE tablename IN ('scans', 'subscriptions')
--   ORDER BY tablename, cmd;
