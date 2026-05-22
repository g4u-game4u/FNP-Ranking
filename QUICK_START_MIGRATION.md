# Quick Start: Funifier to Supabase Migration

## TL;DR - 5 Steps to Migrate

### 1️⃣ Run Database Schema (5 minutes)

Open Supabase Studio and run the schema:

```
URL: https://fnp.centralsupernova.com.br
User: supabase
Pass: 49728e7a85bd404966c58cce1327cd10
```

1. Go to SQL Editor
2. Copy contents of `supabase-schema.sql`
3. Paste and click "Run"
4. Verify tables created (should see 7 tables)

### 2️⃣ Export Funifier Data (2-5 minutes)

```bash
npm run migrate:export
```

This creates `funifier-export/` folder with your current data.

### 3️⃣ Import to Supabase (2-5 minutes)

```bash
npm run migrate:import
```

Watch the console - it will show progress and any errors.

### 4️⃣ Add Environment Variables

Add to `.env.local`:

```env
VITE_SUPABASE_URL=https://fnp.centralsupernova.com.br
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc5MzMzOTU1LCJleHAiOjE5MzcwMTM5NTV9.2m9jUfgKs8wuBHA6s0omP2ktzJ0dlreeJ_n2--djKPw
VITE_USE_SUPABASE=true
```

### 5️⃣ Update Code to Use Supabase

Edit `src/services/index.ts`:

```typescript
// Add at the top
import { SupabaseApiService } from './supabaseApi';

// Replace the export
export { SupabaseApiService as FunifierApiService };
```

Or use feature flag approach (see MIGRATION_GUIDE.md).

### ✅ Test It

```bash
npm run dev
```

Open http://localhost:5173 and verify leaderboards display correctly.

## Troubleshooting

### "Cannot connect to Supabase"
- Check if Supabase instance is running
- Verify URL is correct: https://fnp.centralsupernova.com.br
- Check firewall/network settings

### "No data showing"
- Verify import script completed successfully
- Check Supabase Studio → Table Editor → leaderboard_entries
- Ensure today's date has entries

### "Export failed"
- Check Funifier credentials in `.env.local`
- Verify Funifier API is accessible
- Try with smaller dataset first

## What Gets Migrated?

✅ All leaderboards
✅ All players  
✅ Current rankings
✅ Player positions and scores
✅ Previous positions (for move indicators)

❌ Historical data (only current snapshot)
❌ Challenge progress (structure ready, needs data)

## Rollback

If something goes wrong:

```env
# In .env.local
VITE_USE_SUPABASE=false
```

Restart dev server - back to Funifier!

## Need More Details?

- **Full Guide**: [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
- **Status**: [MIGRATION_STATUS.md](./MIGRATION_STATUS.md)
- **Schema Details**: [supabase-schema.sql](./supabase-schema.sql)
- **API Service**: [src/services/supabaseApi.ts](./src/services/supabaseApi.ts)

## Estimated Time

- **Minimum**: 15 minutes (basic migration)
- **Recommended**: 1 hour (with testing)
- **Full**: 2-3 hours (with validation and deployment)
