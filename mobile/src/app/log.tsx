import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TamagotchiPokemon, AppSettings, WorkoutRecord, MealRecord } from '../types/pokemon';
import {
  getStoredPokemon,
  saveStoredPokemon,
  getStoredSettings,
  getTodayHydrationCups,
  addHydrationCup,
} from '../utils/storage';
import {
  recordWorkout,
  logMeal,
  logSleep,
  processCircadianAndPassive,
} from '../utils/tamagotchiEngine';
import BottomNavBar from '../components/BottomNavBar';

export default function LogActivityScreen() {
  const router = useRouter();
  const [pokemon, setPokemon] = useState<TamagotchiPokemon | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'workout' | 'meal' | 'sleep' | 'steps'>('workout');

  // Workout state
  const [workoutType, setWorkoutType] = useState<WorkoutRecord['type']>('cardio');
  const [workoutDuration, setWorkoutDuration] = useState('30');
  const [workoutNotes, setWorkoutNotes] = useState('');

  // Sleep state
  const [sleepHours, setSleepHours] = useState('7.5');

  // Steps state
  const [manualSteps, setManualSteps] = useState('1000');

  // Hydration state
  const [waterCups, setWaterCups] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const pkm = await getStoredPokemon();
    const sets = await getStoredSettings();
    const cups = await getTodayHydrationCups();
    setPokemon(pkm);
    setSettings(sets);
    setWaterCups(cups);
  };

  const handleRecordWorkout = async () => {
    if (!pokemon || !settings) {
      Alert.alert('No Companion', 'Scan or select a Pokémon first.');
      return;
    }
    const duration = parseInt(workoutDuration, 10) || 15;
    const { updatedPokemon, evGains } = recordWorkout(
      pokemon,
      workoutType,
      duration,
      settings,
      workoutNotes
    );

    await saveStoredPokemon(updatedPokemon);
    setPokemon(updatedPokemon);

    const gainSummary = Object.entries(evGains)
      .map(([stat, val]) => `+${val} ${stat.toUpperCase()} EV`)
      .join(', ');

    Alert.alert(
      'Workout Logged!',
      `Great session! ${pokemon.nickname} gained ${gainSummary || 'EV points'}!`,
      [{ text: 'OK', onPress: () => {} }]
    );
  };

  const handleLogMeal = async (type: MealRecord['type']) => {
    if (!pokemon || !settings) return;
    const { updatedPokemon, evGains } = logMeal(pokemon, type, settings);
    await saveStoredPokemon(updatedPokemon);
    setPokemon(updatedPokemon);

    const evText = Object.entries(evGains)
      .map(([stat, val]) => ` (+${val} ${stat.toUpperCase()} EV)`)
      .join('');

    Alert.alert(
      'Meal Logged! 🍳',
      `${pokemon.nickname} enjoyed the ${type.toUpperCase()}! Energy restored.${evText}`
    );
  };

  const handleDrinkWater = async () => {
    if (!pokemon || !settings) return;
    const newCups = await addHydrationCup();
    setWaterCups(newCups);

    const { updatedPokemon, evGains } = logMeal(pokemon, 'water', settings);
    await saveStoredPokemon(updatedPokemon);
    setPokemon(updatedPokemon);

    const evText = Object.entries(evGains)
      .map(([stat, val]) => ` (+${val} ${stat.toUpperCase()} EV)`)
      .join('');

    Alert.alert(
      'Hydration Logged! 💧',
      `Cup #${newCups} logged today! Keep up the healthy habit.${evText}`
    );
  };

  const handleLogSleep = async () => {
    if (!pokemon || !settings) return;
    const hours = parseFloat(sleepHours) || 7.5;
    const { updatedPokemon, grantedRestedBuff, evGains } = logSleep(pokemon, hours, settings);
    await saveStoredPokemon(updatedPokemon);
    setPokemon(updatedPokemon);

    const evText = Object.entries(evGains)
      .map(([stat, val]) => `\n• EVs: +${val} ${stat.toUpperCase()}`)
      .join('');

    if (grantedRestedBuff) {
      Alert.alert(
        'Rested Buff Activated! 🌙',
        `Logged ${hours} hrs of restful sleep! 2x EXP & Training Bonus active for 24h!${evText}`
      );
    } else {
      Alert.alert(
        'Sleep Logged',
        `Logged ${hours} hrs of sleep. Energy replenished!${evText}`
      );
    }
  };

  const handleAddManualSteps = async () => {
    if (!pokemon || !settings) return;
    const steps = parseInt(manualSteps, 10) || 500;
    const result = processCircadianAndPassive(pokemon, settings, steps);
    await saveStoredPokemon(result.updatedPokemon);
    setPokemon(result.updatedPokemon);

    Alert.alert(
      'Steps Recorded! 👟',
      `Added ${steps.toLocaleString()} steps!\n• EXP: +${result.expGained}\n• Friendship: +${result.friendshipGained} Hearts` +
        (result.leveledUp ? `\n🎉 ${pokemon.nickname} leveled up to Lv. ${result.newLevel}!` : '')
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.push('/pet')}>
          <Text style={styles.backBtnText}>◀ HOME</Text>
        </TouchableOpacity>
        <Text style={styles.title}>LOG ACTIVITY</Text>
        <TouchableOpacity style={styles.headerSettingBtn} onPress={() => router.push('/settings')}>
          <Text style={styles.headerSettingText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Mode Switcher Tabs */}
      <View style={styles.tabSelector}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'workout' && styles.tabBtnActive]}
          onPress={() => setActiveTab('workout')}>
          <Text style={[styles.tabText, activeTab === 'workout' && styles.tabTextActive]}>🏋️ WORKOUT</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'meal' && styles.tabBtnActive]}
          onPress={() => setActiveTab('meal')}>
          <Text style={[styles.tabText, activeTab === 'meal' && styles.tabTextActive]}>🍎 MEALS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'sleep' && styles.tabBtnActive]}
          onPress={() => setActiveTab('sleep')}>
          <Text style={[styles.tabText, activeTab === 'sleep' && styles.tabTextActive]}>🌙 SLEEP</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'steps' && styles.tabBtnActive]}
          onPress={() => setActiveTab('steps')}>
          <Text style={[styles.tabText, activeTab === 'steps' && styles.tabTextActive]}>👟 STEPS</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* --- TAB: WORKOUT --- */}
        {activeTab === 'workout' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>WORKOUT TRACKER</Text>
            <Text style={styles.sectionDesc}>
              Select workout type and duration. Custom EV rules are applied automatically!
            </Text>

            <Text style={styles.fieldLabel}>WORKOUT TYPE</Text>
            <View style={styles.chipGrid}>
              {[
                { id: 'cardio', label: '🏃 Cardio (SPD)' },
                { id: 'weightlifting', label: '🏋️ Weights (ATK)' },
                { id: 'defense', label: '🛡️ Core (DEF)' },
                { id: 'hiit', label: '🔥 HIIT (SP.ATK)' },
                { id: 'yoga', label: '🧘 Yoga (SP.DEF)' },
                { id: 'walking', label: '🚶 Jogging (HP)' },
                { id: 'swimming', label: '🏊 Swimming (SPD/HP)' },
                { id: 'cycling', label: '🚴 Cycling (SPD/DEF)' },
                { id: 'custom', label: '✨ Custom Activity' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.chip, workoutType === item.id && styles.chipActive]}
                  onPress={() => setWorkoutType(item.id as WorkoutRecord['type'])}>
                  <Text style={[styles.chipText, workoutType === item.id && styles.chipTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>SESSION DURATION (MINUTES)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={workoutDuration}
              onChangeText={setWorkoutDuration}
              placeholder="30"
              placeholderTextColor="#5a7810"
            />

            <Text style={styles.fieldLabel}>OPTIONAL NOTES / INTENSITY</Text>
            <TextInput
              style={styles.input}
              value={workoutNotes}
              onChangeText={setWorkoutNotes}
              placeholder="e.g. Chest day, 5k run, Leg day"
              placeholderTextColor="#5a7810"
            />

            <TouchableOpacity style={styles.actionBtn} onPress={handleRecordWorkout}>
              <Text style={styles.actionBtnText}>RECORD WORKOUT & GAIN EVS</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* --- TAB: MEAL & WATER --- */}
        {activeTab === 'meal' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>HEALTHY MEALS</Text>
              <Text style={styles.sectionDesc}>
                Log your balanced daily meals to keep {pokemon?.nickname || 'your Pokémon'} well-fed and energized!
              </Text>

              <TouchableOpacity style={styles.mealBtn} onPress={() => handleLogMeal('breakfast')}>
                <Text style={styles.mealIcon}>🍳</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mealTitle}>BREAKFAST</Text>
                  <Text style={styles.mealSub}>+40% Energy • Maintains Healthy Streak</Text>
                </View>
                <Text style={styles.mealAction}>LOG ➔</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.mealBtn} onPress={() => handleLogMeal('lunch')}>
                <Text style={styles.mealIcon}>🥗</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mealTitle}>LUNCH</Text>
                  <Text style={styles.mealSub}>+45% Energy • Midday Fuel</Text>
                </View>
                <Text style={styles.mealAction}>LOG ➔</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.mealBtn} onPress={() => handleLogMeal('dinner')}>
                <Text style={styles.mealIcon}>🍲</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mealTitle}>DINNER</Text>
                  <Text style={styles.mealSub}>+40% Energy • Evening Recovery</Text>
                </View>
                <Text style={styles.mealAction}>LOG ➔</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.mealBtn} onPress={() => handleLogMeal('snack')}>
                <Text style={styles.mealIcon}>🍎</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mealTitle}>HEALTHY SNACK</Text>
                  <Text style={styles.mealSub}>+20% Energy • Fruit, Nuts, Protein</Text>
                </View>
                <Text style={styles.mealAction}>LOG ➔</Text>
              </TouchableOpacity>
            </View>

            {/* Hydration Tracker */}
            <View style={[styles.card, { marginTop: 12 }]}>
              <Text style={styles.sectionTitle}>💧 HYDRATION TRACKER</Text>
              <Text style={styles.sectionDesc}>
                Drinking water regularly grants HP EVs and triggers hydration milestone rewards!
              </Text>

              <View style={styles.waterStatsRow}>
                <View style={styles.waterBox}>
                  <Text style={styles.waterCount}>{waterCups}</Text>
                  <Text style={styles.waterLabel}>CUPS TODAY</Text>
                </View>
                <View style={styles.waterBox}>
                  <Text style={styles.waterCount}>{settings?.dailyWaterGoalCups || 8}</Text>
                  <Text style={styles.waterLabel}>DAILY GOAL</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.waterActionBtn} onPress={handleDrinkWater}>
                <Text style={styles.waterActionText}>+1 GLASS OF WATER (250ml)</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* --- TAB: SLEEP --- */}
        {activeTab === 'sleep' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>CIRCADIAN SLEEP TRACKER</Text>
            <Text style={styles.sectionDesc}>
              Target {settings?.sleepMinHours || 7}-{settings?.sleepMaxHours || 8} hours of consistent sleep for the 2x Rested Buff and Defense EVs!
            </Text>

            <Text style={styles.fieldLabel}>SLEEP DURATION (HOURS)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={sleepHours}
              onChangeText={setSleepHours}
              placeholder="7.5"
              placeholderTextColor="#5a7810"
            />

            <View style={styles.infoPill}>
              <Text style={styles.infoPillText}>
                ✨ Rested Buff: Grants 2x EXP multiplier & 2x EV training gains for 24 hours!
              </Text>
            </View>

            <TouchableOpacity style={styles.actionBtn} onPress={handleLogSleep}>
              <Text style={styles.actionBtnText}>LOG SLEEP & RECHARGE</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* --- TAB: STEPS --- */}
        {activeTab === 'steps' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>MANUAL STEP INPUT</Text>
            <Text style={styles.sectionDesc}>
              Manually add steps if you walk without your phone or fitness tracker.
            </Text>

            <Text style={styles.fieldLabel}>ADDITIONAL STEPS</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={manualSteps}
              onChangeText={setManualSteps}
              placeholder="1000"
              placeholderTextColor="#5a7810"
            />

            <View style={styles.quickStepRow}>
              {[500, 1000, 2500, 5000].map((stepVal) => (
                <TouchableOpacity
                  key={stepVal}
                  style={styles.quickStepBtn}
                  onPress={() => setManualSteps(stepVal.toString())}>
                  <Text style={styles.quickStepText}>+{stepVal.toLocaleString()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.actionBtn} onPress={handleAddManualSteps}>
              <Text style={styles.actionBtnText}>ADD STEPS & ACCRUE EXP</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNavBar currentTab="log" />
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
    fontSize: 15,
    fontWeight: 'bold',
    color: '#9bbc0f',
    letterSpacing: 1,
  },
  headerSettingBtn: {
    padding: 4,
  },
  headerSettingText: {
    fontSize: 18,
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: '#0f380f',
    padding: 4,
    justifyContent: 'space-between',
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
  tabText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#8bac0f',
  },
  tabTextActive: {
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
  sectionTitle: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '900',
    color: '#0f380f',
    marginBottom: 4,
  },
  sectionDesc: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#306230',
    marginBottom: 12,
    lineHeight: 16,
  },
  fieldLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0f380f',
    marginTop: 8,
    marginBottom: 4,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    backgroundColor: '#8bac0f',
    borderWidth: 2,
    borderColor: '#0f380f',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  chipActive: {
    backgroundColor: '#0f380f',
  },
  chipText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#0f380f',
    fontWeight: 'bold',
  },
  chipTextActive: {
    color: '#9bbc0f',
  },
  input: {
    backgroundColor: '#8bac0f',
    borderWidth: 2,
    borderColor: '#0f380f',
    borderRadius: 6,
    padding: 8,
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#0f380f',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  actionBtn: {
    backgroundColor: '#0f380f',
    borderWidth: 2,
    borderColor: '#306230',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  actionBtnText: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '900',
    color: '#9bbc0f',
    letterSpacing: 0.5,
  },
  mealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8bac0f',
    borderWidth: 2,
    borderColor: '#0f380f',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  mealIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  mealTitle: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '900',
    color: '#0f380f',
  },
  mealSub: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#306230',
    marginTop: 2,
  },
  mealAction: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0f380f',
  },
  waterStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  waterBox: {
    alignItems: 'center',
    backgroundColor: '#8bac0f',
    borderWidth: 2,
    borderColor: '#0f380f',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  waterCount: {
    fontFamily: 'monospace',
    fontSize: 20,
    fontWeight: '900',
    color: '#0f380f',
  },
  waterLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#306230',
  },
  waterActionBtn: {
    backgroundColor: '#306230',
    borderWidth: 2,
    borderColor: '#0f380f',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  waterActionText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '900',
    color: '#9bbc0f',
  },
  infoPill: {
    backgroundColor: '#8bac0f',
    borderWidth: 2,
    borderColor: '#306230',
    borderRadius: 6,
    padding: 8,
    marginVertical: 8,
  },
  infoPillText: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#0f380f',
    fontWeight: 'bold',
  },
  quickStepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  quickStepBtn: {
    backgroundColor: '#8bac0f',
    borderWidth: 1,
    borderColor: '#0f380f',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  quickStepText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f380f',
  },
});
