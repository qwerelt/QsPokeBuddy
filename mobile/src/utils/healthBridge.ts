import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TamagotchiPokemon, AppSettings, WorkoutRecord, MoveData } from '../types/pokemon';
import { processCircadianAndPassive, recordWorkout, logSleep } from './tamagotchiEngine';
import { saveStoredPokemon } from './storage';

const { HealthConnectBridge } = NativeModules;

export interface FitnessAppInfo {
  id: string;
  name: string;
  packageName: string;
  isInstalled: boolean;
}

export interface RawHealthData {
  steps: number;
  distanceMeters: number;
  sleepDurationHours: number;
  isRested: boolean;
  workouts: Array<{
    title: string;
    type: string;
    evType: 'hp' | 'attack' | 'defense' | 'spAtk' | 'spDef' | 'speed';
    durationMinutes: number;
  }>;
  source: string;
  grantedPermissionsCount?: number;
  error?: string;
}

export interface SyncResult {
  success: boolean;
  source: string;
  stepsSynced: number;
  stepDelta: number;
  expGained: number;
  friendshipGained: number;
  leveledUp: boolean;
  newMoves: MoveData[];
  restedApplied: boolean;
  evsGained: {
    hp: number;
    attack: number;
    defense: number;
    spAtk: number;
    spDef: number;
    speed: number;
  };
  message: string;
}

const STORAGE_LAST_HEALTH_STEPS_KEY = 'pkm_last_health_steps';
const STORAGE_LAST_HEALTH_DATE_KEY = 'pkm_last_health_date';
const STORAGE_SELECTED_FITNESS_APP_KEY = 'pkm_selected_fitness_app';

export async function checkHealthConnectStatus(): Promise<'Available' | 'UpdateRequired' | 'NotSupported'> {
  if (Platform.OS !== 'android' || !HealthConnectBridge) {
    return 'NotSupported';
  }
  try {
    return await HealthConnectBridge.checkAvailability();
  } catch {
    return 'NotSupported';
  }
}

export async function openHealthConnectSettings(): Promise<void> {
  if (HealthConnectBridge?.openHealthConnectSettings) {
    await HealthConnectBridge.openHealthConnectSettings();
  }
}

export async function openHealthConnectPlayStore(): Promise<void> {
  if (HealthConnectBridge?.openPlayStore) {
    await HealthConnectBridge.openPlayStore();
  }
}

export async function getInstalledFitnessApps(): Promise<FitnessAppInfo[]> {
  if (Platform.OS !== 'android' || !HealthConnectBridge?.getInstalledFitnessApps) {
    return [
      { id: 'zepp', name: 'Zepp (Amazfit)', packageName: 'com.huami.watch.hmwatchmanager', isInstalled: false },
      { id: 'zepp_life', name: 'Zepp Life (Mi Fit)', packageName: 'com.xiaomi.hm.health', isInstalled: false },
      { id: 'google_fit', name: 'Google Fit', packageName: 'com.google.android.apps.fitness', isInstalled: false },
      { id: 'samsung_health', name: 'Samsung Health', packageName: 'com.sec.android.app.shealth', isInstalled: false },
      { id: 'garmin', name: 'Garmin Connect', packageName: 'com.garmin.android.apps.connectmobile', isInstalled: false },
      { id: 'phone_pedometer', name: 'Built-in Phone Pedometer', packageName: 'hardware.sensor', isInstalled: true },
    ];
  }
  try {
    const apps: FitnessAppInfo[] = await HealthConnectBridge.getInstalledFitnessApps();
    apps.push({
      id: 'phone_pedometer',
      name: 'Built-in Phone Pedometer',
      packageName: 'hardware.sensor',
      isInstalled: true,
    });
    return apps;
  } catch {
    return [];
  }
}

export async function openFitnessApp(packageName: string): Promise<void> {
  if (HealthConnectBridge?.openFitnessApp && packageName !== 'hardware.sensor') {
    await HealthConnectBridge.openFitnessApp(packageName);
  }
}

