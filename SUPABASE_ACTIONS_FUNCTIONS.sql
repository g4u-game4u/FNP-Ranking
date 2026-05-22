-- ============================================================================
-- SUPABASE ACTIONS & BUSINESS LOGIC FUNCTIONS
-- These replace Funifier's action logging and points calculation
-- ============================================================================

-- ============================================================================
-- ACTIONS TABLE
-- ============================================================================

-- Actions log table (replaces Funifier action log)
CREATE TABLE IF NOT EXISTS actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_id TEXT NOT NULL,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  attributes JSONB DEFAULT '{}',
  points_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_actions_player ON actions(player_id);
CREATE INDEX IF NOT EXISTS idx_actions_action_id ON actions(action_id);
CREATE INDEX IF NOT EXISTS idx_actions_created ON actions(created_at DESC);

-- ============================================================================
-- DAILY PRESENCE TRACKING
-- ============================================================================

-- Daily presence table
CREATE TABLE IF NOT EXISTS daily_presence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  presence_date DATE NOT NULL DEFAULT CURRENT_DATE,
  uid TEXT NOT NULL,
  station TEXT,
  first_check_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_check_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_in_count INTEGER DEFAULT 1,
  points_awarded INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, presence_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_presence_player ON daily_presence(player_id);
CREATE INDEX IF NOT EXISTS idx_daily_presence_date ON daily_presence(presence_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_presence_uid ON daily_presence(uid);

-- ============================================================================
-- FUNCTION: Log Presença (Attendance)
-- ============================================================================

CREATE OR REPLACE FUNCTION log_presenca(
  p_uid TEXT,
  p_station TEXT DEFAULT NULL,
  p_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE
  v_player_id UUID;
  v_player_name TEXT;
  v_presence_date DATE;
  v_existing_presence RECORD;
  v_points_awarded INTEGER := 0;
  v_is_first_today BOOLEAN := false;
  v_action_id UUID;
BEGIN
  -- Get current date in São Paulo timezone
  v_presence_date := (p_timestamp AT TIME ZONE 'America/Sao_Paulo')::DATE;
  
  -- Find player by UID in extra field
  SELECT id, name INTO v_player_id, v_player_name
  FROM players
  WHERE extra->>'uid' = p_uid
    AND is_active = true;
  
  -- If player not found, return error
  IF v_player_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Player not found',
      'uid', p_uid
    );
  END IF;
  
  -- Check if already registered presence today
  SELECT * INTO v_existing_presence
  FROM daily_presence
  WHERE player_id = v_player_id
    AND presence_date = v_presence_date;
  
  IF v_existing_presence IS NULL THEN
    -- First presence of the day - award 5 points
    v_points_awarded := 5;
    v_is_first_today := true;
    
    -- Insert new presence record
    INSERT INTO daily_presence (
      player_id,
      presence_date,
      uid,
      station,
      first_check_in,
      last_check_in,
      check_in_count,
      points_awarded
    ) VALUES (
      v_player_id,
      v_presence_date,
      p_uid,
      p_station,
      p_timestamp,
      p_timestamp,
      1,
      v_points_awarded
    );
    
    -- Update player stats
    INSERT INTO player_stats (player_id, total_points)
    VALUES (v_player_id, v_points_awarded)
    ON CONFLICT (player_id)
    DO UPDATE SET
      total_points = player_stats.total_points + v_points_awarded,
      updated_at = NOW();
  ELSE
    -- Already registered today - just update check-in count
    UPDATE daily_presence
    SET 
      last_check_in = p_timestamp,
      check_in_count = check_in_count + 1,
      updated_at = NOW()
    WHERE player_id = v_player_id
      AND presence_date = v_presence_date;
  END IF;
  
  -- Log action
  INSERT INTO actions (
    action_id,
    player_id,
    attributes,
    points_awarded
  ) VALUES (
    'presenca',
    v_player_id,
    json_build_object(
      'uid', p_uid,
      'station', p_station,
      'timestamp', p_timestamp,
      'is_first_today', v_is_first_today
    )::jsonb,
    v_points_awarded
  ) RETURNING id INTO v_action_id;
  
  -- Return success response
  RETURN json_build_object(
    'success', true,
    'player_id', v_player_id,
    'player_name', v_player_name,
    'action_id', v_action_id,
    'points_awarded', v_points_awarded,
    'is_first_today', v_is_first_today,
    'presence_date', v_presence_date,
    'check_in_count', COALESCE(v_existing_presence.check_in_count, 0) + 1
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Check if player has presence today
-- ============================================================================

CREATE OR REPLACE FUNCTION has_presence_today(
  p_player_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_presence BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM daily_presence
    WHERE player_id = p_player_id
      AND presence_date = p_date
  ) INTO v_has_presence;
  
  RETURN v_has_presence;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Log Sale (GCOM)
-- ============================================================================

CREATE OR REPLACE FUNCTION log_sale(
  p_player_email TEXT,
  p_delivery_title TEXT,
  p_price NUMERIC,
  p_sale_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE
  v_player_id UUID;
  v_player_name TEXT;
  v_has_presence BOOLEAN;
  v_points_awarded INTEGER := 0;
  v_sale_date DATE;
  v_action_id UUID;
BEGIN
  -- Get sale date in São Paulo timezone
  v_sale_date := (p_sale_timestamp AT TIME ZONE 'America/Sao_Paulo')::DATE;
  
  -- Find player by email (player_code)
  SELECT id, name INTO v_player_id, v_player_name
  FROM players
  WHERE player_code = p_player_email
    AND is_active = true;
  
  -- If player not found, return error
  IF v_player_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Player not found',
      'player_email', p_player_email
    );
  END IF;
  
  -- Check if player has presence today
  v_has_presence := has_presence_today(v_player_id, v_sale_date);
  
  -- Calculate points: 0.1 * price, but only if has presence
  IF v_has_presence THEN
    v_points_awarded := FLOOR(p_price * 0.1);
    
    -- Update player stats
    INSERT INTO player_stats (player_id, total_points)
    VALUES (v_player_id, v_points_awarded)
    ON CONFLICT (player_id)
    DO UPDATE SET
      total_points = player_stats.total_points + v_points_awarded,
      updated_at = NOW();
  END IF;
  
  -- Log action (always log, even if no points awarded)
  INSERT INTO actions (
    action_id,
    player_id,
    attributes,
    points_awarded
  ) VALUES (
    'sell_product',
    v_player_id,
    json_build_object(
      'delivery_title', p_delivery_title,
      'price', p_price,
      'has_presence', v_has_presence,
      'sale_date', v_sale_date
    )::jsonb,
    v_points_awarded
  ) RETURNING id INTO v_action_id;
  
  -- Return success response
  RETURN json_build_object(
    'success', true,
    'player_id', v_player_id,
    'player_name', v_player_name,
    'action_id', v_action_id,
    'points_awarded', v_points_awarded,
    'has_presence', v_has_presence,
    'sale_date', v_sale_date,
    'price', p_price
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Get player daily stats
-- ============================================================================

CREATE OR REPLACE FUNCTION get_player_daily_stats(
  p_player_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'player_id', p.id,
    'player_name', p.name,
    'date', p_date,
    'has_presence', EXISTS(
      SELECT 1 FROM daily_presence 
      WHERE player_id = p_player_id 
        AND presence_date = p_date
    ),
    'presence_details', (
      SELECT json_build_object(
        'first_check_in', dp.first_check_in,
        'last_check_in', dp.last_check_in,
        'check_in_count', dp.check_in_count,
        'points_awarded', dp.points_awarded,
        'station', dp.station
      )
      FROM daily_presence dp
      WHERE dp.player_id = p_player_id
        AND dp.presence_date = p_date
    ),
    'sales_count', (
      SELECT COUNT(*)
      FROM actions
      WHERE player_id = p_player_id
        AND action_id = 'sell_product'
        AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = p_date
    ),
    'sales_points', (
      SELECT COALESCE(SUM(points_awarded), 0)
      FROM actions
      WHERE player_id = p_player_id
        AND action_id = 'sell_product'
        AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = p_date
    ),
    'total_points_today', (
      SELECT COALESCE(SUM(points_awarded), 0)
      FROM actions
      WHERE player_id = p_player_id
        AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = p_date
    )
  ) INTO v_result
  FROM players p
  WHERE p.id = p_player_id;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Get leaderboard with presence filter
-- ============================================================================

CREATE OR REPLACE FUNCTION get_leaderboard_with_presence(
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  player_id UUID,
  player_name TEXT,
  player_code TEXT,
  total_points NUMERIC,
  has_presence BOOLEAN,
  presence_count INTEGER,
  sales_count BIGINT,
  sales_points NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS player_id,
    p.name AS player_name,
    p.player_code,
    COALESCE(ps.total_points, 0) AS total_points,
    EXISTS(
      SELECT 1 FROM daily_presence dp 
      WHERE dp.player_id = p.id 
        AND dp.presence_date = p_date
    ) AS has_presence,
    (
      SELECT COUNT(*)::INTEGER
      FROM daily_presence dp
      WHERE dp.player_id = p.id
        AND dp.presence_date >= p_date - INTERVAL '30 days'
    ) AS presence_count,
    (
      SELECT COUNT(*)
      FROM actions a
      WHERE a.player_id = p.id
        AND a.action_id = 'sell_product'
        AND DATE(a.created_at AT TIME ZONE 'America/Sao_Paulo') = p_date
    ) AS sales_count,
    (
      SELECT COALESCE(SUM(a.points_awarded), 0)
      FROM actions a
      WHERE a.player_id = p.id
        AND a.action_id = 'sell_product'
        AND DATE(a.created_at AT TIME ZONE 'America/Sao_Paulo') = p_date
    ) AS sales_points
  FROM players p
  LEFT JOIN player_stats ps ON p.id = ps.player_id
  WHERE p.is_active = true
  ORDER BY ps.total_points DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS update_daily_presence_updated_at ON daily_presence;
CREATE TRIGGER update_daily_presence_updated_at BEFORE UPDATE ON daily_presence
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ENABLE REALTIME FOR NEW TABLES
-- ============================================================================

ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access for actions" ON actions;
CREATE POLICY "Public read access for actions" ON actions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for daily presence" ON daily_presence;
CREATE POLICY "Public read access for daily presence" ON daily_presence FOR SELECT USING (true);

-- Add to realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE actions;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE daily_presence;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE actions;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_presence;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'Actions functions created successfully!' as status;

-- Test queries (commented out - uncomment to test)
-- SELECT log_presenca('test_uid_123', 'station_1');
-- SELECT log_sale('test@example.com', 'Test Product', 100.00);
-- SELECT get_player_daily_stats('player_uuid_here');
-- SELECT * FROM get_leaderboard_with_presence();
