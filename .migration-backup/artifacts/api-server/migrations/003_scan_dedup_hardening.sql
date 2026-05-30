-- ============================================================================
-- IndiePact — Migration 003: Scan deduplication hardening
-- ============================================================================
--
-- Run this ONCE in Supabase SQL Editor. Fully idempotent — safe to rerun.
--
-- What this migration does (in order):
--
--   1. Ensures every column the application references exists on `scans`.
--      Uses ADD COLUMN IF NOT EXISTS throughout — no-op on already-present columns.
--
--   2. Backfills contract_hash for all existing rows, using the exact same
--      text normalisation as hashContractText() in contract-hash.ts:
--        trim → lowercase → collapse whitespace runs → SHA-256 hex
--
--   3. Removes duplicate (user_id, contract_hash) pairs, keeping the oldest
--      row. Required before the unique constraint can be applied.
--
--   4. Adds a UNIQUE constraint on (user_id, contract_hash).
--      This constraint:
--        a. Enforces DB-level dedup — no two rows for the same user+hash.
--        b. Automatically creates a B-tree index used by the dedup lookup query
--           in analyze.ts. No separate CREATE INDEX is needed.
--        c. Enables ON CONFLICT handling in scans.ts so concurrent race-condition
--           INSERTs resolve gracefully instead of returning a 500.
--
-- Prerequisite: PostgreSQL ≥ 14 (Supabase default since 2022).
--   sha256(bytea) is built-in in PG 14+. Supabase projects created before
--   March 2022 may run PG 13. If you are on PG 13, replace:
--     encode(sha256(…::bytea), 'hex')
--   with:
--     encode(digest(…, 'sha256'), 'hex')
--   and run first: CREATE EXTENSION IF NOT EXISTS pgcrypto;
--
-- NULL handling for the unique constraint:
--   PostgreSQL treats NULL as distinct in UNIQUE constraints by default,
--   meaning multiple rows with NULL contract_hash do NOT conflict.
--   This is the desired behaviour — rows with NULL hash (e.g. very old rows
--   with no contract_text) are not subject to the uniqueness rule.
--
-- ============================================================================


-- ── Step 1: Ensure all application-level columns exist ───────────────────────
--
-- Every column referenced in analyze.ts, scans.ts, or mapScanRow() is listed
-- here. ADD COLUMN IF NOT EXISTS is a no-op when the column already exists,
-- so this block is safe regardless of the current schema state.

ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS contract_text        TEXT,
  ADD COLUMN IF NOT EXISTS contract_hash        TEXT,
  ADD COLUMN IF NOT EXISTS result               JSONB,
  ADD COLUMN IF NOT EXISTS protection_score     INTEGER,
  ADD COLUMN IF NOT EXISTS revenue_at_risk_min  INTEGER,
  ADD COLUMN IF NOT EXISTS revenue_at_risk_max  INTEGER,
  ADD COLUMN IF NOT EXISTS risk_count           INTEGER,
  ADD COLUMN IF NOT EXISTS last_opened_at       TIMESTAMPTZ;


-- ── Step 2: Backfill contract_hash for existing rows ─────────────────────────
--
-- Mirrors hashContractText() in:
--   artifacts/api-server/src/lib/contract-hash.ts
--
-- Node.js normalisation:
--   text.trim().toLowerCase().replace(/\s+/g, ' ')
--
-- PostgreSQL equivalent:
--   lower(btrim(regexp_replace(contract_text, '\s+', ' ', 'g')))
--
-- SHA-256 encoding:
--   Node:       createHash('sha256').update(normalized, 'utf8').digest('hex')
--   PostgreSQL: encode(sha256(normalized::bytea), 'hex')
--
-- The ::bytea cast uses the database encoding (UTF-8 on all Supabase projects),
-- which matches Node's explicit 'utf8' parameter. The two implementations
-- produce byte-for-byte identical hex strings for the same input text.
--
-- Only processes rows where:
--   - contract_hash IS NULL        (already-hashed rows are skipped)
--   - contract_text IS NOT NULL    (cannot hash a NULL body)
--   - contract_text is non-empty after trimming

