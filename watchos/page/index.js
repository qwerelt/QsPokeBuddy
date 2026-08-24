/**
 * Qs Poke Buddy - Zepp OS Main Companion Page
 * Implements exact UI & Navigation specifications from ui_specs.md:
 * - Top 60px reserved for native System Header
 * - Main View: Pokédex/Pokéwalker Frame, Shadow, Sprite, Name Tag, Lvl Tag, EXP Bar, Divider, Tasks Button
 * - Reward View (Swipe UP): Info component + 6 EV Buttons (HP, Atk, Def, SpA, SpD, Spe)
 * - Navigation: Swipe UP/DOWN between Main and Reward views; Click Tasks Button -> Tasks view
 * - High-reliability click handling with optimized Z-order
 */
import {
  createWidget,
  widget,
  prop,
  align,
  showToast,
  deleteWidget
} from '@zos/ui'
import { push } from '@zos/router'
import { onGesture, GESTURE_UP, GESTURE_DOWN } from '@zos/interaction'
import { rulesEngine, STAT_NAMES, EV_KEYS } from '../utils/rulesEngine'
import { getMessaging, requestFromAppSide, submitDurableOperation, flushOutbox } from '../utils/zmlBridge'
import { STYLES, COLORS, SCREEN_WIDTH, SCREEN_HEIGHT } from './index.style'

function safeCreate(type, params) {
  try {
    if (typeof createWidget === 'function') {
      return createWidget(type, params)
    } else if (typeof hmUI !== 'undefined' && typeof hmUI.createWidget === 'function') {
      return hmUI.createWidget(type, params)
    }
  } catch (e) {
    console.log('[UI] safeCreate error:', e)
  }
  return null
}

function safeDelete(w) {
  if (!w) return
  try {
    if (typeof deleteWidget === 'function') {
      deleteWidget(w)
    } else if (typeof hmUI !== 'undefined' && typeof hmUI.deleteWidget === 'function') {
      hmUI.deleteWidget(w)
    }
  } catch (_) {}
}

function safeToast(text) {
  try {
    if (typeof showToast === 'function') {
      showToast({ text })
    } else if (typeof hmUI !== 'undefined' && typeof hmUI.showToast === 'function') {
      hmUI.showToast({ text })
    }
  } catch (_) {}
}

const WIDGET_FILL_RECT = (widget && widget.FILL_RECT) || 2
const WIDGET_TEXT = (widget && widget.TEXT) || 1
const WIDGET_IMG = (widget && widget.IMG) || 3
const WIDGET_BUTTON = (widget && widget.BUTTON) || 4
const ALIGN_CENTER = (align && align.CENTER_H) || 2