export async function getSelectedFitnessApp(): Promise<{ id: string; name: string } | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_SELECTED_FITNESS_APP_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function setSelectedFitnessApp(app: { id: string; name: string }): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_SELECTED_FITNESS_APP_KEY, JSON.stringify(app));
  } catch {}
}

export async function fetchRawHealthData(): Promise<RawHealthData> {
  if (Platform.OS !== 'android' || !HealthConnectBridge) {
    return {
      steps: 0,
      distanceMeters: 0,
      sleepDurationHours: 0,
      isRested: false,
      workouts: [],
      source: 'MockFallback',
    };
  }
  return await HealthConnectBridge.getHealthData();
}

export async function syncHealthWithPokemon(
  pokemon: TamagotchiPokemon,
  settings: AppSettings
): Promise<{ updatedPokemon: TamagotchiPokemon; result: SyncResult }> {
  const raw = await fetchRawHealthData();
  const todayStr = new Date().toISOString().split('T')[0];

  // Retrieve last recorded steps for today
  let previousSteps = 0;
  try {
    const lastSyncDate = (await AsyncStorage.getItem(STORAGE_LAST_HEALTH_DATE_KEY)) || '';
    if (lastSyncDate === todayStr) {
      const storedSteps = await AsyncStorage.getItem(STORAGE_LAST_HEALTH_STEPS_KEY);
      previousSteps = storedSteps ? parseInt(storedSteps, 10) : 0;
    }
  } catch {}

  // Calculate new steps taken since last sync
  const currentTotalSteps = raw.steps;
  const stepDelta = Math.max(0, currentTotalSteps - previousSteps);

  // 1. Process Passive Daycare EXP & Steps
  const processRes = processCircadianAndPassive(pokemon, settings, stepDelta);
  let currentPkm = processRes.updatedPokemon;

  // 2. Process Sleep (Rested Buff)
  let restedApplied = false;
  if (raw.isRested && !currentPkm.isRested) {
    const sleepRes = logSleep(currentPkm, raw.sleepDurationHours, settings);
    currentPkm = sleepRes.updatedPokemon;
    restedApplied = sleepRes.grantedRestedBuff;
  }

  // 3. Process Workouts & EV Allocation
  const evGains = { hp: 0, attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 };
  if (raw.workouts && raw.workouts.length > 0) {
    for (const w of raw.workouts) {
      const workoutType: WorkoutRecord['type'] =
        w.evType === 'speed'
          ? 'cardio'
          : w.evType === 'attack'
          ? 'weightlifting'
          : w.evType === 'defense'
          ? 'defense'
          : w.evType === 'spAtk'
          ? 'hiit'
          : w.evType === 'spDef'
          ? 'yoga'
          : 'walking';

      const wResult = recordWorkout(currentPkm, workoutType, w.durationMinutes, settings);
      currentPkm = wResult.updatedPokemon;
      const statKey = wResult.evGain.stat as keyof typeof evGains;
      if (evGains[statKey] !== undefined) {
        evGains[statKey] += wResult.evGain.amount;
      }
    }
  }

  // Persist updated state & step baseline
  await saveStoredPokemon(currentPkm);
  try {
    await AsyncStorage.setItem(STORAGE_LAST_HEALTH_STEPS_KEY, currentTotalSteps.toString());
    await AsyncStorage.setItem(STORAGE_LAST_HEALTH_DATE_KEY, todayStr);
  } catch {}

  const result: SyncResult = {
    success: true,
    source: raw.source,
    stepsSynced: currentTotalSteps,
    stepDelta,
    expGained: processRes.expGained,
    friendshipGained: processRes.friendshipGained,
    leveledUp: processRes.leveledUp,
    newMoves: processRes.newLearnableMoves,
    restedApplied,
    evsGained: evGains,
    message: `Synced ${stepDelta.toLocaleString()} new steps (+${processRes.expGained} EXP, +${processRes.friendshipGained} Friendship) via ${raw.source}.`,
  };

  return { updatedPokemon: currentPkm, result };
}
