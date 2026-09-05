import {
  TamagotchiPokemon,
  AppSettings,
  WorkoutRecord,
  MealRecord,
  SleepRecord,
  StreakReward,
  MoveData,
  EVRuleTrigger,
  ItemRewardConfig,
  TaskItem,
  PokemonEVs,
} from '../types/pokemon';
import { calculateStats, getExpForLevel, getPossibleNewMoves } from './pkmParser';

export const DEFAULT_EV_RULES: EVRuleTrigger[] = [
  {
    id: 'rule-cardio',
    name: 'Cardio / Running',
    targetStat: 'speed',
    triggerType: 'workout_type',
    workoutType: 'cardio',
    minDurationMinutes: 15,
    evAmount: 4,
    enabled: true,
  },
  {
    id: 'rule-weights',
    name: 'Weightlifting / Strength',
    targetStat: 'attack',
    triggerType: 'workout_type',
    workoutType: 'weightlifting',
    minDurationMinutes: 15,
    evAmount: 4,
    enabled: true,
  },
  {
    id: 'rule-defense',
    name: 'Core / Bodyweight',
    targetStat: 'defense',
    triggerType: 'workout_type',
    workoutType: 'defense',
    minDurationMinutes: 15,
    evAmount: 4,
    enabled: true,
  },
  {
    id: 'rule-hiit',
    name: 'HIIT / High Intensity',
    targetStat: 'specialAttack',
    triggerType: 'workout_type',
    workoutType: 'hiit',
    minDurationMinutes: 15,
    evAmount: 4,
    enabled: true,
  },
  {
    id: 'rule-yoga',
    name: 'Yoga / Flexibility',
    targetStat: 'specialDefense',
    triggerType: 'workout_type',
    workoutType: 'yoga',
    minDurationMinutes: 15,
    evAmount: 4,
    enabled: true,
  },
  {
    id: 'rule-walking',
    name: 'Jogging / Walking',
    targetStat: 'hp',
    triggerType: 'workout_type',
    workoutType: 'walking',
    minDurationMinutes: 15,
    evAmount: 4,
    enabled: true,
  },
  {
    id: 'rule-swimming',
    name: 'Swimming',
    targetStat: 'speed',
    triggerType: 'workout_type',
    workoutType: 'swimming',
    minDurationMinutes: 15,
    evAmount: 4,
    enabled: true,
  },
  {
    id: 'rule-cycling',
    name: 'Cycling',
    targetStat: 'speed',
    triggerType: 'workout_type',
    workoutType: 'cycling',
    minDurationMinutes: 15,
    evAmount: 4,
    enabled: true,
  },
  {
    id: 'rule-steps',
    name: 'Daily 8k Step Goal',
    targetStat: 'speed',
    triggerType: 'step_count',
    minSteps: 8000,
    evAmount: 6,
    enabled: true,
  },
  {
    id: 'rule-hydration',
    name: 'Drinking Regularly (Water)',
    targetStat: 'hp',
    triggerType: 'drinking_regularly',
    evAmount: 4,
    enabled: true,
  },
  {
    id: 'rule-eating',
    name: 'Eating Regularly (Healthy Meals)',
    targetStat: 'hp',
    triggerType: 'eating_regularly',
    evAmount: 4,
    enabled: true,
  },
  {
    id: 'rule-sleep',
    name: '7-8h Healthy Sleep',
    targetStat: 'defense',
    triggerType: 'sleep_duration',
    minSleepHours: 7,
    maxSleepHours: 8.5,
    evAmount: 6,
    enabled: true,
  },
  {
    id: 'rule-study-task',
    name: 'Study / Mental Tasks',
    targetStat: 'specialAttack',
    triggerType: 'task_completion',
    taskCategory: 'Study',
    evAmount: 5,
    enabled: true,
  },
  {
    id: 'rule-fitness-task',
    name: 'Fitness Tasks Completed',
    targetStat: 'attack',
    triggerType: 'task_completion',
    taskCategory: 'Fitness',
    evAmount: 5,
    enabled: true,
  },
];

