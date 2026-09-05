import baseStatsData from '../../sources/base_stats.json';
import movesData from '../../sources/moves.json';
import movesetsData from '../../sources/movesets.json';
import evolutionsData from '../../sources/evolutions.json';
import { TamagotchiPokemon, PokemonStats, PokemonEVs, PokemonIVs, MoveData } from '../types/pokemon';

// Typecasts for JSON sources
const baseStatsMap = baseStatsData as Record<string, any>;
const movesMap = movesData as Record<string, any>;
const movesetsMap = movesetsData as Record<string, any>;
const evolutionsMap = evolutionsData as Record<string, any>;

export function getBaseStats(speciesId: number) {
  return baseStatsMap[speciesId.toString()] || baseStatsMap['25'];
}

export function getMoveById(moveId: number): MoveData {
  const m = movesMap[moveId.toString()];
  if (m) {
    return {
      id: m.id,
      name: m.name || m.identifier,
      type: m.type,
      power: m.power,
      accuracy: m.accuracy,
      pp: m.pp || 20,
      currentPp: m.pp || 20,
    };
  }
  return {
    id: moveId,
    name: `Move #${moveId}`,
    type: 'normal',
    power: 40,
    accuracy: 100,
    pp: 20,
    currentPp: 20,
  };
}

export function calculateStats(
  base: PokemonStats,
  ivs: PokemonIVs,
  evs: PokemonEVs,
  level: number
): PokemonStats {
  // Standard Gen 3+ Stat Formula
  const calcHp = Math.floor(((2 * base.hp + ivs.hp + Math.floor(evs.hp / 4)) * level) / 100) + level + 10;
  const calcStat = (baseStat: number, iv: number, ev: number) =>
    Math.floor(((2 * baseStat + iv + Math.floor(ev / 4)) * level) / 100) + 5;

  return {
    hp: calcHp,
    attack: calcStat(base.attack, ivs.attack, evs.attack),
    defense: calcStat(base.defense, ivs.defense, evs.defense),
    specialAttack: calcStat(base.specialAttack, ivs.specialAttack, evs.specialAttack),
    specialDefense: calcStat(base.specialDefense, ivs.specialDefense, evs.specialDefense),
    speed: calcStat(base.speed, ivs.speed, evs.speed),
  };
}

export function getExpForLevel(level: number, growthRateId: number = 2): number {
  // Medium Fast (growth_rate_id 2): Level^3
  // Fast (1): 4/5 * Level^3
  // Medium Slow (4): 6/5 * Level^3 - 15 * Level^2 + 100 * Level - 140
  // Slow (3): 5/4 * Level^3
  if (growthRateId === 1) return Math.floor((4 * Math.pow(level, 3)) / 5);
  if (growthRateId === 3) return Math.floor((5 * Math.pow(level, 3)) / 4);
  if (growthRateId === 4) return Math.max(0, Math.floor(1.2 * Math.pow(level, 3) - 15 * Math.pow(level, 2) + 100 * level - 140));
  return Math.pow(level, 3);
}

export function getPossibleNewMoves(pokemon: TamagotchiPokemon, targetLevel: number): MoveData[] {
  const genKey = `gen${Math.min(5, Math.max(1, pokemon.generation || 4))}`;
  const genMovesets = movesetsMap[genKey] || movesetsMap['gen4'] || movesetsMap['gen1'];
  const speciesMoves: any[] = genMovesets[pokemon.speciesId.toString()] || [];

  const newMoves: MoveData[] = [];
  const existingMoveIds = new Set(pokemon.moves.map(m => m.id));

  for (const entry of speciesMoves) {
    if (entry.level === targetLevel && !existingMoveIds.has(entry.move_id)) {
      newMoves.push(getMoveById(entry.move_id));
    }
  }

  return newMoves;
}

export interface LevelUpMoveItem {
  level: number;
  moveId: number;
  name: string;
  type: string;
  power: number | null;
  accuracy: number | null;
  pp: number;
}

