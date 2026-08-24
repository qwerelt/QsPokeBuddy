/**
 * Qs Poke Buddy - Zepp OS Shortcut Card (AppWidget)
 */
import {
  createWidget,
  widget,
  align
} from '@zos/ui'
import { push } from '@zos/router'
import { rulesEngine } from '../utils/rulesEngine'
import { requestFromAppSide, flushOutbox } from '../utils/zmlBridge'
import { CARD_STYLES, CARD_COLORS, SCREEN_WIDTH } from './index.style'

function safeCreate(type, params) {
  try {
    if (typeof createWidget === 'function') {
      return createWidget(type, params)
    } else if (typeof hmUI !== 'undefined' && typeof hmUI.createWidget === 'function') {
      return hmUI.createWidget(type, params)
    }
  } catch (e) {
    console.log('[ShortcutCard] safeCreate notice:', e)
  }
  return null
}

const WIDGET_FILL_RECT = (widget && widget.FILL_RECT) || 2
const WIDGET_TEXT = (widget && widget.TEXT) || 1
const WIDGET_IMG = (widget && widget.IMG) || 3
const WIDGET_BUTTON = (widget && widget.BUTTON) || 4
const ALIGN_LEFT = (align && align.LEFT) || 0
const ALIGN_CENTER = (align && align.CENTER_H) || 2

AppWidget({
  state: {
    widgets: {}
  },

  onInit() {
    console.log('[ShortcutCard] Initialized')
    this.syncState()
  },

  build() {
    const pkm = rulesEngine.getPokemon()
    const displayName = rulesEngine.getDisplayName()
    const availableTasks = rulesEngine.getOrderedAvailableTasks()

    // 1. Background Card (Clickable to open companion)
    safeCreate(WIDGET_BUTTON, {
      x: CARD_STYLES.cardBg.x,
      y: CARD_STYLES.cardBg.y,
      w: CARD_STYLES.cardBg.w,
      h: CARD_STYLES.cardBg.h,
      radius: CARD_STYLES.cardBg.radius,
      normal_color: CARD_STYLES.cardBg.color,
      press_color: 0xf5ddaa,
      text: '',
      click_func: () => this.openCompanion()
    })

    // 2. Shadow & Sprite
    safeCreate(WIDGET_IMG, CARD_STYLES.shadow)

    const spritePath = pkm?.speciesId ? `pkm_${pkm.speciesId}.png` : (pkm?.spritePath || 'pokemon_default.png')
    safeCreate(WIDGET_IMG, {
      x: CARD_STYLES.sprite.x,
      y: CARD_STYLES.sprite.y,
      w: CARD_STYLES.sprite.w,
      h: CARD_STYLES.sprite.h,
      src: spritePath
    })

    // 3. Name & Level Tags
    safeCreate(WIDGET_IMG, CARD_STYLES.nameTagImg)
    safeCreate(WIDGET_TEXT, {
      x: CARD_STYLES.nameTagText.x,
      y: CARD_STYLES.nameTagText.y,
      w: CARD_STYLES.nameTagText.w,
      h: CARD_STYLES.nameTagText.h,
      color: CARD_STYLES.nameTagText.color,
      text_size: CARD_STYLES.nameTagText.text_size,
      align_h: ALIGN_CENTER,
      text: displayName
    })

    safeCreate(WIDGET_IMG, CARD_STYLES.lvlTagImg)
    safeCreate(WIDGET_TEXT, {
      x: CARD_STYLES.lvlTagText.x,
      y: CARD_STYLES.lvlTagText.y,
      w: CARD_STYLES.lvlTagText.w,
      h: CARD_STYLES.lvlTagText.h,
      color: CARD_STYLES.lvlTagText.color,
      text_size: CARD_STYLES.lvlTagText.text_size,
      align_h: ALIGN_CENTER,
      text: `lvl. ${pkm?.level || 1}`
    })

    // 4. Right Task Preview
    const topTask = availableTasks.length > 0 ? availableTasks[0] : null
    const taskContent = topTask
      ? `Top Task:\n${topTask.title}\n[${topTask.category || 'Quest'}]`
      : 'All Tasks\nCompleted! ⭐'

    safeCreate(WIDGET_TEXT, {
      x: CARD_STYLES.topTaskText.x,
      y: CARD_STYLES.topTaskText.y,
      w: CARD_STYLES.topTaskText.w,
      h: CARD_STYLES.topTaskText.h,
      color: CARD_STYLES.topTaskText.color,
      text_size: CARD_STYLES.topTaskText.text_size,
      align_h: ALIGN_LEFT,
      text: taskContent
    })
  },

  openCompanion() {
    try {
      if (typeof push === 'function') {
        push({ url: 'page/index' })
      } else if (typeof hmApp !== 'undefined' && typeof hmApp.gotoPage === 'function') {
        hmApp.gotoPage({ url: 'page/index' })
      }
    } catch (e) {
      console.log('[ShortcutCard] Open companion error:', e)
    }
  },

  syncState() {
    requestFromAppSide('GET_STATE')
      .then(res => {
        if (res && res.ok && res.payload) {
          const stateData = res.payload.state || res.payload
          const version = res.payload.stateVersion || stateData.stateVersion
          rulesEngine.updateFromAuthoritativeState(stateData, version)
          flushOutbox()
        }
      })
      .catch(e => {
        console.log('[ShortcutCard] Sync notice:', e.message)
      })
  },

  onDestroy() {
    console.log('[ShortcutCard] Destroyed')
  }
})
