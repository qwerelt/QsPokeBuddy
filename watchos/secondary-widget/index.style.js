/**
 * Qs Poke Buddy - Zepp OS Widget Styles (Pokéwalker Theme)
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

export const WIDGET_COLORS = {
  bgBlack: 0x000000,
  bgParchment: 0xffebbb,
  textWhite: 0xffffff,
  textTag: 0x707070,
  textMuted: 0x444444
}

export const WIDGET_STYLES = {
  shared: {
    edgeTop: {
      x: 0,
      y: 60,
      w: 390,
      h: 90,
      src: 'component_shared_edge_top.png'
    },
    edgeBot: {
      x: 0,
      y: 360,
      w: 390,
      h: 90,
      src: 'component_shared_edge_bot.png'
    }
  },

  shadow: {
    x: 35,
    y: 175,
    w: 80,
    h: 28,
    src: 'component_main_shadow.png'
  },

  sprite: {
    x: 35,
    y: 125,
    w: 80,
    h: 80
  },

  nameTagImg: {
    x: 230,
    y: 125,
    w: 130,
    h: 36,
    src: 'component_main_tag.png'
  },
  nameTagText: {
    x: 230,
    y: 132,
    w: 130,
    h: 24,
    color: WIDGET_COLORS.textWhite,
    text_size: 16
  },

  lvlTagImg: {
    x: 230,
    y: 168,
    w: 130,
    h: 36,
    src: 'component_main_tag.png'
  },
  lvlTagText: {
    x: 230,
    y: 175,
    w: 130,
    h: 24,
    color: WIDGET_COLORS.textWhite,
    text_size: 16
  },

  task1: {
    x: 15,
    y: 220,
    w: 360,
    h: 62,
    src: 'component_task_button.png'
  },
  task2: {
    x: 15,
    y: 290,
    w: 360,
    h: 62,
    src: 'component_task_button.png'
  }
}
