import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  TextInput,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { TamagotchiPokemon, AppSettings, StreakReward, MoveData, WorkoutRecord } from '../types/pokemon';
import {
  getStoredPokemon,
  saveStoredPokemon,
  clearStoredPokemon,
  getStoredSettings,
  getStoredRewards,
  saveStoredRewards,
} from '../utils/storage';
import {
  processCircadianAndPassive,
  recordWorkout,
  logMeal,
  logSleep,
  applyRewardItem,
} from '../utils/tamagotchiEngine';
import { generateReturnPayload } from '../utils/pkmParser';
import { syncHealthWithPokemon, getSelectedFitnessApp } from '../utils/healthBridge';
import {
  initWatchBridge,
  updateWatchCompanionPayloads,
  addWatchSyncListener,
} from '../utils/watchBridge';
import BottomNavBar from '../components/BottomNavBar';

export default function PetScreen() {
  const [pokemon, setPokemon] = useState<TamagotchiPokemon | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [rewards, setRewards] = useState<StreakReward[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Modals
  const [mealModalVisible, setMealModalVisible] = useState(false);
  const [workoutModalVisible, setWorkoutModalVisible] = useState(false);
  const [sleepModalVisible, setSleepModalVisible] = useState(false);
  const [rewardsModalVisible, setRewardsModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [newMoveQueue, setNewMoveQueue] = useState<MoveData[]>([]);
  const [currentNewMove, setCurrentNewMove] = useState<MoveData | null>(null);

  // Form Inputs
  const [sleepInput, setSleepInput] = useState('7.5');
  const [workoutDuration, setWorkoutDuration] = useState('30');
  const [workoutType, setWorkoutType] = useState<WorkoutRecord['type']>('cardio');

  const router = useRouter();

  // Animation breathing shared values
  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);

  const [connectedApp, setConnectedApp] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    // Breathing squash/stretch animation
    scaleY.value = withRepeat(
      withSequence(
        withTiming(0.94, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.06, { duration: 1400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    scaleX.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.94, { duration: 1400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    loadInitialData();

    // Auto-sync whenever user returns to the app from smartwatch/fitness apps
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        loadInitialData(true);
      }
    });

    // Listen for watch ledger commits in real-time
    const watchUnsub = addWatchSyncListener((batch, updatedPkm) => {
      setPokemon(updatedPkm);
    });

    return () => {
      subscription.remove();
      watchUnsub();
    };
  }, []);

  const loadInitialData = async (isAutoSync: boolean = false) => {
    const pkm = await getStoredPokemon();
    const sets = await getStoredSettings();
    const rews = await getStoredRewards();
    const activeApp = await getSelectedFitnessApp();
    setSettings(sets);
    setRewards(rews);
    setConnectedApp(activeApp);

    if (!pkm) {
      router.replace('/');
      return;
    }

    // 1. Process passive circadian updates
    const result = processCircadianAndPassive(pkm, sets, 0);
    let currentPkm = result.updatedPokemon;
    setPokemon(currentPkm);
    await saveStoredPokemon(currentPkm);

    // 2. Ensure Watch Bridge server is running and updated
    try {
      await initWatchBridge();
      await updateWatchCompanionPayloads(currentPkm, sets);
    } catch {
      // Bridge fail-safe
    }

    // 3. Automatically pull live fitness data (Zepp / Google Fit / Phone Sensor)
    try {
      const { updatedPokemon: syncedPkm, result: syncRes } = await syncHealthWithPokemon(currentPkm, sets);
      setPokemon(syncedPkm);
      await saveStoredPokemon(syncedPkm);
      await updateWatchCompanionPayloads(syncedPkm, sets);

      if (syncRes.leveledUp && syncRes.newMoves.length > 0) {
        setNewMoveQueue(syncRes.newMoves);
        setCurrentNewMove(syncRes.newMoves[0]);
        setMoveModalVisible(true);
      }
    } catch {
      // Background sync fail-safe
    }

    if (result.leveledUp && result.newLearnableMoves.length > 0) {
      setNewMoveQueue(result.newLearnableMoves);
      setCurrentNewMove(result.newLearnableMoves[0]);
      setMoveModalVisible(true);
    }
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scaleX: scaleX.value }, { scaleY: scaleY.value }],
    };
  });

  const handleClear = async () => {
    Alert.alert(
      'Release Companion?',
      'This will remove your current companion from this device. Transfer to WebApp first if you wish to keep your progress.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Release',
          style: 'destructive',
          onPress: async () => {
            await clearStoredPokemon();
            router.replace('/');
          },
        },
      ]
    );
  };

  const handleMeal = async (type: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    if (!pokemon) return;
    const { updatedPokemon } = logMeal(pokemon, type, settings || undefined);
    setPokemon(updatedPokemon);
    await saveStoredPokemon(updatedPokemon);
    setMealModalVisible(false);
    Alert.alert('Nom Nom!', `${pokemon.nickname} enjoyed the ${type}! Energy restored.`);
  };

  const handleWorkout = async () => {
    if (!pokemon || !settings) return;
    const duration = parseInt(workoutDuration, 10) || 15;
    const { updatedPokemon, evGain } = recordWorkout(pokemon, workoutType, duration, settings);
    setPokemon(updatedPokemon);
    await saveStoredPokemon(updatedPokemon);
    setWorkoutModalVisible(false);
    Alert.alert(
      'Workout Logged!',
      `Great job! ${pokemon.nickname} gained +${evGain.amount} ${evGain.stat.toUpperCase()} EVs!`
    );
  };

  const handleSleep = async () => {
    if (!pokemon || !settings) return;
    const hours = parseFloat(sleepInput) || 7.5;
    const { updatedPokemon, grantedRestedBuff } = logSleep(pokemon, hours, settings);
    setPokemon(updatedPokemon);
    await saveStoredPokemon(updatedPokemon);
    setSleepModalVisible(false);

    if (grantedRestedBuff) {
      Alert.alert('Rested Buff!', `Target sleep achieved (${hours} hrs)! 2x EXP & Training bonus active for 24 hours!`);
    } else {
      Alert.alert('Sleep Logged', `Logged ${hours} hrs of sleep. Energy replenished!`);
    }
  };

  const handleClaimReward = async (reward: StreakReward) => {
    if (!pokemon) return;
    const updated = applyRewardItem(pokemon, reward.itemType);
    const updatedRewards = rewards.map((r) => (r.id === reward.id ? { ...r, claimed: true } : r));

    setPokemon(updated);
    setRewards(updatedRewards);
    await saveStoredPokemon(updated);
    await saveStoredRewards(updatedRewards);
    Alert.alert('Reward Claimed!', `Applied ${reward.name} to ${pokemon.nickname}!`);
  };

  const handleReplaceMove = async (slotIndex: number) => {
    if (!pokemon || !currentNewMove) return;
    const updatedMoves = [...pokemon.moves];
    if (slotIndex < updatedMoves.length) {
      updatedMoves[slotIndex] = currentNewMove;
    } else {
      updatedMoves.push(currentNewMove);
    }

    const updatedPokemon = { ...pokemon, moves: updatedMoves };
    setPokemon(updatedPokemon);
    await saveStoredPokemon(updatedPokemon);

    // Process next move if in queue
    const remaining = newMoveQueue.slice(1);
    if (remaining.length > 0) {
      setNewMoveQueue(remaining);
      setCurrentNewMove(remaining[0]);
    } else {
      setMoveModalVisible(false);
      setCurrentNewMove(null);
    }
  };

  const handleSkipMove = () => {
    const remaining = newMoveQueue.slice(1);
    if (remaining.length > 0) {
      setNewMoveQueue(remaining);
      setCurrentNewMove(remaining[0]);
    } else {
      setMoveModalVisible(false);
      setCurrentNewMove(null);
    }
  };

  const handleFitnessSync = async () => {
    if (!pokemon || !settings) return;
    setIsSyncing(true);
    try {
      const { updatedPokemon, result } = await syncHealthWithPokemon(pokemon, settings);
      setPokemon(updatedPokemon);
      await saveStoredPokemon(updatedPokemon);

      let evSummary = Object.entries(result.evsGained)
        .filter(([_, val]) => val > 0)
        .map(([k, v]) => `${k.toUpperCase()}: +${v}`)
        .join(', ');

      Alert.alert(
        'Fitness Synced!',
        `Source: ${result.source}\n` +
          `• Steps Synced: ${result.stepsSynced.toLocaleString()} (+${result.stepDelta.toLocaleString()} new)\n` +
          `• EXP Gained: +${result.expGained}\n` +
          `• Friendship: +${result.friendshipGained} Hearts\n` +
          (result.restedApplied ? '• Rested 2x Buff: APPLIED (7-8 hrs sleep)!\n' : '') +
          (evSummary ? `• Workout EVs: ${evSummary}\n` : '') +
          (result.leveledUp ? `\n🎉 ${updatedPokemon.nickname} leveled up to Lv. ${updatedPokemon.level}!` : '')
      );
    } catch (err: any) {
      Alert.alert('Sync Error', err.message || 'Failed to sync fitness data.');
    } finally {
      setIsSyncing(false);
    }
  };

  if (!pokemon) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.pixelText}>Loading Companion...</Text>
      </View>
    );
  }

  // Sprite URL fallback (PokeAPI animated or static)
  const isAnimated = settings?.spriteMode === 'animated';
  const spriteUrl = isAnimated
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${pokemon.speciesId}.gif`
    : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.speciesId}.png`;

  const expPercent = Math.min(
    100,
    Math.max(0, Math.floor((pokemon.exp / Math.max(1, pokemon.expToNextLevel)) * 100))
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top Pokéwalker Status Screen */}
        <View style={styles.lcdScreen}>
          {/* Header Status Bar */}
          <View style={styles.lcdHeader}>
            <View>
              <Text style={styles.pkmNameText}>{pokemon.nickname.toUpperCase()}</Text>
              <Text style={styles.pkmMetaText}>Lv. {pokemon.level} • {pokemon.types.join('/').toUpperCase()}</Text>
            </View>
            <View style={styles.statusBadges}>
              {pokemon.isRested && <Text style={styles.restedBadge}>RESTED 2x</Text>}
              <Text style={styles.streakBadge}>🔥 {pokemon.streakDays}d</Text>
            </View>
          </View>

          {/* Central Sprite Container with Breathing Animation */}
          <View style={styles.spriteWrapper}>
            <Animated.View style={[styles.spriteContainer, animatedStyle]}>
              <Image
                source={{ uri: spriteUrl }}
                style={styles.spriteImage}
                contentFit="contain"
                transition={200}
              />
            </Animated.View>
          </View>

          {/* Meters Grid */}
          <View style={styles.meterSection}>
            {/* EXP Bar */}
            <View style={styles.meterRow}>
              <Text style={styles.meterLabel}>EXP</Text>
              <View style={styles.meterBarTrack}>
                <View style={[styles.meterBarFill, { width: `${expPercent}%`, backgroundColor: '#306230' }]} />
              </View>
              <Text style={styles.meterValue}>{pokemon.exp}/{pokemon.expToNextLevel}</Text>
            </View>

            {/* Energy Bar */}
            <View style={styles.meterRow}>
              <Text style={styles.meterLabel}>NRG</Text>
              <View style={styles.meterBarTrack}>
                <View style={[styles.meterBarFill, { width: `${pokemon.energy}%`, backgroundColor: '#8bac0f' }]} />
              </View>
              <Text style={styles.meterValue}>{pokemon.energy}%</Text>
            </View>

            {/* Friendship Bar */}
            <View style={styles.meterRow}>
              <Text style={styles.meterLabel}>HEART</Text>
              <View style={styles.meterBarTrack}>
                <View style={[styles.meterBarFill, { width: `${Math.floor((pokemon.friendship / 255) * 100)}%`, backgroundColor: '#0f380f' }]} />
              </View>
              <Text style={styles.meterValue}>{pokemon.friendship}/255</Text>
            </View>
          </View>

          {/* Step Count Footer */}
          <View style={styles.stepFooter}>
            <Text style={styles.stepText}>TOTAL STEPS: {pokemon.totalSteps.toLocaleString()}</Text>
            {connectedApp && (
              <Text style={styles.connectedAppBadge}>⌚ {connectedApp.name}</Text>
            )}
          </View>
        </View>

        {/* Stats & Moves Summary Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>CURRENT STATS (EVs Included)</Text>
          <View style={styles.statsGrid}>
            <Text style={styles.statItem}>HP: {pokemon.calculatedStats.hp} (+{pokemon.evs.hp})</Text>
            <Text style={styles.statItem}>ATK: {pokemon.calculatedStats.attack} (+{pokemon.evs.attack})</Text>
            <Text style={styles.statItem}>DEF: {pokemon.calculatedStats.defense} (+{pokemon.evs.defense})</Text>
            <Text style={styles.statItem}>SP.ATK: {pokemon.calculatedStats.specialAttack} (+{pokemon.evs.specialAttack})</Text>
            <Text style={styles.statItem}>SP.DEF: {pokemon.calculatedStats.specialDefense} (+{pokemon.evs.specialDefense})</Text>
            <Text style={styles.statItem}>SPD: {pokemon.calculatedStats.speed} (+{pokemon.evs.speed})</Text>
          </View>

          <Text style={[styles.cardTitle, { marginTop: 12 }]}>MOVESET</Text>
          <View style={styles.movesGrid}>
            {pokemon.moves.map((m, idx) => (
              <View key={idx} style={styles.movePill}>
                <Text style={styles.moveName}>{m.name}</Text>
                <Text style={styles.moveMeta}>{m.type.toUpperCase()} • PP {m.pp}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Fitness Sync Banner */}
        <TouchableOpacity
          style={[styles.syncBanner, isSyncing && { opacity: 0.6 }]}
          onPress={handleFitnessSync}
          disabled={isSyncing}>
          <Text style={styles.syncBannerText}>
            {isSyncing ? '⏳ SYNCING HEALTH DATA...' : '🔄 SYNC FITNESS (ZEPP / FIT / STEPS)'}
          </Text>
        </TouchableOpacity>

        {/* Tamagotchi Action Button Pad */}
        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/log' as any)}>
            <Text style={styles.actionIcon}>📝</Text>
            <Text style={styles.actionText}>LOG ACTIVITY</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/inventory' as any)}>
            <Text style={styles.actionIcon}>🎒</Text>
            <Text style={styles.actionText}>INVENTORY</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/todo' as any)}>
            <Text style={styles.actionIcon}>✅</Text>
            <Text style={styles.actionText}>TODO</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/pokemon' as any)}>
            <Text style={styles.actionIcon}>⚡</Text>
            <Text style={styles.actionText}>POKÉMON</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Utility Bar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.utilBtn} onPress={() => setExportModalVisible(true)}>
            <Text style={styles.utilBtnText}>EXPORT QR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.utilBtn} onPress={() => router.push('/settings')}>
            <Text style={styles.utilBtnText}>SETTINGS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.utilBtn, styles.dangerBtn]} onPress={handleClear}>
            <Text style={[styles.utilBtnText, styles.dangerText]}>RELEASE</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Primary Bottom Navigation Bar */}
      <BottomNavBar currentTab="pet" />

      {/* --- MODAL: MEAL LOGGING --- */}
      <Modal visible={mealModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Feed {pokemon.nickname}</Text>
            <Text style={styles.modalSub}>Log a healthy real-world meal to restore energy:</Text>
            <View style={styles.modalOptionList}>
              <TouchableOpacity style={styles.retroModalBtn} onPress={() => handleMeal('breakfast')}>
                <Text style={styles.retroModalBtnText}>🍳 Breakfast (+40% Energy)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.retroModalBtn} onPress={() => handleMeal('lunch')}>
                <Text style={styles.retroModalBtnText}>🥗 Lunch (+45% Energy)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.retroModalBtn} onPress={() => handleMeal('dinner')}>
                <Text style={styles.retroModalBtnText}>🍲 Dinner (+40% Energy)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.retroModalBtn} onPress={() => handleMeal('snack')}>
                <Text style={styles.retroModalBtnText}>🍎 Healthy Snack (+20% Energy)</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setMealModalVisible(false)}>
              <Text style={styles.closeBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- MODAL: WORKOUT TRACKER --- */}
      <Modal visible={workoutModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Motion Workout Tracker</Text>
            <Text style={styles.modalSub}>Physical workouts map directly to EVs:</Text>

            <View style={styles.workoutTypeRow}>
              <TouchableOpacity
                style={[styles.workoutTypeChip, workoutType === 'cardio' && styles.workoutTypeChipActive]}
                onPress={() => setWorkoutType('cardio')}>
                <Text style={styles.chipText}>Cardio (SPD)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.workoutTypeChip, workoutType === 'weightlifting' && styles.workoutTypeChipActive]}
                onPress={() => setWorkoutType('weightlifting')}>
                <Text style={styles.chipText}>Weights (ATK)</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.workoutTypeRow}>
              <TouchableOpacity
                style={[styles.workoutTypeChip, workoutType === 'defense' && styles.workoutTypeChipActive]}
                onPress={() => setWorkoutType('defense')}>
                <Text style={styles.chipText}>Core (DEF)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.workoutTypeChip, workoutType === 'hiit' && styles.workoutTypeChipActive]}
                onPress={() => setWorkoutType('hiit')}>
                <Text style={styles.chipText}>HIIT (SP.ATK)</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.workoutTypeRow}>
              <TouchableOpacity
                style={[styles.workoutTypeChip, workoutType === 'yoga' && styles.workoutTypeChipActive]}
                onPress={() => setWorkoutType('yoga')}>
                <Text style={styles.chipText}>Yoga (SP.DEF)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.workoutTypeChip, workoutType === 'walking' && styles.workoutTypeChipActive]}
                onPress={() => setWorkoutType('walking')}>
                <Text style={styles.chipText}>Jogging (HP)</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSub, { marginTop: 10 }]}>Duration (Minutes):</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={workoutDuration}
              onChangeText={setWorkoutDuration}
            />

            <TouchableOpacity style={styles.retroModalBtn} onPress={handleWorkout}>
              <Text style={styles.retroModalBtnText}>RECORD WORKOUT</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setWorkoutModalVisible(false)}>
              <Text style={styles.closeBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- MODAL: SLEEP TRACKER --- */}
      <Modal visible={sleepModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Circadian Sleep Tracker</Text>
            <Text style={styles.modalSub}>
              Hit 7-8 hours of scheduled sleep for the 2x Rested Buff:
            </Text>

            <TextInput
              style={styles.modalInput}
              keyboardType="decimal-pad"
              value={sleepInput}
              onChangeText={setSleepInput}
              placeholder="Hours (e.g. 7.5)"
            />

            <TouchableOpacity style={styles.retroModalBtn} onPress={handleSleep}>
              <Text style={styles.retroModalBtnText}>LOG SLEEP</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSleepModalVisible(false)}>
              <Text style={styles.closeBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- MODAL: REWARDS / STREAKS --- */}
      <Modal visible={rewardsModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Streak & Mystery Gifts</Text>
            <Text style={styles.modalSub}>Current Streak: {pokemon.streakDays} Days</Text>

            <ScrollView style={{ maxHeight: 240, marginVertical: 10 }}>
              {rewards.map((r) => {
                const canClaim = pokemon.streakDays >= r.streakRequirement && !r.claimed;
                return (
                  <View key={r.id} style={styles.rewardItemCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rewardName}>{r.name}</Text>
                      <Text style={styles.rewardDesc}>{r.description}</Text>
                      <Text style={styles.rewardReq}>Requires {r.streakRequirement} day streak</Text>
                    </View>
                    <TouchableOpacity
                      disabled={!canClaim}
                      style={[styles.claimBtn, !canClaim && styles.claimBtnDisabled]}
                      onPress={() => handleClaimReward(r)}>
                      <Text style={styles.claimBtnText}>{r.claimed ? 'CLAIMED' : 'CLAIM'}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setRewardsModalVisible(false)}>
              <Text style={styles.closeBtnText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- MODAL: 4-MOVE LEARNER --- */}
      <Modal visible={moveModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Move Available!</Text>
            <Text style={styles.modalSub}>
              {pokemon.nickname} wants to learn {currentNewMove?.name} ({currentNewMove?.type.toUpperCase()} / Power {currentNewMove?.power || '—'})!
            </Text>
            <Text style={[styles.modalSub, { fontWeight: 'bold' }]}>
              Select a move to replace:
            </Text>

            <View style={{ marginVertical: 10 }}>
              {pokemon.moves.map((m, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.moveReplaceBtn}
                  onPress={() => handleReplaceMove(idx)}>
                  <Text style={styles.moveReplaceText}>
                    Slot {idx + 1}: {m.name} ({m.type.toUpperCase()} • PP {m.pp})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: '#306230' }]} onPress={handleSkipMove}>
              <Text style={styles.closeBtnText}>DON'T LEARN MOVE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- MODAL: EXPORT QR PAYLOAD --- */}
      <Modal visible={exportModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Transfer Out to WebApp</Text>
            <Text style={styles.modalSub}>Copy the payload below or scan to return {pokemon.nickname} to your save file:</Text>
            <TextInput
              style={[styles.modalInput, { height: 70 }]}
              multiline
              editable={false}
              value={generateReturnPayload(pokemon)}
            />
            <TouchableOpacity
              style={styles.retroModalBtn}
              onPress={() => {
                Alert.alert('Payload Ready', 'Copy this text into the WebApp or relay server to restore your Pokémon.');
                setExportModalVisible(false);
              }}>
              <Text style={styles.retroModalBtnText}>DONE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setExportModalVisible(false)}>
              <Text style={styles.closeBtnText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8bac0f', // Game Boy Olive
  },
  scrollContent: {
    padding: 16,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#8bac0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pixelText: {
    fontFamily: 'monospace',
    fontSize: 16,
    color: '#0f380f',
    fontWeight: 'bold',
  },
  lcdScreen: {
    width: '100%',
    backgroundColor: '#9bbc0f',
    borderWidth: 4,
    borderColor: '#0f380f',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  lcdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: '#0f380f',
    paddingBottom: 8,
  },
  pkmNameText: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 18,
    color: '#0f380f',
  },
  pkmMetaText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#306230',
    marginTop: 2,
  },
  statusBadges: {
    alignItems: 'flex-end',
    gap: 4,
  },
  restedBadge: {
    backgroundColor: '#306230',
    color: '#cadc9f',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  streakBadge: {
    backgroundColor: '#0f380f',
    color: '#9bbc0f',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  spriteWrapper: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 6,
  },
  spriteContainer: {
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spriteImage: {
    width: 140,
    height: 140,
  },
  meterSection: {
    gap: 6,
    marginTop: 4,
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meterLabel: {
    width: 46,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 11,
    color: '#0f380f',
  },
  meterBarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#cadc9f',
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#0f380f',
    overflow: 'hidden',
  },
  meterBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  meterValue: {
    width: 68,
    textAlign: 'right',
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#0f380f',
    fontWeight: 'bold',
  },
  stepFooter: {
    marginTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#0f380f',
    paddingTop: 6,
    alignItems: 'center',
  },
  stepText: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 12,
    color: '#0f380f',
  },
  card: {
    width: '100%',
    backgroundColor: '#9bbc0f',
    borderWidth: 3,
    borderColor: '#0f380f',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  cardTitle: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 12,
    color: '#0f380f',
    marginBottom: 6,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statItem: {
    width: '48%',
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#0f380f',
    backgroundColor: '#cadc9f',
    padding: 6,
    borderRadius: 4,
  },
  movesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  movePill: {
    width: '48%',
    backgroundColor: '#306230',
    padding: 6,
    borderRadius: 6,
  },
  moveName: {
    color: '#cadc9f',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 11,
  },
  moveMeta: {
    color: '#8bac0f',
    fontFamily: 'monospace',
    fontSize: 9,
  },
  actionGrid: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#0f380f',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  actionText: {
    color: '#9bbc0f',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 10,
  },
  bottomBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  utilBtn: {
    flex: 1,
    backgroundColor: '#306230',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  utilBtnText: {
    color: '#cadc9f',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 11,
  },
  dangerBtn: {
    backgroundColor: '#8b0000',
  },
  dangerText: {
    color: '#ffffff',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#9bbc0f',
    borderWidth: 4,
    borderColor: '#0f380f',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 16,
    color: '#0f380f',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalSub: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#306230',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalOptionList: {
    gap: 8,
    marginBottom: 12,
  },
  retroModalBtn: {
    backgroundColor: '#0f380f',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 8,
  },
  retroModalBtnText: {
    color: '#9bbc0f',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 12,
  },
  closeBtn: {
    backgroundColor: '#306230',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#cadc9f',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 11,
  },
  workoutTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  workoutTypeChip: {
    flex: 1,
    backgroundColor: '#cadc9f',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0f380f',
  },
  workoutTypeChipActive: {
    backgroundColor: '#0f380f',
  },
  chipText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f380f',
  },
  modalInput: {
    backgroundColor: '#cadc9f',
    borderWidth: 2,
    borderColor: '#0f380f',
    borderRadius: 6,
    padding: 10,
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#0f380f',
    marginBottom: 12,
  },
  rewardItemCard: {
    backgroundColor: '#cadc9f',
    borderWidth: 2,
    borderColor: '#0f380f',
    borderRadius: 6,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rewardName: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 12,
    color: '#0f380f',
  },
  rewardDesc: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#306230',
  },
  rewardReq: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#666',
  },
  claimBtn: {
    backgroundColor: '#0f380f',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  claimBtnDisabled: {
    backgroundColor: '#888',
  },
  claimBtnText: {
    color: '#9bbc0f',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 10,
  },
  moveReplaceBtn: {
    backgroundColor: '#cadc9f',
    borderWidth: 2,
    borderColor: '#0f380f',
    padding: 10,
    borderRadius: 6,
    marginBottom: 6,
  },
  moveReplaceText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#0f380f',
    fontWeight: 'bold',
  },
  syncBanner: {
    backgroundColor: '#0f380f',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#306230',
  },
  syncBannerText: {
    color: '#9bbc0f',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  connectedAppBadge: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#306230',
    marginTop: 2,
  },
});
