# Supabase Migration Design

## Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Frontend      │────────▶│   Supabase       │◀────────│   n8n           │
│   (React/Vite)  │         │   (Postgres)     │         │   Workflows     │
│                 │         │                  │         │                 │
│  - App.tsx      │         │  - leaderboards  │         │  - Presença     │
│  - useChicken   │         │  - players       │         │  - GCOM Sales   │
│    RaceManager  │         │  - leaderboard_  │         │                 │
│  - Supabase     │         │    entries       │         │                 │
│    ApiService   │         │  - challenges    │         │                 │
└─────────────────┘         │  - challenge_    │         └─────────────────┘
                            │    progress      │                 │
                            │  - player_stats  │                 │
                            └──────────────────┘                 │
                                     ▲                           │
                                     │                           │
                            ┌────────┴────────┐                 │
                            │  Vercel API     │◀────────────────┘
                            │  Endpoints      │
                            │                 │
                            │  - /api/        │
                            │    presenca-    │
                            │    webhook      │
                            │  - /api/gcom-   │
                            │    sale-webhook │
                            └─────────────────┘
```

## Database Schema

### Existing Tables (from SUPABASE_COMPLETE.sql)

#### 1. `leaderboards`
```sql
CREATE TABLE leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
```

#### 2. `players`
```sql
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funifier_id TEXT UNIQUE,
  player_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT,
  extra JSONB DEFAULT '{}',  -- Contains { uid: "..." }
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. `leaderboard_entries`
```sql
CREATE TABLE leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID REFERENCES leaderboards(id),
  player_id UUID REFERENCES players(id),
  position INTEGER NOT NULL,
  total NUMERIC NOT NULL DEFAULT 0,
  previous_position INTEGER,
  previous_total NUMERIC,
  snapshot_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(leaderboard_id, player_id, snapshot_date)
);
```

#### 4. `player_stats`
```sql
CREATE TABLE player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) UNIQUE,
  total_challenges INTEGER DEFAULT 0,
  total_points NUMERIC DEFAULT 0,
  point_categories JSONB DEFAULT '{}',
  level_progress JSONB DEFAULT '{}',
  total_catalog_items INTEGER DEFAULT 0,
  catalog_items JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 5. `challenges`
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

#### 6. `challenge_progress`
```sql
CREATE TABLE challenge_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id),
  challenge_id UUID REFERENCES challenges(id),
  rules_completed INTEGER DEFAULT 0,
  rules_total INTEGER NOT NULL,
  percent_completed NUMERIC DEFAULT 0,
  times_completed INTEGER DEFAULT 0,
  last_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, challenge_id)
);
```

#### 7. `challenge_events`
```sql
CREATE TABLE challenge_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id),
  challenge_id UUID REFERENCES challenges(id),
  event_type TEXT NOT NULL,
  points_awarded INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### New Tables (from SUPABASE_ACTIONS_FUNCTIONS.sql)

#### 8. `actions`
```sql
CREATE TABLE actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id),
  action_id TEXT NOT NULL,
  points_awarded INTEGER DEFAULT 0,
  attributes JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 9. `daily_presence`
```sql
CREATE TABLE daily_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id),
  presence_date DATE DEFAULT CURRENT_DATE,
  first_check_in TIMESTAMPTZ DEFAULT NOW(),
  points_awarded INTEGER DEFAULT 5,
  UNIQUE(player_id, presence_date)
);
```

## API Service Design

### SupabaseApiService Class

```typescript
export class SupabaseApiService {
  private supabase: SupabaseClient;
  private retryAttempts = 3;
  private retryDelay = 1000;

  constructor(config: SupabaseConfig) {
    this.supabase = createClient(config.url, config.anonKey);
  }

  // Leaderboard Methods
  async getLeaderboards(): Promise<Leaderboard[]>
  async getLeaderboardData(id: string, options?: LeaderboardOptions): Promise<LeaderboardResponse>
  
  // Player Methods
  async getPlayerDetails(playerId: string): Promise<Player>
  async getPlayerStatus(playerId: string): Promise<PlayerStatus>
  