export const DEFAULT_REWARD_CONFIGS: ItemRewardConfig[] = [
  {
    id: 'rew-1',
    name: 'Rare Candy',
    itemType: 'rare_candy',
    description: 'Instantly increases Pokémon level by 1.',
    enabled: true,
    triggerType: 'streak_days',
    triggerThreshold: 3,
    icon: '🍬',
  },
  {
    id: 'rew-2',
    name: 'Protein (+10 Atk EV)',
    itemType: 'protein',
    description: 'Nutritious workout drink for Attack power.',
    enabled: true,
    triggerType: 'streak_days',
    triggerThreshold: 5,
    icon: '💪',
  },
  {
    id: 'rew-3',
    name: 'Carbos (+10 Spd EV)',
    itemType: 'carbos',
    description: 'Energy booster for Speed.',
    enabled: true,
    triggerType: 'streak_days',
    triggerThreshold: 7,
    icon: '⚡',
  },
  {
    id: 'rew-4',
    name: 'Mythical Mystery Gift',
    itemType: 'mystery_gift',
    description: 'Uncompressed legendary item bytes & max friendship buff.',
    enabled: true,
    triggerType: 'streak_days',
    triggerThreshold: 14,
    icon: '🎁',
  },
  {
    id: 'rew-5',
    name: 'PP Max',
    itemType: 'pp_max',
    description: 'Maximizes move PP capacity and restores full energy.',
    enabled: true,
    triggerType: 'step_milestone',
    triggerThreshold: 10000,
    icon: '🔋',
  },
  {
    id: 'rew-6',
    name: 'Master Ball',
    itemType: 'master_ball',
    description: 'Legendary sphere awarded for 30-day streak dedication.',
    enabled: true,
    triggerType: 'streak_days',
    triggerThreshold: 30,
    icon: '🟣',
  },
  {
    id: 'rew-7',
    name: 'Leftovers',
    itemType: 'leftovers',
    description: 'Held item that continuously regenerates energy & prevents decay.',
    enabled: true,
    triggerType: 'meal_consistency',
    triggerThreshold: 3,
    icon: '🍏',
  },
  {
    id: 'rew-8',
    name: 'EXP Share',
    itemType: 'exp_share',
    description: 'Doubles passive EXP gain permanently.',
    enabled: true,
    triggerType: 'tasks_completed',
    triggerThreshold: 5,
    icon: '🎓',
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  stepsPerFriendship: 256,
  expMultiplier: 1.0,
  passiveExpPerMinute: 5,
  sleepMinHours: 7,
  sleepMaxHours: 8,
  workoutEvMultiplier: 1.0,
  mockHealthEnabled: false,
  spriteMode: 'static',
  themeRetroColor: '#8bac0f', // Game Boy Olive
  itemRewardsEnabled: true,
  customEvRulesEnabled: true,
  evRules: DEFAULT_EV_RULES,
  rewardConfigs: DEFAULT_REWARD_CONFIGS,
  dailyStepGoal: 8000,
  dailyWaterGoalCups: 8,
  watchCompanionEnabled: true,
  watchCompanionProvider: 'zepp',
  watchCompanionDeviceName: 'Amazfit Bip 6',
  watchCompanionAutoSync: true,
};

export const AVAILABLE_REWARDS: StreakReward[] = [
  { id: '1', name: 'Rare Candy', description: 'Instantly increases Pokémon level by 1.', itemType: 'rare_candy', claimed: false, streakRequirement: 3 },
  { id: '2', name: 'Protein (+10 Atk EV)', description: 'Nutritious workout drink for Attack power.', itemType: 'protein', claimed: false, streakRequirement: 5 },
  { id: '3', name: 'Carbos (+10 Spd EV)', description: 'Energy booster for Speed.', itemType: 'carbos', claimed: false, streakRequirement: 7 },
  { id: '4', name: 'Mythical Mystery Gift', description: 'Uncompressed legendary item bytes and event unlock.', itemType: 'mystery_gift', claimed: false, streakRequirement: 14 },
];

export interface ProcessResult {
  updatedPokemon: TamagotchiPokemon;
  leveledUp: boolean;
  newLevel: number;
  newLearnableMoves: MoveData[];
  expGained: number;
  friendshipGained: number;
}

export function processCircadianAndPassive(
  pokemon: TamagotchiPokemon,
  settings: AppSettings,
  newSteps: number = 0
): ProcessResult {
  const now = Date.now();
  const timeElapsedMs = Math.max(0, now - (pokemon.lastActiveTimestamp || now));
  const minutesElapsed = Math.floor(timeElapsedMs / 60000);

  // Check Rested buff expiry
  let isRested = pokemon.isRested;
  if (pokemon.restedUntilTimestamp && now > pokemon.restedUntilTimestamp) {
    isRested = false;
  }

  // Multipliers
  const buffMultiplier = isRested ? 2.0 : 1.0;
  const expMultiplier = (settings.expMultiplier || 1.0) * buffMultiplier;

  // Passive EXP: time elapsed + distance/steps
  const timeExp = minutesElapsed * (settings.passiveExpPerMinute || 5);
  const stepExp = Math.floor(newSteps * 0.5);
  const expGained = Math.floor((timeExp + stepExp) * expMultiplier);

  // Friendship: +1 per 256 steps
  const totalSteps = (pokemon.totalSteps || 0) + newSteps;
  const friendshipGained = Math.floor(newSteps / (settings.stepsPerFriendship || 256));
  const newFriendship = Math.min(255, (pokemon.friendship || 70) + friendshipGained);

  // Energy Decay: ~3% per hour elapsed (reduced if Leftovers equipped)
  const isHoldingLeftovers = pokemon.heldItem === 'leftovers';
  const hoursElapsed = timeElapsedMs / 3600000;
  const energyLoss = isHoldingLeftovers ? 0 : Math.floor(hoursElapsed * 3);
  const newEnergy = Math.max(10, (pokemon.energy || 100) - energyLoss);

  // Check Level ups
  let currentLevel = pokemon.level;
  let currentExp = pokemon.exp + expGained;
  let expToNext = pokemon.expToNextLevel;
  let leveledUp = false;
  const newLearnableMoves: MoveData[] = [];

  while (currentExp >= expToNext && currentLevel < 100) {
    currentLevel++;
    leveledUp = true;
    const nextLevelExp = getExpForLevel(currentLevel + 1);
    expToNext = nextLevelExp;

    const movesForLevel = getPossibleNewMoves(pokemon, currentLevel);
    newLearnableMoves.push(...movesForLevel);
  }

  // Recalculate stats
  const calculatedStats = calculateStats(pokemon.baseStats, pokemon.ivs, pokemon.evs, currentLevel);

  // Ensure baseline stats exist
  const baseline = pokemon.baseline || {
    transferredAtTimestamp: pokemon.lastActiveTimestamp || now,
    initialLevel: pokemon.level,
    initialExp: pokemon.exp,
    initialFriendship: pokemon.friendship,
    initialEvs: { ...pokemon.evs },
    initialTotalSteps: pokemon.totalSteps || 0,
  };

  const updatedPokemon: TamagotchiPokemon = {
    ...pokemon,
    level: currentLevel,
    exp: currentExp,
    expToNextLevel: expToNext,
    friendship: newFriendship,
    energy: newEnergy,
    totalSteps,
    isRested,
    calculatedStats,
    lastActiveTimestamp: now,
    baseline,
  };

  return {
    updatedPokemon,
    leveledUp,
    newLevel: currentLevel,
    newLearnableMoves,
    expGained,
    friendshipGained,
  };
}

export interface EVGainSummary {
  gains: Partial<Record<keyof PokemonEVs, number>>;
  totalGained: number;
}

export function applyEvGains(
  pokemon: TamagotchiPokemon,
  gains: Partial<Record<keyof PokemonEVs, number>>,
  multiplier: number = 1.0
): { updatedPokemon: TamagotchiPokemon; actualGains: Partial<Record<keyof PokemonEVs, number>> } {
  const buffMultiplier = pokemon.isRested ? 2.0 : 1.0;
  const totalRate = multiplier * buffMultiplier;

  let newEvs = { ...pokemon.evs };
  let currentTotalEvs = Object.values(newEvs).reduce((a, b) => a + b, 0);
  const actualGains: Partial<Record<keyof PokemonEVs, number>> = {};

  for (const [statKey, amount] of Object.entries(gains)) {
    const stat = statKey as keyof PokemonEVs;
    if (!amount || amount <= 0) continue;

    const adjustedAmount = Math.max(1, Math.floor(amount * totalRate));
    const currentStatEv = newEvs[stat] || 0;
    const allowedForStat = Math.min(adjustedAmount, 252 - currentStatEv);
    const actual = Math.max(0, Math.min(allowedForStat, 510 - currentTotalEvs));

    if (actual > 0) {
      newEvs[stat] = currentStatEv + actual;
      currentTotalEvs += actual;
      actualGains[stat] = actual;
    }
  }

  const calculatedStats = calculateStats(pokemon.baseStats, pokemon.ivs, newEvs, pokemon.level);

  return {
    updatedPokemon: {
      ...pokemon,
      evs: newEvs,
      calculatedStats,
      lastActiveTimestamp: Date.now(),
    },
    actualGains,
  };
}

export function recordWorkout(
  pokemon: TamagotchiPokemon,
  type: WorkoutRecord['type'],
  durationMinutes: number,
  settings: AppSettings,
  notes?: string
): { updatedPokemon: TamagotchiPokemon; evGain: { stat: keyof PokemonEVs; amount: number }; evGains: Partial<Record<keyof PokemonEVs, number>> } {
  const rules = (settings.evRules || DEFAULT_EV_RULES).filter((r) => r.enabled);
  const matchedRules = rules.filter(
    (r) =>
      r.triggerType === 'workout_type' &&
      r.workoutType === type &&
      durationMinutes >= (r.minDurationMinutes || 1)
  );

  const gains: Partial<Record<keyof PokemonEVs, number>> = {};

  if (matchedRules.length > 0) {
    const durationMultiplier = Math.max(1, Math.floor(durationMinutes / 15));
    for (const r of matchedRules) {
      gains[r.targetStat] = (gains[r.targetStat] || 0) + r.evAmount * durationMultiplier;
    }
  } else {
    // Default fallback
    const statMap: Record<string, keyof PokemonEVs> = {
      cardio: 'speed',
      weightlifting: 'attack',
      defense: 'defense',
      hiit: 'specialAttack',
      yoga: 'specialDefense',
      walking: 'hp',
      swimming: 'speed',
      cycling: 'speed',
      custom: 'hp',
    };
    const defaultStat = statMap[type] || 'speed';
    const baseGain = Math.max(2, Math.floor((durationMinutes / 15) * 4));
    gains[defaultStat] = baseGain;
  }

  const { updatedPokemon, actualGains } = applyEvGains(pokemon, gains, settings.workoutEvMultiplier || 1.0);
  const primaryStat = (Object.keys(actualGains)[0] as keyof PokemonEVs) || 'speed';
  const primaryAmount = actualGains[primaryStat] || 0;

  return {
    updatedPokemon,
    evGain: { stat: primaryStat, amount: primaryAmount },
    evGains: actualGains,
  };
}

export function logMeal(
  pokemon: TamagotchiPokemon,
  type: MealRecord['type'],
  settings?: AppSettings
): { updatedPokemon: TamagotchiPokemon; evGains: Partial<Record<keyof PokemonEVs, number>> } {
  const energyBoostMap = {
    breakfast: 40,
    lunch: 45,
    dinner: 40,
    snack: 20,
    water: 10,
  };

  const boost = energyBoostMap[type] || 30;
  const newEnergy = Math.min(100, pokemon.energy + boost);

  // Update streak if today
  const todayStr = new Date().toISOString().split('T')[0];
  let streakDays = pokemon.streakDays || 1;
  if (pokemon.lastStreakDate !== todayStr) {
    streakDays++;
  }

  let basePkm: TamagotchiPokemon = {
    ...pokemon,
    energy: newEnergy,
    streakDays,
    lastStreakDate: todayStr,
    lastFedTimestamp: Date.now(),
    lastActiveTimestamp: Date.now(),
  };

  // Evaluate EV rules for meals / water
  const gains: Partial<Record<keyof PokemonEVs, number>> = {};
  if (settings && settings.evRules) {
    const rules = settings.evRules.filter((r) => r.enabled);
    if (type === 'water') {
      const waterRules = rules.filter((r) => r.triggerType === 'drinking_regularly');
      for (const r of waterRules) {
        gains[r.targetStat] = (gains[r.targetStat] || 0) + r.evAmount;
      }
    } else {
      const mealRules = rules.filter((r) => r.triggerType === 'eating_regularly');
      for (const r of mealRules) {
        gains[r.targetStat] = (gains[r.targetStat] || 0) + r.evAmount;
      }
    }
  }

  const { updatedPokemon, actualGains } = applyEvGains(basePkm, gains, 1.0);

  return {
    updatedPokemon,
    evGains: actualGains,
  };
}

export function logSleep(
  pokemon: TamagotchiPokemon,
  durationHours: number,
  settings: AppSettings
): { updatedPokemon: TamagotchiPokemon; grantedRestedBuff: boolean; evGains: Partial<Record<keyof PokemonEVs, number>> } {
  const minHours = settings.sleepMinHours || 7;
  const maxHours = settings.sleepMaxHours || 8;
  const isHealthySleep = durationHours >= minHours && durationHours <= maxHours + 0.5;

  const now = Date.now();
  const restedUntil = isHealthySleep ? now + 24 * 3600 * 1000 : pokemon.restedUntilTimestamp;

  let basePkm: TamagotchiPokemon = {
    ...pokemon,
    energy: 100,
    isRested: isHealthySleep,
    restedUntilTimestamp: restedUntil,
    lastSleepTimestamp: now,
    lastActiveTimestamp: now,
  };

  // Evaluate EV rules for sleep
  const gains: Partial<Record<keyof PokemonEVs, number>> = {};
  if (settings.evRules) {
    const sleepRules = settings.evRules.filter(
      (r) =>
        r.enabled &&
        (r.triggerType === 'sleep_duration' || r.triggerType === 'sleep_regularity') &&
        durationHours >= (r.minSleepHours || minHours) &&
        durationHours <= (r.maxSleepHours || maxHours + 1.0)
    );
    for (const r of sleepRules) {
      gains[r.targetStat] = (gains[r.targetStat] || 0) + r.evAmount;
    }
  }

  const { updatedPokemon, actualGains } = applyEvGains(basePkm, gains, 1.0);

  return {
    updatedPokemon,
    grantedRestedBuff: isHealthySleep,
    evGains: actualGains,
  };
}

export function completeTaskReward(
  pokemon: TamagotchiPokemon,
  task: TaskItem,
  settings: AppSettings
): {
  updatedPokemon: TamagotchiPokemon;
  expGained: number;
  friendshipGained: number;
  evGains: Partial<Record<keyof PokemonEVs, number>>;
  leveledUp: boolean;
  newMoves: MoveData[];
} {
  let expGained = 0;
  let friendshipGained = 0;
  const evGains: Partial<Record<keyof PokemonEVs, number>> = {};

  if (task.rewardType === 'exp' && task.rewardConfig.expAmount) {
    expGained = task.rewardConfig.expAmount * (settings.expMultiplier || 1.0);
  } else if (task.rewardType === 'friendship' && task.rewardConfig.friendshipAmount) {
    friendshipGained = task.rewardConfig.friendshipAmount;
  } else if (task.rewardType === 'ev' && task.rewardConfig.evStat && task.rewardConfig.evAmount) {
    evGains[task.rewardConfig.evStat] = task.rewardConfig.evAmount;
  }

  // Also check custom task EV rules in settings
  if (settings.evRules) {
    const taskRules = settings.evRules.filter(
      (r) => r.enabled && r.triggerType === 'task_completion' && (!r.taskCategory || r.taskCategory === task.category)
    );
    for (const r of taskRules) {
      evGains[r.targetStat] = (evGains[r.targetStat] || 0) + r.evAmount;
    }
  }

  // Apply EV gains
  let { updatedPokemon } = applyEvGains(pokemon, evGains, 1.0);

  // Apply EXP and Level Ups
  let currentLevel = updatedPokemon.level;
  let currentExp = updatedPokemon.exp + expGained;
  let expToNext = updatedPokemon.expToNextLevel;
  let leveledUp = false;
  const newMoves: MoveData[] = [];

  while (currentExp >= expToNext && currentLevel < 100) {
    currentLevel++;
    leveledUp = true;
    const nextExp = getExpForLevel(currentLevel + 1);
    expToNext = nextExp;
    newMoves.push(...getPossibleNewMoves(updatedPokemon, currentLevel));
  }

  const newFriendship = Math.min(255, (updatedPokemon.friendship || 70) + friendshipGained);
  const calculatedStats = calculateStats(updatedPokemon.baseStats, updatedPokemon.ivs, updatedPokemon.evs, currentLevel);

  return {
    updatedPokemon: {
      ...updatedPokemon,
      level: currentLevel,
      exp: currentExp,
      expToNextLevel: expToNext,
      friendship: newFriendship,
      calculatedStats,
      lastActiveTimestamp: Date.now(),
    },
    expGained,
    friendshipGained,
    evGains,
    leveledUp,
    newMoves,
  };
}

export function applyRewardItem(
  pokemon: TamagotchiPokemon,
  itemType: string
): TamagotchiPokemon {
  if (itemType === 'rare_candy') {
    const newLevel = Math.min(100, pokemon.level + 1);
    const newExp = getExpForLevel(newLevel);
    const nextExp = getExpForLevel(newLevel + 1);
    const stats = calculateStats(pokemon.baseStats, pokemon.ivs, pokemon.evs, newLevel);
    return {
      ...pokemon,
      level: newLevel,
      exp: newExp,
      expToNextLevel: nextExp,
      calculatedStats: stats,
    };
  }

  const statMap: Record<string, keyof PokemonEVs> = {
    protein: 'attack',
    iron: 'defense',
    carbos: 'speed',
    calcium: 'specialAttack',
    zinc: 'specialDefense',
    hp_up: 'hp',
  };

  const targetStat = statMap[itemType];
  if (targetStat) {
    const currentEv = pokemon.evs[targetStat] || 0;
    const newEvs = {
      ...pokemon.evs,
      [targetStat]: Math.min(252, currentEv + 10),
    };
    return {
      ...pokemon,
      evs: newEvs,
      calculatedStats: calculateStats(pokemon.baseStats, pokemon.ivs, newEvs, pokemon.level),
    };
  }

  if (itemType === 'pp_max') {
    return {
      ...pokemon,
      energy: 100,
      moves: pokemon.moves.map((m) => ({ ...m, currentPp: m.pp })),
    };
  }

  if (itemType === 'leftovers') {
    return {
      ...pokemon,
      heldItem: 'leftovers',
      energy: 100,
    };
  }

  if (itemType === 'exp_share') {
    return {
      ...pokemon,
      heldItem: 'exp_share',
    };
  }

  if (itemType === 'mystery_gift' || itemType === 'master_ball') {
    return {
      ...pokemon,
      friendship: 255,
      energy: 100,
      isRested: true,
      restedUntilTimestamp: Date.now() + 48 * 3600 * 1000,
    };
  }

  return pokemon;
}
