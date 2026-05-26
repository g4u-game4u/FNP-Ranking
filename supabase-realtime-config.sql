-- ============================================================================
-- SUPABASE REALTIME CONFIGURATION
-- Enable real-time subscriptions for tables
-- ============================================================================

-- Enable realtime for leaderboard_entries (most important for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard_entries;

-- Enable realtime for challenge_events (for notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE challenge_events;

-- Enable realtime for player_stats (for live stats updates)
ALTER PUBLICATION supabase_realtime ADD TABLE player_stats;

-- Enable realtime for challenge_progress (for progress tracking)
ALTER PUBLICATION supabase_realtime ADD TABLE challenge_progress;

-- Optional: Enable for other tables if needed
-- ALTER PUBLICATION supabase_realtime ADD TABLE leaderboards;
-- ALTER PUBLICATION supabase_realtime ADD TABLE players;
-- ALTER PUBLICATION supabase_realtime ADD TABLE challenges;

-- ============================================================================
-- VERIFY REALTIME IS ENABLED
-- ============================================================================

-- Check which tables have realtime enabled
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
