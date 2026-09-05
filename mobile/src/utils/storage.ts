import AsyncStorage from '@react-native-async-storage/async-storage';
import { TamagotchiPokemon, AppSettings, StreakReward, TaskItem, InventoryItem } from '../types/pokemon';
import { DEFAULT_SETTINGS, AVAILABLE_REWARDS } from './tamagotchiEngine';

const PKM_STORAGE_KEY = 'pkm_data';
const PKM_ROSTER_KEY = 'pkm_roster';
const ACTIVE_PKM_ID_KEY = 'active_pkm_id';
const SETTINGS_STORAGE_KEY = 'app_settings';
const REWARDS_STORAGE_KEY = 'streak_rewards';
const TASKS_STORAGE_KEY = 'todo_tasks';
const INVENTORY_STORAGE_KEY = 'player_inventory';
const HYDRATION_STORAGE_KEY = 'hydration_logs';

export async function getStoredPokemon(): Promise<TamagotchiPokemon | null> {
  try {
    const raw = await AsyncStorage.getItem(PKM_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TamagotchiPokemon;
  } catch (e) {
    console.error('Failed to load Pokémon from storage:', e);
    return null;
  }
}

export async function saveStoredPokemon(pokemon: TamagotchiPokemon): Promise<void> {
  try {
    await AsyncStorage.setItem(PKM_STORAGE_KEY, JSON.stringify(pokemon));
    // Also sync to roster
    const roster = await getStoredPokemonRoster();
    const existingIndex = roster.findIndex((p) => p.speciesId === pokemon.speciesId && p.nickname === pokemon.nickname);
    if (existingIndex >= 0) {
      roster[existingIndex] = pokemon;
    } else {
      roster.push(pokemon);
    }
    await AsyncStorage.setItem(PKM_ROSTER_KEY, JSON.stringify(roster));
  } catch (e) {
    console.error('Failed to save Pokémon to storage:', e);
  }
}

export async function clearStoredPokemon(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PKM_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear Pokémon from storage:', e);
  }
}

// Multi-Pokemon Roster Storage
export async function getStoredPokemonRoster(): Promise<TamagotchiPokemon[]> {
  try {
    const raw = await AsyncStorage.getItem(PKM_ROSTER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    // Fallback to single pokemon if roster empty
    const single = await getStoredPokemon();
    return single ? [single] : [];
  } catch (e) {
    console.error('Failed to get Pokemon roster:', e);
    return [];
  }
}

export async function switchActivePokemon(pokemon: TamagotchiPokemon): Promise<void> {
  try {
    await AsyncStorage.setItem(PKM_STORAGE_KEY, JSON.stringify(pokemon));
  } catch (e) {
    console.error('Failed to switch active Pokemon:', e);
  }
}

export async function getStoredSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      evRules: parsed.evRules && parsed.evRules.length > 0 ? parsed.evRules : DEFAULT_SETTINGS.evRules,
      rewardConfigs: parsed.rewardConfigs && parsed.rewardConfigs.length > 0 ? parsed.rewardConfigs : DEFAULT_SETTINGS.rewardConfigs,
    };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

export async function saveStoredSettings(settings: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

export async function getStoredRewards(): Promise<StreakReward[]> {
  try {
    const raw = await AsyncStorage.getItem(REWARDS_STORAGE_KEY);
    if (!raw) return AVAILABLE_REWARDS;
    return JSON.parse(raw);
  } catch (e) {
    return AVAILABLE_REWARDS;
  }
}

export async function saveStoredRewards(rewards: StreakReward[]): Promise<void> {
  try {
    await AsyncStorage.setItem(REWARDS_STORAGE_KEY, JSON.stringify(rewards));
  } catch (e) {
    console.error('Failed to save rewards:', e);
  }
}

// --- ToDo Tasks Storage ---
export async function getStoredTasks(): Promise<TaskItem[]> {
  try {
    const raw = await AsyncStorage.getItem(TASKS_STORAGE_KEY);
    if (!raw) return getDefaultTasks();
    return JSON.parse(raw);
  } catch (e) {
    return getDefaultTasks();
  }
}

export async function saveStoredTasks(tasks: TaskItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.error('Failed to save tasks:', e);
  }
}

