# N8N Workflows for FNP Ranking

This directory contains n8n workflow JSON files that integrate with the Supabase backend.

## Workflows

### 1. Presença Webhook → Supabase (`presenca-supabase.json`)

**Purpose**: Handles RFID attendance check-ins from Raspberry Pi devices.

**Flow**:
1. Receives webhook POST from Raspberry Pi with UID
2. Calls Vercel API endpoint `/api/presenca-webhook`
3. Vercel calls Supabase `log_presenca()` function
4. Returns success/error response

**Webhook URL**: `https://your-n8n-domain.com/webhook/presenca-webhook`

**Expected Payload**:
```json
{
  "uid": "employee_rfid_uid",
  "station": "station_name",
  "ts": 1234567890
}
```

**Response**:
```json
{
  "success": true,
  "message": "Check-in logged successfully",
  "points_awarded": 5
}
```

### 2. GCOM Sales → Supabase (`gcom-sales-supabase.json`)

**Purpose**: Syncs sales data from GCOM MySQL database to Supabase hourly.

**Flow**:
1. Runs every hour (scheduled trigger)
2. Queries GCOM MySQL for new sales (last hour, unprocessed)
3. For each sale, calls Vercel API endpoint `/api/gcom-sale-webhook`
4. Vercel calls Supabase `log_sale()` function
5. Marks sale as processed in GCOM database

**Schedule**: Every 1 hour

**GCOM Query**:
```sql
SELECT _id, delivery_title, price, created_at 
FROM sales 
WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR) 
AND processed = 0
```

## Installation

### Step 1: Import Workflows

1. Open your n8n instance
2. Click **Workflows** → **Import from File**
3. Select `presenca-supabase.json`
4. Click **Import**
5. Repeat for `gcom-sales-supabase.json`

### Step 2: Configure Environment Variables

Add these environment variables to your n8n instance:

```env
VERCEL_API_URL=https://your-domain.vercel.app
```

**How to add**:
1. Go to **Settings** → **Environments**
2. Add `VERCEL_API_URL` with your Vercel deployment URL
3. Save

### Step 3: Configure MySQL Credentials (GCOM Sales only)

1. Go to **Credentials** → **Add Credential**
2. Select **MySQL**
3. Name it: `GCOM MySQL`
4. Fill in:
   - **Host**: Your GCOM MySQL host
   - **Database**: Your GCOM database name
   - **User**: MySQL username
   - **Password**: MySQL password
   - **Port**: 3306 (default)
5. Click **Save**

### Step 4: Update Raspberry Pi Webhook URL

Update your Raspberry Pi configuration to point to the new n8n webhook:

**Old URL** (if using Funifier):
```
https://your-n8n.com/webhook/old-funifier-webhook
```

**New URL**:
```
https://your-n8n.com/webhook/presenca-webhook
```

### Step 5: Activate Workflows

1. Open each workflow
2. Click the **Active** toggle in the top right
3. Verify the workflow is active (toggle should be green)

## Testing

### Test Presença Webhook

```bash
curl -X POST https://your-n8n.com/webhook/presenca-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "test_uid_123",
    "station": "test_station",
    "ts": 1234567890
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Check-in logged successfully",
  "points_awarded": 5
}
```

### Test GCOM Sales Workflow

1. Go to the workflow in n8n
2. Click **Execute Workflow** button
3. Check the execution log for results
4. Verify sales were processed in Supabase

Or manually trigger with test data:

```bash
curl -X POST https://your-domain.vercel.app/api/gcom-sale-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "_id": "test@test.com",
    "delivery_title": "Test Product",
    "price": 100,
    "created_at": "2024-01-20T10:00:00Z"
  }'
```

## Monitoring

### View Execution Logs

1. Go to **Executions** in n8n
2. Click on any execution to see details
3. Check each node's input/output
4. Look for errors in red nodes

### Common Issues

#### Issue: "Cannot connect to Vercel API"

**Solution**:
- Verify `VERCEL_API_URL` environment variable is set correctly
- Check Vercel API endpoints are deployed
- Test endpoints directly with curl

#### Issue: "MySQL connection failed" (GCOM Sales)

**Solution**:
- Verify MySQL credentials are correct
- Check MySQL host is accessible from n8n
- Verify database and table names are correct

#### Issue: "Player not found by UID"

**Solution**:
- Update player's `extra` field in Supabase with correct UID:
```sql
UPDATE players
SET extra = jsonb_set(
  COALESCE(extra, '{}'::jsonb),
  '{uid}',
  '"correct_uid_here"'::jsonb
)
WHERE player_code = 'player@email.com';
```

#### Issue: "Sale logged but no points awarded"

**Reason**: Player didn't check in today (expected behavior)

**Solution**: This is correct! Points are only awarded if player has presence on the same day.

## Workflow Details

### Presença Workflow Nodes

1. **Webhook Trigger** - Receives POST requests
2. **Call Vercel API** - Forwards to Vercel serverless function
3. **Check Success** - Validates API response
4. **Success Response** - Returns success to Raspberry Pi
5. **Error Response** - Returns error to Raspberry Pi

### GCOM Sales Workflow Nodes

1. **Schedule Trigger** - Runs every hour
2. **Fetch New Sales from GCOM** - Queries MySQL for unprocessed sales
3. **Split Sales** - Processes sales one by one
4. **Call Vercel API** - Sends sale data to Vercel
5. **Check Success** - Validates API response
6. **Mark as Processed** - Updates GCOM database (success)
7. **Mark as Error** - Updates GCOM database (error)

## Comparison with Old Funifier Workflows

### Presença

**Old (Funifier)**:
- 4 nodes
- Called Funifier API directly
- Complex authentication
- Rate limits

**New (Supabase)**:
- 5 nodes
- Calls Vercel → Supabase
- Simple authentication
- No rate limits
- More reliable

### GCOM Sales

**Old (Funifier)**:
- 7 nodes
- Called Funifier API directly
- N+1 queries (fetch players + log each)
- Complex error handling

**New (Supabase)**:
- 7 nodes
- Calls Vercel → Supabase
- Single query per sale
- Cleaner error handling
- Better performance

## Maintenance

### Update Vercel API URL

If you change your Vercel deployment URL:

1. Update `VERCEL_API_URL` environment variable
2. Workflows will automatically use new URL
3. No need to edit workflows

### Update MySQL Credentials

If GCOM MySQL credentials change:

1. Go to **Credentials** → **GCOM MySQL**
2. Update credentials
3. Click **Save**
4. Workflows will automatically use new credentials

### Disable Workflows

To temporarily disable a workflow:

1. Open the workflow
2. Click the **Active** toggle to turn it off
3. Workflow will stop processing

## Support

For issues:

1. Check n8n execution logs
2. Check Vercel function logs
3. Check Supabase database logs
4. Review `ACTIONS_SETUP_GUIDE.md` for setup help
5. Review `COMPLETE_MIGRATION_SUMMARY.md` for troubleshooting

## Next Steps

After importing and activating these workflows:

1. ✅ Test presença webhook with curl
2. ✅ Test GCOM sales workflow manually
3. ✅ Update Raspberry Pi webhook URL
4. ✅ Monitor executions for 24 hours
5. ✅ Deactivate old Funifier workflows
6. ✅ Archive old workflows (don't delete yet)

