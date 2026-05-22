import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  Leaderboard,
  Player,
  LeaderboardResponse,
  LeaderboardOptions,
  ApiError,
  PlayerStatus,
} from '../types';

/**
 * Supabase API Service - Replacement for Funifier API
 * Provides the same interface as FunifierApiService for seamless migration
 */
export class SupabaseApiService {
  private supabase: SupabaseClient;
  private retryAttempts = 3;
  private retryDelay = 1000;

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    const url = supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
    const key = supabaseKey || import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error('Supabase URL and Anon Key are required');
    }

    this.supabase = createClient(url, key, {
      auth: {
        persistSession: false, // Kiosk mode - no user sessions
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }

  /**
   * Handle errors and convert to standardized format
   */
  private handleError(error: any): ApiError {
    const timestamp = Date.now();

    // Network errors
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      return {
        type: 'network',
        message: 'Network connection failed. Please check your internet connection.',
        retryable: true,
        timestamp,
        originalError: error,
      };
    }

    // Auth errors
    if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
      return {
        type: 'auth',
        message: 'Authentication failed. Please check your API credentials.',
        retryable: false,
        timestamp,
        originalError: error,
      };
    }

    // Not found
    if (error.code === 'PGRST116') {
      return {
        type: 'validation',
        message: 'Requested resource not found.',
        retryable: false,
        timestamp,
        originalError: error,
      };
    }

    return {
      type: 'validation',
      message: error.message || 'An unexpected error occurred.',
      retryable: false,
      timestamp,
      originalError: error,
    };
  }

  /**
   * Retry logic with exponential backoff
   */
  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    attempt = 1
  ): Promise<T> {
    try {
      return await requestFn();
    } catch (error) {
      const apiError = this.handleError(error);

      if (!apiError.retryable || attempt >= this.retryAttempts) {
        throw apiError;
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
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform Supabase schema to Funifier format
      return (data || []).map((lb) => ({
        _id: lb.funifier_id || lb.id,
        title: lb.title,
        description: lb.description || '',
        principalType: lb.principal_type || 0,
        operation: {
          type: lb.operation_type || 0,
          achievement_type: lb.achievement_type || 0,
          item: lb.operation_item || '',
          sort: lb.sort_order || -1,
        },
        period: {
          type: lb.period_type || 0,
          timeAmount: lb.period_time_amount || 0,
          timeScale: lb.period_time_scale || 0,
        },
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
      // Find leaderboard by funifier_id or id
      const { data: leaderboardData, error: lbError } = await this.supabase
        .from('leaderboards')
        .select('*')
        .or(`funifier_id.eq.${leaderboardId},id.eq.${leaderboardId}`)
        .single();

      if (lbError) throw lbError;
      if (!leaderboardData) throw new Error('Leaderboard not found');

      // Get leaderboard entries with player data
      const { data: entries, error: entriesError } = await this.supabase
        .from('leaderboard_entries')
        .select(`
          position,
          total,
          previous_position,
          previous_total,
          snapshot_date,
          players (
            id,
            player_code,
            name,
            image_url,
            extra
          )
        `)
        .eq('leaderboard_id', leaderboardData.id)
        .eq('snapshot_date', new Date().toISOString().split('T')[0])
        .order('position', { ascending: true });

      if (entriesError) throw entriesError;

      // Transform to Funifier format
      const leaders: Player[] = (entries || []).map((entry: any) => {
        const player = entry.players;
        return {
          _id: player.id,
          player: player.player_code,
          name: player.name,
          position: entry.position,
          total: parseFloat(entry.total),
          previous_position: entry.previous_position,
          previous_total: entry.previous_total ? parseFloat(entry.previous_total) : undefined,
          move: this.calculateMove(entry.position, entry.previous_position),
          image: player.image_url,
          extra: player.extra || {},
        };
      });

      return {
        leaderboard: {
          _id: leaderboardData.funifier_id || leaderboardData.id,
          title: leaderboardData.title,
          description: leaderboardData.description || '',
          principalType: leaderboardData.principal_type || 0,
          operation: {
            type: leaderboardData.operation_type || 0,
            achievement_type: leaderboardData.achievement_type || 0,
            item: leaderboardData.operation_item || '',
            sort: leaderboardData.sort_order || -1,
          },
          period: {
            type: leaderboardData.period_type || 0,
            timeAmount: leaderboardData.period_time_amount || 0,
            timeScale: leaderboardData.period_time_scale || 0,
          },
        },
        leaders,
      };
    });
  }

  /**
   * Calculate move direction
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
        .or(`id.eq.${playerId},player_code.eq.${playerId}`)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Player not found');

      return {
        _id: data.id,
        player: data.player_code,
        name: data.name,
        position: 0, // Would need to query leaderboard_entries for actual position
        total: 0, // Would need to query leaderboard_entries for actual total
        image: data.image_url,
        extra: data.extra || {},
      };
    });
  }

  /**
   * Get player status including challenge progress
   */
  public async getPlayerStatus(playerId: string): Promise<PlayerStatus> {
    return this.retryRequest(async () => {
      // Use the database function
      const { data, error } = await this.supabase.rpc('get_player_status', {
        p_player_id: playerId,
      });

      if (error) throw error;
      if (!data) throw new Error('Player not found');

      // Transform to match Funifier format
      return {
        name: data.name,
        total_challenges: data.total_challenges || 0,
        challenges: {},
        total_points: data.total_points || 0,
        point_categories: data.point_categories || {},
        total_catalog_items: 0,
        catalog_items: {},
        level_progress: data.level_progress || {
          percent_completed: 0,
          next_points: 0,
          total_levels: 0,
          percent: 0,
        },
        challenge_progress: data.challenge_progress || [],
        teams: [],
        positions: [],
        time: Date.now(),
        extra: data.extra || {},
        pointCategories: data.point_categories || {},
        _id: data.player_id,
      };
    });
  }

  /**
   * Test connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      const { error } = await this.supabase.from('leaderboards').select('id').limit(1);
      return !error;
    } catch (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
  }

  /**
   * Subscribe to real-time leaderboard updates
   */
  public subscribeToLeaderboard(
    leaderboardId: string,
    callback: (payload: any) => void
  ) {
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
   * Subscribe to challenge events
   */
  public subscribeToChallengeEvents(callback: (payload: any) => void) {
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
   * Get Supabase client for direct access
   */
  public getClient(): SupabaseClient {
    return this.supabase;
  }
}

// Export singleton instance
let supabaseApiInstance: SupabaseApiService | null = null;

export const getSupabaseApi = (): SupabaseApiService => {
  if (!supabaseApiInstance) {
    supabaseApiInstance = new SupabaseApiService();
  }
  return supabaseApiInstance;
};