export function getDefaultTasks(): TaskItem[] {
  return [
    {
      id: 'task-1',
      title: 'Finish homework / Study session',
      description: 'Spend 30 minutes focused on learning or coursework',
      category: 'Study',
      repeatType: 'daily',
      rewardType: 'exp',
      rewardConfig: { expAmount: 250 },
      streakRewardEnabled: true,
      streakRewardItem: 'Rare Candy',
      currentStreak: 1,
      completedDates: [],
      createdAt: Date.now(),
    },
    {
      id: 'task-2',
      title: 'Drink 2 Liters of Water',
      description: 'Stay hydrated throughout the entire day',
      category: 'Health',
      repeatType: 'daily',
      rewardType: 'ev',
      rewardConfig: { evStat: 'hp', evAmount: 8 },
      streakRewardEnabled: false,
      currentStreak: 0,
      completedDates: [],
      createdAt: Date.now(),
    },
    {
      id: 'task-3',
      title: '30-Minute Workout or Walk',
      description: 'Cardio, gym workout, or brisk walk outside',
      category: 'Fitness',
      repeatType: 'daily',
      rewardType: 'ev',
      rewardConfig: { evStat: 'attack', evAmount: 12 },
      streakRewardEnabled: true,
      streakRewardItem: 'Protein (+10 Atk EV)',
      currentStreak: 0,
      completedDates: [],
      createdAt: Date.now(),
    },
  ];
}

// --- Player Inventory Storage ---
export async function getStoredInventory(): Promise<InventoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(INVENTORY_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export async function saveStoredInventory(items: InventoryItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save inventory:', e);
  }
}

export async function addInventoryItem(item: Omit<InventoryItem, 'id' | 'obtainedTimestamp'> & { quantity?: number }): Promise<InventoryItem[]> {
  const inventory = await getStoredInventory();
  const existing = inventory.find((i) => i.itemType === item.itemType);
  if (existing) {
    existing.quantity += item.quantity || 1;
  } else {
    inventory.push({
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: item.name,
      itemType: item.itemType,
      description: item.description,
      quantity: item.quantity || 1,
      obtainedTimestamp: Date.now(),
      source: item.source || 'Reward',
      rewardId: item.rewardId,
    });
  }
  await saveStoredInventory(inventory);
  return inventory;
}

export async function consumeInventoryItem(itemType: string): Promise<{ success: boolean; updatedInventory: InventoryItem[] }> {
  const inventory = await getStoredInventory();
  const index = inventory.findIndex((i) => i.itemType === itemType && i.quantity > 0);
  if (index === -1) {
    return { success: false, updatedInventory: inventory };
  }

  inventory[index].quantity -= 1;
  if (inventory[index].quantity <= 0) {
    inventory.splice(index, 1);
  }

  await saveStoredInventory(inventory);
  return { success: true, updatedInventory: inventory };
}

// --- Hydration Logging Storage ---
export async function getTodayHydrationCups(): Promise<number> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const raw = await AsyncStorage.getItem(`${HYDRATION_STORAGE_KEY}_${today}`);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

export async function addHydrationCup(): Promise<number> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const current = await getTodayHydrationCups();
    const next = current + 1;
    await AsyncStorage.setItem(`${HYDRATION_STORAGE_KEY}_${today}`, next.toString());
    await incrementStateVersion();
    return next;
  } catch {
    return 1;
  }
}

// --- Authoritative State Versioning & Idempotency ---
const STATE_VERSION_KEY = 'authoritative_state_version';
const PROCESSED_OPS_KEY = 'processed_operation_ids';

export async function getStateVersion(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STATE_VERSION_KEY);
    return raw ? parseInt(raw, 10) : 100;
  } catch {
    return 100;
  }
}

export async function incrementStateVersion(): Promise<number> {
  try {
    const current = await getStateVersion();
    const next = current + 1;
    await AsyncStorage.setItem(STATE_VERSION_KEY, next.toString());
    return next;
  } catch {
    return 101;
  }
}

export async function isOperationProcessed(operationId: string): Promise<boolean> {
  if (!operationId) return false;
  try {
    const raw = await AsyncStorage.getItem(PROCESSED_OPS_KEY);
    if (!raw) return false;
    const list: string[] = JSON.parse(raw);
    return list.includes(operationId);
  } catch {
    return false;
  }
}

export async function recordProcessedOperation(operationId: string): Promise<void> {
  if (!operationId) return;
  try {
    const raw = await AsyncStorage.getItem(PROCESSED_OPS_KEY);
    let list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(operationId)) {
      list.push(operationId);
      // Keep last 500 operations
      if (list.length > 500) {
        list = list.slice(list.length - 500);
      }
      await AsyncStorage.setItem(PROCESSED_OPS_KEY, JSON.stringify(list));
    }
  } catch {}
}

export async function getProcessedOperationsCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(PROCESSED_OPS_KEY);
    if (!raw) return 0;
    const list: string[] = JSON.parse(raw);
    return list.length;
  } catch {
    return 0;
  }
}

