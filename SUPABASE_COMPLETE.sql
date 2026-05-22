-- ============================================================================
-- FNP RANKING - COMPLETE SUPABASE SETUP
-- Copy and paste this ENTIRE file into Supabase Studio SQL Editor
-- ============================================================================
-- This script will:
-- 1. Create all database tables
-- 2. Create indexes for performance
-- 3. Set up Row Level Security (RLS)
-- 4. Create helper functions
-- 5. Enable real-time subscriptions
-- 6. Create triggers
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PART 1: TABLES
-- ============================================================================

-- Leaderboards table
CREATE TABLE IF NOT EXISTS leaderboards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  funifier_id TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  principal_type INTEGER DEFAULT 0,
  operation_type INTEGER,
  achievement_type INTEGER,
  operation_item TEXT,
  sort_order INTEGER DEFAULT -1,
  period_type INTEGER,
  period_time_amount INTEGER,
  period_time_scale INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  funifier_id TEXT UNIQUE,
  player_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT,
  extra JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leaderboard entries (player rankings)
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leaderboard_id UUID REFERENCES leaderboards(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  total NUMERIC NOT NULL DEFAULT 0,
  previous_position INTEGER,
  previous_total NUMERIC,
  snapshot_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(leaderboard_id, player_id, snapshot_date)
);

-- Challenges table
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  funifier_id TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  challenge_type TEXT,
  challenge_category TEXT,
  points INTEGER DEFAULT 0,
  rules_total INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Challenge progress tracking
CREATE TABLE IF NOT EXISTS challenge_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  rules_completed INTEGER DEFAULT 0,
  rules_total INTEGER NOT NULL,
  percent_completed NUMERIC DEFAULT 0,
  times_completed INTEGER DEFAULT 0,
  last_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, challenge_id)
);

