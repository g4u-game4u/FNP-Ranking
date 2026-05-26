# Supabase Migration - Deployment Steps

## ✅ Completed Steps

1. **Code Migration** - ✅ Complete
   - SupabaseApiService created and implemented
   - Frontend updated to use Supabase
   - API endpoints ready (presenca-webhook, gcom-sale-webhook)
   - Environment configuration updated

2. **Git Merge** - ✅ Complete
   - Branch `fix-removefunifier` merged into `master`
   - Conflicts resolved
   - Pushed to GitHub

## 🚀 Next Steps - Deployment

### Step 1: Set Vercel Environment Variables

You need to add these environment variables in your Vercel dashboard:

1. Go to: https://vercel.com/your-team/fnp-ranking/settings/environment-variables

2. Add the following variables for **Production**, **Preview**, and **Development**:

```env
VITE_SUPABASE_URL=https://fnp.centralsupernova.com.br
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc5MzMzOTU1LCJleHAiOjE5MzcwMTM5NTV9.2m9jUfgKs8wuBHA6s0omP2ktzJ0dlreeJ_n2--djKPw
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzkzMzM5NTUsImV4cCI6MTkzNzAxMzk1NX0.LEHMolITvfN6LUo6-UzoilG8_0-hl5IawI1h1k4Erps
```

**Important**: 
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are exposed to the client (safe)
- `SUPABASE_SERVICE_ROLE_KEY` is server-side only (used by API routes) - **NEVER expose this to the client**

### Step 2: Deploy to Vercel

Since you pushed to master, Vercel should automatically deploy. You can also manually trigger:

```bash
vercel --prod
```

Or just wait for the automatic deployment from the GitHub push.

### Step 3: Verify Deployment

1. **Check Vercel Dashboard**: https://vercel.com/your-team/fnp-ranking/deployments
2. **Wait for build to complete** (usually 2-3 minutes)
3. **Check deployment logs** for any errors

### Step 4: Test the Deployed Application

1. Open your production URL
2. Verify the leaderboard loads
3. Check browser console for errors
4. Verify data is coming from Supabase (not demo mode)

### Step 5: Test API Endpoints

Test the webhook endpoints:

```bash
# Test presença webhook
curl -X POST https://your-app.vercel.app/api/presenca-webhook \
  -H "Content-Type: application/json" \
  -d '{"uid": "test-uid", "station": "station1", "ts": "2024-01-01T12:00:00Z"}'

# Test GCOM sale webhook
curl -X POST https://your-app.vercel.app/api/gcom-sale-webhook \
  -H "Content-Type: application/json" \
  -d '{"_id": "player-code", "delivery_title": "Test Sale", "price": 100}'
```

### Step 6: Activate n8n Workflows

1. **Import workflows** to n8n:
   - `n8n-workflows/presenca-supabase.json`
   - `n8n-workflows/gcom-sales-supabase.json`

2. **Update workflow URLs** to point to your Vercel production URLs:
   - Presença: `https://your-app.vercel.app/api/presenca-webhook`
   - GCOM Sales: `https://your-app.vercel.app/api/gcom-sale-webhook`

3. **Test workflows manually** in n8n

4. **Activate workflows**

### Step 7: Populate Player UIDs (if not done)

If you haven't populated player UIDs in Supabase yet:

1. Open Supabase Studio: https://fnp.centralsupernova.com.br
2. Go to SQL Editor
3. Run SQL to update player UIDs:

```sql
-- Example: Update player UIDs
UPDATE players 
SET extra = jsonb_set(extra, '{uid}', '"uid-value"'::jsonb)
WHERE player_code = 'player-code';
```

### Step 8: Seed Leaderboard Data (if not done)

If you need to seed initial leaderboard data:

1. Open Supabase Studio
2. Go to SQL Editor
3. Insert leaderboard data:

```sql
-- Example: Insert a leaderboard
INSERT INTO leaderboards (title, description, is_active)
VALUES ('Main Leaderboard', 'Primary ranking board', true);

-- Example: Insert leaderboard entries
INSERT INTO leaderboard_entries (leaderboard_id, player_id, position, total)
SELECT 
  (SELECT id FROM leaderboards WHERE title = 'Main Leaderboard'),
  id,
  ROW_NUMBER() OVER (ORDER BY RANDOM()),
  FLOOR(RANDOM() * 1000)
FROM players;
```

## 🔍 Verification Checklist

- [ ] Environment variables set in Vercel
- [ ] Deployment successful (no build errors)
- [ ] Frontend loads without errors
- [ ] Leaderboard data displays correctly
- [ ] Real-time updates work (if implemented)
- [ ] Presença webhook responds correctly
- [ ] GCOM sale webhook responds correctly
- [ ] n8n workflows imported and configured
- [ ] n8n workflows tested manually
- [ ] n8n workflows activated
- [ ] Player UIDs populated in database
- [ ] Leaderboard data seeded
- [ ] Raspberry Pi kiosk updated (if applicable)

## 🐛 Troubleshooting

### Frontend shows "Demo Mode"

**Cause**: Environment variables not set or incorrect

**Solution**:
1. Check Vercel environment variables are set correctly
2. Redeploy after setting variables
3. Check browser console for specific error messages

### API Endpoints Return 500 Error

**Cause**: `SUPABASE_SERVICE_ROLE_KEY` not set or incorrect

**Solution**:
1. Verify the service role key is set in Vercel
2. Check API endpoint logs in Vercel dashboard
3. Verify Supabase is accessible from Vercel

### n8n Workflows Fail

**Cause**: Incorrect webhook URLs or Supabase credentials

**Solution**:
1. Verify webhook URLs point to production Vercel app
2. Check n8n workflow logs for specific errors
3. Test webhooks manually with curl first

### No Data in Leaderboards

**Cause**: Database not seeded

**Solution**:
1. Check if leaderboards table has data
2. Check if leaderboard_entries table has data
3. Run seed scripts if needed

## 📞 Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check Supabase logs in Studio
3. Check browser console for frontend errors
4. Check n8n execution logs

## 🎉 Success!

Once all steps are complete:
- Your application is running on Supabase
- API endpoints are live and working
- n8n workflows are processing data
- Real-time updates are enabled
- You can safely remove Funifier credentials

---

**Next**: After successful deployment, you can proceed to remove Funifier-related code and credentials as documented in the migration guide.