export function getLevelUpMovesForSpecies(speciesId: number, generation: number = 4): LevelUpMoveItem[] {
  const genKey = `gen${Math.min(5, Math.max(1, generation || 4))}`;
  const genMovesets = movesetsMap[genKey] || movesetsMap['gen4'] || movesetsMap['gen1'];
  const rawList: any[] = genMovesets[speciesId.toString()] || [];

  return rawList.map((m: any) => ({
    level: m.level,
    moveId: m.move_id,
    name: m.name || (movesMap[m.move_id?.toString()]?.name) || `Move #${m.move_id}`,
    type: m.type || (movesMap[m.move_id?.toString()]?.type) || 'normal',
    power: m.power !== undefined ? m.power : (movesMap[m.move_id?.toString()]?.power ?? null),
    accuracy: m.accuracy !== undefined ? m.accuracy : (movesMap[m.move_id?.toString()]?.accuracy ?? null),
    pp: m.pp !== undefined ? m.pp : (movesMap[m.move_id?.toString()]?.pp ?? 20),
  }));
}

export interface EvolutionNode {
  id: number;
  name: string;
  speciesName: string;
  isCurrent: boolean;
  types: string[];
  stage: number;
}

export function getEvolutionChainForSpecies(speciesId: number): EvolutionNode[] {
  const node = evolutionsMap[speciesId.toString()];
  if (!node) {
    const base = getBaseStats(speciesId);
    return [{
      id: speciesId,
      name: base.name,
      speciesName: base.name,
      isCurrent: true,
      types: base.types || ['normal'],
      stage: 1,
    }];
  }

  // Find root species in evolution chain
  let rootId = speciesId;
  const visited = new Set<number>();
  while (rootId && evolutionsMap[rootId.toString()]?.evolvesFromId) {
    if (visited.has(rootId)) break;
    visited.add(rootId);
    const parentId = evolutionsMap[rootId.toString()].evolvesFromId;
    if (parentId && evolutionsMap[parentId.toString()]) {
      rootId = parentId;
    } else {
      break;
    }
  }

  // BFS / DFS to collect full tree
  const results: EvolutionNode[] = [];
  const queue: { id: number; stage: number }[] = [{ id: rootId, stage: 1 }];
  const seen = new Set<number>();

  while (queue.length > 0) {
    const { id, stage } = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);

    const info = getBaseStats(id);
    results.push({
      id,
      name: info.name,
      speciesName: info.name,
      isCurrent: id === speciesId,
      types: info.types || ['normal'],
      stage,
    });

    const evoEntry = evolutionsMap[id.toString()];
    if (evoEntry && Array.isArray(evoEntry.evolvesTo)) {
      for (const nextId of evoEntry.evolvesTo) {
        queue.push({ id: nextId, stage: stage + 1 });
      }
    }
  }

  return results;
}

// Decode base64 to byte array
function base64ToBytes(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let bufferLength = base64.length * 0.75;
  if (base64.endsWith('==')) bufferLength -= 2;
  else if (base64.endsWith('=')) bufferLength -= 1;

  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < base64.length; i += 4) {
    const encoded1 = chars.indexOf(base64[i]);
    const encoded2 = chars.indexOf(base64[i + 1]);
    const encoded3 = chars.indexOf(base64[i + 2]);
    const encoded4 = chars.indexOf(base64[i + 3]);

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (encoded3 !== -1) bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    if (encoded4 !== -1) bytes[p++] = ((encoded3 & 3) << 6) | encoded4;
  }
  return bytes;
}

// Encode byte array to base64
export function bytesToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let base64 = '';
  const byteLength = bytes.byteLength;
  const byteRemainder = byteLength % 3;
  const mainLength = byteLength - byteRemainder;

  let a: number, b: number, c: number, d: number;
  let chunk: number;

  for (let i = 0; i < mainLength; i += 3) {
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    a = (chunk & 16515072) >> 18;
    b = (chunk & 258048) >> 12;
    c = (chunk & 4032) >> 6;
    d = chunk & 63;
    base64 += chars[a] + chars[b] + chars[c] + chars[d];
  }

  if (byteRemainder === 1) {
    chunk = bytes[mainLength];
    a = (chunk & 252) >> 2;
    b = (chunk & 3) << 4;
    base64 += chars[a] + chars[b] + '==';
  } else if (byteRemainder === 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];
    a = (chunk & 64512) >> 10;
    b = (chunk & 1008) >> 4;
    c = (chunk & 15) << 2;
    base64 += chars[a] + chars[b] + chars[c] + '=';
  }

  return base64;
}

