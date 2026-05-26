# N8N Workflows Deployment Guide

## Overview
This guide covers deploying the Supabase-based n8n workflows for GCOM sales and presence tracking.

## Prerequisites
- Supabase instance running at `https://fnp.centralsupernova.com.br`
- Vercel deployment at `https://vercel.com/game4u/fnp-ranking`
- N8N instance with MySQL credentials configured
- Environment variable `VERCEL_API_URL` set in n8n

## Step 1: Deploy Supabase Functions

### 1.1 Deploy the Store Sales Function
The `log_store_sale` function awards points to ALL players who had presence today.

1. Open Supabase Studio: https://fnp.centralsupernova.com.br
2. Go to SQL Editor
3. Copy and paste the contents of `SUPABASE_STORE_SALES_FUNCTION.sql`
4. Click "Run"
5. Verify success message

**What this function does:**
- Takes only sale data (delivery_title, price)
- Finds ALL players with presence today
- Awards 0.1 * price points to EACH player
- Logs the action for each player
- Returns summary with players_awarded and total_points_awarded

### 1.2 Verify the Function
Run this test query in Supabase SQL Editor:
```sql
SELECT log_store_sale('TEST SALE', 100.00);
```

Expected result:
```json
{
  "success": true,
  "message": "Store sale logged and points awarded to all players with presence",
  "sale_date": "2024-01-20",
  "delivery_title": "TEST SALE",
  "price": 100.00,
  "points_per_player": 10,
  "players_awarded": 5,
  "total_points_awarded": 50
}
```

## Step 2: Deploy GCOM Sales Workflow

### 2.1 Understanding the Business Logic
**CRITICAL**: GCOM sales are store-wide, NOT per-employee:
- MySQL table `g4u_actions_v` contains only sale data (delivery_title, price, timestamps)
- There is NO player identifier in GCOM data
- ALL players who had presence that day should get points from ALL sales that day
- The old Funifier workflow sent every sale to every player and let Funifier filter by presence
- With Supabase, we do this properly server-side via the `log_store_sale` function

### 2.2 Import the Workflow
1. Open n8n
2. Go to Workflows
3. Click "Import from File"
4. Select `n8n-workflows/gcom-sales-supabase-fixed.json`
5. Click "Import"

### 2.3 Workflow Structure
```
Schedule Trigger (hourly)
  ↓
Calculate Last Hour (sets horaAnterior variable)
  ↓
Fetch New Sales from GCOM (MySQL query)
  ↓
Split Sales (process one at a time)
  ↓
Call Vercel Webhook (POST to /api/gcom-sale-webhook)
  ↓
Check Success
  ↓
Log Success / Log Error
```

