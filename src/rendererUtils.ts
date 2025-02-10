import { subscribeKey } from 'valtio/utils'
import { gameAdditionalState } from './globalState'
import { options } from './optionsStorage'

let currentFov = 0
let targetFov = 0
let lastUpdateTime = 0
const FOV_TRANSITION_DURATION = 200 // milliseconds

const updateFovAnimation = () => {
  if (currentFov === targetFov) return

  const now = performance.now()
  const elapsed = now - lastUpdateTime
  const progress = Math.min(elapsed / FOV_TRANSITION_DURATION, 1)

  // Smooth easing function
  const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

  currentFov += (targetFov - currentFov) * easeOutCubic(progress)

  if (Math.abs(currentFov - targetFov) < 0.01) {
    currentFov = targetFov
  }

  viewer.camera.fov = currentFov
  viewer.camera.updateProjectionMatrix()
}

export const watchFov = () => {
  const updateFov = () => {
    if (!bot) return
    let fov = gameAdditionalState.isZooming ? 30 : options.fov

    if (bot.controlState.sprint && !bot.controlState.sneak) {
      fov += 5
    }
    if (gameAdditionalState.isFlying) {
      fov += 5
    }

    if (targetFov !== fov) {
      targetFov = fov
      lastUpdateTime = performance.now()
    }
  }

  customEvents.on('gameLoaded', () => {
    updateFov()
  })

  updateFov()

  // Add FOV animation to render loop
  if (!beforeRenderFrame.includes(updateFovAnimation)) {
    beforeRenderFrame.push(updateFovAnimation)
  }

  subscribeKey(options, 'fov', updateFov)
  subscribeKey(gameAdditionalState, 'isFlying', updateFov)
  subscribeKey(gameAdditionalState, 'isSprinting', updateFov)
  subscribeKey(gameAdditionalState, 'isZooming', updateFov)
  subscribeKey(gameAdditionalState, 'isSneaking', () => {
    viewer.isSneaking = gameAdditionalState.isSneaking
    viewer.setFirstPersonCamera(bot.entity.position, bot.entity.yaw, bot.entity.pitch)
  })
}
