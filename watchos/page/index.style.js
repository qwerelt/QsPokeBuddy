/**
 * Qs Poke Buddy - Exact UI Layout & Styles from ui_specs.md
 * Device target: Amazfit Bip 6 (390 x 450)
 * All positions strictly based on ui_specs.md:
 * - Top 60px reserved for native system header
 * - Main View: Shadow, Sprite, Name Tag, Lvl Tag, EXP Bar, Divider, Tasks Button
 * - Reward View: Info Center, 6 EV Buttons (HP, Atk, Def, SpA, SpD, Spe)
 * - Shared Top & Bottom Edges
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
  expGreen: 0x15ee9d,    // #15ee9d
  expBg: 0x222222,
  textWhite: 0xffffff,
  textGray: 0x707070
}

export const STYLES = {
  // Shared Components
  shared: {
    background: {
      x: 0,
      y: 60,
      w: 390,
      h: 390,
      color: COLORS.bgParchment
    },
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

  // Main View
  main: {
    shadow: {
      x: 35,
      y: 185,
      w: 96,
      h: 35,
      src: 'component_main_shadow.png'
    },
    sprite: {
      x: 35,
      y: 125,
      w: 96,
      h: 96
    },
    nameTagImg: {
      x: 250,
      y: 130,
      w: 130,
      h: 40,
      src: 'component_main_tag.png'
    },
    nameTagText: {
      x: 250,
      y: 138,
      w: 130,
      h: 26,
      color: COLORS.textWhite,
      text_size: 18
    },
    lvlTagImg: {
      x: 250,
      y: 180,
      w: 130,
      h: 40,
      src: 'component_main_tag.png'
    },
    lvlTagText: {
      x: 250,
      y: 188,
      w: 130,
      h: 26,
      color: COLORS.textWhite,
      text_size: 18
    },
    expBarBg: {
      x: 11,
      y: 251,
      w: 368,
      h: 8,
      color: COLORS.expBg
    },
    expBarFill: {
      x: 11,
      y: 251,
      w: 10,
      h: 8,
      color: COLORS.expGreen
    },
    divider: {
      x: 0,
      y: 240,
      w: 390,
      h: 30,
      src: 'component_main_decider.png'
    },
    taskButton: {
      x: 10,
      y: 280,
      w: 370,
      h: 120,
      normal_src: 'component_main_task.png',
      press_src: 'component_main_task.png'
    }
  },

  // Reward View
  reward: {
    info: {
      x: 135,
      y: 190,
      w: 120,
      h: 120,
      src: 'component_reward_info.png'
    },
    btnHp: {
      x: 30,
      y: 130,
      w: 60,
      h: 60,
      normal_src: 'component_reward_hp.png',
      press_src: 'component_reward_hp.png'
    },
    btnAtk: {
      x: 30,
      y: 220,
      w: 60,
      h: 60,
      normal_src: 'component_reward_atk.png',
      press_src: 'component_reward_atk.png'
    },
    btnDef: {
      x: 30,
      y: 310,
      w: 60,
      h: 60,
      normal_src: 'component_reward_def.png',
      press_src: 'component_reward_def.png'
    },
    btnSpa: {
      x: 300,
      y: 130,
      w: 60,
      h: 60,
      normal_src: 'component_reward_spa.png',
      press_src: 'component_reward_spa.png'
    },
    btnSpd: {
      x: 300,
      y: 220,
      w: 60,
      h: 60,
      normal_src: 'component_reward_spd.png',
      press_src: 'component_reward_spd.png'
    },
    btnSpe: {
      x: 300,
      y: 310,
      w: 60,
      h: 60,
      normal_src: 'component_reward_spe.png',
      press_src: 'component_reward_spe.png'
    }
  }
}