Page({
  state: {
    currentView: 0, // 0 = Main View, 1 = Reward View
    activeWidgets: [],
    expFillWidget: null
  },

  onInit() {
    console.log('[MainPage] Initializing Qs Poke Buddy Companion')

    try {
      rulesEngine.setCallbacks({
        onStatsUpdated: () => this.renderCurrentView()
      })

      getMessaging({
        onCall: (req) => {
          if (req?.action === 'UPDATE_POKEMON' && req?.data) {
            rulesEngine.updateFromAuthoritativeState({ pokemon: req.data })
            this.renderCurrentView()
          }
        },
        onBleChanged: (connected) => {
          if (connected) {
            console.log('[MainPage] BLE reconnected, pulling latest state...')
            this.syncState()
          }
        }
      })
    } catch (e) {
      console.log('[MainPage] Init callback notice:', e)
    }

    // Register vertical swipe gestures (Swipe UP -> Reward view, Swipe DOWN -> Main view)
    try {
      if (typeof onGesture === 'function') {
        onGesture({
          callback: (event) => {
            if (event === GESTURE_UP && this.state.currentView === 0) {
              this.state.currentView = 1
              this.renderCurrentView()
              return true
            } else if (event === GESTURE_DOWN && this.state.currentView === 1) {
              this.state.currentView = 0
              this.renderCurrentView()
              return true
            }
          }
        })
      } else if (typeof hmApp !== 'undefined' && typeof hmApp.registerGestureEvent === 'function') {
        hmApp.registerGestureEvent((event) => {
          // 1: up, 2: down
          if (event === 1 && this.state.currentView === 0) {
            this.state.currentView = 1
            this.renderCurrentView()
          } else if (event === 2 && this.state.currentView === 1) {
            this.state.currentView = 0
            this.renderCurrentView()
          }
        })
      }
    } catch (e) {
      console.log('[MainPage] Gesture registration notice:', e)
    }
  },

  build() {
    console.log('[MainPage] Building companion view')
    this.renderCurrentView()
    this.syncState()
  },

  onDestroy() {
    this.clearActiveWidgets()
  },

  clearActiveWidgets() {
    if (this.state.activeWidgets && this.state.activeWidgets.length > 0) {
      this.state.activeWidgets.forEach(w => safeDelete(w))
      this.state.activeWidgets = []
    }
    if (this.state.expFillWidget) {
      safeDelete(this.state.expFillWidget)
      this.state.expFillWidget = null
    }
  },

  renderCurrentView() {
    this.clearActiveWidgets()
    const wList = []
    const pkm = rulesEngine.getPokemon() || {
      speciesId: 41,
      speciesName: 'Zubat',
      nickname: '',
      level: 5,
      currentExp: 0,
      expToNext: 150
    }
    const displayName = rulesEngine.getDisplayName()

    // 1. Top System Header Gap Background (Black y: 0 to 60)
    const headerGap = safeCreate(WIDGET_FILL_RECT, {
      x: 0,
      y: 0,
      w: SCREEN_WIDTH,
      h: 60,
      color: COLORS.bgBlack
    })
    if (headerGap) wList.push(headerGap)

    // 2. Shared Background (Parchment: #ffebbb, x: 0, y: 60, w: 390, h: 390)
    const bgParchment = safeCreate(WIDGET_FILL_RECT, STYLES.shared.background)
    if (bgParchment) wList.push(bgParchment)

    // 3. Shared Edge - Top (component_shared_edge_top.png, x: 0, y: 60, w: 390, h: 90)
    const edgeTop = safeCreate(WIDGET_IMG, STYLES.shared.edgeTop)
    if (edgeTop) wList.push(edgeTop)

    // 4. Shared Edge - Bot (component_shared_edge_bot.png, x: 0, y: 360, w: 390, h: 90)
    const edgeBot = safeCreate(WIDGET_IMG, STYLES.shared.edgeBot)
    if (edgeBot) wList.push(edgeBot)

    // 5. Render specific view components on top of background & edges
    if (this.state.currentView === 0) {
      this.renderMainView(wList, pkm, displayName)
    } else {
      this.renderRewardView(wList, pkm)
    }

    this.state.activeWidgets = wList
  },

  // =========================================================================
  // MAIN VIEW (Back to Front: Shadow, Sprite, Name Tag, Lvl Tag, EXP Bar, Divider, Task Button)
  // =========================================================================
  renderMainView(wList, pkm, displayName) {
    const m = STYLES.main

    // Shadow (x: 35, y: 185, w: 96, h: 35)
    const shadow = safeCreate(WIDGET_IMG, m.shadow)
    if (shadow) wList.push(shadow)

    // Pokemon Sprite (Max-size: 96 x 96, Center: x: 83, y: 173 -> Top-Left: x: 35, y: 125)
    const spritePath = pkm.speciesId ? `pkm_${pkm.speciesId}.png` : (pkm.spritePath || 'pokemon_default.png')
    const sprite = safeCreate(WIDGET_IMG, {
      x: m.sprite.x,
      y: m.sprite.y,
      w: m.sprite.w,
      h: m.sprite.h,
      src: spritePath
    })
    if (sprite) wList.push(sprite)

    // Name tag: Image (x: 250, y: 130, w: 130, h: 40)
    const nameTag = safeCreate(WIDGET_IMG, m.nameTagImg)
    if (nameTag) wList.push(nameTag)

    // Name tag Text (Centered on x: 315)
    const nameText = safeCreate(WIDGET_TEXT, {
      x: m.nameTagText.x,
      y: m.nameTagText.y,
      w: m.nameTagText.w,
      h: m.nameTagText.h,
      color: m.nameTagText.color,
      text_size: m.nameTagText.text_size,
      align_h: ALIGN_CENTER,
      text: displayName
    })
    if (nameText) wList.push(nameText)

    // Lvl tag: Image (x: 250, y: 180, w: 130, h: 40)
    const lvlTag = safeCreate(WIDGET_IMG, m.lvlTagImg)
    if (lvlTag) wList.push(lvlTag)

    // Lvl tag Text (Centered on x: 315)
    const lvlText = safeCreate(WIDGET_TEXT, {
      x: m.lvlTagText.x,
      y: m.lvlTagText.y,
      w: m.lvlTagText.w,
      h: m.lvlTagText.h,
      color: m.lvlTagText.color,
      text_size: m.lvlTagText.text_size,
      align_h: ALIGN_CENTER,
      text: `lvl. ${pkm.level}`
    })
    if (lvlText) wList.push(lvlText)

    // Exp Bar Background Track (x: 11, y: 251, max-width: 368, h: 8)
    const expBarBg = safeCreate(WIDGET_FILL_RECT, m.expBarBg)
    if (expBarBg) wList.push(expBarBg)

    // Exp Bar Fill (Color: #15ee9d)
    const expCur = pkm.currentExp !== undefined ? pkm.currentExp : (pkm.exp || 0)
    const expMax = pkm.expToNext || pkm.expToNextLevel || 100
    const expProgress = Math.min(1.0, Math.max(0, expCur / (expMax || 1)))
    const currentFillW = Math.max(2, Math.floor(m.expBarBg.w * expProgress))

    const expFill = safeCreate(WIDGET_FILL_RECT, {
      x: m.expBarFill.x,
      y: m.expBarFill.y,
      w: currentFillW,
      h: m.expBarFill.h,
      color: m.expBarFill.color
    })
    if (expFill) wList.push(expFill)

    // Divider (x: 0, y: 240, w: 390, h: 30)
    const divider = safeCreate(WIDGET_IMG, m.divider)
    if (divider) wList.push(divider)

    // Task button (x: 10, y: 280, w: 370, h: 120) - created LAST on top of z-index
    const taskBtn = safeCreate(WIDGET_BUTTON, {
      x: m.taskButton.x,
      y: m.taskButton.y,
      w: m.taskButton.w,
      h: m.taskButton.h,
      normal_src: m.taskButton.normal_src,
      press_src: m.taskButton.press_src,
      text: '',
      click_func: () => {
        console.log('[MainPage] Tasks button clicked -> pushing page/tasks')
        try {
          if (typeof push === 'function') {
            push({ url: 'page/tasks' })
          } else if (typeof hmApp !== 'undefined' && typeof hmApp.gotoPage === 'function') {
            hmApp.gotoPage({ url: 'page/tasks' })
          }
        } catch (e) {
          console.log('[MainPage] Task button navigation error:', e)
        }
      }
    })
    if (taskBtn) wList.push(taskBtn)
  },

  // =========================================================================
  // REWARD VIEW (Info Center + 6 EV Buttons) - Buttons created LAST on top
  // =========================================================================
  renderRewardView(wList, pkm) {
    const r = STYLES.reward

    // Center Info Component (x: 135, y: 190, w: 120, h: 120)
    const info = safeCreate(WIDGET_IMG, r.info)
    if (info) wList.push(info)

    // 1. HP button (x: 30, y: 130, w: 60, h: 60)
    const btnHp = safeCreate(WIDGET_BUTTON, {
      x: r.btnHp.x,
      y: r.btnHp.y,
      w: r.btnHp.w,
      h: r.btnHp.h,
      normal_src: r.btnHp.normal_src,
      press_src: r.btnHp.press_src,
      text: '',
      click_func: () => this.handleEvReward('hp', 'HP')
    })
    if (btnHp) wList.push(btnHp)

    // 2. Atk button (x: 30, y: 220, w: 60, h: 60)
    const btnAtk = safeCreate(WIDGET_BUTTON, {
      x: r.btnAtk.x,
      y: r.btnAtk.y,
      w: r.btnAtk.w,
      h: r.btnAtk.h,
      normal_src: r.btnAtk.normal_src,
      press_src: r.btnAtk.press_src,
      text: '',
      click_func: () => this.handleEvReward('attack', 'Attack')
    })
    if (btnAtk) wList.push(btnAtk)

    // 3. Def button (x: 30, y: 310, w: 60, h: 60)
    const btnDef = safeCreate(WIDGET_BUTTON, {
      x: r.btnDef.x,
      y: r.btnDef.y,
      w: r.btnDef.w,
      h: r.btnDef.h,
      normal_src: r.btnDef.normal_src,
      press_src: r.btnDef.press_src,
      text: '',
      click_func: () => this.handleEvReward('defense', 'Defense')
    })
    if (btnDef) wList.push(btnDef)

    // 4. SpA button (x: 300, y: 130, w: 60, h: 60)
    const btnSpa = safeCreate(WIDGET_BUTTON, {
      x: r.btnSpa.x,
      y: r.btnSpa.y,
      w: r.btnSpa.w,
      h: r.btnSpa.h,
      normal_src: r.btnSpa.normal_src,
      press_src: r.btnSpa.press_src,
      text: '',
      click_func: () => this.handleEvReward('specialAttack', 'Sp. Atk')
    })
    if (btnSpa) wList.push(btnSpa)

    // 5. SpD button (x: 300, y: 220, w: 60, h: 60)
    const btnSpd = safeCreate(WIDGET_BUTTON, {
      x: r.btnSpd.x,
      y: r.btnSpd.y,
      w: r.btnSpd.w,
      h: r.btnSpd.h,
      normal_src: r.btnSpd.normal_src,
      press_src: r.btnSpd.press_src,
      text: '',
      click_func: () => this.handleEvReward('specialDefense', 'Sp. Def')
    })
    if (btnSpd) wList.push(btnSpd)

    // 6. Spe button (x: 300, y: 310, w: 60, h: 60)
    const btnSpe = safeCreate(WIDGET_BUTTON, {
      x: r.btnSpe.x,
      y: r.btnSpe.y,
      w: r.btnSpe.w,
      h: r.btnSpe.h,
      normal_src: r.btnSpe.normal_src,
      press_src: r.btnSpe.press_src,
      text: '',
      click_func: () => this.handleEvReward('speed', 'Speed')
    })
    if (btnSpe) wList.push(btnSpe)
  },

  handleEvReward(statKey, statLabel) {
    console.log(`[MainPage] handleEvReward clicked for stat=${statKey}`)
    safeToast(`+1 ${statLabel} EV! 🎯`)

    // Optimistically update local watch state
    rulesEngine.addEvOptimistic(statKey, 1)

    // Submit durable outbox operation over BLE to Android
    submitDurableOperation('ADD_EV', {
      stat: statKey,
      statName: statLabel,
      amount: 1
    })
      .then(res => {
        console.log(`[MainPage] ADD_EV submission result for ${statKey}:`, res?.success ? 'ACK_OK' : 'QUEUED')
      })
      .catch(e => {
        console.log('[MainPage] ADD_EV submission notice:', e.message)
      })
  },

  syncState() {
    requestFromAppSide('GET_STATE')
      .then(res => {
        if (res && res.ok && res.payload) {
          const stateData = res.payload.state || res.payload
          const version = res.payload.stateVersion || stateData.stateVersion
          rulesEngine.updateFromAuthoritativeState(stateData, version)
          this.renderCurrentView()
          flushOutbox()
        }
      })
      .catch(err => {
        console.log('[MainPage] GET_STATE error (using cached state):', err.message)
      })
  }
})
