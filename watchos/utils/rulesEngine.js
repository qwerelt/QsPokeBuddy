/**
 * Qs Poke Buddy - Zepp OS On-Wrist Client State Cache
 * Caches authoritative Pokémon state, tasks, and rules received from Android.
 * Enforces strict monotonic stateVersion ordering to prevent stale state overwrites.
 * Provides helper functions for Pokémon names, ordered available tasks, and EV rewards.
 */
import { storage } from './storage'
import { syncLedger } from './syncLedger'

const STORAGE_KEY_STATE = 'poke_authoritative_state_v1'
const STORAGE_KEY_STATE_VERSION = 'poke_state_version_v1'

export const STAT_NAMES = {
  hp: 'HP',
  attack: 'Attack',
  defense: 'Defense',
  specialAttack: 'Sp. Atk',
  specialDefense: 'Sp. Def',
  speed: 'Speed'
}

export const EV_KEYS = ['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed']

export class RulesEngine {
  constructor() {
    this.pokemon = null
    this.tasks = []
    this.rules = {
      exp_per_step: 1.0,
      exp_multiplier: 1.0,
      steps_per_ev: 100,
      target_stat: 'attack',
      steps_per_friendship: 256,
      hydration_enabled: true,
      hydration_reward_text: '+10 XP',
      item_milestones: []
    }
    this.stateVersion = 0

    this.onLevelUpCallback = null
    this.onItemFoundCallback = null
    this.onStatsUpdatedCallback = null

    this.loadState()
  }

  loadState() {
    try {
      this.stateVersion = storage.getItem(STORAGE_KEY_STATE_VERSION, 0)
      const savedState = storage.getItem(STORAGE_KEY_STATE, null)

      if (savedState && savedState.pokemon) {
        this.pokemon = savedState.pokemon
        this.tasks = savedState.tasks || []
        this.rules = savedState.rules || this.rules
        syncLedger.setSession(this.pokemon.sessionId || this.pokemon.session_id || 'default_session')
      } else {
        // Fallback default state
        this.pokemon = {
          sessionId: 'session_init_' + Date.now(),
          speciesId: 41,
          speciesName: 'Zubat',
          nickname: '',
          level: 5,
          currentExp: 0,
          expToNext: 150,
          friendship: 70,
          energy: 100,
          isRested: false,
          totalSteps: 0,
          waterCups: 0,
          nature: 'Jolly',
          ability: 'Inner Focus',
          types: ['Poison', 'Flying'],
          moves: [
            { id: 48, name: 'Supersonic', type: 'Normal', power: null, pp: 20, currentPp: 20 },
            { id: 141, name: 'Leech Life', type: 'Bug', power: 20, pp: 15, currentPp: 15 }
          ],
          baseStats: { hp: 40, attack: 45, defense: 35, specialAttack: 30, specialDefense: 40, speed: 55 },
          calculatedStats: { hp: 20, attack: 12, defense: 10, specialAttack: 9, specialDefense: 11, speed: 14 },
          evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
          spritePath: 'pkm_41.png'
        }
        this.tasks = []
      }
    } catch (e) {
      console.log('[WATCH] Failed to load local state:', e)
    }
  }

  saveState() {
    try {
      storage.setItem(STORAGE_KEY_STATE_VERSION, this.stateVersion)
      storage.setItem(STORAGE_KEY_STATE, {
        pokemon: this.pokemon,
        tasks: this.tasks,
        rules: this.rules,
        stateVersion: this.stateVersion
      })
    } catch (e) {
      console.log('[WATCH] Failed to save state:', e)
    }
  }

  setCallbacks({ onLevelUp, onItemFound, onStatsUpdated }) {
    this.onLevelUpCallback = onLevelUp
    this.onItemFoundCallback = onItemFound
    this.onStatsUpdatedCallback = onStatsUpdated
  }

  getStateVersion() {
    return this.stateVersion
  }

  setStateVersion(version) {
    if (version > this.stateVersion) {
      this.stateVersion = version
      this.saveState()
    }
  }

