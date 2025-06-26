import * as THREE from 'three'
import { WorldRendererThree } from './worldrendererThree'

export class CameraShake {
  private rollAngle = 0
  private get damageRollAmount () { return 5 }
  private get damageAnimDuration () { return 200 }
  private rollAnimation?: { startTime: number, startRoll: number, targetRoll: number, duration: number, returnToZero?: boolean }
  private basePitch = 0
  private baseYaw = 0

  constructor (public worldRenderer: WorldRendererThree, public onRenderCallbacks: Array<() => void>) {
    onRenderCallbacks.push(() => {
      this.update()
    })
  }

  setBaseRotation (pitch: number, yaw: number) {
    this.basePitch = pitch
    this.baseYaw = yaw
    this.update()
  }

  getBaseRotation () {
    return { pitch: this.basePitch, yaw: this.baseYaw }
  }

  shakeFromDamage (yaw?: number) {
    // Add roll animation
    const startRoll = this.rollAngle
    const targetRoll = startRoll + (yaw ?? (Math.random() < 0.5 ? -1 : 1)) * this.damageRollAmount

    this.rollAnimation = {
      startTime: performance.now(),
      startRoll,
      targetRoll,
      duration: this.damageAnimDuration / 2
    }
  }

  update () {
    if (this.worldRenderer.playerStateUtils.isSpectatingEntity()) {
      // Remove any shaking when spectating
      this.rollAngle = 0
      this.rollAnimation = undefined
    }
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

    const camera = this.worldRenderer.cameraObject

    if (this.worldRenderer.cameraGroupVr) {
      // For VR camera, only apply yaw rotation
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.baseYaw)
      camera.setRotationFromQuaternion(yawQuat)
    } else {
      // For regular camera, apply all rotations
      const pitchQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.basePitch)
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.baseYaw)
      const rollQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(this.rollAngle))
      // Combine rotations in the correct order: pitch -> yaw -> roll
      const finalQuat = yawQuat.multiply(pitchQuat).multiply(rollQuat)
      camera.setRotationFromQuaternion(finalQuat)
    }
  }

  private easeOut (t: number): number {
    return 1 - (1 - t) * (1 - t)
  }

  private easeInOut (t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
  }
}
