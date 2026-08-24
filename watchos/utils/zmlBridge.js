/**
 * Qs Poke Buddy - Zepp OS Watch BLE Communication Bridge
 * Manages request/response communication over BLE with app-side/index.js (Boundary B)
 * and drives the durable outbox dispatch pipeline.
 */
import { appPlugin } from '@zeppos/zml/3.0/module/messaging/plugin/app'
import { outbox } from './outbox'
import { rulesEngine } from './rulesEngine'

let messagingInstance = null
let isConnecting = false
let isFlushing = false

export function getMessaging(callbacks = {}) {
  if (messagingInstance) return messagingInstance
  if (isConnecting) return null

  try {
    isConnecting = true
    const plugin = appPlugin()
    const fakeContext = {
      globalData: {},
      onCall(req) {
        if (callbacks.onCall) callbacks.onCall(req)
      },
      onRequest(req, res) {
        if (callbacks.onRequest) callbacks.onRequest(req, res)
      },
      onBleChanged(connected) {
        console.log('[WATCH] BLE Status Changed:', connected)
        if (connected) {
          flushOutbox()
        }
        if (callbacks.onBleChanged) callbacks.onBleChanged(connected)
      }
    }

    plugin.onCreate.call(fakeContext)
    messagingInstance = fakeContext.messaging || fakeContext.globalData?.messaging
    isConnecting = false
    return messagingInstance
  } catch (e) {
    isConnecting = false
    console.log('[WATCH] BLE Init notice:', e)
    return null
  }
}

export function requestFromAppSide(action, params = {}) {
  return new Promise((resolve, reject) => {
    try {
      const msg = getMessaging()
      if (msg && typeof msg.request === 'function') {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
        msg.request({
          action,
          requestId,
          protocolVersion: 1,
          params
        })
          .then(res => resolve(res))
          .catch(err => {
            console.log(`[WATCH] Request failed for ${action}:`, err)
            reject(err)
          })
      } else {
        reject(new Error('BLE Messaging not connected yet'))
      }
    } catch (e) {
      reject(e)
    }
  })
}

/**
 * Submit a durable mutation to Android with immediate delivery and outbox persistence
 */
export async function submitDurableOperation(type, payload = {}) {
  // 1. Persist operation in durable outbox
  const operation = outbox.enqueue(type, payload)
  console.log(`[WATCH] sending operationId=${operation.operationId} type=${type}`)

  // 2. Attempt immediate delivery over BLE to Side Service
  try {
    const response = await requestFromAppSide('EXECUTE_OPERATION', {
      operationId: operation.operationId,
      type: operation.type,
      ...operation.payload
    })

    if (response && response.ok) {
      // 3. Acknowledge and remove from outbox upon verified ACK
      outbox.acknowledge(operation.operationId)
      console.log(`[WATCH] operationId=${operation.operationId} acknowledged by Android`)

      // 4. Update local state cache if state payload returned
      if (response.payload?.state) {
        rulesEngine.updateFromAuthoritativeState(response.payload.state, response.payload.stateVersion)
      } else if (response.payload?.stateVersion) {
        rulesEngine.setStateVersion(response.payload.stateVersion)
      }

      return { success: true, operationId: operation.operationId, response }
    } else {
      console.log(`[WATCH] Android unavailable for operationId=${operation.operationId}, stored in outbox`)
      return { success: false, operationId: operation.operationId, queued: true }
    }
  } catch (err) {
    console.log(`[WATCH] Delivery failed for operationId=${operation.operationId} (stored in outbox for retry):`, err.message)
    return { success: false, operationId: operation.operationId, queued: true }
  }
}

/**
 * Flush all pending durable outbox operations sequentially
 */
export async function flushOutbox() {
  if (isFlushing || !outbox.hasPending()) return
  isFlushing = true

  const pending = outbox.getAll()
  console.log(`[WATCH] Flushing ${pending.length} pending outbox operations...`)

  for (const op of pending) {
    try {
      outbox.recordAttempt(op.operationId)
      console.log(`[WATCH] Retrying operationId=${op.operationId}...`)
      const res = await requestFromAppSide('EXECUTE_OPERATION', {
        operationId: op.operationId,
        type: op.type,
        ...op.payload
      })

      if (res && res.ok) {
        outbox.acknowledge(op.operationId)
        if (res.payload?.state) {
          rulesEngine.updateFromAuthoritativeState(res.payload.state, res.payload.stateVersion)
        }
      } else {
        // Stop flushing if Android is unavailable
        break
      }
    } catch (e) {
      console.log(`[WATCH] Retry failed for operationId=${op.operationId}:`, e.message)
      break
    }
  }

  isFlushing = false
}
