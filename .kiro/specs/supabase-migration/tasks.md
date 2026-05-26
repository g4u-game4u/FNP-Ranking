# Supabase Migration Tasks

## Task 1: Create Supabase API Service
**Description**: Create `SupabaseApiService` class to replace `FunifierApiService` with same interface

**Subtasks**:
1.1. Create `src/services/supabaseApi.ts` file
1.2. Implement constructor with Supabase client initialization
1.3. Implement `getLeaderboards()` method
1.4. Implement `getLeaderboardData(id, options)` method
1.5. Implement `getPlayerDetails(id)` method
1.6. Implement `getPlayerStatus(id)` method
1.7. Implement error handling and retry logic
1.8. Implement `testConnection()` method
1.9. Add TypeScript types and interfaces
1.10. Add JSDoc comments

**Dependencies**: None

**Acceptance Criteria**:
- All methods return data in same format as Funifier
- Error handling matches Funifier service
- Retry logic works correctly
- TypeScript types are correct
- All methods have JSDoc comments

---

## Task 2: Add Real-time Subscription Methods
**Description**: Implement Supabase real-time subscriptions for live updates

**Subtasks**:
2.1. Implement `subscribeToLeaderboard(id, callback)` method
2.2. Implement `subscribeToPlayerStats(id, callback)` method
2.3. Implement `subscribeToChallengeEvents(callback)` method
2.4. Add subscription cleanup/unsubscribe logic
2.5. Handle subscription errors gracefully
2.6. Test real-time updates

**Dependencies**: Task 1

**Acceptance Criteria**:
- Subscriptions receive updates within 2 seconds
- Cleanup prevents memory leaks
- Error handling works correctly
- Multiple subscriptions can coexist

---

## Task 3: Update Environment Configuration
**Description**: Add Supabase environment variables and update configuration files

**Subtasks**:
3.1. Update `.env.example` with Supabase variables
3.2. Create `.env.production` with production credentials
3.3. Update `vite.config.ts` to define Supabase env vars
3.4. Update `.gitignore` to exclude `.env.production`
3.5. Document environment setup in README

**Dependencies**: None

**Acceptance Criteria**:
- `.env.example` has all required variables
- `.env.production` has correct production credentials
- Vite config exposes variables to client
- `.env.production` is not committed to git

---

## Task 4: Create Presença Webhook Endpoint
**Description**: Create `/api/presenca-webhook.ts` for RFID attendance integration

**Subtasks**:
4.1. Create `api/presenca-webhook.ts` file
4.2. Implement POST request handler
4.3. Validate input (uid, station, ts)
4.4. Lookup player by UID in `players.extra.uid`
4.5. Call `log_presenca()` Supabase function
4.6. Return success/error response
4.7. Add error logging
4.8. Test with sample data

**Dependencies**: Task 3

**Acceptance Criteria**:
- Endpoint accepts POST requests only
- Input validation works correctly
- Player lookup by UID works
- Points are awarded correctly
- Error responses are informative
- Logs errors for debugging

---

## Task 5: Create GCOM Sale Webhook Endpoint
**Description**: Create `/api/gcom-sale-webhook.ts` for sales data integration

**Subtasks**:
5.1. Create `api/gcom-sale-webhook.ts` file
5.2. Implement POST request handler
5.3. Validate input (_id, delivery_title, price)
5.4. Call `log_sale()` Supabase function
5.5. Return success/error response
5.6. Add error logging
5.7. Test with sample data

**Dependencies**: Task 3

**Acceptance Criteria**:
- Endpoint accepts POST requests only
- Input validation works correctly
- Points calculation is correct (FLOOR(price × 0.1))
- Presence check works correctly
- Error responses are informative
- Logs errors for debugging

---

## Task 6: Update Frontend to Use Supabase
**Description**: Switch frontend from Funifier to Supabase API service

**Subtasks**:
6.1. Update `App.tsx` to import `SupabaseApiService`
6.2. Update API config initialization to use Supabase env vars
6.3. Update `useChickenRaceManager` if needed
6.4. Update `DailyGoalProgress` component
6.5. Test all features work correctly
6.6. Verify demo mode fallback works

**Dependencies**: Task 1, Task 2

**Acceptance Criteria**:
- Frontend loads leaderboard data from Supabase
- All features work identically to Funifier version
- Demo mode activates if Supabase unavailable
- No console errors
- Real-time updates work

---

## Task 7: Enable Real-time Updates in Frontend
**Description**: Implement real-time subscriptions in React components

**Subtasks**:
7.1. Update `useChickenRaceManager` to subscribe to leaderboard updates
7.2. Handle subscription cleanup on unmount
7.3. Update UI when real-time data arrives
7.4. Add loading states for subscriptions
7.5. Test real-time updates work correctly

**Dependencies**: Task 2, Task 6

**Acceptance Criteria**:
- Leaderboard updates without page refresh
- Subscriptions clean up properly
- UI updates smoothly
- No memory leaks
- Performance is acceptable

---

## Task 8: Deploy Vercel API Endpoints
**Description**: Deploy webhook endpoints to Vercel production

**Subtasks**:
8.1. Commit all changes to git
8.2. Push to GitHub
8.3. Deploy to Vercel: `vercel --prod`
8.4. Verify endpoints are live
8.5. Test endpoints with curl
8.6. Update n8n workflows with production URLs

**Dependencies**: Task 4, Task 5

**Acceptance Criteria**:
- Endpoints are accessible at production URLs
- Endpoints respond correctly to test requests
- Environment variables are set in Vercel
- n8n workflows have correct URLs

---

## Task 9: Activate n8n Workflows
**Description**: Activate n8n workflows for attendance and sales

