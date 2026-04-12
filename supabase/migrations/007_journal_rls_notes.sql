-- ---------------------------------------------------------------------------
-- RLS Verification Notes for Journal Tables (007_journal.sql)
-- ---------------------------------------------------------------------------
-- These are manual smoke-test queries to run against a local Supabase
-- instance (`supabase start`) to verify that Row Level Security policies
-- correctly isolate journal data between users.
--
-- Prerequisites:
--   1. Start local Supabase: `supabase start`
--   2. Create two test users via Supabase Auth (email+password):
--        User A: user_a@test.local  (note their UUID as USER_A_ID)
--        User B: user_b@test.local  (note their UUID as USER_B_ID)
--   3. Sign in as each user and obtain their JWT access tokens.
--   4. Seed test rows as each user (use their JWT in apikey/Authorization).
--
-- Replace <USER_A_ID>, <USER_B_ID>, <SESSION_A_ID> with real UUIDs below.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. journal_sessions isolation
-- ---------------------------------------------------------------------------

-- As User A: seed a session
-- INSERT INTO journal_sessions (user_id, status)
-- VALUES ('<USER_A_ID>', 'pending');

-- As User B: attempt to SELECT User A's session — should return 0 rows
--   (RLS policy: auth.uid() = user_id)
-- SET LOCAL ROLE authenticated;
-- SET LOCAL request.jwt.claim.sub TO '<USER_B_ID>';
-- SELECT * FROM journal_sessions WHERE user_id = '<USER_A_ID>';
-- Expected: (0 rows)

-- As User B: attempt to INSERT a session with user_id = User A — should fail
-- INSERT INTO journal_sessions (user_id, status)
-- VALUES ('<USER_A_ID>', 'pending');
-- Expected: ERROR: new row violates row-level security policy

-- As User B: attempt to UPDATE User A's session — should affect 0 rows
-- UPDATE journal_sessions SET status = 'abandoned'
-- WHERE id = '<SESSION_A_ID>';
-- Expected: UPDATE 0

-- As User B: attempt to DELETE User A's session — should affect 0 rows
-- DELETE FROM journal_sessions WHERE id = '<SESSION_A_ID>';
-- Expected: DELETE 0

-- ---------------------------------------------------------------------------
-- 2. journal_entries isolation (inherits via user_id denormalisation)
-- ---------------------------------------------------------------------------

-- journal_entries stores user_id directly (same RLS pattern as journal_sessions).
-- As User B: attempt to SELECT User A's entries — should return 0 rows
-- SET LOCAL request.jwt.claim.sub TO '<USER_B_ID>';
-- SELECT * FROM journal_entries WHERE user_id = '<USER_A_ID>';
-- Expected: (0 rows)

-- As User B: attempt to INSERT into User A's session — should fail
-- INSERT INTO journal_entries (session_id, user_id, turn_index, question)
-- VALUES ('<SESSION_A_ID>', '<USER_A_ID>', 0, 'Injected question?');
-- Expected: ERROR: new row violates row-level security policy

-- ---------------------------------------------------------------------------
-- 3. user_state isolation
-- ---------------------------------------------------------------------------

-- user_state has one row per user; RLS isolates reads and writes by user_id.
-- As User B: attempt to SELECT User A's user_state — should return 0 rows
-- SET LOCAL request.jwt.claim.sub TO '<USER_B_ID>';
-- SELECT * FROM user_state WHERE user_id = '<USER_A_ID>';
-- Expected: (0 rows)

-- As User B: attempt to UPDATE User A's user_state — should affect 0 rows
-- UPDATE user_state SET content = 'HACKED'
-- WHERE user_id = '<USER_A_ID>';
-- Expected: UPDATE 0

-- ---------------------------------------------------------------------------
-- 4. Service role can write to user_state (simulates edge function update)
-- ---------------------------------------------------------------------------

-- journal-save-session uses the service role key to upsert user_state.
-- This verifies the service role bypasses RLS (expected behaviour):
-- SET LOCAL ROLE service_role;
-- INSERT INTO user_state (user_id, content, word_count, session_count, last_updated_at, updated_at)
-- VALUES ('<USER_A_ID>', 'Test analysis.', 2, 1, NOW(), NOW())
-- ON CONFLICT (user_id) DO UPDATE SET content = EXCLUDED.content;
-- Expected: INSERT 0 1  (upsert succeeds)

-- ---------------------------------------------------------------------------
-- 5. turn_index CHECK constraint (DB-level enforcement)
-- ---------------------------------------------------------------------------

-- Attempt to insert a journal_entry with an invalid turn_index — should fail
-- INSERT INTO journal_entries (session_id, user_id, turn_index, question)
-- VALUES ('<SESSION_A_ID>', '<USER_A_ID>', 5, 'Invalid turn?');
-- Expected: ERROR: new row for relation "journal_entries" violates check constraint
--           "journal_entries_turn_index_check"
