import * as THREE from 'three'
import { WorldRendererThree } from './worldrendererThree'

export interface SoundSystem {
  playSound: (position: { x: number, y: number, z: number }, path: string, volume?: number, pitch?: number) => void
  destroy: () => void
}

export class ThreeJsSound implements SoundSystem {
  audioListener: THREE.AudioListener | undefined
  private readonly activeSounds = new Set<THREE.PositionalAudio>()
  private readonly audioContext: AudioContext | undefined
  constructor (public worldRenderer: WorldRendererThree) {
  }

  initAudioListener () {
    if (this.audioListener) return
    this.audioListener = new THREE.AudioListener()
    this.worldRenderer.camera.add(this.audioListener)
  }

  playSound (position: { x: number, y: number, z: number }, path: string, volume = 1, pitch = 1) {
    this.initAudioListener()

    const sound = new THREE.PositionalAudio(this.audioListener!)
    this.activeSounds.add(sound)

    const audioLoader = new THREE.AudioLoader()
    const start = Date.now()
    void audioLoader.loadAsync(path).then((buffer) => {
      if (Date.now() - start > 500) return
      // play
      sound.setBuffer(buffer)
      sound.setRefDistance(20)
      sound.setVolume(volume)
      sound.setPlaybackRate(pitch) // set the pitch
      this.worldRenderer.scene.add(sound)
      // set sound position
      sound.position.set(position.x, position.y, position.z)
      sound.onEnded = () => {
        this.worldRenderer.scene.remove(sound)
        if (sound.source) {
          sound.disconnect()
        }
        this.activeSounds.delete(sound)
        audioLoader.manager.itemEnd(path)
      }
      sound.play()
    })
  }

  destroy () {
    // Stop and clean up all active sounds
    for (const sound of this.activeSounds) {
      sound.stop()
      if (sound.source) {
        sound.disconnect()
      }
    }

    // Remove and cleanup audio listener
    if (this.audioListener) {
      this.audioListener.removeFromParent()
      this.audioListener = undefined
    }
  }

  playTestSound () {
    this.playSound(this.worldRenderer.camera.position, '/sound.mp3')
  }
}