  // Real-time Subscriptions
  subscribeToLeaderboard(id: string, callback: (data: any) => void): RealtimeChannel
  subscribeToPlayerStats(id: string, callback: (data: any) => void): RealtimeChannel
  subscribeToChallengeEvents(callback: (data: any) => void): RealtimeChannel
  
  // Utility Methods
  async testConnection(): Promise<boolean>
  getConfig(): SupabaseConfig
}
```

### Query Implementations

#### Get Leaderboards
```typescript
async getLeaderboards(): Promise<Leaderboard[]> {
  const { data, error } = await this.supabase
    .from('leaderboards')
    .select('*')
    .eq('is_active', true)
    .order('title');
    
  if (error) throw this.handleError(error);
  return data.map(this.mapToLeaderboard);
}
```

#### Get Leaderboard Data
```typescript
async getLeaderboardData(id: string, options?: LeaderboardOptions): Promise<LeaderboardResponse> {
  const { data, error } = await this.supabase
    .from('leaderboard_entries')
    .select(`
      *,
      player:players(*)
    `)
    .eq('leaderboard_id', id)
    .eq('snapshot_date', options?.period || 'CURRENT_DATE')
    .order('position');
    
  if (error) throw this.handleError(error);
  
  return {
    leaderboard: await this.getLeaderboardById(id),
    leaders: data.map(this.mapToPlayer)
  };
}
```

#### Real-time Subscription
```typescript
subscribeToLeaderboard(id: string, callback: (data: any) => void): RealtimeChannel {
  return this.supabase
    .channel(`leaderboard:${id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'leaderboard_entries',
        filter: `leaderboard_id=eq.${id}`
      },
      callback
    )
    .subscribe();
}
```

## Vercel API Endpoints Design

### /api/presenca-webhook.ts

```typescript
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { uid, station, ts } = req.body;
  
  // Validate input
  if (!uid) {
    return res.status(400).json({ success: false, error: 'Missing uid' });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Find player by UID
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, player_code')
      .eq('extra->>uid', uid)
      .single();

    if (playerError || !player) {
      return res.status(404).json({ success: false, error: 'Player not found' });
    }

    // Call log_presenca function
    const { data, error } = await supabase.rpc('log_presenca', {
      p_player_code: player.player_code
    });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      player_code: player.player_code,
      points_awarded: data.points_awarded,
      is_first_today: data.is_first_today
    });
  } catch (error) {
    console.error('Presença webhook error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
```

### /api/gcom-sale-webhook.ts

```typescript
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { _id, delivery_title, price } = req.body;
  
  // Validate input
  if (!_id || !price) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Call log_sale function
    const { data, error } = await supabase.rpc('log_sale', {
      p_player_code: _id,
      p_delivery_title: delivery_title || 'Sale',
      p_price: price
    });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      player_code: _id,
      points_awarded: data.points_awarded,
      has_presence: data.has_presence
    });
  } catch (error) {
    console.error('GCOM sale webhook error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
```

## Frontend Integration

### App.tsx Changes

```typescript
// OLD
import { FunifierApiService } from './services/funifierApi';

const [apiConfig] = useState<FunifierConfig | null>(() => {
  const serverUrl = import.meta.env.VITE_FUNIFIER_SERVER_URL;
  const apiKey = import.meta.env.VITE_FUNIFIER_API_KEY;
  const authToken = import.meta.env.VITE_FUNIFIER_AUTH_TOKEN;
  // ...
});

// NEW
import { SupabaseApiService } from './services/supabaseApi';

const [apiConfig] = useState<SupabaseConfig | null>(() => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    console.warn('🔧 Missing Supabase configuration, will use demo mode');
    return null;
  }

  return { url, anonKey };
});
```

### useChickenRaceManager Hook

No changes needed - the hook is agnostic to the API service implementation as long as it implements the same interface.

## Environment Variables

### .env.example
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://fnp.centralsupernova.com.br
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Server-side only (for API routes)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### .env.production
```env
VITE_SUPABASE_URL=https://fnp.centralsupernova.com.br
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc5MzMzOTU1LCJleHAiOjE5MzcwMTM5NTV9.2m9jUfgKs8wuBHA6s0omP2ktzJ0dlreeJ_n2--djKPw
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzkzMzM5NTUsImV4cCI6MTkzNzAxMzk1NX0.LEHMolITvfN6LUo6-UzoilG8_0-hl5IawI1h1k4Erps
```

## Migration Strategy

### Phase 1: Preparation
1. Create `SupabaseApiService` class
2. Update environment variables
3. Create Vercel API endpoints
4. Test endpoints locally

### Phase 2: Deployment
1. Deploy Vercel API endpoints
2. Test endpoints in production
3. Activate n8n workflows
4. Verify data flow

### Phase 3: Frontend Switch
1. Update `App.tsx` to use Supabase
2. Deploy frontend to Vercel
3. Monitor for errors
4. Verify all features work

### Phase 4: Cleanup
1. Remove Funifier code
2. Remove Funifier environment variables
3. Update documentation
4. Archive migration files

## Error Handling

### Retry Logic
```typescript
private async retryRequest<T>(
  requestFn: () => Promise<T>,
  attempt = 1
): Promise<T> {
  try {
    return await requestFn();
  } catch (error) {
    if (attempt >= this.retryAttempts) {
      throw error;
    }
    
    const delay = this.retryDelay * Math.pow(2, attempt - 1);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return this.retryRequest(requestFn, attempt + 1);
  }
}
```

### Graceful Degradation
- If Supabase is unavailable, fall back to demo mode
- Show user-friendly error messages
- Log errors for debugging
- Retry failed requests automatically

## Security Considerations

### Row Level Security (RLS)
```sql
-- Enable RLS on all tables
ALTER TABLE leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read" ON leaderboards
  FOR SELECT USING (is_active = true);

CREATE POLICY "Allow public read" ON players
  FOR SELECT USING (is_active = true);

CREATE POLICY "Allow public read" ON leaderboard_entries
  FOR SELECT USING (true);
```

### API Endpoint Security
- Validate all inputs
- Use SERVICE_ROLE_KEY only on server
- Never expose SERVICE_ROLE_KEY to client
- Implement rate limiting
- Log all webhook calls

## Performance Optimization

### Database Indexes
```sql
CREATE INDEX idx_leaderboard_entries_leaderboard ON leaderboard_entries(leaderboard_id);
CREATE INDEX idx_leaderboard_entries_player ON leaderboard_entries(player_id);
CREATE INDEX idx_leaderboard_entries_position ON leaderboard_entries(leaderboard_id, position);
CREATE INDEX idx_players_uid ON players((extra->>'uid'));
CREATE INDEX idx_players_code ON players(player_code);
```

### Query Optimization
- Use `select()` to fetch only needed columns
- Use `single()` for single-row queries
- Use `maybeSingle()` when row might not exist
- Implement pagination for large result sets

### Caching Strategy
- Cache leaderboard data for 30 seconds
- Cache player stats for 60 seconds
- Invalidate cache on real-time updates
- Use browser localStorage for offline support

## Testing Strategy

### Unit Tests
- Test `SupabaseApiService` methods
- Test Vercel API endpoints
- Test error handling
- Test retry logic

### Integration Tests
- Test end-to-end data flow
- Test real-time subscriptions
- Test webhook integration
- Test n8n workflows

### Performance Tests
- Load test leaderboard queries
- Stress test API endpoints
- Test real-time subscription scalability
- Monitor database performance

## Rollback Plan

If migration fails:
1. Revert frontend to use Funifier
2. Deactivate n8n workflows
3. Keep Supabase data for debugging
4. Analyze failure logs
5. Fix issues and retry

## Success Metrics

- [ ] All leaderboard queries < 500ms
- [ ] Real-time updates < 2s latency
- [ ] API endpoints < 300ms response time
- [ ] Zero data loss
- [ ] 100% feature parity
- [ ] No production errors for 24 hours
