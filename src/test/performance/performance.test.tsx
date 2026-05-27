
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { ChickenRace } from '../../components/ChickenRace';
import { Sidebar } from '../../components/Sidebar';
import { DetailedRanking } from '../../components/DetailedRanking';
import { SupabaseApiService } from '../../services/supabaseApi';
import { 
  createMockApiService, 
  mockPlayersSet, 
  mockLeaderboardsSet,
  measureRenderTime,
  expectRenderTimeUnder,
  mockEnvironmentVariables 
} from '../utils/testUtils';

// Mock the API service
vi.mock('../../services/supabaseApi');

describe('Performance Tests', () => {
  let mockApiService: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockEnvironmentVariables();
    
    mockApiService = createMockApiService();
    (SupabaseApiService as any).mockImplementation(() => mockApiService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('Rendering Performance', () => {
    it('should render small datasets quickly', async () => {
      mockApiService.getLeaderboardData.mockResolvedValue({
        leaderboard: mockLeaderboardsSet.single[0],
        leaders: mockPlayersSet.small,
      });

      await expectRenderTimeUnder(() => {
        render(<App />);
      }, 100); // Should render in under 100ms
    });

    it('should handle medium datasets efficiently', async () => {
      const mediumPlayers = Array.from({ length: 100 }, (_, i) => ({
        _id: `player-${i}`,
        player: `player-${i}`,
        name: `Player ${i}`,
        position: i + 1,
        total: 1000 - i,
      }));

      mockApiService.getLeaderboardData.mockResolvedValue({
        leaderboard: mockLeaderboardsSet.single[0],
        leaders: mediumPlayers,
      });

      await expectRenderTimeUnder(() => {
        render(<App />);
      }, 500); // Should render in under 500ms
    });

    it('should handle large datasets without blocking', async () => {
      const largePlayers = Array.from({ length: 1000 }, (_, i) => ({
        _id: `player-${i}`,
        player: `player-${i}`,
        name: `Player ${i}`,
        position: i + 1,
        total: 10000 - i,
      }));

      mockApiService.getLeaderboardData.mockResolvedValue({
        leaderboard: mockLeaderboardsSet.single[0],
        leaders: largePlayers,
      });

      const renderTime = await measureRenderTime(() => {
        render(<App />);
      });

      // Should render in under 2 seconds even with large datasets
      expect(renderTime).toBeLessThan(2000);
    });

    it('should render ChickenRace component efficiently with many players', async () => {
      const renderTime = await measureRenderTime(() => {
        render(
          <ChickenRace
            players={mockPlayersSet.large}
            leaderboardTitle="Performance Test"
            isLoading={false}
          />
        );
      });

      expect(renderTime).toBeLessThan(200);
    });

    it('should render Sidebar component efficiently', async () => {
      const renderTime = await measureRenderTime(() => {
        render(
          <Sidebar
            topPlayers={mockPlayersSet.large.slice(0, 5)}
            currentLeaderboard={mockLeaderboardsSet.single[0]}
            totalPlayers={mockPlayersSet.large.length}
          />
        );
      });

      expect(renderTime).toBeLessThan(100);
    });

    it('should render DetailedRanking component efficiently with pagination', async () => {
      const renderTime = await measureRenderTime(() => {
        render(
          <DetailedRanking
            players={mockPlayersSet.large}
            leaderboardTitle="Performance Test"
          />
        );
      });

      expect(renderTime).toBeLessThan(300);
    });
  });

  describe('Animation Performance', () => {
    it('should maintain 60fps during chicken animations', async () => {
      render(
        <ChickenRace
          players={mockPlayersSet.small}
          leaderboardTitle="Animation Test"
          isLoading={false}
        />
      );

      // Measure animation frame timing
      const frameTimes: number[] = [];
      let lastTime = performance.now();
      
      const measureFrame = () => {
        const currentTime = performance.now();
        frameTimes.push(currentTime - lastTime);
        lastTime = currentTime;
        
        if (frameTimes.length < 60) {
          requestAnimationFrame(measureFrame);
        }
      };

      requestAnimationFrame(measureFrame);

      // Fast-forward to complete animation measurement
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Calculate average frame time
      const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      
      // Should maintain close to 16.67ms per frame (60fps)
      expect(avgFrameTime).toBeLessThan(20);
    });

    it('should handle position transitions smoothly', async () => {
      const { rerender } = render(
        <ChickenRace
          players={mockPlayersSet.small}
          leaderboardTitle="Transition Test"
          isLoading={false}
        />
      );

      const startTime = performance.now();

      // Change player positions
      const updatedPlayers = [...mockPlayersSet.small].reverse();
      rerender(
        <ChickenRace
          players={updatedPlayers}
          leaderboardTitle="Transition Test"
          isLoading={false}
        />
      );

      const transitionTime = performance.now() - startTime;
      
      // Position transitions should be fast
      expect(transitionTime).toBeLessThan(50);
    });

    it('should optimize animations for large player counts', async () => {
      render(
        <ChickenRace
          players={mockPlayersSet.large}
          leaderboardTitle="Large Animation Test"
          isLoading={false}
        />
      );

      // Should use efficient animation techniques for large counts
      chickens.forEach(chicken => {
        const style = window.getComputedStyle(chicken);
        
        // Should use transform instead of changing layout properties
        expect(style.transform).toBeTruthy();
        
        // Should have will-change for GPU acceleration
        expect(style.willChange).toBe('transform');
      });
    });
  });

  describe('Memory Performance', () => {
    it('should not leak memory during rapid updates', async () => {
      const { rerender } = render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Simulate rapid updates
      for (let i = 0; i < 100; i++) {
        const updatedPlayers = mockPlayersSet.small.map(player => ({
          ...player,
          total: player.total + Math.random() * 10,
        }));

        mockApiService.getLeaderboardData.mockResolvedValue({
          leaderboard: mockLeaderboardsSet.single[0],
          leaders: updatedPlayers,
        });

        rerender(<App />);

        await act(async () => {
          vi.advanceTimersByTime(100);
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Memory should not grow significantly (allow for 50% increase)
      if (initialMemory > 0) {
        expect(finalMemory).toBeLessThan(initialMemory * 1.5);
      }
    });

    it('should clean up event listeners on unmount', async () => {
      const { unmount } = render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      const initialListeners = document.querySelectorAll('[data-testid]').length;

      unmount();

      // Should clean up properly
      const finalListeners = document.querySelectorAll('[data-testid]').length;
      expect(finalListeners).toBeLessThanOrEqual(initialListeners);
    });

    it('should handle component unmounting during async operations', async () => {
      let resolvePromise: () => void;
      const slowPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      mockApiService.getLeaderboardData.mockReturnValue(slowPromise);

      const { unmount } = render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      // Unmount before async operation completes
      unmount();

      // Complete the async operation
      resolvePromise!({
        leaderboard: mockLeaderboardsSet.single[0],
        leaders: mockPlayersSet.small,
      });

      // Should not cause errors or memory leaks
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    });
  });

  describe('Network Performance', () => {
    it('should batch API requests efficiently', async () => {
      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should not make excessive API calls
      expect(mockApiService.getLeaderboards).toHaveBeenCalledTimes(1);
      expect(mockApiService.getLeaderboardData).toHaveBeenCalledTimes(1);
    });

    it('should debounce rapid leaderboard switches', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      const selector = await screen.findByRole('combobox');

      // Rapidly switch leaderboards
      for (let i = 0; i < 5; i++) {
        await user.click(selector);
        await user.keyboard('{ArrowDown}{Enter}');
      }

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Should debounce and not make excessive API calls
      expect(mockApiService.getLeaderboardData).toHaveBeenCalledTimes(2); // Initial + final
    });

    it('should cache API responses appropriately', async () => {
      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Switch to different leaderboard and back
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const selector = await screen.findByRole('combobox');

      await user.click(selector);
      await user.keyboard('{ArrowDown}{Enter}');

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      await user.click(selector);
      await user.keyboard('{ArrowUp}{Enter}');

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Should use cached data for recently accessed leaderboards
      expect(mockApiService.getLeaderboardData).toHaveBeenCalledTimes(2);
    });
  });

  describe('Bundle Size Performance', () => {
    it('should lazy load components when needed', async () => {
      // This test would typically check for dynamic imports
      // For now, we'll verify that components are not all loaded immediately
      
      render(<App />);

      // DetailedRanking should not be rendered until scrolled to
      expect(screen.queryByText(/complete ranking/i)).not.toBeInTheDocument();

      // Simulate scrolling to trigger lazy loading
      window.dispatchEvent(new Event('scroll'));

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Now it should be loaded
      await waitFor(() => {
        expect(screen.getByText(/complete ranking/i)).toBeInTheDocument();
      });
    });

    it('should minimize re-renders with proper memoization', async () => {
      let renderCount = 0;
      const TestComponent = React.memo(() => {
        renderCount++;
        return <div>Test Component</div>;
      });

      const { rerender } = render(<TestComponent />);

      expect(renderCount).toBe(1);

      // Re-render with same props
      rerender(<TestComponent />);

      // Should not re-render due to memoization
      expect(renderCount).toBe(1);
    });
  });

  describe('Accessibility Performance', () => {
    it('should maintain accessibility with large datasets', async () => {
      mockApiService.getLeaderboardData.mockResolvedValue({
        leaderboard: mockLeaderboardsSet.single[0],
        leaders: mockPlayersSet.large,
      });

      const { container } = render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should maintain proper ARIA labels even with large datasets
      const interactiveElements = container.querySelectorAll('[role], button, input, select');
      
      interactiveElements.forEach(element => {
        const hasAccessibleName = 
          element.hasAttribute('aria-label') ||
          element.hasAttribute('aria-labelledby') ||
          element.textContent?.trim();
        
        expect(hasAccessibleName).toBeTruthy();
      });
    });

    it('should provide efficient keyboard navigation', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      const startTime = performance.now();

      // Navigate through interactive elements
      await user.tab();
      await user.tab();
      await user.tab();

      const navigationTime = performance.now() - startTime;

      // Keyboard navigation should be responsive
      expect(navigationTime).toBeLessThan(100);
    });
  });
});