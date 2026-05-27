/**
 * Import data into Supabase
 * This script reads the exported JSON files and imports them into Supabase
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Supabase configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://fnp.centralsupernova.com.br';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Input directory
const INPUT_DIR = path.join(__dirname, '..', 'data-export');

// Create Supabase client with service role key (full access)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
  },
});

/**
 * Read JSON file
 */
function readJsonFile(filename: string): any {
  const filepath = path.join(INPUT_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.error(`❌ File not found: ${filename}`);
    return null;
  }
  const content = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Import leaderboards
 */
async function importLeaderboards(leaderboards: any[]): Promise<Map<string, string>> {
  console.log(`\n📊 Importing ${leaderboards.length} leaderboards...`);
  const idMap = new Map<string, string>(); // old_id -> supabase_id
  
  for (const lb of leaderboards) {
    try {
      const { data, error } = await supabase
        .from('leaderboards')
        .insert({
          funifier_id: lb._id,
          title: lb.title,
          description: lb.description || '',
          principal_type: lb.principalType || 0,
          operation_type: lb.operation?.type || 0,
          achievement_type: lb.operation?.achievement_type || 0,
          operation_item: lb.operation?.item || '',
          sort_order: lb.operation?.sort || -1,
          period_type: lb.period?.type || 0,
          period_time_amount: lb.period?.timeAmount || 0,
          period_time_scale: lb.period?.timeScale || 0,
          is_active: true,
        })
        .select()
        .single();
      
      if (error) {
        console.error(`   ❌ Error importing leaderboard ${lb._id}:`, error.message);
      } else {
        idMap.set(lb._id, data.id);
        console.log(`   ✅ Imported: ${lb.title} (${lb._id} -> ${data.id})`);
      }
    } catch (error: any) {
      console.error(`   ❌ Exception importing leaderboard ${lb._id}:`, error.message);
    }
  }
  
  return idMap;
}

/**
 * Extract and import unique players from leaderboard data
 */
async function importPlayers(leaderboardData: Record<string, any>): Promise<Map<string, string>> {
  console.log('\n👥 Extracting and importing players...');
  const playerMap = new Map<string, any>(); // player_code -> player_data
  const idMap = new Map<string, string>(); // player_code -> supabase_id
  
  // Extract unique players
  Object.values(leaderboardData).forEach((data: any) => {
    if (data.players && Array.isArray(data.players)) {
      data.players.forEach((player: any) => {
        const playerCode = player.player || player._id;
        if (!playerMap.has(playerCode)) {
          playerMap.set(playerCode, player);
        }
      });
    }
  });
  
  console.log(`   Found ${playerMap.size} unique players`);
  
  // Import players
  for (const [playerCode, player] of playerMap.entries()) {
    try {
      const { data, error } = await supabase
        .from('players')
        .insert({
          funifier_id: player._id,
          player_code: playerCode,
          name: player.name || playerCode,
          image_url: player.image || null,
          extra: player.extra || {},
          is_active: true,
        })
        .select()
        .single();
      
      if (error) {
        // Check if player already exists
        if (error.code === '23505') { // Unique violation
          const { data: existing } = await supabase
            .from('players')
            .select('id')
            .eq('player_code', playerCode)
            .single();
          
          if (existing) {
            idMap.set(playerCode, existing.id);
            console.log(`   ℹ️  Player already exists: ${player.name} (${playerCode})`);
          }
        } else {
          console.error(`   ❌ Error importing player ${playerCode}:`, error.message);
        }
      } else {
        idMap.set(playerCode, data.id);
        console.log(`   ✅ Imported: ${player.name} (${playerCode} -> ${data.id})`);
      }
    } catch (error: any) {
      console.error(`   ❌ Exception importing player ${playerCode}:`, error.message);
    }
  }
  
  return idMap;
}

/**
 * Import leaderboard entries
 */
async function importLeaderboardEntries(
  leaderboardData: Record<string, any>,
  leaderboardIdMap: Map<string, string>,
  playerIdMap: Map<string, string>
): Promise<void> {
  console.log('\n📈 Importing leaderboard entries...');
  const today = new Date().toISOString().split('T')[0];
  let successCount = 0;
  let errorCount = 0;
  
  for (const [sourceLeaderboardId, data] of Object.entries(leaderboardData)) {
    const supabaseLeaderboardId = leaderboardIdMap.get(sourceLeaderboardId);
    
    if (!supabaseLeaderboardId) {
      console.error(`   ⚠️  Skipping entries for unknown leaderboard: ${sourceLeaderboardId}`);
      continue;
    }
    
    if (!data.players || !Array.isArray(data.players)) {
      continue;
    }
    
    console.log(`   Processing ${data.players.length} entries for leaderboard ${sourceLeaderboardId}...`);
    
    for (const player of data.players) {
      const playerCode = player.player || player._id;
      const supabasePlayerId = playerIdMap.get(playerCode);
      
      if (!supabasePlayerId) {
        console.error(`   ⚠️  Skipping entry for unknown player: ${playerCode}`);
        errorCount++;
        continue;
      }
      
      try {
        const { error } = await supabase
          .from('leaderboard_entries')
          .insert({
            leaderboard_id: supabaseLeaderboardId,
            player_id: supabasePlayerId,
            position: player.position,
            total: player.total,
            previous_position: player.previous_position || null,
            previous_total: player.previous_total || null,
            snapshot_date: today,
          });
        
        if (error) {
          if (error.code !== '23505') { // Ignore duplicate entries
            console.error(`   ❌ Error importing entry:`, error.message);
            errorCount++;
          }
        } else {
          successCount++;
        }
      } catch (error: any) {
        console.error(`   ❌ Exception importing entry:`, error.message);
        errorCount++;
      }
    }
  }
  
  console.log(`   ✅ Imported ${successCount} entries`);
  if (errorCount > 0) {
    console.log(`   ⚠️  ${errorCount} errors occurred`);
  }
}

/**
 * Initialize player stats
 */
async function initializePlayerStats(playerIdMap: Map<string, string>): Promise<void> {
  console.log('\n📊 Initializing player stats...');
  let successCount = 0;
  
  for (const [playerCode, playerId] of playerIdMap.entries()) {
    try {
      const { error } = await supabase
        .from('player_stats')
        .insert({
          player_id: playerId,
          total_challenges: 0,
          total_points: 0,
          point_categories: {},
          level_progress: {},
        });
      
      if (error && error.code !== '23505') { // Ignore duplicates
        console.error(`   ❌ Error initializing stats for ${playerCode}:`, error.message);
      } else {
        successCount++;
      }
    } catch (error: any) {
      console.error(`   ❌ Exception initializing stats for ${playerCode}:`, error.message);
    }
  }
  
  console.log(`   ✅ Initialized stats for ${successCount} players`);
}

/**
 * Main import function
 */
async function importToSupabase() {
  console.log('🚀 Starting Supabase import...\n');
  
  // Validate configuration
  if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
    process.exit(1);
  }
  
  // Check if export directory exists
  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`❌ Export directory not found: ${INPUT_DIR}`);
    console.error('   Please run the export script first: npm run migrate:import');
    process.exit(1);
  }
  
  // Read exported data
  const leaderboards = readJsonFile('leaderboards.json');
  const leaderboardData = readJsonFile('leaderboard-data.json');
  
  if (!leaderboards || !leaderboardData) {
    console.error('❌ Required export files not found');
    process.exit(1);
  }
  
  // Test connection
  console.log('🔌 Testing Supabase connection...');
  const { error: connectionError } = await supabase.from('leaderboards').select('id').limit(1);
  if (connectionError) {
    console.error('❌ Failed to connect to Supabase:', connectionError.message);
    process.exit(1);
  }
  console.log('✅ Connected to Supabase');
  
  // Import data
  const leaderboardIdMap = await importLeaderboards(leaderboards);
  const playerIdMap = await importPlayers(leaderboardData);
  await importLeaderboardEntries(leaderboardData, leaderboardIdMap, playerIdMap);
  await initializePlayerStats(playerIdMap);
  
  console.log('\n✅ Import completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - Leaderboards imported: ${leaderboardIdMap.size}`);
  console.log(`   - Players imported: ${playerIdMap.size}`);
  console.log('\n💡 Next steps:');
  console.log('   1. Verify data in Supabase Studio');
  console.log('   2. Test the Supabase API service');
  console.log('   3. Update environment variables to use Supabase');
}

// Run import
importToSupabase().catch((error) => {
  console.error('❌ Import failed:', error);
  process.exit(1);
});
