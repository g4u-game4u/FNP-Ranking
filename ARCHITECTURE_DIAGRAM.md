# 🏗️ System Architecture

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES                                 │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────┐                    ┌──────────────────┐
│  Raspberry Pi    │                    │   GCOM MySQL     │
│  (RFID Reader)   │                    │   (Sales DB)     │
└────────┬─────────┘                    └────────┬─────────┘
         │                                       │
         │ POST {uid, station, ts}               │ Query every hour
         │                                       │
         ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            N8N WORKFLOWS                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────┐              ┌────────────────────┐        │
│  │ Presença Workflow  │              │  GCOM Workflow     │        │
│  │                    │              │                    │        │
│  │ 1. Receive webhook │              │ 1. Schedule (1h)   │        │
│  │ 2. Extract fields  │              │ 2. Get time range  │        │
│  │ 3. Call Supabase   │              │ 3. Query GCOM      │        │
│  │ 4. Log result      │              │ 4. Call Supabase   │        │
│  └────────┬───────────┘              └────────┬───────────┘        │
│           │                                   │                     │
└───────────┼───────────────────────────────────┼─────────────────────┘
            │                                   │
            │ POST /api/presenca-webhook        │ POST /api/gcom-sale-webhook
            │                                   │
            ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      VERCEL SERVERLESS FUNCTIONS                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────┐              ┌────────────────────┐        │
│  │ presenca-webhook   │              │ gcom-sale-webhook  │        │
│  │                    │              │                    │        │
│  │ • Validate input   │              │ • Validate input   │        │
│  │ • Call Supabase    │              │ • Call Supabase    │        │
│  │ • Return result    │              │ • Return result    │        │
│  └────────┬───────────┘              └────────┬───────────┘        │
│           │                                   │                     │
└───────────┼───────────────────────────────────┼─────────────────────┘
            │                                   │
            │ RPC: log_presenca()               │ RPC: log_sale()
            │                                   │
            ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SUPABASE (PostgreSQL)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                    DATABASE FUNCTIONS                       │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │                                                             │    │
│  │  log_presenca(uid, station, ts)                            │    │
│  │  ├─ Find player by extra.uid                               │    │
│  │  ├─ Check if first check-in today                          │    │
│  │  ├─ Award 5 points if first                                │    │
│  │  ├─ Insert/update daily_presence                           │    │
│  │  ├─ Log action                                             │    │
│  │  └─ Return result                                          │    │
│  │                                                             │    │
│  │  log_sale(email, title, price, ts)                         │    │
│  │  ├─ Find player by player_code                             │    │
│  │  ├─ Check has_presence_today()                             │    │
│  │  ├─ Calculate points: FLOOR(price * 0.1) if has presence   │    │
│  │  ├─ Update player_stats                                    │    │
│  │  ├─ Log action                                             │    │
│  │  └─ Return result                                          │    │
│  │                                                             │    │
│  │  has_presence_today(player_id, date)                       │    │
│  │  └─ Check daily_presence table                             │    │
│  │                                                             │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                       DATABASE TABLES                       │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │                                                             │    │
│  │  players                                                    │    │
│  │  ├─ id (UUID)                                               │    │
│  │  ├─ player_code (email)                                     │    │
│  │  ├─ name                                                    │    │
│  │  └─ extra (JSONB) → {uid: "..."}                           │    │
│  │                                                             │    │
│  │  daily_presence                                             │    │
│  │  ├─ player_id                                               │    │
│  │  ├─ presence_date                                           │    │
│  │  ├─ uid                                                     │    │
│  │  ├─ station                                                 │    │
│  │  ├─ first_check_in                                          │    │
│  │  ├─ last_check_in                                           │    │
│  │  ├─ check_in_count                                          │    │
│  │  └─ points_awarded (5)                                      │    │
│  │                                                             │    │
│  │  actions                                                    │    │
│  │  ├─ action_id ('presenca' | 'sell_product')                │    │
│  │  ├─ player_id                                               │    │
│  │  ├─ attributes (JSONB)                                      │    │
│  │  ├─ points_awarded                                          │    │
│  │  └─ created_at                                              │    │
│  │                                                             │    │
│  │  player_stats                                               │    │
│  │  ├─ player_id                                               │    │
│  │  ├─ total_points                                            │    │
│  │  └─ updated_at                                              │    │
│  │                                                             │    │
│  │  leaderboard_entries                                        │    │
│  │  ├─ leaderboard_id                                          │    │
│  │  ├─ player_id                                               │    │
│  │  ├─ position                                                │    │
│  │  └─ total                                                   │    │
│  │                                                             │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               │ Real-time subscriptions
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                    SupabaseApiService                       │    │
│  │  ├─ getLeaderboards()                                       │    │
│  │  ├─ getLeaderboardData()                                    │    │
│  │  ├─ getPlayerStatus()                                       │    │
│  │  ├─ subscribeToLeaderboard()                                │    │
│  │  └─ subscribeToChallengeEvents()                            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                      React Components                       │    │
│  │  ├─ LeaderboardDisplay                                      │    │
│  │  ├─ PlayerCard                                              │    │
│  │  ├─ DailyGoalProgress                                       │    │
│  │  └─ ChallengeProgress                                       │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow Examples

### Example 1: Presença (Attendance)