-- Challenge events log
CREATE TABLE IF NOT EXISTS challenge_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  points_awarded INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player statistics
CREATE TABLE IF NOT EXISTS player_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE UNIQUE,
  total_challenges INTEGER DEFAULT 0,
  total_points NUMERIC DEFAULT 0,
  point_categories JSONB DEFAULT '{}',
  level_progress JSONB DEFAULT '{}',
  total_catalog_items INTEGER DEFAULT 0,
  catalog_items JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 2: INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_leaderboard ON leaderboard_entries(leaderboard_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_player ON leaderboard_entries(player_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_position ON leaderboard_entries(leaderboard_id, position);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_snapshot ON leaderboard_entries(snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_challenge_progress_player ON challenge_progress(player_id);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_challenge ON challenge_progress(challenge_id);

CREATE INDEX IF NOT EXISTS idx_challenge_events_player ON challenge_events(player_id);
CREATE INDEX IF NOT EXISTS idx_challenge_events_challenge ON challenge_events(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_events_created ON challenge_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_stats_player ON player_stats(player_id);

-- ============================================================================
-- PART 3: FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to get leaderboard with players
CREATE OR REPLACE FUNCTION get_leaderboard_data(
  p_leaderboard_id UUID,
  p_live BOOLEAN DEFAULT true,
  p_snapshot_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  player_id UUID,
  player_code TEXT,
  player_name TEXT,
  "position" INTEGER,
  total NUMERIC,
  previous_position INTEGER,
  previous_total NUMERIC,
  move TEXT,
  image_url TEXT,
  extra JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS player_id,
    p.player_code,
    p.name AS player_name,
    le."position",
    le.total,
    le.previous_position,
    le.previous_total,
    CASE 
      WHEN le.previous_position IS NULL THEN 'same'
      WHEN le."position" < le.previous_position THEN 'up'
      WHEN le."position" > le.previous_position THEN 'down'
      ELSE 'same'
    END AS move,
    p.image_url,
    p.extra
  FROM leaderboard_entries le
  JOIN players p ON le.player_id = p.id
  WHERE le.leaderboard_id = p_leaderboard_id
    AND le.snapshot_date = p_snapshot_date
    AND p.is_active = true
  ORDER BY le."position" ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get player status
CREATE OR REPLACE FUNCTION get_player_status(p_player_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'player_id', p.id,
    'name', p.name,
    'total_challenges', COALESCE(ps.total_challenges, 0),
    'total_points', COALESCE(ps.total_points, 0),
    'point_categories', COALESCE(ps.point_categories, '{}'::jsonb),
    'level_progress', COALESCE(ps.level_progress, '{}'::jsonb),
    'challenge_progress', (
      SELECT json_agg(json_build_object(
        'challenge_id', c.id,
        'challenge_name', c.name,
        'rules_completed', cp.rules_completed,
        'rules_total', cp.rules_total,
        'percent_completed', cp.percent_completed,
        'times_completed', cp.times_completed,
        'last_completed_at', cp.last_completed_at
      ))
      FROM challenge_progress cp
      JOIN challenges c ON cp.challenge_id = c.id
      WHERE cp.player_id = p.id
    ),
    'extra', p.extra
  ) INTO result
  FROM players p
  LEFT JOIN player_stats ps ON p.id = ps.player_id
  WHERE p.id = p_player_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to update leaderboard entry and track changes
CREATE OR REPLACE FUNCTION upsert_leaderboard_entry(
  p_leaderboard_id UUID,
  p_player_id UUID,
  p_position INTEGER,
  p_total NUMERIC,
  p_snapshot_date DATE DEFAULT CURRENT_DATE
)
RETURNS void AS $$
DECLARE
  v_previous_position INTEGER;
  v_previous_total NUMERIC;
BEGIN
  SELECT position, total INTO v_previous_position, v_previous_total
  FROM leaderboard_entries
  WHERE leaderboard_id = p_leaderboard_id
    AND player_id = p_player_id
    AND snapshot_date < p_snapshot_date
  ORDER BY snapshot_date DESC
  LIMIT 1;
  
  INSERT INTO leaderboard_entries (
    leaderboard_id, 
    player_id, 
    position, 
    total, 
    previous_position, 
    previous_total, 
    snapshot_date
  )
  VALUES (
    p_leaderboard_id, 
    p_player_id, 
    p_position, 
    p_total, 
    v_previous_position, 
    v_previous_total, 
    p_snapshot_date
  )
  ON CONFLICT (leaderboard_id, player_id, snapshot_date)
  DO UPDATE SET
    position = EXCLUDED.position,
    total = EXCLUDED.total,
    previous_position = EXCLUDED.previous_position,
    previous_total = EXCLUDED.previous_total,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get top N players
CREATE OR REPLACE FUNCTION get_top_players(
  p_leaderboard_id UUID,
  p_limit INTEGER DEFAULT 10,
  p_snapshot_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  player_id UUID,
  player_code TEXT,
  player_name TEXT,
  "position" INTEGER,
  total NUMERIC,
  image_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS player_id,
    p.player_code,
    p.name AS player_name,
    le."position",
    le.total,
    p.image_url
  FROM leaderboard_entries le
  JOIN players p ON le.player_id = p.id
  WHERE le.leaderboard_id = p_leaderboard_id
    AND le.snapshot_date = p_snapshot_date
    AND p.is_active = true
  ORDER BY le."position" ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to record a challenge event
CREATE OR REPLACE FUNCTION record_challenge_event(
  p_player_id UUID,
  p_challenge_id UUID,
  p_event_type TEXT,
  p_points_awarded INTEGER DEFAULT 0,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO challenge_events (
    player_id,
    challenge_id,
    event_type,
    points_awarded,
    metadata
  )
  VALUES (
    p_player_id,
    p_challenge_id,
    p_event_type,
    p_points_awarded,
    p_metadata
  )
  RETURNING id INTO v_event_id;
  
  IF p_points_awarded > 0 THEN
    INSERT INTO player_stats (player_id, total_points)
    VALUES (p_player_id, p_points_awarded)
    ON CONFLICT (player_id)
    DO UPDATE SET
      total_points = player_stats.total_points + p_points_awarded,
      updated_at = NOW();
  END IF;
  
  IF p_event_type = 'completed' THEN
    UPDATE challenge_progress
    SET 
      times_completed = times_completed + 1,
      last_completed_at = NOW(),
      updated_at = NOW()
    WHERE player_id = p_player_id
      AND challenge_id = p_challenge_id;
      
    UPDATE player_stats
    SET 
      total_challenges = total_challenges + 1,
      updated_at = NOW()
    WHERE player_id = p_player_id;
  END IF;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get recent challenge events
CREATE OR REPLACE FUNCTION get_recent_challenge_events(
  p_limit INTEGER DEFAULT 10,
  p_since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 hour'
)
RETURNS TABLE (
  event_id UUID,
  player_id UUID,
  player_name TEXT,
  challenge_id UUID,
  challenge_name TEXT,
  event_type TEXT,
  points_awarded INTEGER,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ce.id AS event_id,
    ce.player_id,
    p.name AS player_name,
    ce.challenge_id,
    c.name AS challenge_name,
    ce.event_type,
    ce.points_awarded,
    ce.created_at
  FROM challenge_events ce
  JOIN players p ON ce.player_id = p.id
  JOIN challenges c ON ce.challenge_id = c.id
  WHERE ce.created_at >= p_since
  ORDER BY ce.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get player history
CREATE OR REPLACE FUNCTION get_player_history(
  p_player_id UUID,
  p_leaderboard_id UUID,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  snapshot_date DATE,
  "position" INTEGER,
  total NUMERIC,
  change_from_previous INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    le.snapshot_date,
    le."position",
    le.total,
    CASE 
      WHEN le.previous_position IS NOT NULL 
      THEN le.previous_position - le."position"
      ELSE 0
    END AS change_from_previous
  FROM leaderboard_entries le
  WHERE le.player_id = p_player_id
    AND le.leaderboard_id = p_leaderboard_id
    AND le.snapshot_date >= CURRENT_DATE - p_days
  ORDER BY le.snapshot_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get leaderboard statistics
CREATE OR REPLACE FUNCTION get_leaderboard_stats(
  p_leaderboard_id UUID,
  p_snapshot_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_players', COUNT(*),
    'total_points', SUM(total),
    'average_points', AVG(total),
    'top_score', MAX(total),
    'lowest_score', MIN(total)
  ) INTO result
  FROM leaderboard_entries
  WHERE leaderboard_id = p_leaderboard_id
    AND snapshot_date = p_snapshot_date;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get player's active challenges
CREATE OR REPLACE FUNCTION get_player_active_challenges(
  p_player_id UUID
)
RETURNS TABLE (
  challenge_id UUID,
  challenge_name TEXT,
  challenge_type TEXT,
  rules_completed INTEGER,
  rules_total INTEGER,
  percent_completed NUMERIC,
  points INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS challenge_id,
    c.name AS challenge_name,
    c.challenge_type,
    COALESCE(cp.rules_completed, 0) AS rules_completed,
    c.rules_total,
    COALESCE(cp.percent_completed, 0) AS percent_completed,
    c.points
  FROM challenges c
  LEFT JOIN challenge_progress cp ON c.id = cp.challenge_id AND cp.player_id = p_player_id
  WHERE c.is_active = true
    AND (cp.percent_completed IS NULL OR cp.percent_completed < 100)
  ORDER BY c.name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 4: TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS update_leaderboards_updated_at ON leaderboards;
CREATE TRIGGER update_leaderboards_updated_at BEFORE UPDATE ON leaderboards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_players_updated_at ON players;
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_leaderboard_entries_updated_at ON leaderboard_entries;
CREATE TRIGGER update_leaderboard_entries_updated_at BEFORE UPDATE ON leaderboard_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_challenges_updated_at ON challenges;
CREATE TRIGGER update_challenges_updated_at BEFORE UPDATE ON challenges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_challenge_progress_updated_at ON challenge_progress;
CREATE TRIGGER update_challenge_progress_updated_at BEFORE UPDATE ON challenge_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 5: ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access for leaderboards" ON leaderboards;
DROP POLICY IF EXISTS "Public read access for players" ON players;
DROP POLICY IF EXISTS "Public read access for leaderboard entries" ON leaderboard_entries;
DROP POLICY IF EXISTS "Public read access for challenges" ON challenges;
DROP POLICY IF EXISTS "Public read access for challenge progress" ON challenge_progress;
DROP POLICY IF EXISTS "Public read access for challenge events" ON challenge_events;
DROP POLICY IF EXISTS "Public read access for player stats" ON player_stats;

-- Create policies
CREATE POLICY "Public read access for leaderboards" ON leaderboards
  FOR SELECT USING (is_active = true);

CREATE POLICY "Public read access for players" ON players
  FOR SELECT USING (is_active = true);

CREATE POLICY "Public read access for leaderboard entries" ON leaderboard_entries
  FOR SELECT USING (true);

CREATE POLICY "Public read access for challenges" ON challenges
  FOR SELECT USING (is_active = true);

CREATE POLICY "Public read access for challenge progress" ON challenge_progress
  FOR SELECT USING (true);

CREATE POLICY "Public read access for challenge events" ON challenge_events
  FOR SELECT USING (true);

CREATE POLICY "Public read access for player stats" ON player_stats
  FOR SELECT USING (true);

-- ============================================================================
-- PART 6: ENABLE REALTIME
-- ============================================================================

-- Enable realtime for key tables
-- Note: We drop and re-add to avoid "already exists" errors
DO $$
BEGIN
  -- Remove tables from publication if they exist
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE leaderboard_entries;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE challenge_events;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE player_stats;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE challenge_progress;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- Add tables to publication
ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE challenge_events;
ALTER PUBLICATION supabase_realtime ADD TABLE player_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE challenge_progress;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check tables created
SELECT 'Tables created:' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check functions created
SELECT 'Functions created:' as status;
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Check realtime enabled
SELECT 'Realtime enabled for:' as status;
SELECT schemaname, tablename FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================
-- You should see:
-- - 7 tables created
-- - 9 functions created
-- - 4 tables with realtime enabled
-- - RLS enabled on all tables
-- ============================================================================
