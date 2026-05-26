# ✅ Migration Checklist

Print this and check off as you go!

## Phase 1: Database Setup ✅ DONE
- [x] Run `SUPABASE_COMPLETE.sql` in Supabase Studio
- [x] Verify 7 tables created
- [x] Verify 9 functions created
- [x] Verify real-time enabled on 4 tables
- [x] Create `.env.local` with credentials

## Phase 2: Actions Setup ⏳ IN PROGRESS
- [ ] Run `SUPABASE_ACTIONS_FUNCTIONS.sql` in Supabase Studio
- [ ] Verify `actions` table created
- [ ] Verify `daily_presence` table created
- [ ] Verify `log_presenca()` function exists
- [ ] Verify `log_sale()` function exists
- [ ] Test functions with sample data

## Phase 3: API Deployment
- [ ] Deploy to Vercel: `vercel --prod`
- [ ] Verify `/api/presenca-webhook` is live
- [ ] Verify `/api/gcom-sale-webhook` is live
- [ ] Test presença endpoint with curl
- [ ] Test sale endpoint with curl

## Phase 4: N8N Configuration
- [ ] Import `presenca-supabase.json` to N8N
- [ ] Update API URL in presença workflow
- [ ] Test presença workflow manually
- [ ] Activate presença workflow
- [ ] Import `gcom-sales-supabase.json` to N8N
- [ ] Update API URL in GCOM workflow
- [ ] Update MySQL credentials in GCOM workflow
- [ ] Test GCOM workflow manually
- [ ] Activate GCOM workflow

## Phase 5: Player Data Migration
- [ ] Export player UIDs from current system
- [ ] Update players table with UIDs:
  ```sql
  UPDATE players
  SET extra = jsonb_set(extra, '{uid}', '"uid_here"'::jsonb)
  WHERE player_code = 'email@here.com';
  ```
- [ ] Verify all active players have UIDs
- [ ] Test lookup by UID works

## Phase 6: Raspberry Pi Update
- [ ] Backup current Raspberry Pi configuration
- [ ] Update webhook URL to new N8N endpoint
- [ ] Test RFID scan
- [ ] Verify data reaches Supabase
- [ ] Verify points are awarded

## Phase 7: Testing (24 hours)
- [ ] Monitor N8N execution logs
- [ ] Monitor Vercel function logs
- [ ] Monitor Supabase database logs
- [ ] Verify presença registrations work
- [ ] Verify GCOM sales sync works
- [ ] Verify points calculation is correct
- [ ] Verify frontend updates in real-time
- [ ] Check for any errors

## Phase 8: Validation
- [ ] Compare points with old system (sample)
- [ ] Verify all presença registrations logged
- [ ] Verify all sales logged
- [ ] Verify presence-based point logic works
- [ ] Get user feedback

## Phase 9: Cleanup
- [ ] Deactivate old Funifier N8N workflows
- [ ] Archive old workflows (don't delete)
- [ ] Remove Funifier credentials from N8N
- [ ] Document any issues encountered
- [ ] Update team documentation

## Phase 10: Finalization
- [ ] Cancel Funifier subscription
- [ ] Remove Funifier environment variables
- [ ] Delete old Funifier code (already done)
- [ ] Celebrate! 🎉

---

## Quick Test Commands

### Test Presença
```bash
curl -X POST https://YOUR-DOMAIN.vercel.app/api/presenca-webhook \
  -H "Content-Type: application/json" \
  -d '{"uid":"test_uid","station":"test","ts":1716384000}'
```

### Test Sale
```bash
curl -X POST https://YOUR-DOMAIN.vercel.app/api/gcom-sale-webhook \
  -H "Content-Type: application/json" \
  -d '{"_id":"test@test.com","delivery_title":"Test","price":100}'
```

### Check Today's Presence
```sql
SELECT p.name, dp.first_check_in, dp.points_awarded
FROM daily_presence dp
JOIN players p ON dp.player_id = p.id
WHERE dp.presence_date = CURRENT_DATE;
```

### Check Today's Sales
```sql
SELECT p.name, a.points_awarded, a.attributes->>'has_presence' as had_presence
FROM actions a
JOIN players p ON a.player_id = p.id
WHERE a.action_id = 'sell_product'
  AND DATE(a.created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE;
```

---

## Emergency Rollback

If something goes wrong:

1. [ ] Reactivate old Funifier N8N workflows
2. [ ] Deactivate new Supabase workflows
3. [ ] Revert Raspberry Pi webhook URL
4. [ ] Document what went wrong
5. [ ] Fix issues
6. [ ] Try again

---

## Estimated Time

- Phase 1: ✅ Done
- Phase 2: 5 minutes
- Phase 3: 10 minutes
- Phase 4: 15 minutes
- Phase 5: 10 minutes
- Phase 6: 5 minutes
- Phase 7: 24 hours (monitoring)
- Phase 8: 30 minutes
- Phase 9: 15 minutes
- Phase 10: 5 minutes

**Total active work**: ~1 hour  
**Total monitoring**: 24 hours

---

## Success Indicators

✅ No errors in logs for 24 hours  
✅ All presença registrations logged  
✅ All sales logged  
✅ Points awarded correctly  
✅ Frontend updates in real-time  
✅ Users report no issues  
✅ Performance is good or better  

---

## Contact Info

**Supabase Studio**: https://fnp.centralsupernova.com.br  
**Vercel Dashboard**: https://vercel.com/your-project  
**N8N Dashboard**: Your N8N URL

**Documentation**:
- `ACTIONS_SETUP_GUIDE.md` - Detailed setup
- `MIGRATION_COMPARISON.md` - Old vs New
- `ARCHITECTURE_DIAGRAM.md` - Flow diagrams
- `COMPLETE_MIGRATION_SUMMARY.md` - Full summary

---

**Current Status**: Phase 2 - Ready to run Actions SQL

**Next Step**: Run `SUPABASE_ACTIONS_FUNCTIONS.sql` in Supabase Studio
