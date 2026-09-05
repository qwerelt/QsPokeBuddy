/**
 * Qs Poke Buddy - Authoritative Mobile Watch Companion Bridge
 * Hosts loopback HTTP server on 127.0.0.1:8088 (Boundary A) and manages
 * state versioning, idempotent operations, and live synchronization.
 */
import { Platform, NativeModules, DeviceEventEmitter } from 'react-native';

const { WatchBridge } = NativeModules;
import {
  TamagotchiPokemon,
  AppSettings,
  WatchLedgerBatch,
  WatchBridgeStatus,
  PokemonEVs,
  TaskItem,
  InventoryItem,
} from '../types/pokemon';
import {
  getStoredPokemon,
  saveStoredPokemon,
  getStoredSettings,
  addInventoryItem,
  getStoredTasks,
  saveStoredTasks,
  getTodayHydrationCups,
  addHydrationCup,
  getStoredInventory,
  getStoredRewards,
  getStateVersion,
  incrementStateVersion,
  isOperationProcessed,
  recordProcessedOperation,
  getProcessedOperationsCount,
} from './storage';
import { processCircadianAndPassive } from './tamagotchiEngine';
import { watchManager } from './watch/WatchManager';
import { WatchMessage, WatchProviderType, WatchStatePayload, WatchOperation } from '../types/watch';

// Bridge statistics & telemetry
let bridgeStats: WatchBridgeStatus = {
  isRunning: true,
  port: 8088,
  url: 'http://127.0.0.1:8088',
  stateVersion: 100,
  processedOperationsCount: 0,
  deviceName: 'Amazfit Watch (Zepp OS)',
  lastSyncTimestamp: null,
  lastOperationId: null,
  totalStepsReceived: 0,
  totalEvsReceived: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
  totalItemsReceivedCount: 0,
};

type WatchSyncListener = (batch: WatchLedgerBatch, updatedPkm: TamagotchiPokemon) => void;
const syncListeners = new Set<WatchSyncListener>();

let isInitialized = false;

/**
 * Format Full Authoritative State for Watch Synchronization
 */
