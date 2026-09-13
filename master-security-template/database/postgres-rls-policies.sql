-- ─────────────────────────────────────────────────────────────────────────
-- Postgres Row-Level Security template — the strongest version of "users
-- only see their own rows," because the database enforces it even if a
-- future route handler forgets to filter by user_id. Use this instead of
-- (or alongside) scopedQuery.js when your app runs on Postgres/Supabase.
--
-- Swap `designs` and its columns for your actual table. Repeat the CREATE
-- POLICY block per user-owned table.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Turn RLS on for the table. Once enabled, ALL access is denied by
--    default until a policy explicitly allows it — including your own
--    app's queries, so policies must exist before this table is used.
ALTER TABLE designs ENABLE ROW LEVEL SECURITY;

-- What-if: someone connects with the table owner / superuser role, which
-- bypasses RLS entirely by default — force it to obey RLS too, so a
-- misconfigured connection string can't silently skip these policies.
ALTER TABLE designs FORCE ROW LEVEL SECURITY;

-- 2. The current user's id must be available to Postgres at query time.
--    With Supabase, `auth.uid()` is provided automatically. Without
--    Supabase, set it per-connection from your app after authenticating:
--      SELECT set_config('app.current_user_id', $1, true);
--    then reference it below as current_setting('app.current_user_id')::uuid.

-- 3. Policies — one per operation, so a bug in one (e.g. UPDATE) can't
--    accidentally grant a different one (e.g. DELETE).

CREATE POLICY designs_select_own ON designs
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY designs_insert_own ON designs
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY designs_update_own ON designs
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY designs_delete_own ON designs
  FOR DELETE
  USING (user_id = auth.uid());

-- Non-Supabase Postgres variant (replace auth.uid() above with this in
-- every policy if you're not on Supabase):
--   current_setting('app.current_user_id', true)::uuid = user_id

-- 4. Verify it actually works before trusting it in production:
--   a) As user A, insert a row.
--   b) As user B (different auth.uid()/app.current_user_id), SELECT * —
--      user A's row must NOT appear.
--   c) As user B, try UPDATE/DELETE on user A's row by id — must affect 0 rows.
