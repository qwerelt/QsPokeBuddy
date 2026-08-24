/**
 * Qs Poke Buddy - Zepp OS Storage Utility
 * File-backed persistent key-value storage using @zos/fs with robust fallback.
 */
import {
  statSync,
  openSync,
  readSync,
  writeSync,
  closeSync,
  O_RDONLY,
  O_RDWR,
  O_CREAT,
  O_TRUNC
} from '@zos/fs'

const DATA_FILE = 'poke_buddy_store.json'

class StorageManager {
  constructor() {
    this.memoryCache = {}
    this.isLoaded = false
  }

  load() {
    this.isLoaded = true
    try {
      let stat = null
      try {
        if (typeof statSync === 'function') {
          stat = statSync({ path: DATA_FILE })
        } else if (typeof hmFS !== 'undefined' && typeof hmFS.stat_sync === 'function') {
          stat = hmFS.stat_sync(DATA_FILE)
        }
      } catch (_) {}

      if (stat && stat.size > 0) {
        const buffer = new ArrayBuffer(stat.size)
        let file = null
        try {
          if (typeof openSync === 'function') {
            file = openSync({ path: DATA_FILE, flag: O_RDONLY || 0 })
          } else if (typeof hmFS !== 'undefined' && typeof hmFS.open === 'function') {
            file = hmFS.open(DATA_FILE, 0)
          }
        } catch (_) {}

        if (file) {
          try {
            if (typeof readSync === 'function') {
              readSync({ fd: file, buffer: buffer })
            } else if (typeof hmFS !== 'undefined' && typeof hmFS.read === 'function') {
              hmFS.read(file, buffer, 0, stat.size)
            }
          } catch (_) {}

          try {
            if (typeof closeSync === 'function') {
              closeSync({ fd: file })
            } else if (typeof hmFS !== 'undefined' && typeof hmFS.close === 'function') {
              hmFS.close(file)
            }
          } catch (_) {}

          const uint8Array = new Uint8Array(buffer)
          let jsonString = ''
          for (let i = 0; i < uint8Array.length; i++) {
            jsonString += String.fromCharCode(uint8Array[i])
          }
          if (jsonString) {
            this.memoryCache = JSON.parse(jsonString)
            return
          }
        }
      }
    } catch (e) {
      console.log('[Storage] Read error notice (using memory defaults):', e)
    }

    this.memoryCache = {}
  }

  save() {
    try {
      const jsonString = JSON.stringify(this.memoryCache)
      const buffer = new ArrayBuffer(jsonString.length)
      const uint8Array = new Uint8Array(buffer)
      for (let i = 0; i < jsonString.length; i++) {
        uint8Array[i] = jsonString.charCodeAt(i)
      }

      let file = null
      try {
        if (typeof openSync === 'function') {
          file = openSync({
            path: DATA_FILE,
            flag: (O_RDWR || 2) | (O_CREAT || 512) | (O_TRUNC || 1024)
          })
        } else if (typeof hmFS !== 'undefined' && typeof hmFS.open === 'function') {
          file = hmFS.open(DATA_FILE, 2)
        }
      } catch (_) {}

      if (file) {
        try {
          if (typeof writeSync === 'function') {
            writeSync({ fd: file, buffer: buffer })
          } else if (typeof hmFS !== 'undefined' && typeof hmFS.write === 'function') {
            hmFS.write(file, buffer, 0, jsonString.length)
          }
        } catch (_) {}

        try {
          if (typeof closeSync === 'function') {
            closeSync({ fd: file })
          } else if (typeof hmFS !== 'undefined' && typeof hmFS.close === 'function') {
            hmFS.close(file)
          }
        } catch (_) {}
      }
    } catch (e) {
      console.log('[Storage] Save notice:', e)
    }
  }

  getItem(key, defaultValue = null) {
    if (!this.isLoaded) {
      this.load()
    }
    if (this.memoryCache && Object.prototype.hasOwnProperty.call(this.memoryCache, key)) {
      return this.memoryCache[key]
    }
    return defaultValue
  }

  setItem(key, value) {
    if (!this.isLoaded) {
      this.load()
    }
    this.memoryCache[key] = value
    this.save()
  }

  removeItem(key) {
    if (this.memoryCache && Object.prototype.hasOwnProperty.call(this.memoryCache, key)) {
      delete this.memoryCache[key]
      this.save()
    }
  }

  clear() {
    this.memoryCache = {}
    this.save()
  }
}

export const storage = new StorageManager()
