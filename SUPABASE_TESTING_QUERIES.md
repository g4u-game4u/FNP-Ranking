# Supabase Testing & Verification Queries

## Quick Reference

Use these queries in Supabase SQL Editor to test and verify the GCOM sales integration.

---

## 1. Test the `log_store_sale` Function

### Basic Test
```sql
-- Test with a sample sale
SELECT log_store_sale('TEST SALE - BASIC', 100.00);
```

**Expected Result:**
```json
{
  "success": true,
  "message": "Store sale logged and points awarded to all players with presence",
  "sale_date": "2024-01-20",
  "delivery_title": "TEST SALE - BASIC",
  "price": 100.00,
  "points_per_player": 10,
  "players_awarded": 5,
  "total_points_awarded": 50
}
```

### Test with Different Prices
```sql
-- Small sale
SELECT log_store_sale('SMALL SALE', 25.00);
-- Expected: 2 points per player (25 * 0.1 = 2.5, floored to 2)

-- Large sale
SELECT log_store_sale('LARGE SALE', 500.00);
-- Expected: 50 points per player (500 * 0.1 = 50)

-- Fractional sale
SELECT log_store_sale('FRACTIONAL SALE', 64.50);
-- Expected: 6 points per player (64.5 * 0.1 = 6.45, floored to 6)
```

### Test with Specific Timestamp
```sql
-- Test with yesterday's date
SELECT log_store_sale(
  'YESTERDAY SALE', 
  100.00, 
  NOW() - INTERVAL '1 day'
);
-- Expected: 0 players awarded (no presence yesterday)
```

---

## 2. Verify Data After Sales

### Check Recent Actions
```sql
-- View last 10 sales logged
SELECT 
  a.action_id,
  p.name AS player_name,
  a.attributes->>'delivery_title' AS sale_title,
  (a.attributes->>'price')::numeric AS price,
  a.points_awarded,
  a.created_at
FROM actions a
JOIN players p ON a.player_id = p.id
WHERE a.action_id = 'sell_product'
ORDER BY a.created_at DESC
LIMIT 10;
```

### Check Player Points Updated
```sql
-- View players with most points
SELECT 
  p.name,
  p.player_code,
  ps.total_points,
  ps.updated_at
FROM player_stats ps
JOIN players p ON ps.player_id = p.id
ORDER BY ps.total_points DESC
LIMIT 20;
```

### Check Today's Sales Summary
```sql
-- Summary of sales processed today
SELECT 
  COUNT(DISTINCT a.id) AS total_actions,
  COUNT(DISTINCT a.player_id) AS unique_players,
  SUM(a.points_awarded) AS total_points_awarded,
  AVG(a.points_awarded) AS avg_points_per_action,
  MIN(a.created_at) AS first_sale,
  MAX(a.created_at) AS last_sale
FROM actions a
WHERE a.action_id = 'sell_product'
  AND a.created_at::date = CURRENT_DATE;
```

---

## 3. Verify Presence Data

### Check Today's Presence
```sql
-- Players with presence today
SELECT 
  p.name,
  p.player_code,
  pr.timestamp,
  DATE(pr.timestamp AT TIME ZONE 'America/Sao_Paulo') AS presence_date
FROM presence pr
JOIN players p ON pr.player_id = p.id
WHERE DATE(pr.timestamp AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE
ORDER BY pr.timestamp DESC;
```

### Count Presence by Date
```sql
-- Presence count for last 7 days
SELECT 
  DATE(timestamp AT TIME ZONE 'America/Sao_Paulo') AS date,
  COUNT(DISTINCT player_id) AS unique_players,
  COUNT(*) AS total_presence_records
FROM presence
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY DATE(timestamp AT TIME ZONE 'America/Sao_Paulo')
ORDER BY date DESC;
```

---

## 4. Debugging Queries

### Find Sales Without Points Awarded
```sql
-- Actions where points_awarded = 0 (might indicate issues)
SELECT 
  a.id,
  p.name AS player_name,
  a.attributes->>'delivery_title' AS sale_title,
  a.points_awarded,
  a.created_at
FROM actions a
JOIN players p ON a.player_id = p.id
WHERE a.action_id = 'sell_product'
  AND a.points_awarded = 0
ORDER BY a.created_at DESC
LIMIT 10;
```

