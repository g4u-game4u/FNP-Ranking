-- FNP Ranking Database Schema for Supabase
-- Migration from Funifier to Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Leaderboards table
CREATE TABLE IF NOT EXISTS leaderboards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  funifier_id TEXT UNIQUE, -- For migration reference
  title TEXT NOT NULL,
  description TEXT,
  principal_type INTEGER DEFAULT 0, -- 0: Player, 1: Team
  operation_type INTEGER,
  achievement_type INTEGER,
  operation_item TEXT,
  sort_order INTEGER DEFAULT -1, -- -1: descending, 1: ascending
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
  funifier_id TEXT UNIQUE, -- For migration reference
  player_code TEXT UNIQUE NOT NULL, -- Original player identifier
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
  event_type TEXT NOT NULL, -- 'started', 'progress', 'completed'
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
-- INDEXES
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
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to get leaderboard with players (replaces Funifier aggregate endpoint)
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

-- Function to get player status (replaces Funifier player status endpoint)
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
  -- Get previous values
  SELECT position, total INTO v_previous_position, v_previous_total
  FROM leaderboard_entries
  WHERE leaderboard_id = p_leaderboard_id
    AND player_id = p_player_id
    AND snapshot_date < p_snapshot_date
  ORDER BY snapshot_date DESC
  LIMIT 1;
  
  -- Insert or update entry
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

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Triggers to auto-update updated_at
CREATE TRIGGER update_leaderboards_updated_at BEFORE UPDATE ON leaderboards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leaderboard_entries_updated_at BEFORE UPDATE ON leaderboard_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_challenges_updated_at BEFORE UPDATE ON challenges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_challenge_progress_updated_at BEFORE UPDATE ON challenge_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

-- Public read access for leaderboards (using anon key)
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

-- Service role has full access (for backend operations)
-- These policies are automatically handled by Supabase when using service_role key

-- ============================================================================
-- SAMPLE DATA (for testing)
-- ============================================================================

-- Uncomment to insert sample data
/*
-- Sample leaderboard
INSERT INTO leaderboards (funifier_id, title, description, principal_type, sort_order)
VALUES ('EVeTmET', 'Main Leaderboard', 'Primary ranking system', 0, -1);

-- Sample players
INSERT INTO players (player_code, name) VALUES
  ('player1', 'Alice'),
  ('player2', 'Bob'),
  ('player3', 'Charlie');
*/
