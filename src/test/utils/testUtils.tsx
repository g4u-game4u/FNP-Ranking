/* eslint-disable react-refresh/only-export-components */
import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';
import type { Leaderboard, Player, LeaderboardResponse, SupabaseConfig } from '../../types';

// Mock data generators
export const createMockPlayer = (overrides: Partial<Player> = {}): Player => ({
  _id: 'mock-player-id',
  player: 'mock-player',
  name: 'Mock Player',
  position: 1,
  total: 100,
  previous_position: 2,
  previous_total: 90,
  move: 'up',
  ...overrides,
});

export const createMockLeaderboard = (overrides: Partial<Leaderboard> = {}): Leaderboard => ({
  _id: 'mock-leaderboard-id',
  title: 'Mock Leaderboard',
  description: 'A mock leaderboard for testing',
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
  ...overrides,
});

export const createMockLeaderboardResponse = (
  leaderboard?: Partial<Leaderboard>,
  players?: Partial<Player>[]
): LeaderboardResponse => ({
  leaderboard: createMockLeaderboard(leaderboard),
  leaders: players?.map(p => createMockPlayer(p)) || [createMockPlayer()],
});

export const createMockConfig = (overrides: Partial<SupabaseConfig> = {}): SupabaseConfig => ({
  url: 'https://test.supabase.co',
  anonKey: 'test-anon-key',
  ...overrides,
});

// Mock API service factory
export const createMockApiService = (overrides: any = {}) => ({
  getLeaderboards: vi.fn().mockResolvedValue([createMockLeaderboard()]),
  getLeaderboardData: vi.fn().mockResolvedValue(createMockLeaderboardResponse()),
  getPlayerDetails: vi.fn().mockResolvedValue(createMockPlayer()),
  testConnection: vi.fn().mockResolvedValue(true),
  setAuthToken: vi.fn(),
  getConfig: vi.fn().mockReturnValue(createMockConfig()),
  ...overrides,
});

// Test data sets
export const mockPlayersSet = {
  small: [
    createMockPlayer({ _id: '1', name: 'Alice', position: 1, total: 100 }),
    createMockPlayer({ _id: '2', name: 'Bob', position: 2, total: 90 }),
    createMockPlayer({ _id: '3', name: 'Charlie', position: 3, total: 80 }),
  ],
  
  large: Array.from({ length: 50 }, (_, i) => 
    createMockPlayer({
      _id: `player-${i + 1}`,
      name: `Player ${i + 1}`,
      position: i + 1,
      total: 1000 - i * 10,
    })
  ),
  
  tied: [
    createMockPlayer({ _id: '1', name: 'Alice', position: 1, total: 100 }),
    createMockPlayer({ _id: '2', name: 'Bob', position: 1, total: 100 }),
    createMockPlayer({ _id: '3', name: 'Charlie', position: 3, total: 80 }),
  ],
  
  withMovement: [
    createMockPlayer({ 
      _id: '1', 
      name: 'Alice', 
      position: 1, 
      total: 100, 
      previous_position: 2, 
      move: 'up' 
    }),
    createMockPlayer({ 
      _id: '2', 
      name: 'Bob', 
      position: 2, 
      total: 90, 
      previous_position: 1, 
      move: 'down' 
    }),
    createMockPlayer({ 
      _id: '3', 
      name: 'Charlie', 
      position: 3, 
      total: 80, 
      previous_position: 3, 
      move: 'same' 
    }),
  ],
};

export const mockLeaderboardsSet = {
  single: [createMockLeaderboard({ _id: 'lb1', title: 'Single Leaderboard' })],
  
  multiple: [
    createMockLeaderboard({ _id: 'lb1', title: 'Championship' }),
    createMockLeaderboard({ _id: 'lb2', title: 'Weekly Challenge' }),
    createMockLeaderboard({ _id: 'lb3', title: 'Monthly Contest' }),
  ],
};

// Error simulation helpers
export const createNetworkError = (message = 'Network error') => {
  const error = new Error(message);
  error.name = 'NetworkError';
  return error;
};

export const createApiError = (status = 500, message = 'API error') => {
  const error = new Error(message) as any;
  error.response = { status, data: { message } };
  return error;
};

export const createTimeoutError = () => {
  const error = new Error('Request timeout');
  error.name = 'TimeoutError';
  return error;
};

