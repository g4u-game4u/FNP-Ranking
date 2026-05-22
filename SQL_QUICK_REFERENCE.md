# SQL Quick Reference - Copy & Paste

## 🚀 Quick Start (3 Steps)

### Step 1: Run Main Schema
Open Supabase Studio → SQL Editor → Copy & Paste:
```
File: supabase-schema.sql (entire file)
```

### Step 2: Enable Real-time
```
File: supabase-realtime-config.sql (entire file)
```

### Step 3: Add Helper Functions
```
File: supabase-helper-functions.sql (entire file)
```

## 📋 All SQL Files Summary

| File | Purpose | Required |
|------|---------|----------|
| `supabase-schema.sql` | Main database schema, tables, indexes, RLS | ✅ Yes |
| `supabase-realtime-config.sql` | Enable real-time subscriptions | ✅ Yes |
| `supabase-helper-functions.sql` | Utility functions for common operations | ⭐ Recommended |

## 🔧 Edge Functions Summary

| Function | Purpose | Deploy Command |
|----------|---------|----------------|
| `update-leaderboard` | Bulk update leaderboard entries | `supabase functions deploy update-leaderboard` |
| `challenge-webhook` | Receive challenge completion events | `supabase functions deploy challenge-webhook` |
| `get-leaderboard` | Get leaderboard data (Funifier-compatible) | `supabase functions deploy get-leaderboard` |

## 📊 Key Database Functions

After running the SQL scripts, you'll have these functions available:

### Get Leaderboard Data
```sql
SELECT * FROM get_leaderboard_data(
  'leaderboard-uuid'::UUID,
  true,  -- live
  CURRENT_DATE
);
```

### Get Player Status
```sql
SELECT * FROM get_player_status('player-uuid'::UUID);
```

### Get Top Players
```sql
SELECT * FROM get_top_players(
  'leaderboard-uuid'::UUID,
  10  -- limit
);
```

### Update Leaderboard Entry
```sql
SELECT upsert_leaderboard_entry(
  'leaderboard-uuid'::UUID,
  'player-uuid'::UUID,
  1,  -- position
  100.0,  -- total
  CURRENT_DATE
);
```

### Record Challenge Event
```sql
SELECT record_challenge_event(
  'player-uuid'::UUID,
  'challenge-uuid'::UUID,
  'completed',  -- event_type
  10,  -- points_awarded
  '{"source": "manual"}'::JSONB  -- metadata
);
```

### Get Recent Challenge Events
```sql
SELECT * FROM get_recent_challenge_events(
  10,  -- limit
  NOW() - INTERVAL '1 hour'  -- since
);
```

### Get Player History
```sql
SELECT * FROM get_player_history(
  'player-uuid'::UUID,
  'leaderboard-uuid'::UUID,
  7  -- days
);
```

### Get Leaderboard Stats
```sql
SELECT * FROM get_leaderboard_stats(
  'leaderboard-uuid'::UUID,
  CURRENT_DATE
);
```

## 🔍 Verification Queries

### Check Tables Created
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

### Check Functions Created
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;
```

### Check Real-time Enabled
```sql
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
```

### Check RLS Policies
```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Check Indexes
```sql
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

## 📝 Sample Data Insertion

### Insert Sample Leaderboard
```sql
INSERT INTO leaderboards (title, description, principal_type, sort_order)
VALUES ('Main Leaderboard', 'Primary ranking system', 0, -1)
RETURNING id;
```

### Insert Sample Players
```sql
INSERT INTO players (player_code, name) VALUES
  ('alice@example.com', 'Alice'),
  ('bob@example.com', 'Bob'),
  ('charlie@example.com', 'Charlie')
RETURNING id, player_code, name;
```

### Insert Sample Challenge
```sql
INSERT INTO challenges (name, description, challenge_type, points, rules_total)
VALUES ('Daily Login', 'Login every day', 'daily', 10, 1)
RETURNING id;
```

## 🧪 Test Queries

### Test Leaderboard Query
```sql
-- Get all active leaderboards
SELECT id, title, description, is_active 
FROM leaderboards 
WHERE is_active = true;
```

### Test Player Query
```sql
-- Get all active players
SELECT id, player_code, name, is_active 
FROM players 
WHERE is_active = true
LIMIT 10;
```

### Test Leaderboard Entries
```sql
-- Get today's leaderboard entries
SELECT 
  le.position,
  p.name,
  le.total,
  le.previous_position
FROM leaderboard_entries le
JOIN players p ON le.player_id = p.id
WHERE le.snapshot_date = CURRENT_DATE
ORDER BY le.position
LIMIT 10;
```

## 🔐 Security Check

### Verify RLS is Enabled
```sql
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```
All tables should have `rowsecurity = true`.

### Test Public Access (as anon user)
```sql
-- This should work (public read access)
SELECT * FROM leaderboards WHERE is_active = true LIMIT 1;

-- This should work (public read access)
SELECT * FROM players WHERE is_active = true LIMIT 1;
```

## 📞 Support

If any SQL fails:
1. Check the error message carefully
2. Verify you're running scripts in order
3. Check if tables/functions already exist
4. Review `SUPABASE_DEPLOYMENT.md` for detailed troubleshooting

## ✅ Deployment Checklist

- [ ] Run `supabase-schema.sql`
- [ ] Run `supabase-realtime-config.sql`
- [ ] Run `supabase-helper-functions.sql`
- [ ] Verify tables created (7 tables)
- [ ] Verify functions created (10+ functions)
- [ ] Verify real-time enabled (4 tables)
- [ ] Verify RLS enabled (all tables)
- [ ] Deploy edge functions (3 functions)
- [ ] Test with sample data
- [ ] Run verification queries

## 🎯 You're Done!

Once all checkboxes are complete, your Supabase backend is ready! 🚀

Next: Run `npm run migrate:import` to import your data.
