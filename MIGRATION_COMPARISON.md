# 🔄 Funifier → Supabase Migration Comparison

## Quick Reference: What Changed

### Presença (Attendance) Flow

| Component | Funifier (Old) | Supabase (New) |
|-----------|----------------|----------------|
| **Webhook URL** | N8N → Funifier API | N8N → Vercel API → Supabase |
| **Player Lookup** | `POST /v3/database/player/aggregate` | `log_presenca()` function |
| **Action Log** | `POST /v3/action/log` with `actionId: "presenca"` | `log_presenca()` function |
| **Points** | 5 points (Funifier calculates) | 5 points (Supabase function calculates) |
| **Storage** | Funifier database | `daily_presence` + `actions` tables |

#### Old N8N Flow:
```
Webhook → Extract Fields → Find Player (Funifier) → Log Action (Funifier)
```

#### New N8N Flow:
```
Webhook → Extract Fields → Call Supabase API → Check Success
```

**Simpler!** One API call instead of two.

---

### GCOM Sales Flow

| Component | Funifier (Old) | Supabase (New) |
|-----------|----------------|----------------|
| **Trigger** | Every hour | Every hour (same) |
| **Query** | GCOM MySQL | GCOM MySQL (same) |
| **Player Lookup** | `GET /v3/player` | `log_sale()` function |
| **Action Log** | `POST /v3/action/log` with `actionId: "sell_product"` | `log_sale()` function |
| **Points Calculation** | Funifier rules engine | `log_sale()` function |
| **Presence Check** | Funifier rules | `has_presence_today()` function |
| **Storage** | Funifier database | `actions` table |

#### Old N8N Flow:
```
Schedule → Get Time Range → Query GCOM → Get All Players (Funifier) → Merge → Log Action (Funifier)
```

#### New N8N Flow:
```
Schedule → Get Time Range → Query GCOM → Call Supabase API → Check Success
```

**Much simpler!** No need to fetch all players first.

---

## API Comparison

### Presença

#### Old (Funifier):
```bash
# Step 1: Find player
POST https://service2.funifier.com/v3/database/player/aggregate
Authorization: Basic <credentials>
Body: [{"$match": {"extra.uid": "player_uid"}}]

# Step 2: Log action
POST https://service2.funifier.com/v3/action/log
Authorization: Basic <credentials>
Body: {
  "actionId": "presenca",
  "userId": "player_id_from_step1",
  "attributes": {"uid": "...", "hora": "..."}
}
```

#### New (Supabase):
```bash
# Single call
POST https://your-domain.vercel.app/api/presenca-webhook
Body: {
  "uid": "player_uid",
  "station": "station_1",
  "ts": 1234567890
}
```

---

### GCOM Sale

#### Old (Funifier):
```bash
# Step 1: Get all players
GET https://service2.funifier.com/v3/player
Authorization: Basic <credentials>

# Step 2: Log action for each sale
POST https://service2.funifier.com/v3/action/log
Authorization: Basic <credentials>
Body: {
  "actionId": "sell_product",
  "userId": "player_email",
  "attributes": {
    "delivery_title": "...",
    "price": 100
  }
}
```

#### New (Supabase):
```bash
# Single call per sale
POST https://your-domain.vercel.app/api/gcom-sale-webhook
Body: {
  "_id": "player@email.com",
  "delivery_title": "Product Name",
  "price": 100.50
}
```

---

## Database Comparison

### Funifier (Black Box)
- Unknown schema
- Unknown indexes
- Unknown performance
- No direct access
- No custom queries

### Supabase (Full Control)

#### Tables:
```sql
-- Players
players (id, player_code, name, extra->uid, ...)

-- Daily presence tracking
daily_presence (
  player_id,
  presence_date,
  uid,
  station,
  first_check_in,
  last_check_in,
  check_in_count,
  points_awarded
)

-- Action log
actions (
  action_id,  -- 'presenca' or 'sell_product'
  player_id,
  attributes, -- JSONB with details
  points_awarded,
  created_at
)
```

#### Functions:
- `log_presenca(uid, station, timestamp)` → JSON
- `log_sale(email, title, price, timestamp)` → JSON
- `has_presence_today(player_id, date)` → BOOLEAN
- `get_player_daily_stats(player_id, date)` → JSON
- `get_leaderboard_with_presence(date)` → TABLE

---

## Business Logic Comparison

### Points Calculation

#### Funifier:
- Configured in Funifier dashboard
- Rules engine (black box)
- Can't see the logic
- Can't debug easily

#### Supabase:
```sql
-- Presença: 5 points for first check-in
IF first_check_in_today THEN
  points := 5
ELSE
  points := 0
END IF

-- Sale: 0.1 × price, only with presence
IF has_presence_today(player_id, sale_date) THEN
  points := FLOOR(price * 0.1)
ELSE
  points := 0
END IF
```

**Transparent!** You can see and modify the logic.

---

## Benefits of New System

### ✅ Simpler
- Fewer API calls
- Fewer N8N nodes
- Easier to understand

### ✅ Faster
- Direct database access
- No external API latency
- Optimized queries

### ✅ More Control
- See all data
- Modify business logic
- Custom queries
- Better debugging

### ✅ More Reliable
- No external dependencies
- No Funifier downtime
- No API rate limits
- Full error handling

### ✅ More Transparent
- See all actions
- See all points calculations
- Audit trail
- Real-time monitoring

### ✅ Cheaper
- No Funifier subscription
- Only Supabase + Vercel costs
- Scales better

---

## Migration Checklist

- [x] Create Supabase tables and functions
- [x] Create Vercel API endpoints
- [x] Create new N8N workflows
- [ ] Update player data with UIDs
- [ ] Test Presença flow
- [ ] Test GCOM flow
- [ ] Update Raspberry Pi webhook URL
- [ ] Activate N8N workflows
- [ ] Monitor for 24 hours
- [ ] Deactivate old Funifier workflows
- [ ] Cancel Funifier subscription

---

## Rollback Plan

If something goes wrong:

1. **Keep old N8N workflows** (deactivated, don't delete)
2. **Keep Funifier credentials** (don't delete)
3. **To rollback**: Reactivate old workflows, deactivate new ones
4. **Data**: Both systems can run in parallel during testing

---

## Support

**Supabase Dashboard**: https://fnp.centralsupernova.com.br  
**Vercel Dashboard**: https://vercel.com/your-project  
**N8N Dashboard**: Your N8N URL

**Logs**:
- Supabase: Dashboard → Logs
- Vercel: Project → Logs
- N8N: Workflow → Executions

**Database Access**:
```bash
# Direct PostgreSQL access
psql -h 127.0.0.1 -p 5436 -U postgres
```
