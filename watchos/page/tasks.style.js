/**
 * Qs Poke Buddy - Tasks View Layout & Styles from ui_specs.md
 * Device target: Amazfit Bip 6 (390 x 450)
 * All positions strictly based on ui_specs.md:
 * - Shared Top Edge at (x: 0, y: 60)
 * - First task button at (x: 15, y: 160)
 * - Size: 360 x 90, Spacing: 10px
 * - task_name (Horizontal Center x: 195, Vertical: top + 15px)
 * - task_tag (Horizontal Center x: 105, Vertical: top + 50px)
 * - task_reward (Horizontal Center x: 285, Vertical: top + 50px)
 * - Shared Bot Edge positioned below task list (minimum y: 360)
 */
import { getDeviceInfo } from '@zos/device'

let devInfo = { width: 390, height: 450 }
try {
  if (typeof getDeviceInfo === 'function') {
    devInfo = getDeviceInfo() || devInfo
  } else if (typeof hmSetting !== 'undefined' && typeof hmSetting.getDeviceInfo === 'function') {
    devInfo = hmSetting.getDeviceInfo() || devInfo
  }
} catch (_) {}

export const SCREEN_WIDTH = devInfo.width || 390
export const SCREEN_HEIGHT = devInfo.height || 450

export const COLORS = {
  bgBlack: 0x000000,
  bgParchment: 0xffebbb, // #ffebbb
  textWhite: 0xffffff,
  textTag: 0x707070,     // #707070
  textMuted: 0x888888
}

export const TASK_STYLES = {
  shared: {
    edgeTop: {
      x: 0,
      y: 60,
      w: 390,
      h: 90,
      src: 'component_shared_edge_top.png'
    },
    edgeBot: {
      w: 390,
      h: 90,
      src: 'component_shared_edge_bot.png'
    }
  },

  list: {
    startX: 15,
    startY: 160,
    w: 360,
    h: 90,
    gap: 10,
    src: 'component_task_button.png'
  },

  nameOffset: {
    y: 15,
    h: 28,
    font_size: 20
  },

  tagOffset: {
    x: 15,
    w: 180,
    y: 50,
    h: 26,
    font_size: 16
  },

  rewardOffset: {
    x: 195,
    w: 180,
    y: 50,
    h: 26,
    font_size: 16
  }
}
