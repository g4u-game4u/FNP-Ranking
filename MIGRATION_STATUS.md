# Migration Status: Funifier → Supabase

## ✅ Completed Tasks

### 1. Configuration
- ✅ **Removed Supabase MCP** - Not available for self-hosted instances
- ✅ **Configured N8N MCP** - Ready when you have API key (optional)
- ✅ **Using Supabase JS Client** - Direct library integration (best approach)
- ✅ **Documented access methods** - See `SUPABASE_ACCESS_METHODS.md`

### 2. Database Schema
- ✅ Created comprehensive SQL schema (`supabase-schema.sql`)
- ✅ Includes all necessary tables:
  - `leaderboards` - Leaderboard configurations
  - `players` - Player information
  - `leaderboard_entries` - Player rankings with history
  - `challenges` - Challenge definitions
  - `challenge_progress` - Player challenge tracking
  - `challenge_events` - Challenge event log
  - `player_stats` - Aggregated player statistics
- ✅ Added indexes for performance
- ✅ Created database functions for common queries
- ✅ Implemented Row Level Security (RLS) policies
- ✅ Added triggers for automatic timestamp updates

### 3. API Service Layer
- ✅ Created `SupabaseApiService` (`src/services/supabaseApi.ts`)
- ✅ Implements same interface as `FunifierApiService`
- ✅ Includes all methods:
  - `getLeaderboards()` - Fetch all leaderboards
  - `getLeaderboardData()` - Fetch leaderboard with players
  - `getPlayerDetails()` - Get player information
  - `getPlayerStatus()` - Get player stats and challenges
  - `testConnection()` - Verify connectivity
- ✅ Added real-time subscription methods:
  - `subscribeToLeaderboard()` - Live leaderboard updates
  - `subscribeToChallengeEvents()` - Live challenge events
- ✅ Error handling and retry logic
- ✅ Data transformation from Supabase to Funifier format

### 4. Migration Scripts
- ✅ Created export script (`scripts/export-funifier-data.ts`)
  - Exports leaderboards from Funifier
  - Exports player rankings
  - Optional: Export player details and statuses
  - Generates summary report
- ✅ Created import script (`scripts/import-to-supabase.ts`)
  - Imports leaderboards to Supabase
  - Imports players with deduplication
  - Imports leaderboard entries
  - Initializes player statistics
  - Handles errors gracefully
- ✅ Added npm scripts to package.json:
  - `npm run migrate:export` - Export from Funifier
  - `npm run migrate:export:full` - Full export with details
  - `npm run migrate:import` - Import to Supabase
  - `npm run migrate:schema` - Reminder to run SQL schema

### 5. Documentation
- ✅ Created migration plan (`FUNIFIER_TO_SUPABASE_MIGRATION.md`)
- ✅ Created step-by-step guide (`MIGRATION_GUIDE.md`)
- ✅ Documented database schema
- ✅ Documented API equivalence
- ✅ Added troubleshooting section
- ✅ Included rollback plan

### 6. Dependencies
- ✅ Installed `@supabase/supabase-js` client library
- ✅ Installed `tsx` for running TypeScript scripts

## 🔄 Next Steps (In Order)

### Immediate Actions

1. **Run Database Schema**
   ```bash
   # Option 1: Via Supabase Studio
   # - Open https://fnp.centralsupernova.com.br
   # - Login with credentials
   # - Go to SQL Editor
   # - Paste and run supabase-schema.sql
   
   # Option 2: Via psql
   psql -h 127.0.0.1 -p 5436 -U postgres -d postgres -f supabase-schema.sql
   ```

2. **Export Current Funifier Data**
   ```bash
   npm run migrate:export
   ```
   - Review exported data in `funifier-export/` directory
   - Check `export-summary.json` for statistics

3. **Import Data to Supabase**
   ```bash
   npm run migrate:import
   ```
   - Monitor console output for errors
   - Verify data in Supabase Studio

4. **Verify Data Integrity**
   - Check leaderboard count matches
   - Verify player count matches
   - Spot-check a few player rankings
   - Ensure no data loss occurred

### Testing Phase

5. **Test Supabase API Service**
   - Create test script to verify all methods work
   - Test with actual leaderboard IDs
   - Verify data format matches expectations

