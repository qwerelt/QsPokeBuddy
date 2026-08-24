/**
 * Qs Poke Buddy - Zepp OS Dedicated Tasks Screen
 * Implements exact UI & Interaction specifications from ui_specs.md:
 * - Shared Top Edge at (x: 0, y: 60)
 * - Task list starting at (x: 15, y: 160), 360 x 90 button cards with 10px spacing
 * - Task Name (Centered x: 195, y: top + 15px, white)
 * - Task Tag (Centered x: 105, y: top + 50px, #707070)
 * - Task Reward (Centered x: 285, y: top + 50px, #707070)
 * - Shared Bot Edge at bottom of list (minimum y: 360)
 * - Top-layer transparent hit target covering entire 360x90 card for 100% reliable clicks
 */
import {
  createWidget,
  widget,
  prop,
  align,
  showToast,
  deleteWidget
} from '@zos/ui'
import { back } from '@zos/router'
import { rulesEngine } from '../utils/rulesEngine'
import { requestFromAppSide, submitDurableOperation, flushOutbox } from '../utils/zmlBridge'
import { TASK_STYLES, COLORS, SCREEN_WIDTH, SCREEN_HEIGHT } from './tasks.style'

function safeCreate(type, params) {
  try {
    if (typeof createWidget === 'function') {
      return createWidget(type, params)
    } else if (typeof hmUI !== 'undefined' && typeof hmUI.createWidget === 'function') {
      return hmUI.createWidget(type, params)
    }
  } catch (e) {
    console.log('[TasksPage] safeCreate error:', e)
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

function formatTaskReward(task) {
  if (task.reward) return task.reward
  if (task.rewardConfig) {
    if (task.rewardConfig.expAmount) return `+${task.rewardConfig.expAmount} EXP`
    if (task.rewardConfig.friendshipAmount) return `+${task.rewardConfig.friendshipAmount} Bond`
    if (task.rewardConfig.evStat) return `+${task.rewardConfig.evAmount || 1} ${task.rewardConfig.evStat} EV`
    if (task.rewardConfig.itemType) return `+1 Item`
  }
  if (task.rewardType === 'exp') return '+50 EXP'
  return '+Reward'
}

const WIDGET_FILL_RECT = (widget && widget.FILL_RECT) || 2
const WIDGET_TEXT = (widget && widget.TEXT) || 1
const WIDGET_IMG = (widget && widget.IMG) || 3
const WIDGET_BUTTON = (widget && widget.BUTTON) || 4
const ALIGN_CENTER = (align && align.CENTER_H) || 2

Page({
  state: {
    widgets: [],
    pendingTaskIds: new Set()
  },

  onInit() {
    console.log('[TasksPage] Initialized Tasks Screen')
  },

  build() {
    this.renderTaskList()
    this.syncTasks()
  },

  onDestroy() {
    this.clearWidgets()
  },

  clearWidgets() {
    if (this.state.widgets && this.state.widgets.length > 0) {
      this.state.widgets.forEach(w => safeDelete(w))
      this.state.widgets = []
    }
  },

  renderTaskList() {
    this.clearWidgets()
    const wList = []
    const tasks = rulesEngine.getOrderedAvailableTasks()

    // Compute dynamic layout height
    const taskCount = tasks.length
    const listBottom = taskCount > 0
      ? TASK_STYLES.list.startY + taskCount * (TASK_STYLES.list.h + TASK_STYLES.list.gap)
      : 300

    const botEdgeY = taskCount >= 3 ? listBottom : 360
    const totalPageHeight = Math.max(SCREEN_HEIGHT, botEdgeY + 90)

    // 1. Top System Header Gap (Black y: 0 to 60)
    const headerGap = safeCreate(WIDGET_FILL_RECT, {
      x: 0,
      y: 0,
      w: SCREEN_WIDTH,
      h: 60,
      color: COLORS.bgBlack
    })
    if (headerGap) wList.push(headerGap)

    // 2. Parchment Background (y: 60 to totalPageHeight)
    const bgParchment = safeCreate(WIDGET_FILL_RECT, {
      x: 0,
      y: 60,
      w: SCREEN_WIDTH,
      h: totalPageHeight - 60,
      color: COLORS.bgParchment
    })
    if (bgParchment) wList.push(bgParchment)

    // 3. Shared Edge - Top (x: 0, y: 60, w: 390, h: 90)
    const edgeTop = safeCreate(WIDGET_IMG, TASK_STYLES.shared.edgeTop)
    if (edgeTop) wList.push(edgeTop)

    // 4. Task Items
    if (taskCount === 0) {
      const emptyMsg = safeCreate(WIDGET_TEXT, {
        x: 15,
        y: 200,
        w: 360,
        h: 60,
        color: COLORS.textTag,
        text_size: 18,
        align_h: ALIGN_CENTER,
        text: 'All tasks completed today! ⭐'
      })
      if (emptyMsg) wList.push(emptyMsg)
    } else {
      tasks.forEach((task, idx) => {
        const taskY = TASK_STYLES.list.startY + idx * (TASK_STYLES.list.h + TASK_STYLES.list.gap)

        // Layer A: Card Background Image (component_task_button.png, 360 x 90)
        const cardImg = safeCreate(WIDGET_IMG, {
          x: TASK_STYLES.list.startX,
          y: taskY,
          w: TASK_STYLES.list.w,
          h: TASK_STYLES.list.h,
          src: TASK_STYLES.list.src
        })
        if (cardImg) wList.push(cardImg)

        // Layer B: Task Name (Centered horizontally on x: 195, y: taskY + 15)
        const nameText = safeCreate(WIDGET_TEXT, {
          x: TASK_STYLES.list.startX,
          y: taskY + TASK_STYLES.nameOffset.y,
          w: TASK_STYLES.list.w,
          h: TASK_STYLES.nameOffset.h,
          color: COLORS.textWhite,
          text_size: TASK_STYLES.nameOffset.font_size,
          align_h: ALIGN_CENTER,
          text: task.title || 'Task'
        })
        if (nameText) wList.push(nameText)

        // Layer C: Task Tag (Centered horizontally on x: 105, y: taskY + 50)
        const tagLabel = task.category || (task.isHydration ? 'Health' : 'General')
        const tagText = safeCreate(WIDGET_TEXT, {
          x: TASK_STYLES.tagOffset.x,
          y: taskY + TASK_STYLES.tagOffset.y,
          w: TASK_STYLES.tagOffset.w,
          h: TASK_STYLES.tagOffset.h,
          color: COLORS.textTag,
          text_size: TASK_STYLES.tagOffset.font_size,
          align_h: ALIGN_CENTER,
          text: tagLabel
        })
        if (tagText) wList.push(tagText)

        // Layer D: Task Reward (Centered horizontally on x: 285, y: taskY + 50)
        const rewardLabel = formatTaskReward(task)
        const rewardText = safeCreate(WIDGET_TEXT, {
          x: TASK_STYLES.rewardOffset.x,
          y: taskY + TASK_STYLES.rewardOffset.y,
          w: TASK_STYLES.rewardOffset.w,
          h: TASK_STYLES.rewardOffset.h,
          color: COLORS.textTag,
          text_size: TASK_STYLES.rewardOffset.font_size,
          align_h: ALIGN_CENTER,
          text: rewardLabel
        })
        if (rewardText) wList.push(rewardText)

        // Layer E: Topmost Transparent Click Hit Target (covers full 360x90 card)
        const hitButton = safeCreate(WIDGET_BUTTON, {
          x: TASK_STYLES.list.startX,
          y: taskY,
          w: TASK_STYLES.list.w,
          h: TASK_STYLES.list.h,
          text: '',
          click_func: () => {
            console.log(`[TasksPage] Task clicked: id=${task.id} title="${task.title}"`)
            this.handleTaskClick(task)
          }
        })
        if (hitButton) wList.push(hitButton)
      })
    }

    // 5. Shared Edge - Bot (component_shared_edge_bot.png, x: 0, y: botEdgeY, w: 390, h: 90)
    const edgeBot = safeCreate(WIDGET_IMG, {
      x: 0,
      y: botEdgeY,
      w: TASK_STYLES.shared.edgeBot.w,
      h: TASK_STYLES.shared.edgeBot.h,
      src: TASK_STYLES.shared.edgeBot.src
    })
    if (edgeBot) wList.push(edgeBot)

    this.state.widgets = wList
  },

  handleTaskClick(task) {
    if (this.state.pendingTaskIds.has(task.id)) {
      safeToast('Task in progress...')
      return
    }

    if (task.isHydration) {
      this.state.pendingTaskIds.add(task.id)
      safeToast('Logged Water! 💧')
      rulesEngine.completeTaskOptimistic(task.id)
      this.renderTaskList()

      submitDurableOperation('WATER_LOG', { cups: 1 })
        .then(res => {
          this.state.pendingTaskIds.delete(task.id)
          if (res && res.success) {
            safeToast('Water recorded! 💧 (+10 EXP)')
          }
          this.renderTaskList()
        })
        .catch(() => {
          this.state.pendingTaskIds.delete(task.id)
          this.renderTaskList()
        })
      return
    }

    this.state.pendingTaskIds.add(task.id)
    safeToast(`Completing: ${task.title}...`)
    rulesEngine.completeTaskOptimistic(task.id)
    this.renderTaskList()

    submitDurableOperation('COMPLETE_TASK', { taskId: task.id })
      .then(res => {
        this.state.pendingTaskIds.delete(task.id)
        if (res && res.success) {
          safeToast(`Completed: ${task.title}! ⭐`)
        }
        this.renderTaskList()
      })
      .catch(() => {
        this.state.pendingTaskIds.delete(task.id)
        this.renderTaskList()
      })
  },

  syncTasks() {
    requestFromAppSide('GET_STATE')
      .then(res => {
        if (res && res.ok && res.payload) {
          const stateData = res.payload.state || res.payload
          const version = res.payload.stateVersion || stateData.stateVersion
          rulesEngine.updateFromAuthoritativeState(stateData, version)
          this.renderTaskList()
          flushOutbox()
        }
      })
      .catch(e => {
        console.log('[TasksPage] Sync error:', e.message)
      })
  }
})