### Check for Duplicate Sales
```sql
-- Find potential duplicate sales (same title, same minute)
SELECT 
  a.attributes->>'delivery_title' AS sale_title,
  DATE_TRUNC('minute', a.created_at) AS minute,
  COUNT(*) AS occurrences,
  SUM(a.points_awarded) AS total_points
FROM actions a
WHERE a.action_id = 'sell_product'
  AND a.created_at::date = CURRENT_DATE
GROUP BY 
  a.attributes->>'delivery_title',
  DATE_TRUNC('minute', a.created_at)
HAVING COUNT(*) > 1
ORDER BY occurrences DESC;
```

### Verify Point Calculations
```sql
-- Check if points match expected calculation (0.1 * price)
SELECT 
  a.attributes->>'delivery_title' AS sale_title,
  (a.attributes->>'price')::numeric AS price,
  a.points_awarded,
  FLOOR((a.attributes->>'price')::numeric * 0.1) AS expected_points,
  CASE 
    WHEN a.points_awarded = FLOOR((a.attributes->>'price')::numeric * 0.1) 
    THEN '✅ Correct'
    ELSE '❌ Mismatch'
  END AS validation
FROM actions a
WHERE a.action_id = 'sell_product'
  AND a.created_at::date = CURRENT_DATE
ORDER BY a.created_at DESC
LIMIT 20;
```

---

## 5. Performance Monitoring

### Check Function Execution Time
```sql
-- Enable timing
\timing on

-- Run function and measure time
SELECT log_store_sale('PERFORMANCE TEST', 100.00);

-- Expected: < 100ms for typical workload
```

### Check Table Sizes
```sql
-- View table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Check Index Usage
```sql
-- Verify indexes are being used
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('actions', 'presence', 'player_stats')
ORDER BY idx_scan DESC;
```

---

## 6. Data Cleanup (Use with Caution!)

### Delete Test Data
```sql
-- Delete test sales (be careful!)
DELETE FROM actions
WHERE action_id = 'sell_product'
  AND attributes->>'delivery_title' LIKE '%TEST%';

-- Verify deletion
SELECT COUNT(*) FROM actions 
WHERE action_id = 'sell_product'
  AND attributes->>'delivery_title' LIKE '%TEST%';
```

### Reset Player Points (DANGEROUS!)
```sql
-- ⚠️ WARNING: This resets ALL player points!
-- Only use in development/testing environments

-- Backup first!
CREATE TABLE player_stats_backup AS 
SELECT * FROM player_stats;

-- Reset points
UPDATE player_stats
SET total_points = 0,
    updated_at = NOW();

-- Verify
SELECT COUNT(*), SUM(total_points) FROM player_stats;
```

---

## 7. Reporting Queries

### Daily Sales Report
```sql
-- Sales summary by day
SELECT 
  DATE(a.created_at AT TIME ZONE 'America/Sao_Paulo') AS date,
  COUNT(DISTINCT a.attributes->>'delivery_title') AS unique_sales,
  COUNT(*) AS total_actions,
  COUNT(DISTINCT a.player_id) AS players_awarded,
  SUM(a.points_awarded) AS total_points,
  AVG(a.points_awarded) AS avg_points_per_action
FROM actions a
WHERE a.action_id = 'sell_product'
  AND a.created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(a.created_at AT TIME ZONE 'America/Sao_Paulo')
ORDER BY date DESC;
```

### Player Leaderboard by Sales Points
```sql
-- Top players by sales points this month
SELECT 
  p.name,
  p.player_code,
  COUNT(*) AS sales_actions,
  SUM(a.points_awarded) AS sales_points,
  MIN(a.created_at) AS first_sale,
  MAX(a.created_at) AS last_sale
FROM actions a
JOIN players p ON a.player_id = p.id
WHERE a.action_id = 'sell_product'
  AND a.created_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY p.id, p.name, p.player_code
ORDER BY sales_points DESC
LIMIT 20;
```

### Sales by Product
```sql
-- Most common products sold
SELECT 
  a.attributes->>'delivery_title' AS product,
  COUNT(*) AS times_sold,
  COUNT(DISTINCT a.player_id) AS unique_players,
  SUM(a.points_awarded) AS total_points_awarded,
  AVG((a.attributes->>'price')::numeric) AS avg_price