6. **Update Application Code**
   - Add feature flag to switch between Funifier/Supabase
   - Test application with Supabase backend
   - Verify UI displays correctly
   - Test real-time updates

7. **Parallel Testing**
   - Run both Funifier and Supabase in parallel
   - Compare results for consistency
   - Monitor for any discrepancies

### Deployment Phase

8. **Update Environment Variables**
   - Add Supabase credentials to Vercel
   - Keep Funifier credentials as backup
   - Set feature flag to use Supabase

9. **Deploy to Staging**
   - Deploy with Supabase enabled
   - Run smoke tests
   - Monitor for errors

10. **Production Deployment**
    - Deploy to production
    - Monitor closely for first 24 hours
    - Be ready to rollback if needed

### Post-Migration

11. **Cleanup**
    - Remove Funifier credentials after stable period
    - Archive export data
    - Update documentation

12. **Optimization**
    - Monitor query performance
    - Add caching if needed
    - Optimize database indexes

## 📋 Configuration Checklist

### Environment Variables Needed

```env
# Current (Funifier) - Keep for export
✅ VITE_FUNIFIER_SERVER_URL
✅ VITE_FUNIFIER_API_KEY
✅ VITE_FUNIFIER_AUTH_TOKEN

# New (Supabase) - Add these
⏳ VITE_SUPABASE_URL=https://fnp.centralsupernova.com.br
⏳ VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
⏳ SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (server-side only)

# Feature Flag
⏳ VITE_USE_SUPABASE=false (set to true when ready)
```

### Supabase Access

- ✅ Studio URL: https://fnp.centralsupernova.com.br
- ✅ Studio User: supabase
- ✅ Studio Password: 49728e7a85bd404966c58cce1327cd10
- ✅ Postgres Host: 127.0.0.1:5436
- ✅ Postgres User: postgres
- ✅ Postgres Password: 15125f6c9a03be567f93215b5bd58c40
- ✅ Anon Key: Available
- ✅ Service Role Key: Available

## 🎯 Success Criteria

- [ ] All leaderboards migrated successfully
- [ ] All players migrated successfully
- [ ] All rankings preserved accurately
- [ ] Application displays data correctly
- [ ] Real-time updates working
- [ ] No performance degradation
- [ ] Zero data loss
- [ ] Rollback plan tested and ready

## ⚠️ Important Notes

### MCP Server Not Available

**Self-hosted Supabase instances do not include the MCP server.** The MCP server is only available on Supabase's hosted cloud platform at `https://mcp.supabase.com/mcp`.

For your self-hosted instance, you will:
- ✅ Use the **Supabase JavaScript client library** directly (already configured)
- ✅ Use the **SupabaseApiService** in `src/services/supabaseApi.ts`
- ❌ NOT use MCP tools for Supabase operations

The MCP configuration has been removed from `.kiro/settings/mcp.json` since it's not applicable to self-hosted instances.

### What This Means

You'll interact with Supabase through:
1. **Supabase Studio** (Web UI) - For manual database operations
2. **Supabase JS Client** (Code) - For application integration
3. **Direct PostgreSQL** (Optional) - For advanced operations
4. **N8N** (Optional) - For automation workflows

This is actually simpler and more direct than using MCP!

2. **Real-Time**: Ensure Supabase Realtime is enabled in your instance for live updates.

3. **Challenge System**: The challenge tracking system is set up but may need additional business logic from Funifier to be fully replicated.

4. **Historical Data**: The migration captures current state. Historical trends may need separate migration if required.

## 📞 Support Resources

- **Supabase Docs**: https://supabase.com/docs
- **Supabase JS Client**: https://supabase.com/docs/reference/javascript
- **Migration Guide**: See `MIGRATION_GUIDE.md`
- **Schema Reference**: See `supabase-schema.sql`
- **API Service**: See `src/services/supabaseApi.ts`

## 🔄 Rollback Procedure

If issues occur:

1. Set `VITE_USE_SUPABASE=false`
2. Redeploy application
3. System reverts to Funifier
4. Investigate issues
5. Fix and retry migration

## 📊 Current Status: Ready for Step 1

**You are here**: Database schema created, ready to be executed in Supabase.

**Next action**: Run `supabase-schema.sql` in Supabase Studio SQL Editor.
