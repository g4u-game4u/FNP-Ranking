# Funifier to Supabase Migration Guide

## Overview

This guide walks you through migrating the FNP Ranking system from Funifier API to a self-hosted Supabase backend.

## Prerequisites

- Node.js 18+ installed
- Access to Funifier API (current credentials)
- Access to Supabase instance at https://fnp.centralsupernova.com.br
- Supabase credentials configured

## Migration Steps

### Step 1: Set Up Environment Variables

Create a `.env.local` file with both Funifier and Supabase credentials:

```env
# Funifier (existing - keep for data export)
VITE_FUNIFIER_SERVER_URL=https://service2.funifier.com/v3
VITE_FUNIFIER_API_KEY=your_funifier_api_key
VITE_FUNIFIER_AUTH_TOKEN=Basic_your_token

# Supabase (new)
VITE_SUPABASE_URL=https://fnp.centralsupernova.com.br
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc5MzMzOTU1LCJleHAiOjE5MzcwMTM5NTV9.2m9jUfgKs8wuBHA6s0omP2ktzJ0dlreeJ_n2--djKPw

# Server-side only (for migration scripts)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzkzMzM5NTUsImV4cCI6MTkzNzAxMzk1NX0.LEHMolITvfN6LUo6-UzoilG8_0-hl5IawI1h1k4Erps
```

### Step 2: Create Database Schema

1. Open Supabase Studio at https://fnp.centralsupernova.com.br
2. Log in with:
   - User: `supabase`
   - Password: `49728e7a85bd404966c58cce1327cd10`
3. Navigate to SQL Editor
4. Copy the contents of `supabase-schema.sql`
5. Paste and execute the SQL script
6. Verify tables were created successfully

Alternatively, if you have direct Postgres access:

```bash
psql -h 127.0.0.1 -p 5436 -U postgres -d postgres -f supabase-schema.sql
# Password: 15125f6c9a03be567f93215b5bd58c40
```

### Step 3: Export Data from Funifier

Export all current data from Funifier:

```bash
npm run migrate:export
```

This will create a `funifier-export/` directory with:
- `leaderboards.json` - All leaderboards
- `leaderboard-data.json` - Player rankings for each leaderboard
- `export-summary.json` - Summary of exported data

For a complete export including player details and statuses (slower):

```bash
npm run migrate:export:full
```

### Step 4: Import Data to Supabase

Import the exported data into Supabase:

```bash
npm run migrate:import
```

This will:
1. Import all leaderboards
2. Extract and import unique players
3. Import leaderboard entries (rankings)
4. Initialize player statistics

### Step 5: Verify Data

1. Open Supabase Studio
2. Navigate to Table Editor
3. Check the following tables:
   - `leaderboards` - Should contain all your leaderboards
   - `players` - Should contain all unique players
   - `leaderboard_entries` - Should contain current rankings
   - `player_stats` - Should have entries for all players

### Step 6: Test Supabase API Service

Create a test file to verify the Supabase service works:

```typescript
// test-supabase.ts
import { SupabaseApiService } from './src/services/supabaseApi';

async function test() {
  const api = new SupabaseApiService();
  
  // Test connection
  const connected = await api.testConnection();
  console.log('Connected:', connected);
  
  // Test fetching leaderboards
  const leaderboards = await api.getLeaderboards();
  console.log('Leaderboards:', leaderboards.length);
  
  // Test fetching leaderboard data
  if (leaderboards.length > 0) {
    const data = await api.getLeaderboardData(leaderboards[0]._id);
    console.log('Players:', data.leaders.length);
  }
}

test();
```

Run with: `npx tsx test-supabase.ts`

### Step 7: Update Application Code

#### Option A: Switch Completely to Supabase

Update `src/services/index.ts` to export Supabase service:

```typescript
// Replace this:
export { FunifierApiService } from './funifierApi';

// With this:
export { SupabaseApiService as FunifierApiService } from './supabaseApi';
```

#### Option B: Feature Flag (Recommended for Testing)

Add a feature flag to switch between Funifier and Supabase:

