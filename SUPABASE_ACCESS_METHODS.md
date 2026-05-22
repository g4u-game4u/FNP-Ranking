# Supabase Access Methods

## Self-Hosted vs Cloud Supabase

Your Supabase instance at `https://fnp.centralsupernova.com.br` is **self-hosted**, which means:

- ✅ You have full control over the database
- ✅ You can access it via multiple methods
- ❌ MCP server is NOT available (only on Supabase Cloud)

## Available Access Methods

### 1. Supabase Studio (Web UI) ⭐ Recommended for Manual Operations

**URL**: https://fnp.centralsupernova.com.br  
**Credentials**:
- Username: `supabase`
- Password: `49728e7a85bd404966c58cce1327cd10`

**Use for**:
- Running SQL queries
- Creating/modifying tables
- Viewing data
- Managing RLS policies
- Monitoring logs

**How to use**:
1. Open https://fnp.centralsupernova.com.br in browser
2. Login with credentials
3. Navigate to:
   - **SQL Editor** - Run SQL queries
   - **Table Editor** - View/edit data
   - **Database** - Manage schema
   - **Logs** - View activity

### 2. Supabase JavaScript Client ⭐ Recommended for Application

**Already configured in**: `src/services/supabaseApi.ts`

**Credentials**:
```typescript
const supabase = createClient(
  'https://fnp.centralsupernova.com.br',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc5MzMzOTU1LCJleHAiOjE5MzcwMTM5NTV9.2m9jUfgKs8wuBHA6s0omP2ktzJ0dlreeJ_n2--djKPw'
);
```

**Use for**:
- Application queries
- Real-time subscriptions
- Authentication (if needed)
- File storage (if needed)

**Example**:
```typescript
import { getSupabaseApi } from './services/supabaseApi';

const api = getSupabaseApi();
const leaderboards = await api.getLeaderboards();
```

### 3. Direct PostgreSQL Connection (Advanced)

**Connection Details**:
- Host: `127.0.0.1` (or `fnp.centralsupernova.com.br` if remote)
- Port: `5436`
- Database: `postgres`
- User: `postgres`
- Password: `15125f6c9a03be567f93215b5bd58c40`

**Use for**:
- Advanced SQL operations
- Database migrations
- Bulk data operations
- Performance tuning

**Example with psql**:
```bash
psql -h 127.0.0.1 -p 5436 -U postgres -d postgres
# Enter password when prompted
```

**Example with connection string**:
```
postgresql://postgres:15125f6c9a03be567f93215b5bd58c40@127.0.0.1:5436/postgres
```

### 4. N8N Automation (Optional)

**MCP Configuration**: Available in `.kiro/settings/mcp.json` (disabled)

**Use for**:
- Workflow automation
- Scheduled tasks
- Webhooks
- Data synchronization

**Setup**:
1. Get your N8N API key from https://fnp.centralsupernova.com.br
2. Update `.kiro/settings/mcp.json`:
   ```json
   {
     "mcpServers": {
       "n8n": {
         "env": {
           "N8N_API_KEY": "your_actual_api_key_here"
         },
         "disabled": false
       }
     }
   }
   ```
3. Restart Kiro to load the MCP server

## Why No Supabase MCP?

**MCP (Model Context Protocol)** for Supabase is only available on:
- Supabase Cloud (hosted at supabase.com)
- Accessible at `https://mcp.supabase.com/mcp`

**Self-hosted Supabase** does not include:
- MCP server endpoint
- OAuth integration for MCP
- Dynamic client registration

**This is fine!** The JavaScript client library provides all the functionality you need, and it's actually more direct and efficient.

## Recommended Workflow

### For Development
1. **Write code** using `SupabaseApiService` in your application
2. **Test queries** in Supabase Studio SQL Editor
3. **View data** in Supabase Studio Table Editor
4. **Monitor** in Supabase Studio Logs

### For Migration
1. **Run schema** in Supabase Studio SQL Editor
2. **Export data** using `npm run migrate:export`
3. **Import data** using `npm run migrate:import`
4. **Verify** in Supabase Studio Table Editor

### For Production
1. **Deploy app** with Supabase credentials
2. **Monitor** via Supabase Studio
3. **Automate** with N8N (optional)
4. **Backup** database regularly

## Quick Access Cheat Sheet

| Task | Method | Access |
|------|--------|--------|
| Run SQL | Supabase Studio | https://fnp.centralsupernova.com.br → SQL Editor |
| View data | Supabase Studio | https://fnp.centralsupernova.com.br → Table Editor |
| App queries | JS Client | `import { getSupabaseApi } from './services/supabaseApi'` |
| Migration | Scripts | `npm run migrate:export` / `npm run migrate:import` |
| Advanced SQL | psql | `psql -h 127.0.0.1 -p 5436 -U postgres` |
| Automation | N8N | Configure in `.kiro/settings/mcp.json` |

## Security Notes

### Public (Anon) Key
- ✅ Safe to use in frontend code
- ✅ Protected by Row Level Security (RLS)
- ✅ Can only do what RLS policies allow

### Service Role Key
- ⚠️ **NEVER** expose in frontend code
- ⚠️ Only use in backend/server-side code
- ⚠️ Has full database access (bypasses RLS)
- ✅ Use for migration scripts
- ✅ Use for admin operations

### Postgres Password
- ⚠️ **NEVER** expose publicly
- ⚠️ Only use for direct database access
- ⚠️ Only use in secure environments
- ✅ Use for migrations
- ✅ Use for backups

## Summary

For your self-hosted Supabase migration:

1. ✅ **Use Supabase Studio** for manual database operations
2. ✅ **Use JavaScript Client** (`SupabaseApiService`) in your application
3. ✅ **Use migration scripts** for data transfer
4. ❌ **Don't expect MCP** - it's not available for self-hosted
5. ✅ **Optionally use N8N** for automation

Everything you need is already set up and ready to use! 🚀
