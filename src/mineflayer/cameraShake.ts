import * as THREE from 'three'

class CameraShake {
  private rollAngle = 0
  private get damageRollAmount () { return 5 }
  private get damageAnimDuration () { return 200 }
  private rollAnimation?: { startTime: number, startRoll: number, targetRoll: number, duration: number, returnToZero?: boolean }

  constructor () {
    this.rollAngle = 0
  }

  shakeFromDamage () {
    // Add roll animation
    const startRoll = this.rollAngle
    const targetRoll = startRoll + (Math.random() < 0.5 ? -1 : 1) * this.damageRollAmount

    this.rollAnimation = {
      startTime: performance.now(),
      startRoll,
      targetRoll,
      duration: this.damageAnimDuration / 2
    }
  }

  update () {
    // Update roll animation
    if (this.rollAnimation) {
      const now = performance.now()
      const elapsed = now - this.rollAnimation.startTime
      const progress = Math.min(elapsed / this.rollAnimation.duration, 1)

      if (this.rollAnimation.returnToZero) {
        // Ease back to zero
        this.rollAngle = this.rollAnimation.startRoll * (1 - this.easeInOut(progress))
        if (progress === 1) {
          this.rollAnimation = undefined
        }
      } else {
        // Initial roll
        this.rollAngle = this.rollAnimation.startRoll + (this.rollAnimation.targetRoll - this.rollAnimation.startRoll) * this.easeOut(progress)
        if (progress === 1) {
          // Start return to zero animation
          this.rollAnimation = {
            startTime: now,
            startRoll: this.rollAngle,
            targetRoll: 0,
            duration: this.damageAnimDuration / 2,
            returnToZero: true
          }
        }
      }
    }

    // Apply roll to camera
    appViewer.backend?.setRoll(this.rollAngle)
  }

  private easeOut (t: number): number {
    return 1 - (1 - t) * (1 - t)
  }

  private easeInOut (t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
  }
}

let cameraShake: CameraShake

customEvents.on('hurtAnimation', () => {
  cameraShake.shakeFromDamage()
})

customEvents.on('mineflayerBotCreated', () => {
  if (!cameraShake) {
    cameraShake = new CameraShake()
    beforeRenderFrame.push(() => {
      cameraShake.update()
    })
  }

  bot._client.on('hurt_animation', () => {
    customEvents.emit('hurtAnimation')
  })
  bot.on('entityHurt', ({ id }) => {
    if (id === bot.entity.id) {
      customEvents.emit('hurtAnimation')
    }
  })
  let { health } = bot
  bot.on('health', () => {
    if (bot.health < health) {
      customEvents.emit('hurtAnimation')
    }
    health = bot.health
  })
})