### 2.4 Key Changes from Old Workflow
**REMOVED:**
- ❌ HTTP Request to Funifier API (fetch all players)
- ❌ Split Out node (split players)
- ❌ Merge node (Cartesian product of sales × players)
- ❌ `ID_EMP_GCOM` field (doesn't exist in GCOM data)

**SIMPLIFIED:**
- ✅ Fetch only sale data (delivery_title, price)
- ✅ Send each sale once to webhook
- ✅ Webhook calls `log_store_sale` which handles player distribution
- ✅ No player merging needed

### 2.5 MySQL Query
The workflow fetches sales from the last hour:
```sql
SELECT 
  delivery_title,
  price
FROM
  g4u_actions_v
WHERE
  created_at > "{{ $json.horaAnterior }}"
ORDER BY
  created_at DESC
```

**Note:** No `ID_EMP_GCOM` field because it doesn't exist in GCOM data.

### 2.6 Webhook Payload
Each sale is sent to the Vercel webhook with this payload:
```json
{
  "delivery_title": "FNP CLASSICO - JESSY KELLY",
  "price": 64.00
}
```

### 2.7 Configure Environment Variables
In n8n, set the environment variable:
- `VERCEL_API_URL`: Your Vercel deployment URL (e.g., `https://fnp-ranking.vercel.app`)

### 2.8 Test the Workflow
1. Click "Execute Workflow" in n8n
2. Check the execution log
3. Verify sales were fetched from MySQL
4. Verify webhook calls succeeded
5. Check Supabase `actions` table for new entries
6. Check `player_stats` table for updated points

### 2.9 Activate the Workflow
1. Toggle "Active" switch in n8n
2. Workflow will now run every hour automatically

## Step 3: Deploy Presence Workflow

### 3.1 Import the Workflow
1. Open n8n
2. Go to Workflows
3. Click "Import from File"
4. Select `n8n-workflows/presenca-supabase.json`
5. Click "Import"

### 3.2 Workflow Structure
```
Webhook Trigger (POST /presenca-webhook)
  ↓
Call Vercel API (POST to /api/presenca-webhook)
  ↓
Check Success
  ↓
Success Response / Error Response
```

### 3.3 Configure the Webhook
1. Copy the webhook URL from n8n (e.g., `https://your-n8n.com/webhook/presenca-webhook`)
2. Configure your presence system to POST to this URL
3. Expected payload format:
```json
{
  "player_code": "12345",
  "timestamp": "2024-01-20T10:30:00Z"
}
```

### 3.4 Test the Workflow
Use curl or Postman to test:
```bash
curl -X POST https://your-n8n.com/webhook/presenca-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "player_code": "12345",
    "timestamp": "2024-01-20T10:30:00Z"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Presence logged successfully",
  "points": 10
}
```

### 3.5 Activate the Workflow
1. Toggle "Active" switch in n8n
2. Webhook is now live and ready to receive presence events

## Step 4: Monitoring and Troubleshooting

### 4.1 Check Workflow Executions
1. Go to n8n Executions tab
2. Filter by workflow name
3. Check for errors or failed executions

### 4.2 Common Issues

#### Issue: "Unknown column 'ID_EMP_GCOM'"
**Cause:** Old workflow trying to fetch player identifier from GCOM data
**Solution:** Use the updated workflow that only fetches `delivery_title` and `price`

#### Issue: "No players with presence today"
**Cause:** No presence records in Supabase for today
**Solution:** This is expected if no one has checked in yet. Points will be awarded once presence is logged.

#### Issue: Webhook timeout
**Cause:** Supabase function taking too long
**Solution:** Check Supabase logs, verify database indexes are created

#### Issue: "Missing required fields"
**Cause:** Webhook payload doesn't match expected format
**Solution:** Verify payload has `delivery_title` and `price` fields

### 4.3 Verify Data in Supabase
Check that data is being written correctly:

```sql
-- Check recent actions
SELECT * FROM actions 
WHERE action_id = 'sell_product' 
ORDER BY created_at DESC 
LIMIT 10;

-- Check player stats
SELECT p.name, ps.total_points 
FROM player_stats ps
JOIN players p ON ps.player_id = p.id
ORDER BY ps.total_points DESC
LIMIT 10;

-- Check presence records
SELECT p.name, pr.timestamp
FROM presence pr
JOIN players p ON pr.player_id = p.id
WHERE DATE(pr.timestamp AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE
ORDER BY pr.timestamp DESC;
```

## Step 5: Rollback Plan

If you need to rollback to the old Funifier-based workflow:

1. Deactivate the new workflows in n8n
2. Reactivate the old Funifier workflows
3. Update Vercel environment variables to use Funifier API keys
4. Redeploy Vercel with old code

## Summary

✅ **GCOM Sales Workflow:**
- Fetches sales from MySQL (delivery_title, price only)
- Sends each sale to Vercel webhook
- Webhook calls `log_store_sale` function
- Function awards points to ALL players with presence today
- No player merging needed (done server-side)

✅ **Presence Workflow:**
- Receives presence events via webhook
- Forwards to Vercel API
- Logs presence in Supabase
- Returns success/error response

✅ **Key Difference from Old System:**
- Old: Sent every sale to every player, Funifier filtered by presence
- New: Send sale once, Supabase function distributes to players with presence
- More efficient, more control, proper server-side logic