**Subtasks**:
9.1. Import `presenca-supabase.json` to n8n
9.2. Update API URL in presença workflow
9.3. Test presença workflow manually
9.4. Activate presença workflow
9.5. Import `gcom-sales-supabase.json` to n8n
9.6. Update API URL and MySQL credentials in GCOM workflow
9.7. Test GCOM workflow manually
9.8. Activate GCOM workflow

**Dependencies**: Task 8

**Acceptance Criteria**:
- Both workflows are imported successfully
- URLs point to production endpoints
- Manual tests pass
- Workflows are activated
- Execution logs show success

---

## Task 10: Populate Player UIDs
**Description**: Add UIDs to players table for RFID lookup

**Subtasks**:
10.1. Get list of players with UIDs from user
10.2. Create SQL script to update `players.extra.uid`
10.3. Run SQL in Supabase Studio
10.4. Verify all active players have UIDs
10.5. Test UID lookup works

**Dependencies**: None

**Acceptance Criteria**:
- All 7 players have UIDs in database
- UID lookup query works correctly
- Presença webhook can find players by UID

---

## Task 11: Seed Initial Data
**Description**: Populate leaderboards and challenges tables

**Subtasks**:
11.1. Create SQL script for leaderboard data
11.2. Create SQL script for challenge data
11.3. Run scripts in Supabase Studio
11.4. Verify data is correct
11.5. Test frontend loads data correctly

**Dependencies**: None

**Acceptance Criteria**:
- At least one leaderboard exists
- Leaderboard has entries for all players
- Frontend displays leaderboard correctly

---

## Task 12: Integration Testing
**Description**: Test complete end-to-end flow

**Subtasks**:
12.1. Test RFID scan → presença webhook → points awarded
12.2. Test GCOM sale → sale webhook → points awarded
12.3. Test frontend displays updated points
12.4. Test real-time updates work
12.5. Test error scenarios
12.6. Monitor logs for 24 hours

**Dependencies**: All previous tasks

**Acceptance Criteria**:
- RFID scan awards points correctly
- Sales award points correctly
- Frontend updates in real-time
- No errors in logs for 24 hours
- Performance meets requirements

---

## Task 13: Remove Funifier Code
**Description**: Clean up Funifier-related code and configuration

**Subtasks**:
13.1. Remove `src/services/funifierApi.ts`
13.2. Remove `src/config/api.ts` if Funifier-specific
13.3. Remove Funifier environment variables from `.env.example`
13.4. Remove Funifier credentials from Vercel
13.5. Update documentation
13.6. Archive migration files

**Dependencies**: Task 12

**Acceptance Criteria**:
- No Funifier code remains
- No Funifier environment variables
- Documentation is updated
- Migration files are archived

---

## Task 14: Update Documentation
**Description**: Update all documentation to reflect Supabase migration

**Subtasks**:
14.1. Update README.md
14.2. Update DEPLOYMENT.md
14.3. Update MIGRATION_CHECKLIST.md
14.4. Create SUPABASE_SETUP.md guide
14.5. Update API documentation
14.6. Update troubleshooting guide

**Dependencies**: Task 13

**Acceptance Criteria**:
- All documentation is accurate
- Setup guide is complete
- API documentation is current
- Troubleshooting guide is helpful

---

## Task 15: Final Validation
**Description**: Final checks before declaring migration complete

**Subtasks**:
15.1. Run all unit tests
15.2. Run all integration tests
15.3. Performance benchmark
15.4. Security audit
15.5. User acceptance testing
15.6. Stakeholder approval

**Dependencies**: Task 14

**Acceptance Criteria**:
- All tests pass
- Performance meets requirements
- Security audit passes
- Users report no issues
- Stakeholders approve

---

## Execution Order

```
Task 1 (Supabase Service) ──┬──> Task 2 (Real-time) ──┬──> Task 6 (Frontend) ──> Task 7 (Real-time UI)
                             │                          │
Task 3 (Environment) ────────┼──> Task 4 (Presença) ───┤
                             │                          │
                             └──> Task 5 (GCOM) ────────┴──> Task 8 (Deploy) ──> Task 9 (n8n)
                                                                                        │
Task 10 (UIDs) ──────────────────────────────────────────────────────────────────────┤
                                                                                        │
Task 11 (Seed Data) ─────────────────────────────────────────────────────────────────┤
                                                                                        │
                                                                                        v
                                                                                  Task 12 (Testing)
                                                                                        │
                                                                                        v
                                                                                  Task 13 (Cleanup)
                                                                                        │
                                                                                        v
                                                                                  Task 14 (Docs)
                                                                                        │
                                                                                        v
                                                                                  Task 15 (Validation)
```

## Estimated Timeline

- **Tasks 1-3**: 4 hours (Core service and config)
- **Tasks 4-5**: 2 hours (API endpoints)
- **Tasks 6-7**: 3 hours (Frontend integration)
- **Task 8**: 1 hour (Deployment)
- **Task 9**: 1 hour (n8n activation)
- **Tasks 10-11**: 1 hour (Data setup)
- **Task 12**: 24 hours (Monitoring)
- **Tasks 13-15**: 2 hours (Cleanup and validation)

**Total**: ~14 hours active work + 24 hours monitoring

## Priority

**Critical Path**: Tasks 1 → 2 → 6 → 7 → 8 → 9 → 12

**Can be done in parallel**:
- Task 3 (Environment) with Task 1
- Task 10 (UIDs) anytime before Task 12
- Task 11 (Seed Data) anytime before Task 12
- Tasks 4-5 (Webhooks) with Task 1-2

## Notes

- Keep Funifier active until Task 12 is complete
- Test each task thoroughly before moving to next
- Monitor logs continuously during Task 12
- Have rollback plan ready at each stage
- Document any issues encountered
