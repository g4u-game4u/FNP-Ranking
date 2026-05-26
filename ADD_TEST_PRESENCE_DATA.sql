-- ============================================================================
-- ADD TEST PRESENCE DATA FOR GCOM SALES TESTING
-- ============================================================================
-- This script adds test presence records for today so we can test the
-- log_store_sale() function with real data.
--
-- INSTRUCTIONS:
-- 1. First, get your actual player UIDs by running the query in STEP 1
-- 2. Update the INSERT statements in STEP 2 with your actual player UIDs
-- 3. Run STEP 2 to add presence records for today
-- 4. Run STEP 3 to verify the data was added
-- 5. Run STEP 4 to test the log_store_sale() function
-- ============================================================================

-- ============================================================================
-- STEP 1: GET EXISTING PLAYERS AND THEIR UIDs
-- ============================================================================
-- Run this first to see what players you have and their UIDs

SELECT 
  id AS player_id,
  name AS player_name,
  player_code AS email,
  extra->>'uid' AS uid,
  is_active
FROM players
WHERE is_active = true
ORDER BY name;

-- Expected output: List of all active players with their UIDs
-- If UIDs are NULL, you need to add them first (see STEP 1B below)

-- ============================================================================
-- STEP 1B: ADD UIDs TO PLAYERS (if needed)
-- ============================================================================
-- If your players don't have UIDs yet, run these UPDATE statements
-- Replace 'ACTUAL_UID_HERE' with the real UID for each player

/*
-- Example: Update player UIDs
UPDATE players 
SET extra = jsonb_set(COALESCE(extra, '{}'::jsonb), '{uid}', '"UID_001"')
WHERE player_code = 'player1@example.com';

UPDATE players 
SET extra = jsonb_set(COALESCE(extra, '{}'::jsonb), '{uid}', '"UID_002"')
WHERE player_code = 'player2@example.com';

-- Add more UPDATE statements for each player...
*/

-- ============================================================================
-- STEP 2: ADD TEST PRESENCE RECORDS FOR TODAY
-- ============================================================================
-- This uses the log_presenca() function to add presence records
-- Replace the UIDs below with your actual player UIDs from STEP 1

-- Method A: Using log_presenca() function (RECOMMENDED)
-- This is the same way the real system will work

SELECT log_presenca('UID_001', 'TEST_STATION');
SELECT log_presenca('UID_002', 'TEST_STATION');
SELECT log_presenca('UID_003', 'TEST_STATION');
SELECT log_presenca('UID_004', 'TEST_STATION');
SELECT log_presenca('UID_005', 'TEST_STATION');
SELECT log_presenca('UID_006', 'TEST_STATION');
SELECT log_presenca('UID_007', 'TEST_STATION');

-- Method B: Direct INSERT (alternative, if you need specific timestamps)
-- Only use this if you need to backdate presence records

/*
INSERT INTO daily_presence (player_id, presence_date, uid, station, first_check_in, last_check_in, check_in_count, points_awarded)
SELECT 
  id AS player_id,
  CURRENT_DATE AS presence_date,
  extra->>'uid' AS uid,
  'TEST_STATION' AS station,
  NOW() AS first_check_in,
  NOW() AS last_check_in,
  1 AS check_in_count,
  5 AS points_awarded
FROM players
WHERE is_active = true
  AND extra->>'uid' IS NOT NULL
ON CONFLICT (player_id, presence_date) DO NOTHING;
*/

-- ============================================================================
-- STEP 3: VERIFY PRESENCE DATA WAS ADDED
-- ============================================================================

-- Check today's presence records
SELECT 
  dp.id,
  p.name AS player_name,
  p.player_code AS email,
  dp.uid,
  dp.presence_date,
  dp.station,
  dp.first_check_in,
  dp.check_in_count,
  dp.points_awarded
FROM daily_presence dp
JOIN players p ON dp.player_id = p.id
WHERE dp.presence_date = CURRENT_DATE
ORDER BY p.name;

-- Expected: Should show all players with presence for today

-- Count presence records
SELECT 
  COUNT(*) AS total_presence_records,
  COUNT(DISTINCT player_id) AS unique_players,
  presence_date
FROM daily_presence
WHERE presence_date = CURRENT_DATE
GROUP BY presence_date;

-- Expected: Should show count matching number of players

-- ============================================================================
-- STEP 4: TEST log_store_sale() FUNCTION
-- ============================================================================

-- Now test the function with presence data
SELECT log_store_sale('TEST SALE - WITH PRESENCE', 100.00);

-- Expected result:
-- {
--   "success": true,
--   "message": "Store sale logged and points awarded to all players with presence",
--   "sale_date": "2024-01-20",
--   "delivery_title": "TEST SALE - WITH PRESENCE",
--   "price": 100.00,
--   "points_per_player": 10,
--   "players_awarded": 7,  -- or however many players you have
--   "total_points_awarded": 70
-- }

-- ============================================================================
-- STEP 5: VERIFY POINTS WERE AWARDED
-- ============================================================================

