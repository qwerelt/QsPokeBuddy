/**
 * Qs Poke Buddy - Zepp OS Widget (Secondary Widget)
 * Pokédex / Pokéwalker Aesthetic with component assets.
 */
import {
  createWidget,
  widget,
  align
} from '@zos/ui'
import { push } from '@zos/router'
import { rulesEngine } from '../utils/rulesEngine'
import { requestFromAppSide, flushOutbox } from '../utils/zmlBridge'
import { WIDGET_STYLES, WIDGET_COLORS, SCREEN_WIDTH, SCREEN_HEIGHT } from './index.style'

function safeCreate(type, params) {
  try {
    if (typeof createWidget === 'function') {
      return createWidget(type, params)
    } else if (typeof hmUI !== 'undefined' && typeof hmUI.createWidget === 'function') {
      return hmUI.createWidget(type, params)
    }
  } catch (e) {
    console.log('[Widget] safeCreate notice:', e)
  }
  return null
}

const WIDGET_FILL_RECT = (widget && widget.FILL_RECT) || 2
const WIDGET_TEXT = (widget && widget.TEXT) || 1
const WIDGET_IMG = (widget && widget.IMG) || 3
const WIDGET_BUTTON = (widget && widget.BUTTON) || 4
const ALIGN_LEFT = (align && align.LEFT) || 0
const ALIGN_CENTER = (align && align.CENTER_H) || 2