export function parsePkmPayload(payload: string): TamagotchiPokemon {
  let version = 20; // Default HeartGold/SoulSilver
  let base64Data = '';

  if (payload.startsWith('pkm:')) {
    const parts = payload.split(':');
    if (parts.length >= 3) {
      version = parseInt(parts[1], 10) || 20;
      base64Data = parts.slice(2).join(':');
    }
  } else {
    base64Data = payload;
  }

  let speciesId = 25; // Default Pikachu
  let level = 5;
  let exp = 0;
  let nickname = '';
  let moves: MoveData[] = [];
  let isShiny = false;
  let evs: PokemonEVs = { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };
  let ivs: PokemonIVs = { hp: 15, attack: 15, defense: 15, specialAttack: 15, specialDefense: 15, speed: 15 };

  try {
    const bytes = base64ToBytes(base64Data);
    if (bytes.length > 0) {
      if (bytes.length === 44 || bytes.length === 33 || (version >= 1 && version <= 3)) {
        speciesId = bytes[0] || 25;
        level = bytes[3] || 5;
        moves = [bytes[8], bytes[9], bytes[10], bytes[11]].filter(m => m > 0).map(getMoveById);
      } else if (bytes.length === 48 || bytes.length === 32 || (version >= 4 && version <= 6)) {
        speciesId = bytes[0] || 25;
        moves = [bytes[2], bytes[3], bytes[4], bytes[5]].filter(m => m > 0).map(getMoveById);
        level = bytes[31] || bytes[3] || 5;
      } else if (bytes.length >= 80) {
        const rawSpecies = (bytes[8] | (bytes[9] << 8)) || (bytes[0] | (bytes[1] << 8));
        if (rawSpecies > 0 && rawSpecies <= 649) {
          speciesId = rawSpecies;
        }
        if (bytes.length >= 100) {
          const possibleLevel = bytes[84] || bytes[4] || bytes[140];
          if (possibleLevel >= 1 && possibleLevel <= 100) {
            level = possibleLevel;
          }
        }
      }
    }
  } catch (e) {
    console.warn('PKM binary parsing fallback applied:', e);
  }

  if (speciesId < 1 || speciesId > 649) {
    speciesId = 25;
  }

  const speciesInfo = getBaseStats(speciesId);
  if (!nickname) {
    nickname = speciesInfo.name;
  }

  if (moves.length === 0) {
    const genMoves = (movesetsMap['gen4'] && movesetsMap['gen4'][speciesId.toString()]) || [];
    const learned = genMoves.filter((m: any) => m.level <= level).slice(-4);
    if (learned.length > 0) {
      moves = learned.map((m: any) => getMoveById(m.move_id));
    } else {
      moves = [getMoveById(33)]; // Tackle
    }
  }

  const baseStats: PokemonStats = {
    hp: speciesInfo.stats.hp || 45,
    attack: speciesInfo.stats.attack || 49,
    defense: speciesInfo.stats.defense || 49,
    specialAttack: speciesInfo.stats.special_attack || 65,
    specialDefense: speciesInfo.stats.special_defense || 65,
    speed: speciesInfo.stats.speed || 45,
  };

  const calculatedStats = calculateStats(baseStats, ivs, evs, level);
  const growthRateId = speciesInfo.growth_rate_id || 2;
  const currentExp = getExpForLevel(level, growthRateId);
  const nextLevelExp = getExpForLevel(level + 1, growthRateId);

  const now = Date.now();
  const todayStr = new Date().toISOString().split('T')[0];

  return {
    speciesId,
    speciesName: speciesInfo.name,
    nickname,
    version,
    generation: speciesInfo.generation || 4,
    level,
    exp: currentExp,
    expToNextLevel: nextLevelExp,
    friendship: speciesInfo.base_happiness || 70,
    energy: 100,
    base64Raw: base64Data,
    isShiny,
    types: speciesInfo.types || ['normal'],
    moves,
    baseStats,
    calculatedStats,
    evs,
    ivs,
    lastFedTimestamp: now,
    lastSleepTimestamp: now,
    lastActiveTimestamp: now,
    isRested: false,
    totalSteps: 0,
    streakDays: 1,
    lastStreakDate: todayStr,
    baseline: {
      transferredAtTimestamp: now,
      initialLevel: level,
      initialExp: currentExp,
      initialFriendship: speciesInfo.base_happiness || 70,
      initialEvs: { ...evs },
      initialTotalSteps: 0,
    },
  };
}

export function generateReturnPayload(pokemon: TamagotchiPokemon): string {
  // Regenerate payload in standard pkm:<version>:<base64> format
  return `pkm:${pokemon.version}:${pokemon.base64Raw || bytesToBase64(new Uint8Array([pokemon.speciesId, pokemon.level]))}`;
}
