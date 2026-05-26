# Quick Deployment Checklist

## ✅ Pre-Deployment Verification

- [ ] Supabase instance is running: https://fnp.centralsupernova.com.br
- [ ] Vercel deployment is live: https://vercel.com/game4u/fnp-ranking
- [ ] N8N instance is accessible
- [ ] MySQL credentials are configured in n8n

## 📋 Step-by-Step Deployment

### Step 1: Deploy Supabase Function (5 minutes)

1. [ ] Open Supabase Studio: https://fnp.centralsupernova.com.br
2. [ ] Go to SQL Editor
3. [ ] Open file: `SUPABASE_STORE_SALES_FUNCTION.sql`
4. [ ] Copy entire contents
5. [ ] Paste into SQL Editor
6. [ ] Click "Run"
7. [ ] Verify success message appears

**Test the function:**
```sql
SELECT log_store_sale('TEST SALE', 100.00);
```

Expected: JSON response with `"success": true`

---

### Step 2: Deploy GCOM Sales Workflow (5 minutes)

1. [ ] Open n8n
2. [ ] Go to Workflows
3. [ ] Click "Import from File"
4. [ ] Select: `n8n-workflows/gcom-sales-supabase-fixed.json`
5. [ ] Click "Import"
6. [ ] Verify MySQL credentials are set
7. [ ] Set environment variable: `VERCEL_API_URL` = your Vercel URL
8. [ ] Click "Execute Workflow" to test
9. [ ] Check execution log for success
10. [ ] Toggle "Active" switch

**Verify in Supabase:**
```sql
SELECT * FROM actions 
WHERE action_id = 'sell_product' 
ORDER BY created_at DESC 
LIMIT 5;
```

---

### Step 3: Deploy Presence Workflow (5 minutes)

1. [ ] Open n8n
2. [ ] Go to Workflows
3. [ ] Click "Import from File"
4. [ ] Select: `n8n-workflows/presenca-supabase.json`
5. [ ] Click "Import"
6. [ ] Copy webhook URL
7. [ ] Test with curl:
```bash
curl -X POST https://your-n8n.com/webhook/presenca-webhook \
  -H "Content-Type: application/json" \
  -d '{"player_code": "12345", "timestamp": "2024-01-20T10:30:00Z"}'
```
8. [ ] Verify response: `{"success": true}`
9. [ ] Toggle "Active" switch

---

## 🔍 Post-Deployment Verification (10 minutes)

### Check GCOM Sales Workflow
- [ ] Go to n8n Executions tab
- [ ] Find latest GCOM sales execution
- [ ] Verify status: Success
- [ ] Check logs for "✅ Sale processed"

### Check Supabase Data
```sql
-- Check actions logged today
SELECT COUNT(*) FROM actions 
WHERE action_id = 'sell_product' 
AND created_at::date = CURRENT_DATE;

-- Check player points updated
SELECT p.name, ps.total_points 
FROM player_stats ps
JOIN players p ON ps.player_id = p.id
ORDER BY ps.updated_at DESC
LIMIT 10;

-- Check presence records
SELECT COUNT(*) FROM presence 
WHERE DATE(timestamp AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE;
```

### Check Vercel Logs
- [ ] Go to Vercel dashboard
- [ ] Open project: fnp-ranking
- [ ] Go to Logs
- [ ] Filter by: `/api/gcom-sale-webhook`
- [ ] Verify recent successful calls

---

## 🚨 Troubleshooting

### Issue: "Unknown column 'ID_EMP_GCOM'"
**Solution:** You're using the old workflow. Import `gcom-sales-supabase-fixed.json`

### Issue: "No players with presence today"
**Solution:** This is normal if no one checked in yet. Points will be awarded once presence is logged.

### Issue: Webhook timeout
**Solution:** Check Supabase logs, verify function is deployed correctly

### Issue: "Missing required fields"
**Solution:** Verify webhook payload has `delivery_title` and `price`

---

## 📊 Monitoring (Daily)

### Day 1-7: Active Monitoring
- [ ] Check n8n executions daily
- [ ] Verify Supabase data is being written
- [ ] Compare point totals with expected values
- [ ] Monitor Vercel logs for errors

### Week 2+: Passive Monitoring
- [ ] Set up alerts in n8n for failed executions
- [ ] Weekly check of Supabase data integrity
- [ ] Monthly review of workflow performance

---

## 📝 Key Files Reference

| File | Purpose |
|------|---------|
| `SUPABASE_STORE_SALES_FUNCTION.sql` | Database function to deploy |
| `n8n-workflows/gcom-sales-supabase-fixed.json` | GCOM sales workflow |
| `n8n-workflows/presenca-supabase.json` | Presence workflow |
| `api/gcom-sale-webhook.ts` | Vercel API endpoint |
| `N8N_DEPLOYMENT_GUIDE.md` | Detailed deployment guide |
| `GCOM_SALES_FIX_SUMMARY.md` | What was fixed and why |

---

## 🎯 Success Criteria

✅ **GCOM Sales Workflow:**
- Runs hourly without errors
- Fetches sales from MySQL
- Awards points to players with presence
- Logs actions in Supabase

✅ **Presence Workflow:**
- Receives webhook calls
- Logs presence in Supabase
- Returns success responses

✅ **Data Integrity:**
- Actions table has new entries
- Player stats are updated
- Points match expected calculations (0.1 * price per player)

---

## 🔄 Rollback (If Needed)

1. [ ] Deactivate new workflows in n8n
2. [ ] Reactivate old Funifier workflows
3. [ ] Update Vercel environment variables
4. [ ] Redeploy Vercel with old code
5. [ ] Notify team of rollback
6. [ ] Investigate issues
7. [ ] Fix and redeploy when ready

---

## ✅ Deployment Complete!

Once all checkboxes are marked:
- [ ] Update team on successful deployment
- [ ] Document any issues encountered
- [ ] Schedule follow-up review in 1 week
- [ ] Archive old Funifier workflows (don't delete yet)

**Deployment Date:** _______________  
**Deployed By:** _______________  
**Verified By:** _______________
