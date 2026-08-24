/**
 * Qs Poke Buddy - Zepp OS App-Side Companion Bridge (Boundary A <-> Boundary B)
 * Runs inside the Zepp Android host container on the phone.
 * Pure transport adapter between Zepp BLE Messaging and http://127.0.0.1:8088.
 * No Pokémon game logic is hosted here.
 */
import { BaseSideService } from '@zeppos/zml/base-side'

const ANDROID_API_URL = 'http://127.0.0.1:8088'
const CANDIDATE_HOSTS = [
  'http://127.0.0.1:8088',
  'http://localhost:8088',
  'http://10.0.2.2:8088' // Android emulator loopback alias
]

/**
 * Perform an HTTP request to the Android localhost API
 */
async function callAndroidApi(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  }
  const body = options.body
    ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
    : undefined

  let lastError = null

  for (const host of CANDIDATE_HOSTS) {
    const fullUrl = `${host}${path}`
    try {
      let res = null
      if (typeof fetch === 'function') {
        try {
          res = await fetch(fullUrl, { method, headers, body })
        } catch (_) {
          res = await fetch({ url: fullUrl, method, headers, body })
        }
      }

      if (!res) continue

      let parsedData = null
      if (typeof res.json === 'function') {
        parsedData = await res.json()
      } else if (typeof res.text === 'function') {
        const text = await res.text()
        try {
          parsedData = JSON.parse(text)
        } catch (_) {
          parsedData = text
        }
      } else if (res.body !== undefined) {
        parsedData = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
      }

      if (parsedData) {
        return parsedData
      }
    } catch (e) {
      lastError = e
    }
  }

  throw new Error(`[SIDE_SERVICE] Android API unreachable at ${ANDROID_API_URL}${path}: ${lastError?.message || 'Connection refused'}`)
}

AppSideService(
  BaseSideService({
    onInit() {
      console.log('[SIDE_SERVICE] Zepp Side Service transport adapter initialized')
    },

    onRequest(req, res) {
      const type = req.action || req.type || req.event
      const requestId = req.requestId || `req_${Date.now()}`
      const params = req.params || req.payload || req.data || {}

      console.log(`[SIDE_SERVICE] Inbound request [${type}] requestId=${requestId}`)

      switch (type) {
        // 1. GET_STATE: Request full authoritative state from Android
        case 'GET_STATE':
        case 'FETCH_ACTIVE_POKEMON':
          callAndroidApi('/api/v1/state')
            .then(data => {
              console.log(`[SIDE_SERVICE] GET_STATE success (StateVersion=${data?.payload?.stateVersion || data?.stateVersion})`)
              res(null, {
                protocolVersion: 1,
                requestId,
                ok: true,
                type: 'STATE',
                payload: data?.payload?.state || data?.state || data?.payload || data
              })
            })
            .catch(err => {
              console.log('[SIDE_SERVICE] GET_STATE error:', err.message)
              res(null, {
                protocolVersion: 1,
                requestId,
                ok: false,
                error: {
                  code: 'ANDROID_UNAVAILABLE',
                  message: err.message
                }
              })
            })
          break

        // 2. SYNC: Request changes since last known stateVersion
        case 'SYNC':
        case 'REQUEST_SYNC':
          const sinceVersion = params.sinceVersion !== undefined ? params.sinceVersion : -1
          callAndroidApi(`/api/v1/sync?sinceVersion=${sinceVersion}`)
            .then(data => {
              console.log(`[SIDE_SERVICE] SYNC success (Changed=${data?.payload?.changed})`)
              res(null, {
                protocolVersion: 1,
                requestId,
                ok: true,
                type: 'SYNC_RESPONSE',
                payload: data?.payload || data
              })
            })
            .catch(err => {
              console.log('[SIDE_SERVICE] SYNC error:', err.message)
              res(null, {
                protocolVersion: 1,
                requestId,
                ok: false,
                error: {
                  code: 'ANDROID_UNAVAILABLE',
                  message: err.message
                }
              })
            })
          break

        // 3. EXECUTE_OPERATION: Submit durable mutation to Android (Task Complete, ADD_EV, Water Log, Step Delta, etc.)
        case 'EXECUTE_OPERATION':
        case 'COMPLETE_TASK':
        case 'TASK_COMPLETE':
        case 'ADD_EV':
        case 'WATER_LOG':
        case 'STEP_DELTA':
        case 'SYNC_LEDGER_BATCH':
        case 'SYNC_LEDGER':
          const operationId = req.operationId || params.operationId || params.batch_id || `op_${Date.now()}`
          const opType = req.operationType || params.type || type
          console.log(`[SIDE_SERVICE] Forwarding operation [${opType}] operationId=${operationId} to Android...`)

          callAndroidApi('/api/v1/watch/operations', {
            method: 'POST',
            body: {
              protocolVersion: 1,
              requestId,
              operationId,
              type: opType,
              payload: params
            }
          })
            .then(data => {
              console.log(`[SIDE_SERVICE] Operation [${operationId}] ACK received (New StateVersion=${data?.payload?.stateVersion})`)
              res(null, {
                protocolVersion: 1,
                requestId,
                ok: true,
                type: 'OPERATION_ACK',
                payload: data?.payload || data
              })
            })
            .catch(err => {
              console.log(`[SIDE_SERVICE] Operation [${operationId}] delivery failed:`, err.message)
              res(null, {
                protocolVersion: 1,
                requestId,
                ok: false,
                error: {
                  code: 'ANDROID_UNAVAILABLE',
                  message: err.message
                }
              })
            })
          break

        // 4. HEALTH: Check if Android server is alive
        case 'HEALTH':
          callAndroidApi('/api/v1/health')
            .then(data => {
              res(null, {
                protocolVersion: 1,
                requestId,
                ok: true,
                type: 'HEALTH',
                payload: data?.payload || data
              })
            })
            .catch(err => {
              res(null, {
                protocolVersion: 1,
                requestId,
                ok: false,
                error: {
                  code: 'ANDROID_UNAVAILABLE',
                  message: err.message
                }
              })
            })
          break

        default:
          res(null, {
            protocolVersion: 1,
            requestId,
            ok: false,
            error: {
              code: 'UNKNOWN_OPERATION',
              message: `Unknown operation type: ${type}`
            }
          })
          break
      }
    }
  })
)
