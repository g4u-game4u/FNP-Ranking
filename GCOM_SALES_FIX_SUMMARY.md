# GCOM Sales Workflow Fix Summary

## Problem Identified

The n8n workflow was trying to fetch `ID_EMP_GCOM` as a player identifier from the MySQL `g4u_actions_v` table, but this field **does not exist** in GCOM sales data.

### Error Message
```
Unknown column 'ID_EMP_GCOM' in 'field list'
```

## Root Cause Analysis

### Business Logic Clarification
After reviewing the old Funifier workflow and discussing with the user, we discovered:

1. **GCOM sales are store-wide, NOT per-employee**
2. **There is NO player information in GCOM data**
3. The MySQL table `g4u_actions_v` contains only:
   - `delivery_id`
   - `delivery_title`
   - `created_at`
   - `finished_at`
   - `integration_id`
   - `price`
   - NO player identifier fields

### Old Funifier Workflow Approach
The old workflow worked around this limitation by:
1. Fetching ALL players from Funifier API
2. Fetching ALL sales from MySQL
3. Creating a Cartesian product (every sale × every player)
4. Sending every sale to every player
5. Letting Funifier filter by presence server-side

This was inefficient but necessary because Funifier didn't give us control over the logic.

## Solution Implemented

### New Supabase Approach
With Supabase, we have full control and can implement proper server-side logic:

1. **Created `log_store_sale` function** in Supabase that:
   - Takes only sale data (delivery_title, price)
   - Queries for ALL players with presence today
   - Awards points to each player (0.1 * price)
   - Logs action for each player
   - Returns summary with players_awarded and total_points_awarded

2. **Simplified n8n workflow** to:
   - Fetch only sale data from MySQL (no player fields)
   - Send each sale once to the webhook
   - Let Supabase function handle player distribution

### Files Modified

#### 1. `n8n-workflows/gcom-sales-supabase-fixed.json`
**Changes:**
- ❌ Removed `ID_EMP_GCOM as player_code` from MySQL query
- ❌ Removed `AND ID_EMP_GCOM IS NOT NULL` filter
- ✅ Query now fetches only `delivery_title` and `price`
- ✅ Webhook payload simplified to `{ delivery_title, price }`
- ✅ Updated logging to show `players_awarded` and `total_points_awarded`

**Before:**
```sql
SELECT 
  ID_EMP_GCOM as player_code,  -- ❌ This field doesn't exist!
  delivery_title,
  created_at,
  finished_at,
  price
FROM g4u_actions_v
WHERE created_at > "{{ $json.horaAnterior }}"
  AND ID_EMP_GCOM IS NOT NULL  -- ❌ This filter fails!
```

**After:**
```sql
SELECT 
  delivery_title,
  price
FROM g4u_actions_v
WHERE created_at > "{{ $json.horaAnterior }}"
ORDER BY created_at DESC
```

#### 2. `api/gcom-sale-webhook.ts`
**Already updated** to call `log_store_sale` function:
- Accepts `{ delivery_title, price }` payload
- Calls Supabase RPC `log_store_sale`
- Returns summary with players_awarded and total_points_awarded

#### 3. `SUPABASE_STORE_SALES_FUNCTION.sql`
**Already created** - needs to be deployed to Supabase:
- Function: `log_store_sale(p_delivery_title, p_price, p_sale_timestamp)`
- Finds players with presence today
- Awards points to each player
- Logs actions
- Returns JSON summary

## Deployment Steps

### 1. Deploy Supabase Function
```sql
-- Run this in Supabase SQL Editor
-- Copy contents from SUPABASE_STORE_SALES_FUNCTION.sql
```

### 2. Update n8n Workflow
1. Import `n8n-workflows/gcom-sales-supabase-fixed.json`
2. Configure MySQL credentials
3. Set `VERCEL_API_URL` environment variable
4. Test execution
5. Activate workflow

### 3. Verify Deployment
```sql
-- Test the function
SELECT log_store_sale('TEST SALE', 100.00);

-- Check recent actions
SELECT * FROM actions 
WHERE action_id = 'sell_product' 
ORDER BY created_at DESC 
LIMIT 10;
```

## Testing

### Test Case 1: Sale with Players Present
**Setup:**
- 3 players have presence today
- Sale: "FNP CLASSICO", price: 60.00

**Expected Result:**
```json
{
  "success": true,
  "message": "Store sale logged and points awarded to all players with presence",
  "delivery_title": "FNP CLASSICO",
  "price": 60.00,
  "points_per_player": 6,
  "players_awarded": 3,
  "total_points_awarded": 18
}
```

### Test Case 2: Sale with No Players Present
**Setup:**
- 0 players have presence today
- Sale: "FNP CLASSICO", price: 60.00

**Expected Result:**
```json
{
  "success": true,
  "message": "Sale logged but no players with presence today",
  "delivery_title": "FNP CLASSICO",
  "price": 60.00,
  "points_per_player": 6,
  "players_awarded": 0,
  "total_points_awarded": 0
}
```

## Benefits of New Approach

### 1. Correctness
✅ No more "Unknown column" errors
✅ Proper handling of store-wide sales
✅ Server-side presence filtering

### 2. Efficiency
✅ Send each sale once (not once per player)
✅ No Cartesian product in n8n
✅ Batch processing in Supabase function

### 3. Maintainability
✅ Clear separation of concerns
✅ Business logic in database function
✅ n8n workflow is simple and focused

### 4. Observability
✅ Function returns detailed summary
✅ Easy to see how many players were awarded
✅ Total points awarded per sale

## Comparison: Old vs New

| Aspect | Old (Funifier) | New (Supabase) |
|--------|----------------|----------------|
| **Player Fetch** | Fetch all from Funifier API | Query presence table |
| **Sales Fetch** | Fetch from MySQL | Fetch from MySQL |
| **Merging** | Cartesian product in n8n | Server-side in function |
| **API Calls** | N × M (sales × players) | N (sales only) |
| **Filtering** | Funifier server-side | Supabase function |
| **Control** | Limited (Funifier black box) | Full (we own the logic) |
| **Efficiency** | Low (many redundant calls) | High (batch processing) |

## Next Steps

1. ✅ Deploy `log_store_sale` function to Supabase
2. ✅ Import updated n8n workflow
3. ✅ Test with manual execution
4. ✅ Activate workflow for hourly runs
5. ✅ Monitor executions for 24 hours
6. ✅ Verify data in Supabase tables

## Rollback Plan

If issues arise:
1. Deactivate new workflow
2. Reactivate old Funifier workflow
3. Update Vercel to use Funifier API
4. Investigate and fix issues
5. Redeploy when ready

## Documentation

- **Deployment Guide**: `N8N_DEPLOYMENT_GUIDE.md`
- **Supabase Function**: `SUPABASE_STORE_SALES_FUNCTION.sql`
- **API Endpoint**: `api/gcom-sale-webhook.ts`
- **N8N Workflow**: `n8n-workflows/gcom-sales-supabase-fixed.json`
