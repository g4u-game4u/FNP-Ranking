import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Player } from '../types';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface DashboardSnapshot {
  snapshot_date: string;
  daily_sales_total: number;
  daily_sales_target: number;
  daily_sales_count: number;
  daily_goal_met: boolean;
  leaderboard: Array<{
    id: string;
    name: string;
    points: number;
    position: number;
  }>;
  total_players: number;
  leader_points: number;
  updated_at: string;
}

export interface DashboardData {
  players: Player[];
  dailySales: { total: number; target: number; count: number; goalMet: boolean };
  totalPlayers: number;
  leaderPoints: number;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

function getTodaySaoPaulo(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function mapLeaderboardToPlayers(
  leaderboard: DashboardSnapshot['leaderboard']
): Player[] {
  if (!leaderboard || !Array.isArray(leaderboard)) return [];
  return leaderboard.map((entry) => ({
    _id: entry.id,
    player: entry.id,
    name: entry.name,
    total: entry.points,
    position: entry.position,
  }));
}

export function useDashboardSnapshot(pollInterval = 60000): DashboardData {
  const [players, setPlayers] = useState<Player[]>([]);
  const [dailySales, setDailySales] = useState({ total: 0, target: 0, count: 0, goalMet: false });
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [leaderPoints, setLeaderPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSnapshot = useCallback(async () => {
    try {
      const today = getTodaySaoPaulo();
      const { data, error: fetchError } = await supabase
        .from('dashboard_snapshot')
        .select('*')
        .eq('snapshot_date', today)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError) {
        // If no row found for today, it's not a critical error
        if (fetchError.code === 'PGRST116') {
          setError('Nenhum snapshot encontrado para hoje.');
        } else {
          throw fetchError;
        }
        return;
      }

      const snapshot = data as DashboardSnapshot;

      setPlayers(mapLeaderboardToPlayers(snapshot.leaderboard));
      setDailySales({
        total: snapshot.daily_sales_total,
        target: snapshot.daily_sales_target,
        count: snapshot.daily_sales_count,
        goalMet: snapshot.daily_goal_met,
      });
      setTotalPlayers(snapshot.total_players);
      setLeaderPoints(snapshot.leader_points);
      setLastUpdated(snapshot.updated_at);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch dashboard snapshot:', err);
      setError(err.message || 'Erro ao buscar snapshot do dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSnapshot();

    intervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchSnapshot();
      }
    }, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchSnapshot, pollInterval]);

  return { players, dailySales, totalPlayers, leaderPoints, loading, error, lastUpdated };
}