-- Check actions table for the sale
SELECT 
  a.id,
  p.name AS player_name,
  a.action_id,
  a.attributes->>'delivery_title' AS sale_title,
  (a.attributes->>'price')::numeric AS price,
  a.points_awarded,
  a.created_at
FROM actions a
JOIN players p ON a.player_id = p.id
WHERE a.action_id = 'sell_product'
  AND a.attributes->>'delivery_title' LIKE '%TEST%'
ORDER BY a.created_at DESC;

-- Expected: Should show one action per player with 10 points each

-- Check player_stats were updated
SELECT 
  p.name AS player_name,
  p.player_code AS email,
  ps.total_points,
  ps.updated_at
FROM player_stats ps
JOIN players p ON ps.player_id = p.id
WHERE p.is_active = true
ORDER BY ps.total_points DESC;

-- Expected: All players should have their points increased by 10

-- ============================================================================
-- STEP 6: TEST WITH DIFFERENT SALE AMOUNTS
-- ============================================================================

-- Test with small sale
SELECT log_store_sale('SMALL SALE', 25.00);
-- Expected: 2 points per player (25 * 0.1 = 2.5, floored to 2)

-- Test with large sale
SELECT log_store_sale('LARGE SALE', 500.00);
-- Expected: 50 points per player

-- Test with fractional amount
SELECT log_store_sale('FRACTIONAL SALE', 64.50);
-- Expected: 6 points per player (64.5 * 0.1 = 6.45, floored to 6)

-- ============================================================================
-- STEP 7: CLEANUP TEST DATA (Optional)
-- ============================================================================

-- Remove test sales (keep presence records for continued testing)
/*
DELETE FROM actions
WHERE action_id = 'sell_product'
  AND (
    attributes->>'delivery_title' LIKE '%TEST%'
    OR attributes->>'delivery_title' LIKE '%SMALL%'
    OR attributes->>'delivery_title' LIKE '%LARGE%'
    OR attributes->>'delivery_title' LIKE '%FRACTIONAL%'
  );

-- Verify deletion
SELECT COUNT(*) FROM actions 
WHERE action_id = 'sell_product'
  AND attributes->>'delivery_title' LIKE '%TEST%';
*/

-- Remove test presence records (if you want to start fresh)
/*
DELETE FROM daily_presence
WHERE station = 'TEST_STATION'
  AND presence_date = CURRENT_DATE;

-- Verify deletion
SELECT COUNT(*) FROM daily_presence 
WHERE station = 'TEST_STATION';
*/

-- ============================================================================
-- STEP 8: ADD PRESENCE FOR YESTERDAY (Optional - for testing date logic)
-- ============================================================================

-- Add presence for yesterday to test that sales only award points to
-- players with presence on the same day

/*
INSERT INTO daily_presence (player_id, presence_date, uid, station, first_check_in, last_check_in, check_in_count, points_awarded)
SELECT 
  id AS player_id,
  CURRENT_DATE - INTERVAL '1 day' AS presence_date,
  extra->>'uid' AS uid,
  'TEST_STATION' AS station,
  NOW() - INTERVAL '1 day' AS first_check_in,
  NOW() - INTERVAL '1 day' AS last_check_in,
  1 AS check_in_count,
  5 AS points_awarded
FROM players
WHERE is_active = true
  AND extra->>'uid' IS NOT NULL
ON CONFLICT (player_id, presence_date) DO NOTHING;

-- Test with yesterday's timestamp
SELECT log_store_sale('YESTERDAY SALE', 100.00, NOW() - INTERVAL '1 day');
-- Expected: players_awarded should match yesterday's presence count
*/

-- ============================================================================
-- QUICK REFERENCE: Common Queries
-- ============================================================================

-- Get all players with UIDs
-- SELECT id, name, player_code, extra->>'uid' AS uid FROM players WHERE is_active = true;

-- Get today's presence
-- SELECT * FROM daily_presence WHERE presence_date = CURRENT_DATE;

-- Get recent sales
-- SELECT * FROM actions WHERE action_id = 'sell_product' ORDER BY created_at DESC LIMIT 10;

-- Get player points
-- SELECT p.name, ps.total_points FROM player_stats ps JOIN players p ON ps.player_id = p.id ORDER BY ps.total_points DESC;

-- Test the function
-- SELECT log_store_sale('TEST', 100.00);

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- 1. The log_presenca() function automatically:
--    - Finds the player by UID
--    - Creates a daily_presence record
--    - Awards 5 points for first check-in of the day
--    - Updates player_stats
--    - Logs the action
--
-- 2. The log_store_sale() function automatically:
--    - Finds all players with presence today
--    - Awards points to each player (price * 0.1, floored)
--    - Updates player_stats for each player
--    - Logs an action for each player
--    - Returns summary of what was done
--
-- 3. The daily_presence table has a UNIQUE constraint on (player_id, presence_date)
--    so you can't accidentally create duplicate presence records for the same day
--
-- 4. All timestamps are handled in 'America/Sao_Paulo' timezone
--
-- 5. Points are always floored (rounded down) to integers
--
-- ============================================================================
