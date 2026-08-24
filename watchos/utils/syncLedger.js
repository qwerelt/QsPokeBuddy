/**
 * Qs Poke Buddy - Zepp OS Sync Ledger
 * Manages delta-log ledger, session epochs, and two-way handshake ACK verification.
 */
import { storage } from './storage'

const STORAGE_KEY_LEDGER = 'poke_sync_ledger_v1'

function generateUUID() {
  return 'b_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7)
}

export class SyncLedger {
  constructor() {
    this.sessionId = null
    this.uncommitted = {
      delta_steps: 0,
      water_logged: 0,
      meals_logged: [],
      new_moves_learned: [],
      evs_earned: {
        hp: 0,
        attack: 0,
        defense: 0,
        specialAttack: 0,
        specialDefense: 0,
        speed: 0
      },
      items_found: [],
      tasks_completed: []
    }
    this.inFlightBatches = [] // Array of { batch_id, payload, createdAt }
    this.loadState()
  }

  loadState() {
    const saved = storage.getItem(STORAGE_KEY_LEDGER, null)
    if (saved) {
      this.sessionId = saved.sessionId || null
      this.uncommitted = {
        delta_steps: 0,
        water_logged: 0,
        meals_logged: [],
        new_moves_learned: [],
        evs_earned: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
        items_found: [],
        tasks_completed: [],
        ...(saved.uncommitted || {})
      }
      this.inFlightBatches = saved.inFlightBatches || []
    }
  }

  saveState() {
    storage.setItem(STORAGE_KEY_LEDGER, {
      sessionId: this.sessionId,
      uncommitted: this.uncommitted,
      inFlightBatches: this.inFlightBatches
    })
  }

  /**
   * Set active Pokémon session epoch.
   * If session changes, inflight and uncommitted deltas for old session are reset.
   */
  setSession(sessionId) {
    if (this.sessionId !== sessionId) {
      console.log(`[SyncLedger] New session epoch detected: ${sessionId} (Old: ${this.sessionId})`)
      this.sessionId = sessionId
      this.uncommitted = {
        delta_steps: 0,
        evs_earned: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
        items_found: [],
        tasks_completed: []
      }
      this.inFlightBatches = []
      this.saveState()
    }
  }

  /**
   * Log live steps delta to the local buffer
   */
  addSteps(stepDelta) {
    if (stepDelta <= 0) return
    this.uncommitted.delta_steps += stepDelta
    this.saveState()
  }

  /**
   * Log EV gain to the local buffer
   */
  addEv(statKey, amount) {
    if (!statKey || amount <= 0) return
    if (typeof this.uncommitted.evs_earned[statKey] === 'number') {
      this.uncommitted.evs_earned[statKey] += amount
    } else {
      this.uncommitted.evs_earned[statKey] = amount
    }
    this.saveState()
  }

  /**
   * Log discovered item to local buffer
   */
  addItemFound(item) {
    this.uncommitted.items_found.push({
      ...item,
      timestamp: Date.now()
    })
    this.saveState()
  }

  /**
   * Log task completed to local buffer
   */
  addTaskCompleted(taskId) {
    this.uncommitted.tasks_completed.push({
      taskId,
      timestamp: Date.now()
    })
    this.saveState()
  }

  /**
   * Log water drinking to local buffer
   */
  addWater(cups = 1) {
    this.uncommitted.water_logged = (this.uncommitted.water_logged || 0) + cups
    this.saveState()
  }

  /**
   * Log meal to local buffer
   */
  addMeal(mealType) {
    this.uncommitted.meals_logged.push({
      mealType,
      timestamp: Date.now()
    })
    this.saveState()
  }

  /**
   * Log learned move to local buffer
   */
  addLearnedMove(move) {
    this.uncommitted.new_moves_learned.push({
      move,
      timestamp: Date.now()
    })
    this.saveState()
  }

  /**
   * Check if there are any uncommitted deltas or in-flight batches waiting to be sent
   */
  hasPendingData() {
    const hasUncommitted = (
      this.uncommitted.delta_steps > 0 ||
      (this.uncommitted.water_logged && this.uncommitted.water_logged > 0) ||
      (this.uncommitted.meals_logged && this.uncommitted.meals_logged.length > 0) ||
      (this.uncommitted.new_moves_learned && this.uncommitted.new_moves_learned.length > 0) ||
      Object.values(this.uncommitted.evs_earned).some(v => v > 0) ||
      this.uncommitted.items_found.length > 0 ||
      this.uncommitted.tasks_completed.length > 0
    )
    return hasUncommitted || this.inFlightBatches.length > 0
  }

  /**
   * Pack all current uncommitted deltas into a new in-flight batch.
   * Returns the batch object to transmit over BLE.
   */
  prepareBatch() {
    const hasUncommitted = (
      this.uncommitted.delta_steps > 0 ||
      (this.uncommitted.water_logged && this.uncommitted.water_logged > 0) ||
      (this.uncommitted.meals_logged && this.uncommitted.meals_logged.length > 0) ||
      (this.uncommitted.new_moves_learned && this.uncommitted.new_moves_learned.length > 0) ||
      Object.values(this.uncommitted.evs_earned).some(v => v > 0) ||
      this.uncommitted.items_found.length > 0 ||
      this.uncommitted.tasks_completed.length > 0
    )

    if (hasUncommitted) {
      const batchId = generateUUID()
      const batchPayload = {
        batch_id: batchId,
        session_id: this.sessionId,
        delta_steps: this.uncommitted.delta_steps,
        water_logged: this.uncommitted.water_logged || 0,
        meals_logged: [...(this.uncommitted.meals_logged || [])],
        new_moves_learned: [...(this.uncommitted.new_moves_learned || [])],
        evs_earned: { ...this.uncommitted.evs_earned },
        items_found: [...this.uncommitted.items_found],
        tasks_completed: [...this.uncommitted.tasks_completed],
        timestamp: Date.now()
      }

      this.inFlightBatches.push(batchPayload)

      // Reset uncommitted buffer
      this.uncommitted = {
        delta_steps: 0,
        water_logged: 0,
        meals_logged: [],
        new_moves_learned: [],
        evs_earned: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
        items_found: [],
        tasks_completed: []
      }

      this.saveState()
      return batchPayload
    }

    // If no new uncommitted deltas, return the oldest unacknowledged batch (if any)
    if (this.inFlightBatches.length > 0) {
      return this.inFlightBatches[0]
    }

    return null
  }

  /**
   * Process Two-Way Handshake ACK from Android host.
   * Clears the committed batch from local memory.
   */
  acknowledgeBatch(batchId) {
    if (!batchId) return false
    const initialLen = this.inFlightBatches.length
    this.inFlightBatches = this.inFlightBatches.filter(b => b.batch_id !== batchId)
    const acknowledged = this.inFlightBatches.length < initialLen
    if (acknowledged) {
      console.log(`[SyncLedger] ACK received and committed for batch: ${batchId}`)
      this.saveState()
    }
    return acknowledged
  }

  /**
   * Return all in-flight batches waiting for ACK
   */
  getInFlightBatches() {
    return this.inFlightBatches
  }

  getUncommittedSummary() {
    return {
      session_id: this.sessionId,
      uncommitted_steps: this.uncommitted.delta_steps,
      uncommitted_evs: { ...this.uncommitted.evs_earned },
      in_flight_count: this.inFlightBatches.length
    }
  }
}

export const syncLedger = new SyncLedger()
