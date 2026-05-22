# 🚀 Complete Setup Guide - Supabase Backend

## Overview

This guide will take you from zero to a fully functional Supabase backend in about 15-20 minutes.

## 📋 What You'll Set Up

1. **Database Schema** - 7 tables with relationships
2. **Real-time Subscriptions** - Live updates for frontend
3. **Helper Functions** - 10+ utility functions
4. **Edge Functions** - 3 serverless functions
5. **Security** - Row Level Security policies

## 🎯 Step-by-Step Instructions

### Step 1: Access Supabase Studio (2 minutes)

1. Open browser and go to: **https://fnp.centralsupernova.com.br**
2. Login with:
   - **Username**: `supabase`
   - **Password**: `49728e7a85bd404966c58cce1327cd10`
3. You should see the Supabase Dashboard

### Step 2: Run Main Database Schema (5 minutes)

1. Click **SQL Editor** in the left sidebar
2. Click **New Query** button
3. Open file: **`supabase-schema.sql`**
4. Copy the ENTIRE file contents
5. Paste into the SQL Editor
6. Click **Run** (or press `Ctrl+Enter`)
7. Wait for "Success" message (should take 10-30 seconds)

**Verify**:
- Click **Table Editor** in sidebar
- You should see 7 tables:
  - `leaderboards`
  - `players`
  - `leaderboard_entries`
  - `challenges`
  - `challenge_progress`
  - `challenge_events`
  - `player_stats`

### Step 3: Enable Real-time (1 minute)

1. In **SQL Editor**, click **New Query**
2. Open file: **`supabase-realtime-config.sql`**
3. Copy and paste entire contents
4. Click **Run**
5. Wait for "Success" message

**Verify**:
- Run the verification query at the end of the file
- Should show 4 tables with real-time enabled

### Step 4: Add Helper Functions (2 minutes)

1. In **SQL Editor**, click **New Query**
2. Open file: **`supabase-helper-functions.sql`**
3. Copy and paste entire contents
4. Click **Run**
5. Wait for "Success" message

**Verify**:
- Click **Database** → **Functions** in sidebar
- You should see 10+ functions listed

### Step 5: Setup Environment Variables (2 minutes)

On your local machine:

```bash
cd e:\Projetos\FNP-Ranking
npm run setup:supabase
```

This creates `.env.local` with:
```env
VITE_SUPABASE_URL=https://fnp.centralsupernova.com.br
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 6: Deploy Edge Functions (5 minutes)

**Prerequisites**:
```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref
```

**Deploy Functions**:
```bash
# Deploy all functions
supabase functions deploy update-leaderboard
supabase functions deploy challenge-webhook
supabase functions deploy get-leaderboard
```

**Verify**:
- In Supabase Dashboard, click **Edge Functions**
- You should see 3 functions listed

### Step 7: Migrate Data (5 minutes)

If you have existing Funifier data:

```bash
# Export from Funifier
npm run migrate:export

