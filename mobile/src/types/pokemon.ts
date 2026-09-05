export interface MoveData {
  id: number;
  name: string;
  type: string;
  power: number | null;
  accuracy: number | null;
  pp: number;
  currentPp?: number;
}

export interface PokemonStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface PokemonEVs {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface PokemonIVs {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface TransferBaseline {
  transferredAtTimestamp: number;
  initialLevel: number;
  initialExp: number;
  initialFriendship: number;
  initialEvs: PokemonEVs;
  initialTotalSteps: number;
}

export interface TamagotchiPokemon {
  speciesId: number;
  speciesName: string;
  nickname: string;
  version: number;
  generation: number;
  level: number;
  exp: number;
  expToNextLevel: number;
  friendship: number; // 0 - 255
  energy: number; // 0 - 100%
  base64Raw: string;
  isShiny: boolean;
  types: string[];
  moves: MoveData[];
  baseStats: PokemonStats;
  calculatedStats: PokemonStats;
  evs: PokemonEVs;
  ivs: PokemonIVs;
  lastFedTimestamp: number;
  lastSleepTimestamp: number;
  lastActiveTimestamp: number;
  isRested: boolean;
  restedUntilTimestamp?: number;
  totalSteps: number;
  streakDays: number;
  lastStreakDate: string; // YYYY-MM-DD
  heldItem?: string;
  // Stats tracking since transfer/import
  baseline?: TransferBaseline;
}

export interface WorkoutRecord {
  type: 'cardio' | 'weightlifting' | 'defense' | 'yoga' | 'hiit' | 'walking' | 'swimming' | 'cycling' | 'custom';
  durationMinutes: number;
  evGained: { stat: keyof PokemonEVs; amount: number };
  timestamp: number;
  notes?: string;
}

export interface MealRecord {
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'water';
  energyGained: number;
  timestamp: number;
  details?: string;
}

export interface SleepRecord {
  durationHours: number;
  isRested: boolean;
  timestamp: number;
  sleepTime?: string;
  wakeTime?: string;
}

export type EVTriggerType =
  | 'workout_type'
  | 'workout_duration'
  | 'eating_regularly'
  | 'drinking_regularly'
  | 'step_count'
  | 'sleep_duration'
  | 'sleep_regularity'
  | 'task_completion';

export interface EVRuleTrigger {
  id: string;
  name: string;
  targetStat: keyof PokemonEVs;
  triggerType: EVTriggerType;
  evAmount: number;
  enabled: boolean;
  // Conditions
  workoutType?: WorkoutRecord['type'];
  minDurationMinutes?: number;
  minSteps?: number;
  minSleepHours?: number;
  maxSleepHours?: number;
  taskCategory?: string;
}

export type RewardTriggerType =
  | 'streak_days'
  | 'step_milestone'
  | 'sleep_target'
  | 'meal_consistency'
  | 'workout_milestone'
  | 'tasks_completed';

export interface ItemRewardConfig {
  id: string;
  name: string;
  itemType: 'rare_candy' | 'protein' | 'iron' | 'carbos' | 'calcium' | 'zinc' | 'hp_up' | 'pp_max' | 'master_ball' | 'leftovers' | 'exp_share' | 'mystery_gift' | 'custom';
  description: string;
  enabled: boolean;
  triggerType: RewardTriggerType;
  triggerThreshold: number;
  icon?: string;
}

export interface InventoryItem {
  id: string;
  rewardId?: string;
  name: string;
  itemType: string;
  description: string;
  quantity: number;
  obtainedTimestamp: number;
  source: string;
}

export interface StreakReward {
  id: string;
  name: string;
  description: string;
  itemType: 'rare_candy' | 'protein' | 'iron' | 'carbos' | 'calcium' | 'zinc' | 'hp_up' | 'pp_max' | 'master_ball' | 'leftovers' | 'exp_share' | 'mystery_gift';
  claimed: boolean;
  streakRequirement: number;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  category: 'Health' | 'Fitness' | 'Study' | 'Work' | 'Habit' | 'Chores' | 'Custom';
  repeatType: 'once' | 'daily' | 'weekdays' | 'weekends';
  targetDate?: string; // YYYY-MM-DD
  rewardType: 'exp' | 'friendship' | 'ev' | 'item';
  rewardConfig: {
    expAmount?: number;
    friendshipAmount?: number;
    evStat?: keyof PokemonEVs;
    evAmount?: number;
    itemType?: string;
  };
  streakRewardEnabled: boolean;
  streakRewardItem?: string;
  currentStreak: number;
  completedDates: string[]; // List of YYYY-MM-DD
  createdAt: number;
}

export interface AppSettings {
  stepsPerFriendship: number; // default 256
  expMultiplier: number; // default 1.0
  passiveExpPerMinute: number; // default 5
  sleepMinHours: number; // default 7
  sleepMaxHours: number; // default 8
  workoutEvMultiplier: number; // default 1.0
  mockHealthEnabled: boolean;
  spriteMode: 'static' | 'animated';
  themeRetroColor: string;
  // Customization expansions
  itemRewardsEnabled: boolean;
  customEvRulesEnabled: boolean;
  evRules: EVRuleTrigger[];
  rewardConfigs: ItemRewardConfig[];
  dailyStepGoal: number;
  dailyWaterGoalCups: number;
  // Watch Companion Bridge
  watchCompanionEnabled: boolean;
  watchCompanionProvider?: 'zepp' | 'garmin' | 'mock';
  watchCompanionDeviceName: string;
  watchCompanionAutoSync: boolean;
}

export interface WatchLedgerBatch {
  batch_id: string;
  session_id: string;
  delta_steps: number;
  evs_earned: PokemonEVs;
  items_found: {
    id: string;
    itemType: string;
    name: string;
    stepMilestone?: number;
    timestamp?: number;
  }[];
  tasks_completed: {
    taskId: string;
    timestamp?: number;
  }[];
  timestamp: number;
}

export interface WatchBridgeStatus {
  isRunning: boolean;
  port: number;
  url: string;
  stateVersion: number;
  processedOperationsCount: number;
  deviceName: string;
  lastSyncTimestamp: number | null;
  lastOperationId: string | null;
  totalStepsReceived: number;
  totalEvsReceived: PokemonEVs;
  totalItemsReceivedCount: number;
}

