/**
 * Qs Poke Buddy - Zepp OS Durable Persistent Outbox
 * Persists watch-originated mutations to local storage until acknowledged by Android.
 * Survives watch restarts, UI recreation, and Bluetooth disconnects.
 */
import { storage } from './storage'

const OUTBOX_STORAGE_KEY = 'poke_durable_outbox_v1'

export class OutboxManager {
  constructor() {
    this.queue = []
    this.load()
  }

  load() {
    try {
      const saved = storage.getItem(OUTBOX_STORAGE_KEY, [])
      this.queue = Array.isArray(saved) ? saved : []
    } catch (e) {
      console.log('[WATCH] Failed to load outbox:', e)
      this.queue = []
    }
  }

  save() {
    try {
      storage.setItem(OUTBOX_STORAGE_KEY, this.queue)
    } catch (e) {
      console.log('[WATCH] Failed to persist outbox:', e)
    }
  }

  /**
   * Enqueue a new mutation operation and persist immediately to disk
   */
  enqueue(type, payload = {}) {
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const operation = {
      operationId,
      type,
      payload,
      createdAt: Date.now(),
      attempts: 0
    }

    this.queue.push(operation)
    this.save()
    console.log(`[WATCH] creating operationId=${operationId} type=${type}`)
    return operation
  }

  /**
   * Get all pending operations in chronological order
   */
  getAll() {
    return [...this.queue]
  }

  /**
   * Check if any unacknowledged operations exist
   */
  hasPending() {
    return this.queue.length > 0
  }

  /**
   * Get count of pending operations
   */
  count() {
    return this.queue.length
  }

  /**
   * Acknowledge and permanently remove an operation from the durable outbox
   */
  acknowledge(operationId) {
    const initialLen = this.queue.length
    this.queue = this.queue.filter(op => op.operationId !== operationId)
    if (this.queue.length !== initialLen) {
      this.save()
      console.log(`[WATCH] removing operationId=${operationId} from outbox`)
      return true
    }
    return false
  }

  /**
   * Record delivery attempt count
   */
  recordAttempt(operationId) {
    const op = this.queue.find(item => item.operationId === operationId)
    if (op) {
      op.attempts = (op.attempts || 0) + 1
      op.lastAttemptAt = Date.now()
      this.save()
    }
  }

  clear() {
    this.queue = []
    this.save()
  }
}

export const outbox = new OutboxManager()
