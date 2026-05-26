# GCOM Sales Flow Diagram

## Old Funifier Workflow (Inefficient)

```
┌─────────────────────────────────────────────────────────────────┐
│                         N8N WORKFLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐                                              │
│  │   Schedule   │  Every hour                                  │
│  │   Trigger    │                                              │
│  └──────┬───────┘                                              │
│         │                                                       │
│         ├──────────────┬────────────────┐                      │
│         │              │                │                      │
│         ▼              ▼                │                      │
│  ┌──────────┐   ┌──────────┐           │                      │
│  │  Fetch   │   │  Fetch   │           │                      │
│  │  Sales   │   │  Players │           │                      │
│  │  (MySQL) │   │(Funifier)│           │                      │
│  └────┬─────┘   └────┬─────┘           │                      │
│       │              │                 │                      │
│       │  10 sales    │  50 players     │                      │
│       │              │                 │                      │
│       └──────┬───────┘                 │                      │
│              │                         │                      │
│              ▼                         │                      │
│       ┌─────────────┐                  │                      │
│       │   MERGE     │                  │                      │
│       │ (Cartesian) │                  │                      │
│       │ 10 × 50 =   │                  │                      │
│       │ 500 items!  │                  │                      │
│       └──────┬──────┘                  │                      │
│              │                         │                      │
│              ▼                         │                      │
│       ┌─────────────┐                  │                      │
│       │   Split     │                  │                      │
│       │   (Loop)    │                  │                      │
│       └──────┬──────┘                  │                      │
│              │                         │                      │
│              ▼                         │                      │
│       ┌─────────────┐                  │                      │
│       │  Send to    │  500 API calls!  │                      │
│       │  Funifier   │◄─────────────────┘                      │
│       │  (1 by 1)   │                                         │
│       └─────────────┘                                         │
│                                                               │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │    FUNIFIER      │
                    │  (Black Box)     │
                    │                  │
                    │  Filters by      │
                    │  presence        │
                    │  server-side     │
                    └──────────────────┘
```

**Problems:**
- ❌ 500 API calls for 10 sales × 50 players
- ❌ Inefficient Cartesian product in n8n
- ❌ No control over filtering logic
- ❌ Slow execution (500 sequential calls)
- ❌ High API usage costs

---

## New Supabase Workflow (Efficient)

```
┌─────────────────────────────────────────────────────────────────┐
│                         N8N WORKFLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐                                              │
│  │   Schedule   │  Every hour                                  │
│  │   Trigger    │                                              │
│  └──────┬───────┘                                              │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐                                              │
│  │  Calculate   │                                              │
│  │  Last Hour   │                                              │
│  └──────┬───────┘                                              │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐                                              │
│  │  Fetch Sales │                                              │
│  │   (MySQL)    │  SELECT delivery_title, price               │
│  │              │  FROM g4u_actions_v                          │
│  │              │  WHERE created_at > last_hour                │
│  └──────┬───────┘                                              │
│         │                                                       │
│         │  10 sales                                            │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐                                              │
│  │ Split Sales  │                                              │
│  │   (Loop)     │                                              │
│  └──────┬───────┘                                              │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐                                              │
│  │ Call Vercel  │  10 API calls only!                          │
│  │   Webhook    │  { delivery_title, price }                  │
│  └──────┬───────┘                                              │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐                                              │
│  │Check Success │                                              │
│  └──────┬───────┘                                              │
│         │                                                       │
│         ├─────────┬─────────┐                                  │
│         ▼         ▼         ▼                                  │
│  ┌──────────┐ ┌──────────┐                                    │
│  │   Log    │ │   Log    │                                    │
│  │ Success  │ │  Error   │                                    │
│  └──────────┘ └──────────┘                                    │
│                                                               │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  VERCEL WEBHOOK  │
                    │                  │
                    │  /api/gcom-sale- │
                    │     webhook      │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │    SUPABASE      │
                    │   RPC FUNCTION   │
                    │                  │
                    │ log_store_sale() │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Query Presence  │
                    │                  │
                    │  SELECT players  │
                    │  WHERE presence  │
                    │  = today         │
                    └────────┬─────────┘
                             │
                             │  Found: 5 players
                             │
                             ▼
                    ┌──────────────────┐
                    │  Award Points    │
                    │                  │
                    │  FOREACH player: │
                    │  - Update stats  │
                    │  - Log action    │
                    │  - Add points    │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Return Summary  │
                    │                  │
                    │  {               │
                    │   players: 5,    │
                    │   points: 50     │
                    │  }               │
                    └──────────────────┘
```

**Benefits:**
- ✅ 10 API calls for 10 sales (50x reduction!)
- ✅ No Cartesian product needed
- ✅ Full control over filtering logic
- ✅ Fast execution (parallel processing)
- ✅ Efficient batch operations in SQL

---

## Data Flow Comparison

### Old Funifier Approach
```
MySQL (10 sales) ──┐
                   ├──► Merge (500 items) ──► 500 API calls ──► Funifier
Funifier (50 players) ─┘                                         (filters)
```

### New Supabase Approach
```
MySQL (10 sales) ──► 10 API calls ──► Supabase Function ──► Query Presence
                                                          ──► Award Points
                                                          ──► Log Actions
```

---

## Example: Processing 1 Sale

### Old Funifier (50 API calls)
```
Sale: "FNP CLASSICO", Price: 60

N8N sends 50 times:
  POST /funifier/action/log
  {
    "actionId": "sell_product",
    "userId": "player_1",
    "attributes": { "delivery_title": "FNP CLASSICO", "price": 60 }
  }
  
  POST /funifier/action/log
  {
    "actionId": "sell_product",
    "userId": "player_2",
    "attributes": { "delivery_title": "FNP CLASSICO", "price": 60 }
  }
  
  ... (48 more times)

Funifier filters server-side:
  - player_1: has presence ✅ → award 6 points
  - player_2: no presence ❌ → skip
  - player_3: has presence ✅ → award 6 points
  ... etc
```

### New Supabase (1 API call)
```
Sale: "FNP CLASSICO", Price: 60

N8N sends once:
  POST /api/gcom-sale-webhook
  {
    "delivery_title": "FNP CLASSICO",
    "price": 60
  }

Supabase function:
  1. Query: SELECT players WHERE presence = today
     Result: [player_1, player_3, player_5]
  
  2. Calculate: points = 60 * 0.1 = 6 per player
  
  3. Award points:
     - player_1: +6 points, log action
     - player_3: +6 points, log action
     - player_5: +6 points, log action
  
  4. Return: {
       "players_awarded": 3,
       "total_points_awarded": 18,
       "points_per_player": 6
     }
```

---

## Performance Metrics

| Metric | Old (Funifier) | New (Supabase) | Improvement |
|--------|----------------|----------------|-------------|
| **API Calls** | 500 | 10 | 50x fewer |
| **Execution Time** | ~5 minutes | ~30 seconds | 10x faster |
| **Network Traffic** | High | Low | 50x reduction |
| **Control** | None | Full | ∞ |
| **Debugging** | Hard | Easy | Much better |
| **Scalability** | Poor | Excellent | Much better |

---

## Key Insight

**The fundamental difference:**

**Old:** "Send everything to everyone, let the server filter"
- Wasteful but necessary (no control over Funifier)

**New:** "Query who needs it, send only to them"
- Efficient and proper (full control with Supabase)

This is the power of owning your infrastructure! 🚀
