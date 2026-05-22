-- ============================================================================
-- HELPER FUNCTIONS FOR FNP RANKING
-- Additional utility functions for common operations
-- ============================================================================

-- Function to get top N players from a leaderboard
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

-- Function to get player rank in a specific leaderboard
CREATE OR REPLACE FUNCTION get_player_rank(
  p_player_id UUID,
  p_leaderboard_id UUID,
  p_snapshot_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  position INTEGER,
  total NUMERIC,
  total_players INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    le.position,
    le.total,
    (SELECT COUNT(*)::INTEGER 
     FROM leaderboard_entries 
     WHERE leaderboard_id = p_leaderboard_id 
       AND snapshot_date = p_snapshot_date) AS total_players
  FROM leaderboard_entries le
  WHERE le.player_id = p_player_id
    AND le.leaderboard_id = p_leaderboard_id
    AND le.snapshot_date = p_snapshot_date;
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
  -- Insert challenge event
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
  
  -- Update player stats if points were awarded
  IF p_points_awarded > 0 THEN
    INSERT INTO player_stats (player_id, total_points)
    VALUES (p_player_id, p_points_awarded)
    ON CONFLICT (player_id)
    DO UPDATE SET
      total_points = player_stats.total_points + p_points_awarded,
      updated_at = NOW();
  END IF;
  
  -- Update challenge progress if completed
  IF p_event_type = 'completed' THEN
    UPDATE challenge_progress
    SET 
      times_completed = times_completed + 1,
      last_completed_at = NOW(),
      updated_at = NOW()
    WHERE player_id = p_player_id
      AND challenge_id = p_challenge_id;
      
    -- Update total challenges in player stats
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

-- Function to calculate leaderboard statistics
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

-- Function to get player's position history
CREATE OR REPLACE FUNCTION get_player_history(
  p_player_id UUID,
  p_leaderboard_id UUID,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  snapshot_date DATE,
  position INTEGER,
  total NUMERIC,
  change_from_previous INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    le.snapshot_date,
    le.position,
    le.total,
    CASE 
      WHEN le.previous_position IS NOT NULL 
      THEN le.previous_position - le.position
      ELSE 0
    END AS change_from_previous
  FROM leaderboard_entries le
  WHERE le.player_id = p_player_id
    AND le.leaderboard_id = p_leaderboard_id
    AND le.snapshot_date >= CURRENT_DATE - p_days
  ORDER BY le.snapshot_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to bulk update leaderboard entries
CREATE OR REPLACE FUNCTION bulk_update_leaderboard(
  p_leaderboard_id UUID,
  p_entries JSONB,
  p_snapshot_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER AS $$
DECLARE
  v_entry JSONB;
  v_count INTEGER := 0;
BEGIN
  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    PERFORM upsert_leaderboard_entry(
      p_leaderboard_id,
      (v_entry->>'player_id')::UUID,
      (v_entry->>'position')::INTEGER,
      (v_entry->>'total')::NUMERIC,
      p_snapshot_date
    );
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to archive old leaderboard entries
CREATE OR REPLACE FUNCTION archive_old_entries(
  p_days_to_keep INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM leaderboard_entries
  WHERE snapshot_date < CURRENT_DATE - p_days_to_keep
  RETURNING COUNT(*) INTO v_deleted;
  
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- Function to get active challenges for a player
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