// Animation testing helpers
export const mockAnimationFrame = () => {
  let callbacks: FrameRequestCallback[] = [];
  let id = 0;

  const mockRequestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    callbacks.push(callback);
    return ++id;
  });

  const mockCancelAnimationFrame = vi.fn(() => {
    // Implementation for cancel if needed
  });

  const flushAnimationFrames = (timestamp = performance.now()) => {
    const currentCallbacks = [...callbacks];
    callbacks = [];
    currentCallbacks.forEach(callback => callback(timestamp));
  };

  return {
    mockRequestAnimationFrame,
    mockCancelAnimationFrame,
    flushAnimationFrames,
  };
};

// Timer testing helpers
export const createTimerHelpers = () => {
  const timers = new Map<number, NodeJS.Timeout>();
  let timerId = 0;

  const mockSetTimeout = vi.fn((callback: () => void, delay: number) => {
    const id = ++timerId;
    const timer = setTimeout(callback, delay);
    timers.set(id, timer);
    return id;
  });

  const mockClearTimeout = vi.fn((id: number) => {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
  });

  const mockSetInterval = vi.fn((callback: () => void, delay: number) => {
    const id = ++timerId;
    const timer = setInterval(callback, delay);
    timers.set(id, timer);
    return id;
  });

  const mockClearInterval = vi.fn((id: number) => {
    const timer = timers.get(id);
    if (timer) {
      clearInterval(timer);
      timers.delete(id);
    }
  });

  const clearAllTimers = () => {
    timers.forEach(timer => {
      clearTimeout(timer);
      clearInterval(timer);
    });
    timers.clear();
  };

  return {
    mockSetTimeout,
    mockClearTimeout,
    mockSetInterval,
    mockClearInterval,
    clearAllTimers,
  };
};

// Store testing helpers
export const createMockStoreState = () => ({
  leaderboards: mockLeaderboardsSet.multiple,
  currentLeaderboard: mockLeaderboardsSet.multiple[0],
  players: mockPlayersSet.small,
  isLoading: false,
  error: null,
  isAutoCycling: false,
  cycleInterval: 5 * 60 * 1000,
});

// Environment variable helpers
export const mockEnvironmentVariables = (vars: Record<string, string> = {}) => {
  const defaultVars = {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key',
  };

  Object.entries({ ...defaultVars, ...vars }).forEach(([key, value]) => {
    vi.stubEnv(key, value);
  });
};

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  // Add any provider props here if needed
}

export const renderWithProviders = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    // Add any providers here if needed (e.g., theme, router, etc.)
    return <>{children}</>;
  };

  return render(ui, { wrapper: Wrapper, ...options });
};

// Assertion helpers
export const expectElementToHaveAnimation = (element: HTMLElement) => {
  expect(element.style.transform).toContain('translate');
  expect(element.style.transition).toBeTruthy();
};

export const expectElementToBePositioned = (element: HTMLElement, x: number, y: number) => {
  const style = window.getComputedStyle(element);
  expect(style.left).toBe(`${x}%`);
  expect(style.top).toBe(`${y}%`);
};

// Performance testing helpers
export const measureRenderTime = async (renderFn: () => void): Promise<number> => {
  const start = performance.now();
  renderFn();
  const end = performance.now();
  return end - start;
};

export const expectRenderTimeUnder = async (renderFn: () => void, maxTime: number) => {
  const renderTime = await measureRenderTime(renderFn);
  expect(renderTime).toBeLessThan(maxTime);
};

// Accessibility testing helpers
export const expectProperHeadingStructure = (container: HTMLElement) => {
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
  expect(headings.length).toBeGreaterThan(0);
  
  // Check that h1 exists
  const h1 = container.querySelector('h1');
  expect(h1).toBeInTheDocument();
};

export const expectProperAriaLabels = (container: HTMLElement) => {
  const interactiveElements = container.querySelectorAll('button, input, select, [role="button"]');
  
  interactiveElements.forEach(element => {
    const hasAriaLabel = element.hasAttribute('aria-label') || 
                        element.hasAttribute('aria-labelledby') ||
                        element.textContent?.trim();
    expect(hasAriaLabel).toBeTruthy();
  });
};

// Export all utilities
export * from '@testing-library/react';
export { vi } from 'vitest';