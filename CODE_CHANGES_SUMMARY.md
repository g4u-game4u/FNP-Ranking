# Code Changes Summary - Supabase Migration

## Overview

The application code has been updated to support both Funifier and Supabase backends with a feature flag system. You can switch between them by changing a single environment variable.

## Files Modified

### 1. Core Configuration

#### `src/config/features.ts` (NEW)
- Feature flag system
- Controls which backend to use
- Reads from `VITE_USE_SUPABASE` environment variable

#### `src/services/index.ts` (MODIFIED)
- Exports `ApiService` that switches between Funifier and Supabase
- Based on `USE_SUPABASE` feature flag
- Both services still available for direct import if needed

### 2. New Service

#### `src/services/supabaseApi.ts` (NEW)
- Complete Supabase API service
- Implements same interface as `FunifierApiService`
- Drop-in replacement - no code changes needed
- Includes real-time subscriptions
- Error handling and retry logic

### 3. Hooks Updated

#### `src/hooks/useChickenRaceManager.ts`
- Changed: `import { FunifierApiService }` → `import { ApiService }`
- Changed: `new FunifierApiService()` → `new ApiService()`
- Now uses whichever backend is configured

#### `src/hooks/useRealTimeUpdates.ts`
- Changed: `import { FunifierApiService }` → `import { ApiService }`
- Updated type: `apiService: InstanceType<typeof ApiService>`

#### `src/hooks/useChallengeProgress.ts`
- Changed: `import { FunifierApiService }` → `import { ApiService }`
- Updated type: `apiService: InstanceType<typeof ApiService> | null`

### 4. Components Updated

#### `src/components/DailyGoalProgress.tsx`
- Changed: `import type { FunifierApiService }` → `import type { ApiService }`
- Updated type: `apiService?: InstanceType<typeof ApiService> | null`

### 5. Environment Configuration

#### `.env.example` (MODIFIED)
- Added Supabase configuration section
- Added `VITE_USE_SUPABASE` feature flag
- Kept Funifier configuration for backward compatibility

### 6. Scripts

#### `scripts/setup-supabase-env.js` (NEW)
- Automated setup script
- Adds Supabase credentials to `.env.local`
- Safe - won't overwrite existing configuration

#### `scripts/export-funifier-data.ts` (NEW)
- Exports data from Funifier API
- Saves to JSON files for migration

#### `scripts/import-to-supabase.ts` (NEW)
- Imports exported data to Supabase
- Handles deduplication and errors

## How It Works

### Feature Flag System

```typescript
// src/config/features.ts
export const USE_SUPABASE = import.meta.env.VITE_USE_SUPABASE === 'true';

// src/services/index.ts
export const ApiService = USE_SUPABASE ? SupabaseApiService : FunifierApiService;
```

### Usage in Code

```typescript
// Before (Funifier only)
import { FunifierApiService } from '../services/funifierApi';
const api = new FunifierApiService(config);

// After (Supports both)
import { ApiService } from '../services';
const api = new ApiService(config);
```

The `ApiService` will be either `FunifierApiService` or `SupabaseApiService` depending on the `VITE_USE_SUPABASE` environment variable.

## Environment Variables

### Using Funifier (Current/Default)

```env
VITE_FUNIFIER_SERVER_URL=https://service2.funifier.com/v3
VITE_FUNIFIER_API_KEY=your_api_key
VITE_FUNIFIER_AUTH_TOKEN=Basic_your_token
VITE_USE_SUPABASE=false
```

### Using Supabase (After Migration)

```env
VITE_SUPABASE_URL=https://fnp.centralsupernova.com.br
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_USE_SUPABASE=true

# Keep Funifier vars as backup
VITE_FUNIFIER_SERVER_URL=https://service2.funifier.com/v3
VITE_FUNIFIER_API_KEY=your_api_key
VITE_FUNIFIER_AUTH_TOKEN=Basic_your_token
```

## Quick Setup

### 1. Add Supabase Configuration

```bash
npm run setup:supabase
```

This creates/updates `.env.local` with Supabase credentials.

### 2. Test with Current Backend (Funifier)

```bash
npm run dev
```

Should work exactly as before.

### 3. Switch to Supabase

Edit `.env.local`:
```env
VITE_USE_SUPABASE=true
```

Restart dev server:
```bash
npm run dev
```

### 4. Switch Back to Funifier

Edit `.env.local`:
```env
VITE_USE_SUPABASE=false
```

Restart dev server.

## API Compatibility

Both services implement the same interface:

```typescript
interface ApiServiceInterface {
  getLeaderboards(): Promise<Leaderboard[]>;
  getLeaderboardData(id: string, options?: LeaderboardOptions): Promise<LeaderboardResponse>;
  getPlayerDetails(playerId: string): Promise<Player>;
  getPlayerStatus(playerId: string): Promise<PlayerStatus>;
  testConnection(): Promise<boolean>;
}
```

### Supabase Extras

The Supabase service also provides:

```typescript
// Real-time subscriptions
subscribeToLeaderboard(leaderboardId: string, callback: Function);
subscribeToChallengeEvents(callback: Function);

// Direct client access
getClient(): SupabaseClient;
```

## Testing

### Test with Funifier

```bash
# Ensure VITE_USE_SUPABASE=false
npm run dev
```

### Test with Supabase

```bash
# Ensure VITE_USE_SUPABASE=true
npm run dev
```

### Run Tests

```bash
npm run test
```

Note: Tests currently use Funifier mocks. Supabase test mocks can be added later.

## Migration Checklist

- [x] Create Supabase service
- [x] Add feature flag system
- [x] Update all imports
- [x] Update type definitions
- [x] Add environment configuration
- [x] Create setup script
- [x] Update documentation
- [ ] Run database schema in Supabase
- [ ] Export Funifier data
- [ ] Import to Supabase
- [ ] Test with Supabase backend
- [ ] Deploy with Supabase

## Rollback Plan

If issues occur with Supabase:

1. Set `VITE_USE_SUPABASE=false` in environment
2. Restart application
3. System reverts to Funifier immediately

No code changes needed!

## Benefits of This Approach

1. **Zero Downtime**: Switch backends without code changes
2. **Easy Testing**: Test both backends side-by-side
3. **Safe Migration**: Keep Funifier as backup
4. **Gradual Rollout**: Switch environments one at a time
5. **Quick Rollback**: Single environment variable change

## Next Steps

1. **Setup Environment**
   ```bash
   npm run setup:supabase
   ```

2. **Run Database Schema**
   - Open Supabase Studio
   - Run `supabase-schema.sql`

3. **Migrate Data**
   ```bash
   npm run migrate:export
   npm run migrate:import
   ```

4. **Test Locally**
   ```bash
   # Set VITE_USE_SUPABASE=true in .env.local
   npm run dev
   ```

5. **Deploy**
   - Add Supabase env vars to Vercel
   - Set `VITE_USE_SUPABASE=true`
   - Deploy

## Support

- **Code Issues**: Check this document
- **Migration Issues**: See `MIGRATION_GUIDE.md`
- **Supabase Access**: See `SUPABASE_ACCESS_METHODS.md`
- **Quick Start**: See `QUICK_START_MIGRATION.md`