SecondaryWidget({
  state: {
    widgets: {}
  },

  onInit() {
    console.log('[Widget] Initialized')
    this.syncState()
  },

  build() {
    const pkm = rulesEngine.getPokemon()
    const displayName = rulesEngine.getDisplayName()
    const availableTasks = rulesEngine.getOrderedAvailableTasks()

    // 1. Top Gap Background (Black y: 0 to 60)
    safeCreate(WIDGET_FILL_RECT, {
      x: 0,
      y: 0,
      w: SCREEN_WIDTH,
      h: 60,
      color: WIDGET_COLORS.bgBlack
    })

    // 2. Parchment Background (y: 60 to 450)
    safeCreate(WIDGET_FILL_RECT, {
      x: 0,
      y: 60,
      w: SCREEN_WIDTH,
      h: 390,
      color: WIDGET_COLORS.bgParchment
    })

    // 3. Shared Edge - Top (x: 0, y: 60, w: 390, h: 90)
    safeCreate(WIDGET_IMG, WIDGET_STYLES.shared.edgeTop)

    // 4. Shared Edge - Bot (x: 0, y: 360, w: 390, h: 90)
    safeCreate(WIDGET_IMG, WIDGET_STYLES.shared.edgeBot)

    // 5. Shadow & Sprite
    safeCreate(WIDGET_IMG, WIDGET_STYLES.shadow)

    const spritePath = pkm?.speciesId ? `pkm_${pkm.speciesId}.png` : (pkm?.spritePath || 'pokemon_default.png')
    safeCreate(WIDGET_IMG, {
      x: WIDGET_STYLES.sprite.x,
      y: WIDGET_STYLES.sprite.y,
      w: WIDGET_STYLES.sprite.w,
      h: WIDGET_STYLES.sprite.h,
      src: spritePath
    })

    // 6. Name Tag & Lvl Tag
    safeCreate(WIDGET_IMG, WIDGET_STYLES.nameTagImg)
    safeCreate(WIDGET_TEXT, {
      x: WIDGET_STYLES.nameTagText.x,
      y: WIDGET_STYLES.nameTagText.y,
      w: WIDGET_STYLES.nameTagText.w,
      h: WIDGET_STYLES.nameTagText.h,
      color: WIDGET_STYLES.nameTagText.color,
      text_size: WIDGET_STYLES.nameTagText.text_size,
      align_h: ALIGN_CENTER,
      text: displayName
    })

    safeCreate(WIDGET_IMG, WIDGET_STYLES.lvlTagImg)
    safeCreate(WIDGET_TEXT, {
      x: WIDGET_STYLES.lvlTagText.x,
      y: WIDGET_STYLES.lvlTagText.y,
      w: WIDGET_STYLES.lvlTagText.w,
      h: WIDGET_STYLES.lvlTagText.h,
      color: WIDGET_STYLES.lvlTagText.color,
      text_size: WIDGET_STYLES.lvlTagText.text_size,
      align_h: ALIGN_CENTER,
      text: `lvl. ${pkm?.level || 1}`
    })

    // 7. Top 2 Objectives
    if (availableTasks.length === 0) {
      safeCreate(WIDGET_TEXT, {
        x: 15,
        y: 250,
        w: 360,
        h: 50,
        color: WIDGET_COLORS.textTag,
        text_size: 16,
        align_h: ALIGN_CENTER,
        text: 'All quests completed! ⭐'
      })
    } else {
      const task1 = availableTasks[0]
      const btn1 = safeCreate(WIDGET_BUTTON, {
        x: WIDGET_STYLES.task1.x,
        y: WIDGET_STYLES.task1.y,
        w: WIDGET_STYLES.task1.w,
        h: WIDGET_STYLES.task1.h,
        normal_src: WIDGET_STYLES.task1.src,
        press_src: WIDGET_STYLES.task1.src,
        text: '',
        click_func: () => this.openCompanion()
      })

      safeCreate(WIDGET_TEXT, {
        x: WIDGET_STYLES.task1.x,
        y: WIDGET_STYLES.task1.y + 12,
        w: WIDGET_STYLES.task1.w,
        h: 22,
        color: WIDGET_COLORS.textWhite,
        text_size: 16,
        align_h: ALIGN_CENTER,
        text: task1.title
      })

      safeCreate(WIDGET_TEXT, {
        x: WIDGET_STYLES.task1.x,
        y: WIDGET_STYLES.task1.y + 36,
        w: WIDGET_STYLES.task1.w,
        h: 20,
        color: WIDGET_COLORS.textTag,
        text_size: 13,
        align_h: ALIGN_CENTER,
        text: `[${task1.category || 'Quest'}] ${task1.reward || '+Reward'}`
      })

      if (availableTasks.length > 1) {
        const task2 = availableTasks[1]
        safeCreate(WIDGET_BUTTON, {
          x: WIDGET_STYLES.task2.x,
          y: WIDGET_STYLES.task2.y,
          w: WIDGET_STYLES.task2.w,
          h: WIDGET_STYLES.task2.h,
          normal_src: WIDGET_STYLES.task2.src,
          press_src: WIDGET_STYLES.task2.src,
          text: '',
          click_func: () => this.openCompanion()
        })

        safeCreate(WIDGET_TEXT, {
          x: WIDGET_STYLES.task2.x,
          y: WIDGET_STYLES.task2.y + 12,
          w: WIDGET_STYLES.task2.w,
          h: 22,
          color: WIDGET_COLORS.textWhite,
          text_size: 16,
          align_h: ALIGN_CENTER,
          text: task2.title
        })

        safeCreate(WIDGET_TEXT, {
          x: WIDGET_STYLES.task2.x,
          y: WIDGET_STYLES.task2.y + 36,
          w: WIDGET_STYLES.task2.w,
          h: 20,
          color: WIDGET_COLORS.textTag,
          text_size: 13,
          align_h: ALIGN_CENTER,
          text: `[${task2.category || 'Quest'}] ${task2.reward || '+Reward'}`
        })
      }
    }
  },

  openCompanion() {
    try {
      if (typeof push === 'function') {
        push({ url: 'page/index' })
      } else if (typeof hmApp !== 'undefined' && typeof hmApp.gotoPage === 'function') {
        hmApp.gotoPage({ url: 'page/index' })
      }
    } catch (e) {
      console.log('[Widget] Open companion error:', e)
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
        console.log('[Widget] Sync notice:', e.message)
      })
  },

  onDestroy() {
    console.log('[Widget] Destroyed')
  }
})