```
1. Employee scans RFID card
   └─ Raspberry Pi reads UID: "ABC123"

2. Raspberry Pi → N8N Webhook
   POST {uid: "ABC123", station: "entrance", ts: 1716384000}

3. N8N → Vercel API
   POST /api/presenca-webhook
   {uid: "ABC123", station: "entrance", ts: 1716384000}

4. Vercel → Supabase RPC
   SELECT log_presenca('ABC123', 'entrance', '2026-05-22 08:00:00')

5. Supabase Function Logic:
   ├─ Find player: SELECT * FROM players WHERE extra->>'uid' = 'ABC123'
   │  └─ Found: João Silva (joao@example.com)
   │
   ├─ Check today's presence:
   │  SELECT * FROM daily_presence 
   │  WHERE player_id = 'uuid' AND presence_date = '2026-05-22'
   │  └─ Not found → First check-in today!
   │
   ├─ Award points: 5 points
   │
   ├─ Insert presence record:
   │  INSERT INTO daily_presence (player_id, presence_date, uid, ...)
   │
   ├─ Update player stats:
   │  UPDATE player_stats SET total_points = total_points + 5
   │
   └─ Log action:
      INSERT INTO actions (action_id='presenca', points_awarded=5, ...)

6. Response → Vercel → N8N → Logs
   {
     success: true,
     player_name: "João Silva",
     points_awarded: 5,
     is_first_today: true
   }

7. Frontend (real-time):
   ├─ Supabase subscription detects new action
   ├─ Updates leaderboard automatically
   └─ Shows notification: "João Silva checked in! +5 points"
```

### Example 2: GCOM Sale

```
1. Sale completed in GCOM
   └─ Inserted into g4u_actions_v table

2. N8N Schedule (every hour)
   └─ Triggers workflow

3. N8N → Query GCOM
   SELECT * FROM g4u_actions_v 
   WHERE created_at > last_hour AND finished_at IS NOT NULL

4. For each sale:
   N8N → Vercel API
   POST /api/gcom-sale-webhook
   {
     _id: "maria@example.com",
     delivery_title: "Pizza Margherita",
     price: 45.00
   }

5. Vercel → Supabase RPC
   SELECT log_sale('maria@example.com', 'Pizza Margherita', 45.00, NOW())

6. Supabase Function Logic:
   ├─ Find player: SELECT * FROM players WHERE player_code = 'maria@example.com'
   │  └─ Found: Maria Santos
   │
   ├─ Check presence today:
   │  SELECT has_presence_today('maria_uuid', '2026-05-22')
   │  └─ TRUE (Maria checked in at 08:30)
   │
   ├─ Calculate points: FLOOR(45.00 * 0.1) = 4 points
   │
   ├─ Update player stats:
   │  UPDATE player_stats SET total_points = total_points + 4
   │
   └─ Log action:
      INSERT INTO actions (
        action_id='sell_product',
        points_awarded=4,
        attributes={'price': 45, 'has_presence': true, ...}
      )

7. Response → Vercel → N8N → Logs
   {
     success: true,
     player_name: "Maria Santos",
     points_awarded: 4,
     has_presence: true,
     price: 45.00
   }

8. Frontend (real-time):
   ├─ Supabase subscription detects new action
   ├─ Updates leaderboard automatically
   └─ Shows notification: "Maria Santos sold Pizza! +4 points"
```

### Example 3: Sale WITHOUT Presence

```
1-4. [Same as Example 2]

5. Vercel → Supabase RPC
   SELECT log_sale('pedro@example.com', 'Burger', 30.00, NOW())

6. Supabase Function Logic:
   ├─ Find player: Pedro Costa
   │
   ├─ Check presence today:
   │  SELECT has_presence_today('pedro_uuid', '2026-05-22')
   │  └─ FALSE (Pedro didn't check in today)
   │
   ├─ Calculate points: 0 (no presence = no points)
   │
   ├─ Don't update player stats (no points)
   │
   └─ Log action (for tracking):
      INSERT INTO actions (
        action_id='sell_product',
        points_awarded=0,
        attributes={'price': 30, 'has_presence': false, ...}
      )

7. Response:
   {
     success: true,
     player_name: "Pedro Costa",
     points_awarded: 0,
     has_presence: false,
     price: 30.00
   }

8. Frontend:
   └─ Could show warning: "Pedro sold but didn't check in today"
```

## Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                      INFRASTRUCTURE                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Frontend:                                                   │
│  ├─ React 18                                                 │
│  ├─ TypeScript                                               │
│  ├─ Vite                                                     │
│  └─ Tailwind CSS                                             │
│                                                              │
│  Backend:                                                    │
│  ├─ Supabase (PostgreSQL 15)                                 │
│  ├─ Vercel Serverless Functions (Node.js)                    │
│  └─ N8N (Workflow Automation)                                │
│                                                              │
│  Hardware:                                                   │
│  ├─ Raspberry Pi (RFID Reader)                               │
│  └─ GCOM MySQL Database                                      │
│                                                              │
│  Hosting:                                                    │
│  ├─ Vercel (Frontend + API)                                  │
│  ├─ Self-hosted Supabase (fnp.centralsupernova.com.br)      │
│  └─ Self-hosted N8N                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Security

```
┌─────────────────────────────────────────────────────────────┐
│                         SECURITY LAYERS                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Supabase Studio Access                                   │
│     └─ Basic Auth (nginx): supabase / password              │
│                                                              │
│  2. Supabase API Access                                      │
│     ├─ ANON_KEY: Public read access (RLS policies)          │
│     └─ SERVICE_ROLE_KEY: Full access (server-side only)     │
│                                                              │
│  3. Vercel API Endpoints                                     │
│     └─ CORS enabled for N8N                                  │
│                                                              │
│  4. N8N Webhooks                                             │
│     └─ Unique webhook IDs (hard to guess)                    │
│                                                              │
│  5. Database (Row Level Security)                            │
│     ├─ Public: SELECT only                                   │
│     └─ Service role: Full access                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```
