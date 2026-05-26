# 🎯 Actions Setup Guide - Presença & GCOM Integration

This guide explains how to set up the complete flow for Presença (attendance) and GCOM sales tracking with Supabase.

## 📋 Overview

### Business Logic
1. **Presença (Attendance)**: 
   - Raspberry Pi sends UID to webhook
   - First check-in of the day awards **5 points**
   - Subsequent check-ins are logged but don't award points
   
2. **GCOM Sales**:
   - Every hour, query GCOM for new sales
   - Award **0.1 × sale price** in points
   - **Only if** the player registered presence that day
   - If no presence, sale is logged but no points awarded

### Architecture
```
Raspberry Pi → N8N → Vercel API → Supabase Functions → Database
GCOM MySQL → N8N → Vercel API → Supabase Functions → Database
```

## 🚀 Step-by-Step Setup

### Step 1: Run SQL Functions (5 minutes)

1. Open Supabase Studio: https://fnp.centralsupernova.com.br
2. Go to **SQL Editor** → **New Query**
3. Copy and paste **`SUPABASE_ACTIONS_FUNCTIONS.sql`**
4. Click **Run**

This creates:
- ✅ `actions` table (action log)
- ✅ `daily_presence` table (attendance tracking)
- ✅ `log_presenca()` function
- ✅ `log_sale()` function
- ✅ `has_presence_today()` function
- ✅ `get_player_daily_stats()` function
- ✅ `get_leaderboard_with_presence()` function

### Step 2: Deploy API Endpoints (10 minutes)

Your Vercel project needs these new endpoints:

#### Files to deploy:
- `api/presenca-webhook.ts` - Handles attendance from Raspberry Pi
- `api/gcom-sale-webhook.ts` - Handles sales from GCOM

#### Deploy to Vercel:

```bash
# If not already deployed
vercel

# Or if already deployed
vercel --prod
```

#### Verify endpoints are live:
- `https://your-domain.vercel.app/api/presenca-webhook`
- `https://your-domain.vercel.app/api/gcom-sale-webhook`

### Step 3: Configure N8N Workflows (15 minutes)

#### A. Import Presença Workflow

1. Open N8N
2. Click **Workflows** → **Import from File**
3. Select `n8n-workflows/presenca-supabase.json`
4. Update the **Call Supabase API** node:
   - Change URL to: `https://your-domain.vercel.app/api/presenca-webhook`
5. **Activate** the workflow

#### B. Import GCOM Sales Workflow

1. Click **Workflows** → **Import from File**
2. Select `n8n-workflows/gcom-sales-supabase.json`
3. Update the **Query GCOM Sales** node:
   - Add your MySQL credentials
   - Verify the query matches your GCOM database schema
4. Update the **Call Supabase API** node:
   - Change URL to: `https://your-domain.vercel.app/api/gcom-sale-webhook`
5. **Activate** the workflow

#### C. Update Raspberry Pi Configuration

Update your Raspberry Pi to send to the new N8N webhook:

**Old URL**: `https://your-n8n.com/webhook/funifier-presenca`  
**New URL**: `https://your-n8n.com/webhook/presenca-webhook`

The payload format stays the same:
```json
{
  "uid": "player_uid_from_rfid",
  "station": "station_1",
  "ts": 1234567890
}
```

### Step 4: Migrate Player Data (10 minutes)

Players need the `uid` field in their `extra` JSONB column:

```sql
-- Example: Update player with UID
UPDATE players
SET extra = jsonb_set(
  COALESCE(extra, '{}'::jsonb),
  '{uid}',
  '"player_uid_here"'::jsonb
)
WHERE player_code = 'player@email.com';

-- Bulk update from existing data
-- (Adjust based on where you currently store UIDs)
```

## 🧪 Testing

### Test Presença Endpoint

```bash
curl -X POST https://your-domain.vercel.app/api/presenca-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "test_uid_123",
    "station": "station_1",
    "ts": 1234567890
  }'
```

Expected response:
```json
{
  "success": true,
  "player_id": "uuid-here",
  "player_name": "Player Name",
  "action_id": "action-uuid",
  "points_awarded": 5,
  "is_first_today": true,
  "presence_date": "2026-05-22",
  "check_in_count": 1
}
```

