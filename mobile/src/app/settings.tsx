import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  AppSettings,
  EVRuleTrigger,
  ItemRewardConfig,
  PokemonEVs,
  WorkoutRecord,
} from '../types/pokemon';
import {
  getStoredSettings,
  saveStoredSettings,
  getStoredPokemon,
  saveStoredPokemon,
} from '../utils/storage';
import {
  processCircadianAndPassive,
  DEFAULT_SETTINGS,
  DEFAULT_EV_RULES,
  DEFAULT_REWARD_CONFIGS,
} from '../utils/tamagotchiEngine';
import {
  checkHealthConnectStatus,
  openHealthConnectSettings,
  openHealthConnectPlayStore,
  syncHealthWithPokemon,
  getInstalledFitnessApps,
  openFitnessApp,
  getSelectedFitnessApp,
  setSelectedFitnessApp,
  FitnessAppInfo,
} from '../utils/healthBridge';
import {
  initWatchBridge,
  startWatchBridge,
  stopWatchBridge,
  setWatchProvider,
  updateWatchCompanionPayloads,
  getWatchBridgeStatus,
  addWatchSyncListener,
  simulateIncomingWatchBatch,
} from '../utils/watchBridge';
import { WatchBridgeStatus } from '../types/pokemon';
import BottomNavBar from '../components/BottomNavBar';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [healthStatus, setHealthStatus] = useState<string>('Checking...');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [fitnessApps, setFitnessApps] = useState<FitnessAppInfo[]>([]);
  const [selectedApp, setSelectedAppState] = useState<{ id: string; name: string } | null>(null);
  const [appModalVisible, setAppModalVisible] = useState<boolean>(false);

  // Settings sub-tab switcher
  const [settingsTab, setSettingsTab] = useState<'core' | 'rewards' | 'evs' | 'fitness'>('core');

  // EV Rule Modal
  const [evModalVisible, setEvModalVisible] = useState(false);
  const [editingEvRule, setEditingEvRule] = useState<EVRuleTrigger | null>(null);
  const [evRuleName, setEvRuleName] = useState('');
  const [evRuleStat, setEvRuleStat] = useState<keyof PokemonEVs>('attack');
  const [evRuleType, setEvRuleType] = useState<EVRuleTrigger['triggerType']>('workout_type');
  const [evRuleWorkoutType, setEvRuleWorkoutType] = useState<WorkoutRecord['type']>('weightlifting');
  const [evRuleAmount, setEvRuleAmount] = useState('4');
  const [evRuleDuration, setEvRuleDuration] = useState('15');
  const [evRuleSteps, setEvRuleSteps] = useState('8000');
  const [evRuleTaskCat, setEvRuleTaskCat] = useState('Study');

  // Reward Config Modal
  const [rewardModalVisible, setRewardModalVisible] = useState(false);
  const [editingReward, setEditingReward] = useState<ItemRewardConfig | null>(null);
  const [rewardName, setRewardName] = useState('Rare Candy');
  const [rewardItemType, setRewardItemType] = useState<ItemRewardConfig['itemType']>('rare_candy');
  const [rewardTriggerType, setRewardTriggerType] = useState<ItemRewardConfig['triggerType']>('streak_days');
  const [rewardThreshold, setRewardThreshold] = useState('3');
  const [rewardDesc, setRewardDesc] = useState('Increases Pokemon level by 1');

  // Watch Companion State
  const [bridgeStatus, setBridgeStatus] = useState<WatchBridgeStatus>({
    isRunning: false,
    port: 8088,
    url: 'http://127.0.0.1:8088',
    stateVersion: 100,
    processedOperationsCount: 0,
    deviceName: 'Amazfit Bip 6',
    lastSyncTimestamp: null,
    lastOperationId: null,
    totalStepsReceived: 0,
    totalEvsReceived: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
    totalItemsReceivedCount: 0,
  });
  const [isPushingToWatch, setIsPushingToWatch] = useState<boolean>(false);
  const [watchDeviceModalVisible, setWatchDeviceModalVisible] = useState<boolean>(false);

  const router = useRouter();

  useEffect(() => {
    loadSettings();
    checkHealth();
    loadFitnessApps();
    loadWatchBridge();

    const unsubscribe = addWatchSyncListener((batch, updatedPkm) => {
      loadWatchBridge();
      Alert.alert(
        '⌚ Watch Synced!',
        `Received ${batch.delta_steps.toLocaleString()} steps and ${batch.items_found?.length || 0} items from ${settings.watchCompanionDeviceName || 'Amazfit Bip 6'}.`
      );
    });

    return () => unsubscribe();
  }, []);

  const loadSettings = async () => {
    const sets = await getStoredSettings();
    setSettings(sets);
    // Auto-update bridge payload on open so watch always has latest data
    const pkm = await getStoredPokemon();
    if (pkm) {
      await updateWatchCompanionPayloads(pkm, sets);
    }
  };

  const loadWatchBridge = async () => {
    await initWatchBridge();
    const status = await getWatchBridgeStatus();
    setBridgeStatus(status);
  };

  const checkHealth = async () => {
    const status = await checkHealthConnectStatus();
    setHealthStatus(status);
  };

  const loadFitnessApps = async () => {
    const apps = await getInstalledFitnessApps();
    setFitnessApps(apps);
    const selected = await getSelectedFitnessApp();
    if (selected) {
      setSelectedAppState(selected);
    } else {
      const defaultApp =
        apps.find((a) => a.isInstalled && a.id !== 'phone_pedometer') ||
        apps.find((a) => a.id === 'phone_pedometer');
      if (defaultApp) {
        const sel = { id: defaultApp.id, name: defaultApp.name };
        setSelectedAppState(sel);
        await setSelectedFitnessApp(sel);
      }
    }
  };

  const handleSelectApp = async (app: FitnessAppInfo) => {
    const sel = { id: app.id, name: app.name };
    setSelectedAppState(sel);
    await setSelectedFitnessApp(sel);
    setAppModalVisible(false);

    if (app.id !== 'phone_pedometer') {
      Alert.alert(
        `Connected to ${app.name}!`,
        `Q's Poke Buddy will automatically pull your steps, sleep, and workouts from ${app.name} via Health Connect.\n\nMake sure to enable sync in Health Connect.`,
        [
          { text: 'Configure Permissions', onPress: openHealthConnectSettings },
          { text: 'OK', style: 'default' },
        ]
      );
    } else {
      Alert.alert('Phone Sensor Selected', 'Steps will be tracked directly from your device sensor.');
    }
  };

  const handleSave = async () => {
    await saveStoredSettings(settings);
    Alert.alert('Settings Saved', 'Tamagotchi configuration updated.');
    router.back();
  };

  const handleSyncHealth = async () => {
    setIsSyncing(true);
    try {
      const pkm = await getStoredPokemon();
      if (!pkm) {
        Alert.alert('No Companion', 'Import or scan a Pokémon companion first.');
        setIsSyncing(false);
        return;
      }

      const { updatedPokemon, result } = await syncHealthWithPokemon(pkm, settings);
      await saveStoredPokemon(updatedPokemon);

      let evSummary = Object.entries(result.evsGained)
        .filter(([_, val]) => val > 0)
        .map(([k, v]) => `${k.toUpperCase()}: +${v}`)
        .join(', ');

      Alert.alert(
        'Fitness Sync Successful!',
        `Source: ${result.source} (${selectedApp?.name || 'Auto'})\n` +
          `• Steps Synced: ${result.stepsSynced.toLocaleString()} (+${result.stepDelta.toLocaleString()} new)\n` +
          `• EXP Gained: +${result.expGained}\n` +
          `• Friendship: +${result.friendshipGained} Hearts\n` +
          (result.restedApplied ? '• Rested 2x Buff: APPLIED (7-8 hrs sleep)!\n' : '') +
          (evSummary ? `• Workout EVs: ${evSummary}\n` : '') +
          (result.leveledUp ? `\n🎉 ${updatedPokemon.nickname} leveled up to Lv. ${updatedPokemon.level}!` : '')
      );
    } catch (e: any) {
      Alert.alert('Sync Error', e.message || 'Failed to sync health data.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSimulateSteps = async (stepsToAdd: number) => {
    const pkm = await getStoredPokemon();
    if (!pkm) {
      Alert.alert('No Companion', 'Import or scan a Pokémon companion first.');
      return;
    }

    const result = processCircadianAndPassive(pkm, settings, stepsToAdd);
    await saveStoredPokemon(result.updatedPokemon);

    Alert.alert(
      'Simulated Steps!',
      `Added ${stepsToAdd} steps! Gained +${result.expGained} EXP and +${result.friendshipGained} Friendship.` +
        (result.leveledUp ? ` ${pkm.nickname} leveled up to Lv. ${result.newLevel}!` : '')
    );
  };

  // --- Watch Companion Handlers ---
  const handleToggleWatchCompanion = async () => {
    const newState = !settings.watchCompanionEnabled;
    const updated = { ...settings, watchCompanionEnabled: newState };
    setSettings(updated);
    await saveStoredSettings(updated);

    if (newState) {
      await startWatchBridge();
      const pkm = await getStoredPokemon();
      if (pkm) {
        await updateWatchCompanionPayloads(pkm, updated);
      }
      Alert.alert(
        'Authoritative Bridge Activated! ⌚',
        `Loopback HTTP API running on 127.0.0.1:8088 for ${updated.watchCompanionDeviceName || 'Amazfit Bip 6'}.`
      );
    } else {
      await stopWatchBridge();
      Alert.alert('Companion Bridge Disabled', 'Watch companion communication paused.');
    }
    await loadWatchBridge();
  };

  const handlePushPayloadToWatch = async () => {
    setIsPushingToWatch(true);
    try {
      const pkm = await getStoredPokemon();
      if (!pkm) {
        Alert.alert('No Companion', 'Please import or scan a Pokémon companion first.');
        setIsPushingToWatch(false);
        return;
      }
      await updateWatchCompanionPayloads(pkm, settings);
      await loadWatchBridge();
      Alert.alert(
        'Authoritative State Synced! 🚀',
        `Active Pokémon (${pkm.nickname || pkm.speciesName}, Lv. ${pkm.level}) synchronized to 127.0.0.1:8088 (StateVersion ${bridgeStatus.stateVersion}).`
      );
    } catch (e: any) {
      Alert.alert('Sync Failed', e.message || 'Failed to update watch payload.');
    } finally {
      setIsPushingToWatch(false);
    }
  };

  const handleSimulateWatchSync = async () => {
    setIsSyncing(true);
    try {
      const res = await simulateIncomingWatchBatch();
      await loadWatchBridge();
      const pkm = await getStoredPokemon();
      if (res.success) {
        Alert.alert(
          '⌚ Watch Sync Handshake Simulated!',
          `Simulated on-wrist batch commit (StateVersion v${res.stateVersion}):\n` +
            `• Steps Added: +1,250\n` +
            `• Attack EV: +6, Speed EV: +4\n` +
            `• Items Discovered: +1 Rare Candy (added to Inventory!)\n` +
            `• Current Total Steps: ${(pkm?.totalSteps || 0).toLocaleString()}`
        );
      }
    } catch (e: any) {
      Alert.alert('Simulation Error', e.message || 'Failed to simulate sync.');
    } finally {
      setIsSyncing(false);
    }
  };

  // --- EV Rule Handlers ---
  const handleOpenAddEvRule = () => {
    setEditingEvRule(null);
    setEvRuleName('');
    setEvRuleStat('attack');
    setEvRuleType('workout_type');
    setEvRuleWorkoutType('weightlifting');
    setEvRuleAmount('4');
    setEvRuleDuration('15');
    setEvRuleSteps('8000');
    setEvRuleTaskCat('Fitness');
    setEvModalVisible(true);
  };

  const handleOpenEditEvRule = (rule: EVRuleTrigger) => {
    setEditingEvRule(rule);
    setEvRuleName(rule.name);
    setEvRuleStat(rule.targetStat);
    setEvRuleType(rule.triggerType);
    setEvRuleWorkoutType(rule.workoutType || 'weightlifting');
    setEvRuleAmount((rule.evAmount || 4).toString());
    setEvRuleDuration((rule.minDurationMinutes || 15).toString());
    setEvRuleSteps((rule.minSteps || 8000).toString());
    setEvRuleTaskCat(rule.taskCategory || 'Fitness');
    setEvModalVisible(true);
  };

  const handleSaveEvRule = async () => {
    const rule: EVRuleTrigger = {
      id: editingEvRule ? editingEvRule.id : `rule-${Date.now()}`,
      name: evRuleName.trim() || `${evRuleStat.toUpperCase()} Trigger`,
      targetStat: evRuleStat,
      triggerType: evRuleType,
      evAmount: parseInt(evRuleAmount, 10) || 4,
      enabled: editingEvRule ? editingEvRule.enabled : true,
      workoutType: evRuleType === 'workout_type' ? evRuleWorkoutType : undefined,
      minDurationMinutes: evRuleType === 'workout_type' || evRuleType === 'workout_duration' ? parseInt(evRuleDuration, 10) || 15 : undefined,
      minSteps: evRuleType === 'step_count' ? parseInt(evRuleSteps, 10) || 8000 : undefined,
      taskCategory: evRuleType === 'task_completion' ? evRuleTaskCat : undefined,
    };

    let updatedRules = [...(settings.evRules || DEFAULT_EV_RULES)];
    if (editingEvRule) {
      updatedRules = updatedRules.map((r) => (r.id === editingEvRule.id ? rule : r));
    } else {
      updatedRules.push(rule);
    }

    const updatedSettings = { ...settings, evRules: updatedRules };
    setSettings(updatedSettings);
    await saveStoredSettings(updatedSettings);
    setEvModalVisible(false);
  };

  const handleToggleEvRule = async (ruleId: string) => {
    const updated = (settings.evRules || DEFAULT_EV_RULES).map((r) =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    );
    const updatedSettings = { ...settings, evRules: updated };
    setSettings(updatedSettings);
    await saveStoredSettings(updatedSettings);
  };

  const handleDeleteEvRule = async (ruleId: string) => {
    const updated = (settings.evRules || DEFAULT_EV_RULES).filter((r) => r.id !== ruleId);
    const updatedSettings = { ...settings, evRules: updated };
    setSettings(updatedSettings);
    await saveStoredSettings(updatedSettings);
  };

  // --- Reward Config Handlers ---
  const handleOpenAddReward = () => {
    setEditingReward(null);
    setRewardName('Rare Candy');
    setRewardItemType('rare_candy');
    setRewardTriggerType('streak_days');
    setRewardThreshold('3');
    setRewardDesc('Instantly increases Pokémon level by 1');
    setRewardModalVisible(true);
  };

  const handleOpenEditReward = (rew: ItemRewardConfig) => {
    setEditingReward(rew);
    setRewardName(rew.name);
    setRewardItemType(rew.itemType);
    setRewardTriggerType(rew.triggerType);
    setRewardThreshold((rew.triggerThreshold || 1).toString());
    setRewardDesc(rew.description || '');
    setRewardModalVisible(true);
  };

  const handleSaveRewardConfig = async () => {
    const config: ItemRewardConfig = {
      id: editingReward ? editingReward.id : `rew-${Date.now()}`,
      name: rewardName.trim(),
      itemType: rewardItemType,
      description: rewardDesc.trim(),
      enabled: editingReward ? editingReward.enabled : true,
      triggerType: rewardTriggerType,
      triggerThreshold: parseInt(rewardThreshold, 10) || 1,
      icon: '🎁',
    };

    let updatedConfigs = [...(settings.rewardConfigs || DEFAULT_REWARD_CONFIGS)];
    if (editingReward) {
      updatedConfigs = updatedConfigs.map((c) => (c.id === editingReward.id ? config : c));
    } else {
      updatedConfigs.push(config);
    }

    const updatedSettings = { ...settings, rewardConfigs: updatedConfigs };
    setSettings(updatedSettings);
    await saveStoredSettings(updatedSettings);
    setRewardModalVisible(false);
  };

  const handleToggleRewardConfig = async (rewardId: string) => {
    const updated = (settings.rewardConfigs || DEFAULT_REWARD_CONFIGS).map((c) =>
      c.id === rewardId ? { ...c, enabled: !c.enabled } : c
    );
    const updatedSettings = { ...settings, rewardConfigs: updated };
    setSettings(updatedSettings);
    await saveStoredSettings(updatedSettings);
  };

  const handleDeleteRewardConfig = async (rewardId: string) => {
    const updated = (settings.rewardConfigs || DEFAULT_REWARD_CONFIGS).filter((c) => c.id !== rewardId);
    const updatedSettings = { ...settings, rewardConfigs: updated };
    setSettings(updatedSettings);
    await saveStoredSettings(updatedSettings);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.push('/pet')}>
          <Text style={styles.backBtnText}>◀ HOME</Text>
        </TouchableOpacity>
        <Text style={styles.title}>CONFIG & CUSTOMIZATION</Text>
        <TouchableOpacity style={styles.saveHeaderBtn} onPress={handleSave}>
          <Text style={styles.saveHeaderText}>SAVE</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, settingsTab === 'core' && styles.tabBtnActive]}
          onPress={() => setSettingsTab('core')}>
          <Text style={[styles.tabBtnText, settingsTab === 'core' && styles.tabBtnTextActive]}>⚙️ CORE</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, settingsTab === 'evs' && styles.tabBtnActive]}
          onPress={() => setSettingsTab('evs')}>
          <Text style={[styles.tabBtnText, settingsTab === 'evs' && styles.tabBtnTextActive]}>⚡ EV RULES</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, settingsTab === 'rewards' && styles.tabBtnActive]}
          onPress={() => setSettingsTab('rewards')}>
          <Text style={[styles.tabBtnText, settingsTab === 'rewards' && styles.tabBtnTextActive]}>🎁 REWARDS</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, settingsTab === 'fitness' && styles.tabBtnActive]}
          onPress={() => setSettingsTab('fitness')}>
          <Text style={[styles.tabBtnText, settingsTab === 'fitness' && styles.tabBtnTextActive]}>⌚ SYNC</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* --- TAB: CORE MULTIPLIERS --- */}
        {settingsTab === 'core' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>GAMEPLAY FORMULAS</Text>
              <Text style={styles.settingDesc}>
                Customize all core formulas to match your active lifestyle:
              </Text>

              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Steps per Friendship Heart</Text>
                  <Text style={styles.settingDesc}>Default: 256 steps per +1 Heart</Text>
                </View>
                <TextInput
                  style={styles.settingInput}
                  keyboardType="numeric"
                  value={settings.stepsPerFriendship.toString()}
                  onChangeText={(v) =>
                    setSettings({ ...settings, stepsPerFriendship: parseInt(v, 10) || 256 })
                  }
                />
              </View>

              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Global EXP Multiplier</Text>
                  <Text style={styles.settingDesc}>Multiplier applied to all gained EXP</Text>
                </View>
                <TextInput
                  style={styles.settingInput}
                  keyboardType="decimal-pad"
                  value={settings.expMultiplier.toString()}
                  onChangeText={(v) =>
                    setSettings({ ...settings, expMultiplier: parseFloat(v) || 1.0 })
                  }
                />
              </View>

              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Passive Daycare EXP / Min</Text>
                  <Text style={styles.settingDesc}>Background time elapsed EXP</Text>
                </View>
                <TextInput
                  style={styles.settingInput}
                  keyboardType="numeric"
                  value={settings.passiveExpPerMinute.toString()}
                  onChangeText={(v) =>
                    setSettings({ ...settings, passiveExpPerMinute: parseInt(v, 10) || 5 })
                  }
                />
              </View>

              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Workout EV Multiplier</Text>
                  <Text style={styles.settingDesc}>Multiplier for exercise EV gains</Text>
                </View>
                <TextInput
                  style={styles.settingInput}
                  keyboardType="decimal-pad"
                  value={settings.workoutEvMultiplier.toString()}
                  onChangeText={(v) =>
                    setSettings({ ...settings, workoutEvMultiplier: parseFloat(v) || 1.0 })
                  }
                />
              </View>
            </View>

            {/* Circadian & Visual */}
            <View style={[styles.card, { marginTop: 12 }]}>
              <Text style={styles.cardTitle}>CIRCADIAN & SPRITE ENGINE</Text>

              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Rested Sleep Target (Hours)</Text>
                  <Text style={styles.settingDesc}>Min & Max hours for 2x Rested Buff</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <TextInput
                    style={[styles.settingInput, { width: 44 }]}
                    keyboardType="decimal-pad"
                    value={settings.sleepMinHours.toString()}
                    onChangeText={(v) =>
                      setSettings({ ...settings, sleepMinHours: parseFloat(v) || 7 })
                    }
                  />
                  <Text style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>-</Text>
                  <TextInput
                    style={[styles.settingInput, { width: 44 }]}
                    keyboardType="decimal-pad"
                    value={settings.sleepMaxHours.toString()}
                    onChangeText={(v) =>
                      setSettings({ ...settings, sleepMaxHours: parseFloat(v) || 8 })
                    }
                  />
                </View>
              </View>

              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Sprite Animation Mode</Text>
                  <Text style={styles.settingDesc}>Animated Gen 5 GIF vs Static Pixel</Text>
                </View>
                <TouchableOpacity
                  style={styles.toggleModeBtn}
                  onPress={() =>
                    setSettings({
                      ...settings,
                      spriteMode: settings.spriteMode === 'animated' ? 'static' : 'animated',
                    })
                  }>
                  <Text style={styles.toggleModeText}>
                    {settings.spriteMode.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* --- TAB: EV MULTI-TRIGGER RULES --- */}
        {settingsTab === 'evs' && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>⚡ EV GAIN TRIGGERS</Text>
              <TouchableOpacity style={styles.addRuleBtn} onPress={handleOpenAddEvRule}>
                <Text style={styles.addRuleBtnText}>+ ADD RULE</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.settingDesc}>
              Choose multiple ways to level up specific EVs! Map workouts, step goals, water drinking, regular meals, and sleep to whichever stat you want.
            </Text>

            {(settings.evRules || DEFAULT_EV_RULES).map((rule) => (
              <View key={rule.id} style={[styles.ruleCard, !rule.enabled && styles.ruleCardDisabled]}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => handleOpenEditEvRule(rule)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.ruleTitle}>{rule.name}</Text>
                    <View style={styles.statPill}>
                      <Text style={styles.statPillText}>+{rule.evAmount} {rule.targetStat.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.ruleSub}>
                    Trigger: {rule.triggerType.replace(/_/g, ' ').toUpperCase()}
                    {rule.workoutType ? ` • ${rule.workoutType.toUpperCase()}` : ''}
                    {rule.minSteps ? ` • >= ${rule.minSteps.toLocaleString()} steps` : ''}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.editRuleBtn}
                  onPress={() => handleOpenEditEvRule(rule)}>
                  <Text style={styles.editRuleText}>EDIT</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.ruleToggle, rule.enabled && styles.ruleToggleActive]}
                  onPress={() => handleToggleEvRule(rule.id)}>
                  <Text style={[styles.ruleToggleText, rule.enabled && styles.ruleToggleTextActive]}>
                    {rule.enabled ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteRuleBtn}
                  onPress={() => handleDeleteEvRule(rule.id)}>
                  <Text style={styles.deleteRuleText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* --- TAB: ITEM REWARDS CUSTOMIZATION --- */}
        {settingsTab === 'rewards' && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>🎁 ITEM REWARDS CONFIG</Text>
              <TouchableOpacity style={styles.addRuleBtn} onPress={handleOpenAddReward}>
                <Text style={styles.addRuleBtnText}>+ ADD REWARD</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.settingDesc}>
              Configure item reward triggers. Set what rewards you get and for what achievements (streaks, steps, sleep, meals, tasks):
            </Text>

            <TouchableOpacity
              style={styles.globalToggleBox}
              onPress={() =>
                setSettings({ ...settings, itemRewardsEnabled: !settings.itemRewardsEnabled })
              }>
              <Text style={styles.globalToggleLabel}>ITEM REWARDS SYSTEM</Text>
              <View style={[styles.ruleToggle, settings.itemRewardsEnabled && styles.ruleToggleActive]}>
                <Text style={[styles.ruleToggleText, settings.itemRewardsEnabled && styles.ruleToggleTextActive]}>
                  {settings.itemRewardsEnabled ? 'ENABLED' : 'DISABLED'}
                </Text>
              </View>
            </TouchableOpacity>

            {(settings.rewardConfigs || DEFAULT_REWARD_CONFIGS).map((rew) => (
              <View key={rew.id} style={[styles.ruleCard, !rew.enabled && styles.ruleCardDisabled]}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => handleOpenEditReward(rew)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.ruleTitle}>{rew.name}</Text>
                    <View style={styles.statPill}>
                      <Text style={styles.statPillText}>{rew.itemType.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.ruleSub}>{rew.description}</Text>
                  <Text style={styles.ruleRequirement}>
                    Trigger: {rew.triggerType.replace(/_/g, ' ').toUpperCase()} (Threshold: {rew.triggerThreshold})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.editRuleBtn}
                  onPress={() => handleOpenEditReward(rew)}>
                  <Text style={styles.editRuleText}>EDIT</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.ruleToggle, rew.enabled && styles.ruleToggleActive]}
                  onPress={() => handleToggleRewardConfig(rew.id)}>
                  <Text style={[styles.ruleToggleText, rew.enabled && styles.ruleToggleTextActive]}>
                    {rew.enabled ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteRuleBtn}
                  onPress={() => handleDeleteRewardConfig(rew.id)}>
                  <Text style={styles.deleteRuleText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* --- TAB: FITNESS SYNC & WATCH COMPANION --- */}
        {settingsTab === 'fitness' && (
          <View>
            {/* Watch Companion Card */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>⌚ SMARTWATCH COMPANION BRIDGE</Text>
                <View
                  style={[
                    styles.statusPill,
                    bridgeStatus.isRunning ? styles.statusAvailable : styles.statusWarning,
                  ]}>
                  <Text style={styles.statusPillText}>
                    {bridgeStatus.isRunning ? '● ACTIVE' : '○ STOPPED'}
                  </Text>
                </View>
              </View>

              <Text style={styles.settingDesc}>
                Decoupled multi-platform smartwatch sync. Seamlessly bridge Pokémon state, step rewards, and task completion with Amazfit (Zepp OS) or Garmin (Connect IQ).
              </Text>

              {/* Main Toggle */}
              <TouchableOpacity
                style={styles.globalToggleBox}
                onPress={handleToggleWatchCompanion}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.globalToggleLabel}>WATCH COMPANION BRIDGE</Text>
                  <Text style={styles.settingDesc}>
                    {settings.watchCompanionEnabled
                      ? `Active Provider: ${settings.watchCompanionProvider === 'garmin' ? 'Garmin (Connect IQ)' : 'Amazfit (Zepp OS)'}`
                      : 'Bridge disabled'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.ruleToggle,
                    settings.watchCompanionEnabled && styles.ruleToggleActive,
                  ]}>
                  <Text
                    style={[
                      styles.ruleToggleText,
                      settings.watchCompanionEnabled && styles.ruleToggleTextActive,
                    ]}>
                    {settings.watchCompanionEnabled ? 'ENABLED' : 'DISABLED'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Smartwatch Brand / Hardware Provider Selector */}
              <Text style={styles.modalLabel}>SMARTWATCH HARDWARE PLATFORM</Text>
              <View style={styles.modalChipRow}>
                {[
                  { id: 'zepp', name: 'Amazfit (Zepp OS)' },
                  { id: 'garmin', name: 'Garmin (Connect IQ)' },
                ].map((prov) => {
                  const isSelected = (settings.watchCompanionProvider || 'zepp') === prov.id;
                  return (
                    <TouchableOpacity
                      key={prov.id}
                      style={[styles.modalChip, isSelected && styles.modalChipActive]}
                      onPress={async () => {
                        const updated = {
                          ...settings,
                          watchCompanionProvider: prov.id as 'zepp' | 'garmin',
                          watchCompanionDeviceName: prov.name,
                        };
                        setSettings(updated);
                        await saveStoredSettings(updated);
                        await setWatchProvider(prov.id as 'zepp' | 'garmin');
                        await loadWatchBridge();
                      }}>
                      <Text
                        style={[
                          styles.modalChipText,
                          isSelected && styles.modalChipTextActive,
                        ]}>
                        {prov.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Bridge Sync Info Box */}
              {bridgeStatus.isRunning && (
                <View style={styles.watchInfoBox}>
                  <Text style={styles.watchInfoTitle}>LIVE COMPANION METRICS</Text>
                  <Text style={styles.watchInfoLine}>
                    • Localhost API: {bridgeStatus.url}
                  </Text>
                  <Text style={styles.watchInfoLine}>
                    • State Version: v{bridgeStatus.stateVersion}
                  </Text>
                  <Text style={styles.watchInfoLine}>
                    • Processed Operations: {bridgeStatus.processedOperationsCount}
                  </Text>
                  <Text style={styles.watchInfoLine}>
                    • Total Steps Received: +{bridgeStatus.totalStepsReceived.toLocaleString()}
                  </Text>
                  <Text style={styles.watchInfoLine}>
                    • Items Received On-Wrist: {bridgeStatus.totalItemsReceivedCount}
                  </Text>
                  {bridgeStatus.lastOperationId && (
                    <Text style={styles.watchInfoLine}>
                      • Last Operation: {bridgeStatus.lastOperationId}
                    </Text>
                  )}
                </View>
              )}

              {/* Push Action */}
              <TouchableOpacity
                style={[styles.syncHealthBtn, isPushingToWatch && { opacity: 0.6 }]}
                onPress={handlePushPayloadToWatch}
                disabled={isPushingToWatch}>
                {isPushingToWatch ? (
                  <ActivityIndicator color="#cadc9f" size="small" />
                ) : (
                  <Text style={styles.syncHealthBtnText}>🚀 PUSH POKÉMON & RULES TO WATCH</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.openSettingsBtn, { marginTop: 6 }]}
                onPress={handleSimulateWatchSync}>
                <Text style={styles.openSettingsBtnText}>🧪 TEST / SIMULATE ON-WRIST SYNC</Text>
              </TouchableOpacity>
            </View>

            {/* Health Connect App Card */}
            <View style={[styles.card, { marginTop: 12 }]}>
              <Text style={styles.cardTitle}>CONNECT FITNESS APP (HEALTH CONNECT)</Text>
              <Text style={styles.settingDesc}>
                Select your phone fitness source to pull steps, sleep, and workouts via Health Connect:
              </Text>

              <TouchableOpacity
                style={styles.selectedAppBox}
                onPress={() => setAppModalVisible(true)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedAppLabel}>CONNECTED SOURCE</Text>
                  <Text style={styles.selectedAppName}>
                    {selectedApp ? `⌚ ${selectedApp.name}` : 'Tap to select fitness app'}
                  </Text>
                </View>
                <Text style={styles.changeBtnText}>CHANGE ▾</Text>
              </TouchableOpacity>

              <View style={[styles.settingRow, { marginTop: 8 }]}>
                <Text style={styles.settingLabel}>Health Connect Status</Text>
                <View
                  style={[
                    styles.statusPill,
                    healthStatus === 'Available' ? styles.statusAvailable : styles.statusWarning,
                  ]}>
                  <Text style={styles.statusPillText}>{healthStatus.toUpperCase()}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.syncHealthBtn, isSyncing && { opacity: 0.6 }]}
                onPress={handleSyncHealth}
                disabled={isSyncing}>
                {isSyncing ? (
                  <ActivityIndicator color="#cadc9f" size="small" />
                ) : (
                  <Text style={styles.syncHealthBtnText}>🔄 SYNC FITNESS DATA NOW</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.openSettingsBtn}
                onPress={openHealthConnectSettings}>
                <Text style={styles.openSettingsBtnText}>⚙️ PERMISSIONS & CONNECTED APPS</Text>
              </TouchableOpacity>
            </View>

            {/* Step Simulator */}
            <View style={[styles.card, { marginTop: 12 }]}>
              <Text style={styles.cardTitle}>SENSOR STEP SIMULATOR</Text>
              <Text style={styles.settingDesc}>
                Simulate steps to test leveling and rewards:
              </Text>

              <View style={styles.simBtnRow}>
                <TouchableOpacity
                  style={styles.simBtn}
                  onPress={() => handleSimulateSteps(settings.stepsPerFriendship || 256)}>
                  <Text style={styles.simBtnText}>+{settings.stepsPerFriendship || 256} Steps</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.simBtn}
                  onPress={() => handleSimulateSteps(1000)}>
                  <Text style={styles.simBtnText}>+1,000 Steps</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.simBtn}
                  onPress={() => handleSimulateSteps(5000)}>
                  <Text style={styles.simBtnText}>+5,000 Steps</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* --- MODAL: ADD / EDIT EV RULE --- */}
      <Modal visible={evModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingEvRule ? 'EDIT EV TRIGGER RULE' : 'NEW EV TRIGGER RULE'}
            </Text>

            <ScrollView style={{ maxHeight: 360 }}>
              <Text style={styles.modalLabel}>RULE NAME</Text>
              <TextInput
                style={styles.modalInput}
                value={evRuleName}
                onChangeText={setEvRuleName}
                placeholder="e.g. Morning Cardio Speed, Hydration HP"
              />

              <Text style={styles.modalLabel}>TARGET EV STAT</Text>
              <View style={styles.modalChipRow}>
                {(['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed'] as const).map(
                  (stat) => (
                    <TouchableOpacity
                      key={stat}
                      style={[styles.modalChip, evRuleStat === stat && styles.modalChipActive]}
                      onPress={() => setEvRuleStat(stat)}>
                      <Text style={[styles.modalChipText, evRuleStat === stat && styles.modalChipTextActive]}>
                        {stat.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>

              <Text style={styles.modalLabel}>TRIGGER ACTIVITY</Text>
              <View style={styles.modalChipRow}>
                {[
                  { id: 'workout_type', label: 'Workout Type' },
                  { id: 'drinking_regularly', label: 'Water Hydration' },
                  { id: 'eating_regularly', label: 'Regular Meals' },
                  { id: 'step_count', label: 'Daily Step Goal' },
                  { id: 'sleep_duration', label: 'Sleep Target' },
                  { id: 'task_completion', label: 'Task Completed' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.modalChip, evRuleType === item.id && styles.modalChipActive]}
                    onPress={() => setEvRuleType(item.id as EVRuleTrigger['triggerType'])}>
                    <Text style={[styles.modalChipText, evRuleType === item.id && styles.modalChipTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {evRuleType === 'workout_type' && (
                <View>
                  <Text style={styles.modalSubLabel}>Workout Type:</Text>
                  <View style={styles.modalChipRow}>
                    {(['cardio', 'weightlifting', 'defense', 'hiit', 'yoga', 'walking', 'swimming', 'cycling'] as const).map((w) => (
                      <TouchableOpacity
                        key={w}
                        style={[styles.modalChip, evRuleWorkoutType === w && styles.modalChipActive]}
                        onPress={() => setEvRuleWorkoutType(w)}>
                        <Text style={[styles.modalChipText, evRuleWorkoutType === w && styles.modalChipTextActive]}>
                          {w.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {evRuleType === 'step_count' && (
                <View>
                  <Text style={styles.modalSubLabel}>Min Steps Threshold:</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="numeric"
                    value={evRuleSteps}
                    onChangeText={setEvRuleSteps}
                  />
                </View>
              )}

              {evRuleType === 'task_completion' && (
                <View>
                  <Text style={styles.modalSubLabel}>Task Category:</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={evRuleTaskCat}
                    onChangeText={setEvRuleTaskCat}
                    placeholder="Study, Fitness, Health..."
                  />
                </View>
              )}

              <Text style={styles.modalLabel}>EV AMOUNT GAINED (+)</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={evRuleAmount}
                onChangeText={setEvRuleAmount}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveEvRule}>
                <Text style={styles.modalSaveBtnText}>SAVE RULE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEvModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- MODAL: ADD / EDIT REWARD --- */}
      <Modal visible={rewardModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingReward ? 'EDIT ITEM REWARD' : 'NEW ITEM REWARD'}
            </Text>

            <ScrollView style={{ maxHeight: 360 }}>
              <Text style={styles.modalLabel}>REWARD NAME</Text>
              <TextInput
                style={styles.modalInput}
                value={rewardName}
                onChangeText={setRewardName}
                placeholder="Rare Candy, Protein..."
              />

              <Text style={styles.modalLabel}>ITEM TYPE</Text>
              <View style={styles.modalChipRow}>
                {[
                  'rare_candy',
                  'protein',
                  'carbos',
                  'iron',
                  'calcium',
                  'zinc',
                  'hp_up',
                  'pp_max',
                  'master_ball',
                  'leftovers',
                  'exp_share',
                  'mystery_gift',
                ].map((it) => (
                  <TouchableOpacity
                    key={it}
                    style={[styles.modalChip, rewardItemType === it && styles.modalChipActive]}
                    onPress={() => setRewardItemType(it as ItemRewardConfig['itemType'])}>
                    <Text style={[styles.modalChipText, rewardItemType === it && styles.modalChipTextActive]}>
                      {it.replace('_', ' ').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>TRIGGER CONDITION</Text>
              <View style={styles.modalChipRow}>
                {[
                  { id: 'streak_days', label: 'Streak Days' },
                  { id: 'step_milestone', label: 'Step Goal' },
                  { id: 'tasks_completed', label: 'Tasks Done' },
                  { id: 'meal_consistency', label: 'Meal Streak' },
                  { id: 'sleep_target', label: 'Sleep Target' },
                ].map((trig) => (
                  <TouchableOpacity
                    key={trig.id}
                    style={[styles.modalChip, rewardTriggerType === trig.id && styles.modalChipActive]}
                    onPress={() => setRewardTriggerType(trig.id as ItemRewardConfig['triggerType'])}>
                    <Text style={[styles.modalChipText, rewardTriggerType === trig.id && styles.modalChipTextActive]}>
                      {trig.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>TRIGGER THRESHOLD (VALUE)</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={rewardThreshold}
                onChangeText={setRewardThreshold}
                placeholder="e.g. 3, 7, 10000"
              />

              <Text style={styles.modalLabel}>DESCRIPTION</Text>
              <TextInput
                style={styles.modalInput}
                value={rewardDesc}
                onChangeText={setRewardDesc}
                placeholder="Description of the reward item..."
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveRewardConfig}>
                <Text style={styles.modalSaveBtnText}>SAVE REWARD</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRewardModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- MODAL: FITNESS APP SELECTOR --- */}
      <Modal visible={appModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>SELECT FITNESS APP</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {fitnessApps.map((app) => (
                <TouchableOpacity
                  key={app.id}
                  style={[styles.appItem, selectedApp?.id === app.id && styles.appItemActive]}
                  onPress={() => handleSelectApp(app)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.appName}>{app.name}</Text>
                    <Text style={styles.appSub}>{app.isInstalled ? 'Installed on device' : app.packageName}</Text>
                  </View>
                  <Text style={styles.appSelectText}>
                    {selectedApp?.id === app.id ? 'SELECTED' : 'CONNECT'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setAppModalVisible(false)}>
              <Text style={styles.modalCancelBtnText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- MODAL: WATCH DEVICE SELECTOR --- */}
      <Modal visible={watchDeviceModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>SELECT COMPANION DEVICE</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {[
                { id: 'bip-6', name: 'Amazfit Bip 6', os: 'Zepp OS 3.0', screen: '390x450 AMOLED', icon: '⌚' },
                { id: 'bip-5', name: 'Amazfit Bip 5', os: 'Zepp OS 2.0', screen: '320x380 TFT', icon: '⌚' },
                { id: 'bip-5-unity', name: 'Amazfit Bip 5 Unity', os: 'Zepp OS 2.0', screen: '320x380 TFT', icon: '⌚' },
                { id: 'android-host', name: 'Android Device (Local Host)', os: 'Android 10+', screen: 'Host Phone Screen', icon: '📱' },
                { id: 'zepp-generic', name: 'Zepp OS Smartwatch (Generic)', os: 'Zepp OS 2.0 / 3.0', screen: 'Auto-detect', icon: '⌚' },
              ].map((dev) => (
                <TouchableOpacity
                  key={dev.id}
                  style={[
                    styles.appItem,
                    settings.watchCompanionDeviceName === dev.name && styles.appItemActive,
                  ]}
                  onPress={async () => {
                    const updated = { ...settings, watchCompanionDeviceName: dev.name };
                    setSettings(updated);
                    await saveStoredSettings(updated);
                    setWatchDeviceModalVisible(false);
                    const pkm = await getStoredPokemon();
                    if (pkm) {
                      await updateWatchCompanionPayloads(pkm, updated);
                    }
                  }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.appName}>
                      {dev.icon} {dev.name}
                    </Text>
                    <Text style={styles.appSub}>
                      {dev.os} • {dev.screen}
                    </Text>
                  </View>
                  <Text style={styles.appSelectText}>
                    {settings.watchCompanionDeviceName === dev.name ? 'ACTIVE' : 'SELECT'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setWatchDeviceModalVisible(false)}>
              <Text style={styles.modalCancelBtnText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bottom Navigation */}
      <BottomNavBar currentTab="pet" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8bac0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#306230',
    borderBottomWidth: 3,
    borderBottomColor: '#0f380f',
  },
  backBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#0f380f',
    borderRadius: 4,
  },
  backBtnText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#9bbc0f',
    fontWeight: 'bold',
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#9bbc0f',
    letterSpacing: 0.5,
  },
  saveHeaderBtn: {
    backgroundColor: '#9bbc0f',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  saveHeaderText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '900',
    color: '#0f380f',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#0f380f',
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 4,
    marginHorizontal: 2,
  },
  tabBtnActive: {
    backgroundColor: '#8bac0f',
  },
  tabBtnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#8bac0f',
  },
  tabBtnTextActive: {
    color: '#0f380f',
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#9bbc0f',
    borderWidth: 3,
    borderColor: '#0f380f',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#0f380f',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '900',
    color: '#0f380f',
  },
  settingDesc: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#306230',
    marginBottom: 8,
    lineHeight: 14,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#8bac0f',
    paddingVertical: 8,
  },
  settingLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0f380f',
  },
  settingInput: {
    backgroundColor: '#8bac0f',
    borderWidth: 2,
    borderColor: '#0f380f',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f380f',
    textAlign: 'center',
    minWidth: 50,
  },
  toggleModeBtn: {
    backgroundColor: '#0f380f',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  toggleModeText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9bbc0f',
  },
  addRuleBtn: {
    backgroundColor: '#0f380f',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  addRuleBtnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '900',
    color: '#9bbc0f',
  },
  ruleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8bac0f',
    borderWidth: 2,
    borderColor: '#0f380f',
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
  },
  ruleCardDisabled: {
    opacity: 0.5,
  },
  ruleTitle: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '900',
    color: '#0f380f',
  },
  statPill: {
    backgroundColor: '#0f380f',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  statPillText: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#9bbc0f',
  },
  ruleSub: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#306230',
    marginTop: 2,
  },
  ruleRequirement: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0f380f',
    marginTop: 2,
  },
  ruleToggle: {
    backgroundColor: '#306230',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  ruleToggleActive: {
    backgroundColor: '#0f380f',
  },
  ruleToggleText: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#8bac0f',
  },
  ruleToggleTextActive: {
    color: '#9bbc0f',
  },
  editRuleBtn: {
    backgroundColor: '#8bac0f',
    borderWidth: 1,
    borderColor: '#0f380f',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginHorizontal: 2,
  },
  editRuleText: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0f380f',
  },
  deleteRuleBtn: {
    padding: 4,
  },
  deleteRuleText: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f380f',
  },
  globalToggleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#8bac0f',
    borderWidth: 2,
    borderColor: '#0f380f',
    borderRadius: 6,
    padding: 8,
    marginBottom: 10,
  },
  globalToggleLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '900',
    color: '#0f380f',
  },
  selectedAppBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8bac0f',
    borderWidth: 2,
    borderColor: '#0f380f',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  selectedAppLabel: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: 'bold',
    color: '#306230',
  },
  selectedAppName: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '900',
    color: '#0f380f',
  },
  changeBtnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f380f',
  },
  statusPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  statusAvailable: {
    backgroundColor: '#306230',
  },
  statusWarning: {
    backgroundColor: '#8bac0f',
  },
  statusPillText: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#9bbc0f',
  },
  syncHealthBtn: {
    backgroundColor: '#0f380f',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  syncHealthBtnText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '900',
    color: '#9bbc0f',
  },
  openSettingsBtn: {
    backgroundColor: '#306230',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 6,
  },
  openSettingsBtnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9bbc0f',
  },
  simBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    marginTop: 6,
  },
  simBtn: {
    flex: 1,
    backgroundColor: '#0f380f',
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  simBtnText: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#9bbc0f',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#9bbc0f',
    borderWidth: 4,
    borderColor: '#0f380f',
    borderRadius: 8,
    padding: 14,
  },
  modalTitle: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '900',
    color: '#0f380f',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f380f',
    marginTop: 8,
    marginBottom: 3,
  },
  modalSubLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#306230',
    marginTop: 4,
    marginBottom: 2,
  },
  modalInput: {
    backgroundColor: '#8bac0f',
    borderWidth: 2,
    borderColor: '#0f380f',
    borderRadius: 6,
    padding: 6,
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#0f380f',
    fontWeight: 'bold',
  },
  modalChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 4,
  },
  modalChip: {
    backgroundColor: '#8bac0f',
    borderWidth: 1,
    borderColor: '#0f380f',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  modalChipActive: {
    backgroundColor: '#0f380f',
  },
  modalChipText: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#0f380f',
    fontWeight: 'bold',
  },
  modalChipTextActive: {
    color: '#9bbc0f',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: '#0f380f',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  modalSaveBtnText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '900',
    color: '#9bbc0f',
  },
  modalCancelBtn: {
    backgroundColor: '#306230',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 6,
  },
  modalCancelBtnText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#8bac0f',
  },
  appItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8bac0f',
    borderWidth: 2,
    borderColor: '#0f380f',
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
  },
  appItemActive: {
    backgroundColor: '#306230',
  },
  appName: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '900',
    color: '#0f380f',
  },
  appSub: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#306230',
  },
  appSelectText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f380f',
  },
  watchInfoBox: {
    backgroundColor: '#8bac0f',
    borderWidth: 2,
    borderColor: '#0f380f',
    borderRadius: 6,
    padding: 8,
    marginVertical: 8,
  },
  watchInfoTitle: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '900',
    color: '#0f380f',
    marginBottom: 4,
  },
  watchInfoLine: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#306230',
    marginTop: 2,
  },
});