# Import to Supabase
npm run migrate:import
```

If starting fresh, you can skip this step.

### Step 8: Test Everything (3 minutes)

```bash
# Start development server
npm run dev
```

Open http://localhost:5173 and verify:
- ✅ Leaderboards load
- ✅ Players display
- ✅ Rankings show correctly
- ✅ No console errors

## 📁 Files Reference

### SQL Scripts (Run in Supabase Studio)
| File | Purpose | Time |
|------|---------|------|
| `supabase-schema.sql` | Main database schema | 5 min |
| `supabase-realtime-config.sql` | Enable real-time | 1 min |
| `supabase-helper-functions.sql` | Utility functions | 2 min |

### Edge Functions (Deploy via CLI)
| File | Purpose | Deploy Command |
|------|---------|----------------|
| `supabase/functions/update-leaderboard/index.ts` | Bulk update leaderboard | `supabase functions deploy update-leaderboard` |
| `supabase/functions/challenge-webhook/index.ts` | Challenge events | `supabase functions deploy challenge-webhook` |
| `supabase/functions/get-leaderboard/index.ts` | Get leaderboard data | `supabase functions deploy get-leaderboard` |

### Documentation
| File | Purpose |
|------|---------|
| `SUPABASE_DEPLOYMENT.md` | Detailed deployment guide |
| `SQL_QUICK_REFERENCE.md` | Quick SQL reference |
| `SUPABASE_ONLY.md` | Supabase-only setup guide |

## ✅ Verification Checklist

### Database
- [ ] 7 tables created
- [ ] Indexes created (check Database → Indexes)
- [ ] 10+ functions created (check Database → Functions)
- [ ] RLS enabled on all tables
- [ ] Triggers created

### Real-time
- [ ] leaderboard_entries has real-time
- [ ] challenge_events has real-time
- [ ] player_stats has real-time
- [ ] challenge_progress has real-time

### Edge Functions
- [ ] update-leaderboard deployed
- [ ] challenge-webhook deployed
- [ ] get-leaderboard deployed

### Application
- [ ] Environment variables configured
- [ ] App runs without errors
- [ ] Leaderboards display
- [ ] Data loads correctly

## 🧪 Quick Tests

### Test Database Function
In Supabase SQL Editor:
```sql
-- Should return empty result (no data yet)
SELECT * FROM get_leaderboard_data(
  '00000000-0000-0000-0000-000000000000'::UUID,
  true,
  CURRENT_DATE
);
```

### Test Edge Function
```bash
curl "https://fnp.centralsupernova.com.br/functions/v1/get-leaderboard?id=test" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Test Real-time
In browser console:
```javascript
const supabase = window.supabase.createClient(
  'https://fnp.centralsupernova.com.br',
  'YOUR_ANON_KEY'
);

supabase
  .channel('test')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'leaderboard_entries' },
    (payload) => console.log('Change!', payload)
  )
  .subscribe();
```

## 🚨 Troubleshooting

### "Function not found"
- Make sure you ran all SQL scripts
- Check Database → Functions to verify

### "Permission denied"
- Check RLS policies are correct
- Verify you're using the right API key

### "Real-time not working"
- Verify real-time is enabled for the table
- Check browser console for errors

### "Edge function fails"
- Check function logs in Dashboard
- Verify environment variables
- Test with curl for detailed errors

## 📊 What You Get

### Tables
- **leaderboards** - Leaderboard configurations
- **players** - Player information
- **leaderboard_entries** - Rankings with history
- **challenges** - Challenge definitions
- **challenge_progress** - Player progress tracking
- **challenge_events** - Event log
- **player_stats** - Aggregated statistics

### Functions
- `get_leaderboard_data()` - Get leaderboard with players
- `get_player_status()` - Get player stats
- `get_top_players()` - Get top N players
- `upsert_leaderboard_entry()` - Update rankings
- `record_challenge_event()` - Log challenge events
- `get_recent_challenge_events()` - Get recent events
- `get_player_history()` - Get player history
- `get_leaderboard_stats()` - Get statistics
- `bulk_update_leaderboard()` - Bulk updates
- `get_player_active_challenges()` - Get active challenges

### Edge Functions
- **update-leaderboard** - Bulk update API
- **challenge-webhook** - Event receiver
- **get-leaderboard** - Data API

### Features
- ✅ Real-time subscriptions
- ✅ Row Level Security
- ✅ Automatic timestamps
- ✅ Historical tracking
- ✅ Performance indexes
- ✅ CORS enabled
- ✅ Type-safe queries

## 🎉 You're Done!

Your Supabase backend is now fully configured and ready to use!

### Next Steps

1. **Import Data**: If migrating from Funifier, run `npm run migrate:import`
2. **Test Locally**: Run `npm run dev` and test all features
3. **Deploy**: Deploy to Vercel with Supabase credentials
4. **Monitor**: Check Supabase Dashboard → Logs regularly

### Support

- **Quick Reference**: See `SQL_QUICK_REFERENCE.md`
- **Detailed Guide**: See `SUPABASE_DEPLOYMENT.md`
- **Supabase Docs**: https://supabase.com/docs
- **Edge Functions**: https://supabase.com/docs/guides/functions

## 📞 Need Help?

1. Check error messages carefully
2. Review the troubleshooting section
3. Check Supabase Dashboard → Logs
4. Verify all steps were completed
5. Review documentation files

---

**Total Time**: ~15-20 minutes  
**Difficulty**: Easy  
**Prerequisites**: Supabase access, Node.js installed

🚀 **Happy coding!**
