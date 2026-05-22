# Funifier to Supabase Migration Plan

## Overview
This document outlines the migration strategy from Funifier API to a self-hosted Supabase backend for the FNP Ranking system.

## Current Funifier Integration

### Endpoints Used
1. **GET /leaderboard** - Fetch list of available leaderboards
2. **POST /leaderboard/:id/leader/aggregate** - Fetch leaderboard data with players
3. **GET /players/:id** - Get player details
4. **GET /player/:id/status** - Get player status including challenge progress

### Data Models

#### Leaderboard
```typescript
{
  _id: string;
  title: string;
  description: string;
  principalType: number; // 0 for Player, 1 for Team
  operation: {
    type: number;
    achievement_type: number;
    item: string;
    sort: number; // -1 descending, 1 ascending
  };
  period: {
    type: number;
    timeAmount: number;
    timeScale: number;
  };
}
```

#### Player
```typescript
{
  _id: string;
  player: string;
  name: string;
  position: number;
  total: number;
  previous_position?: number;
  previous_total?: number;
  move?: 'up' | 'down' | 'same';
  image?: string;
  extra?: Record<string, any>;
}
```

#### PlayerStatus
```typescript
{
  name: string;
  total_challenges: number;
  challenges: Record<string, number>;
  total_points: number;
  point_categories: Record<string, number>;
  level_progress: {
    percent_completed: number;
    next_points: number;
    total_levels: number;
    percent: number;
  };
  challenge_progress: ChallengeProgress[];
  // ... more fields
}
```

## Supabase Database Schema

### Tables to Create

#### 1. `leaderboards`
```sql
CREATE TABLE leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
```

#### 2. `players`
```sql
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funifier_id TEXT UNIQUE, -- For migration reference
  player_code TEXT UNIQUE NOT NULL, -- Original player identifier
  name TEXT NOT NULL,
  image_url TEXT,
  extra JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. `leaderboard_entries`
```sql
CREATE TABLE leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE INDEX idx_leaderboard_entries_leaderboard ON leaderboard_entries(leaderboard_id);
CREATE INDEX idx_leaderboard_entries_player ON leaderboard_entries(player_id);
CREATE INDEX idx_leaderboard_entries_position ON leaderboard_entries(leaderboard_id, position);
```

#### 4. `challenges`
```sql
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
```

#### 5. `challenge_progress`
```sql
CREATE TABLE challenge_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE INDEX idx_challenge_progress_player ON challenge_progress(player_id);
CREATE INDEX idx_challenge_progress_challenge ON challenge_progress(challenge_id);
```

#### 6. `challenge_events`
```sql
CREATE TABLE challenge_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'started', 'progress', 'completed'
  points_awarded INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_challenge_events_player ON challenge_events(player_id);
CREATE INDEX idx_challenge_events_challenge ON challenge_events(challenge_id);
CREATE INDEX idx_challenge_events_created ON challenge_events(created_at DESC);
```

#### 7. `player_stats`
```sql
CREATE TABLE player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE UNIQUE,
  total_challenges INTEGER DEFAULT 0,
  total_points NUMERIC DEFAULT 0,
  point_categories JSONB DEFAULT '{}',
  level_progress JSONB DEFAULT '{}',
  total_catalog_items INTEGER DEFAULT 0,
  catalog_items JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_player_stats_player ON player_stats(player_id);
```

## Migration Steps

### Phase 1: Database Setup (Current)
1. ✅ Configure Supabase MCP server
2. ⏳ Create database schema
3. ⏳ Set up Row Level Security (RLS) policies
4. ⏳ Create database functions for common queries

### Phase 2: Data Migration
1. ⏳ Export current data from Funifier API
2. ⏳ Transform and import into Supabase
3. ⏳ Verify data integrity
4. ⏳ Create data sync script (if needed during transition)

### Phase 3: API Layer
1. ⏳ Create Supabase service to replace funifierApi.ts
2. ⏳ Implement equivalent endpoints using Supabase queries
3. ⏳ Add real-time subscriptions for live updates
4. ⏳ Create Edge Functions for complex operations

### Phase 4: N8N Workflows (Optional)
1. ⏳ Set up N8N for automation
2. ⏳ Create workflows for:
   - Challenge event processing
   - Leaderboard calculations
   - Notifications
   - Data synchronization

### Phase 5: Testing & Validation
1. ⏳ Unit tests for new Supabase service
2. ⏳ Integration tests
3. ⏳ Performance testing
4. ⏳ Parallel run with Funifier (if possible)

### Phase 6: Deployment
1. ⏳ Update environment variables
2. ⏳ Deploy to production
3. ⏳ Monitor and validate
4. ⏳ Decommission Funifier integration

## Supabase Configuration

### Connection Details
- **Studio URL**: https://fnp.centralsupernova.com.br
- **Studio User**: supabase
- **Studio Password**: 49728e7a85bd404966c58cce1327cd10
- **Postgres Host**: 127.0.0.1:5436
- **Postgres User**: postgres
- **Postgres Password**: 15125f6c9a03be567f93215b5bd58c40
- **Anon Key**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc5MzMzOTU1LCJleHAiOjE5MzcwMTM5NTV9.2m9jUfgKs8wuBHA6s0omP2ktzJ0dlreeJ_n2--djKPw
- **Service Role Key**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzkzMzM5NTUsImV4cCI6MTkzNzAxMzk1NX0.LEHMolITvfN6LUo6-UzoilG8_0-hl5IawI1h1k4Erps

## Environment Variables Update

### New Variables Needed
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://fnp.centralsupernova.com.br
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc5MzMzOTU1LCJleHAiOjE5MzcwMTM5NTV9.2m9jUfgKs8wuBHA6s0omP2ktzJ0dlreeJ_n2--djKPw

# Server-side only (for API routes)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzkzMzM5NTUsImV4cCI6MTkzNzAxMzk1NX0.LEHMolITvfN6LUo6-UzoilG8_0-hl5IawI1h1k4Erps

# N8N Configuration (optional)
N8N_WEBHOOK_URL=https://fnp.centralsupernova.com.br/webhook
N8N_API_KEY=your_n8n_api_key_here
```

## Next Steps

1. **Immediate**: Create database schema in Supabase
2. **Next**: Create data export script from Funifier
3. **Then**: Build Supabase service layer
4. **Finally**: Test and deploy

## Notes

- Keep Funifier credentials during transition period
- Consider running both systems in parallel initially
- Set up monitoring and alerting for the new system
- Document any custom business logic from Funifier that needs replication
