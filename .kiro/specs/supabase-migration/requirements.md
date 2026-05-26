# Supabase Migration Requirements

## Overview
Migrate the FNP Ranking application from Funifier API to self-hosted Supabase backend, enabling full control over data, real-time updates, and integration with n8n workflows.

## Current State
- Frontend reads leaderboard data from Funifier API
- Funifier credentials in `.env.local`
- Supabase database is set up with schema
- n8n workflows ready for attendance (presença) and sales (GCOM) data
- Vercel API endpoints exist but not deployed

## Goals
1. **Replace Funifier API** with Supabase for all frontend data fetching
2. **Deploy Vercel API endpoints** for n8n webhook integration
3. **Maintain feature parity** - all current functionality must work
4. **Enable real-time updates** using Supabase subscriptions
5. **Zero downtime** - smooth transition without service interruption

## Functional Requirements

### FR1: Supabase Client Service
- **FR1.1**: Create `SupabaseApiService` class to replace `FunifierApiService`
- **FR1.2**: Implement all methods from Funifier API:
  - `getLeaderboards()` - Fetch list of leaderboards
  - `getLeaderboardData(id, options)` - Fetch leaderboard with players
  - `getPlayerDetails(id)` - Get player information
  - `getPlayerStatus(id)` - Get player stats and challenge progress
- **FR1.3**: Add real-time subscription methods:
  - `subscribeToLeaderboard(id, callback)` - Live leaderboard updates
  - `subscribeToPlayerStats(id, callback)` - Live player stats
  - `subscribeToChallengeEvents(callback)` - Live challenge completions
- **FR1.4**: Maintain same error handling and retry logic as Funifier service

### FR2: Environment Configuration
- **FR2.1**: Add Supabase environment variables to `.env.example`:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- **FR2.2**: Add server-side variables for API routes:
  - `SUPABASE_SERVICE_ROLE_KEY` (secret, not exposed to client)
- **FR2.3**: Update `.env.production` with production Supabase credentials
- **FR2.4**: Keep Funifier variables during transition period

### FR3: Vercel API Endpoints
- **FR3.1**: `/api/presenca-webhook` - Handle RFID attendance from Raspberry Pi
  - Accept: `{ uid, station, ts }`
  - Lookup player by UID in `players.extra.uid`
  - Call `log_presenca()` function
  - Award 5 points for first daily check-in
  - Return success/error response
- **FR3.2**: `/api/gcom-sale-webhook` - Handle sales data from GCOM MySQL
  - Accept: `{ _id (player_code), delivery_title, price }`
  - Lookup player by player_code
  - Call `log_sale()` function
  - Award points: `FLOOR(price × 0.1)` if player has presence today
  - Return success/error response
- **FR3.3**: Both endpoints must use `SUPABASE_SERVICE_ROLE_KEY` for database access
- **FR3.4**: Implement proper error handling and logging

### FR4: Frontend Integration
- **FR4.1**: Update `App.tsx` to use `SupabaseApiService` instead of `FunifierApiService`
- **FR4.2**: Update `useChickenRaceManager` hook to work with Supabase service
- **FR4.3**: Enable real-time subscriptions for live leaderboard updates
- **FR4.4**: Update `DailyGoalProgress` component to fetch from Supabase
- **FR4.5**: Maintain demo mode fallback if Supabase is unavailable

### FR5: Data Migration
- **FR5.1**: Players table must have UIDs populated in `extra.uid` field
- **FR5.2**: Initial leaderboard data must be seeded
- **FR5.3**: Challenge definitions must be populated
- **FR5.4**: Verify data integrity after migration

## Non-Functional Requirements

### NFR1: Performance
- **NFR1.1**: Leaderboard queries must complete in < 500ms
- **NFR1.2**: Real-time updates must appear within 2 seconds
- **NFR1.3**: API endpoints must respond in < 300ms

### NFR2: Security
- **NFR2.1**: Use Row Level Security (RLS) policies on all tables
- **NFR2.2**: Never expose `SERVICE_ROLE_KEY` to client
- **NFR2.3**: Validate all webhook inputs
- **NFR2.4**: Use HTTPS for all Supabase connections

### NFR3: Reliability
- **NFR3.1**: Implement retry logic for failed Supabase queries
- **NFR3.2**: Graceful degradation if Supabase is unavailable
- **NFR3.3**: Log all errors for debugging
- **NFR3.4**: Monitor webhook endpoint health

### NFR4: Maintainability
- **NFR4.1**: Keep same TypeScript interfaces as Funifier
- **NFR4.2**: Document all Supabase queries
- **NFR4.3**: Add JSDoc comments to all service methods
- **NFR4.4**: Update migration checklist as tasks complete

## Success Criteria
1. ✅ Frontend loads leaderboard data from Supabase
2. ✅ Real-time updates work without page refresh
3. ✅ Attendance webhook awards points correctly
4. ✅ Sales webhook awards points correctly
5. ✅ No console errors in production
6. ✅ Performance meets NFR requirements
7. ✅ All existing features work identically
8. ✅ Funifier can be safely decommissioned

## Out of Scope
- Migrating historical data from Funifier (start fresh)
- Changing UI/UX design
- Adding new features beyond current functionality
- Mobile app integration

## Dependencies
- Supabase instance running at `https://fnp.centralsupernova.com.br`
- n8n workflows configured and ready
- Vercel deployment pipeline
- Raspberry Pi with RFID reader
- GCOM MySQL database access

## Risks & Mitigation
| Risk | Impact | Mitigation |
|------|--------|------------|
| Data loss during migration | High | Keep Funifier active during transition |
| Real-time subscriptions fail | Medium | Implement polling fallback |
| Webhook endpoint downtime | High | Add retry logic in n8n workflows |
| Performance degradation | Medium | Load test before full rollout |
| UID mapping errors | High | Validate all player UIDs before go-live |

## Acceptance Criteria
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing confirms all features work
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] Documentation updated
- [ ] Stakeholder approval obtained