  /**
   * Reconcile against Android Authoritative State
   * Rejects stale state versions (if incoming < current).
   */
  updateFromAuthoritativeState(statePayload, incomingVersion) {
    if (!statePayload) return

    const version = incomingVersion !== undefined ? incomingVersion : (statePayload.stateVersion || 0)

    // Stale state protection
    if (version > 0 && version < this.stateVersion) {
      console.log(`[WATCH] Dropping stale state (incoming v${version} < cached v${this.stateVersion})`)
      return
    }

    if (version > 0) {
      this.stateVersion = version
    }

    if (statePayload.pokemon) {
      const pkm = statePayload.pokemon
      this.pokemon = {
        sessionId: pkm.sessionId || pkm.session_id || `session_${pkm.speciesId}`,
        speciesId: pkm.speciesId || 41,
        speciesName: pkm.speciesName || 'Pokemon',
        nickname: pkm.nickname || '',
        level: pkm.level || 1,
        currentExp: pkm.currentExp !== undefined ? pkm.currentExp : (pkm.exp || 0),
        expToNext: pkm.expToNext || pkm.expToNextLevel || 100,
        friendship: pkm.friendship || 0,
        energy: pkm.energy !== undefined ? pkm.energy : 100,
        isRested: !!pkm.isRested,
        totalSteps: pkm.totalSteps || 0,
        waterCups: pkm.waterCups || statePayload.waterCups || 0,
        nature: pkm.nature || 'Hardy',
        ability: pkm.ability || (pkm.abilities && pkm.abilities[0]) || 'Standard',
        types: pkm.types || ['Normal'],
        moves: pkm.moves || [],
        baseStats: pkm.baseStats || {},
        calculatedStats: pkm.calculatedStats || pkm.baseStats || {},
        evs: pkm.evs || { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
        spritePath: pkm.speciesId ? `pkm_${pkm.speciesId}.png` : 'pokemon_default.png'
      }
      syncLedger.setSession(this.pokemon.sessionId)
    }

    if (Array.isArray(statePayload.tasks)) {
      this.tasks = statePayload.tasks
    }

    if (statePayload.rules) {
      this.rules = { ...this.rules, ...statePayload.rules }
    }

    console.log(`[WATCH] State updated to v${this.stateVersion} (${this.getDisplayName()} Lv. ${this.pokemon?.level})`)

    this.saveState()
    if (this.onStatsUpdatedCallback) this.onStatsUpdatedCallback(this.pokemon)
  }

  getPokemon() {
    return this.pokemon
  }

  /**
   * Display name rule:
   * If Pokémon has nickname -> display nickname
   * Otherwise -> display species name
   */
  getDisplayName() {
    if (!this.pokemon) return 'Pokémon'
    if (this.pokemon.nickname && this.pokemon.nickname.trim().length > 0) {
      return this.pokemon.nickname
    }
    return this.pokemon.speciesName || 'Pokémon'
  }

  getTasks() {
    return this.tasks || []
  }

  /**
   * Returns ordered incomplete tasks as provided by Android.
   * If hydration rule is enabled, prepends the repeatable 'Drink Water' task.
   */
  getOrderedAvailableTasks() {
    const available = (this.tasks || []).filter(t => !t.completed)
    const result = []

    // Repeatable hydration task at top if enabled
    if (this.rules?.hydration_enabled !== false) {
      result.push({
        id: 'repeatable_hydration',
        title: 'Drink Water',
        category: 'Health',
        reward: this.rules?.hydration_reward_text || '+10 XP',
        isRepeatable: true,
        isHydration: true
      })
    }

    return result.concat(available)
  }

  getRules() {
    return this.rules
  }

  completeTaskOptimistic(taskId) {
    if (taskId === 'repeatable_hydration') {
      if (this.pokemon) {
        this.pokemon.waterCups = (this.pokemon.waterCups || 0) + 1
        this.saveState()
      }
      return
    }

    const task = (this.tasks || []).find(t => t.id === taskId)
    if (task) {
      task.completed = true
      this.saveState()
    }
  }

  logStepDelta(stepDelta) {
    if (this.pokemon && stepDelta > 0) {
      this.pokemon.totalSteps = (this.pokemon.totalSteps || 0) + stepDelta
      this.saveState()
    }
  }

  addEvOptimistic(statKey, amount = 1) {
    if (this.pokemon) {
      if (!this.pokemon.evs) {
        this.pokemon.evs = { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 }
      }
      const keyMap = {
        hp: 'hp',
        attack: 'attack',
        atk: 'attack',
        defense: 'defense',
        def: 'defense',
        specialattack: 'specialAttack',
        specialAttack: 'specialAttack',
        spa: 'specialAttack',
        specialdefense: 'specialDefense',
        specialDefense: 'specialDefense',
        spd: 'specialDefense',
        speed: 'speed',
        spe: 'speed'
      }
      const targetKey = keyMap[statKey] || statKey
      if (this.pokemon.evs[targetKey] !== undefined) {
        this.pokemon.evs[targetKey] = Math.min(252, (this.pokemon.evs[targetKey] || 0) + amount)
        this.saveState()
      }
    }
  }
}

export const rulesEngine = new RulesEngine()
