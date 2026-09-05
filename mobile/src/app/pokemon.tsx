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
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { TamagotchiPokemon, AppSettings } from '../types/pokemon';
import {
  getStoredPokemon,
  saveStoredPokemon,
  getStoredPokemonRoster,
  switchActivePokemon,
  getStoredSettings,
} from '../utils/storage';
import {
  getEvolutionChainForSpecies,
  getLevelUpMovesForSpecies,
  EvolutionNode,
  LevelUpMoveItem,
} from '../utils/pkmParser';
import BottomNavBar from '../components/BottomNavBar';

export default function PokemonStatsScreen() {
  const router = useRouter();
  const [pokemon, setPokemon] = useState<TamagotchiPokemon | null>(null);
  const [roster, setRoster] = useState<TamagotchiPokemon[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Evolution & moveset state
  const [evoChain, setEvoChain] = useState<EvolutionNode[]>([]);
  const [selectedEvoSpeciesId, setSelectedEvoSpeciesId] = useState<number | null>(null);
  const [selectedMoveset, setSelectedMoveset] = useState<LevelUpMoveItem[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const pkm = await getStoredPokemon();
    const loadedRoster = await getStoredPokemonRoster();
    const sets = await getStoredSettings();

    setPokemon(pkm);
    setRoster(loadedRoster);
    setSettings(sets);

    if (pkm) {
      const chain = getEvolutionChainForSpecies(pkm.speciesId);
      setEvoChain(chain);
      setSelectedEvoSpeciesId(pkm.speciesId);
      const moves = getLevelUpMovesForSpecies(pkm.speciesId, pkm.generation || 4);
      setSelectedMoveset(moves);
    }
  };

  const handleSelectEvolutionStage = (node: EvolutionNode) => {
    setSelectedEvoSpeciesId(node.id);
    const moves = getLevelUpMovesForSpecies(node.id, pokemon?.generation || 4);
    setSelectedMoveset(moves);
  };

  const handleSwitchActive = async (p: TamagotchiPokemon) => {
    await switchActivePokemon(p);
    setPokemon(p);

    const chain = getEvolutionChainForSpecies(p.speciesId);
    setEvoChain(chain);
    setSelectedEvoSpeciesId(p.speciesId);
    const moves = getLevelUpMovesForSpecies(p.speciesId, p.generation || 4);
    setSelectedMoveset(moves);

    Alert.alert('Companion Switched!', `${p.nickname} (${p.speciesName}) is now your active companion!`);
  };

  if (!pokemon) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>POKÉMON</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Pokémon Found</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/')}>
            <Text style={styles.primaryBtnText}>IMPORT FROM WEBAPP</Text>
          </TouchableOpacity>
        </View>
        <BottomNavBar currentTab="pokemon" />
      </SafeAreaView>
    );
  }

  // Calculate Delta Gains Since Transfer
  const baseline = pokemon.baseline || {
    transferredAtTimestamp: pokemon.lastActiveTimestamp || Date.now(),
    initialLevel: pokemon.level,
    initialExp: pokemon.exp,
    initialFriendship: pokemon.friendship,
    initialEvs: { ...pokemon.evs },
    initialTotalSteps: 0,
  };

  const deltaLevel = Math.max(0, pokemon.level - baseline.initialLevel);
  const deltaExp = Math.max(0, pokemon.exp - baseline.initialExp);
  const deltaFriendship = Math.max(0, pokemon.friendship - baseline.initialFriendship);
  const deltaSteps = Math.max(0, (pokemon.totalSteps || 0) - (baseline.initialTotalSteps || 0));

  const deltaEvs = {
    hp: Math.max(0, (pokemon.evs.hp || 0) - (baseline.initialEvs?.hp || 0)),
    attack: Math.max(0, (pokemon.evs.attack || 0) - (baseline.initialEvs?.attack || 0)),
    defense: Math.max(0, (pokemon.evs.defense || 0) - (baseline.initialEvs?.defense || 0)),
    specialAttack: Math.max(0, (pokemon.evs.specialAttack || 0) - (baseline.initialEvs?.specialAttack || 0)),
    specialDefense: Math.max(0, (pokemon.evs.specialDefense || 0) - (baseline.initialEvs?.specialDefense || 0)),
    speed: Math.max(0, (pokemon.evs.speed || 0) - (baseline.initialEvs?.speed || 0)),
  };

  const totalEvGain = Object.values(deltaEvs).reduce((a, b) => a + b, 0);

  // Sprite URL
  const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/${pokemon.isShiny ? 'shiny/' : ''}${pokemon.speciesId}.png`;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.push('/pet')}>
          <Text style={styles.backBtnText}>◀ HOME</Text>
        </TouchableOpacity>
        <Text style={styles.title}>POKÉMON STATS & MOVES</Text>
        <TouchableOpacity style={styles.headerSettingBtn} onPress={() => router.push('/settings')}>
          <Text style={styles.headerSettingText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Active Pokémon Summary Card */}
        <View style={styles.pokemonHeroCard}>
          <Image source={{ uri: spriteUrl }} style={styles.pokemonSprite} contentFit="contain" />
          <View style={{ flex: 1 }}>
            <View style={styles.heroTitleRow}>
              <Text style={styles.pokemonNickname}>{pokemon.nickname.toUpperCase()}</Text>
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>Lv. {pokemon.level}</Text>
              </View>
            </View>
            <Text style={styles.speciesName}>{pokemon.speciesName} • Gen {pokemon.generation || 4}</Text>

            {/* Types */}
            <View style={styles.typeBadgeRow}>
              {pokemon.types.map((t) => (
                <View key={t} style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{t.toUpperCase()}</Text>
                </View>
              ))}
              {pokemon.isRested ? (
                <View style={[styles.typeBadge, styles.restedBadge]}>
                  <Text style={[styles.typeBadgeText, styles.restedBadgeText]}>⚡ RESTED 2X</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.friendshipText}>
              ❤️ Friendship: {pokemon.friendship}/255 • Energy: {pokemon.energy}%
            </Text>
          </View>
        </View>

        {/* --- GAINS SINCE TRANSFER CARD --- */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>📈 GAINS SINCE TRANSFER</Text>
            <View style={styles.transferBadge}>
              <Text style={styles.transferBadgeText}>INITIAL BASELINE</Text>
            </View>
          </View>
          <Text style={styles.sectionDesc}>
            Tracking growth and real-world fitness progress since transferring to Q's Poke Buddy:
          </Text>

          <View style={styles.gainGrid}>
            <View style={styles.gainBox}>
              <Text style={styles.gainVal}>+{deltaLevel}</Text>
              <Text style={styles.gainLabel}>LEVELS GAINED</Text>
              <Text style={styles.gainBaseline}>From Lv. {baseline.initialLevel}</Text>
            </View>

            <View style={styles.gainBox}>
              <Text style={styles.gainVal}>+{deltaExp.toLocaleString()}</Text>
              <Text style={styles.gainLabel}>EXP ACCRUED</Text>
              <Text style={styles.gainBaseline}>Passive & Walk</Text>
            </View>

            <View style={styles.gainBox}>
              <Text style={styles.gainVal}>+{deltaFriendship}</Text>
              <Text style={styles.gainLabel}>HEARTS GAINED</Text>
              <Text style={styles.gainBaseline}>From {baseline.initialFriendship}</Text>
            </View>

            <View style={styles.gainBox}>
              <Text style={styles.gainVal}>+{deltaSteps.toLocaleString()}</Text>
              <Text style={styles.gainLabel}>STEPS TOGETHER</Text>
              <Text style={styles.gainBaseline}>Health Connect</Text>
            </View>
          </View>

          {/* EV Gains Breakdown */}
          <Text style={[styles.fieldLabel, { marginTop: 10 }]}>EFFORT VALUES (EV) GAINED (+{totalEvGain} TOTAL)</Text>
          <View style={styles.evGainGrid}>
            <View style={styles.evGainItem}>
              <Text style={styles.evStatName}>HP</Text>
              <Text style={styles.evStatVal}>{pokemon.evs.hp}/252</Text>
              <Text style={styles.evStatDelta}>(+{deltaEvs.hp})</Text>
            </View>
            <View style={styles.evGainItem}>
              <Text style={styles.evStatName}>ATK</Text>
              <Text style={styles.evStatVal}>{pokemon.evs.attack}/252</Text>
              <Text style={styles.evStatDelta}>(+{deltaEvs.attack})</Text>
            </View>
            <View style={styles.evGainItem}>
              <Text style={styles.evStatName}>DEF</Text>
              <Text style={styles.evStatVal}>{pokemon.evs.defense}/252</Text>
              <Text style={styles.evStatDelta}>(+{deltaEvs.defense})</Text>
            </View>
            <View style={styles.evGainItem}>
              <Text style={styles.evStatName}>SP.ATK</Text>
              <Text style={styles.evStatVal}>{pokemon.evs.specialAttack}/252</Text>
              <Text style={styles.evStatDelta}>(+{deltaEvs.specialAttack})</Text>
            </View>
            <View style={styles.evGainItem}>
              <Text style={styles.evStatName}>SP.DEF</Text>
              <Text style={styles.evStatVal}>{pokemon.evs.specialDefense}/252</Text>
              <Text style={styles.evStatDelta}>(+{deltaEvs.specialDefense})</Text>
            </View>
            <View style={styles.evGainItem}>
              <Text style={styles.evStatName}>SPD</Text>
              <Text style={styles.evStatVal}>{pokemon.evs.speed}/252</Text>
              <Text style={styles.evStatDelta}>(+{deltaEvs.speed})</Text>
            </View>
          </View>
        </View>

        {/* --- SELECT ACTIVE POKÉMON / MULTI-ROSTER CARD --- */}
        <View style={[styles.card, { marginTop: 12 }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>🐾 POKÉMON ROSTER & STORAGE</Text>
            <TouchableOpacity style={styles.importBtn} onPress={() => router.push('/')}>
              <Text style={styles.importBtnText}>+ IMPORT QR</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionDesc}>
            Manage your companion roster. Tap any Pokémon to make it your active buddy:
          </Text>

          {roster.map((p, idx) => {
            const isActive = p.speciesId === pokemon.speciesId && p.nickname === pokemon.nickname;
            const pSprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/${p.isShiny ? 'shiny/' : ''}${p.speciesId}.png`;

            return (
              <TouchableOpacity
                key={`${p.speciesId}-${p.nickname}-${idx}`}
                style={[styles.rosterCard, isActive && styles.rosterCardActive]}
                onPress={() => handleSwitchActive(p)}>
                <Image source={{ uri: pSprite }} style={styles.rosterSprite} contentFit="contain" />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.rosterName}>{p.nickname}</Text>
                    <Text style={styles.rosterLevel}>Lv. {p.level}</Text>
                  </View>
                  <Text style={styles.rosterSub}>{p.speciesName} • {p.types.join('/')}</Text>
                </View>
                <View style={[styles.rosterPill, isActive && styles.rosterPillActive]}>
                  <Text style={[styles.rosterPillText, isActive && styles.rosterPillTextActive]}>
                    {isActive ? 'ACTIVE' : 'SELECT'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* --- EVOLUTION CHAIN & LEVEL-UP MOVES --- */}
        <View style={[styles.card, { marginTop: 12 }]}>
          <Text style={styles.sectionTitle}>🧬 EVOLUTIONS & LEVEL-UP MOVES</Text>
          <Text style={styles.sectionDesc}>
            Inspect all level-up moves for {pokemon.nickname} and all evolutionary forms:
          </Text>

          {/* Evolution Tabs */}
          <View style={styles.evoTabRow}>
            {evoChain.map((node) => {
              const isSel = selectedEvoSpeciesId === node.id;
              const isCurrent = node.id === pokemon.speciesId;
              return (
                <TouchableOpacity
                  key={node.id}
                  style={[styles.evoTab, isSel && styles.evoTabActive]}
                  onPress={() => handleSelectEvolutionStage(node)}>
                  <Text style={[styles.evoTabText, isSel && styles.evoTabTextActive]}>
                    {node.speciesName} {isCurrent ? '★' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Moveset Table */}
          <Text style={styles.fieldLabel}>LEARNABLE MOVES BY LEVEL</Text>
          <View style={styles.movesTable}>
            <View style={styles.movesHeaderRow}>
              <Text style={[styles.moveHeadCol, { width: 36 }]}>LVL</Text>
              <Text style={[styles.moveHeadCol, { flex: 1 }]}>MOVE NAME</Text>
              <Text style={[styles.moveHeadCol, { width: 60 }]}>TYPE</Text>
              <Text style={[styles.moveHeadCol, { width: 36 }]}>PWR</Text>
              <Text style={[styles.moveHeadCol, { width: 36 }]}>ACC</Text>
              <Text style={[styles.moveHeadCol, { width: 32 }]}>PP</Text>
            </View>

            {selectedMoveset.length === 0 ? (
              <Text style={styles.noMovesText}>No level-up moves recorded for this form.</Text>
            ) : (
              selectedMoveset.map((m, idx) => {
                const isAlreadyLearned = m.level <= pokemon.level && selectedEvoSpeciesId === pokemon.speciesId;
                return (
                  <View key={`${m.level}-${m.moveId}-${idx}`} style={[styles.moveRow, isAlreadyLearned && styles.moveRowLearned]}>
                    <Text style={[styles.moveCol, { width: 36, fontWeight: '900' }]}>{m.level}</Text>
                    <Text style={[styles.moveCol, { flex: 1, fontWeight: 'bold' }]} numberOfLines={1}>
                      {m.name}
                    </Text>
                    <Text style={[styles.moveCol, { width: 60, fontSize: 9 }]}>{m.type.toUpperCase()}</Text>
                    <Text style={[styles.moveCol, { width: 36 }]}>{m.power || '--'}</Text>
                    <Text style={[styles.moveCol, { width: 36 }]}>{m.accuracy ? `${m.accuracy}%` : '--'}</Text>
                    <Text style={[styles.moveCol, { width: 32 }]}>{m.pp}</Text>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNavBar currentTab="pokemon" />
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f380f',
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: '#0f380f',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  primaryBtnText: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '900',
    color: '#9bbc0f',
  },
  pokemonHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#306230',
    borderWidth: 3,
    borderColor: '#0f380f',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  pokemonSprite: {
    width: 80,
    height: 80,
    marginRight: 10,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pokemonNickname: {
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '900',
    color: '#9bbc0f',
  },
  levelBadge: {
    backgroundColor: '#0f380f',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  levelBadgeText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#9bbc0f',
  },
  speciesName: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#8bac0f',
    marginTop: 1,
  },
  typeBadgeRow: {
    flexDirection: 'row',
    gap: 4,
    marginVertical: 4,
  },
  typeBadge: {
    backgroundColor: '#0f380f',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#9bbc0f',
  },
  restedBadge: {
    backgroundColor: '#8bac0f',
  },
  restedBadgeText: {
    color: '#0f380f',
  },
  friendshipText: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#9bbc0f',
    marginTop: 2,
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
  sectionTitle: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '900',
    color: '#0f380f',
  },
  sectionDesc: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#306230',
    marginBottom: 8,
    lineHeight: 14,
  },
  transferBadge: {
    backgroundColor: '#0f380f',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  transferBadgeText: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#9bbc0f',
  },
  gainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  gainBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#8bac0f',
    borderWidth: 2,
    borderColor: '#0f380f',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
  },
  gainVal: {
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '900',
    color: '#0f380f',
  },
  gainLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#306230',
    marginTop: 1,
  },
  gainBaseline: {
    fontFamily: 'monospace',
    fontSize: 8,
    color: '#0f380f',
    marginTop: 2,
  },
  fieldLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '900',
    color: '#0f380f',
    marginBottom: 4,
  },
  evGainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  evGainItem: {
    width: '31%',
    backgroundColor: '#8bac0f',
    borderWidth: 1,
    borderColor: '#0f380f',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  evStatName: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#306230',
  },
  evStatVal: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '900',
    color: '#0f380f',
  },
  evStatDelta: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0f380f',
  },
  importBtn: {
    backgroundColor: '#0f380f',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  importBtnText: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '900',
    color: '#9bbc0f',
  },
  rosterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8bac0f',
    borderWidth: 2,
    borderColor: '#0f380f',
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
  },
  rosterCardActive: {
    backgroundColor: '#306230',
  },
  rosterSprite: {
    width: 44,
    height: 44,
    marginRight: 8,
  },
  rosterName: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '900',
    color: '#0f380f',
  },
  rosterLevel: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#306230',
  },
  rosterSub: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#306230',
    marginTop: 2,
  },
  rosterPill: {
    backgroundColor: '#0f380f',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rosterPillActive: {
    backgroundColor: '#9bbc0f',
  },
  rosterPillText: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#9bbc0f',
  },
  rosterPillTextActive: {
    color: '#0f380f',
  },
  evoTabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  evoTab: {
    backgroundColor: '#8bac0f',
    borderWidth: 1,
    borderColor: '#0f380f',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  evoTabActive: {
    backgroundColor: '#0f380f',
  },
  evoTabText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f380f',
  },
  evoTabTextActive: {
    color: '#9bbc0f',
  },
  movesTable: {
    borderWidth: 2,
    borderColor: '#0f380f',
    borderRadius: 6,
    overflow: 'hidden',
  },
  movesHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#0f380f',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  moveHeadCol: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '900',
    color: '#9bbc0f',
  },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8bac0f',
    borderBottomWidth: 1,
    borderBottomColor: '#306230',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  moveRowLearned: {
    backgroundColor: '#9bbc0f',
  },
  moveCol: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#0f380f',
  },
  noMovesText: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#306230',
    padding: 8,
    textAlign: 'center',
  },
});
