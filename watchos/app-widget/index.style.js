/**
 * Qs Poke Buddy - Zepp OS Shortcut Card Styles (Pokéwalker Theme)
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

export const CARD_COLORS = {
  bgParchment: 0xffebbb,
  textWhite: 0xffffff,
  textTag: 0x707070,
  textDark: 0x333333
}

const CARD_H = 150
const PAD = 8
const CARD_W = SCREEN_WIDTH - (PAD * 2)

export const CARD_STYLES = {
  cardBg: {
    x: PAD,
    y: PAD,
    w: CARD_W,
    h: CARD_H,
    radius: 12,
    color: CARD_COLORS.bgParchment
  },
  shadow: {
    x: PAD + 10,
    y: PAD + 80,
    w: 70,
    h: 24,
    src: 'component_main_shadow.png'
  },
  sprite: {
    x: PAD + 10,
    y: PAD + 24,
    w: 70,
    h: 70
  },
  nameTagImg: {
    x: PAD + 90,
    y: PAD + 24,
    w: 120,
    h: 34,
    src: 'component_main_tag.png'
  },
  nameTagText: {
    x: PAD + 90,
    y: PAD + 30,
    w: 120,
    h: 22,
    color: CARD_COLORS.textWhite,
    text_size: 15
  },
  lvlTagImg: {
    x: PAD + 90,
    y: PAD + 64,
    w: 120,
    h: 34,
    src: 'component_main_tag.png'
  },
  lvlTagText: {
    x: PAD + 90,
    y: PAD + 70,
    w: 120,
    h: 22,
    color: CARD_COLORS.textWhite,
    text_size: 15
  },
  topTaskText: {
    x: PAD + 218,
    y: PAD + 24,
    w: CARD_W - 228,
    h: 90,
    color: CARD_COLORS.textDark,
    text_size: 13
  }
}
