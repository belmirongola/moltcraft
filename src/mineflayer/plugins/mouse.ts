import { createMouse } from 'mineflayer-mouse'
import { Bot } from 'mineflayer'
import { Block } from 'prismarine-block'
import { getThreeJsRendererMethods } from 'renderer/viewer/three/threeJsMethods'
import { isGameActive, showModal } from '../../globalState'

import { isCypress } from '../../standaloneUtils'
import { playerState } from '../playerState'
import { sendVideoInteraction, videoCursorInteraction } from '../../customChannels'

function cursorBlockDisplay (bot: Bot) {
  const updateCursorBlock = (data?: { block: Block }) => {
    if (!data?.block) {
      getThreeJsRendererMethods()?.setHighlightCursorBlock(null)
      return
    }

    const { block } = data
    getThreeJsRendererMethods()?.setHighlightCursorBlock(block.position, bot.mouse.getBlockCursorShapes(block).map(shape => {
      return bot.mouse.getDataFromShape(shape)
    }))
  }

  bot.on('highlightCursorBlock', updateCursorBlock)

  bot.on('blockBreakProgressStage', (block, stage) => {
    getThreeJsRendererMethods()?.updateBreakAnimation(block, stage)
  })
}

export default (bot: Bot) => {
  bot.loadPlugin(createMouse({}))

  domListeners(bot)
  cursorBlockDisplay(bot)

  otherListeners()
}

const otherListeners = () => {
  bot.on('startDigging', (block) => {
    customEvents.emit('digStart')
  })

  bot.on('goingToSleep', () => {
    showModal({ reactType: 'bed' })
  })

  bot.on('botArmSwingStart', (hand) => {
    getThreeJsRendererMethods()?.changeHandSwingingState(true, hand === 'left')
  })

  bot.on('botArmSwingEnd', (hand) => {
    getThreeJsRendererMethods()?.changeHandSwingingState(false, hand === 'left')
  })

  bot.on('startUsingItem', (item, slot, isOffhand, duration) => {
    customEvents.emit('activateItem', item, isOffhand ? 45 : bot.quickBarSlot, isOffhand)
    playerState.startUsingItem()
  })

  bot.on('stopUsingItem', () => {
    playerState.stopUsingItem()
  })
}

const domListeners = (bot: Bot) => {
  document.addEventListener('mousedown', (e) => {
    if (e.isTrusted && !document.pointerLockElement && !isCypress()) return
    if (!isGameActive(true)) return

    const videoInteraction = videoCursorInteraction()
    if (videoInteraction) {
      sendVideoInteraction(videoInteraction.id, videoInteraction.x, videoInteraction.y, e.button === 0)
      return
    }

    if (e.button === 0) {
      bot.leftClickStart()
    } else if (e.button === 2) {
      bot.rightClickStart()
    }
  })

  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      bot.leftClickEnd()
    } else if (e.button === 2) {
      bot.rightClickEnd()
    }
  })

  bot.mouse.beforeUpdateChecks = () => {
    if (!document.hasFocus()) {
      // deactive all buttons
      bot.mouse.buttons.fill(false)
    }
  }
}
