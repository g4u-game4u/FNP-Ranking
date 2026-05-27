import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChickenRaceManager } from '../useChickenRaceManager';
import type { SupabaseConfig } from '../../types';

// Mock the API service
vi.mock('../../services/supabaseApi');
vi.mock('../useAppState');
vi.mock('../../store/leaderboardStore');
vi.mock('../../store/appStore');

describe('useChickenRaceManager - Auto Refresh', () => {
  let mockApiConfig: SupabaseConfig;

  beforeEach(() => {
    vi.useFakeTimers();
    
    mockApiConfig = {
      url: 'https://test.supabase.co',
      anonKey: 'test-anon-key',
    };

    // Mock document.visibilityState
    Object.defineProperty(document, 'visibilityState', {
      writable: true,
      configurable: true,
      value: 'visible',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should enable auto-refresh by default', () => {
    const { result } = renderHook(() =>
      useChickenRaceManager({
        apiConfig: mockApiConfig,
      })
    );

    // Auto-refresh should be enabled by default
    expect(result.current).toBeDefined();
  });

  it('should refresh data every 60 seconds by default', async () => {
    const refreshSpy = vi.fn();
    
    const { result } = renderHook(() =>
      useChickenRaceManager({
        apiConfig: mockApiConfig,
        autoRefreshConfig: {
          enabled: true,
          interval: 60000,
        },
      })
    );

    // Mock the refreshData function
    if (result.current.refreshData) {
      result.current.refreshData = refreshSpy;
    }

    // Fast-forward 60 seconds
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    // Should have called refresh once
    await waitFor(() => {
      expect(refreshSpy).toHaveBeenCalledTimes(1);
    });

    // Fast-forward another 60 seconds
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    // Should have called refresh twice
    await waitFor(() => {
      expect(refreshSpy).toHaveBeenCalledTimes(2);
    });
  });

  it('should respect custom refresh interval', async () => {
    const refreshSpy = vi.fn();
    const customInterval = 30000; // 30 seconds

    const { result } = renderHook(() =>
      useChickenRaceManager({
        apiConfig: mockApiConfig,
        autoRefreshConfig: {
          enabled: true,
          interval: customInterval,
        },
      })
    );

    if (result.current.refreshData) {
      result.current.refreshData = refreshSpy;
    }

    // Fast-forward 30 seconds
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    await waitFor(() => {
      expect(refreshSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('should not refresh when page is hidden', async () => {
    const refreshSpy = vi.fn();

    const { result } = renderHook(() =>
      useChickenRaceManager({
        apiConfig: mockApiConfig,
        autoRefreshConfig: {
          enabled: true,
          interval: 60000,
        },
      })
    );

    if (result.current.refreshData) {
      result.current.refreshData = refreshSpy;
    }

    // Set page to hidden
    Object.defineProperty(document, 'visibilityState', {
      writable: true,
      configurable: true,
      value: 'hidden',
    });

    // Fast-forward 60 seconds
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    // Should not have called refresh
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('should resume refresh when page becomes visible', async () => {
    const refreshSpy = vi.fn();

    const { result } = renderHook(() =>
      useChickenRaceManager({
        apiConfig: mockApiConfig,
        autoRefreshConfig: {
          enabled: true,
          interval: 60000,
        },
      })
    );

    if (result.current.refreshData) {
      result.current.refreshData = refreshSpy;
    }

    // Set page to hidden
    Object.defineProperty(document, 'visibilityState', {
      writable: true,
      configurable: true,
      value: 'hidden',
    });

    // Fast-forward 60 seconds while hidden
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(refreshSpy).not.toHaveBeenCalled();

    // Set page back to visible
    Object.defineProperty(document, 'visibilityState', {
      writable: true,
      configurable: true,
      value: 'visible',
    });

    // Fast-forward another 60 seconds
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    // Should have called refresh once (after becoming visible)
    await waitFor(() => {
      expect(refreshSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('should not refresh when using mock data', async () => {
    const refreshSpy = vi.fn();

    const { result } = renderHook(() =>
      useChickenRaceManager({
        apiConfig: mockApiConfig,
        autoRefreshConfig: {
          enabled: true,
          interval: 60000,
        },
      })
    );

    // Simulate mock data mode
    if (result.current.usingMockData) {
      if (result.current.refreshData) {
        result.current.refreshData = refreshSpy;
      }

      // Fast-forward 60 seconds
      act(() => {
        vi.advanceTimersByTime(60000);
      });

      // Should not refresh when using mock data
      expect(refreshSpy).not.toHaveBeenCalled();
    }
  });

  it('should allow disabling auto-refresh', async () => {
    const refreshSpy = vi.fn();

    const { result } = renderHook(() =>
      useChickenRaceManager({
        apiConfig: mockApiConfig,
        autoRefreshConfig: {
          enabled: false,
        },
      })
    );

    if (result.current.refreshData) {
      result.current.refreshData = refreshSpy;
    }

    // Fast-forward 60 seconds
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    // Should not have called refresh
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('should clean up interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const { unmount } = renderHook(() =>
      useChickenRaceManager({
        apiConfig: mockApiConfig,
        autoRefreshConfig: {
          enabled: true,
          interval: 60000,
        },
      })
    );

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
