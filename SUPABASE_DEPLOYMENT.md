# Supabase Deployment Guide

## SQL Scripts to Run (In Order)

### 1. Main Database Schema

**File**: `supabase-schema.sql`

**What it does**:
- Creates all tables (leaderboards, players, leaderboard_entries, challenges, etc.)
- Creates indexes for performance
- Creates helper functions
- Sets up Row Level Security (RLS)
- Creates triggers for automatic timestamps

**How to run**:
1. Open Supabase Studio: https://fnp.centralsupernova.com.br
2. Login with:
   - User: `supabase`
   - Password: `49728e7a85bd404966c58cce1327cd10`
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy and paste the entire contents of `supabase-schema.sql`
6. Click **Run** or press `Ctrl+Enter`
7. Verify: Check **Table Editor** to see all tables created

### 2. Real-time Configuration

**File**: `supabase-realtime-config.sql`

**What it does**:
- Enables real-time subscriptions for key tables
- Allows frontend to receive live updates

**How to run**:
1. In Supabase Studio SQL Editor
2. Copy and paste contents of `supabase-realtime-config.sql`
3. Click **Run**
4. Verify: Run the verification query at the end to see enabled tables

### 3. Helper Functions

**File**: `supabase-helper-functions.sql`

**What it does**:
- Adds utility functions for common operations
- Functions for top players, player history, bulk updates, etc.

**How to run**:
1. In Supabase Studio SQL Editor
2. Copy and paste contents of `supabase-helper-functions.sql`
3. Click **Run**
4. Verify: Go to **Database** → **Functions** to see all functions

## Edge Functions to Deploy

### Prerequisites

Install Supabase CLI:
```bash
npm install -g supabase
```

Login to Supabase:
```bash
supabase login
```

Link to your project:
```bash
supabase link --project-ref your-project-ref
```

### 1. Update Leaderboard Function

**File**: `supabase/functions/update-leaderboard/index.ts`

**What it does**:
- Updates leaderboard entries from external sources
- Bulk update support
- Handles player lookup and error reporting

**Deploy**:
```bash
supabase functions deploy update-leaderboard
```

**Test**:
```bash
curl -X POST https://fnp.centralsupernova.com.br/functions/v1/update-leaderboard \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "leaderboard_id": "your-leaderboard-uuid",
    "entries": [
      {"player_code": "player1", "position": 1, "total": 100},
      {"player_code": "player2", "position": 2, "total": 90}
    ]
  }'
```

### 2. Challenge Webhook Function

**File**: `supabase/functions/challenge-webhook/index.ts`

**What it does**:
- Receives challenge completion events
- Records events in database
- Updates player stats automatically
- Triggers real-time notifications

**Deploy**:
```bash
supabase functions deploy challenge-webhook
```

**Test**:
```bash
curl -X POST https://fnp.centralsupernova.com.br/functions/v1/challenge-webhook \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "player_code": "player1",
    "challenge_name": "Daily Login",
    "event_type": "completed",
    "points_awarded": 10
  }'
```

### 3. Get Leaderboard Function

**File**: `supabase/functions/get-leaderboard/index.ts`

**What it does**:
- Returns leaderboard data in Funifier-compatible format
- Useful for external integrations
- Caching-friendly

**Deploy**:
```bash
supabase functions deploy get-leaderboard
```

**Test**:
```bash
curl "https://fnp.centralsupernova.com.br/functions/v1/get-leaderboard?id=your-leaderboard-uuid" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## Verification Checklist

### Database Schema
- [ ] All 7 tables created (leaderboards, players, leaderboard_entries, challenges, challenge_progress, challenge_events, player_stats)
- [ ] Indexes created (check **Database** → **Indexes**)
- [ ] Functions created (check **Database** → **Functions**)
- [ ] RLS enabled on all tables (check **Authentication** → **Policies**)
- [ ] Triggers created (check **Database** → **Triggers**)

### Real-time
- [ ] Real-time enabled for leaderboard_entries
- [ ] Real-time enabled for challenge_events
- [ ] Real-time enabled for player_stats
- [ ] Real-time enabled for challenge_progress

### Edge Functions
- [ ] update-leaderboard deployed and working
- [ ] challenge-webhook deployed and working
- [ ] get-leaderboard deployed and working

## Testing the Setup

### 1. Test Database Functions

```sql
-- Test get_leaderboard_data
SELECT * FROM get_leaderboard_data(
  'your-leaderboard-uuid'::UUID,
  true,
  CURRENT_DATE
);

-- Test get_player_status
SELECT * FROM get_player_status('your-player-uuid'::UUID);

-- Test get_top_players
SELECT * FROM get_top_players('your-leaderboard-uuid'::UUID, 10);
```

### 2. Test Real-time Subscriptions

In your browser console:
```javascript
const { createClient } = supabase;
const supabase = createClient(
  'https://fnp.centralsupernova.com.br',
  'YOUR_ANON_KEY'
);

// Subscribe to leaderboard changes
const channel = supabase
  .channel('leaderboard-changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'leaderboard_entries'
    },
    (payload) => console.log('Change received!', payload)
  )
  .subscribe();
```

### 3. Test Edge Functions

See curl commands above for each function.

## Environment Variables

Make sure these are set in your Supabase project:

### In Supabase Dashboard (Settings → API)
- `SUPABASE_URL`: Your project URL
- `SUPABASE_ANON_KEY`: Public anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (keep secret!)

### In Your Application (.env.local)
```env
VITE_SUPABASE_URL=https://fnp.centralsupernova.com.br
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### For Migration Scripts
```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## Troubleshooting

### "Function not found"
- Make sure you ran all SQL scripts in order
- Check **Database** → **Functions** to verify functions exist

### "Permission denied"
- Check RLS policies are set correctly
- Verify you're using the correct API key (anon vs service_role)

### "Real-time not working"
- Verify real-time is enabled for the table
- Check browser console for WebSocket errors
- Ensure RLS policies allow SELECT on the table

### "Edge function fails"
- Check function logs in Supabase Dashboard
- Verify environment variables are set
- Test with curl to see detailed error messages

## Next Steps

After deployment:

1. **Migrate Data**: Run `npm run migrate:import` to import existing data
2. **Test Application**: Run `npm run dev` and verify everything works
3. **Monitor**: Check Supabase Dashboard → **Logs** for any issues
4. **Optimize**: Add indexes if queries are slow
5. **Backup**: Set up automated backups in Supabase Dashboard

## Support

- **Supabase Docs**: https://supabase.com/docs
- **Edge Functions**: https://supabase.com/docs/guides/functions
- **Real-time**: https://supabase.com/docs/guides/realtime
- **SQL Functions**: https://supabase.com/docs/guides/database/functions
