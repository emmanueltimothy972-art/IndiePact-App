-- ── Scan deduplication: index + last_opened_at ──────────────────────────────
--
-- Run once in Supabase SQL Editor (or via your migration tool).
--
-- 1. Composite index for the dedup lookup in analyze.ts:
--    SELECT id, result, contract_name
--    FROM scans
--    WHERE user_id = $1 AND contract_hash = $2
--    ORDER BY created_at DESC LIMIT 1;
--
-- 2. last_opened_at tracks the most recent time a dedup hit sent a user back
--    to a previously stored scan.  NULL = never reopened via dedup.

CREATE INDEX IF NOT EXISTS idx_scans_user_contract_hash
  ON scans (user_id, contract_hash);

ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ;
