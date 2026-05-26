# 🚀 Run This SQL in Supabase Dashboard

## Step 1: Open Supabase Studio

1. Go to: **https://fnp.centralsupernova.com.br**
2. Login:
   - Username: `supabase`
   - Password: `49728e7a85bd404966c58cce1327cd10`

## Step 2: Open SQL Editor

1. Click **SQL Editor** in the left sidebar
2. Click **New Query** button

## Step 3: Copy and Paste SQL

1. Open file: **`SUPABASE_COMPLETE.sql`**
2. Select ALL (Ctrl+A)
3. Copy (Ctrl+C)
4. Paste into Supabase SQL Editor (Ctrl+V)

## Step 4: Run the SQL

1. Click **Run** button (or press Ctrl+Enter)
2. Wait 30-60 seconds for completion
3. You should see "Success" message

## Step 5: Verify

At the bottom of the SQL output, you should see:

### Tables Created (7):
- challenges
- challenge_events
- challenge_progress
- leaderboard_entries
- leaderboards
- player_stats
- players

### Functions Created (9):
- get_leaderboard_data
- get_leaderboard_stats
- get_player_active_challenges
- get_player_history
- get_player_status
- get_recent_challenge_events
- get_top_players
- record_challenge_event
- upsert_leaderboard_entry
- update_updated_at_column

### Realtime Enabled (4 tables):
- challenge_events
- challenge_progress
- leaderboard_entries
- player_stats

## ✅ Done!

If you see all of the above, your database is ready!

## Next Steps

1. **Setup Environment**:
   ```bash
   npm run setup:supabase
   ```

2. **Import Data** (if migrating from Funifier):
   ```bash
   npm run migrate:export
   npm run migrate:import
   ```

3. **Start Development**:
   ```bash
   npm run dev
   ```

## 🚨 Troubleshooting

### If you see errors:

**"relation already exists"**
- This is OK! It means tables already exist
- The script will skip creating them

**"function already exists"**
- This is OK! The script uses `CREATE OR REPLACE`
- It will update the function

**"permission denied"**
- Make sure you're logged in as the supabase user
- Check you're using the correct password

**"syntax error"**
- Make sure you copied the ENTIRE file
- Check you didn't accidentally modify the SQL

### Still having issues?

1. Check the error message carefully
2. Try running the SQL again
3. Check Supabase Dashboard → Logs for details

## 📞 Need Help?

See `COMPLETE_SETUP_GUIDE.md` for detailed instructions.
