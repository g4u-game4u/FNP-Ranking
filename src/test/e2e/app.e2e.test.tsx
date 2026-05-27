import React from 'react';

import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { SupabaseApiService } from '../../services/supabaseApi';
import type { Leaderboard, LeaderboardResponse, Player } from '../../types';

// Mock the API service
vi.mock('../../services/supabaseApi');

describe('App End-to-End Tests', () => {
  let mockApiService: any;
  
  const mockLeaderboards: Leaderboard[] = [
    {
      _id: 'leaderboard-1',
      title: 'Championship Race',
      description: 'Main championship leaderboard',
      principalType: 0,
      operation: {
        type: 1,
        achievement_type: 1,
        item: 'points',
        sort: -1,
      },
      period: {
        type: 1,
        timeAmount: 1,
        timeScale: 1,
      },
    },
    {
      _id: 'leaderboard-2',
      title: 'Weekly Challenge',
      description: 'Weekly challenge leaderboard',
      principalType: 0,
      operation: {
        type: 1,
        achievement_type: 1,
        item: 'points',
        sort: -1,
      },
      period: {
        type: 1,
        timeAmount: 7,
        timeScale: 1,
      },
    },
  ];

  const mockPlayers: Player[] = [
    {
      _id: 'player-1',
      player: 'player-1',
      name: 'Alice Champion',
      position: 1,
      total: 1500,
      previous_position: 2,
      previous_total: 1400,
      move: 'up',
    },
    {
      _id: 'player-2',
      player: 'player-2',
      name: 'Bob Runner',
      position: 2,
      total: 1200,
      previous_position: 1,
      previous_total: 1300,
      move: 'down',
    },
    {
      _id: 'player-3',
      player: 'player-3',
      name: 'Charlie Swift',
      position: 3,
      total: 1000,
      previous_position: 3,
      previous_total: 950,
      move: 'up',
    },
  ];

  const mockLeaderboardResponse: LeaderboardResponse = {
    leaderboard: mockLeaderboards[0],
    leaders: mockPlayers,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    
    // Mock environment variables
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

    // Create mock API service
    mockApiService = {
      getLeaderboards: vi.fn().mockResolvedValue(mockLeaderboards),
      getLeaderboardData: vi.fn().mockResolvedValue(mockLeaderboardResponse),
      getPlayerDetails: vi.fn().mockResolvedValue(mockPlayers[0]),
      testConnection: vi.fn().mockResolvedValue(true),
      setAuthToken: vi.fn(),
      getConfig: vi.fn().mockReturnValue({
        url: 'https://test.supabase.co',
        anonKey: 'test-anon-key',
      }),
    };

    // Mock the constructor
    (SupabaseApiService as any).mockImplementation(() => mockApiService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('Complete User Workflows', () => {
    it('should load app, display leaderboard selector, and show chicken race', async () => {
      render(<App />);

      // Wait for initial load
      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      // Should show loading state initially
      expect(screen.getByText(/loading/i)).toBeInTheDocument();

      // Fast-forward to complete loading
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText('Championship Race')).toBeInTheDocument();
      });

      // Should display leaderboard selector
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      
      // Should display chicken race
      expect(screen.getByText('🏁 Chicken Race Championship 🏁')).toBeInTheDocument();
      
      // Should display all players as chickens
      expect(screen.getByText('Alice Champion')).toBeInTheDocument();
      expect(screen.getByText('Bob Runner')).toBeInTheDocument();
      expect(screen.getByText('Charlie Swift')).toBeInTheDocument();

      // Should display sidebar with top players
      expect(screen.getByText('🏆 Top Players')).toBeInTheDocument();
    });

    it('should allow switching between leaderboards', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(<App />);

      // Wait for initial load
      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Find and click leaderboard selector
      const selector = await screen.findByRole('combobox');
      await user.click(selector);

      // Should show dropdown options
      await waitFor(() => {
        expect(screen.getByText('Weekly Challenge')).toBeInTheDocument();
      });

      // Select different leaderboard
      await user.click(screen.getByText('Weekly Challenge'));

      // Should call API for new leaderboard data
      await waitFor(() => {
        expect(mockApiService.getLeaderboardData).toHaveBeenCalledWith('leaderboard-2');
      });
    });

    it('should enable auto-cycling between leaderboards', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Find auto-cycle toggle
      const autoCycleToggle = await screen.findByLabelText(/auto cycle/i);
      await user.click(autoCycleToggle);

      // Should show auto-cycle is enabled
      expect(autoCycleToggle).toBeChecked();

      // Fast-forward 5 minutes to trigger auto-cycle
      await act(async () => {
        vi.advanceTimersByTime(5 * 60 * 1000);
      });

      // Should have switched to next leaderboard
      await waitFor(() => {
        expect(mockApiService.getLeaderboardData).toHaveBeenCalledWith('leaderboard-2');
      });
    });

    it('should display tooltips on chicken hover', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Find a chicken element
      const aliceChicken = await screen.findByText('Alice Champion');
      const chickenContainer = aliceChicken.closest('.chicken-container');
      
      expect(chickenContainer).toBeInTheDocument();

      // Hover over chicken
      await user.hover(chickenContainer!);

      // Should show tooltip with player info
      await waitFor(() => {
        expect(screen.getByText(/position.*1/i)).toBeInTheDocument();
        expect(screen.getByText(/1,500/)).toBeInTheDocument();
      });

      // Unhover
      await user.unhover(chickenContainer!);

      // Tooltip should disappear
      await waitFor(() => {
        expect(screen.queryByText(/position.*1/i)).not.toBeInTheDocument();
      });
    });

    it('should show detailed ranking in second fold', async () => {
      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Scroll down to find detailed ranking
      const detailedRanking = await screen.findByText(/complete ranking/i);
      expect(detailedRanking).toBeInTheDocument();

      // Should show all players in table format
      expect(screen.getByText('Alice Champion')).toBeInTheDocument();
      expect(screen.getByText('Bob Runner')).toBeInTheDocument();
      expect(screen.getByText('Charlie Swift')).toBeInTheDocument();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle API connection errors gracefully', async () => {
      mockApiService.getLeaderboards.mockRejectedValue(new Error('Network error'));
      
      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });

      // Should show retry option
      expect(screen.getByText(/retry/i)).toBeInTheDocument();
    });

    it('should handle empty leaderboard data', async () => {
      mockApiService.getLeaderboardData.mockResolvedValue({
        leaderboard: mockLeaderboards[0],
        leaders: [],
      });
      
      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should show empty state
      await waitFor(() => {
        expect(screen.getByText(/no players in this race/i)).toBeInTheDocument();
      });
    });

    it('should handle network failures during real-time updates', async () => {
      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Simulate network failure on subsequent calls
      mockApiService.getLeaderboardData.mockRejectedValue(new Error('Network timeout'));

      // Fast-forward to trigger polling
      await act(async () => {
        vi.advanceTimersByTime(30000); // 30 seconds
      });

      // Should maintain last known good state
      expect(screen.getByText('Alice Champion')).toBeInTheDocument();
      
      // Should show error indicator but not crash
      await waitFor(() => {
        expect(screen.getByText(/connection/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance and Accessibility', () => {
    it('should be accessible with proper ARIA labels', async () => {
      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Check for proper ARIA labels
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-label');
      expect(screen.getByRole('main')).toBeInTheDocument();
      
      // Check for proper heading structure
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('should handle large numbers of players efficiently', async () => {
      const largePlayers: Player[] = Array.from({ length: 100 }, (_, i) => ({
        _id: `player-${i + 1}`,
        player: `player-${i + 1}`,
        name: `Player ${i + 1}`,
        position: i + 1,
        total: 1000 - i * 10,
        move: 'same' as const,
      }));

      mockApiService.getLeaderboardData.mockResolvedValue({
        leaderboard: mockLeaderboards[0],
        leaders: largePlayers,
      });

      const startTime = performance.now();
      
      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time (less than 2 seconds)
      expect(renderTime).toBeLessThan(2000);

      // Should show top 5 in sidebar
      expect(screen.getByText('Player 1')).toBeInTheDocument();
      expect(screen.getByText('Player 5')).toBeInTheDocument();
      
      // Should show all players in detailed ranking
      expect(screen.getByText('Player 100')).toBeInTheDocument();
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should adapt layout for mobile screens', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should show mobile-optimized layout
      const sidebar = screen.getByText('🏆 Top Players').closest('.lg\\:w-80');
      expect(sidebar).toHaveClass('w-full');
    });
  });
});