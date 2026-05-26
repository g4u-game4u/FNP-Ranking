/**
 * Export data from Funifier API to JSON files
 * This script fetches all data from Funifier and saves it for migration to Supabase
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Configuration from environment variables
const FUNIFIER_CONFIG = {
  serverUrl: process.env.VITE_FUNIFIER_SERVER_URL || 'https://service2.funifier.com/v3',
  apiKey: process.env.VITE_FUNIFIER_API_KEY || '',
  authToken: process.env.VITE_FUNIFIER_AUTH_TOKEN || '',
};

// Output directory
const OUTPUT_DIR = path.join(__dirname, '..', 'funifier-export');

// Create axios instance
const api = axios.create({
  baseURL: FUNIFIER_CONFIG.serverUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Authorization: FUNIFIER_CONFIG.authToken,
    'X-API-Key': FUNIFIER_CONFIG.apiKey,
  },
});

interface ExportData {
  leaderboards: any[];
  leaderboardData: Record<string, any>;
  players: any[];
  playerStatuses: Record<string, any>;
  exportDate: string;
  exportTimestamp: number;
}

/**
 * Ensure output directory exists
 */
function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

/**
 * Save data to JSON file
 */
function saveToFile(filename: string, data: any) {
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✅ Saved: ${filename}`);
}

/**
 * Fetch all leaderboards
 */
async function fetchLeaderboards(): Promise<any[]> {
  console.log('📊 Fetching leaderboards...');
  try {
    const response = await api.get('/leaderboard');
    console.log(`   Found ${response.data.length} leaderboards`);
    return response.data;
  } catch (error: any) {
    console.error('❌ Error fetching leaderboards:', error.message);
    return [];
  }
}

/**
 * Fetch leaderboard data with players
 */
async function fetchLeaderboardData(leaderboardId: string): Promise<any> {
  console.log(`📈 Fetching data for leaderboard: ${leaderboardId}`);
  try {
    const response = await api.post(
      `/leaderboard/${leaderboardId}/leader/aggregate?live=true&period=`,
      []
    );
    console.log(`   Found ${response.data.length} players`);
    return {
      leaderboardId,
      players: response.data,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error(`❌ Error fetching leaderboard ${leaderboardId}:`, error.message);
    return {
      leaderboardId,
      players: [],
      error: error.message,
    };
  }
}

/**
 * Fetch player details
 */
async function fetchPlayerDetails(playerId: string): Promise<any> {
  try {
    const response = await api.get(`/players/${playerId}`);
    return response.data;
  } catch (error: any) {
    console.error(`❌ Error fetching player ${playerId}:`, error.message);
    return null;
  }
}

/**
 * Fetch player status
 */
async function fetchPlayerStatus(playerId: string): Promise<any> {
  try {
    const response = await api.get(`/player/${playerId}/status`);
    return response.data;
  } catch (error: any) {
    console.error(`❌ Error fetching player status ${playerId}:`, error.message);
    return null;
  }
}

/**
 * Extract unique player IDs from leaderboard data
 */
function extractPlayerIds(leaderboardData: Record<string, any>): string[] {
  const playerIds = new Set<string>();
  
  Object.values(leaderboardData).forEach((data: any) => {
    if (data.players && Array.isArray(data.players)) {
      data.players.forEach((player: any) => {
        if (player._id) {
          playerIds.add(player._id);
        }
        if (player.player) {
          playerIds.add(player.player);
        }
      });
    }
  });
  
  return Array.from(playerIds);
}

/**
 * Main export function
 */
async function exportFunifierData() {
  console.log('🚀 Starting Funifier data export...\n');
  
  // Validate configuration
  if (!FUNIFIER_CONFIG.apiKey || !FUNIFIER_CONFIG.authToken) {
    console.error('❌ Missing Funifier API credentials in environment variables');
    console.error('   Please set VITE_FUNIFIER_API_KEY and VITE_FUNIFIER_AUTH_TOKEN');
    process.exit(1);
  }
  
  ensureOutputDir();
  
  const exportData: ExportData = {
    leaderboards: [],
    leaderboardData: {},
    players: [],
    playerStatuses: {},
    exportDate: new Date().toISOString(),
    exportTimestamp: Date.now(),
  };
  
  // Step 1: Fetch all leaderboards
  exportData.leaderboards = await fetchLeaderboards();
  saveToFile('leaderboards.json', exportData.leaderboards);
  
  // Step 2: Fetch data for each leaderboard
  console.log('\n📊 Fetching leaderboard data...');
  for (const leaderboard of exportData.leaderboards) {
    const data = await fetchLeaderboardData(leaderboard._id);
    exportData.leaderboardData[leaderboard._id] = data;
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  saveToFile('leaderboard-data.json', exportData.leaderboardData);
  
  // Step 3: Extract unique player IDs
  const playerIds = extractPlayerIds(exportData.leaderboardData);
  console.log(`\n👥 Found ${playerIds.length} unique players`);
  
  // Step 4: Fetch player details (optional - can be slow)
  const fetchPlayerDetails = process.argv.includes('--with-player-details');
  if (fetchPlayerDetails) {
    console.log('\n👤 Fetching player details...');
    for (const playerId of playerIds.slice(0, 10)) { // Limit to first 10 for testing
      const player = await fetchPlayerDetails(playerId);
      if (player) {
        exportData.players.push(player);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    saveToFile('players.json', exportData.players);
  }
  
  // Step 5: Fetch player statuses (optional - can be slow)
  const fetchPlayerStatuses = process.argv.includes('--with-player-statuses');
  if (fetchPlayerStatuses) {
    console.log('\n📊 Fetching player statuses...');
    for (const playerId of playerIds.slice(0, 10)) { // Limit to first 10 for testing
      const status = await fetchPlayerStatus(playerId);
      if (status) {
        exportData.playerStatuses[playerId] = status;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    saveToFile('player-statuses.json', exportData.playerStatuses);
  }
  
  // Save complete export
  saveToFile('complete-export.json', exportData);
  
  // Generate summary
  const summary = {
    exportDate: exportData.exportDate,
    totalLeaderboards: exportData.leaderboards.length,
    totalPlayers: playerIds.length,
    leaderboards: exportData.leaderboards.map((lb: any) => ({
      id: lb._id,
      title: lb.title,
      playerCount: exportData.leaderboardData[lb._id]?.players?.length || 0,
    })),
  };
  
  saveToFile('export-summary.json', summary);
  
  console.log('\n✅ Export completed successfully!');
  console.log(`📁 Data saved to: ${OUTPUT_DIR}`);
  console.log('\n📊 Summary:');
  console.log(`   - Leaderboards: ${summary.totalLeaderboards}`);
  console.log(`   - Unique Players: ${summary.totalPlayers}`);
  console.log('\n💡 Next steps:');
  console.log('   1. Review the exported data in funifier-export/');
  console.log('   2. Run the import script to load data into Supabase');
  console.log('   3. Verify data integrity');
}

// Run export
exportFunifierData().catch((error) => {
  console.error('❌ Export failed:', error);
  process.exit(1);
});