FROM actions a
WHERE a.action_id = 'sell_product'
  AND a.created_at >= NOW() - INTERVAL '30 days'
GROUP BY a.attributes->>'delivery_title'
ORDER BY times_sold DESC
LIMIT 20;
```

---

## 8. Health Checks

### Overall System Health
```sql
-- Quick health check
SELECT 
  'Players' AS entity,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE is_active = true) AS active
FROM players
UNION ALL
SELECT 
  'Presence Today' AS entity,
  COUNT(*) AS total,
  COUNT(DISTINCT player_id) AS active
FROM presence
WHERE DATE(timestamp AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE
UNION ALL
SELECT 
  'Sales Today' AS entity,
  COUNT(*) AS total,
  COUNT(DISTINCT player_id) AS active
FROM actions
WHERE action_id = 'sell_product'
  AND created_at::date = CURRENT_DATE;
```

### Data Consistency Check
```sql
-- Verify player_stats matches sum of actions
SELECT 
  p.name,
  ps.total_points AS stats_points,
  COALESCE(SUM(a.points_awarded), 0) AS calculated_points,
  ps.total_points - COALESCE(SUM(a.points_awarded), 0) AS difference
FROM players p
LEFT JOIN player_stats ps ON p.id = ps.player_id
LEFT JOIN actions a ON p.id = a.player_id
GROUP BY p.id, p.name, ps.total_points
HAVING ps.total_points != COALESCE(SUM(a.points_awarded), 0)
ORDER BY ABS(ps.total_points - COALESCE(SUM(a.points_awarded), 0)) DESC
LIMIT 10;
```

---

## 9. Useful Views (Optional)

### Create Convenience Views
```sql
-- View for today's sales
CREATE OR REPLACE VIEW today_sales AS
SELECT 
  a.id,
  p.name AS player_name,
  p.player_code,
  a.attributes->>'delivery_title' AS sale_title,
  (a.attributes->>'price')::numeric AS price,
  a.points_awarded,
  a.created_at
FROM actions a
JOIN players p ON a.player_id = p.id
WHERE a.action_id = 'sell_product'
  AND a.created_at::date = CURRENT_DATE
ORDER BY a.created_at DESC;

-- Use it
SELECT * FROM today_sales;
```

```sql
-- View for player rankings
CREATE OR REPLACE VIEW player_rankings AS
SELECT 
  ROW_NUMBER() OVER (ORDER BY ps.total_points DESC) AS rank,
  p.name,
  p.player_code,
  ps.total_points,
  ps.total_challenges,
  ps.updated_at
FROM player_stats ps
JOIN players p ON ps.player_id = p.id
WHERE p.is_active = true
ORDER BY ps.total_points DESC;

-- Use it
SELECT * FROM player_rankings LIMIT 10;
```

---

## 10. Emergency Procedures

### If Function Stops Working
```sql
-- Check if function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'log_store_sale';

-- If missing, redeploy from SUPABASE_STORE_SALES_FUNCTION.sql
```

### If Points Not Being Awarded
```sql
-- Check recent function calls (if logging enabled)
-- This requires pg_stat_statements extension

-- Check for errors in actions table
SELECT 
  COUNT(*) AS error_count,
  attributes->>'error' AS error_message
FROM actions
WHERE action_id = 'sell_product'
  AND attributes ? 'error'
GROUP BY attributes->>'error';
```

---

## Quick Copy-Paste Commands

### Test Everything
```sql
-- Run all tests in sequence
SELECT '1. Testing function' AS test;
SELECT log_store_sale('TEST SALE', 100.00);

SELECT '2. Checking actions' AS test;
SELECT COUNT(*) FROM actions WHERE action_id = 'sell_product';

SELECT '3. Checking presence' AS test;
SELECT COUNT(*) FROM presence WHERE DATE(timestamp AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE;

SELECT '4. Checking player stats' AS test;
SELECT COUNT(*), SUM(total_points) FROM player_stats;

SELECT '✅ All tests complete' AS result;
```

---

## Notes

- Always test in a development environment first
- Backup data before running DELETE or UPDATE queries
- Monitor performance after deploying changes
- Set up alerts for failed function calls
- Review logs regularly for anomalies
