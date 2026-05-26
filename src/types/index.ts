// Types barrel export file
// Export all types from this file for easier imports

// Funifier API Configuration
export interface FunifierConfig {
  serverUrl: string; // e.g., https://your-funifier-server.com
  apiKey: string; // Your Funifier API key from environment variables
  authToken: string; // Basic auth token from environment variables
}

// Supabase API Configuration
export interface SupabaseConfig {
  url: string; // Supabase project URL
  anonKey: string; // Supabase anon/public key
}

// Google Sheets API Configuration
export interface GoogleSheetsConfig {
  clientId: string; // OAuth 2.0 Client ID
  clientSecret: string; // OAuth 2.0 Client Secret
  apiKey: string; // Google API Key
  spreadsheetId: string; // The ID of the Google Sheets document
  range?: string; // Optional: specific range to fetch (e.g., "Sheet1!A1:B1")
}

// Daily Code Cache structure
export interface DailyCodeCache {
  code: string; // The daily code value
  timestamp: number; // Unix timestamp in milliseconds when cached
  expiresAt: number; // Unix timestamp in milliseconds when cache expires
}

// Google Sheets API Response
export interface GoogleSheetsResponse {
  values: string[][]; // 2D array of cell values
}

// Leaderboard data model
export interface Leaderboard {
  _id: string;
  title: string;
  description: string;
  principalType: number; // 0 for Player, 1 for Team
  operation: {
    type: number;
    achievement_type: number;
    item: string;
    sort: number; // -1 descending, 1 ascending
  };
  period: {
    type: number;
    timeAmount: number;
    timeScale: number;
  };
}

// Player data model
export interface Player {
  _id: string;
  player: string;
  name: string;
  position: number;
  total: number;
  previous_position?: number;
  previous_total?: number;
  move?: 'up' | 'down' | 'same';
  image?: string;
  extra?: Record<string, any>;
}

// API Response for leaderboard data
export interface LeaderboardResponse {
  leaderboard: Leaderboard;
  leaders: Player[];
}

// Options for leaderboard API calls
export interface LeaderboardOptions {
  live?: boolean;
  maxResults?: number;
  period?: string;
}

// Error handling types
export interface ApiError {
  type: 'network' | 'auth' | 'validation' | 'config';
  message: string;
  retryable: boolean;
  timestamp: number;
  originalError?: Error;
}

// Animation and UI state types
export interface ChickenPosition {
  playerId: string;
  x: number; // Horizontal position (0-100%)
  y: number; // Vertical position (randomized)
  rank: number;
}

export interface ChickenAnimation {
  playerId: string;
  currentPosition: { x: number; y: number };
  targetPosition: { x: number; y: number };
  animationState: 'idle' | 'moving' | 'celebrating';
  lastUpdate: number;
}

export interface TooltipState {
  playerId: string | null;
  isVisible: boolean;
  position: { x: number; y: number };
  content: TooltipContent | null;
}

export interface TooltipContent {
  rank: number;
  points: number;
  pointsGainedToday: number;
  playerName: string;
}

// Auto-cycling state types
export interface AutoCycleState {
  isEnabled: boolean;
  currentIndex: number;
  nextSwitchTime: number;
  intervalId: number | null;
}

// Loading states
export interface LoadingState {
  leaderboards: boolean;
  currentLeaderboard: boolean;
  switchingLeaderboard: boolean;
}

// Application state interfaces
export interface LeaderboardState {
  leaderboards: Leaderboard[];
  currentLeaderboard: Leaderboard | null;
  currentLeaderboardId: string | null;
  players: Player[];
  loading: LoadingState;
  error: ApiError | null;
  lastUpdated: number | null;
}

export interface UIState {
  tooltips: TooltipState;
  animations: ChickenAnimation[];
  autoCycle: AutoCycleState;
  isInitialized: boolean;
}

export interface AppState extends LeaderboardState, UIState {}

// Player Status and Challenge Progress types
export interface ChallengeRule {
  completed: boolean;
  times_completed: number;
  times_required: number;
  percent_completed: number;
}

export interface ChallengeProgress {
  player: string;
  challenge: string;
  name: string;
  rules_completed: number;
  rules_total: number;
  percent_completed: number;
  time: number;
  rules: ChallengeRule[];
  _id: string;
}

export interface LevelProgress {
  percent_completed: number;
  next_points: number;
  total_levels: number;
  percent: number;
}

export interface PlayerStatus {
  name: string;
  total_challenges: number;
  challenges: Record<string, number>;
  total_points: number;
  point_categories: Record<string, number>;
  total_catalog_items: number;
  catalog_items: Record<string, any>;
  level_progress: LevelProgress;
  challenge_progress: ChallengeProgress[];
  teams: any[];
  positions: any[];
  time: number;
  extra: Record<string, any>;
  pointCategories: Record<string, number>;
  _id: string;
}

// Challenge Completion Notification Configuration Types
export interface ChallengeCompletionEvent {
  id: string;
  playerId: string;
  playerName: string;
  challengeId: string;
  challengeName: string;
  completedAt: Date;
  points?: number;
  timestamp: Date;
  challengeType?: string;
  challengeCategory?: string;
}

export interface PopupAnimationConfig {
  enterDuration: number;
  exitDuration: number;
  enterEasing: string;
  exitEasing: string;
}

export interface WebhookConfig {
  url: string;
  authToken?: string;
  apiKey?: string;
  signatureSecret?: string;
  timeout: number;
  retryAttempts: number;
}

export interface SSEConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatTimeout: number;
}

export interface NotificationConfig {
  displayDuration: number;
  position: 'top-right' | 'top-center' | 'center';
  maxQueueSize: number;
  enabledChallengeTypes: string[];
  enabledChallengeCategories: string[];
  animationConfig: PopupAnimationConfig;
  webhookConfig: WebhookConfig;
  sseConfig: SSEConfig;
  enableNotifications: boolean;
  enableSounds: boolean;
  enableVibration: boolean;
  memoryCleanupInterval: number;
  maxStoredEvents: number;
}
