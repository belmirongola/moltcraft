import { contro } from './controls'
import { activeModalStack, isGameActive, miscUiState, showModal } from './globalState'
import { options } from './optionsStorage'
import { hideNotification, notificationProxy } from './react/NotificationProvider'
import { pointerLock } from './utils'
import worldInteractions from './worldInteractions'

let lastMouseMove: number

export const updateCursor = () => {
  worldInteractions.update()
}

export type CameraMoveEvent = {
  movementX: number
  movementY: number
  type: string
  stopPropagation?: () => void
}

export function onCameraMove (e: MouseEvent | CameraMoveEvent) {
  if (!isGameActive(true)) return
  if (e.type === 'mousemove' && !document.pointerLockElement) return
  e.stopPropagation?.()
  const now = performance.now()
  // todo: limit camera movement for now to avoid unexpected jumps
  if (now - lastMouseMove < 4) return
  lastMouseMove = now
  let { mouseSensX, mouseSensY } = options
  if (mouseSensY === -1) mouseSensY = mouseSensX
  moveCameraRawHandler({
    x: e.movementX * mouseSensX * 0.0001,
    y: e.movementY * mouseSensY * 0.0001
  })
  updateCursor()
}

export const moveCameraRawHandler = ({ x, y }: { x: number; y: number }) => {
  const maxPitch = 0.5 * Math.PI
  const minPitch = -0.5 * Math.PI

  viewer.world.lastCamUpdate = Date.now()
  if (!bot?.entity) return
  const pitch = bot.entity.pitch - y
  void bot.look(bot.entity.yaw - x, Math.max(minPitch, Math.min(maxPitch, pitch)), true)
}


window.addEventListener('mousemove', (e: MouseEvent) => {
  onCameraMove(e)
}, { capture: true })

export const onControInit = () => {
  contro.on('stickMovement', ({ stick, vector }) => {
    if (!isGameActive(true)) return
    if (stick !== 'right') return
    let { x, z } = vector
    if (Math.abs(x) < 0.18) x = 0
    if (Math.abs(z) < 0.18) z = 0
    onCameraMove({
      movementX: x * 10,
      movementY: z * 10,
      type: 'stickMovement',
      stopPropagation () {}
    } as CameraMoveEvent)
    miscUiState.usingGamepadInput = true
  })
}

function pointerLockChangeCallback () {
  if (notificationProxy.id === 'pointerlockchange') {
    hideNotification()
  }
  if (viewer.renderer.xr.isPresenting) return // todo
  if (!pointerLock.hasPointerLock && activeModalStack.length === 0) {
    showModal({ reactType: 'pause-screen' })
  }
}

document.addEventListener('pointerlockchange', pointerLockChangeCallback, false)
