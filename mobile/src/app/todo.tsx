import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TamagotchiPokemon, AppSettings, TaskItem, PokemonEVs } from '../types/pokemon';
import {
  getStoredPokemon,
  saveStoredPokemon,
  getStoredSettings,
  getStoredTasks,
  saveStoredTasks,
  addInventoryItem,
} from '../utils/storage';
import { completeTaskReward } from '../utils/tamagotchiEngine';
import BottomNavBar from '../components/BottomNavBar';

export default function ToDoScreen() {
  const router = useRouter();
  const [pokemon, setPokemon] = useState<TamagotchiPokemon | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  // Filter states
  const [dayFilter, setDayFilter] = useState<'all' | 'today' | 'upcoming'>('today');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [rewardFilter, setRewardFilter] = useState<string>('All');

  // Add / Edit Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskItem['category']>('Study');
  const [repeatType, setRepeatType] = useState<TaskItem['repeatType']>('daily');
  const [rewardType, setRewardType] = useState<TaskItem['rewardType']>('exp');
  const [expAmount, setExpAmount] = useState('200');
  const [friendshipAmount, setFriendshipAmount] = useState('2');
  const [evStat, setEvStat] = useState<keyof PokemonEVs>('attack');
  const [evAmount, setEvAmount] = useState('6');
  const [itemType, setItemType] = useState('rare_candy');
  const [streakRewardEnabled, setStreakRewardEnabled] = useState(true);
  const [streakRewardItem, setStreakRewardItem] = useState('Rare Candy');

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const pkm = await getStoredPokemon();
    const sets = await getStoredSettings();
    const loadedTasks = await getStoredTasks();
    setPokemon(pkm);
    setSettings(sets);
    setTasks(loadedTasks);
  };

  const handleOpenAdd = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setCategory('Study');
    setRepeatType('daily');
    setRewardType('exp');
    setExpAmount('200');
    setFriendshipAmount('2');
    setEvStat('attack');
    setEvAmount('6');
    setItemType('rare_candy');
    setStreakRewardEnabled(true);
    setStreakRewardItem('Rare Candy');
    setModalVisible(true);
  };

  const handleOpenEdit = (task: TaskItem) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setCategory(task.category);
    setRepeatType(task.repeatType);
    setRewardType(task.rewardType);
    setExpAmount((task.rewardConfig.expAmount || 200).toString());
    setFriendshipAmount((task.rewardConfig.friendshipAmount || 2).toString());
    setEvStat(task.rewardConfig.evStat || 'attack');
    setEvAmount((task.rewardConfig.evAmount || 6).toString());
    setItemType(task.rewardConfig.itemType || 'rare_candy');
    setStreakRewardEnabled(task.streakRewardEnabled);
    setStreakRewardItem(task.streakRewardItem || 'Rare Candy');
    setModalVisible(true);
  };

  const handleSaveTask = async () => {
    if (!title.trim()) {
      Alert.alert('Task Title Required', 'Please enter a name for the task.');
      return;
    }

    const newTask: TaskItem = {
      id: editingTask ? editingTask.id : `task-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      category,
      repeatType,
      targetDate: todayStr,
      rewardType,
      rewardConfig: {
        expAmount: rewardType === 'exp' ? parseInt(expAmount, 10) || 100 : undefined,
        friendshipAmount: rewardType === 'friendship' ? parseInt(friendshipAmount, 10) || 1 : undefined,
        evStat: rewardType === 'ev' ? evStat : undefined,
        evAmount: rewardType === 'ev' ? parseInt(evAmount, 10) || 4 : undefined,
        itemType: rewardType === 'item' ? itemType : undefined,
      },
      streakRewardEnabled,
      streakRewardItem: streakRewardEnabled ? streakRewardItem : undefined,
      currentStreak: editingTask ? editingTask.currentStreak : 0,
      completedDates: editingTask ? editingTask.completedDates : [],
      createdAt: editingTask ? editingTask.createdAt : Date.now(),
    };

    let updatedList = [...tasks];
    if (editingTask) {
      updatedList = updatedList.map((t) => (t.id === editingTask.id ? newTask : t));
    } else {
      updatedList.unshift(newTask);
    }

    setTasks(updatedList);
    await saveStoredTasks(updatedList);
    setModalVisible(false);
  };

  const handleDeleteTask = async (taskId: string) => {
    Alert.alert('Delete Task?', 'Are you sure you want to delete this task?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = tasks.filter((t) => t.id !== taskId);
          setTasks(updated);
          await saveStoredTasks(updated);
        },
      },
    ]);
  };

  const handleToggleTask = async (task: TaskItem) => {
    if (!pokemon || !settings) {
      Alert.alert('No Companion', 'Scan or import a Pokémon companion first.');
      return;
    }

    const isCompletedToday = task.completedDates.includes(todayStr);

    if (isCompletedToday) {
      // Uncheck
      const updatedDates = task.completedDates.filter((d) => d !== todayStr);
      const updatedTask = {
        ...task,
        completedDates: updatedDates,
        currentStreak: Math.max(0, task.currentStreak - 1),
      };
      const updatedList = tasks.map((t) => (t.id === task.id ? updatedTask : t));
      setTasks(updatedList);
      await saveStoredTasks(updatedList);
    } else {
      // Complete Task & Award Rewards!
      const updatedDates = [...task.completedDates, todayStr];
      const newStreak = task.currentStreak + 1;
      const updatedTask = {
        ...task,
        completedDates: updatedDates,
        currentStreak: newStreak,
      };

      const { updatedPokemon, expGained, friendshipGained, evGains, leveledUp } = completeTaskReward(
        pokemon,
        task,
        settings
      );

      // Handle item reward
      if (task.rewardType === 'item' && task.rewardConfig.itemType) {
        await addInventoryItem({
          name: task.rewardConfig.itemType.replace('_', ' ').toUpperCase(),
          itemType: task.rewardConfig.itemType,
          description: `Reward for completing "${task.title}"`,
          quantity: 1,
          source: `Task: ${task.title}`,
        });
      }

      // Handle streak milestone item reward
      let streakItemMessage = '';
      if (task.streakRewardEnabled && task.streakRewardItem && newStreak % 3 === 0) {
        await addInventoryItem({
          name: task.streakRewardItem,
          itemType: task.streakRewardItem.toLowerCase().replace(/ /g, '_'),
          description: `Reward for keeping a ${newStreak}-day streak on "${task.title}"`,
          quantity: 1,
          source: `${newStreak}-Day Task Streak`,
        });
        streakItemMessage = `\n🎁 Streak Milestone Item: 1x ${task.streakRewardItem} added to Inventory!`;
      }

      await saveStoredPokemon(updatedPokemon);
      setPokemon(updatedPokemon);

      const updatedList = tasks.map((t) => (t.id === task.id ? updatedTask : t));
      setTasks(updatedList);
      await saveStoredTasks(updatedList);

      const evSummary = Object.entries(evGains)
        .map(([k, v]) => `+${v} ${k.toUpperCase()} EV`)
        .join(', ');

      Alert.alert(
        'Task Completed! ⭐',
        `Great job on "${task.title}"! 🔥 Streak: ${newStreak} days\n` +
          (expGained > 0 ? `• EXP: +${expGained}\n` : '') +
          (friendshipGained > 0 ? `• Friendship: +${friendshipGained} Hearts\n` : '') +
          (evSummary ? `• EVs: ${evSummary}\n` : '') +
          streakItemMessage +
          (leveledUp ? `\n🎉 ${pokemon.nickname} leveled up to Lv. ${updatedPokemon.level}!` : '')
      );
    }
  };

  // Filter logic
  const filteredTasks = tasks.filter((t) => {
    // Day filter
    const isDoneToday = t.completedDates.includes(todayStr);
    if (dayFilter === 'today' && t.repeatType === 'once' && isDoneToday) {
      // show completed one-time tasks on today
    }
    // Category filter
    if (categoryFilter !== 'All' && t.category !== categoryFilter) {
      return false;
    }
    // Reward filter
    if (rewardFilter !== 'All' && t.rewardType.toLowerCase() !== rewardFilter.toLowerCase()) {
      return false;
    }
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.push('/pet')}>
          <Text style={styles.backBtnText}>◀ HOME</Text>
        </TouchableOpacity>
        <Text style={styles.title}>TODO & HABIT TRACKER</Text>
        <TouchableOpacity style={styles.addTaskHeaderBtn} onPress={handleOpenAdd}>
          <Text style={styles.addTaskHeaderText}>+ NEW</Text>
        </TouchableOpacity>
      </View>

      {/* Date Filter Bar */}
      <View style={styles.filterBar}>
        {(['today', 'upcoming', 'all'] as const).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[styles.filterTab, dayFilter === mode && styles.filterTabActive]}
            onPress={() => setDayFilter(mode)}>
            <Text style={[styles.filterTabText, dayFilter === mode && styles.filterTabTextActive]}>
              {mode.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Secondary Category & Reward Filter Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        {['All', 'Study', 'Fitness', 'Health', 'Work', 'Chores', 'Habit'].map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.catPill, categoryFilter === cat && styles.catPillActive]}
            onPress={() => setCategoryFilter(cat)}>
            <Text style={[styles.catPillText, categoryFilter === cat && styles.catPillTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tasks List */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {filteredTasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>No tasks found</Text>
            <Text style={styles.emptySubtitle}>
              Tap "+ NEW" above to add a custom daily habit, homework, or fitness task!
            </Text>
            <TouchableOpacity style={styles.primaryAddBtn} onPress={handleOpenAdd}>
              <Text style={styles.primaryAddBtnText}>+ ADD CUSTOM TASK</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredTasks.map((task) => {
            const isDoneToday = task.completedDates.includes(todayStr);

            let rewardBadgeText = '';
            if (task.rewardType === 'exp') rewardBadgeText = `+${task.rewardConfig.expAmount || 100} EXP`;
            else if (task.rewardType === 'friendship') rewardBadgeText = `+${task.rewardConfig.friendshipAmount || 1} Heart`;
            else if (task.rewardType === 'ev') rewardBadgeText = `+${task.rewardConfig.evAmount || 4} ${task.rewardConfig.evStat?.toUpperCase()} EV`;
            else if (task.rewardType === 'item') rewardBadgeText = `🎁 ${task.rewardConfig.itemType}`;

            return (
              <View key={task.id} style={[styles.taskCard, isDoneToday && styles.taskCardCompleted]}>
                {/* Checkbox */}
                <TouchableOpacity
                  style={[styles.checkbox, isDoneToday && styles.checkboxActive]}
                  onPress={() => handleToggleTask(task)}>
                  <Text style={styles.checkIcon}>{isDoneToday ? '✓' : ''}</Text>
                </TouchableOpacity>

                {/* Content */}
                <TouchableOpacity
                  style={{ flex: 1, marginHorizontal: 8 }}
                  onPress={() => handleOpenEdit(task)}>
                  <Text style={[styles.taskTitle, isDoneToday && styles.taskTitleCompleted]}>
                    {task.title}
                  </Text>
                  {task.description ? (
                    <Text style={styles.taskDesc} numberOfLines={2}>
                      {task.description}
                    </Text>
                  ) : null}

                  {/* Metadata Badges */}
                  <View style={styles.metaRow}>
                    <View style={styles.badgeCategory}>
                      <Text style={styles.badgeCategoryText}>{task.category}</Text>
                    </View>
                    <View style={styles.badgeReward}>
                      <Text style={styles.badgeRewardText}>{rewardBadgeText}</Text>
                    </View>
                    {task.currentStreak > 0 ? (
                      <View style={styles.badgeStreak}>
                        <Text style={styles.badgeStreakText}>🔥 {task.currentStreak}d</Text>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>

                {/* Delete / Actions */}
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteTask(task.id)}>
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* --- MODAL: ADD / EDIT TASK --- */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingTask ? 'EDIT TASK' : 'NEW CUSTOM TASK'}</Text>

            <ScrollView style={{ maxHeight: 380 }}>
              <Text style={styles.modalLabel}>TASK TITLE</Text>
              <TextInput
                style={styles.modalInput}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Finish homework, Read 20m, Drink water"
                placeholderTextColor="#5a7810"
              />

              <Text style={styles.modalLabel}>DESCRIPTION (OPTIONAL)</Text>
              <TextInput
                style={styles.modalInput}
                value={description}
                onChangeText={setDescription}
                placeholder="Details or notes..."
                placeholderTextColor="#5a7810"
              />

              <Text style={styles.modalLabel}>CATEGORY TAG</Text>
              <View style={styles.modalChipRow}>
                {(['Study', 'Fitness', 'Health', 'Work', 'Chores', 'Habit'] as const).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.modalChip, category === cat && styles.modalChipActive]}
                    onPress={() => setCategory(cat)}>
                    <Text style={[styles.modalChipText, category === cat && styles.modalChipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>REPEAT FREQUENCY</Text>
              <View style={styles.modalChipRow}>
                {[
                  { id: 'daily', label: 'Daily' },
                  { id: 'weekdays', label: 'Weekdays' },
                  { id: 'weekends', label: 'Weekends' },
                  { id: 'once', label: 'One Time' },
                ].map((rep) => (
                  <TouchableOpacity
                    key={rep.id}
                    style={[styles.modalChip, repeatType === rep.id && styles.modalChipActive]}
                    onPress={() => setRepeatType(rep.id as TaskItem['repeatType'])}>
                    <Text style={[styles.modalChipText, repeatType === rep.id && styles.modalChipTextActive]}>
                      {rep.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>COMPLETION REWARD</Text>
              <View style={styles.modalChipRow}>
                {[
                  { id: 'exp', label: '✨ EXP' },
                  { id: 'ev', label: '⚡ EV Stats' },
                  { id: 'friendship', label: '❤️ Friendship' },
                  { id: 'item', label: '🎁 Item' },
                ].map((rew) => (
                  <TouchableOpacity
                    key={rew.id}
                    style={[styles.modalChip, rewardType === rew.id && styles.modalChipActive]}
                    onPress={() => setRewardType(rew.id as TaskItem['rewardType'])}>
                    <Text style={[styles.modalChipText, rewardType === rew.id && styles.modalChipTextActive]}>
                      {rew.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {rewardType === 'exp' && (
                <View>
                  <Text style={styles.modalSubLabel}>EXP Amount:</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="numeric"
                    value={expAmount}
                    onChangeText={setExpAmount}
                  />
                </View>
              )}

              {rewardType === 'ev' && (
                <View>
                  <Text style={styles.modalSubLabel}>Target EV Stat:</Text>
                  <View style={styles.modalChipRow}>
                    {(['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed'] as const).map(
                      (stat) => (
                        <TouchableOpacity
                          key={stat}
                          style={[styles.modalChip, evStat === stat && styles.modalChipActive]}
                          onPress={() => setEvStat(stat)}>
                          <Text style={[styles.modalChipText, evStat === stat && styles.modalChipTextActive]}>
                            {stat.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                  <Text style={styles.modalSubLabel}>EV Amount (+):</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="numeric"
                    value={evAmount}
                    onChangeText={setEvAmount}
                  />
                </View>
              )}

              {rewardType === 'friendship' && (
                <View>
                  <Text style={styles.modalSubLabel}>Friendship Hearts (+):</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="numeric"
                    value={friendshipAmount}
                    onChangeText={setFriendshipAmount}
                  />
                </View>
              )}

              {rewardType === 'item' && (
                <View>
                  <Text style={styles.modalSubLabel}>Item Reward:</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={itemType}
                    onChangeText={setItemType}
                    placeholder="rare_candy, protein, carbos..."
                  />
                </View>
              )}

              {/* Streak Milestone Rewards */}
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setStreakRewardEnabled(!streakRewardEnabled)}>
                <Text style={styles.modalLabel}>ENABLE STREAK MILESTONE ITEM (Every 3 Days)</Text>
                <Text style={styles.toggleCheck}>{streakRewardEnabled ? '☑' : '☐'}</Text>
              </TouchableOpacity>

              {streakRewardEnabled && (
                <TextInput
                  style={styles.modalInput}
                  value={streakRewardItem}
                  onChangeText={setStreakRewardItem}
                  placeholder="e.g. Rare Candy, Protein, Carbos"
                  placeholderTextColor="#5a7810"
                />
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveTask}>
                <Text style={styles.modalSaveBtnText}>SAVE TASK</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bottom Navigation */}
      <BottomNavBar currentTab="todo" />
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
    fontSize: 14,
    fontWeight: 'bold',
    color: '#9bbc0f',
    letterSpacing: 1,
  },
  addTaskHeaderBtn: {
    backgroundColor: '#8bac0f',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  addTaskHeaderText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '900',
    color: '#0f380f',
  },
  filterBar: {
    flexDirection: 'row',
    backgroundColor: '#0f380f',
    padding: 4,
  },
  filterTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 4,
    marginHorizontal: 2,
  },
  filterTabActive: {
    backgroundColor: '#8bac0f',
  },
  filterTabText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#8bac0f',
  },
  filterTabTextActive: {
    color: '#0f380f',
  },
  categoryScroll: {
    maxHeight: 40,
    backgroundColor: '#306230',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  catPill: {
    backgroundColor: '#0f380f',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
  },
  catPillActive: {
    backgroundColor: '#8bac0f',
  },
  catPillText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9bbc0f',
  },
  catPillTextActive: {
    color: '#0f380f',
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 24,
  },
  emptyCard: {
    backgroundColor: '#9bbc0f',
    borderWidth: 3,
    borderColor: '#0f380f',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '900',
    color: '#0f380f',
  },
  emptySubtitle: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#306230',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 16,
  },
  primaryAddBtn: {
    backgroundColor: '#0f380f',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  primaryAddBtnText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '900',
    color: '#9bbc0f',
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9bbc0f',
    borderWidth: 2,
    borderColor: '#0f380f',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    shadowColor: '#0f380f',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  taskCardCompleted: {
    opacity: 0.65,
    backgroundColor: '#8bac0f',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#0f380f',
    backgroundColor: '#8bac0f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#0f380f',
  },
  checkIcon: {
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '900',
    color: '#9bbc0f',
  },
  taskTitle: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '900',
    color: '#0f380f',
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
  },
  taskDesc: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#306230',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  badgeCategory: {
    backgroundColor: '#0f380f',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeCategoryText: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#9bbc0f',
  },
  badgeReward: {
    backgroundColor: '#306230',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeRewardText: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#9bbc0f',
  },
  badgeStreak: {
    backgroundColor: '#8bac0f',
    borderWidth: 1,
    borderColor: '#0f380f',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeStreakText: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0f380f',
  },
  deleteBtn: {
    padding: 6,
  },
  deleteBtnText: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f380f',
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
    fontSize: 14,
    fontWeight: '900',
    color: '#0f380f',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0f380f',
    marginTop: 8,
    marginBottom: 4,
  },
  modalSubLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#306230',
    marginTop: 4,
    marginBottom: 2,
  },
  modalInput: {
    backgroundColor: '#8bac0f',
    borderWidth: 2,
    borderColor: '#0f380f',
    borderRadius: 6,
    padding: 8,
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#0f380f',
    fontWeight: 'bold',
  },
  modalChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  modalChip: {
    backgroundColor: '#8bac0f',
    borderWidth: 1,
    borderColor: '#0f380f',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  modalChipActive: {
    backgroundColor: '#0f380f',
  },
  modalChipText: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#0f380f',
    fontWeight: 'bold',
  },
  modalChipTextActive: {
    color: '#9bbc0f',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  toggleCheck: {
    fontSize: 20,
    color: '#0f380f',
    fontWeight: 'bold',
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
  },
  modalCancelBtnText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#8bac0f',
  },
});