### Test GCOM Sale Endpoint

```bash
curl -X POST https://your-domain.vercel.app/api/gcom-sale-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "_id": "player@email.com",
    "delivery_title": "Test Product",
    "price": 100.50
  }'
```

Expected response (with presence):
```json
{
  "success": true,
  "player_id": "uuid-here",
  "player_name": "Player Name",
  "action_id": "action-uuid",
  "points_awarded": 10,
  "has_presence": true,
  "sale_date": "2026-05-22",
  "price": 100.50
}
```

Expected response (without presence):
```json
{
  "success": true,
  "player_id": "uuid-here",
  "player_name": "Player Name",
  "action_id": "action-uuid",
  "points_awarded": 0,
  "has_presence": false,
  "sale_date": "2026-05-22",
  "price": 100.50
}
```

## 📊 Monitoring & Queries

### Check today's presence

```sql
SELECT 
  p.name,
  dp.first_check_in,
  dp.check_in_count,
  dp.points_awarded
FROM daily_presence dp
JOIN players p ON dp.player_id = p.id
WHERE dp.presence_date = CURRENT_DATE
ORDER BY dp.first_check_in;
```

### Check today's sales

```sql
SELECT 
  p.name,
  a.attributes->>'delivery_title' as product,
  (a.attributes->>'price')::numeric as price,
  a.points_awarded,
  a.attributes->>'has_presence' as had_presence,
  a.created_at
FROM actions a
JOIN players p ON a.player_id = p.id
WHERE a.action_id = 'sell_product'
  AND DATE(a.created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE
ORDER BY a.created_at DESC;
```

### Get player daily stats

```sql
SELECT get_player_daily_stats('player-uuid-here', CURRENT_DATE);
```

### Get leaderboard with presence info

```sql
SELECT * FROM get_leaderboard_with_presence(CURRENT_DATE);
```

## 🔧 Troubleshooting

### Player not found by UID

**Problem**: `{"success": false, "error": "Player not found"}`

**Solution**: Make sure the player has the UID in their `extra` field:

```sql
SELECT id, name, extra->>'uid' as uid
FROM players
WHERE extra->>'uid' = 'the_uid_from_error';
```

If empty, update:

```sql
UPDATE players
SET extra = jsonb_set(
  COALESCE(extra, '{}'::jsonb),
  '{uid}',
  '"correct_uid_here"'::jsonb
)
WHERE id = 'player-uuid';
```

### Player not found by email

**Problem**: Sale webhook returns player not found

**Solution**: Check the `player_code` field matches the email from GCOM:

```sql
SELECT id, name, player_code
FROM players
WHERE player_code = 'email@from.gcom';
```

### No points awarded for sale

**Problem**: Sale logged but `points_awarded: 0`

**Solution**: Check if player has presence today:

```sql
SELECT has_presence_today('player-uuid', CURRENT_DATE);
```

If false, player needs to register presence first.

### N8N workflow not triggering

**Problem**: Raspberry Pi sends data but nothing happens

**Solution**:
1. Check N8N workflow is **activated**
2. Check webhook URL is correct
3. Check N8N logs for errors
4. Test webhook directly with curl

## 📈 Next Steps

1. **Update Leaderboard Display**: Modify frontend to show presence status
2. **Add Presence Indicator**: Show who checked in today
3. **Sales Dashboard**: Show sales with/without presence
4. **Daily Reports**: Email daily summary of presence and sales
5. **Alerts**: Notify when sales happen without presence

## 🎉 You're Done!

Your system now:
- ✅ Tracks attendance from Raspberry Pi
- ✅ Awards 5 points for first daily check-in
- ✅ Tracks sales from GCOM
- ✅ Awards 0.1 × price for sales (only with presence)
- ✅ Logs all actions for reporting
- ✅ Real-time updates via Supabase subscriptions

---

**Need help?** Check the logs:
- Vercel: https://vercel.com/your-project/logs
- N8N: Workflow → Executions
- Supabase: Dashboard → Logs
