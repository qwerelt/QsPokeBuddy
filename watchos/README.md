# Qs Poke Buddy - Zepp OS Companion (Amazfit Bip 6)

Companion mini-program for Zepp OS smartwatches (targeted for Amazfit Bip 6 `390x450` AMOLED screen, with backward compatibility for Bip 5 `320x380`) that acts as a modern on-wrist Pokéwalker.

---

## 🌟 Architecture & Communication Pipeline

```
                         ANDROID PHONE

┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  CUSTOM POKÉMON ANDROID APP                                 │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Authoritative Game State                              │  │
│  │ Pokémon / XP / levels / tasks / rewards / inventory   │  │
│  │ stateVersion = 100+ (Monotonically Increasing)        │  │
│  │                                                       │  │
│  │ Local Loopback HTTP API                               │  │
│  │ 127.0.0.1:8088                                       │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                              │
│                              │ Boundary A: Loopback HTTP    │
│                              │                              │
│                    ┌─────────▼─────────────┐                │
│                    │ ZEPP ANDROID APP      │                │
│                    │                       │                │
│                    │ Mini Program          │                │
│                    │ Side Service          │                │
│                    └─────────┬─────────────┘                │
│                              │                              │
└──────────────────────────────┼──────────────────────────────┘
                               │
                               │ Boundary B: Zepp Messaging / BLE
                               │
                    ┌──────────▼──────────┐
                    │    AMAZFIT BIP 6    │
                    │                     │
                    │ Zepp OS Device App  │
                    │                     │
                    │ State Cache         │
                    │ Durable Outbox      │
                    └─────────────────────┘
```

---

## 📂 Project Structure

```
/watchos
├── app.json                # Mini-program manifest, permissions, screen profiles (Bip 6)
├── app.js                  # Device application lifecycle
├── package.json            # Dependencies & Zeus CLI scripts
├── app-side/
│   └── index.js            # Boundary A <-> Boundary B transport adapter (BLE <-> 127.0.0.1:8088)
├── page/
│   ├── index.js            # Main Watch UI, sensor listeners & interactive modals
│   └── index.style.js      # Responsive styling & retro Pokémon UI coordinates
├── utils/
│   ├── outbox.js           # Persistent durable outbox (survives disconnects/reboots)
│   ├── rulesEngine.js      # Client state cache & stateVersion ordering protection
│   ├── syncLedger.js       # Uncommitted delta buffer & 2-way handshake ACK verification
│   ├── storage.js          # Persistent file-backed storage manager (@zeppos/fs)
│   └── zmlBridge.js        # BLE messaging & outbox auto-flush pipeline
└── assets/
    ├── icon.png            # App launcher icon
    └── pkm_41.png          # Active companion sprite (Zubat)
```

---

## 📡 Communication Protocols

### A. Asset & State Downlink (Phone -> Watch)
- **Authoritative Pokémon Data**: Species, Level, Current EXP, EXP to next level, EV stats, Rested sleep state, Session ID.
- **State Versioning**: Monotonically increasing `stateVersion` prevents stale version overwrites.
- **Incremental Sync**: `GET /api/v1/sync?sinceVersion=N` returns lightweight diffs.

### B. Durable Outbox & Uplink (Watch -> Phone)
- **Persistent Outbox**: Watch buffers operations (`COMPLETE_TASK`, `WATER_LOG`, `STEP_DELTA`) with unique `operationId`s in local flash memory (`poke_durable_outbox_v1`).
- **Immediate Delivery + Offline Resilience**: Attempted immediately over BLE; if phone is offline, operations remain safely stored and flush sequentially upon reconnect.
- **Idempotency**: Android maintains an operation ID cache to prevent duplicate rewards or XP on retries.
- **Two-Way Handshake**:
  1. Watch delivers operation via Side Service to `POST /api/v1/watch/operations`.
  2. Android commits state, increments `stateVersion`, and returns `OPERATION_ACK`.
  3. Watch purges the operation from its durable outbox **only** upon receiving the ACK.

---

## 🛠️ Building & Previewing with Zeus

1. Install Zeus CLI if needed:
   ```bash
   npm install -g @zeppos/zeus-cli
   ```

2. From `/watchos`:
   ```bash
   # Install dependencies
   npm install

   # Build device and app-side packages
   npm run build

   # Preview in Zepp OS Simulator / Deploy to physical watch
   npm run preview
   ```
