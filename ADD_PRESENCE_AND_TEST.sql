-- ============================================================================
-- ADD PRESENCE AND TEST GCOM SALES FUNCTION
-- Ready-to-run script with your actual player data
-- ============================================================================

-- ============================================================================
-- STEP 1: Verify Players Exist
-- ============================================================================

SELECT 
  id AS player_id,
  name AS player_name,
  player_code AS email,
  extra->>'uid' AS uid,
  is_active
FROM players
WHERE player_code IN (
  'andressa.souza@game4u.com.br',
  'gean.pereira@game4u.com.br'
)
ORDER BY name;

-- Expected: Should show 2 players with their UIDs

-- ============================================================================
-- STEP 2: Add Presence for Today (Using log_presenca function)
-- ============================================================================

-- Add presence for Andressa
SELECT log_presenca('041A8D13C42A81', 'TEST_STATION');

-- Add presence for Gean
SELECT log_presenca('04BA6512C42A81', 'TEST_STATION');

-- Expected result for each:
-- {
--   "success": true,
--   "player_name": "Andressa Maria da Silva Souza" (or "Gean de Carvalho Pereira"),
--   "points_awarded": 5,
--   "is_first_today": true,
--   "check_in_count": 1
-- }

-- ============================================================================
-- STEP 3: Verify Presence Was Added
-- ============================================================================

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
  AND p.player_code IN (
    'andressa.souza@game4u.com.br',
    'gean.pereira@game4u.com.br'
  )
ORDER BY p.name;

-- Expected: Should show 2 presence records for today

-- ============================================================================
-- STEP 4: Test log_store_sale Function
-- ============================================================================

-- Test with R$ 100.00 sale
SELECT log_store_sale('TEST SALE - R$ 100', 100.00);

-- Expected result:
-- {
--   "success": true,
--   "message": "Store sale logged and points awarded to all players with presence",
--   "sale_date": "2026-05-26",
--   "delivery_title": "TEST SALE - R$ 100",
--   "price": 100.00,
--   "points_per_player": 10,
--   "players_awarded": 2,
--   "total_points_awarded": 20
-- }

-- ============================================================================
-- STEP 5: Verify Points Were Awarded
-- ============================================================================

-- Check actions table
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
  AND p.player_code IN (
    'andressa.souza@game4u.com.br',
    'gean.pereira@game4u.com.br'
  )
ORDER BY a.created_at DESC;

-- Expected: Should show 2 actions (one per player) with 10 points each

-- Check player_stats
SELECT 
  p.name AS player_name,
  p.player_code AS email,
  ps.total_points,
  ps.updated_at
FROM player_stats ps
JOIN players p ON ps.player_id = p.id
WHERE p.player_code IN (
  'andressa.souza@game4u.com.br',
  'gean.pereira@game4u.com.br'
)
ORDER BY p.name;

-- Expected: 
-- Andressa: 15 points (5 from presence + 10 from sale)
-- Gean: 15 points (5 from presence + 10 from sale)

-- ============================================================================
-- STEP 6: Test with Different Sale Amounts
-- ============================================================================

-- Small sale: R$ 25.00
SELECT log_store_sale('SMALL SALE - R$ 25', 25.00);
-- Expected: 2 points per player (25 * 0.1 = 2.5, floored to 2)

-- Large sale: R$ 500.00
SELECT log_store_sale('LARGE SALE - R$ 500', 500.00);
-- Expected: 50 points per player

-- Fractional sale: R$ 64.50
SELECT log_store_sale('FRACTIONAL SALE - R$ 64.50', 64.50);
-- Expected: 6 points per player (64.5 * 0.1 = 6.45, floored to 6)

-- ============================================================================
-- STEP 7: Check Final Points
-- ============================================================================

SELECT 
  p.name AS player_name,
  p.player_code AS email,
  ps.total_points,
  ps.updated_at
FROM player_stats ps
JOIN players p ON ps.player_id = p.id
WHERE p.player_code IN (
  'andressa.souza@game4u.com.br',
  'gean.pereira@game4u.com.br'
)
ORDER BY ps.total_points DESC;

-- Expected total per player:
-- 5 (presence) + 10 (R$100) + 2 (R$25) + 50 (R$500) + 6 (R$64.50) = 73 points

-- ============================================================================
-- STEP 8: View All Sales Summary
-- ============================================================================

SELECT 
  a.attributes->>'delivery_title' AS sale_title,
  (a.attributes->>'price')::numeric AS price,
  COUNT(*) AS players_awarded,
  SUM(a.points_awarded) AS total_points,
  MIN(a.created_at) AS first_action,
  MAX(a.created_at) AS last_action
FROM actions a
WHERE a.action_id = 'sell_product'
  AND a.attributes->>'delivery_title' LIKE '%TEST%'
  OR a.attributes->>'delivery_title' LIKE '%SMALL%'
  OR a.attributes->>'delivery_title' LIKE '%LARGE%'
  OR a.attributes->>'delivery_title' LIKE '%FRACTIONAL%'
GROUP BY 
  a.attributes->>'delivery_title',
  (a.attributes->>'price')::numeric
ORDER BY MIN(a.created_at);

-- Expected: Should show 4 sales with 2 players each

-- ============================================================================
-- STEP 9: Test Without Presence (Tomorrow)
-- ============================================================================

-- Test what happens when there's no presence
-- This simulates a sale happening on a day when no one checked in

SELECT log_store_sale('NO PRESENCE SALE', 100.00, NOW() + INTERVAL '1 day');

-- Expected result:
-- {
--   "success": true,
--   "message": "Sale logged but no players with presence today",
--   "sale_date": "2026-05-27",
--   "players_awarded": 0,
--   "total_points_awarded": 0
-- }

-- ============================================================================
-- STEP 10: Cleanup Test Data (Optional)
-- ============================================================================

-- Uncomment to remove test data

/*
-- Remove test sales
DELETE FROM actions
WHERE action_id = 'sell_product'
  AND (
    attributes->>'delivery_title' LIKE '%TEST%'
    OR attributes->>'delivery_title' LIKE '%SMALL%'
    OR attributes->>'delivery_title' LIKE '%LARGE%'
    OR attributes->>'delivery_title' LIKE '%FRACTIONAL%'
    OR attributes->>'delivery_title' LIKE '%NO PRESENCE%'
  );

-- Remove test presence
DELETE FROM daily_presence
WHERE station = 'TEST_STATION'
  AND presence_date = CURRENT_DATE;

-- Reset player points (CAREFUL!)
UPDATE player_stats
SET total_points = 0,
    updated_at = NOW()
WHERE player_id IN (
  SELECT id FROM players 
  WHERE player_code IN (
    'andressa.souza@game4u.com.br',
    'gean.pereira@game4u.com.br'
  )
);

-- Verify cleanup
SELECT 'Cleanup complete' AS status;
*/

-- ============================================================================
-- QUICK REFERENCE
-- ============================================================================

-- Get all players
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
-- ✅ Players verified:
--    - Andressa Maria da Silva Souza (UID: 041A8D13C42A81)
--    - Gean de Carvalho Pereira (UID: 04BA6512C42A81)
--
-- ✅ Function behavior:
--    - log_presenca(): Awards 5 points for first check-in of the day
--    - log_store_sale(): Awards FLOOR(price * 0.1) points to each player with presence
--
-- ✅ Expected flow:
--    1. RFID scan → n8n → presenca-webhook → log_presenca() → 5 points
--    2. GCOM sale → n8n → gcom-sale-webhook → log_store_sale() → points to all with presence
--
-- ✅ All timestamps use 'America/Sao_Paulo' timezone
--
-- ============================================================================