```typescript
// src/config/features.ts
export const USE_SUPABASE = import.meta.env.VITE_USE_SUPABASE === 'true';

// src/services/index.ts
import { USE_SUPABASE } from '../config/features';
import { FunifierApiService } from './funifierApi';
import { SupabaseApiService } from './supabaseApi';

export const ApiService = USE_SUPABASE ? SupabaseApiService : FunifierApiService;
```

Then in `.env.local`:
```env
VITE_USE_SUPABASE=true
```

### Step 8: Test Real-Time Updates (Optional)

Supabase provides real-time subscriptions. Update your components to use them:

```typescript
import { getSupabaseApi } from './services/supabaseApi';

const api = getSupabaseApi();

// Subscribe to leaderboard updates
const subscription = api.subscribeToLeaderboard(leaderboardId, (payload) => {
  console.log('Leaderboard updated:', payload);
  // Refresh leaderboard data
});

// Unsubscribe when component unmounts
subscription.unsubscribe();
```

### Step 9: Deploy

1. Update environment variables in Vercel:
   ```bash
   vercel env add VITE_SUPABASE_URL production
   vercel env add VITE_SUPABASE_ANON_KEY production
   ```

2. Deploy:
   ```bash
   npm run deploy:production
   ```

### Step 10: Monitor and Validate

1. Monitor application logs for errors
2. Verify leaderboard data displays correctly
3. Check real-time updates are working
4. Monitor Supabase dashboard for performance

## Rollback Plan

If issues occur, you can quickly rollback:

1. Set `VITE_USE_SUPABASE=false` in environment variables
2. Redeploy application
3. System will revert to using Funifier API

## Troubleshooting

### Export Script Fails

**Issue**: Authentication error when exporting from Funifier

**Solution**: 
- Verify `VITE_FUNIFIER_API_KEY` and `VITE_FUNIFIER_AUTH_TOKEN` are correct
- Check Funifier API is accessible
- Try with `--with-player-details` flag removed for faster export

### Import Script Fails

**Issue**: Cannot connect to Supabase

**Solution**:
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Check Supabase instance is running
- Verify network connectivity to https://fnp.centralsupernova.com.br

### Missing Data After Import

**Issue**: Some players or leaderboards are missing

**Solution**:
- Check `funifier-export/export-summary.json` for export statistics
- Review import script logs for errors
- Re-run import script (it handles duplicates gracefully)

### Real-Time Updates Not Working

**Issue**: Leaderboard doesn't update automatically

**Solution**:
- Verify Supabase Realtime is enabled in project settings
- Check browser console for WebSocket errors
- Ensure RLS policies allow reading from tables

## Performance Optimization

### Database Indexes

The schema includes indexes for common queries. Monitor slow queries in Supabase and add indexes as needed:

```sql
CREATE INDEX idx_custom ON table_name(column_name);
```

### Caching

Consider adding Redis caching for frequently accessed data:

```typescript
// Example with Vercel KV
import { kv } from '@vercel/kv';

async function getCachedLeaderboard(id: string) {
  const cached = await kv.get(`leaderboard:${id}`);
  if (cached) return cached;
  
  const data = await api.getLeaderboardData(id);
  await kv.set(`leaderboard:${id}`, data, { ex: 60 }); // Cache for 60s
  return data;
}
```

## N8N Integration (Optional)

If you want to use N8N for automation:

1. Get your N8N API key from https://fnp.centralsupernova.com.br
2. Update `.kiro/settings/mcp.json`:
   ```json
   {
     "mcpServers": {
       "n8n": {
         "command": "npx",
         "args": ["-y", "n8n-mcp@latest"],
         "env": {
           "N8N_API_URL": "https://fnp.centralsupernova.com.br",
           "N8N_API_KEY": "your_actual_n8n_api_key"
         },
         "disabled": false
       }
     }
   }
   ```

3. Create workflows for:
   - Automatic leaderboard updates
   - Challenge event processing
   - Notifications
   - Data synchronization

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Supabase logs in Studio
3. Check application logs in Vercel
4. Review the migration plan in `FUNIFIER_TO_SUPABASE_MIGRATION.md`

## Next Steps

After successful migration:
1. ✅ Remove Funifier credentials from environment variables
2. ✅ Archive Funifier export data
3. ✅ Update documentation to reference Supabase
4. ✅ Set up monitoring and alerts
5. ✅ Create backup strategy for Supabase data
