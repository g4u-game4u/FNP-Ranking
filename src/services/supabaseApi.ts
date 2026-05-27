import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import type {
  Leaderboard,
  Player,
  LeaderboardResponse,
  LeaderboardOptions,
  PlayerStatus,
} from '../types';
import {
  validatePlayerName,
  validateNumber,
} from '../utils/validation';

/**
 * Supabase configuration interface
 */
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/**
 * Supabase API Service for handling all database communications
 * Implements same interface as FunifierApiService for drop-in replacement
 */
export class SupabaseApiService {
  private supabase: SupabaseClient;
  private config: SupabaseConfig;
  private retryAttempts = 3;
  private retryDelay = 1000; // Base delay in milliseconds

  constructor(config: SupabaseConfig) {
    if (!config.url || !config.anonKey) {
      throw new Error('Invalid Supabase configuration provided');
    }

    this.config = config;
    this.supabase = createClient(config.url, config.anonKey);
  }

  /**
   * Retry logic with exponential backoff
   * Does NOT retry on 4xx client errors (bad input, not found, etc.)
   */
  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    attempt = 1
  ): Promise<T> {
    try {
      return await requestFn();
    } catch (error) {
      // Don't retry on client errors (4xx) - they won't succeed on retry
      if (error instanceof Error && /4\d{2}|invalid input|not found|bad request/i.test(error.message)) {
        throw error;
      }

      if (attempt >= this.retryAttempts) {
        throw error;
      }

      const delay = this.retryDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));

      return this.retryRequest(requestFn, attempt + 1);
    }
  }

  /**
   * Fetch list of available leaderboards
   */
  public async getLeaderboards(): Promise<Leaderboard[]> {
    return this.retryRequest(async () => {
      const { data, error } = await this.supabase
        .from('leaderboards')
        .select('*')
        .eq('is_active', true)
        .order('title');

      if (error) {
        throw new Error(`Failed to fetch leaderboards: ${error.message}`);
      }

      // Map Supabase schema to Funifier format
      return (data || []).map((lb: any) => ({
        _id: lb.id,
        title: lb.title || `Leaderboard ${lb.id}`,
        description: lb.description || '',
        principalType: lb.principal_type || 0,
        operation: lb.operation_type || 'sum',
        period: lb.period_type || 'all',
      })) as Leaderboard[];
    });
  }

  /**
   * Fetch leaderboard data with players
   */
  public async getLeaderboardData(
    leaderboardId: string,
    options: LeaderboardOptions = {}
  ): Promise<LeaderboardResponse> {
    return this.retryRequest(async () => {
      // Determine the snapshot date
      const snapshotDate = options.period || new Date().toISOString().split('T')[0];

      // Fetch leaderboard entries with player data
      const { data, error } = await this.supabase
        .from('leaderboard_entries')
        .select(`
          *,
          player:players(*)
        `)
        .eq('leaderboard_id', leaderboardId)
        .eq('snapshot_date', snapshotDate)
        .order('position');

      if (error) {
        throw new Error(`Failed to fetch leaderboard data: ${error.message}`);
      }

      // Fetch leaderboard metadata
      const { data: leaderboardData, error: lbError } = await this.supabase
        .from('leaderboards')
        .select('*')
        .eq('id', leaderboardId)
        .single();

      if (lbError) {
        throw new Error(`Failed to fetch leaderboard metadata: ${lbError.message}`);
      }

      // Map to Funifier format
      const leaders = (data || []).map((entry: any) => {
        const player = entry.player;
        return {
          _id: player.id,
          player: player.player_code,
          name: validatePlayerName(player.name || ''),
          position: validateNumber(entry.position),
          total: validateNumber(entry.total),
          previous_position: entry.previous_position
            ? validateNumber(entry.previous_position)
            : undefined,
          previous_total: entry.previous_total
            ? validateNumber(entry.previous_total)
            : undefined,
          move: this.calculateMove(entry.position, entry.previous_position),
          image: player.image_url,
          extra: player.extra || {},
        };
      });

      return {
        leaderboard: {
          _id: leaderboardData.id,
          title: leaderboardData.title,
          description: leaderboardData.description || '',
        },
        leaders,
      } as LeaderboardResponse;
    });
  }

  /**
   * Calculate player movement (up/down/same)
   */
  private calculateMove(
    currentPosition: number,
    previousPosition?: number
  ): 'up' | 'down' | 'same' {
    if (!previousPosition) return 'same';
    if (currentPosition < previousPosition) return 'up';
    if (currentPosition > previousPosition) return 'down';
    return 'same';
  }

  /**
   * Get player details by ID
   */
  public async getPlayerDetails(playerId: string): Promise<Player> {
    return this.retryRequest(async () => {
      const { data, error } = await this.supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch player details: ${error.message}`);
      }

      if (!data) {
        throw new Error('Player not found');
      }

      return {
        _id: data.id,
        player: data.player_code,
        name: validatePlayerName(data.name || ''),
        position: 0, // Will be populated from leaderboard entry
        total: 0, // Will be populated from leaderboard entry
        image: data.image_url,
        extra: data.extra || {},
      } as Player;
    });
  }

  /**
   * Get player status including challenge progress
   */
  public async getPlayerStatus(playerId: string): Promise<PlayerStatus> {
    return this.retryRequest(async () => {
      // Fetch player stats
      const { data: stats, error: statsError } = await this.supabase
        .from('player_stats')
        .select('*')
        .eq('player_id', playerId)
        .single();

      if (statsError) {
        throw new Error(`Failed to fetch player stats: ${statsError.message}`);
      }

      // Fetch challenge progress
      const { data: progress, error: progressError } = await this.supabase
        .from('challenge_progress')
        .select(`
          *,
          challenge:challenges(*)
        `)
        .eq('player_id', playerId);

      if (progressError) {
        throw new Error(`Failed to fetch challenge progress: ${progressError.message}`);
      }

      // Map to Funifier format
      const challengeProgress = (progress || []).map((cp: any) => ({
        challenge_id: cp.challenge.funifier_id || cp.challenge_id,
        challenge_name: cp.challenge.name,
        rules_completed: cp.rules_completed,
        rules_total: cp.rules_total,
        percent_completed: cp.percent_completed,
        times_completed: cp.times_completed,
      }));

      return {
        name: '', // Will be populated from player data
        total_challenges: stats?.total_challenges || 0,
        challenges: {}, // Legacy field
        total_points: stats?.total_points || 0,
        point_categories: stats?.point_categories || {},
        level_progress: stats?.level_progress || {
          percent_completed: 0,
          next_points: 0,
          total_levels: 0,
          percent: 0,
        },
        challenge_progress: challengeProgress,
      } as PlayerStatus;
    });
  }

  /**
   * Subscribe to leaderboard updates in real-time
   */
  public subscribeToLeaderboard(
    leaderboardId: string,
    callback: (data: any) => void
  ): RealtimeChannel {
    return this.supabase
      .channel(`leaderboard:${leaderboardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leaderboard_entries',
          filter: `leaderboard_id=eq.${leaderboardId}`,
        },
        callback
      )
      .subscribe();
  }

  /**
   * Subscribe to player stats updates in real-time
   */
  public subscribeToPlayerStats(
    playerId: string,
    callback: (data: any) => void
  ): RealtimeChannel {
    return this.supabase
      .channel(`player_stats:${playerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'player_stats',
          filter: `player_id=eq.${playerId}`,
        },
        callback
      )
      .subscribe();
  }

  /**
   * Subscribe to challenge events in real-time
   */
  public subscribeToChallengeEvents(
    callback: (data: any) => void
  ): RealtimeChannel {
    return this.supabase
      .channel('challenge_events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'challenge_events',
        },
        callback
      )
      .subscribe();
  }

  /**
   * Test API connection and authentication
   */
  public async testConnection(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('leaderboards')
        .select('id')
        .limit(1);

      return !error;
    } catch (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): SupabaseConfig {
    return { ...this.config };
  }
}