UPDATE scans
SET contract_hash = encode(
  sha256(
    lower(btrim(regexp_replace(contract_text, '\s+', ' ', 'g')))::bytea
  ),
  'hex'
)
WHERE contract_hash IS NULL
  AND contract_text IS NOT NULL
  AND btrim(contract_text) <> '';


-- ── Step 3: Remove duplicate (user_id, contract_hash) pairs ──────────────────
--
-- If a user submitted the same contract multiple times before the dedup code
-- was in place, backfilling will produce duplicate (user_id, contract_hash)
-- pairs. The UNIQUE constraint in Step 4 will fail unless duplicates are
-- removed first.
--
-- Strategy: keep the OLDEST scan for each pair (lowest created_at = first
-- analysis); delete all newer duplicates.
--
-- Only applies to non-NULL hashes — NULLs are always considered distinct.

DELETE FROM scans
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, contract_hash
        ORDER BY created_at ASC   -- keep the oldest (rank 1), delete the rest
      ) AS rn
    FROM scans
    WHERE contract_hash IS NOT NULL
  ) ranked
  WHERE rn > 1
);


-- ── Step 4: Add UNIQUE constraint on (user_id, contract_hash) ────────────────
--
-- This is the DB-level safety net for race conditions:
--   - Two simultaneous identical requests both pass the in-memory inflight
--     cache (different serverless instances) and both reach INSERT.
--   - The second INSERT hits this constraint and returns PostgreSQL error 23505.
--   - scans.ts catches 23505, fetches the winning row, and returns it to the
--     client — no error surfaced to the user, no duplicate stored.
--
-- The UNIQUE constraint automatically creates a B-tree index on
-- (user_id, contract_hash), making the dedup lookup in analyze.ts O(log n).
-- No separate CREATE INDEX statement is needed.
--
-- DO $$...END $$ wrapper makes this idempotent: the constraint is only added
-- if it doesn't already exist. ALTER TABLE ADD CONSTRAINT doesn't have an
-- IF NOT EXISTS clause in PG < 16, so we check pg_constraint directly.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_scans_user_contract_hash'
      AND conrelid = 'scans'::regclass
  ) THEN
    ALTER TABLE scans
      ADD CONSTRAINT uq_scans_user_contract_hash
      UNIQUE (user_id, contract_hash);
  END IF;
END $$;


-- ── Verification queries ──────────────────────────────────────────────────────
-- Run these AFTER the migration to confirm correctness. Execute each separately.

-- 1. Column inventory — all required columns should appear:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'scans'
-- ORDER BY ordinal_position;

-- 2. Hash coverage — rows_missing_hash should equal rows_missing_text
--    (only rows with no contract_text legitimately have no hash):
-- SELECT
--   COUNT(*)                                           AS total_rows,
--   COUNT(contract_hash)                               AS rows_with_hash,
--   COUNT(*) FILTER (WHERE contract_hash IS NULL)      AS rows_missing_hash,
--   COUNT(*) FILTER (WHERE contract_text IS NULL)      AS rows_missing_text,
--   COUNT(*) FILTER (WHERE last_opened_at IS NOT NULL) AS reopened_count
-- FROM scans;

-- 3. Constraint is active:
-- SELECT conname, contype
-- FROM pg_constraint
-- WHERE conrelid = 'scans'::regclass;

-- 4. Index exists and covers the dedup lookup:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'scans';

-- 5. No duplicate (user_id, contract_hash) pairs remain:
-- SELECT user_id, contract_hash, COUNT(*) AS n
-- FROM scans
-- WHERE contract_hash IS NOT NULL
-- GROUP BY user_id, contract_hash
-- HAVING COUNT(*) > 1;
-- Expected: 0 rows returned.
