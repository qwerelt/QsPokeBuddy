import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TamagotchiPokemon, AppSettings, StreakReward, InventoryItem } from '../types/pokemon';
import {
  getStoredPokemon,
  saveStoredPokemon,
  getStoredSettings,
  getStoredRewards,
  saveStoredRewards,
  getStoredInventory,
  addInventoryItem,
  consumeInventoryItem,
} from '../utils/storage';
import { applyRewardItem } from '../utils/tamagotchiEngine';
import BottomNavBar from '../components/BottomNavBar';

export default function InventoryScreen() {
  const router = useRouter();
  const [pokemon, setPokemon] = useState<TamagotchiPokemon | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [rewards, setRewards] = useState<StreakReward[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const pkm = await getStoredPokemon();
    const sets = await getStoredSettings();
    const rews = await getStoredRewards();
    const inv = await getStoredInventory();
    setPokemon(pkm);
    setSettings(sets);
    setRewards(rews);
    setInventory(inv);
  };

  const handleClaimReward = async (reward: StreakReward) => {
    if (!pokemon) {
      Alert.alert('No Companion', 'Please import or scan a Pokémon companion first.');
      return;
    }

    // 1. Mark reward claimed
    const updatedRewards = rewards.map((r) => (r.id === reward.id ? { ...r, claimed: true } : r));
    setRewards(updatedRewards);
    await saveStoredRewards(updatedRewards);

    // 2. Add item to player inventory
    const updatedInv = await addInventoryItem({
      name: reward.name,
      itemType: reward.itemType,
      description: reward.description,
      quantity: 1,
      source: `${reward.streakRequirement}-Day Streak Milestone`,
      rewardId: reward.id,
    });
    setInventory(updatedInv);

    Alert.alert(
      'Reward Claimed! 🎁',
      `Added 1x ${reward.name} to your Inventory Bag!\n\nYou can use it anytime on ${pokemon.nickname}.`,
      [{ text: 'Great!', onPress: () => {} }]
    );
  };

  const handleUseItem = async (item: InventoryItem) => {
    if (!pokemon) {
      Alert.alert('No Companion', 'Import or select a Pokémon first.');
      return;
    }

    Alert.alert(
      `Use ${item.name}?`,
      `Are you sure you want to use 1x ${item.name} on ${pokemon.nickname}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use Item',
          style: 'default',
          onPress: async () => {
            // Apply effect to Pokémon
            const updatedPokemon = applyRewardItem(pokemon, item.itemType);
            await saveStoredPokemon(updatedPokemon);
            setPokemon(updatedPokemon);

            // Consume 1 item from inventory
            const { updatedInventory } = await consumeInventoryItem(item.itemType);
            setInventory(updatedInventory);

            let feedbackMsg = `Used ${item.name} on ${pokemon.nickname}!`;
            if (item.itemType === 'rare_candy') {
              feedbackMsg = `🎉 Level Up! ${pokemon.nickname} is now Lv. ${updatedPokemon.level}!`;
            } else if (item.itemType === 'leftovers') {
              feedbackMsg = `🍏 ${pokemon.nickname} is now holding Leftovers! Energy decay is prevented!`;
            } else if (item.itemType === 'pp_max') {
              feedbackMsg = `🔋 All move PP and Energy fully restored for ${pokemon.nickname}!`;
            }

            Alert.alert('Item Used!', feedbackMsg);
          },
        },
      ]
    );
  };

  const streakDays = pokemon?.streakDays || 0;
  const unclaimedCount = rewards.filter((r) => !r.claimed && streakDays >= r.streakRequirement).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.push('/pet')}>
          <Text style={styles.backBtnText}>◀ HOME</Text>
        </TouchableOpacity>
        <Text style={styles.title}>INVENTORY & REWARDS</Text>
        <TouchableOpacity style={styles.headerSettingBtn} onPress={() => router.push('/settings')}>
          <Text style={styles.headerSettingText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Streak Header Card */}
        <View style={styles.streakCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.streakLabel}>CURRENT STREAK</Text>
            <Text style={styles.streakValue}>🔥 {streakDays} DAYS</Text>
          </View>
          <View style={styles.badgeBox}>
            <Text style={styles.badgeText}>
              {unclaimedCount > 0 ? `${unclaimedCount} UNCLAIMED` : 'ALL CLAIMED'}
            </Text>
          </View>
        </View>

        {/* --- UNCLAIMED REWARDS SECTION --- */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>MILESTONE REWARDS</Text>
          <Text style={styles.sectionDesc}>
            Unlock rewards by completing streaks, fitness milestones, and healthy habits:
          </Text>

          {rewards.map((r) => {
            const isEligible = streakDays >= r.streakRequirement;
            const canClaim = isEligible && !r.claimed;

            return (
              <View key={r.id} style={[styles.rewardCard, r.claimed && styles.rewardCardClaimed]}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.rewardName, r.claimed && styles.claimedText]}>
                    {r.claimed ? '✓ ' : ''}{r.name}
                  </Text>
                  <Text style={styles.rewardDesc}>{r.description}</Text>
                  <Text style={styles.rewardReq}>
                    {isEligible ? '⭐ Target Met' : `🔒 Requires ${r.streakRequirement}-day streak`}
                  </Text>
                </View>

                <TouchableOpacity
                  disabled={!canClaim}
                  style={[
                    styles.claimBtn,
                    r.claimed && styles.claimBtnClaimed,
                    !isEligible && styles.claimBtnLocked,
                  ]}
                  onPress={() => handleClaimReward(r)}>
                  <Text
                    style={[
                      styles.claimBtnText,
                      r.claimed && styles.claimBtnTextClaimed,
                      !isEligible && styles.claimBtnTextLocked,
                    ]}>
                    {r.claimed ? 'CLAIMED' : canClaim ? 'CLAIM' : 'LOCKED'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* --- INVENTORY BAG SECTION --- */}
        <View style={[styles.card, { marginTop: 12 }]}>
          <Text style={styles.sectionTitle}>🎒 ITEM BAG (INVENTORY)</Text>
          <Text style={styles.sectionDesc}>
            All claimed rewards and items stored in your backpack. Tap to use on {pokemon?.nickname || 'your Pokémon'}:
          </Text>

          {inventory.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Your item bag is empty.</Text>
              <Text style={styles.emptySubText}>
                Claim streak milestone rewards or complete ToDo tasks to earn items!
              </Text>
            </View>
          ) : (
            inventory.map((item) => (
              <View key={item.id} style={styles.invItemCard}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={styles.invItemHeader}>
                    <Text style={styles.invItemName}>{item.name}</Text>
                    <View style={styles.qtyBadge}>
                      <Text style={styles.qtyText}>x{item.quantity}</Text>
                    </View>
                  </View>
                  <Text style={styles.invItemDesc}>{item.description}</Text>
                  <Text style={styles.invItemSource}>Obtained: {item.source}</Text>
                </View>

                <TouchableOpacity style={styles.useBtn} onPress={() => handleUseItem(item)}>
                  <Text style={styles.useBtnText}>USE ITEM</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNavBar currentTab="inventory" />
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
  headerSettingBtn: {
    padding: 4,
  },
  headerSettingText: {
    fontSize: 18,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 24,
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#306230',
    borderWidth: 3,
    borderColor: '#0f380f',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  streakLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#8bac0f',
  },
  streakValue: {
    fontFamily: 'monospace',
    fontSize: 20,
    fontWeight: '900',
    color: '#9bbc0f',
    marginTop: 2,
  },
  badgeBox: {
    backgroundColor: '#0f380f',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  badgeText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9bbc0f',
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
    lineHeight: 15,
  },
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8bac0f',
    borderWidth: 2,
    borderColor: '#0f380f',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  rewardCardClaimed: {
    opacity: 0.6,
    backgroundColor: '#8bac0f',
  },
  rewardName: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '900',
    color: '#0f380f',
  },
  claimedText: {
    textDecorationLine: 'line-through',
  },
  rewardDesc: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#306230',
    marginTop: 2,
  },
  rewardReq: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0f380f',
    marginTop: 4,
  },
  claimBtn: {
    backgroundColor: '#0f380f',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  claimBtnClaimed: {
    backgroundColor: '#306230',
  },
  claimBtnLocked: {
    backgroundColor: '#306230',
    opacity: 0.5,
  },
  claimBtnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '900',
    color: '#9bbc0f',
  },
  claimBtnTextClaimed: {
    color: '#8bac0f',
  },
  claimBtnTextLocked: {
    color: '#8bac0f',
  },
  invItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8bac0f',
    borderWidth: 2,
    borderColor: '#0f380f',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  invItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  invItemName: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '900',
    color: '#0f380f',
  },
  qtyBadge: {
    backgroundColor: '#0f380f',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  qtyText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9bbc0f',
  },
  invItemDesc: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#306230',
    marginTop: 2,
  },
  invItemSource: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0f380f',
    marginTop: 4,
  },
  useBtn: {
    backgroundColor: '#0f380f',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  useBtnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '900',
    color: '#9bbc0f',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#8bac0f',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#306230',
    borderStyle: 'dashed',
  },
  emptyText: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f380f',
  },
  emptySubText: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#306230',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 16,
  },
});
