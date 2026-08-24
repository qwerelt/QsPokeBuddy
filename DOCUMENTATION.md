# Qs Poke Buddy - Master Documentation

## Overview
Qs Poke Buddy is a modern, open-source iteration of the Pokéwalker accessory, designed for the Pokémon emulation community. The project allows users to transfer Pokémon from their classic save files into a mobile Tamagotchi-like companion, interact with them using real-world physical activity (via Health APIs and Smartwatch Companion apps), and eventually transfer them back.

## Project Structure
- `/webapp` - Blazor WebAssembly app (C#). Uses `PKHeX.Core` to parse save files locally, remove the Pokémon, and generate a QR Code payload (`pkm:<version>:<base64>`).
- `/mobile` - React Native Android application. Serves as the primary Tamagotchi companion and the **sole authoritative source of truth** for all game state.
  - `/mobile/android` - Native Android root with embedded loopback HTTP server on `127.0.0.1:8088`.
  - `/mobile/sources` - Source of truth for local game data (Pokémon sprites, level-up movesets, evolution trees, etc.).
- `/backend` - (Planned) Lightweight Node.js WebSocket relay to transfer the Pokémon back to the Web App without permanently storing files on the server.
- `/watchos` - Companion Zepp OS Mini-Program for Amazfit Bip 6 smartwatches.

---

## Mobile Architecture & Navigation

The mobile companion features 4 primary bottom navigation destinations:
1. **`Log Activity` (`/log`)**: Centralized activity hub where users log workouts, meals (breakfast, lunch, dinner, snack), hydration (water tracker), sleep schedules, and manual step increments.
2. **`Inventory` (`/inventory`)**: Displays claimed items and milestone rewards (Rare Candies, Vitamins, Leftovers, PP Max, Master Ball, Mystery Gifts), allows claiming unclaimed rewards from streaks/milestones, and allows using items on active Pokémon companions.
3. **`ToDo` (`/todo`)**: Dedicated task manager & habit tracker. Users can create one-time or repeatable custom tasks (e.g. "Finish homework", "Drink 2L water", "30-min workout"), filter by day (Today, Upcoming, All), category (Study, Fitness, Health, Work, Chores, Habit), or reward type (EXP, Friendship, EV, Item), and earn completion & streak milestone rewards.
4. **`Pokemon` (`/pokemon`)**: Deep stats breakdown showcasing:
   - **Gains Since Transfer**: Tracking levels, EXP, Friendship hearts, EV stats across all 6 stats (HP, Atk, Def, SpA, SpD, Spe), and total steps gained since import.
   - **Active Companion Selector**: Multi-Pokémon roster box support to switch active companions or import new ones.
   - **Evolution Chain & Moveset Viewer**: Interactive tabs to view the current Pokémon's level-up moves and all level-up moves of its evolutionary forms.

---

## User Customization & "For Nerds from a Nerd"

Every gameplay formula and mechanic is fully customizable:

### 1. EV Multi-Trigger Rules Engine
Users can configure and combine multiple rules to level up specific EVs from any daily activity:
- **Workout Types & Duration**: Map Cardio, Weightlifting, Core, HIIT, Yoga, Jogging, Swimming, Cycling, or Custom workouts to any EV stat (e.g. Weightlifting -> Attack EV; Cardio -> Speed EV).
- **Hydration (Water Logging)**: Log water cups to award HP EVs.
- **Healthy Meals**: Eating on a regular schedule awards defensive or HP EVs.
- **Daily Step Count Milestones**: Hitting step goals (e.g., 8,000 steps) awards Speed EVs.
- **Sleep Duration & Regularity**: Hitting target sleep hours awards Defense & Sp. Defense EVs.
- **ToDo Task Completion**: Completing category-specific tasks (e.g. Study -> Sp. Atk EV; Fitness -> Attack EV).

### 2. Item Rewards Customization
- **Global Toggle**: Enable or disable the entire item rewards system.
- **Reward Pool Configurator**: Customize which rewards are granted (Rare Candies, Vitamins, PP Max, Master Ball, Leftovers, EXP Share, Mystery Gifts).
- **Custom Triggers & Thresholds**: Set reward triggers globally and per-item based on Day Streaks, Steps, and Task milestones.

---

## Smartwatch Companion Architecture (Two-Boundary Sync Engine)

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

### 1. Communication Boundaries
* **Boundary A (`Android Host <-> Zepp Side Service`)**:
  - The Android app hosts a secure loopback server strictly bound to `127.0.0.1:8088`.
  - The Zepp Side Service (`watchos/app-side/index.js`) runs inside the official Zepp Android container and communicates with `127.0.0.1:8088` via `fetch()`.
  - **No Pokémon game logic lives in the Side Service.** It is purely a transport adapter.
* **Boundary B (`Zepp Side Service <-> Zepp Device App`)**:
  - Operates over Bluetooth Low Energy (BLE) via the official `@zeppos/zml` messaging protocol.
  - The watch app never makes HTTP requests directly.

### 2. Source of Truth & Monotonic State Versioning
* The Android application is the **sole authoritative source of truth**. It owns XP, levels, task completion, inventory, and rewards.
* Every state mutation on the phone increments a monotonic integer: `stateVersion`.
* The watch caches the state and records the latest `stateVersion`. Stale state versions (where `incomingVersion < cachedVersion`) are automatically dropped.

### 3. Durable Outbox & Idempotency
* Watch-originated mutations (e.g. task completion, water logging, step increments) are written to a **persistent durable outbox** on the watch (`poke_durable_outbox_v1`) before transmission.
* Every operation includes a unique `operationId`.
* When online, operations are sent immediately. When offline, operations remain safely stored on watch disk and flush sequentially upon reconnection.
* Android maintains a persistent `operationId` cache to guarantee **idempotency** (preventing duplicate XP or double rewards on retries).
* Operations are removed from the watch outbox **only** upon receiving an explicit `OPERATION_ACK` from Android.

### 4. Required Android Endpoints (`127.0.0.1:8088`)
- `GET /api/v1/health` - Server health status and current `stateVersion`.
- `GET /api/v1/state` - Full authoritative state snapshot.
- `GET /api/v1/sync?sinceVersion=N` - Incremental sync check (`changed: true/false`).
- `POST /api/v1/watch/operations` - Idempotent mutation execution with `OPERATION_ACK`.

---

## Developer Workflow & Building
- **Native Android build**: Navigate to `/mobile/android` and run `./gradlew assembleDebug` to produce `app-debug.apk`.
- **Zepp OS Mini-Program build**: Navigate to `/watchos` and run `npm run build` or `zeus build --target bip-6`.
- **Preview & Install**: In `/watchos`, run `npm run preview` and scan the QR code with the Zepp App Developer Mode scanner.