export async function getFullAuthoritativeStatePayload(): Promise<WatchStatePayload> {
  const pkm = await getStoredPokemon();
  const settings = await getStoredSettings();
  const tasks = await getStoredTasks();
  const inventory = await getStoredInventory();
  const rewards = await getStoredRewards();
  const waterCups = await getTodayHydrationCups();
  const stateVersion = await getStateVersion();

  const formattedPkm = pkm
    ? {
        sessionId: `session_${pkm.speciesId}_${pkm.nickname}_${pkm.level}`,
        speciesId: pkm.speciesId,
        speciesName: pkm.speciesName,
        nickname: pkm.nickname,
        level: pkm.level,
        currentExp: pkm.exp,
        expToNext: pkm.expToNextLevel,
        friendship: pkm.friendship || 0,
        energy: pkm.energy || 100,
        isRested: !!pkm.isRested,
        totalSteps: pkm.totalSteps || 0,
        types: pkm.types || ['Normal'],
        moves: pkm.moves || [],
        baseStats: pkm.baseStats,
        calculatedStats: pkm.calculatedStats || pkm.baseStats,
        evs: pkm.evs || { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
        ivs: pkm.ivs || { hp: 15, attack: 15, defense: 15, specialAttack: 15, specialDefense: 15, speed: 15 },
        waterCups: waterCups || 0,
        spritePath: `pkm_${pkm.speciesId}.png`,
        spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pkm.speciesId}.png`,
      }
    : null;

  const today = new Date().toISOString().split('T')[0];
  const formattedTasks = (tasks || []).map((t) => ({
    id: t.id,
    title: t.title,
    category: t.category,
    rewardType: t.rewardType,
    rewardConfig: t.rewardConfig,
    completed: t.completedDates?.includes(today) || false,
    currentStreak: t.currentStreak || 0,
  }));

  const primaryEvRule = settings.evRules?.find((r) => r.enabled);
  const targetStat = primaryEvRule ? primaryEvRule.targetStat : 'attack';

  const formattedRules = {
    exp_per_step: 1.0 * (settings.expMultiplier || 1.0),
    exp_multiplier: settings.expMultiplier || 1.0,
    steps_per_ev: 100,
    target_stat: targetStat,
    steps_per_friendship: settings.stepsPerFriendship || 256,
    item_milestones: (settings.rewardConfigs || [])
      .filter((r) => r.enabled && r.triggerType === 'step_milestone')
      .map((r) => ({
        steps: r.triggerThreshold,
        itemType: r.itemType,
        name: r.name,
      })),
    step_interval_milestone: 2000,
  };

  return {
    stateVersion,
    pokemon: formattedPkm,
    tasks: formattedTasks,
    inventory: inventory || [],
    rewards: rewards || [],
    rules: formattedRules,
    timestamp: Date.now(),
  };
}

/**
 * Initialize Watch Bridge & Localhost HTTP Server on port 8088
 */
export async function initWatchBridge(): Promise<WatchBridgeStatus> {
  if (isInitialized) {
    return getWatchBridgeStatus();
  }

  isInitialized = true;
  const settings = await getStoredSettings();
  const provider = (settings.watchCompanionProvider as WatchProviderType) || 'zepp';

  // 1. Initialize central WatchManager
  await watchManager.initialize(provider);

  // 2. Listen to native inbound operations from 127.0.0.1:8088
  DeviceEventEmitter.addListener('onWatchOperationReceived', async (rawPayload: any) => {
    try {
      console.log('[ANDROID_API] Received operation from watch bridge:', rawPayload);
      const parsed = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
      await handleInboundWatchOperation(parsed);
    } catch (e) {
      console.error('[ANDROID_API] Error processing inbound watch operation:', e);
    }
  });

  // 3. Start local loopback HTTP server on 127.0.0.1:8088
  await startWatchBridge(8088);

  return getWatchBridgeStatus();
}

/**
 * Start or resume the loopback HTTP server on 127.0.0.1:8088
 */
export async function startWatchBridge(port = 8088): Promise<boolean> {
  bridgeStats.isRunning = true;
  bridgeStats.port = port;
  bridgeStats.url = `http://127.0.0.1:${port}`;

  const statePayload = await getFullAuthoritativeStatePayload();
  const stateJson = JSON.stringify(statePayload);

  if (Platform.OS === 'android' && WatchBridge?.startServer) {
    try {
      await WatchBridge.startServer(port, stateJson, statePayload.stateVersion);
      console.log(`[ANDROID_API] Localhost server listening on 127.0.0.1:${port} (Version=${statePayload.stateVersion})`);
    } catch (e) {
      console.warn('[ANDROID_API] startServer notice:', e);
    }
  }

  bridgeStats.stateVersion = statePayload.stateVersion;
  bridgeStats.processedOperationsCount = await getProcessedOperationsCount();
  return true;
}

/**
 * Stop loopback HTTP server
 */
export async function stopWatchBridge(): Promise<boolean> {
  if (Platform.OS === 'android' && WatchBridge?.stopServer) {
    try {
      await WatchBridge.stopServer();
    } catch (_) {}
  }
  bridgeStats.isRunning = false;
  return true;
}

/**
 * Update authoritative state cache and sync down to native HTTP server
 */
export async function syncAuthoritativeStateToBridge(): Promise<WatchStatePayload> {
  const statePayload = await getFullAuthoritativeStatePayload();
  const stateJson = JSON.stringify(statePayload);

  if (Platform.OS === 'android' && WatchBridge?.updateAuthoritativeState) {
    try {
      await WatchBridge.updateAuthoritativeState(stateJson, statePayload.stateVersion);
    } catch (e) {
      console.warn('[ANDROID_API] updateAuthoritativeState error:', e);
    }
  }

  bridgeStats.stateVersion = statePayload.stateVersion;
  bridgeStats.processedOperationsCount = await getProcessedOperationsCount();
  bridgeStats.lastSyncTimestamp = Date.now();
  return statePayload;
}

/**
 * Alias for state updates
 */
export async function updateWatchCompanionPayloads(
  pkm: TamagotchiPokemon,
  settings: AppSettings
): Promise<void> {
  await syncAuthoritativeStateToBridge();
}

/**
 * Process inbound watch operation from durable outbox with strict idempotency
 */
export async function handleInboundWatchOperation(operation: any): Promise<{
  success: boolean;
  stateVersion: number;
  operationId: string;
}> {
  const operationId = operation.operationId || operation.batch_id || `op_${Date.now()}`;
  const opType = operation.type || (operation.batch_id ? 'SYNC_LEDGER' : 'GENERIC');
  const payload = operation.payload || operation;

  // Idempotency check
  const alreadyDone = await isOperationProcessed(operationId);
  if (alreadyDone) {
    console.log(`[ANDROID_API] Operation ${operationId} already processed. Returning current state.`);
    const currentVersion = await getStateVersion();
    return { success: true, stateVersion: currentVersion, operationId };
  }

  console.log(`[ANDROID_API] Processing [${opType}] operationId=${operationId}`);

  switch (opType) {
    case 'COMPLETE_TASK': {
      const taskId = payload.taskId || payload.id;
      if (taskId) {
        await handleWatchTaskComplete(taskId);
      }
      break;
    }

    case 'WATER_LOG': {
      const count = payload.cups || 1;
      for (let i = 0; i < count; i++) {
        await addHydrationCup();
      }
      break;
    }

    case 'STEP_DELTA': {
      const delta = payload.deltaSteps || payload.steps || 0;
      if (delta > 0) {
        await handleWatchStepDelta(delta);
      }
      break;
    }

    case 'SYNC_LEDGER':
    case 'SYNC_LEDGER_BATCH': {
      await processWatchLedgerBatch(payload);
      break;
    }

    case 'ADD_EV': {
      const stat = (payload.stat || payload.statName || 'hp').toLowerCase();
      const amount = payload.amount || 1;
      const pkm = await getStoredPokemon();
      if (pkm) {
        const evs = pkm.evs || { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };
        const keyMap: Record<string, keyof PokemonEVs> = {
          hp: 'hp',
          attack: 'attack',
          atk: 'attack',
          defense: 'defense',
          def: 'defense',
          specialattack: 'specialAttack',
          spatk: 'specialAttack',
          spa: 'specialAttack',
          'sp. atk': 'specialAttack',
          specialdefense: 'specialDefense',
          spdef: 'specialDefense',
          spd: 'specialDefense',
          'sp. def': 'specialDefense',
          speed: 'speed',
          spe: 'speed',
        };
        const targetKey = keyMap[stat] || 'hp';
        evs[targetKey] = Math.min(252, (evs[targetKey] || 0) + amount);
        pkm.evs = evs;
        await saveStoredPokemon(pkm);
      }
      break;
    }

    default:
      console.log(`[ANDROID_API] Generic operation received: ${opType}`);
      break;
  }

  // Record operation ID to guarantee idempotency on retries
  await recordProcessedOperation(operationId);
  const newVersion = await incrementStateVersion();

  // Update native HTTP server cache
  await syncAuthoritativeStateToBridge();

  bridgeStats.lastOperationId = operationId;
  bridgeStats.lastSyncTimestamp = Date.now();

  return {
    success: true,
    stateVersion: newVersion,
    operationId,
  };
}

/**
 * Handle on-wrist task completion
 */
export async function handleWatchTaskComplete(taskId: string): Promise<boolean> {
  const tasks = await getStoredTasks();
  const today = new Date().toISOString().split('T')[0];
  const target = tasks.find((t) => t.id === taskId);
  if (!target) return false;

  if (!target.completedDates?.includes(today)) {
    target.completedDates = [...(target.completedDates || []), today];
    target.currentStreak = (target.currentStreak || 0) + 1;
    await saveStoredTasks(tasks);

    // Apply task EXP reward to active Pokémon
    const pkm = await getStoredPokemon();
    if (pkm) {
      const settings = await getStoredSettings();
      if (target.rewardType === 'exp') {
        const expGain = target.rewardConfig?.expAmount || 50;
        const res = processCircadianAndPassive(pkm, settings, 0);
        res.updatedPokemon.exp += expGain;
        await saveStoredPokemon(res.updatedPokemon);
      }
    }
    await incrementStateVersion();
    return true;
  }
  return false;
}

/**
 * Handle on-wrist step delta
 */
export async function handleWatchStepDelta(stepDelta: number): Promise<void> {
  const pkm = await getStoredPokemon();
  if (!pkm) return;
  const settings = await getStoredSettings();
  const result = processCircadianAndPassive(pkm, settings, stepDelta);
  await saveStoredPokemon(result.updatedPokemon);
  bridgeStats.totalStepsReceived += stepDelta;
  bridgeStats.lastSyncTimestamp = Date.now();
  await incrementStateVersion();
}

/**
 * Switch active smartwatch hardware provider (Zepp OS vs Garmin)
 */
export async function setWatchProvider(provider: WatchProviderType): Promise<void> {
  await watchManager.setProvider(provider);
  bridgeStats.deviceName = provider === 'zepp' ? 'Amazfit Watch (Zepp OS)' : 'Garmin Watch (Connect IQ)';
  await syncAuthoritativeStateToBridge();
}

/**
 * Process and commit a delta-log ledger batch received from the smartwatch
 */
export async function processWatchLedgerBatch(batch: WatchLedgerBatch & {
  water_logged?: number;
  tasks_completed?: { taskId: string; timestamp?: number }[];
  new_moves_learned?: any[];
}): Promise<{
  success: boolean;
  updatedPokemon: TamagotchiPokemon | null;
  itemsAwarded: number;
}> {
  if (!batch || !batch.batch_id) {
    return { success: false, updatedPokemon: null, itemsAwarded: 0 };
  }

  const pkm = await getStoredPokemon();
  if (!pkm) {
    console.warn('[ANDROID_API] Batch received but no active Pokémon found in storage.');
    return { success: false, updatedPokemon: null, itemsAwarded: 0 };
  }

  const settings = await getStoredSettings();

  // 1. Apply Step Deltas & EXP gains
  const stepDelta = batch.delta_steps || 0;
  const result = processCircadianAndPassive(pkm, settings, stepDelta);
  let updatedPkm = result.updatedPokemon;

  // 2. Commit EV gains from on-wrist workout/rule tracking
  if (batch.evs_earned) {
    const currentEvs = updatedPkm.evs || { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };
    const mergedEvs: PokemonEVs = {
      hp: currentEvs.hp + (batch.evs_earned.hp || 0),
      attack: currentEvs.attack + (batch.evs_earned.attack || 0),
      defense: currentEvs.defense + (batch.evs_earned.defense || 0),
      specialAttack: currentEvs.specialAttack + (batch.evs_earned.specialAttack || 0),
      specialDefense: currentEvs.specialDefense + (batch.evs_earned.specialDefense || 0),
      speed: currentEvs.speed + (batch.evs_earned.speed || 0),
    };
    updatedPkm.evs = mergedEvs;

    Object.keys(batch.evs_earned).forEach((k) => {
      const key = k as keyof PokemonEVs;
      bridgeStats.totalEvsReceived[key] += batch.evs_earned[key] || 0;
    });
  }

  // 3. Commit On-Wrist Discovered Items to Player Inventory
  let itemsAwarded = 0;
  if (Array.isArray(batch.items_found) && batch.items_found.length > 0) {
    for (const item of batch.items_found) {
      await addInventoryItem({
        name: item.name || 'Discovered Item',
        itemType: item.itemType || 'potion',
        description: `Discovered on-wrist during walk milestone (${item.stepMilestone || 'step milestone'} steps).`,
        source: `${bridgeStats.deviceName || 'Smartwatch'} Companion`,
        quantity: 1,
      });
      itemsAwarded++;
    }
  }

  // 4. Commit Water Logging from Watch
  if (batch.water_logged && batch.water_logged > 0) {
    for (let w = 0; w < batch.water_logged; w++) {
      await addHydrationCup();
    }
  }

  // 5. Commit Completed Tasks from Watch
  if (Array.isArray(batch.tasks_completed) && batch.tasks_completed.length > 0) {
    const tasks = await getStoredTasks();
    const today = new Date().toISOString().split('T')[0];
    for (const t of batch.tasks_completed) {
      const target = tasks.find((item) => item.id === t.taskId);
      if (target && !target.completedDates?.includes(today)) {
        target.completedDates = [...(target.completedDates || []), today];
        target.currentStreak = (target.currentStreak || 0) + 1;
      }
    }
    await saveStoredTasks(tasks);
  }

  // 6. Save updated Pokemon state
  await saveStoredPokemon(updatedPkm);
  await incrementStateVersion();

  // 7. Update authoritative state on local HTTP server
  await syncAuthoritativeStateToBridge();

  // 8. Update local bridge stats
  bridgeStats.lastSyncTimestamp = Date.now();
  bridgeStats.lastOperationId = batch.batch_id;
  bridgeStats.totalStepsReceived += stepDelta;
  bridgeStats.totalItemsReceivedCount += itemsAwarded;

  // 9. Notify active UI subscribers
  syncListeners.forEach((listener) => listener(batch, updatedPkm));

  return {
    success: true,
    updatedPokemon: updatedPkm,
    itemsAwarded,
  };
}

/**
 * Get current bridge status and sync statistics
 */
export async function getWatchBridgeStatus(): Promise<WatchBridgeStatus> {
  const version = await getStateVersion();
  const processedCount = await getProcessedOperationsCount();
  bridgeStats.stateVersion = version;
  bridgeStats.processedOperationsCount = processedCount;

  if (Platform.OS === 'android' && WatchBridge?.getServerStatus) {
    try {
      const nativeStatus = await WatchBridge.getServerStatus();
      bridgeStats.isRunning = nativeStatus.isRunning;
      bridgeStats.port = nativeStatus.port;
      bridgeStats.url = nativeStatus.url;
    } catch (_) {}
  }

  return { ...bridgeStats };
}

/**
 * Subscribe to live watch sync events
 */
export function addWatchSyncListener(listener: WatchSyncListener): () => void {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

/**
 * Simulate an incoming watch batch or event (useful for testing on emulator/web)
 */
export async function simulateIncomingWatchBatch(overrides?: Partial<WatchLedgerBatch>) {
  const pkm = await getStoredPokemon();
  const sessionId = pkm ? `session_${pkm.speciesId}_${pkm.nickname}_${pkm.level}` : 'session_demo';

  const mockBatch: WatchLedgerBatch = {
    batch_id: `op_sim_${Date.now()}`,
    session_id: sessionId,
    delta_steps: 1250,
    evs_earned: { hp: 0, attack: 6, defense: 0, specialAttack: 0, specialDefense: 0, speed: 4 },
    items_found: [
      {
        id: `item_found_${Date.now()}`,
        itemType: 'rare_candy',
        name: 'Rare Candy',
        stepMilestone: 1000,
        timestamp: Date.now(),
      },
    ],
    tasks_completed: [],
    timestamp: Date.now(),
    ...overrides,
  };

  return handleInboundWatchOperation({
    operationId: mockBatch.batch_id,
    type: 'SYNC_LEDGER',
    payload: mockBatch,
  });
}
