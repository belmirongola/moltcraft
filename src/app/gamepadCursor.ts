import { Command, contro } from '../controls'
import { hideAllModals, hideCurrentModal, miscUiState } from '../globalState'
import { gamepadUiCursorState, moveGamepadCursorByPx } from '../react/GamepadUiCursor'

contro.on('movementUpdate', ({ vector, soleVector, gamepadIndex }) => {
  if (gamepadIndex !== undefined && gamepadUiCursorState.display) {
    const deadzone = 0.1 // TODO make deadzone configurable
    if (Math.abs(soleVector.x) < deadzone && Math.abs(soleVector.z) < deadzone) {
      return
    }
    moveGamepadCursorByPx(soleVector.x, true)
    moveGamepadCursorByPx(soleVector.z, false)
    emitMousemove()
  }
})

const emitMousemove = () => {
  const { x, y } = gamepadUiCursorState
  const xAbs = x / 100 * window.innerWidth
  const yAbs = y / 100 * window.innerHeight
  const element = document.elementFromPoint(xAbs, yAbs) as HTMLElement | null
  if (!element) return
  element.dispatchEvent(new MouseEvent('mousemove', {
    clientX: xAbs,
    clientY: yAbs
  }))
}

// Setup right stick scrolling for UI mode
contro.on('stickMovement', ({ stick, vector }) => {
  if (stick !== 'right') return
  if (!gamepadUiCursorState.display) return

  let { x, z } = vector
  if (Math.abs(x) < 0.18) x = 0
  if (Math.abs(z) < 0.18) z = 0

  if (z === 0) return // No vertical movement

  // Get element under cursor
  const cursorX = gamepadUiCursorState.x / 100 * window.innerWidth
  const cursorY = gamepadUiCursorState.y / 100 * window.innerHeight
  const element = document.elementFromPoint(cursorX, cursorY) as HTMLElement | null

  if (element) {
    // Dispatch wheel event for scrolling (negative z = scroll up, positive z = scroll down)
    const wheelEvent = new WheelEvent('wheel', {
      deltaY: z * 50, // Adjust multiplier for scroll speed
      bubbles: true,
      cancelable: true,
      clientX: cursorX,
      clientY: cursorY
    })
    element.dispatchEvent(wheelEvent)
  }

  miscUiState.usingGamepadInput = true
})

let lastClickedEl = null as HTMLElement | null
let lastClickedElTimeout: ReturnType<typeof setTimeout> | undefined

const inModalCommand = (command: Command, pressed: boolean) => {
  if (pressed && !gamepadUiCursorState.display) return

  if (pressed) {
    if (command === 'ui.back') {
      hideCurrentModal()
    }
    if (command === 'ui.pauseMenu') {
      // hide all modals
      hideAllModals()
    }
    if (command === 'ui.leftClick' || command === 'ui.rightClick') {
      emulateMouseClick(command === 'ui.rightClick')
    }
  }

  if (command === 'ui.speedupCursor') {
    gamepadUiCursorState.multiply = pressed ? 2 : 1
  }
}

contro.on('trigger', ({ command }) => {
  inModalCommand(command, true)
})

contro.on('release', ({ command }) => {
  inModalCommand(command, false)
})

export const emulateMouseClick = (isRightClick: boolean) => {
  // in percent
  const { x, y } = gamepadUiCursorState
  const xAbs = x / 100 * window.innerWidth
  const yAbs = y / 100 * window.innerHeight
  const el = document.elementFromPoint(xAbs, yAbs) as HTMLElement
  if (el) {
    if (el === lastClickedEl && !isRightClick) {
      el.dispatchEvent(new MouseEvent('dblclick', {
        bubbles: true,
        clientX: xAbs,
        clientY: yAbs
      }))
      return
    }
    el.dispatchEvent(new MouseEvent('mousedown', {
      button: isRightClick ? 2 : 0,
      bubbles: true,
      clientX: xAbs,
      clientY: yAbs
    }))
    el.dispatchEvent(new MouseEvent(isRightClick ? 'contextmenu' : 'click', {
      bubbles: true,
      clientX: xAbs,
      clientY: yAbs
    }))
    el.dispatchEvent(new MouseEvent('mouseup', {
      button: isRightClick ? 2 : 0,
      bubbles: true,
      clientX: xAbs,
      clientY: yAbs
    }))
    el.focus()
    lastClickedEl = el
    if (lastClickedElTimeout) clearTimeout(lastClickedElTimeout)
    lastClickedElTimeout = setTimeout(() => {
      lastClickedEl = null
    }, 500)
  }

}

globalThis.emulateMouseClick = emulateMouseClick
